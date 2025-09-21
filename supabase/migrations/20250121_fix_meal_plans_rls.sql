-- Fix RLS policies for meal planning tables
-- Allow households to create, read, update, and delete their own meal plans

-- First, ensure RLS is enabled on all meal planning tables
ALTER TABLE IF EXISTS meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS planned_meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS meal_history ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own meal plans" ON meal_plans;
DROP POLICY IF EXISTS "Users can create their own meal plans" ON meal_plans;
DROP POLICY IF EXISTS "Users can update their own meal plans" ON meal_plans;
DROP POLICY IF EXISTS "Users can delete their own meal plans" ON meal_plans;

DROP POLICY IF EXISTS "Users can view their planned meals" ON planned_meals;
DROP POLICY IF EXISTS "Users can create planned meals" ON planned_meals;
DROP POLICY IF EXISTS "Users can update planned meals" ON planned_meals;
DROP POLICY IF EXISTS "Users can delete planned meals" ON planned_meals;

-- Create comprehensive policies for meal_plans
CREATE POLICY "Users can view their own meal plans"
ON meal_plans FOR SELECT
USING (household_id = auth.uid());

CREATE POLICY "Users can create their own meal plans"
ON meal_plans FOR INSERT
WITH CHECK (household_id = auth.uid());

CREATE POLICY "Users can update their own meal plans"
ON meal_plans FOR UPDATE
USING (household_id = auth.uid())
WITH CHECK (household_id = auth.uid());

CREATE POLICY "Users can delete their own meal plans"
ON meal_plans FOR DELETE
USING (household_id = auth.uid());

-- Create comprehensive policies for planned_meals
CREATE POLICY "Users can view their planned meals"
ON planned_meals FOR SELECT
USING (
    meal_plan_id IN (
        SELECT id FROM meal_plans WHERE household_id = auth.uid()
    )
);

CREATE POLICY "Users can create planned meals"
ON planned_meals FOR INSERT
WITH CHECK (
    meal_plan_id IN (
        SELECT id FROM meal_plans WHERE household_id = auth.uid()
    )
);

CREATE POLICY "Users can update planned meals"
ON planned_meals FOR UPDATE
USING (
    meal_plan_id IN (
        SELECT id FROM meal_plans WHERE household_id = auth.uid()
    )
)
WITH CHECK (
    meal_plan_id IN (
        SELECT id FROM meal_plans WHERE household_id = auth.uid()
    )
);

CREATE POLICY "Users can delete planned meals"
ON planned_meals FOR DELETE
USING (
    meal_plan_id IN (
        SELECT id FROM meal_plans WHERE household_id = auth.uid()
    )
);

-- Also ensure recipes table has proper policies if it exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'recipes') THEN
        ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;

        -- Drop existing policies
        DROP POLICY IF EXISTS "Users can view public and own recipes" ON recipes;
        DROP POLICY IF EXISTS "Users can create recipes" ON recipes;
        DROP POLICY IF EXISTS "Users can update own recipes" ON recipes;
        DROP POLICY IF EXISTS "Users can delete own recipes" ON recipes;

        -- Create new policies
        CREATE POLICY "Users can view public and own recipes"
        ON recipes FOR SELECT
        USING (is_public = true OR household_id = auth.uid());

        CREATE POLICY "Users can create recipes"
        ON recipes FOR INSERT
        WITH CHECK (household_id = auth.uid());

        CREATE POLICY "Users can update own recipes"
        ON recipes FOR UPDATE
        USING (household_id = auth.uid())
        WITH CHECK (household_id = auth.uid());

        CREATE POLICY "Users can delete own recipes"
        ON recipes FOR DELETE
        USING (household_id = auth.uid());
    END IF;
END $$;

-- Verify policies are created
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    cmd
FROM pg_policies
WHERE tablename IN ('meal_plans', 'planned_meals', 'recipes')
ORDER BY tablename, policyname;