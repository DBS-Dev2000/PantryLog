-- Household Food Taxonomy and Ingredient Equivalencies System
-- Allows households to customize defaults with their own regional/cultural preferences

-- Household Food Taxonomy Overrides
-- Inherits from main food_taxonomy but allows household-specific customizations
CREATE TABLE IF NOT EXISTS household_food_taxonomy (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    product_name TEXT NOT NULL,
    category TEXT NOT NULL,
    subcategory TEXT,
    shelf_life_pantry INTEGER, -- days
    shelf_life_fridge INTEGER, -- days
    shelf_life_freezer INTEGER, -- days
    storage_recommendation TEXT, -- preferred storage location
    confidence_score DECIMAL(3,2) DEFAULT 1.0, -- how confident we are in this classification
    is_override BOOLEAN DEFAULT false, -- true if overriding system default
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(household_id, product_name)
);

-- Household Ingredient Equivalencies
-- Regional/cultural ingredient substitutions (e.g., "squirrel" = "tuna" in the south)
CREATE TABLE IF NOT EXISTS household_ingredient_equivalencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    ingredient_name TEXT NOT NULL, -- base ingredient (e.g., "tuna")
    equivalent_name TEXT NOT NULL, -- what it's equivalent to (e.g., "squirrel")
    confidence_score DECIMAL(3,2) DEFAULT 1.0, -- substitution quality (1.0 = perfect, 0.5 = okay)
    substitution_ratio TEXT DEFAULT '1:1', -- conversion ratio if different
    notes TEXT, -- cooking notes, preparation differences
    is_bidirectional BOOLEAN DEFAULT true, -- does equivalent_name also work for ingredient_name
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(household_id, ingredient_name, equivalent_name)
);

-- Household Shelf Life Overrides
-- Household-specific shelf life adjustments for specific products
CREATE TABLE IF NOT EXISTS household_shelf_life_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    product_name TEXT NOT NULL,
    storage_type TEXT NOT NULL, -- 'pantry', 'fridge', 'freezer'
    shelf_life_days INTEGER NOT NULL,
    reason TEXT, -- why this household has different shelf life
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(household_id, product_name, storage_type)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_household_food_taxonomy_household ON household_food_taxonomy(household_id);
CREATE INDEX IF NOT EXISTS idx_household_food_taxonomy_product ON household_food_taxonomy(product_name);
CREATE INDEX IF NOT EXISTS idx_household_food_taxonomy_category ON household_food_taxonomy(category);

CREATE INDEX IF NOT EXISTS idx_household_ingredient_equiv_household ON household_ingredient_equivalencies(household_id);
CREATE INDEX IF NOT EXISTS idx_household_ingredient_equiv_ingredient ON household_ingredient_equivalencies(ingredient_name);
CREATE INDEX IF NOT EXISTS idx_household_ingredient_equiv_equivalent ON household_ingredient_equivalencies(equivalent_name);

CREATE INDEX IF NOT EXISTS idx_household_shelf_life_household ON household_shelf_life_overrides(household_id);
CREATE INDEX IF NOT EXISTS idx_household_shelf_life_product ON household_shelf_life_overrides(product_name);

-- Function to get effective food taxonomy for a household
-- Returns household override if exists, otherwise system default
CREATE OR REPLACE FUNCTION get_household_food_taxonomy(
    p_household_id UUID,
    p_product_name TEXT
) RETURNS TABLE (
    category TEXT,
    subcategory TEXT,
    shelf_life_pantry INTEGER,
    shelf_life_fridge INTEGER,
    shelf_life_freezer INTEGER,
    storage_recommendation TEXT,
    confidence_score DECIMAL,
    source TEXT -- 'household' or 'system'
) AS $$
BEGIN
    -- First check for household override
    RETURN QUERY
    SELECT
        hft.category,
        hft.subcategory,
        hft.shelf_life_pantry,
        hft.shelf_life_fridge,
        hft.shelf_life_freezer,
        hft.storage_recommendation,
        hft.confidence_score,
        'household'::TEXT as source
    FROM household_food_taxonomy hft
    WHERE hft.household_id = p_household_id
    AND LOWER(hft.product_name) = LOWER(p_product_name);

    -- If no household override found, check system defaults
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT
            ft.category,
            ft.subcategory,
            ft.shelf_life_pantry,
            ft.shelf_life_fridge,
            ft.shelf_life_freezer,
            ft.storage_recommendation,
            ft.confidence_score,
            'system'::TEXT as source
        FROM food_taxonomy ft
        WHERE LOWER(ft.product_name) = LOWER(p_product_name);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to get all ingredient equivalencies for a household
