import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Authentication error class
export class AuthError extends Error {
  constructor(message: string, public statusCode: number = 401) {
    super(message)
    this.name = 'AuthError'
  }
}

// Rate limiting error class
export class RateLimitError extends Error {
  constructor(message: string, public statusCode: number = 429) {
    super(message)
    this.name = 'RateLimitError'
  }
}

// Authentication context returned from middleware
export interface AuthContext {
  user: any
  supabase: any
  isAdmin: boolean
}

// Admin authorization context
export interface AdminAuthContext extends AuthContext {
  isAdmin: true
  adminSupabase: any
}

/**
 * Core authentication middleware - verifies user token and returns authenticated context
 */
export async function requireAuth(req: NextRequest): Promise<AuthContext> {
  const authorization = req.headers.get('authorization')

  if (!authorization) {
    throw new AuthError('Authentication required. Please log in.', 401)
  }

  // Create authenticated client
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: { authorization }
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    }
  )

  // Verify user authentication
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    throw new AuthError('Invalid authentication token. Please log in again.', 401)
  }

  // Check if user is admin (for future admin features)
  let isAdmin = false
  try {
    const adminEmails = ['daren@prolongedpantry.com']
    isAdmin = adminEmails.includes(user.email || '')
  } catch (adminCheckError) {
    // Not an admin, continue as regular user
    isAdmin = false
  }

  return {
    user,
    supabase,
    isAdmin
  }
}

/**
 * Admin-only authentication middleware - requires admin privileges
 */
export async function requireAdmin(req: NextRequest): Promise<AdminAuthContext> {
  const authContext = await requireAuth(req)

  // Create admin client for privileged operations
  const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )

  // Verify admin privileges using RPC function
  try {
    const { data: isAdmin, error: adminCheckError } = await adminSupabase
      .rpc('is_system_admin', { p_user_id: authContext.user.id })

    if (adminCheckError || !isAdmin) {
      // Fallback admin check for development
      const { data: userData } = await adminSupabase.auth.admin.getUserById(authContext.user.id)
      const adminEmails = ['daren@prolongedpantry.com']

      if (!userData.user || !adminEmails.includes(userData.user.email || '')) {
        throw new AuthError('Admin privileges required', 403)
      }
    }
  } catch (rpcError) {
    // RPC function doesn't exist, use fallback admin check
    const { data: userData } = await adminSupabase.auth.admin.getUserById(authContext.user.id)
    const adminEmails = ['daren@prolongedpantry.com']

    if (!userData.user || !adminEmails.includes(userData.user.email || '')) {
      throw new AuthError('Admin privileges required - RPC not available', 403)
    }
  }

  // Log admin access
  try {
    await adminSupabase.rpc('log_admin_activity', {
      p_admin_user_id: authContext.user.id,
      p_action_type: 'admin_api_access',
      p_action_details: `Accessed ${req.url}`
    })
  } catch (logError) {
    // Ignore logging errors
    console.warn('Failed to log admin activity:', logError)
  }

  return {
    ...authContext,
    isAdmin: true,
    adminSupabase
  }
}

/**
 * Rate limiting middleware - checks AI usage limits
 */
export async function requireAIUsage(authContext: AuthContext): Promise<void> {
  try {
    const { data: canUse, error: limitError } = await authContext.supabase
      .rpc('can_user_make_ai_request', { p_user_id: authContext.user.id })

    if (limitError) {
      console.error('Error checking AI usage limits:', limitError)
      // Continue if rate limit check fails (graceful degradation)
      return
    }

    if (!canUse) {
      throw new RateLimitError(
        'AI usage limit reached. Please upgrade your plan or wait for reset.',
        429
      )
    }
  } catch (error) {
    if (error instanceof RateLimitError) {
      throw error
    }
    // For other errors, log and continue (graceful degradation)
    console.warn('AI rate limit check failed:', error)
  }
}

/**
 * Household validation middleware - ensures user belongs to specified household
 */
