-- Fix household data sharing and add recipe privacy settings (FIXED VERSION)
-- This migration ensures household members can properly share data

-- 1. Add recipe visibility column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'recipes' AND column_name = 'visibility') THEN
        ALTER TABLE recipes ADD COLUMN visibility TEXT DEFAULT 'family'
            CHECK (visibility IN ('private', 'family', 'public'));
        COMMENT ON COLUMN recipes.visibility IS 'Recipe visibility: private (creator only), family (household), public (everyone)';
    END IF;
END $$;

-- 2. Add created_by column to recipes if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'recipes' AND column_name = 'created_by') THEN
        ALTER TABLE recipes ADD COLUMN created_by UUID REFERENCES auth.users(id);
    END IF;
END $$;

-- 3. Add household default settings column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'households' AND column_name = 'default_settings') THEN
        ALTER TABLE households ADD COLUMN default_settings JSONB DEFAULT '{
            "recipe_default_visibility": "family",
            "share_shopping_lists": true,
            "share_meal_plans": true,
            "share_inventory": true
        }'::jsonb;
        COMMENT ON COLUMN households.default_settings IS 'Default settings for the household';
    END IF;
END $$;

-- 4. Fix/Create comprehensive RLS policies for inventory_items
DO $$
BEGIN
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Users can view inventory items in their household" ON inventory_items;
    DROP POLICY IF EXISTS "Users can manage inventory items in their household" ON inventory_items;
    DROP POLICY IF EXISTS "Users can insert inventory items to their household" ON inventory_items;
    DROP POLICY IF EXISTS "Users can update inventory items in their household" ON inventory_items;
    DROP POLICY IF EXISTS "Users can delete inventory items in their household" ON inventory_items;
    DROP POLICY IF EXISTS "Household members can view inventory" ON inventory_items;
    DROP POLICY IF EXISTS "Household members can insert inventory" ON inventory_items;
    DROP POLICY IF EXISTS "Household members can update inventory" ON inventory_items;
    DROP POLICY IF EXISTS "Household members can delete inventory" ON inventory_items;
EXCEPTION
    WHEN undefined_object THEN
        NULL; -- Policies don't exist, continue
END $$;

-- Create new comprehensive policies for inventory_items
DO $$
BEGIN
    CREATE POLICY "Household members can view inventory"
        ON inventory_items FOR SELECT
        USING (
            household_id IN (
                SELECT household_id
                FROM household_members
                WHERE user_id = auth.uid()
            )
        );
EXCEPTION
    WHEN duplicate_object THEN
        NULL; -- Policy already exists
END $$;

DO $$
BEGIN
    CREATE POLICY "Household members can insert inventory"
        ON inventory_items FOR INSERT
        WITH CHECK (
            household_id IN (
                SELECT household_id
                FROM household_members
                WHERE user_id = auth.uid()
            )
        );
EXCEPTION
    WHEN duplicate_object THEN
        NULL;
END $$;

DO $$
BEGIN
    CREATE POLICY "Household members can update inventory"
        ON inventory_items FOR UPDATE
        USING (
            household_id IN (
                SELECT household_id
                FROM household_members
                WHERE user_id = auth.uid()
            )
        )
        WITH CHECK (
            household_id IN (
                SELECT household_id
                FROM household_members
                WHERE user_id = auth.uid()
            )
        );
EXCEPTION
    WHEN duplicate_object THEN
        NULL;
END $$;

DO $$
BEGIN
    CREATE POLICY "Household members can delete inventory"
        ON inventory_items FOR DELETE
        USING (
            household_id IN (
                SELECT household_id
                FROM household_members
                WHERE user_id = auth.uid()
            )
        );
EXCEPTION
    WHEN duplicate_object THEN
        NULL;
END $$;

-- 5. Fix/Create RLS policies for storage_locations
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view storage locations in their household" ON storage_locations;
    DROP POLICY IF EXISTS "Users can manage storage locations in their household" ON storage_locations;
    DROP POLICY IF EXISTS "Household members can view storage locations" ON storage_locations;
    DROP POLICY IF EXISTS "Household members can manage storage locations" ON storage_locations;
EXCEPTION
    WHEN undefined_object THEN
        NULL;
END $$;

DO $$
BEGIN
    CREATE POLICY "Household members can view storage locations"
        ON storage_locations FOR SELECT
        USING (
            household_id IN (
                SELECT household_id
                FROM household_members
                WHERE user_id = auth.uid()
            )
        );
EXCEPTION
    WHEN duplicate_object THEN
        NULL;
END $$;

