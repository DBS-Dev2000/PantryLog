-- URGENT FIX: Product name length constraint preventing barcode scanning
-- This migration handles views that depend on the products table

DO $$
DECLARE
    view_def TEXT;
BEGIN
    -- Step 1: Save the view definition if it exists
    SELECT definition INTO view_def
    FROM pg_views
    WHERE viewname = 'inventory_audit_view'
    AND schemaname = 'public';

    -- Step 2: Drop the view if it exists
    IF view_def IS NOT NULL THEN
        DROP VIEW IF EXISTS inventory_audit_view CASCADE;
        RAISE NOTICE 'Dropped inventory_audit_view to allow column type changes';
    END IF;

    -- Step 3: Now alter the products table columns
    ALTER TABLE products
    ALTER COLUMN name TYPE TEXT;

    ALTER TABLE products
    ALTER COLUMN brand TYPE TEXT;

    ALTER TABLE products
    ALTER COLUMN category TYPE TEXT;

    RAISE NOTICE 'Successfully updated products table columns to TEXT';

    -- Step 4: Recreate the view if it existed
    IF view_def IS NOT NULL THEN
        EXECUTE 'CREATE VIEW inventory_audit_view AS ' || view_def;
        RAISE NOTICE 'Recreated inventory_audit_view';
    END IF;

    -- Step 5: Fix other tables that might have similar issues
    -- Fix inventory_items if it has a custom_name column
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'inventory_items'
        AND column_name = 'custom_name'
    ) THEN
        ALTER TABLE inventory_items ALTER COLUMN custom_name TYPE TEXT;
        RAISE NOTICE 'Updated inventory_items.custom_name to TEXT';
    END IF;

    -- Fix shopping_list_items if it has an item_name column
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'shopping_list_items'
        AND column_name = 'item_name'
    ) THEN
        ALTER TABLE shopping_list_items ALTER COLUMN item_name TYPE TEXT;
        RAISE NOTICE 'Updated shopping_list_items.item_name to TEXT';
    END IF;

    -- Fix recipes table
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'recipes'
        AND column_name = 'name'
    ) THEN
        ALTER TABLE recipes ALTER COLUMN name TYPE TEXT;
        RAISE NOTICE 'Updated recipes.name to TEXT';
    END IF;

    -- Fix recipes title column
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'recipes'
        AND column_name = 'title'
    ) THEN
        ALTER TABLE recipes ALTER COLUMN title TYPE TEXT;
        RAISE NOTICE 'Updated recipes.title to TEXT';
    END IF;

    -- Fix recipe_ingredients table
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'recipe_ingredients'
        AND column_name = 'ingredient_name'
    ) THEN
        ALTER TABLE recipe_ingredients ALTER COLUMN ingredient_name TYPE TEXT;
        RAISE NOTICE 'Updated recipe_ingredients.ingredient_name to TEXT';
    END IF;

    -- Fix storage_locations name
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'storage_locations'
        AND column_name = 'name'
    ) THEN
        ALTER TABLE storage_locations ALTER COLUMN name TYPE TEXT;
        RAISE NOTICE 'Updated storage_locations.name to TEXT';
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error during migration: %', SQLERRM;
        RAISE;
END $$;

-- Add a comment explaining why we use TEXT
COMMENT ON COLUMN products.name IS 'Product name - using TEXT to handle very long product descriptions from barcode APIs without any length restrictions';