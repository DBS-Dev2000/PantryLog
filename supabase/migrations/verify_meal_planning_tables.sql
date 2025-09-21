-- Verification Script for Meal Planning Tables
-- Run this to check what tables and columns exist

-- 1. Check if household_members table exists
SELECT
    'household_members table exists' as check_name,
    EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'household_members'
    ) as result;

-- 2. List all columns in household_members (if it exists)
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'household_members'
ORDER BY ordinal_position;

-- 3. Check all meal planning related tables
SELECT
    table_name,
    'EXISTS' as status
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
    'household_members',
    'dietary_restrictions',
    'member_diets',
    'food_preferences',
    'household_meal_preferences',
    'household_schedules',
    'meal_plans',
    'planned_meals',
    'meal_plan_shopping_items',
    'meal_suggestions',
    'meal_history'
)
ORDER BY table_name;

-- 4. Check RLS policies on household_members
SELECT
    schemaname,
    tablename,
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'household_members';

-- 5. Check if the PostgREST schema cache needs refresh
-- This shows when the schema was last loaded
SELECT
    setting
FROM pg_settings
WHERE name = 'pgrst.db_schema';

-- 6. Force a schema cache reload (if needed)
-- Uncomment the line below to force reload
-- NOTIFY pgrst, 'reload schema';