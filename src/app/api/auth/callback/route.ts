import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') ?? '/'

  if (code) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    try {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)

      if (!error && data.user) {
        console.log('✅ Email verification successful for user:', data.user.email)

        // Check if user has invite_code in metadata and redirect to join page
        if (data.user.user_metadata?.invite_code) {
          const inviteCode = data.user.user_metadata.invite_code
          console.log('🔗 User has invite code, redirecting to join page:', inviteCode)
          return NextResponse.redirect(new URL(`/join/${inviteCode}`, requestUrl.origin))
        }

        // Otherwise redirect to inventory (main app)
        return NextResponse.redirect(new URL('/inventory', requestUrl.origin))
      } else {
        console.error('❌ Email verification failed:', error)
        return NextResponse.redirect(new URL('/auth?error=verification_failed', requestUrl.origin))
      }
    } catch (err) {
      console.error('❌ Error during email verification:', err)
      return NextResponse.redirect(new URL('/auth?error=verification_error', requestUrl.origin))
    }
  }

  // No code provided, redirect to auth
  return NextResponse.redirect(new URL('/auth', requestUrl.origin))
}