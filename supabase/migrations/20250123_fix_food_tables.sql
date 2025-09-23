-- Fix food tables - add missing columns if they don't exist
-- This migration ensures the tables have all required columns

-- Add category column to ingredient_equivalencies if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'ingredient_equivalencies'
        AND column_name = 'category'
    ) THEN
        ALTER TABLE ingredient_equivalencies ADD COLUMN category TEXT;
    END IF;
END $$;

-- Add notes column to ingredient_equivalencies if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'ingredient_equivalencies'
        AND column_name = 'notes'
    ) THEN
        ALTER TABLE ingredient_equivalencies ADD COLUMN notes TEXT;
    END IF;
END $$;

-- Add timestamp columns to ingredient_equivalencies if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'ingredient_equivalencies'
        AND column_name = 'created_at'
    ) THEN
        ALTER TABLE ingredient_equivalencies ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'ingredient_equivalencies'
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE ingredient_equivalencies ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Ensure all columns exist in food_taxonomy
DO $$
BEGIN
    -- Add parent_category if missing
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'food_taxonomy'
        AND column_name = 'parent_category'
    ) THEN
        ALTER TABLE food_taxonomy ADD COLUMN parent_category TEXT;
    END IF;

    -- Add can_substitute_for if missing
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'food_taxonomy'
        AND column_name = 'can_substitute_for'
    ) THEN
        ALTER TABLE food_taxonomy ADD COLUMN can_substitute_for TEXT[];
    END IF;

    -- Add created_at if missing
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'food_taxonomy'
        AND column_name = 'created_at'
    ) THEN
        ALTER TABLE food_taxonomy ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    END IF;

    -- Add updated_at if missing
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'food_taxonomy'
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE food_taxonomy ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Add unique constraints if they don't exist
DO $$
BEGIN
    -- Add unique constraint on primary_name for ingredient_equivalencies
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_name = 'ingredient_equivalencies'
        AND constraint_type = 'UNIQUE'
        AND constraint_name = 'ingredient_equivalencies_primary_name_key'
    ) THEN
        ALTER TABLE ingredient_equivalencies
        ADD CONSTRAINT ingredient_equivalencies_primary_name_key UNIQUE (primary_name);
    END IF;

    -- The food_taxonomy table already has UNIQUE on food_name from the CREATE TABLE
    -- but let's ensure it exists
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_name = 'food_taxonomy'
        AND constraint_type = 'UNIQUE'
        AND constraint_name = 'food_taxonomy_food_name_key'
    ) THEN
        ALTER TABLE food_taxonomy
        ADD CONSTRAINT food_taxonomy_food_name_key UNIQUE (food_name);
    END IF;
END $$;

-- Drop and recreate policies safely
DO $$
BEGIN
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Everyone can read food taxonomy" ON food_taxonomy;
    DROP POLICY IF EXISTS "Everyone can read ingredient equivalencies" ON ingredient_equivalencies;
    DROP POLICY IF EXISTS "Only service role can modify food taxonomy" ON food_taxonomy;
    DROP POLICY IF EXISTS "Only service role can modify ingredient equivalencies" ON ingredient_equivalencies;
END $$;

-- Recreate policies
CREATE POLICY "Everyone can read food taxonomy"
    ON food_taxonomy FOR SELECT
    USING (true);

CREATE POLICY "Everyone can read ingredient equivalencies"
    ON ingredient_equivalencies FOR SELECT
    USING (true);

CREATE POLICY "Only service role can modify food taxonomy"
    ON food_taxonomy FOR ALL
    USING (auth.jwt()->>'role' = 'service_role')
    WITH CHECK (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Only service role can modify ingredient equivalencies"
    ON ingredient_equivalencies FOR ALL
    USING (auth.jwt()->>'role' = 'service_role')
    WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- Verify table structure
DO $$
DECLARE
    equiv_cols INTEGER;
    taxonomy_cols INTEGER;
    r RECORD;
BEGIN
    SELECT COUNT(*) INTO equiv_cols
    FROM information_schema.columns
    WHERE table_name = 'ingredient_equivalencies';

    SELECT COUNT(*) INTO taxonomy_cols
    FROM information_schema.columns
    WHERE table_name = 'food_taxonomy';

    RAISE NOTICE 'Table structure check:';
    RAISE NOTICE 'ingredient_equivalencies has % columns', equiv_cols;
    RAISE NOTICE 'food_taxonomy has % columns', taxonomy_cols;

    -- List all columns for debugging
    RAISE NOTICE 'ingredient_equivalencies columns:';
    FOR r IN
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'ingredient_equivalencies'
        ORDER BY ordinal_position
    LOOP
        RAISE NOTICE '  - %: %', r.column_name, r.data_type;
    END LOOP;
END $$;