import { supabase } from '@/lib/supabase'

/**
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

/**
 * Get all household IDs that a user belongs to
 * Useful for multi-household support in the future
 */
export async function getUserHouseholds(userId: string): Promise<string[]> {
  try {
    const { data: memberships, error } = await supabase
      .from('household_members')
      .select('household_id')
      .eq('user_id', userId)

    if (error) throw error

    return memberships?.map(m => m.household_id) || []
  } catch (error) {
    console.error('Error getting user households:', error)
    return []
  }
}

/**
 * Check if a user is a member of a specific household
 */
export async function isUserInHousehold(userId: string, householdId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('household_members')
      .select('id')
      .eq('user_id', userId)
      .eq('household_id', householdId)
      .single()

    return !!data && !error
  } catch (error) {
    return false
  }
}

/**
 * Get user's role in a household
 */
export async function getUserHouseholdRole(userId: string, householdId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('household_members')
      .select('role')
      .eq('user_id', userId)
      .eq('household_id', householdId)
      .single()

    if (error) throw error
    return data?.role || null
  } catch (error) {
    console.error('Error getting user role:', error)
    return null
  }
}

/**
 * Cache for household IDs to reduce database calls
 * Expires after 5 minutes
 */
const householdCache = new Map<string, { id: string; timestamp: number }>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export async function getCachedUserHouseholdId(userId: string): Promise<string | null> {
  const cached = householdCache.get(userId)

  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.id
  }

  const householdId = await getUserHouseholdId(userId)

  if (householdId) {
    householdCache.set(userId, { id: householdId, timestamp: Date.now() })
  }

  return householdId
}