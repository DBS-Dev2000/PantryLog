# Supabase Configuration for PantryIQ

This document outlines the critical Supabase settings needed for proper authentication and invitation flow.

## 🔧 Authentication Settings

### Email Verification URL Configuration

**CRITICAL**: The email verification redirect URL must be set to production domain to prevent localhost redirect issues.

#### Steps to Fix:

1. **Go to Supabase Dashboard**
   - Navigate to your PantryIQ project
   - Go to `Authentication` → `URL Configuration`

2. **Set Site URL**
   ```
   Site URL: https://pantryiq.prolongedpantry.com
   ```

3. **Set Redirect URLs**
   ```
   Redirect URLs:
   - https://pantryiq.prolongedpantry.com/**
   - https://pantryiq.prolongedpantry.com/api/auth/callback
   - https://pantryiq.prolongedpantry.com/auth
   - https://pantryiq.prolongedpantry.com/join/*
   ```

4. **Email Template Configuration**
   - Go to `Authentication` → `Email Templates`
   - Select "Confirm signup" template
   - Update the confirmation URL to:
   ```
   {{ .SiteURL }}/api/auth/callback?code={{ .Token }}&next=/inventory
   ```

### Rate Limiting Settings

- **Sign up rate limit**: 10 per hour per IP
- **Email rate limit**: 5 per hour per email
- **SMS rate limit**: 5 per hour per phone

## 🏠 Database Triggers

### User Creation Trigger

The system uses a PostgreSQL trigger to handle new user signups:

```sql
-- Function handles both new household creation and invitation acceptance
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    household_id UUID;
    invite_record RECORD;
BEGIN
    -- Check for invite_code in user metadata
    IF NEW.raw_user_meta_data->>'invite_code' IS NOT NULL THEN
        -- Process invitation acceptance
        -- See migration: 20250123_fix_auth_flow.sql
    ELSE
        -- Create new household if household_name provided
        -- Add user as admin
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Applied in migration**: `20250123_fix_auth_flow.sql`

## 🔐 Row Level Security (RLS) Policies

### Key Tables RLS Status

| Table | RLS Enabled | Policies |
|-------|-------------|----------|
| `households` | ✅ | Users can view/edit their household |
| `household_members` | ✅ | Members can view household members |
| `user_profiles` | ✅ | Users can view/edit own profile |
| `inventory_items` | ✅ | Household-scoped access |
| `household_invites` | ✅ | Inviter and invitee access |

## 📧 Email Flow Troubleshooting

### Common Issues & Solutions

#### 1. "Email redirects to localhost"
**Cause**: Site URL not configured properly
**Solution**: Update Site URL and Redirect URLs as shown above

#### 2. "User creates own household instead of joining"
**Cause**: Missing or broken auth trigger
**Solution**: Run migration `20250123_fix_auth_flow.sql`

#### 3. "User not appearing as household member"
**Cause**: Missing household_members entry or user_profiles
**Solution**:
- Check both `household_members` and `user_profiles` tables
- Use admin interface to reassign users
- Run `fix_orphaned_users()` function

#### 4. "Invitation code not working"
**Cause**: Expired invite or invalid code
**Solution**: Check `household_invites` table for valid, non-expired invites

## 🛠️ Emergency User Fixes

### SQL Commands for Common Issues

#### Fix Orphaned Users
```sql
-- Run the built-in function to fix users without household membership
SELECT fix_orphaned_users();
```

#### Manually Assign User to Household
```sql
-- Replace with actual UUIDs
INSERT INTO household_members (household_id, user_id, role, joined_at)
VALUES ('household-uuid', 'user-uuid', 'member', NOW())
ON CONFLICT (household_id, user_id) DO NOTHING;

-- Update user profile
INSERT INTO user_profiles (id, household_id, updated_at)
VALUES ('user-uuid', 'household-uuid', NOW())
ON CONFLICT (id) DO UPDATE
SET household_id = EXCLUDED.household_id, updated_at = NOW();
```

#### Check User Status
```sql
-- See user's current household memberships
SELECT
    au.email,
    hm.role,
    h.name as household_name,
    hm.joined_at
FROM auth.users au
LEFT JOIN household_members hm ON au.id = hm.user_id
LEFT JOIN households h ON hm.household_id = h.id
WHERE au.email = 'user@example.com';
```

## 🎯 Testing the Flow

### Complete Test Checklist

1. **Create Invitation**
   - Admin creates invitation in household settings
   - QR code generates with correct URL

2. **New User Signup**
   - Scan QR code → redirects to auth page with invite code
   - Fill signup form → creates account
   - Check email → click verification link
   - Should redirect to `/join/{code}` page
   - Click "Accept Invitation"
   - Should join household successfully

3. **Verify Results**
   - User appears in admin dashboard under correct household
   - User can access household inventory
   - User profile shows correct household assignment

## 🚨 Critical Environment Variables

Make sure these are set correctly in production:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## 📱 QR Code Generation

The invitation QR codes should generate URLs in this format:
```
https://pantryiq.prolongedpantry.com/auth?tab=1&join=true&invite=ABC123
```

This automatically:
- Switches to signup tab (`tab=1`)
- Sets joining mode (`join=true`)
- Pre-fills invite code (`invite=ABC123`)

---

**Last Updated**: January 23, 2025
**Migration Applied**: `20250123_fix_auth_flow.sql`
**Status**: Production Ready