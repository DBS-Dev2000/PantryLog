-- Audit Logging Migration
-- Run this in Supabase SQL Editor to add comprehensive audit tracking

-- Create inventory_audit_log table
CREATE TABLE IF NOT EXISTS inventory_audit_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    inventory_item_id UUID NOT NULL, -- References inventory_items(id)
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    user_id UUID NOT NULL, -- References auth.users(id) - who performed the action
    action_type VARCHAR(20) NOT NULL CHECK (action_type IN ('add', 'remove', 'adjust', 'consume', 'edit')),

    -- What changed
    quantity_before DECIMAL(10,2),
    quantity_after DECIMAL(10,2),
    quantity_delta DECIMAL(10,2), -- +5 for add, -3 for remove, etc.

    -- Pricing information (especially important for FIFO removal)
    unit_cost DECIMAL(10,2), -- Cost per unit when removed (FIFO pricing)
    total_value DECIMAL(10,2), -- Total value of the change

    -- Additional metadata
    notes TEXT, -- Reason for change, e.g., "Quick Add", "Recipe: Pasta Dinner", "Adjustment: Miscounted"
    source_action VARCHAR(50), -- 'quick_add', 'quick_use', 'manual_add', 'recipe_use', 'adjustment'

    -- Timestamps
    action_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_log_inventory_item ON inventory_audit_log(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_household_user ON inventory_audit_log(household_id, user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action_date ON inventory_audit_log(action_date DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action_type ON inventory_audit_log(action_type);

-- Add audit tracking columns to inventory_items table
ALTER TABLE inventory_items
ADD COLUMN IF NOT EXISTS created_by UUID, -- Who added this item
ADD COLUMN IF NOT EXISTS last_modified_by UUID, -- Who last changed this item
ADD COLUMN IF NOT EXISTS last_modified_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- Function to calculate FIFO cost for item removal
CREATE OR REPLACE FUNCTION get_fifo_cost(
    p_product_id UUID,
    p_storage_location_id UUID,
    p_household_id UUID,
    p_quantity_to_remove DECIMAL
)
RETURNS DECIMAL AS $$
DECLARE
    total_cost DECIMAL := 0;
    remaining_to_remove DECIMAL := p_quantity_to_remove;
    item_record RECORD;
BEGIN
    -- Get items in FIFO order (oldest first)
    FOR item_record IN
        SELECT id, quantity, cost, purchase_date
        FROM inventory_items
        WHERE product_id = p_product_id
          AND storage_location_id = p_storage_location_id
          AND household_id = p_household_id
          AND is_consumed = false
          AND quantity > 0
        ORDER BY purchase_date ASC, created_at ASC
    LOOP
        IF remaining_to_remove <= 0 THEN
            EXIT;
        END IF;

        DECLARE
            quantity_from_this_item DECIMAL;
            cost_per_unit DECIMAL;
        BEGIN
            -- How much to take from this item
            quantity_from_this_item := LEAST(item_record.quantity, remaining_to_remove);

            -- Calculate cost per unit (handle null costs)
            cost_per_unit := COALESCE(item_record.cost, 0) / NULLIF(item_record.quantity, 0);

            -- Add to total cost
            total_cost := total_cost + (quantity_from_this_item * COALESCE(cost_per_unit, 0));

            -- Reduce remaining quantity needed
            remaining_to_remove := remaining_to_remove - quantity_from_this_item;
        END;
    END LOOP;

    RETURN total_cost;
END;
$$ LANGUAGE plpgsql;

-- Function to log inventory changes
CREATE OR REPLACE FUNCTION log_inventory_change(
    p_inventory_item_id UUID,
    p_household_id UUID,
    p_user_id UUID,
    p_action_type VARCHAR,
    p_quantity_before DECIMAL,
    p_quantity_after DECIMAL,
    p_unit_cost DECIMAL DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_source_action VARCHAR DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO inventory_audit_log (
        inventory_item_id,
        household_id,
        user_id,
        action_type,
        quantity_before,
        quantity_after,
        quantity_delta,
        unit_cost,
        total_value,
        notes,
        source_action
    ) VALUES (
        p_inventory_item_id,
        p_household_id,
        p_user_id,
        p_action_type,
        p_quantity_before,
        p_quantity_after,
        p_quantity_after - p_quantity_before,
        p_unit_cost,
        ABS(p_quantity_after - p_quantity_before) * COALESCE(p_unit_cost, 0),
        p_notes,
        p_source_action
    );
END;
$$ LANGUAGE plpgsql;

-- Update inventory_items to track user information
UPDATE inventory_items
SET created_by = household_id, last_modified_by = household_id, last_modified_at = created_at
WHERE created_by IS NULL;

-- Disable RLS for audit log table
ALTER TABLE inventory_audit_log DISABLE ROW LEVEL SECURITY;

-- Add comments for documentation
COMMENT ON TABLE inventory_audit_log IS 'Complete audit trail of all inventory changes with user tracking and FIFO pricing';
COMMENT ON FUNCTION get_fifo_cost(UUID, UUID, UUID, DECIMAL) IS 'Calculates the total cost of removing quantity using FIFO pricing';
COMMENT ON FUNCTION log_inventory_change(UUID, UUID, UUID, VARCHAR, DECIMAL, DECIMAL, DECIMAL, TEXT, VARCHAR) IS 'Logs inventory changes with user attribution and pricing data';

-- Create view for audit log with user-friendly data
CREATE OR REPLACE VIEW inventory_audit_view AS
SELECT
    ial.*,
    ii.quantity as current_quantity,
    ii.unit,
    p.name as product_name,
    p.brand as product_brand,
    sl.name as storage_location_name,
    sl.type as storage_location_type
FROM inventory_audit_log ial
LEFT JOIN inventory_items ii ON ial.inventory_item_id = ii.id
LEFT JOIN products p ON ii.product_id = p.id
LEFT JOIN storage_locations sl ON ii.storage_location_id = sl.id
ORDER BY ial.action_date DESC;