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

    console.log('🔍 Database schema debug requested by:', requestingUserId)

    const results: any = {
      timestamp: new Date().toISOString(),
      tests: {}
    }

    // Test 1: Check if households table exists and its structure
    try {
      const { data: householdsTest, error: householdsError } = await supabaseAdmin
        .from('households')
        .select('*')
        .limit(1)

      results.tests.households_table = {
        exists: !householdsError,
        error: householdsError?.message,
        sample_record: householdsTest?.[0] || null,
        columns: householdsTest?.[0] ? Object.keys(householdsTest[0]) : []
      }
    } catch (err: any) {
      results.tests.households_table = {
        exists: false,
        error: err.message
      }
    }

    // Test 2: Check if household_members table exists
    try {
      const { data: membersTest, error: membersError } = await supabaseAdmin
        .from('household_members')
        .select('*')
        .limit(1)

      results.tests.household_members_table = {
        exists: !membersError,
        error: membersError?.message,
        sample_record: membersTest?.[0] || null,
        columns: membersTest?.[0] ? Object.keys(membersTest[0]) : []
      }
    } catch (err: any) {
      results.tests.household_members_table = {
        exists: false,
        error: err.message
      }
    }

    // Test 3: Check for user_household relationships or similar tables
    const possibleTables = [
      'user_households',
      'users_households',
      'household_users',
      'memberships',
      'user_memberships'
    ]

    for (const tableName of possibleTables) {
      try {
        const { data, error } = await supabaseAdmin
          .from(tableName)
          .select('*')
          .limit(1)

        results.tests[`${tableName}_table`] = {
          exists: !error,
          error: error?.message,
          sample_record: data?.[0] || null,
          columns: data?.[0] ? Object.keys(data[0]) : []
        }
      } catch (err: any) {
        results.tests[`${tableName}_table`] = {
          exists: false,
          error: err.message
        }
      }
    }

    // Test 4: Check what columns households table actually has
    try {
      const { data: householdsSchema, error: schemaError } = await supabaseAdmin
        .from('households')
        .select('*')
        .limit(3)

      results.tests.households_schema = {
        success: !schemaError,
        error: schemaError?.message,
        sample_records: householdsSchema || [],
        record_count: householdsSchema?.length || 0
      }
    } catch (err: any) {
      results.tests.households_schema = {
        success: false,
        error: err.message
      }
    }

    // Test 5: Try to find any relationship patterns
    try {
      const { data: allHouseholds, error: allError } = await supabaseAdmin
        .from('households')
        .select('*')

      if (!allError && allHouseholds) {
        results.tests.relationship_analysis = {
          total_households: allHouseholds.length,
          households_with_user_id: allHouseholds.filter(h => h.user_id).length,
          households_with_created_by: allHouseholds.filter(h => h.created_by).length,
          households_with_owner_id: allHouseholds.filter(h => h.owner_id).length,
          sample_household_fields: allHouseholds[0] ? Object.keys(allHouseholds[0]) : []
        }
      }
    } catch (err: any) {
      results.tests.relationship_analysis = {
        error: err.message
      }
    }

    console.log('🔍 Database schema debug results:', results)

    return NextResponse.json({
      success: true,
      results
    })

  } catch (error: any) {
    console.error('Schema debug error:', error)
    return NextResponse.json(
      { error: 'Schema debug failed: ' + error.message },
      { status: 500 }
    )
  }
}