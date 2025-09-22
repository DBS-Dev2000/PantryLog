-- Fix product name length constraint to handle longer product names
-- Some products (especially with full descriptions) exceed 100 characters

-- First check if the products table exists and has the name column
DO $$
BEGIN
    -- Check if products table exists
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'products'
    ) THEN
        -- Alter the name column to allow longer names (up to 500 characters)
        -- This is safe as VARCHAR in PostgreSQL doesn't reserve space
        ALTER TABLE products
        ALTER COLUMN name TYPE VARCHAR(500);

        RAISE NOTICE 'Successfully updated products.name to VARCHAR(500)';
    ELSE
        RAISE NOTICE 'Products table does not exist, skipping';
    END IF;

    -- Also check if storage_locations table exists and update it
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'storage_locations'
    ) THEN
        -- Update storage_locations name field as well for consistency
        ALTER TABLE storage_locations
        ALTER COLUMN name TYPE VARCHAR(200);

        RAISE NOTICE 'Successfully updated storage_locations.name to VARCHAR(200)';
    END IF;

    -- Check if households table exists and update name field
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'households'
    ) THEN
        -- Update households name field
        ALTER TABLE households
        ALTER COLUMN name TYPE VARCHAR(200);

        RAISE NOTICE 'Successfully updated households.name to VARCHAR(200)';
    END IF;

    -- Check if family_members table exists and update name field
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'family_members'
    ) THEN
        -- Update family_members name field
        ALTER TABLE family_members
        ALTER COLUMN name TYPE VARCHAR(200);

        RAISE NOTICE 'Successfully updated family_members.name to VARCHAR(200)';
    END IF;

    -- Check if recipes table exists and update name field
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'recipes'
    ) THEN
        -- Update recipes name field to be consistent
        ALTER TABLE recipes
        ALTER COLUMN name TYPE VARCHAR(500);

        RAISE NOTICE 'Successfully updated recipes.name to VARCHAR(500)';
    END IF;

    -- Check if recipe_ingredients table exists and update ingredient_name field
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'recipe_ingredients'
    ) THEN
        -- Update recipe_ingredients ingredient_name field
        ALTER TABLE recipe_ingredients
        ALTER COLUMN ingredient_name TYPE VARCHAR(500);

        RAISE NOTICE 'Successfully updated recipe_ingredients.ingredient_name to VARCHAR(500)';
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error updating column types: %', SQLERRM;
END;
$$;

-- Also update any other tables that might have product name references
DO $$
BEGIN
    -- Update inventory_items custom_name if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'inventory_items'
        AND column_name = 'custom_name'
    ) THEN
        ALTER TABLE inventory_items
        ALTER COLUMN custom_name TYPE VARCHAR(500);

        RAISE NOTICE 'Successfully updated inventory_items.custom_name to VARCHAR(500)';
    END IF;

    -- Update shopping_list_items item_name if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'shopping_list_items'
        AND column_name = 'item_name'
    ) THEN
        ALTER TABLE shopping_list_items
        ALTER COLUMN item_name TYPE VARCHAR(500);

        RAISE NOTICE 'Successfully updated shopping_list_items.item_name to VARCHAR(500)';
    END IF;

    -- Update meal_history meal_name if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'meal_history'
        AND column_name = 'meal_name'
    ) THEN
        ALTER TABLE meal_history
        ALTER COLUMN meal_name TYPE VARCHAR(500);

        RAISE NOTICE 'Successfully updated meal_history.meal_name to VARCHAR(500)';
    END IF;

    -- Update planned_meals custom_meal_name if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'planned_meals'
        AND column_name = 'custom_meal_name'
    ) THEN
        ALTER TABLE planned_meals
        ALTER COLUMN custom_meal_name TYPE VARCHAR(500);

        RAISE NOTICE 'Successfully updated planned_meals.custom_meal_name to VARCHAR(500)';
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error updating additional column types: %', SQLERRM;
END;
$$;

-- Add a comment to document why we increased the length
COMMENT ON COLUMN products.name IS 'Product name - increased to 500 chars to handle long product descriptions from barcode APIs';