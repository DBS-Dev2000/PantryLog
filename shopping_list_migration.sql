-- Shopping List Migration
-- Run this in Supabase SQL Editor to add shopping list functionality

-- Create shopping_lists table for managing lists
CREATE TABLE IF NOT EXISTS shopping_lists (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL DEFAULT 'Shopping List',
    description TEXT,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
    total_estimated_cost DECIMAL(10,2) DEFAULT 0,

    -- Store integration (future)
    target_store VARCHAR(50), -- 'walmart', 'target', 'kroger', etc.
    store_list_id VARCHAR(100), -- External store API list ID

    -- Metadata
    created_by UUID NOT NULL, -- References auth.users(id)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create shopping_list_items table for individual items
CREATE TABLE IF NOT EXISTS shopping_list_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    shopping_list_id UUID NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id), -- Optional link to existing product

    -- Item details
    item_name VARCHAR(200) NOT NULL,
    brand VARCHAR(100),
    category VARCHAR(100),
    quantity DECIMAL(10,2) NOT NULL,
    unit VARCHAR(20) DEFAULT 'pieces',
    estimated_price DECIMAL(10,2),

    -- Shopping status
    is_purchased BOOLEAN DEFAULT false,
    purchased_at TIMESTAMP WITH TIME ZONE,
    actual_price DECIMAL(10,2),
    store_item_id VARCHAR(100), -- Store API product ID

    -- Priority and organization
    priority INTEGER DEFAULT 1 CHECK (priority >= 1 AND priority <= 5), -- 1=low, 5=urgent
    aisle VARCHAR(50), -- Store aisle/section
    notes TEXT,

    -- Auto-generated flags
    auto_added BOOLEAN DEFAULT false, -- Added automatically from low inventory
    inventory_trigger_id UUID, -- References inventory_items(id) that triggered this

    -- Metadata
    added_by UUID NOT NULL, -- References auth.users(id)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_shopping_lists_household ON shopping_lists(household_id);
CREATE INDEX IF NOT EXISTS idx_shopping_lists_status ON shopping_lists(status);
CREATE INDEX IF NOT EXISTS idx_shopping_list_items_list ON shopping_list_items(shopping_list_id);
CREATE INDEX IF NOT EXISTS idx_shopping_list_items_product ON shopping_list_items(product_id);
CREATE INDEX IF NOT EXISTS idx_shopping_list_items_purchased ON shopping_list_items(is_purchased);

-- Function to automatically add low inventory items to shopping list
CREATE OR REPLACE FUNCTION add_low_inventory_to_shopping_list(
    p_household_id UUID,
    p_user_id UUID,
    p_min_quantity DECIMAL DEFAULT 1
)
RETURNS INTEGER AS $$
DECLARE
    low_item RECORD;
    shopping_list_id_var UUID;
    items_added INTEGER := 0;
BEGIN
    -- Find or create active shopping list
    SELECT id INTO shopping_list_id_var
    FROM shopping_lists
    WHERE household_id = p_household_id
      AND status = 'active'
    ORDER BY created_at DESC
    LIMIT 1;

    -- Create shopping list if none exists
    IF shopping_list_id_var IS NULL THEN
        INSERT INTO shopping_lists (household_id, name, created_by)
        VALUES (p_household_id, 'Auto-Generated Shopping List', p_user_id)
        RETURNING id INTO shopping_list_id_var;
    END IF;

    -- Find low inventory items
    FOR low_item IN
        SELECT
            ii.id as inventory_id,
            ii.product_id,
            ii.quantity,
            ii.unit,
            p.name as product_name,
            p.brand,
            p.category
        FROM inventory_items ii
        INNER JOIN products p ON ii.product_id = p.id
        WHERE ii.household_id = p_household_id
          AND ii.is_consumed = false
          AND ii.quantity <= p_min_quantity
          AND NOT EXISTS (
              -- Don't add if already on shopping list
              SELECT 1 FROM shopping_list_items sli
              WHERE sli.shopping_list_id = shopping_list_id_var
                AND sli.product_id = ii.product_id
                AND sli.is_purchased = false
          )
    LOOP
        -- Add to shopping list
        INSERT INTO shopping_list_items (
            shopping_list_id,
            product_id,
            item_name,
            brand,
            category,
            quantity,
            unit,
            priority,
            auto_added,
            inventory_trigger_id,
            added_by
        ) VALUES (
            shopping_list_id_var,
            low_item.product_id,
            low_item.product_name,
            low_item.brand,
            low_item.category,
            GREATEST(1, CEIL(low_item.quantity)), -- At least 1, round up
            low_item.unit,
            3, -- Medium priority for auto-added items
            true,
            low_item.inventory_id,
            p_user_id
        );

        items_added := items_added + 1;
    END LOOP;

    RETURN items_added;
END;
$$ LANGUAGE plpgsql;

-- Function to mark shopping list item as purchased and add to inventory
CREATE OR REPLACE FUNCTION purchase_shopping_list_item(
    p_item_id UUID,
    p_user_id UUID,
    p_actual_price DECIMAL DEFAULT NULL,
    p_storage_location_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    item_record RECORD;
    household_id_var UUID;
BEGIN
    -- Get shopping list item details
    SELECT
        sli.*,
        sl.household_id
    INTO item_record, household_id_var
    FROM shopping_list_items sli
    INNER JOIN shopping_lists sl ON sli.shopping_list_id = sl.id
    WHERE sli.id = p_item_id;

    -- Mark as purchased
    UPDATE shopping_list_items
    SET is_purchased = true,
        purchased_at = NOW(),
        actual_price = p_actual_price
    WHERE id = p_item_id;

    -- Add to inventory if storage location provided
    IF p_storage_location_id IS NOT NULL THEN
        INSERT INTO inventory_items (
            product_id,
            storage_location_id,
            household_id,
            quantity,
            unit,
            purchase_date,
            cost,
            notes,
            created_by,
            last_modified_by,
            last_modified_at
        ) VALUES (
            item_record.product_id,
            p_storage_location_id,
            household_id_var,
            item_record.quantity,
            item_record.unit,
            CURRENT_DATE,
            p_actual_price,
            'Added from shopping list: ' || item_record.item_name,
            p_user_id,
            p_user_id,
            NOW()
        );
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Disable RLS for shopping list tables
ALTER TABLE shopping_lists DISABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_list_items DISABLE ROW LEVEL SECURITY;

-- Add comments for documentation
COMMENT ON TABLE shopping_lists IS 'Shopping lists with future store API integration support';
COMMENT ON TABLE shopping_list_items IS 'Individual items on shopping lists with purchase tracking';
COMMENT ON FUNCTION add_low_inventory_to_shopping_list IS 'Automatically adds low inventory items to shopping list';
COMMENT ON FUNCTION purchase_shopping_list_item IS 'Marks item as purchased and optionally adds to inventory';