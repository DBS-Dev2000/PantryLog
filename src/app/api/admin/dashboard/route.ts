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
      const { data: householdsData, error: householdsError } = await supabaseAdmin
        .from('households')
        .select(`
          id,
          name,
          created_at,
          updated_at,
          household_members!inner(user_id)
        `)
        .order('created_at', { ascending: false })

      if (!householdsError) {
        // Process the data to get member counts
        households = householdsData?.map(h => ({
          ...h,
          member_count: h.household_members?.length || 0
        })) || []
      }
    } catch (householdsErr) {
      console.log('Household data not available:', householdsErr)
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
    const totalUsers = (await supabaseAdmin.auth.admin.listUsers()).data.users.length
    const totalHouseholds = households.length
    const totalAIRequests = usageStats.reduce((sum, stat) => sum + (stat.total_requests || 0), 0)

    // Log admin access
    await supabaseAdmin.rpc('log_admin_activity', {
      p_admin_user_id: requestingUserId,
      p_action_type: 'dashboard_access',
      p_action_details: 'Viewed admin dashboard data'
    }).catch(() => {}) // Ignore logging errors

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