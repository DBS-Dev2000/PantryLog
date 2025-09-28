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
    // SECURITY FIX: Get user ID from proper authentication, not query params
    const authorization = request.headers.get('authorization')

    if (!authorization) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Create authenticated client to verify user
    const authSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            authorization
          }
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    )

    const { data: { user }, error: userError } = await authSupabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      )
    }

    const requestingUserId = user.id

    // Verify requesting user is admin
    try {
      const { data: isAdmin, error: adminCheckError } = await supabaseAdmin
        .rpc('is_system_admin', { p_user_id: requestingUserId })

      if (adminCheckError || !isAdmin) {
        // Fallback admin check for development
        const { data: userData } = await supabaseAdmin.auth.admin.getUserById(requestingUserId)
        const adminEmails = ['daren@prolongedpantry.com']

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
      const adminEmails = ['daren@prolongedpantry.com']

      if (!userData.user || !adminEmails.includes(userData.user.email || '')) {
        return NextResponse.json(
          { error: 'Admin privileges required - RPC not available' },
          { status: 403 }
        )
      }
    }

    // Load households with membership data (based on migration schema)
    let households = []
    try {
      const { data: householdsData, error: householdsError } = await supabaseAdmin
        .from('households')
        .select(`
          id,
          name,
          created_at,
          updated_at,
          features,
          household_members(
            user_id,
            role,
            joined_at
          )
        `)
        .order('created_at', { ascending: false })

      if (!householdsError && householdsData) {
        // Get all user data for member details
        const allUsersData = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
        const userMap = new Map()
        allUsersData.data?.users?.forEach(user => {
          userMap.set(user.id, { email: user.email, created_at: user.created_at })
        })

        households = householdsData.map(h => {
          console.log('🏠 Processing household:', h.name, 'Features from DB:', h.features)
          let members = []

          // If household_members data exists, use it
          if (h.household_members && h.household_members.length > 0) {
            members = h.household_members.map(member => ({
              user_id: member.user_id,
              role: member.role || 'member',
              joined_at: member.joined_at,
              email: userMap.get(member.user_id)?.email || 'Unknown',
              is_creator: member.user_id === h.id // Based on migration logic
            }))
          } else {
            // Fallback: household owner is the user with same ID (legacy pattern)
            members = [{
              user_id: h.id,
              role: 'admin',
              joined_at: h.created_at,
              email: userMap.get(h.id)?.email || 'Owner',
              is_creator: true
            }]
          }

          return {
            ...h,
            member_count: members.length,
            members: members,
            features: h.features || {
              recipes_enabled: true,
              ai_features_enabled: true,
              shopping_list_sharing: true,
              storage_editing: true,
              multiple_households: false,
              advanced_reporting: false,
              custom_labels: true,
              barcode_scanning: true
            }
          }
        })
        console.log('🏠 Households loaded with membership:', householdsData.length, 'households found')
      } else {
        console.error('❌ Households query failed:', householdsError)
        households = []
      }
    } catch (householdsErr) {
      console.error('❌ Households query exception:', householdsErr)
      households = []
    }

    // Load usage statistics
    let usageStats = []
    try {
      const { data: statsData, error: statsError } = await supabaseAdmin
        .from('user_ai_usage_summary')
        .select('*')
        .order('month_cost', { ascending: false })
        .limit(50)

      if (!statsError) {
        usageStats = statsData || []
      }
    } catch (statsErr) {
      console.log('Usage stats not available:', statsErr)
      usageStats = []
    }

    // Get total counts
    const allUsersData = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const totalUsers = allUsersData.data?.users?.length || 0
    const totalHouseholds = households.length
    const totalAIRequests = usageStats.reduce((sum, stat) => sum + (stat.total_requests || 0), 0)

    console.log('📊 Dashboard API Debug:', {
      total_users: totalUsers,
      total_households: totalHouseholds,
      total_ai_requests: totalAIRequests,
      households_sample: households.slice(0, 2).map(h => ({ id: h.id, name: h.name, members: h.member_count })),
      requesting_user: requestingUserId
    })

    // Log admin access
    try {
      await supabaseAdmin.rpc('log_admin_activity', {
        p_admin_user_id: requestingUserId,
        p_action_type: 'dashboard_access',
        p_action_details: 'Viewed admin dashboard data'
      })
    } catch (logError) {
      // Ignore logging errors
      console.log('Failed to log admin activity:', logError)
    }

    return NextResponse.json({
      success: true,
      data: {
        households,
        usage_stats: usageStats,
        totals: {
          users: totalUsers,
          households: totalHouseholds,
          ai_requests: totalAIRequests
        }
      }
    })

  } catch (error: any) {
    console.error('Admin dashboard API error:', error)
    return NextResponse.json(
      { error: 'Failed to load dashboard data: ' + error.message },
      { status: 500 }
    )
  }
}