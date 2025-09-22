-- FINAL FIX: Product name length constraint preventing barcode scanning
-- Drops view, changes columns to TEXT, recreates view with correct structure

BEGIN;

-- Drop the problematic view
DROP VIEW IF EXISTS inventory_audit_view CASCADE;

-- Now alter all the name columns to TEXT (unlimited length)
ALTER TABLE products ALTER COLUMN name TYPE TEXT;
ALTER TABLE products ALTER COLUMN brand TYPE TEXT;
ALTER TABLE products ALTER COLUMN category TYPE TEXT;

ALTER TABLE storage_locations ALTER COLUMN name TYPE TEXT;

-- Update other tables if columns exist
DO $$
BEGIN
    -- Inventory items custom_label
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'inventory_items'
        AND column_name = 'custom_label'
    ) THEN
        ALTER TABLE inventory_items ALTER COLUMN custom_label TYPE TEXT;
    END IF;

    -- Shopping list items
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'shopping_list_items'
        AND column_name = 'item_name'
    ) THEN
        ALTER TABLE shopping_list_items ALTER COLUMN item_name TYPE TEXT;
    END IF;

    -- Recipes
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'recipes'
        AND column_name = 'title'
    ) THEN
        ALTER TABLE recipes ALTER COLUMN title TYPE TEXT;
    END IF;

    -- Recipe ingredients
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'recipe_ingredients'
        AND column_name = 'ingredient_name'
    ) THEN
        ALTER TABLE recipe_ingredients ALTER COLUMN ingredient_name TYPE TEXT;
    END IF;

    -- Households name
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'households'
        AND column_name = 'name'
    ) THEN
        ALTER TABLE households ALTER COLUMN name TYPE TEXT;
    END IF;

    -- Family members name
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'family_members'
        AND column_name = 'name'
    ) THEN
        ALTER TABLE family_members ALTER COLUMN name TYPE TEXT;
    END IF;
END $$;

-- Recreate the inventory audit view with correct column names
CREATE OR REPLACE VIEW inventory_audit_view AS
SELECT
    ii.id,
    ii.household_id,
    p.name AS product_name,
    p.brand,
    p.category,
    sl.name AS storage_location_name,
    ii.quantity,
    ii.unit,
    ii.expiration_date,
    ii.purchase_date,
    ii.cost AS purchase_price,  -- Using 'cost' column instead of 'purchase_price'
    ii.custom_label,  -- Using 'custom_label' instead of 'custom_name'
    ii.notes,
    ii.created_at,
    ii.updated_at
FROM inventory_items ii
LEFT JOIN products p ON ii.product_id = p.id
LEFT JOIN storage_locations sl ON ii.storage_location_id = sl.id;

-- Add comments
COMMENT ON COLUMN products.name IS 'Product name - TEXT type allows unlimited length for barcode API descriptions';
COMMENT ON COLUMN products.brand IS 'Product brand - TEXT type for flexibility';
COMMENT ON COLUMN products.category IS 'Product category - TEXT type for flexibility';
COMMENT ON COLUMN storage_locations.name IS 'Storage location name - TEXT type for flexibility';

COMMIT;

-- Notify success
DO $$
BEGIN
    RAISE NOTICE 'Successfully updated all name columns to TEXT type - no more length restrictions!';
END $$;