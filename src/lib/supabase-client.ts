import { createClient } from '@supabase/supabase-js'

/**
 * Singleton client-side Supabase client
 * Use this for all client-side components to avoid multiple instances
 */
let supabaseClient: ReturnType<typeof createClient> | null = null

export function getSupabaseClient() {
  if (!supabaseClient) {
    supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return supabaseClient
}

// Export a default instance for convenience
export const supabase = getSupabaseClient()