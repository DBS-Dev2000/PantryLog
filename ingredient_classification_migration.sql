-- Ingredient Classification Migration
-- Run this in Supabase SQL Editor to add smart ingredient matching

-- Create ingredient_categories table for classification
CREATE TABLE IF NOT EXISTS ingredient_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    parent_category_id UUID REFERENCES ingredient_categories(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insert common ingredient categories
INSERT INTO ingredient_categories (name, description) VALUES
('Salt & Seasonings', 'All types of salt and basic seasonings'),
('Sugars & Sweeteners', 'All forms of sugar and sweetening agents'),
('Oils & Fats', 'Cooking oils, butter, and other fats'),
('Flour & Grains', 'All types of flour and grain products'),
('Dairy & Alternatives', 'Milk, cheese, and dairy alternatives'),
('Proteins', 'Meat, poultry, fish, and protein alternatives'),
('Vegetables', 'Fresh, frozen, and canned vegetables'),
('Fruits', 'Fresh, frozen, dried, and canned fruits'),
('Herbs & Spices', 'Fresh and dried herbs and spices'),
('Liquids', 'Broths, stocks, wines, and cooking liquids')
ON CONFLICT (name) DO NOTHING;

-- Create ingredient_aliases table for smart matching
CREATE TABLE IF NOT EXISTS ingredient_aliases (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    category_id UUID REFERENCES ingredient_categories(id),
    canonical_name VARCHAR(200) NOT NULL, -- Standard ingredient name
    alias_name VARCHAR(200) NOT NULL, -- Alternative name or brand
    match_strength DECIMAL(3,2) DEFAULT 1.0 CHECK (match_strength >= 0.1 AND match_strength <= 1.0),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(canonical_name, alias_name)
);

-- Insert common salt aliases
INSERT INTO ingredient_aliases (canonical_name, alias_name, match_strength, category_id, notes) VALUES
('salt', 'sea salt', 1.0, (SELECT id FROM ingredient_categories WHERE name = 'Salt & Seasonings'), 'Perfect substitute'),
('salt', 'fine sea salt', 1.0, (SELECT id FROM ingredient_categories WHERE name = 'Salt & Seasonings'), 'Perfect substitute'),
('salt', 'mediterranean sea salt', 1.0, (SELECT id FROM ingredient_categories WHERE name = 'Salt & Seasonings'), 'Perfect substitute'),
('salt', 'fine mediterranean sea salt', 1.0, (SELECT id FROM ingredient_categories WHERE name = 'Salt & Seasonings'), 'Perfect substitute'),
('salt', 'kosher salt', 0.9, (SELECT id FROM ingredient_categories WHERE name = 'Salt & Seasonings'), 'Use 1.5x amount'),
('salt', 'table salt', 1.0, (SELECT id FROM ingredient_categories WHERE name = 'Salt & Seasonings'), 'Perfect substitute'),
('salt', 'rock salt', 0.8, (SELECT id FROM ingredient_categories WHERE name = 'Salt & Seasonings'), 'Grinding required'),
('salt', 'himalayan salt', 1.0, (SELECT id FROM ingredient_categories WHERE name = 'Salt & Seasonings'), 'Perfect substitute'),
('salt', 'pink salt', 1.0, (SELECT id FROM ingredient_categories WHERE name = 'Salt & Seasonings'), 'Perfect substitute');

-- Insert common sugar aliases
INSERT INTO ingredient_aliases (canonical_name, alias_name, match_strength, category_id, notes) VALUES
('sugar', 'white sugar', 1.0, (SELECT id FROM ingredient_categories WHERE name = 'Sugars & Sweeteners'), 'Perfect substitute'),
('sugar', 'granulated sugar', 1.0, (SELECT id FROM ingredient_categories WHERE name = 'Sugars & Sweeteners'), 'Perfect substitute'),
('sugar', 'cane sugar', 1.0, (SELECT id FROM ingredient_categories WHERE name = 'Sugars & Sweeteners'), 'Perfect substitute'),
('sugar', 'brown sugar', 0.9, (SELECT id FROM ingredient_categories WHERE name = 'Sugars & Sweeteners'), 'Different flavor profile'),
('sugar', 'coconut sugar', 0.8, (SELECT id FROM ingredient_categories WHERE name = 'Sugars & Sweeteners'), 'Use 1:1 ratio'),
('flour', 'all-purpose flour', 1.0, (SELECT id FROM ingredient_categories WHERE name = 'Flour & Grains'), 'Perfect substitute'),
('flour', 'plain flour', 1.0, (SELECT id FROM ingredient_categories WHERE name = 'Flour & Grains'), 'Perfect substitute'),
('flour', 'wheat flour', 1.0, (SELECT id FROM ingredient_categories WHERE name = 'Flour & Grains'), 'Perfect substitute');

-- Insert oil aliases
INSERT INTO ingredient_aliases (canonical_name, alias_name, match_strength, category_id, notes) VALUES
('oil', 'vegetable oil', 1.0, (SELECT id FROM ingredient_categories WHERE name = 'Oils & Fats'), 'Perfect substitute'),
('oil', 'canola oil', 1.0, (SELECT id FROM ingredient_categories WHERE name = 'Oils & Fats'), 'Perfect substitute'),
('oil', 'olive oil', 0.9, (SELECT id FROM ingredient_categories WHERE name = 'Oils & Fats'), 'Different flavor'),
('oil', 'extra virgin olive oil', 0.8, (SELECT id FROM ingredient_categories WHERE name = 'Oils & Fats'), 'Strong flavor'),
('butter', 'unsalted butter', 1.0, (SELECT id FROM ingredient_categories WHERE name = 'Oils & Fats'), 'Perfect substitute'),
('butter', 'salted butter', 0.9, (SELECT id FROM ingredient_categories WHERE name = 'Oils & Fats'), 'Reduce added salt');

-- Function to find ingredient matches
CREATE OR REPLACE FUNCTION find_ingredient_matches(
    p_recipe_ingredient VARCHAR,
    p_household_id UUID
)
RETURNS TABLE(
    product_id UUID,
    product_name VARCHAR,
    available_quantity DECIMAL,
    storage_location VARCHAR,
    match_strength DECIMAL,
    match_type VARCHAR -- 'exact', 'alias', 'fuzzy'
) AS $$
BEGIN
    RETURN QUERY
    -- First try exact matches
    SELECT
        p.id,
        p.name,
        COALESCE(SUM(ii.quantity), 0),
        string_agg(DISTINCT sl.name, ', '),
        1.0::DECIMAL,
        'exact'::VARCHAR
    FROM products p
    LEFT JOIN inventory_items ii ON p.id = ii.product_id
        AND ii.household_id = p_household_id
        AND ii.is_consumed = false
    LEFT JOIN storage_locations sl ON ii.storage_location_id = sl.id
    WHERE LOWER(p.name) = LOWER(p_recipe_ingredient)
    GROUP BY p.id, p.name
    HAVING COALESCE(SUM(ii.quantity), 0) > 0

    UNION ALL

    -- Try alias matches
    SELECT
        p.id,
        p.name,
        COALESCE(SUM(ii.quantity), 0),
        string_agg(DISTINCT sl.name, ', '),
        ia.match_strength,
        'alias'::VARCHAR
    FROM ingredient_aliases ia
    JOIN products p ON LOWER(p.name) LIKE '%' || LOWER(ia.alias_name) || '%'
    LEFT JOIN inventory_items ii ON p.id = ii.product_id
        AND ii.household_id = p_household_id
        AND ii.is_consumed = false
    LEFT JOIN storage_locations sl ON ii.storage_location_id = sl.id
    WHERE LOWER(ia.canonical_name) = LOWER(p_recipe_ingredient)
    GROUP BY p.id, p.name, ia.match_strength
    HAVING COALESCE(SUM(ii.quantity), 0) > 0

    UNION ALL

    -- Fuzzy matches for partial name matching
    SELECT
        p.id,
        p.name,
        COALESCE(SUM(ii.quantity), 0),
        string_agg(DISTINCT sl.name, ', '),
        0.7::DECIMAL,
        'fuzzy'::VARCHAR
    FROM products p
    LEFT JOIN inventory_items ii ON p.id = ii.product_id
        AND ii.household_id = p_household_id
        AND ii.is_consumed = false
    LEFT JOIN storage_locations sl ON ii.storage_location_id = sl.id
    WHERE LOWER(p.name) LIKE '%' || LOWER(p_recipe_ingredient) || '%'
        OR LOWER(p_recipe_ingredient) LIKE '%' || LOWER(p.name) || '%'
    GROUP BY p.id, p.name
    HAVING COALESCE(SUM(ii.quantity), 0) > 0

    ORDER BY match_strength DESC, available_quantity DESC;
END;
$$ LANGUAGE plpgsql;

-- Enhanced recipe availability check with smart matching
CREATE OR REPLACE FUNCTION check_recipe_availability_smart(
    p_recipe_id UUID,
    p_household_id UUID
)
RETURNS TABLE(
    ingredient_name TEXT,
    required_quantity DECIMAL,
    required_unit TEXT,
    available_quantity DECIMAL,
    availability_status TEXT,
    storage_locations TEXT[],
    matched_product_name TEXT,
    match_type TEXT,
    match_strength DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ri.ingredient_name::TEXT,
        ri.quantity,
        ri.unit::TEXT,
        COALESCE(matches.available_quantity, 0),
        CASE
            WHEN matches.available_quantity >= ri.quantity THEN 'available'
            WHEN matches.available_quantity > 0 THEN 'partial'
            ELSE 'missing'
        END::TEXT,
        string_to_array(matches.storage_location, ', ')::TEXT[],
        matches.product_name::TEXT,
        matches.match_type::TEXT,
        COALESCE(matches.match_strength, 0.0)
    FROM recipe_ingredients ri
    LEFT JOIN LATERAL (
        SELECT *
        FROM find_ingredient_matches(ri.ingredient_name, p_household_id)
        ORDER BY match_strength DESC, available_quantity DESC
        LIMIT 1
    ) matches ON true
    WHERE ri.recipe_id = p_recipe_id
    ORDER BY ri.sort_order, ri.ingredient_name;
END;
$$ LANGUAGE plpgsql;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ingredient_aliases_canonical ON ingredient_aliases(canonical_name);
CREATE INDEX IF NOT EXISTS idx_ingredient_aliases_alias ON ingredient_aliases(alias_name);
CREATE INDEX IF NOT EXISTS idx_ingredient_categories_parent ON ingredient_categories(parent_category_id);

-- Disable RLS for ingredient tables
ALTER TABLE ingredient_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE ingredient_aliases DISABLE ROW LEVEL SECURITY;

-- Add comments for documentation
COMMENT ON TABLE ingredient_categories IS 'Hierarchical ingredient classification for smart matching';
COMMENT ON TABLE ingredient_aliases IS 'Ingredient aliases and substitutions for recipe matching';
COMMENT ON FUNCTION find_ingredient_matches IS 'Finds inventory products that match recipe ingredients using aliases and fuzzy matching';
COMMENT ON FUNCTION check_recipe_availability_smart IS 'Enhanced recipe availability check with smart ingredient matching';