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

export async function POST(request: NextRequest) {
  try {
    const { household_id, features, requesting_user_id } = await request.json()

    if (!household_id || !features || !requesting_user_id) {
      return NextResponse.json(
        { error: 'Missing required parameters: household_id, features, requesting_user_id' },
        { status: 400 }
      )
    }

    // Verify requesting user is admin
    try {
      const { data: isAdmin, error: adminCheckError } = await supabaseAdmin
        .rpc('is_system_admin', { p_user_id: requesting_user_id })

      if (adminCheckError || !isAdmin) {
        // Fallback admin check for development
        const { data: userData } = await supabaseAdmin.auth.admin.getUserById(requesting_user_id)
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
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(requesting_user_id)
      const adminEmails = ['daren@prolongedpantry.com']

      if (!userData.user || !adminEmails.includes(userData.user.email || '')) {
        return NextResponse.json(
          { error: 'Admin privileges required - RPC not available' },
          { status: 403 }
        )
      }
    }

    console.log('💾 Saving household features:', { household_id, features })

    // For now, store in household metadata column or create separate table
    // Since we don't have a household_features table yet, we'll update households table
    try {
      const { data, error } = await supabaseAdmin
        .from('households')
        .update({
          features: features,
          updated_at: new Date().toISOString()
        })
        .eq('id', household_id)

      if (error) {
        throw error
      }

      // Log admin activity
      await supabaseAdmin.rpc('log_admin_activity', {
        p_admin_user_id: requesting_user_id,
        p_action_type: 'update_household_features',
        p_action_details: `Updated features for household ${household_id}`,
        p_target_user_id: null
      }).catch(() => {}) // Ignore logging errors

      return NextResponse.json({
        success: true,
        message: 'Household features updated successfully'
      })

    } catch (updateError: any) {
      console.error('Failed to update household features:', updateError)
      return NextResponse.json(
        { error: 'Failed to update household features: ' + updateError.message },
        { status: 500 }
      )
    }

  } catch (error: any) {
    console.error('Household features API error:', error)
    return NextResponse.json(
      { error: 'Failed to process request: ' + error.message },
      { status: 500 }
    )
  }
}