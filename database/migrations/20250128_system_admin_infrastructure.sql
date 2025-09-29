-- =====================================================
-- SYSTEM ADMIN INFRASTRUCTURE MIGRATION
-- Date: January 28, 2025
-- Purpose: Implement proper system admin access with security
-- Priority: CRITICAL - Required for admin functionality
-- =====================================================

BEGIN;

-- =====================================================
-- STEP 1: CREATE AUDIT LOGGING INFRASTRUCTURE
-- =====================================================

-- Create admin activity log table if not exists
CREATE TABLE IF NOT EXISTS public.admin_activity_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_user_id UUID NOT NULL REFERENCES auth.users(id),
  action_type TEXT NOT NULL,
  action_details TEXT,
  target_user_id UUID REFERENCES auth.users(id),
  target_household_id UUID,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_admin_activity_admin_user ON public.admin_activity_log(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_created ON public.admin_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_activity_action ON public.admin_activity_log(action_type);

-- Enable RLS on audit log (admins only can view)
ALTER TABLE public.admin_activity_log ENABLE ROW LEVEL SECURITY;

-- Create policy for audit log access (system admins only)
CREATE POLICY "System admins can view audit logs" ON public.admin_activity_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.system_admins
      WHERE user_id = auth.uid()
      AND is_active = true
    )
  );

-- =====================================================
-- STEP 2: CREATE MISSING RPC FUNCTIONS
-- =====================================================

