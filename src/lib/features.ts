import { supabase } from './supabase'
import { useState, useEffect } from 'react'

// Feature checking service for the main PantryIQ application
// This service checks household features and enforcement settings to control UI

export interface FeaturePermissions {
  // Core features
  recipes_enabled: boolean
  ai_features_enabled: boolean
  voice_assistant_enabled: boolean
  meal_planner_enabled: boolean
  shopping_list_sharing: boolean
  storage_editing: boolean
  multiple_households: boolean
  advanced_reporting: boolean
  custom_labels: boolean
  barcode_scanning: boolean

  // Voice assistant settings per page
  voice_assistant_type_inventory?: 'basic' | 'whisper'
  voice_assistant_type_quick_add?: 'basic' | 'whisper'
  voice_assistant_type_quick_use?: 'basic' | 'whisper'

  // Enforcement settings
  enforcement_mode: 'upsell' | 'hide' | 'system_default'
  enforce_api_limits: boolean
  show_upgrade_prompts: boolean

  // User overrides
  unlimited_ai: boolean
  is_admin: boolean
}

export interface SystemSettings {
  default_enforcement_mode: 'upsell' | 'hide'
  default_monthly_limit: number
  default_daily_limit: number
  free_tier_requests: number
  show_upgrade_prompts: boolean
  enforce_feature_limits: boolean
}

// Cache for performance
let featureCache: Map<string, FeaturePermissions> = new Map()
let systemSettingsCache: SystemSettings | null = null
let cacheTimestamp: number = 0

const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export async function getUserHouseholdFeatures(userId?: string): Promise<FeaturePermissions> {
  try {
    // Get current user if not provided
    if (!userId) {
      const { data: { session } } = await supabase.auth.getSession()
      userId = session?.user?.id
    }

    if (!userId) {
      console.warn('🚫 No user ID available for feature checking')
      return getDefaultFeatures()
    }

    // Check cache first
    const cacheKey = userId
    const now = Date.now()
    if (featureCache.has(cacheKey) && (now - cacheTimestamp) < CACHE_DURATION) {
      console.log('📦 Using cached feature permissions for user:', userId)
      return featureCache.get(cacheKey)!
    }

    console.log('🔍 Fetching fresh feature permissions for user:', userId)

    // First, get the user's household ID
    // TEMPORARY: Fall back to using user ID as household ID if user_profiles doesn't exist
    const { data: userData, error: userError } = await supabase
      .from('user_profiles')
      .select('household_id')
      .eq('id', userId)
      .single()

    let householdId = userData?.household_id

    // If user_profiles table doesn't exist or query fails, fall back to user.id = household.id
    if (userError) {
      console.warn('⚠️ Could not fetch user household, falling back to user.id:', userError)

      // Check if a household exists with this user's ID (old pattern)
      const { data: household } = await supabase
        .from('households')
        .select('id')
        .eq('id', userId)
        .single()

      if (household) {
        householdId = household.id
      } else {
        // If no direct match, just use the user ID as household ID
        householdId = userId
      }
    }

    if (!householdId) {
      console.warn('⚠️ No household found for user')
      return getDefaultFeatures()
    }

    // Now get the household features using the correct household ID
    const { data: household, error: householdError } = await supabase
      .from('households')
      .select('id, name, features')
      .eq('id', householdId)
      .single()

    if (householdError) {
      console.warn('⚠️ Could not fetch household features:', householdError)
      return getDefaultFeatures()
    }

    // Get system settings (with caching)
    const systemSettings = await getSystemSettings()

    // Get user overrides (placeholder for future implementation)
    const userOverrides = await getUserOverrides(userId)

    // Resolve hierarchical permissions: User → Household → System
    const permissions: FeaturePermissions = {
      // Feature toggles (household level)
      recipes_enabled: household.features?.recipes_enabled ?? true,
      ai_features_enabled: household.features?.ai_features_enabled ?? true,
      voice_assistant_enabled: household.features?.voice_assistant_enabled ?? false, // Default to disabled
      meal_planner_enabled: household.features?.meal_planner_enabled ?? false, // Default to disabled (premium feature)
      shopping_list_sharing: household.features?.shopping_list_sharing ?? true,
      storage_editing: household.features?.storage_editing ?? true,
      multiple_households: household.features?.multiple_households ?? false,
      advanced_reporting: household.features?.advanced_reporting ?? false,
      custom_labels: household.features?.custom_labels ?? true,
      barcode_scanning: household.features?.barcode_scanning ?? true,

      // Voice assistant type per page (default to whisper for better accuracy)
      voice_assistant_type_inventory: household.features?.voice_assistant_type_inventory ?? 'whisper',
      voice_assistant_type_quick_add: household.features?.voice_assistant_type_quick_add ?? 'whisper',
      voice_assistant_type_quick_use: household.features?.voice_assistant_type_quick_use ?? 'whisper',

      // Enforcement settings (hierarchical resolution)
      enforcement_mode: userOverrides?.enforcement_mode ||
                       household.features?.enforcement_mode ||
                       systemSettings.default_enforcement_mode,

      enforce_api_limits: userOverrides?.enforce_api_limits ??
                         household.features?.enforce_api_limits ??
                         systemSettings.enforce_feature_limits,

      show_upgrade_prompts: userOverrides?.show_upgrade_prompts ??
                           household.features?.show_upgrade_prompts ??
                           systemSettings.show_upgrade_prompts,

      // User-specific overrides
      unlimited_ai: userOverrides?.unlimited_ai || false,
      is_admin: userOverrides?.is_admin || false
    }

    // Cache the result
    featureCache.set(cacheKey, permissions)
    cacheTimestamp = now

    console.log('✅ Feature permissions resolved:', permissions)
    return permissions

  } catch (error) {
    console.error('❌ Error fetching feature permissions:', error)
    return getDefaultFeatures()
  }
}

