-- Multi-household preferences migration
-- Add user preferences for default household and household switching

-- Create user preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE, -- References auth.users(id)
    default_household_id UUID REFERENCES households(id) ON DELETE SET NULL,
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_default_household ON user_preferences(default_household_id);

-- Enable RLS
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Users can only access their own preferences
CREATE POLICY "Users can manage their own preferences" ON user_preferences FOR ALL USING (
    user_id = auth.uid()
);

-- Function to get user's current/default household
CREATE OR REPLACE FUNCTION get_user_current_household(user_uuid UUID)
RETURNS UUID AS $$
DECLARE
    household_uuid UUID;
BEGIN
    -- First check user's default household preference
    SELECT default_household_id INTO household_uuid
    FROM user_preferences
    WHERE user_id = user_uuid AND default_household_id IS NOT NULL;

    -- If no preference set, get first household they're a member of
    IF household_uuid IS NULL THEN
        SELECT household_id INTO household_uuid
        FROM household_members
        WHERE user_id = user_uuid
        ORDER BY joined_at ASC
        LIMIT 1;
    END IF;

    -- If still not found, check if user has their own household (legacy mode)
    IF household_uuid IS NULL THEN
        SELECT id INTO household_uuid
        FROM households
        WHERE id = user_uuid
        LIMIT 1;
    END IF;

    RETURN household_uuid;
END;
$$ LANGUAGE plpgsql;

-- Function to get all user's households
CREATE OR REPLACE FUNCTION get_user_households(user_uuid UUID)
RETURNS TABLE(
    household_id UUID,
    household_name TEXT,
    role TEXT,
    is_default BOOLEAN,
    joined_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        hm.household_id,
        h.name::TEXT as household_name,
        hm.role,
        (up.default_household_id = hm.household_id) as is_default,
        hm.joined_at
    FROM household_members hm
    JOIN households h ON h.id = hm.household_id
    LEFT JOIN user_preferences up ON up.user_id = user_uuid
    WHERE hm.user_id = user_uuid
    ORDER BY is_default DESC, hm.joined_at ASC;
END;
$$ LANGUAGE plpgsql;

-- Function to set user's default household
CREATE OR REPLACE FUNCTION set_user_default_household(user_uuid UUID, household_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    is_member BOOLEAN := FALSE;
BEGIN
    -- Check if user is a member of this household
    SELECT EXISTS(
        SELECT 1 FROM household_members
        WHERE user_id = user_uuid AND household_id = household_uuid
    ) INTO is_member;

    IF NOT is_member THEN
        RAISE EXCEPTION 'User is not a member of this household';
    END IF;

    -- Insert or update user preferences
    INSERT INTO user_preferences (user_id, default_household_id)
    VALUES (user_uuid, household_uuid)
    ON CONFLICT (user_id) DO UPDATE SET
        default_household_id = household_uuid,
        updated_at = timezone('utc'::text, now());

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_preferences_updated_at
    BEFORE UPDATE ON user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();