-- Combines system defaults with household customizations
CREATE OR REPLACE FUNCTION get_household_ingredient_equivalencies(
    p_household_id UUID,
    p_ingredient_name TEXT
) RETURNS TABLE (
    equivalent_name TEXT,
    confidence_score DECIMAL,
    substitution_ratio TEXT,
    notes TEXT,
    source TEXT -- 'household' or 'system'
) AS $$
BEGIN
    -- Return household-specific equivalencies first (higher priority)
    RETURN QUERY
    SELECT
        hie.equivalent_name,
        hie.confidence_score,
        hie.substitution_ratio,
        hie.notes,
        'household'::TEXT as source
    FROM household_ingredient_equivalencies hie
    WHERE hie.household_id = p_household_id
    AND LOWER(hie.ingredient_name) = LOWER(p_ingredient_name);

    -- Then add system defaults that aren't overridden
    RETURN QUERY
    SELECT
        ie.equivalent_name,
        1.0::DECIMAL as confidence_score,
        '1:1'::TEXT as substitution_ratio,
        NULL::TEXT as notes,
        'system'::TEXT as source
    FROM ingredient_equivalencies ie
    WHERE LOWER(ie.ingredient_name) = LOWER(p_ingredient_name)
    AND ie.equivalent_name NOT IN (
        SELECT hie.equivalent_name
        FROM household_ingredient_equivalencies hie
        WHERE hie.household_id = p_household_id
        AND LOWER(hie.ingredient_name) = LOWER(p_ingredient_name)
    );
END;
$$ LANGUAGE plpgsql;

-- Function to get effective shelf life for a product in a household
CREATE OR REPLACE FUNCTION get_household_shelf_life(
    p_household_id UUID,
    p_product_name TEXT,
    p_storage_type TEXT
) RETURNS INTEGER AS $$
DECLARE
    shelf_life_days INTEGER;
BEGIN
    -- First check household override
    SELECT hslo.shelf_life_days INTO shelf_life_days
    FROM household_shelf_life_overrides hslo
    WHERE hslo.household_id = p_household_id
    AND LOWER(hslo.product_name) = LOWER(p_product_name)
    AND LOWER(hslo.storage_type) = LOWER(p_storage_type);

    -- If found, return it
    IF shelf_life_days IS NOT NULL THEN
        RETURN shelf_life_days;
    END IF;

    -- Otherwise get from food taxonomy (household or system)
    IF LOWER(p_storage_type) = 'pantry' THEN
        SELECT t.shelf_life_pantry INTO shelf_life_days
        FROM get_household_food_taxonomy(p_household_id, p_product_name) t;
    ELSIF LOWER(p_storage_type) = 'fridge' OR LOWER(p_storage_type) = 'refrigerator' THEN
        SELECT t.shelf_life_fridge INTO shelf_life_days
        FROM get_household_food_taxonomy(p_household_id, p_product_name) t;
    ELSIF LOWER(p_storage_type) = 'freezer' THEN
        SELECT t.shelf_life_freezer INTO shelf_life_days
        FROM get_household_food_taxonomy(p_household_id, p_product_name) t;
    END IF;

    RETURN COALESCE(shelf_life_days, 7); -- default to 7 days if nothing found
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON TABLE household_food_taxonomy IS 'Household-specific food classification overrides and customizations';
COMMENT ON TABLE household_ingredient_equivalencies IS 'Regional/cultural ingredient substitutions for households';
COMMENT ON TABLE household_shelf_life_overrides IS 'Household-specific shelf life adjustments for products';

COMMENT ON FUNCTION get_household_food_taxonomy IS 'Gets effective food taxonomy for a household (household override > system default)';
COMMENT ON FUNCTION get_household_ingredient_equivalencies IS 'Gets all ingredient equivalencies for a household (household + system)';
COMMENT ON FUNCTION get_household_shelf_life IS 'Gets effective shelf life for a product considering household overrides';