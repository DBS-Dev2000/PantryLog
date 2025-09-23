-- Fix authentication flow and household assignment
-- This migration addresses several critical issues in the signup process

-- 1. Create improved user signup handler function
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    household_id UUID;
    invite_record RECORD;
    existing_member RECORD;
BEGIN
    RAISE LOG 'Processing new user signup: %', NEW.id;
    RAISE LOG 'User metadata: %', NEW.raw_user_meta_data;

    -- Check if user has invite_code in metadata (joining existing household)
    IF NEW.raw_user_meta_data->>'invite_code' IS NOT NULL THEN
        RAISE LOG 'User has invite code: %', NEW.raw_user_meta_data->>'invite_code';

        -- Find the invitation
        SELECT * INTO invite_record
        FROM household_invites
        WHERE invite_code = NEW.raw_user_meta_data->>'invite_code'
        AND expires_at > NOW()
        LIMIT 1;

        IF invite_record IS NOT NULL THEN
            RAISE LOG 'Valid invitation found for household: %', invite_record.household_id;

            -- Check if user is already a member of this household
            SELECT * INTO existing_member
            FROM household_members
            WHERE household_id = invite_record.household_id
            AND user_id = NEW.id;

            IF existing_member IS NULL THEN
                -- Add user to the invited household
                INSERT INTO household_members (household_id, user_id, role, invited_by, joined_at)
                VALUES (invite_record.household_id, NEW.id, 'member', invite_record.invited_by, NOW());

                -- Create user profile
                INSERT INTO user_profiles (id, household_id, created_at, updated_at)
                VALUES (NEW.id, invite_record.household_id, NOW(), NOW())
                ON CONFLICT (id) DO UPDATE
                SET household_id = EXCLUDED.household_id, updated_at = NOW();

                RAISE LOG 'User added to household % as member', invite_record.household_id;
            ELSE
                RAISE LOG 'User already member of household %', invite_record.household_id;
            END IF;

            RETURN NEW;
        ELSE
            RAISE LOG 'Invalid or expired invite code: %', NEW.raw_user_meta_data->>'invite_code';
        END IF;
    END IF;

    -- Check if household_name is provided (creating new household)
    IF NEW.raw_user_meta_data->>'household_name' IS NOT NULL
       AND trim(NEW.raw_user_meta_data->>'household_name') != '' THEN
        RAISE LOG 'Creating new household: %', NEW.raw_user_meta_data->>'household_name';

        -- Create new household
        INSERT INTO households (name, created_at, updated_at)
        VALUES (NEW.raw_user_meta_data->>'household_name', NOW(), NOW())
        RETURNING id INTO household_id;

        -- Add user as admin of the household
        INSERT INTO household_members (household_id, user_id, role, joined_at)
        VALUES (household_id, NEW.id, 'admin', NOW());

        -- Create user profile
        INSERT INTO user_profiles (id, household_id, created_at, updated_at)
        VALUES (NEW.id, household_id, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE
        SET household_id = EXCLUDED.household_id, updated_at = NOW();

        RAISE LOG 'User added to new household % as admin', household_id;
    ELSE
        RAISE LOG 'No household name provided, user will need manual assignment';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create the auth trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 3. Create function to fix orphaned users (users without household membership)
CREATE OR REPLACE FUNCTION fix_orphaned_users()
RETURNS INTEGER AS $$
DECLARE
    user_record RECORD;
    user_household_id UUID;
    fixed_count INTEGER := 0;
BEGIN
    RAISE LOG 'Starting fix for orphaned users';

    -- Find users who don't have household membership
    FOR user_record IN
        SELECT au.id, au.email, au.raw_user_meta_data
        FROM auth.users au
        LEFT JOIN household_members hm ON au.id = hm.user_id
        WHERE hm.user_id IS NULL
    LOOP
        RAISE LOG 'Processing orphaned user: % (%)', user_record.email, user_record.id;

        -- Try to find household from user_profiles
        SELECT household_id INTO user_household_id
        FROM user_profiles
        WHERE id = user_record.id;

        IF user_household_id IS NOT NULL THEN
            -- Add to household_members
            INSERT INTO household_members (household_id, user_id, role, joined_at)
            VALUES (user_household_id, user_record.id, 'admin', NOW())
            ON CONFLICT (household_id, user_id) DO NOTHING;

            fixed_count := fixed_count + 1;
            RAISE LOG 'Fixed user % by adding to existing household %', user_record.email, user_household_id;
        ELSE
            -- Create a new household for this user
            INSERT INTO households (name, created_at, updated_at)
            VALUES (COALESCE(user_record.email || '''s Household', 'My Household'), NOW(), NOW())
            RETURNING id INTO user_household_id;

            -- Add to household_members
            INSERT INTO household_members (household_id, user_id, role, joined_at)
            VALUES (user_household_id, user_record.id, 'admin', NOW());

            -- Create/update user profile
            INSERT INTO user_profiles (id, household_id, created_at, updated_at)
            VALUES (user_record.id, user_household_id, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE
            SET household_id = EXCLUDED.household_id, updated_at = NOW();

            fixed_count := fixed_count + 1;
            RAISE LOG 'Fixed user % by creating new household %', user_record.email, user_household_id;
        END IF;
    END LOOP;

    RAISE LOG 'Fixed % orphaned users', fixed_count;
    RETURN fixed_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Run the fix for existing orphaned users
SELECT fix_orphaned_users();

-- 5. Add helpful indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_household_invites_invite_code ON household_invites(invite_code);
CREATE INDEX IF NOT EXISTS idx_household_invites_expires_at ON household_invites(expires_at);
CREATE INDEX IF NOT EXISTS idx_household_members_user_id ON household_members(user_id);

-- 6. Ensure RLS policies exist for household_members if not already present
DO $$
BEGIN
    -- Enable RLS on household_members if not already enabled
    ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;
EXCEPTION
    WHEN others THEN
        RAISE LOG 'RLS already enabled on household_members or other issue: %', SQLERRM;
END $$;

-- Create basic RLS policies for household_members if they don't exist
DO $$
BEGIN
    -- Policy for viewing household members
    CREATE POLICY "Users can view members of their household"
        ON household_members FOR SELECT
        USING (
            household_id IN (
                SELECT household_id
                FROM household_members
                WHERE user_id = auth.uid()
            )
        );
EXCEPTION
    WHEN duplicate_object THEN
        RAISE LOG 'Policy already exists for viewing household members';
END $$;

DO $$
BEGIN
    -- Policy for admins to manage members
    CREATE POLICY "Admins can manage household members"
        ON household_members FOR ALL
        USING (
            household_id IN (
                SELECT household_id
                FROM household_members
                WHERE user_id = auth.uid()
                AND role = 'admin'
            )
        );
EXCEPTION
    WHEN duplicate_object THEN
        RAISE LOG 'Policy already exists for admin management of household members';
END $$;

-- Add comments for documentation
COMMENT ON FUNCTION handle_new_user() IS 'Handles new user signup by either adding them to invited household or creating new household';
COMMENT ON FUNCTION fix_orphaned_users() IS 'One-time function to fix users who are not members of any household';

-- Log completion
DO $$
BEGIN
    RAISE LOG 'Auth flow migration completed successfully';
END $$;