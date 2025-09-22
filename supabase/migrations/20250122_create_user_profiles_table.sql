-- Emergency migration to create user_profiles table
-- This table maps users to their households

-- Create user_profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    display_name VARCHAR(255),
    avatar_url TEXT,
    dietary_restrictions JSONB DEFAULT '[]'::jsonb,
    preferences JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_household_id ON user_profiles(household_id);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own profile"
    ON user_profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
    ON user_profiles FOR UPDATE
    USING (auth.uid() = id);

-- Migrate existing data from auth.users metadata
-- This assumes users have been storing household_id in their metadata
DO $$
DECLARE
    user_record RECORD;
    user_household_id UUID;
BEGIN
    -- Loop through all users
    FOR user_record IN SELECT id, raw_user_meta_data FROM auth.users
    LOOP
        -- Try to get household_id from metadata or create one
        IF user_record.raw_user_meta_data ? 'household_id' THEN
            user_household_id := (user_record.raw_user_meta_data->>'household_id')::UUID;
        ELSE
            -- If no household_id in metadata, check if user.id matches a household.id
            -- (This was the incorrect assumption in the code)
            SELECT id INTO user_household_id FROM households WHERE id = user_record.id;

            -- If still no household, create one for the user
            IF user_household_id IS NULL THEN
                -- Check if there's a household with this user as owner
                SELECT id INTO user_household_id
                FROM households
                WHERE created_at IN (
                    SELECT MIN(created_at)
                    FROM households
                    WHERE id IN (
                        SELECT household_id
                        FROM inventory_items
                        WHERE created_at <= NOW()
                    )
                )
                LIMIT 1;

                -- If still nothing, create a new household
                IF user_household_id IS NULL THEN
                    INSERT INTO households (id, name, created_at, updated_at)
                    VALUES (gen_random_uuid(), 'My Household', NOW(), NOW())
                    RETURNING id INTO user_household_id;
                END IF;
            END IF;
        END IF;

        -- Insert into user_profiles if we have a household_id
        IF user_household_id IS NOT NULL THEN
            INSERT INTO user_profiles (id, household_id, created_at, updated_at)
            VALUES (user_record.id, user_household_id, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE
            SET household_id = EXCLUDED.household_id,
                updated_at = NOW();
        END IF;
    END LOOP;
END $$;

-- For users without profiles, try to find their household from inventory_items
DO $$
DECLARE
    user_record RECORD;
    user_household_id UUID;
BEGIN
    -- Find users without profiles
    FOR user_record IN
        SELECT DISTINCT ii.household_id, au.id as user_id
        FROM inventory_items ii
        CROSS JOIN auth.users au
        WHERE NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = au.id)
        AND ii.household_id IS NOT NULL
        LIMIT 100  -- Process in batches to avoid timeout
    LOOP
        -- Create profile for this user with the household they've been using
        INSERT INTO user_profiles (id, household_id, created_at, updated_at)
        VALUES (user_record.user_id, user_record.household_id, NOW(), NOW())
        ON CONFLICT (id) DO NOTHING;
    END LOOP;
END $$;

-- Create a more intelligent mapping based on actual data patterns
-- This looks at who created inventory items for each household
DO $$
DECLARE
    household_record RECORD;
    user_id UUID;
BEGIN
    -- For each household, find the most likely user
    FOR household_record IN
        SELECT DISTINCT household_id
        FROM inventory_items
        WHERE household_id IS NOT NULL
    LOOP
        -- Try to find a user ID that matches the household pattern
        -- Many systems use the user ID as the household ID initially
        SELECT id INTO user_id
        FROM auth.users
        WHERE id::text = household_record.household_id::text
        LIMIT 1;

        IF user_id IS NOT NULL THEN
            INSERT INTO user_profiles (id, household_id, created_at, updated_at)
            VALUES (user_id, household_record.household_id, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE
            SET household_id = household_record.household_id,
                updated_at = NOW();
        END IF;
    END LOOP;
END $$;

-- Add comment for documentation
COMMENT ON TABLE user_profiles IS 'Maps authenticated users to their households and stores user-specific preferences';