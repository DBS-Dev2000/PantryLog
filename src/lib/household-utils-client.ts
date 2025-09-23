import { createClient } from '@supabase/supabase-js'

// Create a client-side Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/**
 * Client-side version of getUserHouseholdId
 * Get the user's primary household ID from their household membership
 * This replaces the incorrect assumption that user.id = household_id
 */
export async function getUserHouseholdId(userId: string): Promise<string | null> {
  try {
    // First try to get from user_profiles (primary household)
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('household_id')
      .eq('id', userId)
      .single()

    if (profile?.household_id && !profileError) {
      console.log('🏠 Found household from user_profiles:', profile.household_id)
      return profile.household_id
    }

    // Fallback to household_members table
    const { data: membership, error: memberError } = await supabase
      .from('household_members')
      .select('household_id')
      .eq('user_id', userId)
      .order('joined_at', { ascending: true })
      .limit(1)
      .single()

    if (membership?.household_id && !memberError) {
      console.log('🏠 Found household from household_members:', membership.household_id)
      return membership.household_id
    }

    // Legacy fallback - check if user.id is a household.id (old system)
    const { data: household, error: householdError } = await supabase
      .from('households')
      .select('id')
      .eq('id', userId)
      .single()

    if (household && !householdError) {
      console.warn('⚠️ Using legacy household lookup (user.id = household.id)')
      return userId
    }

    console.error('❌ No household found for user:', userId)
    return null
  } catch (error) {
    console.error('Error getting user household:', error)
    return null
  }
}