-- Function to log admin activity
CREATE OR REPLACE FUNCTION public.log_admin_activity(
  p_admin_user_id UUID,
  p_action_type TEXT,
  p_action_details TEXT,
  p_target_user_id UUID DEFAULT NULL,
  p_target_household_id UUID DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  INSERT INTO public.admin_activity_log (
    admin_user_id,
    action_type,
    action_details,
    target_user_id,
    target_household_id
  ) VALUES (
    p_admin_user_id,
    p_action_type,
    p_action_details,
    p_target_user_id,
    p_target_household_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to grant admin access
CREATE OR REPLACE FUNCTION public.grant_admin_access(
  p_target_user_id UUID,
  p_target_email TEXT,
  p_granted_by UUID,
  p_admin_level TEXT DEFAULT 'admin',
  p_notes TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  -- Insert or update system_admins record
  INSERT INTO public.system_admins (
    user_id,
    email,
    admin_level,
    is_active,
    granted_by,
    granted_at,
    notes
  ) VALUES (
    p_target_user_id,
    p_target_email,
    p_admin_level,
    true,
    p_granted_by,
    NOW(),
    p_notes
  )
  ON CONFLICT (user_id) DO UPDATE SET
    admin_level = EXCLUDED.admin_level,
    is_active = true,
    granted_by = EXCLUDED.granted_by,
    granted_at = NOW(),
    notes = EXCLUDED.notes;

  -- Log the action
  PERFORM public.log_admin_activity(
    p_granted_by,
    'grant_admin_access',
    format('Granted %s access to %s', p_admin_level, p_target_email),
    p_target_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to revoke admin access
CREATE OR REPLACE FUNCTION public.revoke_admin_access(
  p_target_user_id UUID,
  p_revoked_by UUID
) RETURNS VOID AS $$
BEGIN
  -- Deactivate admin access
  UPDATE public.system_admins
  SET
    is_active = false,
    updated_at = NOW()
  WHERE user_id = p_target_user_id;

  -- Log the action
  PERFORM public.log_admin_activity(
    p_revoked_by,
    'revoke_admin_access',
    format('Revoked admin access from user %s', p_target_user_id),
    p_target_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- STEP 3: ADD DBRUNCAK AS SYSTEM ADMIN
-- =====================================================

-- First, ensure the system_admins table has all required columns
ALTER TABLE public.system_admins
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS granted_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS granted_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add dbruncak@outlook.com as super_admin
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get user ID from auth.users
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'dbruncak@outlook.com'
  LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    -- Insert or update as super_admin
    INSERT INTO public.system_admins (
      user_id,
      email,
      admin_level,
      is_active,
      granted_by,
      granted_at,
      notes
    ) VALUES (
      v_user_id,
      'dbruncak@outlook.com',
      'super_admin',
      true,
      v_user_id, -- Self-granted for initial setup
      NOW(),
      'Primary system administrator - full access'
    )
    ON CONFLICT (user_id) DO UPDATE SET
      admin_level = 'super_admin',
      is_active = true,
      email = 'dbruncak@outlook.com',
      updated_at = NOW();

    RAISE NOTICE '✅ Added dbruncak@outlook.com as super_admin with ID: %', v_user_id;
  ELSE
    RAISE WARNING '⚠️ User dbruncak@outlook.com not found in auth.users';
  END IF;
END $$;

-- Also add daren@prolongedpantry.com if exists
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get user ID from auth.users
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'daren@prolongedpantry.com'
  LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    -- Insert or update as super_admin
    INSERT INTO public.system_admins (
      user_id,
      email,
      admin_level,
      is_active,
      granted_by,
      granted_at,
      notes
    ) VALUES (
      v_user_id,
      'daren@prolongedpantry.com',
      'super_admin',
      true,
      v_user_id, -- Self-granted for initial setup
      NOW(),
      'Primary system administrator - full access'
    )
    ON CONFLICT (user_id) DO UPDATE SET
      admin_level = 'super_admin',
      is_active = true,
      email = 'daren@prolongedpantry.com',
      updated_at = NOW();

    RAISE NOTICE '✅ Added daren@prolongedpantry.com as super_admin with ID: %', v_user_id;
  END IF;
END $$;

-- =====================================================
-- STEP 4: CREATE RLS BYPASS VIEWS FOR SYSTEM ADMINS
-- =====================================================

-- Create a view for system admins to see ALL households
CREATE OR REPLACE VIEW public.admin_all_households AS
SELECT
  h.*,
  (
    SELECT COUNT(*)
    FROM public.household_members hm
    WHERE hm.household_id = h.id
  ) as member_count,
  (
    SELECT json_agg(json_build_object(
      'user_id', hm.user_id,
      'role', hm.role,
      'joined_at', hm.joined_at,
      'email', au.email
    ))
    FROM public.household_members hm
    LEFT JOIN auth.users au ON hm.user_id = au.id
    WHERE hm.household_id = h.id
  ) as members
FROM public.households h;

-- Grant access to the view only for authenticated users (we'll check admin status in the function)
GRANT SELECT ON public.admin_all_households TO authenticated;

-- Create a function to safely access all households (checks admin status)
CREATE OR REPLACE FUNCTION public.get_all_households_admin()
RETURNS TABLE (
  id UUID,
  name TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  features JSONB,
  member_count BIGINT,
  members JSONB
) AS $$
BEGIN
  -- Check if user is a system admin
  IF NOT EXISTS (
    SELECT 1 FROM public.system_admins
    WHERE user_id = auth.uid()
    AND is_active = true
    AND admin_level IN ('super_admin', 'admin')
  ) THEN
    RAISE EXCEPTION 'Access denied: System admin privileges required';
  END IF;

  -- Log the access
  PERFORM public.log_admin_activity(
    auth.uid(),
    'view_all_households',
    'Accessed all households via admin view'
  );

  -- Return all households with member data
  RETURN QUERY
  SELECT
    h.id,
    h.name,
    h.created_at,
    h.updated_at,
    h.features,
    COUNT(DISTINCT hm.user_id) as member_count,
    json_agg(DISTINCT jsonb_build_object(
      'user_id', hm.user_id,
      'role', hm.role,
      'joined_at', hm.joined_at,
      'email', au.email
    )) as members
  FROM public.households h
  LEFT JOIN public.household_members hm ON h.id = hm.household_id
  LEFT JOIN auth.users au ON hm.user_id = au.id
  GROUP BY h.id, h.name, h.created_at, h.updated_at, h.features;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to get all users with household memberships (for system admins)
CREATE OR REPLACE FUNCTION public.get_all_users_admin()
RETURNS TABLE (
  id UUID,
  email TEXT,
  created_at TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ,
  is_admin BOOLEAN,
  admin_level TEXT,
  households JSONB
) AS $$
BEGIN
  -- Check if user is a system admin
  IF NOT EXISTS (
    SELECT 1 FROM public.system_admins
    WHERE user_id = auth.uid()
    AND is_active = true
    AND admin_level IN ('super_admin', 'admin')
  ) THEN
    RAISE EXCEPTION 'Access denied: System admin privileges required';
  END IF;

  -- Log the access
  PERFORM public.log_admin_activity(
    auth.uid(),
    'view_all_users',
    'Accessed all users via admin view'
  );

  -- Return all users with their household memberships
  RETURN QUERY
  SELECT
    au.id,
    au.email,
    au.created_at,
    au.last_sign_in_at,
    COALESCE(sa.is_active, false) as is_admin,
    sa.admin_level,
    COALESCE(
      json_agg(
        DISTINCT jsonb_build_object(
          'household_id', hm.household_id,
          'household_name', h.name,
          'role', hm.role,
          'joined_at', hm.joined_at
        )
      ) FILTER (WHERE hm.household_id IS NOT NULL),
      '[]'::json
    )::jsonb as households
  FROM auth.users au
  LEFT JOIN public.system_admins sa ON au.id = sa.user_id
  LEFT JOIN public.household_members hm ON au.id = hm.user_id
  LEFT JOIN public.households h ON hm.household_id = h.id
  GROUP BY au.id, au.email, au.created_at, au.last_sign_in_at, sa.is_active, sa.admin_level;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- STEP 5: GRANT NECESSARY PERMISSIONS
-- =====================================================

-- Grant execute permissions on admin functions
GRANT EXECUTE ON FUNCTION public.log_admin_activity TO authenticated;
GRANT EXECUTE ON FUNCTION public.grant_admin_access TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_admin_access TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_households_admin TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_users_admin TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_system_admin TO authenticated;

-- =====================================================
-- STEP 6: VERIFY INSTALLATION
-- =====================================================

-- Check if dbruncak is properly configured
DO $$
DECLARE
  v_admin_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_admin_count
  FROM public.system_admins
  WHERE email IN ('dbruncak@outlook.com', 'daren@prolongedpantry.com')
  AND is_active = true
  AND admin_level = 'super_admin';

  IF v_admin_count > 0 THEN
    RAISE NOTICE '✅ System admins configured: % super_admin(s) found', v_admin_count;
  ELSE
    RAISE WARNING '❌ No system admins configured! Run manual insert if needed.';
  END IF;
END $$;

COMMIT;

-- =====================================================
-- VERIFICATION QUERIES (Run these separately)
-- =====================================================

-- Check system admins
SELECT
  sa.*,
  au.email as auth_email
FROM public.system_admins sa
LEFT JOIN auth.users au ON sa.user_id = au.id
WHERE sa.is_active = true;

-- Test the admin functions (replace with actual user ID)
-- SELECT * FROM public.get_all_households_admin();
-- SELECT * FROM public.get_all_users_admin();

-- Check audit log
-- SELECT * FROM public.admin_activity_log ORDER BY created_at DESC LIMIT 10;