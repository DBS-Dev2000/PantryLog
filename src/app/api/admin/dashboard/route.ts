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

    // Load households with member counts
    let households = []
    try {
      // Try enhanced query first
      const { data: householdsData, error: householdsError } = await supabaseAdmin
        .from('households')
        .select(`
          id,
          name,
          created_at,
          updated_at,
          created_by,
          household_members(
            user_id,
            role,
            joined_at,
            is_active
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

        // Process the data to get member counts and details
        households = householdsData.map(h => {
          const activeMembers = h.household_members?.filter(m => m.is_active !== false) || []
          const householdMembers = activeMembers.map(member => ({
            user_id: member.user_id,
            role: member.role || 'member',
            joined_at: member.joined_at,
            email: userMap.get(member.user_id)?.email || 'Unknown',
            user_created_at: userMap.get(member.user_id)?.created_at,
            is_creator: member.user_id === h.created_by
          }))

          // If no members found but household exists, add creator as member
          if (householdMembers.length === 0 && h.created_by) {
            householdMembers.push({
              user_id: h.created_by,
              role: 'admin',
              joined_at: h.created_at,
              email: userMap.get(h.created_by)?.email || 'Creator',
              user_created_at: userMap.get(h.created_by)?.created_at,
              is_creator: true
            })
          }

          return {
            ...h,
            member_count: Math.max(householdMembers.length, 1),
            members: householdMembers
          }
        })
        console.log('🏠 Enhanced households query result:', householdsData.length, 'households found with members')
      } else {
        console.error('❌ Enhanced households query failed:', householdsError)

        // Fallback to basic household query
        const { data: basicHouseholds, error: basicError } = await supabaseAdmin
          .from('households')
          .select(`
            id,
            name,
            created_at,
            updated_at
          `)
          .order('created_at', { ascending: false })

        if (!basicError && basicHouseholds) {
          households = basicHouseholds.map(h => ({
            ...h,
            member_count: 1, // Default to 1 (creator)
            members: []
          }))
          console.log('🏠 Fallback households query result:', basicHouseholds.length, 'households found (basic)')
        } else {
          console.error('❌ Even basic households query failed:', basicError)
          households = []
        }
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