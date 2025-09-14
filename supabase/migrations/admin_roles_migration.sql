-- Admin Roles Migration
-- Run this in Supabase SQL Editor to add database-driven admin system

-- Create system_admins table for role-based admin access
CREATE TABLE IF NOT EXISTS system_admins (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE, -- References auth.users(id)
    email VARCHAR(255) NOT NULL,
    admin_level VARCHAR(20) DEFAULT 'admin' CHECK (admin_level IN ('admin', 'super_admin')),
    granted_by UUID, -- References auth.users(id) - who granted admin access
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    notes TEXT, -- Reason for admin access, responsibilities, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insert your account as the initial super admin
-- Replace with your actual user ID and email
INSERT INTO system_admins (user_id, email, admin_level, granted_by, notes)
SELECT
    h.id,
    'daren@prolongedpantry.com', -- Replace with your actual email
    'super_admin',
    h.id, -- Self-granted
    'Initial system administrator - PantryIQ platform owner'
FROM households h
WHERE h.id = (SELECT id FROM households LIMIT 1) -- Gets your user ID
ON CONFLICT (user_id) DO UPDATE SET
    admin_level = 'super_admin',
    is_active = true,
    notes = 'Initial system administrator - PantryIQ platform owner';

-- Function to check if user is system admin
CREATE OR REPLACE FUNCTION is_system_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    admin_record RECORD;
BEGIN
    SELECT * INTO admin_record
    FROM system_admins
    WHERE user_id = p_user_id
      AND is_active = true;

    RETURN admin_record IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to grant admin access to a user
CREATE OR REPLACE FUNCTION grant_admin_access(
    p_target_user_id UUID,
    p_target_email VARCHAR,
    p_granted_by UUID,
    p_admin_level VARCHAR DEFAULT 'admin',
    p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    granter_is_admin BOOLEAN;
BEGIN
    -- Check if the person granting access is an admin
    SELECT is_system_admin(p_granted_by) INTO granter_is_admin;

    IF NOT granter_is_admin THEN
        RAISE EXCEPTION 'Only system administrators can grant admin access';
    END IF;

    -- Grant admin access
    INSERT INTO system_admins (user_id, email, admin_level, granted_by, notes)
    VALUES (p_target_user_id, p_target_email, p_admin_level, p_granted_by, p_notes)
    ON CONFLICT (user_id) DO UPDATE SET
        admin_level = p_admin_level,
        is_active = true,
        granted_by = p_granted_by,
        granted_at = NOW(),
        notes = p_notes;

    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Function to revoke admin access
CREATE OR REPLACE FUNCTION revoke_admin_access(
    p_target_user_id UUID,
    p_revoked_by UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    revoker_is_admin BOOLEAN;
    target_level VARCHAR;
    revoker_level VARCHAR;
BEGIN
    -- Check if the person revoking access is an admin
    SELECT is_system_admin(p_revoked_by) INTO revoker_is_admin;

    IF NOT revoker_is_admin THEN
        RAISE EXCEPTION 'Only system administrators can revoke admin access';
    END IF;

    -- Get admin levels
    SELECT admin_level INTO target_level FROM system_admins WHERE user_id = p_target_user_id;
    SELECT admin_level INTO revoker_level FROM system_admins WHERE user_id = p_revoked_by;

    -- Super admins can revoke anyone, regular admins can't revoke super admins
    IF target_level = 'super_admin' AND revoker_level != 'super_admin' THEN
        RAISE EXCEPTION 'Only super administrators can revoke super admin access';
    END IF;

    -- Revoke access
    UPDATE system_admins
    SET is_active = false
    WHERE user_id = p_target_user_id;

    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Create admin activity log
CREATE TABLE IF NOT EXISTS admin_activity_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    admin_user_id UUID NOT NULL, -- References auth.users(id)
    action_type VARCHAR(50) NOT NULL, -- 'login', 'user_management', 'system_config', etc.
    action_details TEXT,
    target_user_id UUID, -- If action involves another user
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Function to log admin activity
CREATE OR REPLACE FUNCTION log_admin_activity(
    p_admin_user_id UUID,
    p_action_type VARCHAR,
    p_action_details TEXT DEFAULT NULL,
    p_target_user_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO admin_activity_log (
        admin_user_id,
        action_type,
        action_details,
        target_user_id
    ) VALUES (
        p_admin_user_id,
        p_action_type,
        p_action_details,
        p_target_user_id
    );
END;
$$ LANGUAGE plpgsql;

-- Create indexes for admin tables
CREATE INDEX IF NOT EXISTS idx_system_admins_user_id ON system_admins(user_id);
CREATE INDEX IF NOT EXISTS idx_system_admins_active ON system_admins(is_active);
CREATE INDEX IF NOT EXISTS idx_admin_activity_user ON admin_activity_log(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_date ON admin_activity_log(created_at DESC);

-- Disable RLS for admin tables
ALTER TABLE system_admins DISABLE ROW LEVEL SECURITY;
ALTER TABLE admin_activity_log DISABLE ROW LEVEL SECURITY;

-- Add comments for documentation
COMMENT ON TABLE system_admins IS 'Database-driven system administrator roles and permissions';
COMMENT ON TABLE admin_activity_log IS 'Audit trail of all administrative actions';
COMMENT ON FUNCTION is_system_admin IS 'Checks if user has active system administrator privileges';
COMMENT ON FUNCTION grant_admin_access IS 'Grants system administrator access to a user';
COMMENT ON FUNCTION revoke_admin_access IS 'Revokes system administrator access from a user';
COMMENT ON FUNCTION log_admin_activity IS 'Logs administrative actions for audit trail';