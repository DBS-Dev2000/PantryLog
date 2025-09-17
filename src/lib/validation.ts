import { z } from 'zod'

// Input sanitization functions
export function sanitizeString(input: string, maxLength: number = 500): string {
  if (typeof input !== 'string') {
    throw new Error('Input must be a string')
  }

  return input
    .trim()
    .slice(0, maxLength)
    .replace(/[<>'"&]/g, '') // Remove potentially dangerous characters
    .replace(/\s+/g, ' ') // Normalize whitespace
}

export function sanitizeHTML(input: string): string {
  // Basic HTML sanitization - remove script tags and other dangerous elements
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
}

export function validateAndSanitizeUrl(url: string): string {
  // URL validation and sanitization
  try {
    const parsedUrl = new URL(url)

    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('Invalid URL protocol')
    }

    // Basic domain validation - no localhost or internal IPs in production
    if (process.env.NODE_ENV === 'production') {
      const hostname = parsedUrl.hostname.toLowerCase()
      if (
        hostname === 'localhost' ||
        hostname.startsWith('127.') ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname === '0.0.0.0'
      ) {
        throw new Error('Internal URLs not allowed')
      }
    }

    return parsedUrl.toString()
  } catch (error) {
    throw new Error('Invalid URL format')
  }
}

// Zod schemas for API validation
export const ProductDescriptionSchema = z.object({
  description: z.string()
    .min(1, 'Description is required')
    .max(200, 'Description too long')
    .transform(s => sanitizeString(s, 200)),
  userId: z.string().uuid('Invalid user ID format')
})

export const RecipeImportSchema = z.object({
  url: z.string()
    .min(1, 'URL is required')
    .max(2000, 'URL too long')
    .transform(validateAndSanitizeUrl),
  user_id: z.string().uuid('Invalid user ID format')
})

export const VoiceCommandSchema = z.object({
  command: z.string()
    .min(1, 'Command is required')
    .max(500, 'Command too long')
    .transform(s => sanitizeString(s, 500)),
  userId: z.string().uuid('Invalid user ID format'),
  action: z.enum(['add', 'remove']).optional()
})

export const InventoryItemSchema = z.object({
  product_id: z.string().uuid('Invalid product ID'),
  storage_location_id: z.string().uuid('Invalid storage location ID'),
  household_id: z.string().uuid('Invalid household ID'),
  quantity: z.number()
    .min(0.01, 'Quantity must be positive')
    .max(10000, 'Quantity too large'),
  unit: z.string()
    .max(20, 'Unit name too long')
    .transform(s => sanitizeString(s, 20))
    .optional(),
  notes: z.string()
    .max(500, 'Notes too long')
    .transform(s => sanitizeString(s, 500))
    .optional()
})

export const AdminActionSchema = z.object({
  action: z.enum(['grant_admin', 'revoke_admin']),
  target_user_id: z.string().uuid('Invalid target user ID'),
  requesting_user_id: z.string().uuid('Invalid requesting user ID'),
  admin_level: z.enum(['admin', 'super_admin']).optional(),
  notes: z.string()
    .max(500, 'Notes too long')
    .transform(s => sanitizeString(s, 500))
    .optional()
})

// Validation middleware function
export function validateRequest<T>(schema: z.ZodSchema<T>) {
  return async (data: unknown): Promise<{ success: boolean; data?: T; errors?: string[] }> => {
    try {
      const validatedData = await schema.parseAsync(data)
      return { success: true, data: validatedData }
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map(err =>
          `${err.path.join('.')}: ${err.message}`
        )
        return { success: false, errors }
      }
      return { success: false, errors: ['Validation failed'] }
    }
  }
}

// SQL injection prevention helpers
export function escapeSqlIdentifier(identifier: string): string {
  // Remove any characters that could be used for SQL injection
  return identifier.replace(/[^a-zA-Z0-9_]/g, '')
}

export function validateSqlLikePattern(pattern: string): string {
  // Validate and sanitize SQL LIKE patterns
  return pattern
    .replace(/[%_\\]/g, '\\$&') // Escape SQL wildcards
    .slice(0, 100) // Limit length
}

// Rate limiting key generation
export function generateUserKey(userId: string, ip: string): string {
  // Generate a rate limiting key from user ID and IP
  const sanitizedUserId = sanitizeString(userId, 50)
  const sanitizedIp = sanitizeString(ip, 50)
  return `${sanitizedUserId}:${sanitizedIp}`
}