export async function requireHouseholdAccess(
  authContext: AuthContext,
  householdId: string
): Promise<void> {
  try {
    const { data: membership, error } = await authContext.supabase
      .from('household_members')
      .select('role')
      .eq('user_id', authContext.user.id)
      .eq('household_id', householdId)
      .single()

    if (error || !membership) {
      throw new AuthError('Access denied. You do not belong to this household.', 403)
    }
  } catch (error) {
    if (error instanceof AuthError) {
      throw error
    }
    throw new AuthError('Unable to verify household access', 403)
  }
}

/**
 * Helper function to handle authentication errors consistently
 */
export function handleAuthError(error: any): NextResponse {
  console.error('Authentication error:', error)

  if (error instanceof AuthError) {
    return NextResponse.json(
      {
        error: error.message,
        code: 'AUTH_ERROR',
        timestamp: new Date().toISOString()
      },
      { status: error.statusCode }
    )
  }

  if (error instanceof RateLimitError) {
    return NextResponse.json(
      {
        error: error.message,
        code: 'RATE_LIMIT_EXCEEDED',
        limit_reached: true,
        timestamp: new Date().toISOString()
      },
      { status: error.statusCode }
    )
  }

  // Generic error handling
  return NextResponse.json(
    {
      error: 'Authentication failed',
      code: 'AUTH_UNKNOWN',
      timestamp: new Date().toISOString()
    },
    { status: 500 }
  )
}

/**
 * Helper function to log AI usage with consistent parameters
 */
export async function logAIUsage(
  authContext: AuthContext,
  params: {
    apiProvider: string
    modelName: string
    apiEndpoint: string
    inputTokens: number
    outputTokens: number
    imageCount?: number
    requestType: string
    success: boolean
    errorMessage?: string
    processingTimeMs: number
  }
): Promise<void> {
  try {
    await authContext.supabase.rpc('log_ai_usage', {
      p_user_id: authContext.user.id,
      p_household_id: authContext.user.id, // Using user_id as household_id for now
      p_api_provider: params.apiProvider,
      p_model_name: params.modelName,
      p_api_endpoint: params.apiEndpoint,
      p_input_tokens: params.inputTokens,
      p_output_tokens: params.outputTokens,
      p_image_count: params.imageCount || 0,
      p_total_cost: 0, // Calculated in function
      p_request_type: params.requestType,
      p_success: params.success,
      p_error_message: params.errorMessage,
      p_processing_time_ms: params.processingTimeMs
    })

    console.log(`✅ ${params.apiProvider.toUpperCase()} usage logged:`, params.inputTokens, 'input +', params.outputTokens, 'output tokens')
  } catch (logError) {
    console.warn('❌ Failed to log AI usage:', logError)
  }
}

/**
 * Comprehensive middleware wrapper that handles common patterns
 */
export async function withAuth(
  req: NextRequest,
  handler: (authContext: AuthContext, req: NextRequest) => Promise<NextResponse>,
  options: {
    requireAdmin?: boolean
    requireAI?: boolean
    logAccess?: boolean
  } = {}
): Promise<NextResponse> {
  try {
    // Step 1: Authenticate user
    let authContext: AuthContext | AdminAuthContext

    if (options.requireAdmin) {
      authContext = await requireAdmin(req)
    } else {
      authContext = await requireAuth(req)
    }

    // Step 2: Check AI usage limits if required
    if (options.requireAI) {
      await requireAIUsage(authContext)
    }

    // Step 3: Log access if requested
    if (options.logAccess) {
      console.log(`🔐 Authenticated API access: ${req.url} by user ${authContext.user.id}`)
    }

    // Step 4: Execute handler with authenticated context and original request
    return await handler(authContext, req)

  } catch (error) {
    return handleAuthError(error)
  }
}

/**
 * Legacy function to create authenticated client (for gradual migration)
 * @deprecated Use requireAuth() instead
 */
export function createAuthClient(req: NextRequest) {
  const authorization = req.headers.get('authorization')
  if (!authorization) {
    throw new Error('Authentication required. Please log in.')
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: { authorization }
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    }
  )
}