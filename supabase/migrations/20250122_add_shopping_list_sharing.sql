-- Add sharing and permissions support to shopping lists

-- Add columns to shopping_lists if they don't exist
ALTER TABLE shopping_lists
ADD COLUMN IF NOT EXISTS is_shared BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS shared_with_household BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false;

-- Create table for shopping list member permissions
CREATE TABLE IF NOT EXISTS shopping_list_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    shopping_list_id UUID NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
    user_id UUID NOT NULL, -- References auth.users(id)

    -- Permissions
    can_view BOOLEAN DEFAULT true,
    can_add_items BOOLEAN DEFAULT true,
    can_remove_items BOOLEAN DEFAULT false,
    can_check_items BOOLEAN DEFAULT true,
    can_edit_list BOOLEAN DEFAULT false,
    can_delete_list BOOLEAN DEFAULT false,
    can_manage_members BOOLEAN DEFAULT false,

    -- Metadata
    added_by UUID NOT NULL, -- Who added this member
    added_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

    UNIQUE(shopping_list_id, user_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_shopping_list_members_list_id ON shopping_list_members(shopping_list_id);
CREATE INDEX IF NOT EXISTS idx_shopping_list_members_user_id ON shopping_list_members(user_id);
CREATE INDEX IF NOT EXISTS idx_shopping_lists_household ON shopping_lists(household_id, status);

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS user_can_access_shopping_list(UUID, UUID, TEXT);

-- Add a function to check if user has access to a shopping list
CREATE OR REPLACE FUNCTION user_can_access_shopping_list(
    p_user_id UUID,
    p_list_id UUID,
    p_permission TEXT DEFAULT 'view'
) RETURNS BOOLEAN AS $$
DECLARE
    v_household_id UUID;
    v_is_shared BOOLEAN;
    v_shared_with_household BOOLEAN;
    v_list_owner UUID;
    v_has_permission BOOLEAN;
BEGIN
    -- Get list details
    SELECT household_id, is_shared, shared_with_household, created_by
    INTO v_household_id, v_is_shared, v_shared_with_household, v_list_owner
    FROM shopping_lists
    WHERE id = p_list_id;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Check if user is the owner
    IF v_list_owner = p_user_id THEN
        RETURN TRUE;
    END IF;

    -- Check if user is in the same household and list is shared with household
    IF v_shared_with_household THEN
        IF EXISTS (
            SELECT 1 FROM households
            WHERE id = v_household_id
            AND id = p_user_id -- In our schema, user_id = household_id
        ) THEN
            -- Check specific permission for household members
            IF p_permission = 'view' OR p_permission = 'add' THEN
                RETURN TRUE;
            END IF;
        END IF;
    END IF;

    -- Check individual permissions in shopping_list_members
    IF p_permission = 'view' THEN
        SELECT can_view INTO v_has_permission
        FROM shopping_list_members
        WHERE shopping_list_id = p_list_id AND user_id = p_user_id;
    ELSIF p_permission = 'add' THEN
        SELECT can_add_items INTO v_has_permission
        FROM shopping_list_members
        WHERE shopping_list_id = p_list_id AND user_id = p_user_id;
    ELSIF p_permission = 'remove' THEN
        SELECT can_remove_items INTO v_has_permission
        FROM shopping_list_members
        WHERE shopping_list_id = p_list_id AND user_id = p_user_id;
    ELSIF p_permission = 'check' THEN
        SELECT can_check_items INTO v_has_permission
        FROM shopping_list_members
        WHERE shopping_list_id = p_list_id AND user_id = p_user_id;
    ELSIF p_permission = 'edit' THEN
        SELECT can_edit_list INTO v_has_permission
        FROM shopping_list_members
        WHERE shopping_list_id = p_list_id AND user_id = p_user_id;
    ELSIF p_permission = 'delete' THEN
        SELECT can_delete_list INTO v_has_permission
        FROM shopping_list_members
        WHERE shopping_list_id = p_list_id AND user_id = p_user_id;
    ELSIF p_permission = 'manage' THEN
        SELECT can_manage_members INTO v_has_permission
        FROM shopping_list_members
        WHERE shopping_list_id = p_list_id AND user_id = p_user_id;
    ELSE
        RETURN FALSE;
    END IF;

    RETURN COALESCE(v_has_permission, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing function if it exists with different signature
DROP FUNCTION IF EXISTS get_user_shopping_lists(UUID);

-- Function to get all accessible shopping lists for a user
CREATE OR REPLACE FUNCTION get_user_shopping_lists(
    p_user_id UUID
) RETURNS TABLE (
    id UUID,
    household_id UUID,
    name VARCHAR,
    description TEXT,
    status VARCHAR,
    is_shared BOOLEAN,
    is_primary BOOLEAN,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE,
    access_type TEXT,
    item_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH list_access AS (
        -- Lists owned by user
        SELECT
            sl.id,
            sl.household_id,
            sl.name,
            sl.description,
            sl.status,
            sl.is_shared,
            sl.is_primary,
            sl.created_by,
            sl.created_at,
            'owner' as access_type
        FROM shopping_lists sl
        WHERE sl.created_by = p_user_id

        UNION

        -- Lists shared with household
        SELECT
            sl.id,
            sl.household_id,
            sl.name,
            sl.description,
            sl.status,
            sl.is_shared,
            sl.is_primary,
            sl.created_by,
            sl.created_at,
            'household' as access_type
        FROM shopping_lists sl
        WHERE sl.household_id = p_user_id
        AND sl.shared_with_household = true
        AND sl.created_by != p_user_id

        UNION

        -- Lists shared individually
        SELECT
            sl.id,
            sl.household_id,
            sl.name,
            sl.description,
            sl.status,
            sl.is_shared,
            sl.is_primary,
            sl.created_by,
            sl.created_at,
            'shared' as access_type
        FROM shopping_lists sl
        INNER JOIN shopping_list_members slm ON sl.id = slm.shopping_list_id
        WHERE slm.user_id = p_user_id AND slm.can_view = true
    )
    SELECT
        la.*,
        COUNT(sli.id) as item_count
    FROM list_access la
    LEFT JOIN shopping_list_items sli ON la.id = sli.shopping_list_id
    GROUP BY la.id, la.household_id, la.name, la.description, la.status,
             la.is_shared, la.is_primary, la.created_by, la.created_at, la.access_type
    ORDER BY la.is_primary DESC, la.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS add_meal_plan_to_shopping_list(UUID, UUID, UUID);

-- Function to add items from meal plan to shopping list
CREATE OR REPLACE FUNCTION add_meal_plan_to_shopping_list(
    p_meal_plan_id UUID,
    p_shopping_list_id UUID,
    p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_items_added INT := 0;
    v_items_existing INT := 0;
    v_ingredient RECORD;
BEGIN
    -- Check permissions
    IF NOT user_can_access_shopping_list(p_user_id, p_shopping_list_id, 'add') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'You do not have permission to add items to this list'
        );
    END IF;

    -- Add ingredients from meal plan recipes
    FOR v_ingredient IN
        SELECT DISTINCT
            ri.ingredient_name as item_name,
            SUM(ri.quantity) as quantity,
            ri.unit,
            rc.name as category
        FROM planned_meals pm
        INNER JOIN recipe_ingredients ri ON pm.recipe_id = ri.recipe_id
        LEFT JOIN products p ON ri.product_id = p.id
        LEFT JOIN recipe_categories rc ON p.category_id = rc.id
        WHERE pm.meal_plan_id = p_meal_plan_id
        GROUP BY ri.ingredient_name, ri.unit, rc.name
    LOOP
        -- Check if item already exists in list
        IF EXISTS (
            SELECT 1 FROM shopping_list_items
            WHERE shopping_list_id = p_shopping_list_id
            AND LOWER(item_name) = LOWER(v_ingredient.item_name)
            AND NOT is_purchased
        ) THEN
            -- Update quantity
            UPDATE shopping_list_items
            SET quantity = quantity + v_ingredient.quantity,
                updated_at = NOW()
            WHERE shopping_list_id = p_shopping_list_id
            AND LOWER(item_name) = LOWER(v_ingredient.item_name)
            AND NOT is_purchased;

            v_items_existing := v_items_existing + 1;
        ELSE
            -- Add new item
            INSERT INTO shopping_list_items (
                shopping_list_id,
                item_name,
                category,
                quantity,
                unit,
                priority,
                auto_added,
                added_from_meal_plan
            ) VALUES (
                p_shopping_list_id,
                v_ingredient.item_name,
                v_ingredient.category,
                v_ingredient.quantity,
                v_ingredient.unit,
                2, -- Normal priority
                true,
                true
            );

            v_items_added := v_items_added + 1;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'items_added', v_items_added,
        'items_updated', v_items_existing,
        'total_items', v_items_added + v_items_existing
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add column to track items from meal plans
ALTER TABLE shopping_list_items
ADD COLUMN IF NOT EXISTS added_from_meal_plan BOOLEAN DEFAULT false;

-- Update RLS policies for new tables
ALTER TABLE shopping_list_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their list memberships"
    ON shopping_list_members FOR SELECT
    USING (user_id = auth.uid() OR added_by = auth.uid());

CREATE POLICY "List owners can manage members"
    ON shopping_list_members FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM shopping_lists
            WHERE shopping_lists.id = shopping_list_members.shopping_list_id
            AND shopping_lists.created_by = auth.uid()
        )
    );

-- Add comment for documentation
COMMENT ON TABLE shopping_list_members IS 'Manages individual user permissions for shopping lists';
COMMENT ON FUNCTION user_can_access_shopping_list IS 'Checks if a user has specific permission for a shopping list';
COMMENT ON FUNCTION get_user_shopping_lists IS 'Returns all shopping lists accessible to a user with their access type';