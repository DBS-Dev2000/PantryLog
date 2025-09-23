import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Use service role to bypass RLS for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(request: NextRequest) {
  try {
    const { user_id, household_id, role = 'member' } = await request.json()

    if (!user_id || !household_id) {
      return NextResponse.json(
        { error: 'User ID and Household ID are required' },
        { status: 400 }
      )
    }

    console.log('🏠 Admin household reassignment:', {
      user_id,
      household_id,
      role
    })

    // First, remove user from all existing household memberships
    const { error: removeError } = await supabase
      .from('household_members')
      .delete()
      .eq('user_id', user_id)

    if (removeError) {
      console.error('❌ Error removing user from households:', removeError)
      return NextResponse.json(
        { error: 'Failed to remove user from existing households' },
        { status: 500 }
      )
    }

    // Add user to new household
    const { error: addError } = await supabase
      .from('household_members')
      .insert({
        user_id,
        household_id,
        role,
        joined_at: new Date().toISOString()
      })

    if (addError) {
      console.error('❌ Error adding user to household:', addError)
      return NextResponse.json(
        { error: 'Failed to add user to household' },
        { status: 500 }
      )
    }

    // Update user_profiles table with primary household
    const { error: profileError } = await supabase
      .from('user_profiles')
      .upsert({
        id: user_id,
        household_id: household_id,
        updated_at: new Date().toISOString()
      })

    if (profileError) {
      console.warn('⚠️ Warning: Could not update user_profiles:', profileError)
      // Don't fail the request if user_profiles update fails
    }

    console.log('✅ User successfully reassigned to household')

    return NextResponse.json({
      success: true,
      message: 'User successfully reassigned to household'
    })

  } catch (error) {
    console.error('❌ Error in household reassignment:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}