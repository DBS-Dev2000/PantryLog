-- COMPREHENSIVE FIX: Product name length constraint preventing barcode scanning
-- This migration handles ALL views that might depend on name columns

DO $$
DECLARE
    view_record RECORD;
    view_definitions TEXT[];
    view_names TEXT[];
    i INTEGER;
BEGIN
    -- Step 1: Find and save ALL views that might depend on our tables
    i := 1;
    FOR view_record IN
        SELECT DISTINCT v.viewname, v.definition
        FROM pg_views v
        JOIN pg_depend d ON d.refobjid = ('public.' || v.viewname)::regclass
        JOIN pg_class c ON c.oid = d.objid
        WHERE v.schemaname = 'public'
        AND c.relname IN ('products', 'storage_locations', 'inventory_items', 'shopping_list_items', 'recipes', 'recipe_ingredients')
    LOOP
        view_names[i] := view_record.viewname;
        view_definitions[i] := view_record.definition;
        i := i + 1;
        RAISE NOTICE 'Found dependent view: %', view_record.viewname;
    END LOOP;

    -- Step 2: Drop ALL dependent views
    IF array_length(view_names, 1) > 0 THEN
        FOR i IN 1..array_length(view_names, 1) LOOP
            EXECUTE format('DROP VIEW IF EXISTS %I CASCADE', view_names[i]);
            RAISE NOTICE 'Dropped view: %', view_names[i];
        END LOOP;
    END IF;

    -- Also drop known views that might exist
    DROP VIEW IF EXISTS inventory_audit_view CASCADE;
    DROP VIEW IF EXISTS product_inventory_view CASCADE;
    DROP VIEW IF EXISTS shopping_list_view CASCADE;
    DROP VIEW IF EXISTS recipe_ingredients_view CASCADE;

    RAISE NOTICE 'All dependent views dropped';

    -- Step 3: Now we can safely alter ALL the columns

    -- Products table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products') THEN
        ALTER TABLE products ALTER COLUMN name TYPE TEXT;
        ALTER TABLE products ALTER COLUMN brand TYPE TEXT;
        ALTER TABLE products ALTER COLUMN category TYPE TEXT;
        RAISE NOTICE 'Updated products table columns to TEXT';
    END IF;

    -- Storage locations table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'storage_locations') THEN
        ALTER TABLE storage_locations ALTER COLUMN name TYPE TEXT;
        RAISE NOTICE 'Updated storage_locations.name to TEXT';
    END IF;

    -- Inventory items table
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'inventory_items'
        AND column_name = 'custom_name'
    ) THEN
        ALTER TABLE inventory_items ALTER COLUMN custom_name TYPE TEXT;
        RAISE NOTICE 'Updated inventory_items.custom_name to TEXT';
    END IF;

    -- Shopping list items table
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'shopping_list_items'
        AND column_name = 'item_name'
    ) THEN
        ALTER TABLE shopping_list_items ALTER COLUMN item_name TYPE TEXT;
        RAISE NOTICE 'Updated shopping_list_items.item_name to TEXT';
    END IF;

    -- Recipes table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'recipes') THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'recipes'
            AND column_name = 'name'
        ) THEN
            ALTER TABLE recipes ALTER COLUMN name TYPE TEXT;
            RAISE NOTICE 'Updated recipes.name to TEXT';
        END IF;

        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'recipes'
            AND column_name = 'title'
        ) THEN
            ALTER TABLE recipes ALTER COLUMN title TYPE TEXT;
            RAISE NOTICE 'Updated recipes.title to TEXT';
        END IF;
    END IF;

    -- Recipe ingredients table
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'recipe_ingredients'
        AND column_name = 'ingredient_name'
    ) THEN
        ALTER TABLE recipe_ingredients ALTER COLUMN ingredient_name TYPE TEXT;
        RAISE NOTICE 'Updated recipe_ingredients.ingredient_name to TEXT';
    END IF;

    -- Households table
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'households'
        AND column_name = 'name'
    ) THEN
        ALTER TABLE households ALTER COLUMN name TYPE TEXT;
        RAISE NOTICE 'Updated households.name to TEXT';
    END IF;

    -- Family members table
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'family_members'
        AND column_name = 'name'
    ) THEN
        ALTER TABLE family_members ALTER COLUMN name TYPE TEXT;
        RAISE NOTICE 'Updated family_members.name to TEXT';
    END IF;

    -- Step 4: Recreate the saved views
    IF array_length(view_names, 1) > 0 THEN
        FOR i IN 1..array_length(view_names, 1) LOOP
            BEGIN
                EXECUTE format('CREATE VIEW %I AS %s', view_names[i], view_definitions[i]);
                RAISE NOTICE 'Recreated view: %', view_names[i];
            EXCEPTION
                WHEN OTHERS THEN
                    RAISE NOTICE 'Could not recreate view %: %', view_names[i], SQLERRM;
            END;
        END LOOP;
    END IF;

    RAISE NOTICE 'Migration completed successfully!';

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error during migration: %', SQLERRM;
        RAISE;
END $$;

-- Add helpful comments
COMMENT ON COLUMN products.name IS 'Product name - using TEXT to handle very long product descriptions from barcode APIs without any length restrictions';
COMMENT ON COLUMN storage_locations.name IS 'Storage location name - using TEXT for flexibility';
COMMENT ON COLUMN recipes.title IS 'Recipe title - using TEXT for flexibility';