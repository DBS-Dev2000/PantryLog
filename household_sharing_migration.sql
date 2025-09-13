-- Household Sharing Migration
-- Run this in Supabase SQL Editor to enable household sharing

-- Create household_members table for multi-user households
CREATE TABLE IF NOT EXISTS household_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    user_id UUID NOT NULL, -- References auth.users(id)
    role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('admin', 'member', 'guest')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    invited_by UUID, -- References auth.users(id)
    UNIQUE(household_id, user_id)
);

-- Create household_invites table for invitation system
CREATE TABLE IF NOT EXISTS household_invites (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    invited_email VARCHAR(255) NOT NULL,
    invite_code VARCHAR(8) UNIQUE NOT NULL,
    invited_by UUID NOT NULL, -- References auth.users(id)
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (timezone('utc'::text, now()) + INTERVAL '7 days') NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE,
    accepted_by UUID, -- References auth.users(id)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_household_members_user_id ON household_members(user_id);
CREATE INDEX IF NOT EXISTS idx_household_members_household_id ON household_members(household_id);
CREATE INDEX IF NOT EXISTS idx_household_invites_code ON household_invites(invite_code);
CREATE INDEX IF NOT EXISTS idx_household_invites_email ON household_invites(invited_email);

-- Function to generate random invite codes
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS TEXT AS $$
DECLARE
    code TEXT;
    done BOOLEAN := FALSE;
BEGIN
    WHILE NOT done LOOP
        -- Generate 8-character alphanumeric code
        code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8));

        -- Check if code already exists
        IF NOT EXISTS (SELECT 1 FROM household_invites WHERE invite_code = code AND expires_at > NOW()) THEN
            done := TRUE;
        END IF;
    END LOOP;

    RETURN code;
END;
$$ LANGUAGE plpgsql;

-- Function to get user's current household
CREATE OR REPLACE FUNCTION get_user_household(user_uuid UUID)
RETURNS UUID AS $$
DECLARE
    household_uuid UUID;
BEGIN
    -- First check if user is a member of any household
    SELECT household_id INTO household_uuid
    FROM household_members
    WHERE user_id = user_uuid
    LIMIT 1;

    -- If not found, check if user has their own household (legacy mode)
    IF household_uuid IS NULL THEN
        SELECT id INTO household_uuid
        FROM households
        WHERE id = user_uuid
        LIMIT 1;
    END IF;

    RETURN household_uuid;
END;
$$ LANGUAGE plpgsql;

-- Disable RLS for easier development (re-enable later with proper policies)
ALTER TABLE household_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE household_invites DISABLE ROW LEVEL SECURITY;

-- Insert current users as admins of their own households
-- This migrates existing single-user households to the new system
INSERT INTO household_members (household_id, user_id, role, invited_by)
SELECT h.id, h.id, 'admin', h.id
FROM households h
WHERE NOT EXISTS (
    SELECT 1 FROM household_members hm WHERE hm.household_id = h.id AND hm.user_id = h.id
);

-- Add comments for documentation
COMMENT ON TABLE household_members IS 'Multi-user household membership with roles';
COMMENT ON TABLE household_invites IS 'Invitation system for joining households';
COMMENT ON FUNCTION generate_invite_code() IS 'Generates unique 8-character invite codes';
COMMENT ON FUNCTION get_user_household(UUID) IS 'Gets the household ID for a user (checks membership first, then legacy)';