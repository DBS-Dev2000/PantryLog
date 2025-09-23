import { createClient } from '@supabase/supabase-js'

// Create a client-side Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/**
 * Force refresh the current session
 * Useful when user data or household membership changes
 */
export async function refreshSession() {
  try {
    const { data: { session }, error } = await supabase.auth.refreshSession()
    if (error) {
      console.error('Error refreshing session:', error)
      return null
    }
    return session
  } catch (error) {
    console.error('Failed to refresh session:', error)
    return null
  }
}

/**
 * Clear all cached data and refresh the page
 * Use this when encountering persistent auth issues
 */
export function clearCacheAndReload() {
  // Clear any cached household data
  if (typeof window !== 'undefined') {
    // Clear localStorage items that might be stale
    const keysToRemove = ['household_id', 'user_household', 'cached_household']
    keysToRemove.forEach(key => {
      localStorage.removeItem(key)
      sessionStorage.removeItem(key)
    })

    // Force a hard reload to clear all React state
    window.location.reload()
  }
}

/**
 * Get fresh session data
 * Always fetches from server, never uses cache
 */
export async function getFreshSession() {
  try {
    // First try to refresh the session to get latest data
    const { data: { session }, error } = await supabase.auth.refreshSession()

    if (error || !session) {
      // If refresh fails, get the current session
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      return currentSession
    }

    return session
  } catch (error) {
    console.error('Error getting fresh session:', error)
    return null
  }
}

/**
 * Monitor for auth state changes and clear stale data
 */
export function setupAuthListener(onSessionChange?: (session: any) => void) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    console.log('Auth state changed:', event)

    // Clear stale data on certain events
    if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
      clearCacheAndReload()
    }

    // Notify caller of session changes
    if (onSessionChange) {
      onSessionChange(session)
    }
  })

  return subscription
}