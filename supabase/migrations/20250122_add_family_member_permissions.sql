-- Add permissions to family members table

DO $$
BEGIN
    -- Add permissions column to family_members table if it doesn't exist
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'family_members') THEN
        -- Add can_edit_recipes column
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_name = 'family_members'
                      AND column_name = 'can_edit_recipes') THEN
            ALTER TABLE family_members ADD COLUMN can_edit_recipes BOOLEAN DEFAULT true;
        END IF;

        -- Add can_delete_items column
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_name = 'family_members'
                      AND column_name = 'can_delete_items') THEN
            ALTER TABLE family_members ADD COLUMN can_delete_items BOOLEAN DEFAULT true;
        END IF;

        -- Add can_manage_shopping column
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_name = 'family_members'
                      AND column_name = 'can_manage_shopping') THEN
            ALTER TABLE family_members ADD COLUMN can_manage_shopping BOOLEAN DEFAULT true;
        END IF;

        -- Add is_child column for easy identification
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_name = 'family_members'
                      AND column_name = 'is_child') THEN
            ALTER TABLE family_members ADD COLUMN is_child BOOLEAN DEFAULT false;
        END IF;

        -- Add role column for more flexible permission management
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_name = 'family_members'
                      AND column_name = 'role') THEN
            ALTER TABLE family_members ADD COLUMN role VARCHAR(50) DEFAULT 'member';
            -- Roles can be: 'admin', 'adult', 'teen', 'child', 'guest', 'member'
        END IF;
    END IF;
END $$;

-- Create a function to check if a family member can edit recipes
CREATE OR REPLACE FUNCTION can_user_edit_recipe(member_id UUID, recipe_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    can_edit BOOLEAN;
    member_household UUID;
    recipe_household UUID;
BEGIN
    -- Get family member's permissions and household
    SELECT can_edit_recipes, household_id INTO can_edit, member_household
    FROM family_members
    WHERE id = member_id;

    -- Get recipe's household
    SELECT household_id INTO recipe_household
    FROM recipes
    WHERE id = recipe_id;

    -- Check if member belongs to same household and has permission
    IF member_household = recipe_household AND can_edit = true THEN
        RETURN true;
    ELSE
        RETURN false;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update existing family members to set children permissions appropriately
-- This is just an example - actual implementation would be based on age or other criteria
UPDATE family_members
SET
    can_edit_recipes = CASE
        WHEN is_child = true THEN false
        ELSE true
    END,
    can_delete_items = CASE
        WHEN is_child = true THEN false
        ELSE true
    END,
    role = CASE
        WHEN is_child = true THEN 'child'
        WHEN is_primary_meal_planner = true THEN 'admin'
        ELSE 'member'
    END
WHERE role IS NULL OR role = 'member';