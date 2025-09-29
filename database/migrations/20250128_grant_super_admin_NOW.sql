-- =====================================================
-- IMMEDIATE SUPER ADMIN GRANT FOR DBRUNCAK
-- Run this NOW in Supabase SQL Editor
-- =====================================================

-- Find and grant super admin to dbruncak@outlook.com
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get the user ID
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'dbruncak@outlook.com'
  LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    -- Make sure system_admins table exists
    CREATE TABLE IF NOT EXISTS public.system_admins (
      user_id UUID PRIMARY KEY REFERENCES auth.users(id),
      email TEXT,
      admin_level TEXT DEFAULT 'admin',
      is_active BOOLEAN DEFAULT true,
      granted_by UUID REFERENCES auth.users(id),
      granted_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      notes TEXT
    );

    -- Grant super admin access
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
      v_user_id,
      NOW(),
      'Primary system administrator - FULL ACCESS GRANTED'
    )
    ON CONFLICT (user_id) DO UPDATE SET
      admin_level = 'super_admin',
      is_active = true,
      email = 'dbruncak@outlook.com',
      updated_at = NOW(),
      notes = 'Primary system administrator - FULL ACCESS GRANTED';

    RAISE NOTICE '✅ SUCCESS: dbruncak@outlook.com is now a SUPER ADMIN with user_id: %', v_user_id;
  ELSE
    RAISE EXCEPTION '❌ ERROR: User dbruncak@outlook.com not found! Please check the email address.';
  END IF;
END $$;

-- Verify the grant
SELECT
  sa.user_id,
  sa.email,
  sa.admin_level,
  sa.is_active,
  sa.granted_at,
  sa.notes
FROM public.system_admins sa
WHERE sa.email = 'dbruncak@outlook.com';