DO $$
BEGIN
    CREATE POLICY "Household members can manage storage locations"
        ON storage_locations FOR ALL
        USING (
            household_id IN (
                SELECT household_id
                FROM household_members
                WHERE user_id = auth.uid()
            )
        )
        WITH CHECK (
            household_id IN (
                SELECT household_id
                FROM household_members
                WHERE user_id = auth.uid()
            )
        );
EXCEPTION
    WHEN duplicate_object THEN
        NULL;
END $$;

-- 6. Fix/Create RLS policies for products
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view all products" ON products;
    DROP POLICY IF EXISTS "Users can create products" ON products;
    DROP POLICY IF EXISTS "Users can update their products" ON products;
    DROP POLICY IF EXISTS "Everyone can view products" ON products;
    DROP POLICY IF EXISTS "Authenticated users can create products" ON products;
    DROP POLICY IF EXISTS "Users can update products they created" ON products;
EXCEPTION
    WHEN undefined_object THEN
        NULL;
END $$;

DO $$
BEGIN
    CREATE POLICY "Everyone can view products"
        ON products FOR SELECT
        USING (true);
EXCEPTION
    WHEN duplicate_object THEN
        NULL;
END $$;

DO $$
BEGIN
    CREATE POLICY "Authenticated users can create products"
        ON products FOR INSERT
        WITH CHECK (auth.uid() IS NOT NULL);
EXCEPTION
    WHEN duplicate_object THEN
        NULL;
END $$;

DO $$
BEGIN
    CREATE POLICY "Users can update products they created"
        ON products FOR UPDATE
        USING (created_by = auth.uid() OR created_by IS NULL);
EXCEPTION
    WHEN duplicate_object THEN
        NULL;
END $$;

-- 7. Create comprehensive RLS policies for recipes with visibility support
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view recipes in their household" ON recipes;
    DROP POLICY IF EXISTS "Users can manage recipes in their household" ON recipes;
    DROP POLICY IF EXISTS "Users can view recipes" ON recipes;
    DROP POLICY IF EXISTS "Users can create recipes" ON recipes;
    DROP POLICY IF EXISTS "Users can update recipes" ON recipes;
    DROP POLICY IF EXISTS "Users can delete recipes" ON recipes;
    DROP POLICY IF EXISTS "Users can view appropriate recipes" ON recipes;
    DROP POLICY IF EXISTS "Users can create recipes in their household" ON recipes;
    DROP POLICY IF EXISTS "Users can update their own recipes" ON recipes;
    DROP POLICY IF EXISTS "Users can delete their own recipes" ON recipes;
EXCEPTION
    WHEN undefined_object THEN
        NULL;
END $$;

DO $$
BEGIN
    CREATE POLICY "Users can view appropriate recipes"
        ON recipes FOR SELECT
        USING (
            -- Public recipes
            visibility = 'public'
            OR
            -- Private recipes they created
            (visibility = 'private' AND created_by = auth.uid())
            OR
            -- Family recipes in their household
            (visibility = 'family' AND household_id IN (
                SELECT household_id
                FROM household_members
                WHERE user_id = auth.uid()
            ))
        );
EXCEPTION
    WHEN duplicate_object THEN
        NULL;
END $$;

DO $$
BEGIN
    CREATE POLICY "Users can create recipes in their household"
        ON recipes FOR INSERT
        WITH CHECK (
            household_id IN (
                SELECT household_id
                FROM household_members
                WHERE user_id = auth.uid()
            )
            AND (created_by = auth.uid() OR created_by IS NULL)
        );
EXCEPTION
    WHEN duplicate_object THEN
        NULL;
END $$;

DO $$
BEGIN
    CREATE POLICY "Users can update their own recipes"
        ON recipes FOR UPDATE
        USING (
            created_by = auth.uid()
            OR (
                -- Household admins can update family recipes
                visibility = 'family'
                AND household_id IN (
                    SELECT household_id
                    FROM household_members
                    WHERE user_id = auth.uid()
                    AND role = 'admin'
                )
            )
        );
EXCEPTION
    WHEN duplicate_object THEN
        NULL;
END $$;

DO $$
BEGIN
    CREATE POLICY "Users can delete their own recipes"
        ON recipes FOR DELETE
        USING (
            created_by = auth.uid()
            OR (
                -- Household admins can delete family recipes
                visibility = 'family'
                AND household_id IN (
                    SELECT household_id
                    FROM household_members
                    WHERE user_id = auth.uid()
                    AND role = 'admin'
                )
            )
        );
EXCEPTION
    WHEN duplicate_object THEN
        NULL;
END $$;

-- 8. Fix shopping_lists RLS policies
DO $$
BEGIN
    -- Enable RLS if not already enabled
    ALTER TABLE shopping_lists ENABLE ROW LEVEL SECURITY;
