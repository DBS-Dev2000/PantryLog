'use client'

/**
 * FeatureGuard Component
 *
 * Provides route-level protection for premium features based on household permissions.
 * Handles both "upsell" mode (shows upgrade prompt) and "hide" mode (redirects).
 *
 * Usage:
 * <FeatureGuard feature="recipes_enabled">
 *   <YourProtectedComponent />
 * </FeatureGuard>
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Box,
  Container,
  Card,
  CardContent,
  Typography,
  Button,
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Paper
} from '@mui/material'
import {
  Lock as LockIcon,
  Star as StarIcon,
  Check as CheckIcon,
  ArrowBack as BackIcon,
  Upgrade as UpgradeIcon,
  Restaurant as RecipeIcon,
  ShoppingCart as ShoppingIcon,
  Analytics as AnalyticsIcon,
  Inventory2 as InventoryIcon,
  Label as LabelIcon,
  SmartToy as AIIcon,
  Group as GroupIcon
} from '@mui/icons-material'
import { getUserHouseholdFeatures, FeaturePermissions } from '@/lib/features'
import { supabase } from '@/lib/supabase'

interface FeatureGuardProps {
  feature: keyof FeaturePermissions
  children: React.ReactNode
  fallbackPath?: string // Where to redirect in "hide" mode (default: '/')
  customUpsellTitle?: string // Override default upsell title
  customUpsellDescription?: string // Override default upsell description
}

// Feature metadata for generating professional upsell screens
const featureDetails = {
  recipes_enabled: {
    icon: RecipeIcon,
    title: 'Recipe Management',
    description: 'Create, import, and manage recipes with ingredient tracking',
    benefits: [
      'Import recipes from YouTube and websites',
      'Smart ingredient matching',
      'Recipe availability checking',
      'Photo scanning for handwritten recipes'
    ]
  },
  shopping_list_sharing: {
    icon: ShoppingIcon,
    title: 'Shopping List Sharing',
    description: 'Share shopping lists with household members in real-time',
    benefits: [
      'Real-time list synchronization',
      'Multiple lists per household',
      'Smart item suggestions',
      'Store-specific organization'
    ]
  },
  advanced_reporting: {
    icon: AnalyticsIcon,
    title: 'Advanced Analytics & Reports',
    description: 'Detailed insights into your inventory and consumption patterns',
    benefits: [
      'Expiration analytics',
      'Consumption trends',
      'Cost tracking',
      'Waste reduction metrics'
    ]
  },
  ai_features_enabled: {
    icon: AIIcon,
    title: 'AI-Powered Features',
    description: 'Advanced AI capabilities for smart kitchen management',
    benefits: [
      'Visual item recognition',
      'Smart recipe suggestions',
      'Predictive shopping lists',
      'Ingredient substitution AI'
    ]
  },
  custom_labels: {
    icon: LabelIcon,
    title: 'Custom Label Printing',
    description: 'Create and print custom labels for your inventory',
    benefits: [
      'QR code generation',
      'Custom label designs',
      'Batch printing',
      'Label templates'
    ]
  },
  multiple_households: {
    icon: GroupIcon,
    title: 'Multiple Households',
    description: 'Manage inventory for multiple households',
    benefits: [
      'Switch between households',
      'Separate inventories',
      'Cross-household sharing',
      'Centralized management'
    ]
  },
  storage_editing: {
    icon: InventoryIcon,
    title: 'Storage Management',
    description: 'Create and manage custom storage locations',
    benefits: [
      'Custom storage areas',
      'Temperature zones',
      'Location hierarchies',
      'Smart organization'
    ]
  },
  barcode_scanning: {
    icon: InventoryIcon,
    title: 'Barcode Scanning',
    description: 'Scan product barcodes for quick inventory updates',
    benefits: [
      'Quick item addition',
      'Product information lookup',
      'Batch scanning',
      'Custom barcode support'
    ]
  }
}

export default function FeatureGuard({
  feature,
  children,
  fallbackPath = '/',
  customUpsellTitle,
  customUpsellDescription
}: FeatureGuardProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)
  const [enforcementMode, setEnforcementMode] = useState<'upsell' | 'hide'>('upsell')
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    checkFeatureAccess()
  }, [feature])

  /**
   * Checks if the current user has access to the specified feature.
   * Handles enforcement modes (upsell vs hide) and admin overrides.
   */
  const checkFeatureAccess = async () => {
    try {
      // Get current user
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        router.push('/auth')
        return
      }
      setUser(session.user)

      // Check feature permissions
      const permissions = await getUserHouseholdFeatures(session.user.id)

      // Check if user has access to the feature
      const hasFeatureAccess = permissions[feature] as boolean || permissions.is_admin
      setHasAccess(hasFeatureAccess)
      setEnforcementMode(permissions.enforcement_mode === 'hide' ? 'hide' : 'upsell')

      // If no access and enforcement is hide, redirect immediately
      if (!hasFeatureAccess && permissions.enforcement_mode === 'hide') {
        console.log(`🚫 Access denied to ${feature} (hide mode) - redirecting`)
        router.push(fallbackPath)
        return
      }

      setLoading(false)
    } catch (error) {
      console.error('Error checking feature access:', error)
      setLoading(false)
    }
  }

  const handleUpgrade = () => {
    // In production, this would navigate to the subscription/payment page
    router.push('/settings?tab=subscription')
  }

  const handleGoBack = () => {
    router.back()
  }

  // Show loading state
  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
          <CircularProgress />
        </Box>
      </Container>
    )
  }

  // User has access - show the protected content
  if (hasAccess) {
    return <>{children}</>
  }

  // No access and hide mode - should have been redirected, but show fallback
  if (enforcementMode === 'hide') {
    return null
  }

  // No access and upsell mode - show upgrade prompt
  const featureInfo = featureDetails[feature] || {
    icon: LockIcon,
    title: customUpsellTitle || 'Premium Feature',
    description: customUpsellDescription || 'This feature requires an upgraded subscription',
    benefits: []
  }

  const FeatureIcon = featureInfo.icon

  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <Box mb={3}>
        <Button
          startIcon={<BackIcon />}
          onClick={handleGoBack}
          color="primary"
        >
          Go Back
        </Button>
      </Box>

      <Card elevation={3}>
        <CardContent sx={{ p: 4 }}>
          <Box display="flex" alignItems="center" mb={3}>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                borderRadius: 2,
                bgcolor: 'primary.light',
                color: 'primary.main',
                mr: 3
              }}
            >
              <FeatureIcon sx={{ fontSize: 48 }} />
            </Paper>
            <Box flex={1}>
              <Typography variant="h4" gutterBottom>
                {featureInfo.title}
              </Typography>
              <Box display="flex" gap={1} alignItems="center">
                <Chip
                  icon={<LockIcon sx={{ fontSize: 16 }} />}
                  label="Premium Feature"
                  color="warning"
                  size="small"
                />
                <Chip
                  icon={<StarIcon sx={{ fontSize: 16 }} />}
                  label="Upgrade Required"
                  color="primary"
                  variant="outlined"
                  size="small"
                />
              </Box>
            </Box>
          </Box>

          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body1">
              {featureInfo.description}
            </Typography>
          </Alert>

          {featureInfo.benefits.length > 0 && (
            <>
              <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
                What's Included:
              </Typography>
              <List>
                {featureInfo.benefits.map((benefit, index) => (
                  <ListItem key={index} sx={{ py: 0.5 }}>
                    <ListItemIcon>
                      <CheckIcon color="success" />
                    </ListItemIcon>
                    <ListItemText primary={benefit} />
                  </ListItem>
                ))}
              </List>
            </>
          )}

          <Box mt={4} display="flex" gap={2} justifyContent="center">
            <Button
              variant="outlined"
              size="large"
              onClick={handleGoBack}
              startIcon={<BackIcon />}
            >
              Go Back
            </Button>
            <Button
              variant="contained"
              size="large"
              color="primary"
              onClick={handleUpgrade}
              startIcon={<UpgradeIcon />}
            >
              Upgrade Now
            </Button>
          </Box>

          <Box mt={3} textAlign="center">
            <Typography variant="body2" color="textSecondary">
              Unlock all premium features with PantryIQ Pro
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Container>
  )
}