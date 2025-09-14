-- Shopping List Sharing Migration
-- Run this in Supabase SQL Editor to add shopping list sharing and management

-- Create shopping_list_sharing table for access control
CREATE TABLE IF NOT EXISTS shopping_list_sharing (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    shopping_list_id UUID NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
    user_id UUID NOT NULL, -- References auth.users(id)
    permission_level VARCHAR(20) DEFAULT 'view' CHECK (permission_level IN ('view', 'edit', 'admin')),
    shared_by UUID NOT NULL, -- References auth.users(id) - who shared the list
    shared_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(shopping_list_id, user_id)
);

-- Add sharing columns to shopping_lists table
ALTER TABLE shopping_lists
ADD COLUMN IF NOT EXISTS sharing_type VARCHAR(20) DEFAULT 'private' CHECK (sharing_type IN ('private', 'shared_select', 'shared_all')),
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS completed_by UUID, -- References auth.users(id)
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS archived_by UUID; -- References auth.users(id)

-- Update status constraint to include more lifecycle states
ALTER TABLE shopping_lists
DROP CONSTRAINT IF EXISTS shopping_lists_status_check;

ALTER TABLE shopping_lists
ADD CONSTRAINT shopping_lists_status_check
CHECK (status IN ('active', 'completed', 'archived', 'deleted'));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_shopping_list_sharing_user ON shopping_list_sharing(user_id);
CREATE INDEX IF NOT EXISTS idx_shopping_list_sharing_list ON shopping_list_sharing(shopping_list_id);
CREATE INDEX IF NOT EXISTS idx_shopping_lists_sharing_type ON shopping_lists(sharing_type);

-- Function to share shopping list with household members
CREATE OR REPLACE FUNCTION share_shopping_list(
    p_list_id UUID,
    p_shared_by UUID,
    p_sharing_type VARCHAR,
    p_selected_users UUID[] DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    household_id_var UUID;
    member_record RECORD;
    shared_count INTEGER := 0;
BEGIN
    -- Get household ID from shopping list
    SELECT household_id INTO household_id_var
    FROM shopping_lists
    WHERE id = p_list_id;

    -- Update sharing type
    UPDATE shopping_lists
    SET sharing_type = p_sharing_type
    WHERE id = p_list_id;

    -- Clear existing shares (except owner)
    DELETE FROM shopping_list_sharing
    WHERE shopping_list_id = p_list_id
      AND user_id != p_shared_by;

    -- Share with selected users or all household members
    IF p_sharing_type = 'shared_all' THEN
        -- Share with all household members
        FOR member_record IN
            SELECT user_id
            FROM household_members
            WHERE household_id = household_id_var
              AND user_id != p_shared_by
        LOOP
            INSERT INTO shopping_list_sharing (shopping_list_id, user_id, permission_level, shared_by)
            VALUES (p_list_id, member_record.user_id, 'edit', p_shared_by)
            ON CONFLICT (shopping_list_id, user_id) DO NOTHING;

            shared_count := shared_count + 1;
        END LOOP;

    ELSIF p_sharing_type = 'shared_select' AND p_selected_users IS NOT NULL THEN
        -- Share with selected users only
        FOR i IN 1..array_length(p_selected_users, 1) LOOP
            INSERT INTO shopping_list_sharing (shopping_list_id, user_id, permission_level, shared_by)
            VALUES (p_list_id, p_selected_users[i], 'edit', p_shared_by)
            ON CONFLICT (shopping_list_id, user_id) DO NOTHING;

            shared_count := shared_count + 1;
        END LOOP;
    END IF;

    RETURN shared_count;
END;
$$ LANGUAGE plpgsql;

-- Function to complete shopping list
CREATE OR REPLACE FUNCTION complete_shopping_list(
    p_list_id UUID,
    p_user_id UUID
)
RETURNS VOID AS $$
BEGIN
    UPDATE shopping_lists
    SET status = 'completed',
        completed_at = NOW(),
        completed_by = p_user_id,
        updated_at = NOW()
    WHERE id = p_list_id;

    -- Mark all items as purchased
    UPDATE shopping_list_items
    SET is_purchased = true,
        purchased_at = NOW()
    WHERE shopping_list_id = p_list_id
      AND is_purchased = false;
END;
$$ LANGUAGE plpgsql;

-- Function to archive shopping list
CREATE OR REPLACE FUNCTION archive_shopping_list(
    p_list_id UUID,
    p_user_id UUID
)
RETURNS VOID AS $$
BEGIN
    UPDATE shopping_lists
    SET status = 'archived',
        archived_at = NOW(),
        archived_by = p_user_id,
        updated_at = NOW()
    WHERE id = p_list_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get user's accessible shopping lists
CREATE OR REPLACE FUNCTION get_user_shopping_lists(p_user_id UUID)
RETURNS TABLE(
    list_id UUID,
    list_name VARCHAR,
    list_status VARCHAR,
    sharing_type VARCHAR,
    total_items BIGINT,
    completed_items BIGINT,
    estimated_cost DECIMAL,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE,
    is_owner BOOLEAN,
    permission_level VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        sl.id,
        sl.name,
        sl.status,
        sl.sharing_type,
        COALESCE(item_counts.total_items, 0),
        COALESCE(item_counts.completed_items, 0),
        sl.total_estimated_cost,
        sl.created_by,
        sl.created_at,
        sl.created_by = p_user_id as is_owner,
        CASE
            WHEN sl.created_by = p_user_id THEN 'admin'
            ELSE COALESCE(sls.permission_level, 'view')
        END as permission_level
    FROM shopping_lists sl
    LEFT JOIN shopping_list_sharing sls ON sl.id = sls.shopping_list_id AND sls.user_id = p_user_id
    LEFT JOIN (
        SELECT
            shopping_list_id,
            COUNT(*) as total_items,
            COUNT(*) FILTER (WHERE is_purchased = true) as completed_items
        FROM shopping_list_items
        GROUP BY shopping_list_id
    ) item_counts ON sl.id = item_counts.shopping_list_id
    WHERE
        sl.created_by = p_user_id  -- Lists created by user
        OR sls.user_id = p_user_id  -- Lists shared with user
    ORDER BY
        sl.status = 'active' DESC,  -- Active lists first
        sl.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Disable RLS for sharing table
ALTER TABLE shopping_list_sharing DISABLE ROW LEVEL SECURITY;

-- Add comments for documentation
COMMENT ON TABLE shopping_list_sharing IS 'Shopping list access control and sharing permissions';
COMMENT ON FUNCTION share_shopping_list IS 'Shares shopping list with household members with specified permissions';
COMMENT ON FUNCTION complete_shopping_list IS 'Marks shopping list as completed and all items as purchased';
COMMENT ON FUNCTION archive_shopping_list IS 'Archives shopping list for historical reference';
COMMENT ON FUNCTION get_user_shopping_lists IS 'Gets all shopping lists accessible to a user with permission levels';