import { supabase } from '@/lib/supabase'

/**
 * Unified admin authentication check with multiple fallbacks
 * Priority order:
 * 1. RPC function is_system_admin
 * 2. system_admins table check
 * 3. Email-based fallback for initial setup
 */
export async function isSystemAdmin(userId: string): Promise<boolean> {
  if (!userId) return false

  try {
    // Method 1: Try RPC function (most reliable if exists)
    try {
      const { data: isAdmin, error } = await supabase
        .rpc('is_system_admin', { p_user_id: userId })

      if (!error && isAdmin !== null) {
        console.log('✅ Admin check via RPC:', isAdmin)
        return isAdmin
      }
    } catch (rpcError) {
      console.log('RPC function not available, trying table check')
    }

    // Method 2: Direct table check
    try {
      const { data: adminData, error: tableError } = await supabase
        .from('system_admins')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single()

      if (!tableError && adminData) {
        console.log('✅ Admin check via system_admins table: true')
        return true
      }
    } catch (tableError) {
      console.log('system_admins table check failed, trying email fallback')
    }

    // Method 3: Email-based fallback for initial setup
    const { data: { user } } = await supabase.auth.getUser()
    const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(',').map(e => e.trim()) ||
                       ['dbruncak@outlook.com', 'daren@prolongedpantry.com']

    if (user && adminEmails.includes(user.email || '')) {
      console.log('✅ Admin check via email fallback: true')

      // Try to add to system_admins table for future checks
      try {
        await supabase
          .from('system_admins')
          .upsert({
            user_id: userId,
            admin_level: 'super_admin',
            is_active: true,
            notes: 'Auto-added via email fallback'
          }, {
            onConflict: 'user_id',
            ignoreDuplicates: true
          })
      } catch (insertError) {
        console.log('Could not add to system_admins:', insertError)
      }

      return true
    }

    return false

  } catch (error) {
    console.error('Admin check failed completely:', error)
    return false
  }
}

/**
 * Get admin status with detailed information
 */
export async function getAdminStatus(userId: string): Promise<{
  isAdmin: boolean
  adminLevel?: string
  source?: 'rpc' | 'table' | 'email' | 'none'
}> {
  if (!userId) return { isAdmin: false, source: 'none' }

  try {
    // Check RPC
    try {
      const { data: isAdmin, error } = await supabase
        .rpc('is_system_admin', { p_user_id: userId })

      if (!error && isAdmin) {
        return { isAdmin: true, adminLevel: 'admin', source: 'rpc' }
      }
    } catch {}

    // Check table
    try {
      const { data: adminData } = await supabase
        .from('system_admins')
        .select('admin_level')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single()

      if (adminData) {
        return {
          isAdmin: true,
          adminLevel: adminData.admin_level || 'admin',
          source: 'table'
        }
      }
    } catch {}

    // Check email
    const { data: { user } } = await supabase.auth.getUser()
    const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(',').map(e => e.trim()) ||
                       ['dbruncak@outlook.com', 'daren@prolongedpantry.com']

    if (user && adminEmails.includes(user.email || '')) {
      return { isAdmin: true, adminLevel: 'super_admin', source: 'email' }
    }

    return { isAdmin: false, source: 'none' }

  } catch (error) {
    console.error('Failed to get admin status:', error)
    return { isAdmin: false, source: 'none' }
  }
}