import { NextRequest } from 'next/server'

interface RateLimitOptions {
  interval: number // Time window in milliseconds
  maxRequests: number // Maximum requests per interval
  keyGenerator?: (request: NextRequest) => string // Custom key generator
}

interface RateLimitRecord {
  count: number
  resetTime: number
}

// In-memory store for rate limiting (use Redis in production)
const rateLimitStore = new Map<string, RateLimitRecord>()

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key)
    }
  }
}, 5 * 60 * 1000)

export function createRateLimit(options: RateLimitOptions) {
  return {
    check: (request: NextRequest): { success: boolean; remaining: number; resetTime: number } => {
      const now = Date.now()
      const key = options.keyGenerator ? options.keyGenerator(request) : getDefaultKey(request)

      // Get or create rate limit record
      let record = rateLimitStore.get(key)

      if (!record || now > record.resetTime) {
        // Create new record or reset expired one
        record = {
          count: 0,
          resetTime: now + options.interval
        }
      }

      // Check if limit exceeded
      if (record.count >= options.maxRequests) {
        return {
          success: false,
          remaining: 0,
          resetTime: record.resetTime
        }
      }

      // Increment counter
      record.count++
      rateLimitStore.set(key, record)

      return {
        success: true,
        remaining: options.maxRequests - record.count,
        resetTime: record.resetTime
      }
    }
  }
}

function getDefaultKey(request: NextRequest): string {
  // Use IP address and user agent for rate limiting key
  const ip = request.headers.get('x-forwarded-for') ||
             request.headers.get('x-real-ip') ||
             'unknown'

  // Extract user ID from headers if available (for authenticated requests)
  const userId = request.headers.get('authorization')?.split(' ')[1] || 'anonymous'

  return `${ip}:${userId}`
}

// Predefined rate limiters for different use cases
export const aiEndpointLimiter = createRateLimit({
  interval: 60 * 1000, // 1 minute
  maxRequests: 10 // 10 AI requests per minute per user
})

export const generalApiLimiter = createRateLimit({
  interval: 60 * 1000, // 1 minute
  maxRequests: 100 // 100 general API requests per minute per user
})

export const voiceApiLimiter = createRateLimit({
  interval: 60 * 1000, // 1 minute
  maxRequests: 30, // 30 voice API requests per minute per user
  keyGenerator: (request) => {
    // Use user-specific key for voice commands
    const userId = request.headers.get('x-user-id') || getDefaultKey(request)
    return `voice:${userId}`
  }
})

export function rateLimitResponse(remaining: number, resetTime: number) {
  const headers = new Headers()
  headers.set('X-RateLimit-Remaining', remaining.toString())
  headers.set('X-RateLimit-Reset', Math.ceil(resetTime / 1000).toString())

  return headers
}

export function rateLimitExceededResponse(resetTime: number) {
  const retryAfter = Math.ceil((resetTime - Date.now()) / 1000)

  return new Response(
    JSON.stringify({
      error: 'Rate limit exceeded',
      message: 'Too many requests. Please try again later.',
      retryAfter
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': retryAfter.toString(),
        'X-RateLimit-Reset': Math.ceil(resetTime / 1000).toString()
      }
    }
  )
}