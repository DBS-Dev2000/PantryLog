import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service role for admin operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const requestingUserId = searchParams.get('user_id')

    if (!requestingUserId) {
      return NextResponse.json(
        { error: 'User ID required' },
        { status: 400 }
      )
    }

    // Verify requesting user is admin (simplified check)
    try {
      const { data: isAdmin, error: adminCheckError } = await supabaseAdmin
        .rpc('is_system_admin', { p_user_id: requestingUserId })

      if (adminCheckError || !isAdmin) {
        // Fallback admin check for development
        const { data: userData } = await supabaseAdmin.auth.admin.getUserById(requestingUserId)
        const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(email => email.trim()) || []

        if (!userData.user || !adminEmails.includes(userData.user.email || '')) {
          return NextResponse.json(
            { error: 'Admin privileges required' },
            { status: 403 }
          )
        }
      }
    } catch (rpcError) {
      // RPC function doesn't exist, use fallback admin check
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(requestingUserId)
      const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(email => email.trim()) || []

      if (!userData.user || !adminEmails.includes(userData.user.email || '')) {
        return NextResponse.json(
          { error: 'Admin privileges required - RPC not available' },
          { status: 403 }
        )
      }
    }

    // Get all users with pagination handling
    const { data: usersData, error: usersError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000 // Get up to 1000 users
    })

    if (usersError) {
      console.error('Error fetching users:', usersError)
      throw usersError
    }

    console.log('📊 Users API Debug:', {
      total_users: usersData?.users?.length || 0,
      requesting_user: requestingUserId,
      users_sample: usersData?.users?.slice(0, 3).map(u => ({ id: u.id, email: u.email })) || []
    })

    // Get admin users with fallback
    let adminUsers = []
    try {
      const { data: adminData, error: adminError } = await supabaseAdmin
        .from('system_admins')
        .select('*')
        .eq('is_active', true)

      if (!adminError) {
        adminUsers = adminData || []
      }
    } catch (adminErr) {
      console.log('system_admins table not available, using fallback')
      adminUsers = []
    }

    const adminUserIds = new Set(adminUsers.map(admin => admin.user_id) || [])

    // Get household memberships for all users (based on migration schema)
    let userHouseholds = []
    try {
      const { data: membershipData, error: membershipError } = await supabaseAdmin
        .from('household_members')
        .select(`
          user_id,
          role,
          joined_at,
          household_id,
          households!inner(id, name)
        `)

      if (!membershipError && membershipData) {
        userHouseholds = membershipData
        console.log('👥 Found membership data:', membershipData.length, 'memberships')
      } else {
        console.log('👥 No membership data found, using legacy pattern')
      }
    } catch (membershipErr) {
      console.log('👥 Membership query failed:', membershipErr)
    }

    // Create user-household mapping
    const userHouseholdMap = new Map()

    // First, add membership data if available
    userHouseholds.forEach(membership => {
      if (!userHouseholdMap.has(membership.user_id)) {
        userHouseholdMap.set(membership.user_id, [])
      }
      userHouseholdMap.get(membership.user_id).push({
        household_id: membership.households?.id || membership.household_id,
        household_name: membership.households?.name || 'Unknown Household',
        role: membership.role,
        joined_at: membership.joined_at
      })
    })

    // Fallback: If no membership data, check if user ID matches household ID (legacy pattern)
    if (userHouseholds.length === 0) {
      try {
        const { data: allHouseholds } = await supabaseAdmin
          .from('households')
          .select('id, name, created_at')

        allHouseholds?.forEach(household => {
          // In legacy pattern, household.id = user.id for the owner
          if (!userHouseholdMap.has(household.id)) {
            userHouseholdMap.set(household.id, [])
          }
          userHouseholdMap.get(household.id).push({
            household_id: household.id,
            household_name: household.name,
            role: 'admin',
            joined_at: household.created_at
          })
        })
        console.log('👥 Using legacy household ownership pattern')
      } catch (legacyErr) {
        console.log('👥 Legacy pattern also failed:', legacyErr)
      }
    }

    // Combine user data with admin status and household memberships
    const usersWithAdminStatus = usersData.users.map(user => ({
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at,
      is_admin: adminUserIds.has(user.id),
      admin_level: adminUsers?.find(admin => admin.user_id === user.id)?.admin_level || null,
      households: userHouseholdMap.get(user.id) || []
    }))

    // Log admin access
    await supabaseAdmin.rpc('log_admin_activity', {
      p_admin_user_id: requestingUserId,
      p_action_type: 'user_list_access',
      p_action_details: 'Viewed user list in admin dashboard'
    })

    return NextResponse.json({
      users: usersWithAdminStatus,
      total_users: usersData.users.length,
      admin_users: adminUsers || []
    })

  } catch (error: any) {
    console.error('Admin users API error:', error)
    return NextResponse.json(
      { error: 'Failed to load users: ' + error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, target_user_id, requesting_user_id, admin_level, notes } = await request.json()

    if (!requesting_user_id) {
      return NextResponse.json(
        { error: 'Requesting user ID required' },
        { status: 400 }
      )
    }

    // Verify requesting user is admin
    const { data: isAdmin, error: adminCheckError } = await supabaseAdmin
      .rpc('is_system_admin', { p_user_id: requesting_user_id })

    if (adminCheckError || !isAdmin) {
      return NextResponse.json(
        { error: 'Admin privileges required' },
        { status: 403 }
      )
    }

    if (action === 'grant_admin') {
      // Get target user email
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(target_user_id)

      if (!userData.user) {
        throw new Error('Target user not found')
      }

      // Grant admin access
      const { error } = await supabaseAdmin
        .rpc('grant_admin_access', {
          p_target_user_id: target_user_id,
          p_target_email: userData.user.email,
          p_granted_by: requesting_user_id,
          p_admin_level: admin_level || 'admin',
          p_notes: notes || 'Admin access granted via PantryIQ admin dashboard'
        })

      if (error) throw error

      // Log the action
      await supabaseAdmin.rpc('log_admin_activity', {
        p_admin_user_id: requesting_user_id,
        p_action_type: 'grant_admin_access',
        p_action_details: `Granted ${admin_level} access to ${userData.user.email}`,
        p_target_user_id: target_user_id
      })

      return NextResponse.json({ success: true, message: 'Admin access granted' })

    } else if (action === 'revoke_admin') {
      // Revoke admin access
      const { error } = await supabaseAdmin
        .rpc('revoke_admin_access', {
          p_target_user_id: target_user_id,
          p_revoked_by: requesting_user_id
        })

      if (error) throw error

      // Log the action
      await supabaseAdmin.rpc('log_admin_activity', {
        p_admin_user_id: requesting_user_id,
        p_action_type: 'revoke_admin_access',
        p_action_details: `Revoked admin access from user ${target_user_id}`,
        p_target_user_id: target_user_id
      })

      return NextResponse.json({ success: true, message: 'Admin access revoked' })
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )

  } catch (error: any) {
    console.error('Admin action error:', error)
    return NextResponse.json(
      { error: 'Admin action failed: ' + error.message },
      { status: 500 }
    )
  }
}