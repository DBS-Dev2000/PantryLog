-- URGENT FIX: Product name length constraint preventing barcode scanning
-- This migration increases the character limit for product names to handle long descriptions

-- Drop any existing constraints on the name column first
DO $$
DECLARE
    constraint_record RECORD;
BEGIN
    -- Find and drop any CHECK constraints on products.name
    FOR constraint_record IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'products'::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) LIKE '%name%'
    LOOP
        EXECUTE format('ALTER TABLE products DROP CONSTRAINT IF EXISTS %I', constraint_record.conname);
    END LOOP;
END $$;

-- Now alter the column type without any issues
ALTER TABLE products
ALTER COLUMN name TYPE TEXT;

-- Also update the brand column as it might have similar issues
ALTER TABLE products
ALTER COLUMN brand TYPE TEXT;

-- Update category as well for consistency
ALTER TABLE products
ALTER COLUMN category TYPE TEXT;

-- Add a comment explaining why we use TEXT
COMMENT ON COLUMN products.name IS 'Product name - using TEXT to handle very long product descriptions from barcode APIs without any length restrictions';

-- Also fix any other tables that might reference product names
DO $$
BEGIN
    -- Fix inventory_items if it has a custom_name column
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'inventory_items'
        AND column_name = 'custom_name'
    ) THEN
        ALTER TABLE inventory_items ALTER COLUMN custom_name TYPE TEXT;
    END IF;

    -- Fix shopping_list_items if it has an item_name column
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'shopping_list_items'
        AND column_name = 'item_name'
    ) THEN
        ALTER TABLE shopping_list_items ALTER COLUMN item_name TYPE TEXT;
    END IF;

    -- Fix recipes table
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'recipes'
        AND column_name = 'name'
    ) THEN
        ALTER TABLE recipes ALTER COLUMN name TYPE TEXT;
    END IF;

    -- Fix recipe_ingredients table
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'recipe_ingredients'
        AND column_name = 'ingredient_name'
    ) THEN
        ALTER TABLE recipe_ingredients ALTER COLUMN ingredient_name TYPE TEXT;
    END IF;
END $$;

-- Log the completion
DO $$
BEGIN
    RAISE NOTICE 'Successfully updated all product name columns to TEXT type - no more length restrictions!';
END $$;