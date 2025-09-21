-- Check database structure to understand user/profile tables

-- 1. Check what tables exist in auth schema
SELECT 'Tables in auth schema:' as check_type;
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'auth'
ORDER BY table_name;

-- 2. Check what tables exist in public schema that might be user-related
SELECT 'User-related tables in public schema:' as check_type;
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND (table_name LIKE '%user%' OR table_name LIKE '%profile%' OR table_name = 'households')
ORDER BY table_name;

-- 3. Check structure of households table
SELECT 'Columns in households table:' as check_type;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'households'
ORDER BY ordinal_position;

-- 4. Check if there's a user_id column in households
SELECT 'Looking for user relationship in households:' as check_type;
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'households'
AND column_name LIKE '%user%' OR column_name LIKE '%owner%' OR column_name LIKE '%created%';

-- 5. Try to find how users are linked to households
SELECT 'Tables with household_id column:' as check_type;
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
AND column_name = 'household_id'
ORDER BY table_name;

-- 6. Check auth.users structure
SELECT 'Auth.users columns:' as check_type;
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'auth' AND table_name = 'users'
AND column_name IN ('id', 'email', 'raw_user_meta_data')
ORDER BY ordinal_position;