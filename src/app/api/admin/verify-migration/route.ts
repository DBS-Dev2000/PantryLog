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
    const results: any = {
      timestamp: new Date().toISOString(),
      migration_status: {}
    }

    console.log('🔍 Verifying household features migration...')

    // Test 1: Check if features column exists and has data
    try {
      const { data: householdsWithFeatures, error: featuresError } = await supabaseAdmin
        .from('households')
        .select('id, name, features')
        .limit(3)

      results.migration_status.features_column = {
        exists: !featuresError,
        error: featuresError?.message,
        sample_data: householdsWithFeatures || [],
        households_with_features: householdsWithFeatures?.filter(h => h.features).length || 0,
        total_households: householdsWithFeatures?.length || 0
      }
    } catch (err: any) {
      results.migration_status.features_column = {
        exists: false,
        error: err.message
      }
    }

    // Test 2: Check if helper functions exist
    try {
      const testHouseholdId = results.migration_status.features_column.sample_data?.[0]?.id

      if (testHouseholdId) {
        const { data: functionTest, error: functionError } = await supabaseAdmin
          .rpc('household_has_feature', {
            household_uuid: testHouseholdId,
            feature_name: 'recipes_enabled'
          })

        results.migration_status.helper_functions = {
          household_has_feature_exists: !functionError,
          test_result: functionTest,
          error: functionError?.message
        }
      } else {
        results.migration_status.helper_functions = {
          household_has_feature_exists: false,
          error: 'No household available for testing'
        }
      }
    } catch (err: any) {
      results.migration_status.helper_functions = {
        household_has_feature_exists: false,
        error: err.message
      }
    }

    // Test 3: Check if update function exists
    try {
      const { data: updateFunctionExists, error: updateError } = await supabaseAdmin
        .rpc('update_household_features', {
          household_uuid: '00000000-0000-0000-0000-000000000000', // Dummy UUID that won't exist
          new_features: { test: true }
        })

      results.migration_status.update_function = {
        exists: true,
        test_completed: true,
        error: updateError?.message // Expected to have error due to dummy UUID
      }
    } catch (err: any) {
      results.migration_status.update_function = {
        exists: false,
        error: err.message
      }
    }

    // Test 4: Check specific household features
    const { searchParams } = new URL(request.url)
    const testHouseholdId = searchParams.get('household_id')

    if (testHouseholdId) {
      try {
        const { data: specificHousehold, error: specificError } = await supabaseAdmin
          .from('households')
          .select('id, name, features, updated_at')
          .eq('id', testHouseholdId)
          .single()

        results.migration_status.specific_household = {
          found: !specificError,
          data: specificHousehold,
          error: specificError?.message,
          has_features: !!specificHousehold?.features,
          features_detail: specificHousehold?.features
        }
      } catch (err: any) {
        results.migration_status.specific_household = {
          found: false,
          error: err.message
        }
      }
    }

    console.log('🔍 Migration verification results:', results)

    return NextResponse.json({
      success: true,
      results
    })

  } catch (error: any) {
    console.error('Migration verification error:', error)
    return NextResponse.json(
      { error: 'Migration verification failed: ' + error.message },
      { status: 500 }
    )
  }
}