EXCEPTION
    WHEN others THEN
        NULL; -- Already enabled or table doesn't exist
END $$;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view shopping lists in their household" ON shopping_lists;
    DROP POLICY IF EXISTS "Users can manage shopping lists in their household" ON shopping_lists;
    DROP POLICY IF EXISTS "Household members can view shopping lists" ON shopping_lists;
    DROP POLICY IF EXISTS "Household members can manage shopping lists" ON shopping_lists;
EXCEPTION
    WHEN undefined_object THEN
        NULL;
END $$;

DO $$
BEGIN
    CREATE POLICY "Household members can view shopping lists"
        ON shopping_lists FOR SELECT
        USING (
            household_id IN (
                SELECT household_id
                FROM household_members
                WHERE user_id = auth.uid()
            )
        );
EXCEPTION
    WHEN duplicate_object THEN
        NULL;
END $$;

DO $$
BEGIN
    CREATE POLICY "Household members can manage shopping lists"
        ON shopping_lists FOR ALL
        USING (
            household_id IN (
                SELECT household_id
                FROM household_members
                WHERE user_id = auth.uid()
            )
        )
        WITH CHECK (
            household_id IN (
                SELECT household_id
                FROM household_members
                WHERE user_id = auth.uid()
            )
        );
EXCEPTION
    WHEN duplicate_object THEN
        NULL;
END $$;

-- 9. Fix meal_plans RLS policies
DO $$
BEGIN
    -- Enable RLS if not already enabled
    ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;
EXCEPTION
    WHEN others THEN
        NULL;
END $$;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view meal plans in their household" ON meal_plans;
    DROP POLICY IF EXISTS "Users can manage meal plans in their household" ON meal_plans;
    DROP POLICY IF EXISTS "Household members can view meal plans" ON meal_plans;
    DROP POLICY IF EXISTS "Household members can manage meal plans" ON meal_plans;
EXCEPTION
    WHEN undefined_object THEN
        NULL;
END $$;

DO $$
BEGIN
    CREATE POLICY "Household members can view meal plans"
        ON meal_plans FOR SELECT
        USING (
            household_id IN (
                SELECT household_id
                FROM household_members
                WHERE user_id = auth.uid()
            )
        );
EXCEPTION
    WHEN duplicate_object THEN
        NULL;
END $$;

DO $$
BEGIN
    CREATE POLICY "Household members can manage meal plans"
        ON meal_plans FOR ALL
        USING (
            household_id IN (
                SELECT household_id
                FROM household_members
                WHERE user_id = auth.uid()
            )
        )
        WITH CHECK (
            household_id IN (
                SELECT household_id
                FROM household_members
                WHERE user_id = auth.uid()
            )
        );
EXCEPTION
    WHEN duplicate_object THEN
        NULL;
END $$;

-- 10. Create index for better performance
CREATE INDEX IF NOT EXISTS idx_recipes_visibility ON recipes(visibility);
CREATE INDEX IF NOT EXISTS idx_recipes_created_by ON recipes(created_by);
CREATE INDEX IF NOT EXISTS idx_recipes_household_visibility ON recipes(household_id, visibility);

-- 11. Update existing recipes to have proper visibility
UPDATE recipes
SET visibility = COALESCE(visibility, 'family')
WHERE visibility IS NULL;

-- 12. Drop existing function if it exists before recreating
DROP FUNCTION IF EXISTS get_user_households(UUID);

-- Create helper function to get user's households
CREATE OR REPLACE FUNCTION get_user_households(user_id UUID)
RETURNS TABLE(household_id UUID, role TEXT)
AS $$
BEGIN
    RETURN QUERY
    SELECT hm.household_id, hm.role
    FROM household_members hm
    WHERE hm.user_id = get_user_households.user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 13. Drop existing function if it exists before recreating
DROP FUNCTION IF EXISTS is_household_member(UUID, UUID);

-- Create helper function to check household membership
CREATE OR REPLACE FUNCTION is_household_member(user_id UUID, check_household_id UUID)
RETURNS BOOLEAN
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM household_members
        WHERE household_members.user_id = is_household_member.user_id
        AND household_members.household_id = is_household_member.check_household_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments for documentation
COMMENT ON COLUMN recipes.visibility IS 'Recipe visibility: private (creator only), family (household members), public (everyone)';
COMMENT ON FUNCTION get_user_households IS 'Get all households a user belongs to with their roles';
COMMENT ON FUNCTION is_household_member IS 'Check if a user is a member of a specific household';

-- Log completion
DO $$
BEGIN
    RAISE LOG 'Household sharing migration v2 completed successfully';
END $$;