-- Create inventory usage log table to track when items are used
CREATE TABLE IF NOT EXISTS inventory_usage_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    household_id UUID NOT NULL,
    quantity_used DECIMAL(10,2) NOT NULL,
    unit TEXT,
    used_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    remaining_quantity DECIMAL(10,2),
    used_by UUID REFERENCES auth.users(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_inventory_usage_log_household_id ON inventory_usage_log(household_id);
CREATE INDEX IF NOT EXISTS idx_inventory_usage_log_product_id ON inventory_usage_log(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_usage_log_used_date ON inventory_usage_log(used_date);
CREATE INDEX IF NOT EXISTS idx_inventory_usage_log_inventory_item_id ON inventory_usage_log(inventory_item_id);

-- Enable RLS
ALTER TABLE inventory_usage_log ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for households to access their own usage logs
CREATE POLICY "Households can view their own usage logs" ON inventory_usage_log
    FOR SELECT
    USING (household_id = auth.uid());

CREATE POLICY "Households can insert their own usage logs" ON inventory_usage_log
    FOR INSERT
    WITH CHECK (household_id = auth.uid());

CREATE POLICY "Households can update their own usage logs" ON inventory_usage_log
    FOR UPDATE
    USING (household_id = auth.uid())
    WITH CHECK (household_id = auth.uid());

CREATE POLICY "Households can delete their own usage logs" ON inventory_usage_log
    FOR DELETE
    USING (household_id = auth.uid());

-- Add comment for documentation
COMMENT ON TABLE inventory_usage_log IS 'Tracks when inventory items are used or consumed';
COMMENT ON COLUMN inventory_usage_log.quantity_used IS 'Amount of the item that was used';
COMMENT ON COLUMN inventory_usage_log.remaining_quantity IS 'Quantity remaining after usage';
COMMENT ON COLUMN inventory_usage_log.used_by IS 'User who recorded the usage';