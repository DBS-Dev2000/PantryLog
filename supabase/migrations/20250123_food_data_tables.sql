-- Create tables for food taxonomy and ingredient matching data
-- This moves large static data from code to database for better performance

-- Enable pg_trgm extension for fuzzy matching (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Food taxonomy table
CREATE TABLE IF NOT EXISTS food_taxonomy (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    food_name TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL,
    subcategory TEXT,
    parent_category TEXT,
    shelf_life_pantry_days INTEGER,
    shelf_life_fridge_days INTEGER,
    shelf_life_freezer_days INTEGER,
    portion_size TEXT,
    portion_unit TEXT,
    storage_recommendation TEXT,
    can_substitute_for TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_food_taxonomy_name ON food_taxonomy(food_name);
CREATE INDEX IF NOT EXISTS idx_food_taxonomy_category ON food_taxonomy(category);
CREATE INDEX IF NOT EXISTS idx_food_taxonomy_name_trgm ON food_taxonomy USING gin (food_name gin_trgm_ops);

-- Ingredient equivalencies table
CREATE TABLE IF NOT EXISTS ingredient_equivalencies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    primary_name TEXT NOT NULL,
    equivalent_names TEXT[] NOT NULL,
    category TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_ingredient_equiv_primary ON ingredient_equivalencies(primary_name);
CREATE INDEX IF NOT EXISTS idx_ingredient_equiv_names ON ingredient_equivalencies USING gin (equivalent_names);

-- Enable RLS
ALTER TABLE food_taxonomy ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredient_equivalencies ENABLE ROW LEVEL SECURITY;

-- Everyone can read these tables (they're reference data)
CREATE POLICY "Everyone can read food taxonomy"
    ON food_taxonomy FOR SELECT
    USING (true);

CREATE POLICY "Everyone can read ingredient equivalencies"
    ON ingredient_equivalencies FOR SELECT
    USING (true);

-- Only admins can modify (we'll populate via migrations)
CREATE POLICY "Only service role can modify food taxonomy"
    ON food_taxonomy FOR ALL
    USING (auth.jwt()->>'role' = 'service_role')
    WITH CHECK (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Only service role can modify ingredient equivalencies"
    ON ingredient_equivalencies FOR ALL
    USING (auth.jwt()->>'role' = 'service_role')
    WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- Drop all existing versions of the function
DO $$
BEGIN
    -- Drop any existing versions of find_ingredient_matches
    DROP FUNCTION IF EXISTS find_ingredient_matches(TEXT, UUID);
    DROP FUNCTION IF EXISTS find_ingredient_matches(TEXT);
    DROP FUNCTION IF EXISTS find_ingredient_matches(VARCHAR, UUID);
    DROP FUNCTION IF EXISTS find_ingredient_matches(VARCHAR);
    -- Drop with CASCADE to remove dependencies
    DROP FUNCTION IF EXISTS find_ingredient_matches CASCADE;
EXCEPTION
    WHEN undefined_function THEN
        NULL; -- Function doesn't exist, that's fine
    WHEN ambiguous_function THEN
        -- If ambiguous, drop all versions
        DROP FUNCTION IF EXISTS find_ingredient_matches CASCADE;
END $$;

-- Function to find ingredient matches
CREATE OR REPLACE FUNCTION find_ingredient_matches(
    p_ingredient_name TEXT,
    p_household_id UUID DEFAULT NULL
)
RETURNS TABLE (
    product_id UUID,
    product_name TEXT,
    match_type TEXT,
    confidence INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH normalized_ingredient AS (
        SELECT lower(trim(p_ingredient_name)) as name
    ),
    -- First check equivalencies
    equivalency_matches AS (
        SELECT p.id, p.name, 'equivalency' as match_type, 100 as confidence
        FROM products p, normalized_ingredient ni
        WHERE EXISTS (
            SELECT 1 FROM ingredient_equivalencies ie
            WHERE (
                lower(ie.primary_name) = ni.name
                OR ni.name = ANY(SELECT lower(e) FROM unnest(ie.equivalent_names) e)
            )
            AND (
                lower(p.name) = lower(ie.primary_name)
                OR lower(p.name) = ANY(SELECT lower(e) FROM unnest(ie.equivalent_names) e)
            )
        )
    ),
    -- Then check taxonomy matches
    taxonomy_matches AS (
        SELECT p.id, p.name, 'category' as match_type, 80 as confidence
        FROM products p, normalized_ingredient ni
        WHERE EXISTS (
            SELECT 1 FROM food_taxonomy ft1, food_taxonomy ft2
            WHERE lower(ft1.food_name) = ni.name
            AND lower(ft2.food_name) = lower(p.name)
            AND ft1.category = ft2.category
        )
    ),
    -- Finally partial matches
    partial_matches AS (
        SELECT p.id, p.name, 'partial' as match_type, 50 as confidence
        FROM products p, normalized_ingredient ni
        WHERE p.name ILIKE '%' || ni.name || '%'
        OR ni.name ILIKE '%' || p.name || '%'
    )
    -- Return all matches ordered by confidence
    SELECT DISTINCT ON (product_id) * FROM (
        SELECT * FROM equivalency_matches
        UNION ALL
        SELECT * FROM taxonomy_matches
        WHERE id NOT IN (SELECT id FROM equivalency_matches)
        UNION ALL
        SELECT * FROM partial_matches
        WHERE id NOT IN (SELECT id FROM equivalency_matches)
        AND id NOT IN (SELECT id FROM taxonomy_matches)
    ) all_matches
    ORDER BY product_id, confidence DESC;
END;
$$;

-- Drop all existing versions of get_shelf_life function
DO $$
BEGIN
    -- Drop any existing versions
    DROP FUNCTION IF EXISTS get_shelf_life(TEXT, TEXT);
    DROP FUNCTION IF EXISTS get_shelf_life(TEXT);
    DROP FUNCTION IF EXISTS get_shelf_life(VARCHAR, VARCHAR);
    DROP FUNCTION IF EXISTS get_shelf_life(VARCHAR);
    -- Drop with CASCADE to remove dependencies
    DROP FUNCTION IF EXISTS get_shelf_life CASCADE;
EXCEPTION
    WHEN undefined_function THEN
        NULL; -- Function doesn't exist, that's fine
    WHEN ambiguous_function THEN
        -- If ambiguous, drop all versions
        DROP FUNCTION IF EXISTS get_shelf_life CASCADE;
END $$;

-- Function to get shelf life recommendations
CREATE OR REPLACE FUNCTION get_shelf_life(
    p_food_name TEXT,
    p_storage_type TEXT DEFAULT 'pantry'
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_days INTEGER;
BEGIN
    SELECT CASE
        WHEN lower(p_storage_type) = 'pantry' THEN shelf_life_pantry_days
        WHEN lower(p_storage_type) = 'fridge' THEN shelf_life_fridge_days
        WHEN lower(p_storage_type) = 'freezer' THEN shelf_life_freezer_days
        ELSE shelf_life_pantry_days
    END INTO v_days
    FROM food_taxonomy
    WHERE lower(food_name) = lower(p_food_name)
    OR food_name ILIKE '%' || p_food_name || '%'
    ORDER BY
        CASE WHEN lower(food_name) = lower(p_food_name) THEN 0 ELSE 1 END,
        length(food_name)
    LIMIT 1;

    RETURN COALESCE(v_days, 30); -- Default 30 days if not found
END;
$$;

-- Add comments
COMMENT ON TABLE food_taxonomy IS 'Master food taxonomy with categories, shelf life, and storage info';
COMMENT ON TABLE ingredient_equivalencies IS 'Ingredient name equivalencies for recipe matching';
COMMENT ON FUNCTION find_ingredient_matches IS 'Find products matching a recipe ingredient name';
COMMENT ON FUNCTION get_shelf_life IS 'Get recommended shelf life for a food item in specific storage';