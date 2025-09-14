-- Manual script to add a user to an existing household
-- Run this in Supabase SQL Editor to manually add your wife to your household

-- First, let's see the current households and users
SELECT
    h.id as household_id,
    h.name as household_name,
    h.created_at
FROM households h
ORDER BY h.created_at;

-- See current household members
SELECT
    hm.household_id,
    hm.user_id,
    hm.role,
    h.name as household_name,
    hm.joined_at
FROM household_members hm
JOIN households h ON h.id = hm.household_id
ORDER BY hm.joined_at;

-- To manually add your wife to your household, replace the UUIDs below:
-- 1. Find your wife's user_id from auth.users table
-- 2. Find your household_id from the households table above
-- 3. Run the INSERT statement

/*
-- Example: Add user to household (REPLACE THE UUIDs with actual values)
INSERT INTO household_members (household_id, user_id, role, invited_by)
VALUES (
    'YOUR_HOUSEHOLD_ID_HERE',  -- Your household ID
    'YOUR_WIFE_USER_ID_HERE',  -- Your wife's user ID
    'member',                  -- Role: 'admin' or 'member'
    'YOUR_USER_ID_HERE'        -- Your user ID (who invited)
);
*/

-- Check auth.users to find user IDs by email
SELECT id, email, created_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 10;