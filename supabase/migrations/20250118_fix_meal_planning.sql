-- Fix Meal Planning Tables and Schema Cache
-- Run this after the main migration if you're getting schema cache errors

-- First, check if the table exists and has the right columns
DO $$
BEGIN
    -- Check if household_members table exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                   WHERE table_schema = 'public'
                   AND table_name = 'household_members') THEN
        RAISE NOTICE 'Creating household_members table...';

        CREATE TABLE household_members (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
            name VARCHAR(100) NOT NULL,
            birth_date DATE,
            age_group VARCHAR(20) CHECK (age_group IN ('infant', 'toddler', 'child', 'teen', 'adult', 'senior')),
            is_primary_meal_planner BOOLEAN DEFAULT false,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            UNIQUE(household_id, name)
        );
    ELSE
        RAISE NOTICE 'household_members table already exists';

        -- Check if age_group column exists
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_schema = 'public'
                       AND table_name = 'household_members'
                       AND column_name = 'age_group') THEN
            RAISE NOTICE 'Adding age_group column...';
            ALTER TABLE household_members
            ADD COLUMN IF NOT EXISTS age_group VARCHAR(20)
            CHECK (age_group IN ('infant', 'toddler', 'child', 'teen', 'adult', 'senior'));
        END IF;
    END IF;
END $$;

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';

-- Grant permissions for authenticated users
GRANT ALL ON household_members TO authenticated;
GRANT ALL ON household_members TO service_role;

-- Ensure RLS is set up correctly
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own household members" ON household_members;
DROP POLICY IF EXISTS "Users can insert own household members" ON household_members;
DROP POLICY IF EXISTS "Users can update own household members" ON household_members;
DROP POLICY IF EXISTS "Users can delete own household members" ON household_members;

-- Create comprehensive RLS policies
CREATE POLICY "Users can view own household members" ON household_members
    FOR SELECT USING (household_id = auth.uid());

CREATE POLICY "Users can insert own household members" ON household_members
    FOR INSERT WITH CHECK (household_id = auth.uid());

CREATE POLICY "Users can update own household members" ON household_members
    FOR UPDATE USING (household_id = auth.uid());

CREATE POLICY "Users can delete own household members" ON household_members
    FOR DELETE USING (household_id = auth.uid());

-- Verify the schema
SELECT
    column_name,
    data_type,
    character_maximum_length,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'household_members'
ORDER BY ordinal_position;