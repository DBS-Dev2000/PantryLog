-- Create food taxonomy tables with proper indexing for performance

-- Main food categories table
CREATE TABLE IF NOT EXISTS food_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Food subcategories table
CREATE TABLE IF NOT EXISTS food_subcategories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES food_categories(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(category_id, name)
);

-- Food items table (specific items within subcategories)
CREATE TABLE IF NOT EXISTS food_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subcategory_id UUID NOT NULL REFERENCES food_subcategories(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    recipe_matches JSONB, -- Array of recipe terms that match
    substitutions JSONB, -- Array of possible substitutions
    portion_size_oz DECIMAL(10,2),
    leftover_days INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_food_items_name ON food_items USING gin (to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS idx_food_items_subcategory ON food_items(subcategory_id);
CREATE INDEX IF NOT EXISTS idx_food_items_recipe_matches ON food_items USING gin (recipe_matches);

-- Ingredient equivalencies table for fast matching
CREATE TABLE IF NOT EXISTS ingredient_equivalencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    primary_name VARCHAR(200) NOT NULL,
    equivalent_names TEXT[] NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create GIN index for array search
CREATE INDEX IF NOT EXISTS idx_ingredient_equiv_names ON ingredient_equivalencies USING gin (equivalent_names);
CREATE INDEX IF NOT EXISTS idx_ingredient_equiv_primary ON ingredient_equivalencies(primary_name);

-- Food shelf life table
CREATE TABLE IF NOT EXISTS food_shelf_life (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    food_name VARCHAR(200) NOT NULL,
    category VARCHAR(100),
    pantry_days INTEGER,
    refrigerator_days INTEGER,
    freezer_days INTEGER,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for shelf life lookups
CREATE INDEX IF NOT EXISTS idx_shelf_life_name ON food_shelf_life USING gin (to_tsvector('english', food_name));
CREATE INDEX IF NOT EXISTS idx_shelf_life_category ON food_shelf_life(category);

-- Create a materialized view for fast recipe ingredient matching
CREATE MATERIALIZED VIEW IF NOT EXISTS ingredient_search_view AS
SELECT
    fi.id as food_item_id,
    fi.name as food_name,
    fs.name as subcategory,
    fc.name as category,
    fi.recipe_matches,
    fi.substitutions,
    fi.portion_size_oz,
    fi.leftover_days,
    to_tsvector('english',
        COALESCE(fi.name, '') || ' ' ||
        COALESCE(fs.name, '') || ' ' ||
        COALESCE(fc.name, '')
    ) as search_vector
FROM food_items fi
JOIN food_subcategories fs ON fi.subcategory_id = fs.id
JOIN food_categories fc ON fs.category_id = fc.id;

-- Create index on the materialized view
CREATE INDEX IF NOT EXISTS idx_ingredient_search_vector ON ingredient_search_view USING gin (search_vector);

-- Function to match ingredients efficiently
CREATE OR REPLACE FUNCTION match_ingredient(recipe_ingredient TEXT)
RETURNS TABLE(
    food_item_id UUID,
    food_name TEXT,
    category TEXT,
    subcategory TEXT,
    match_type TEXT,
    confidence DECIMAL
) AS $$
BEGIN
    -- First check for exact equivalencies
    RETURN QUERY
    SELECT DISTINCT
        fi.id as food_item_id,
        fi.name::TEXT as food_name,
        fc.name::TEXT as category,
        fs.name::TEXT as subcategory,
        'exact'::TEXT as match_type,
        1.0::DECIMAL as confidence
    FROM ingredient_equivalencies ie
    CROSS JOIN LATERAL unnest(ie.equivalent_names) as equiv(name)
    JOIN food_items fi ON lower(fi.name) = lower(equiv.name)
    JOIN food_subcategories fs ON fi.subcategory_id = fs.id
    JOIN food_categories fc ON fs.category_id = fc.id
    WHERE lower(ie.primary_name) = lower(recipe_ingredient)
        OR lower(recipe_ingredient) = ANY(
            SELECT lower(unnest(ie.equivalent_names))
        )
    LIMIT 5;

    -- If no exact matches, try full-text search
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT
            isv.food_item_id,
            isv.food_name::TEXT,
            isv.category::TEXT,
            isv.subcategory::TEXT,
            'partial'::TEXT as match_type,
            ts_rank(isv.search_vector, plainto_tsquery('english', recipe_ingredient))::DECIMAL as confidence
        FROM ingredient_search_view isv
        WHERE isv.search_vector @@ plainto_tsquery('english', recipe_ingredient)
        ORDER BY confidence DESC
        LIMIT 5;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to get shelf life efficiently
CREATE OR REPLACE FUNCTION get_shelf_life(
    product_name TEXT,
    product_category TEXT,
    storage_location TEXT
) RETURNS INTEGER AS $$
DECLARE
    shelf_life_days INTEGER;
    storage_column TEXT;
BEGIN
    -- Determine which column to use based on storage location
    storage_column := CASE lower(storage_location)
        WHEN 'pantry' THEN 'pantry_days'
        WHEN 'refrigerator' THEN 'refrigerator_days'
        WHEN 'fridge' THEN 'refrigerator_days'
        WHEN 'freezer' THEN 'freezer_days'
        ELSE 'refrigerator_days'
    END;

    -- Try to find exact match first
    EXECUTE format('
        SELECT %I
        FROM food_shelf_life
        WHERE lower(food_name) = lower($1)
            OR (category IS NOT NULL AND lower(category) = lower($2))
        ORDER BY
            CASE WHEN lower(food_name) = lower($1) THEN 0 ELSE 1 END,
            %I DESC NULLS LAST
        LIMIT 1
    ', storage_column, storage_column)
    INTO shelf_life_days
    USING product_name, product_category;

    -- Return result or default
    RETURN COALESCE(shelf_life_days, 7); -- Default to 7 days if not found
END;
$$ LANGUAGE plpgsql;