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

    console.log('🔍 Test connection requested with user_id:', requestingUserId)

    // Test Supabase admin connection
    console.log('🧪 Testing Supabase admin connection...')

    // Test 1: Check environment variables
    const hasUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL
    const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY

    console.log('Environment check:', { hasUrl, hasServiceKey })

    // Test 2: Try to list users
    let usersTest = { success: false, count: 0, error: null }
    try {
      const { data: usersData, error: usersError } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 10
      })

      if (usersError) {
        usersTest.error = usersError.message
      } else {
        usersTest.success = true
        usersTest.count = usersData?.users?.length || 0
      }
    } catch (err: any) {
      usersTest.error = err.message
    }

    // Test 3: Try to access a table
    let tableTest = { success: false, error: null }
    try {
      const { data, error } = await supabaseAdmin.from('households').select('count').limit(1)
      if (error) {
        tableTest.error = error.message
      } else {
        tableTest.success = true
      }
    } catch (err: any) {
      tableTest.error = err.message
    }

    // Test 4: Check specific user (only if user_id provided)
    let currentUserTest = { success: false, error: null, user: null }
    if (requestingUserId) {
      try {
        const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(requestingUserId)
        if (userError) {
          currentUserTest.error = userError.message
        } else {
          currentUserTest.success = true
          currentUserTest.user = {
            id: userData.user?.id,
            email: userData.user?.email,
            created_at: userData.user?.created_at
          }
        }
      } catch (err: any) {
        currentUserTest.error = err.message
      }
    } else {
      currentUserTest.error = 'No user ID provided'
    }

    const results = {
      environment: { hasUrl, hasServiceKey },
      users_api: usersTest,
      tables_access: tableTest,
      current_user: currentUserTest,
      timestamp: new Date().toISOString()
    }

    console.log('🧪 Connection test results:', results)

    return NextResponse.json({
      success: true,
      results
    })

  } catch (error: any) {
    console.error('Connection test error:', error)
    return NextResponse.json(
      { error: 'Connection test failed: ' + error.message },
      { status: 500 }
    )
  }
}