export async function getSystemSettings(): Promise<SystemSettings> {
  try {
    // Use cached system settings if available
    const now = Date.now()
    if (systemSettingsCache && (now - cacheTimestamp) < CACHE_DURATION) {
      return systemSettingsCache
    }

    // For now, return hardcoded defaults (can be enhanced to fetch from database)
    const settings: SystemSettings = {
      default_enforcement_mode: 'upsell',
      default_monthly_limit: 5.00,
      default_daily_limit: 1.00,
      free_tier_requests: 10,
      show_upgrade_prompts: true,
      enforce_feature_limits: true
    }

    systemSettingsCache = settings
    return settings
  } catch (error) {
    console.error('❌ Error fetching system settings:', error)
    return {
      default_enforcement_mode: 'upsell',
      default_monthly_limit: 5.00,
      default_daily_limit: 1.00,
      free_tier_requests: 10,
      show_upgrade_prompts: true,
      enforce_feature_limits: true
    }
  }
}

async function getUserOverrides(userId: string) {
  try {
    // Placeholder for user override implementation
    // This would query a user_overrides table when implemented
    return {
      enforcement_mode: null,
      enforce_api_limits: null,
      show_upgrade_prompts: null,
      unlimited_ai: false,
      is_admin: false
    }
  } catch (error) {
    console.error('❌ Error fetching user overrides:', error)
    return null
  }
}

function getDefaultFeatures(): FeaturePermissions {
  return {
    recipes_enabled: true,
    ai_features_enabled: true,
    voice_assistant_enabled: false, // Default to disabled
    meal_planner_enabled: false, // Default to disabled (premium feature)
    shopping_list_sharing: true,
    storage_editing: true,
    multiple_households: false,
    advanced_reporting: false,
    custom_labels: true,
    barcode_scanning: true,
    voice_assistant_type_inventory: 'whisper',
    voice_assistant_type_quick_add: 'whisper',
    voice_assistant_type_quick_use: 'whisper',
    enforcement_mode: 'upsell',
    enforce_api_limits: true,
    show_upgrade_prompts: true,
    unlimited_ai: false,
    is_admin: false
  }
}

// Helper functions for common feature checks
export async function canAccessRecipes(userId?: string): Promise<boolean> {
  const permissions = await getUserHouseholdFeatures(userId)
  return permissions.recipes_enabled || permissions.is_admin
}

export async function canUseAI(userId?: string): Promise<boolean> {
  const permissions = await getUserHouseholdFeatures(userId)
  return permissions.ai_features_enabled || permissions.unlimited_ai || permissions.is_admin
}

export async function canEditStorage(userId?: string): Promise<boolean> {
  const permissions = await getUserHouseholdFeatures(userId)
  return permissions.storage_editing || permissions.is_admin
}

export async function canUseVoiceAssistant(userId?: string): Promise<boolean> {
  const permissions = await getUserHouseholdFeatures(userId)
  return permissions.voice_assistant_enabled || permissions.is_admin
}

export async function getVoiceAssistantType(page: 'inventory' | 'quick_add' | 'quick_use', userId?: string): Promise<'basic' | 'whisper'> {
  const permissions = await getUserHouseholdFeatures(userId)

  switch (page) {
    case 'inventory':
      return permissions.voice_assistant_type_inventory ?? 'whisper'
    case 'quick_add':
      return permissions.voice_assistant_type_quick_add ?? 'whisper'
    case 'quick_use':
      return permissions.voice_assistant_type_quick_use ?? 'whisper'
    default:
      return 'whisper'
  }
}

export async function getEnforcementMode(userId?: string): Promise<'upsell' | 'hide'> {
  const permissions = await getUserHouseholdFeatures(userId)
  return permissions.enforcement_mode === 'system_default' ? 'upsell' : permissions.enforcement_mode
}

// Clear cache when needed (e.g., after feature updates)
export function clearFeatureCache(): void {
  featureCache.clear()
  systemSettingsCache = null
  cacheTimestamp = 0
  console.log('🧹 Feature cache cleared')
}

// Check if user should see feature based on enforcement mode
export async function shouldShowFeature(featureName: string, userId?: string): Promise<'show' | 'hide' | 'upsell'> {
  const permissions = await getUserHouseholdFeatures(userId)
  const featureEnabled = permissions[featureName as keyof FeaturePermissions] as boolean

  if (featureEnabled || permissions.is_admin) {
    return 'show'
  }

  return permissions.enforcement_mode === 'hide' ? 'hide' : 'upsell'
}