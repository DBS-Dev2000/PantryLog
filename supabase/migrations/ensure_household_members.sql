-- Ensure household_members table exists for user-household linking
-- This is NOT the meal planning family members table

-- Check and create the household_members table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'household_members'
    ) THEN
        CREATE TABLE household_members (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
            user_id UUID NOT NULL, -- References auth.users(id)
            role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('admin', 'member', 'guest')),
            joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
            invited_by UUID,
            UNIQUE(household_id, user_id)
        );

        CREATE INDEX idx_household_members_user_id ON household_members(user_id);
        CREATE INDEX idx_household_members_household_id ON household_members(household_id);

        RAISE NOTICE 'Created household_members table for user-household linking';

        -- Grant permissions
        GRANT ALL ON household_members TO authenticated;

        -- Enable RLS
        ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;

        -- Create RLS policy for viewing
        CREATE POLICY "Users can view their household memberships"
        ON household_members FOR SELECT
        TO authenticated
        USING (user_id = auth.uid());

        -- Create RLS policy for inserting (for joining households)
        CREATE POLICY "Users can join households"
        ON household_members FOR INSERT
        TO authenticated
        WITH CHECK (user_id = auth.uid());

        -- Create RLS policy for updating (for role changes)
        CREATE POLICY "Admins can update household members"
        ON household_members FOR UPDATE
        TO authenticated
        USING (
            household_id IN (
                SELECT household_id FROM household_members
                WHERE user_id = auth.uid() AND role = 'admin'
            )
        );

        -- Create RLS policy for deleting (for removing members)
        CREATE POLICY "Admins can remove household members"
        ON household_members FOR DELETE
        TO authenticated
        USING (
            household_id IN (
                SELECT household_id FROM household_members
                WHERE user_id = auth.uid() AND role = 'admin'
            )
            OR user_id = auth.uid() -- Users can remove themselves
        );

        -- Migrate existing households
        -- For each household, add the household owner as an admin member
        INSERT INTO household_members (household_id, user_id, role, invited_by)
        SELECT
            h.id as household_id,
            h.id as user_id, -- In single-user mode, household.id was often the user_id
            'admin' as role,
            h.id as invited_by
        FROM households h
        WHERE NOT EXISTS (
            SELECT 1 FROM household_members hm
            WHERE hm.household_id = h.id
        )
        ON CONFLICT (household_id, user_id) DO NOTHING;

        RAISE NOTICE 'Migrated existing households to household_members table';
    ELSE
        RAISE NOTICE 'household_members table already exists';
    END IF;
END $$;

-- Verify the table exists and show its structure
SELECT 'Table Status:' as check_type,
       CASE
           WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'household_members')
           THEN 'EXISTS'
           ELSE 'DOES NOT EXIST'
       END as status;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'household_members'
ORDER BY ordinal_position;

-- Show count of household members
SELECT COUNT(*) as total_household_members FROM household_members;

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';