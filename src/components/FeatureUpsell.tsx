'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Grid,
  Alert,
  IconButton
} from '@mui/material'
import {
  Close as CloseIcon,
  Upgrade as UpgradeIcon,
  Lock as LockIcon,
  Star as StarIcon,
  Kitchen as KitchenIcon
} from '@mui/icons-material'

interface FeatureUpsellProps {
  open: boolean
  onClose: () => void
  featureName: string
  featureIcon?: React.ReactNode
  description?: string
  benefits?: string[]
  suggestedPlan?: string
}

const featureDetails = {
  recipes: {
    title: 'Recipe Management',
    icon: '📝',
    description: 'Create, organize, and manage your recipe collection with AI-powered features.',
    benefits: [
      'Import recipes from websites and YouTube videos',
      'Scan handwritten recipe cards with AI',
      'Smart ingredient substitution suggestions',
      'Recipe availability checking based on your inventory',
      'Organized recipe collections with tags and categories'
    ],
    suggestedPlan: 'Premium',
    planPrice: '$4.99/month'
  },
  ai_features: {
    title: 'AI Features',
    icon: '🤖',
    description: 'Unlock the power of artificial intelligence for your kitchen management.',
    benefits: [
      'Visual item recognition - just take a photo',
      'AI-powered recipe extraction from photos',
      'Smart ingredient substitution suggestions',
      'Predictive shopping list generation',
      'Advanced meal planning assistance'
    ],
    suggestedPlan: 'Premium',
    planPrice: '$4.99/month'
  },
  shopping_list_sharing: {
    title: 'Shopping List Sharing',
    icon: '🛒',
    description: 'Collaborate with household members on shopping and meal planning.',
    benefits: [
      'Share shopping lists with all household members',
      'Real-time collaboration and updates',
      'Assign shopping tasks to different members',
      'Sync across all devices instantly',
      'Track who bought what and when'
    ],
    suggestedPlan: 'Premium',
    planPrice: '$4.99/month'
  },
  advanced_reporting: {
    title: 'Advanced Reporting',
    icon: '📊',
    description: 'Get detailed insights into your kitchen usage and food waste patterns.',
    benefits: [
      'Detailed consumption analytics',
      'Food waste tracking and reduction insights',
      'Cost analysis and budget optimization',
      'Expiration pattern analysis',
      'Custom reporting and data export'
    ],
    suggestedPlan: 'Pro',
    planPrice: '$9.99/month'
  }
}

export default function FeatureUpsell({
  open,
  onClose,
  featureName,
  featureIcon,
  description,
  benefits,
  suggestedPlan
}: FeatureUpsellProps) {
  const [upgradeLoading, setUpgradeLoading] = useState(false)

  const feature = featureDetails[featureName as keyof typeof featureDetails] || {
    title: featureName,
    icon: featureIcon || '🔒',
    description: description || 'This feature is not available with your current plan.',
    benefits: benefits || ['Unlock this feature with an upgrade'],
    suggestedPlan: suggestedPlan || 'Premium',
    planPrice: '$4.99/month'
  }

  const handleUpgrade = async () => {
    setUpgradeLoading(true)
    try {
      // TODO: Implement subscription upgrade flow
      console.log('🚀 Upgrade requested for feature:', featureName)

      // Simulate upgrade process
      await new Promise(resolve => setTimeout(resolve, 2000))

      // For now, just close the dialog
      onClose()
    } catch (error) {
      console.error('Upgrade error:', error)
    } finally {
      setUpgradeLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white'
        }
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box display="flex" alignItems="center" gap={2}>
            <Box sx={{ fontSize: '2rem' }}>{feature.icon}</Box>
            <Box>
              <Typography variant="h5" component="div" sx={{ fontWeight: 'bold' }}>
                {feature.title}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Upgrade to unlock this feature
              </Typography>
            </Box>
          </Box>
          <IconButton
            onClick={onClose}
            sx={{ color: 'white', opacity: 0.8, '&:hover': { opacity: 1 } }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pb: 3 }}>
        <Card sx={{ mb: 3, backgroundColor: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}>
          <CardContent>
            <Typography variant="body1" sx={{ mb: 2, color: 'white' }}>
              {feature.description}
            </Typography>

            <Typography variant="h6" gutterBottom sx={{ color: 'white', mb: 2 }}>
              ✨ What you'll get:
            </Typography>

            <Grid container spacing={1}>
              {feature.benefits.map((benefit, index) => (
                <Grid item xs={12} key={index}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <StarIcon sx={{ fontSize: 16, color: '#FFD700' }} />
                    <Typography variant="body2" sx={{ color: 'white' }}>
                      {benefit}
                    </Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>

        <Alert
          severity="info"
          sx={{
            backgroundColor: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            '& .MuiAlert-message': { color: 'white' }
          }}
        >
          <Typography variant="body2">
            This feature has been disabled by your household administrator.
            Contact your admin or upgrade to access this functionality.
          </Typography>
        </Alert>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button
          onClick={onClose}
          variant="outlined"
          sx={{
            color: 'white',
            borderColor: 'rgba(255,255,255,0.3)',
            '&:hover': {
              borderColor: 'white',
              backgroundColor: 'rgba(255,255,255,0.1)'
            }
          }}
        >
          Maybe Later
        </Button>
        <Button
          onClick={handleUpgrade}
          variant="contained"
          disabled={upgradeLoading}
          startIcon={upgradeLoading ? null : <UpgradeIcon />}
          sx={{
            backgroundColor: '#FFD700',
            color: '#000',
            fontWeight: 'bold',
            '&:hover': {
              backgroundColor: '#FFC107'
            }
          }}
        >
          {upgradeLoading ? 'Processing...' : `Upgrade to ${feature.suggestedPlan} ${feature.planPrice}`}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// Hook for easy feature checking in components
export function useFeatureAccess(featureName: string) {
  const [hasAccess, setHasAccess] = useState<boolean>(true)
  const [enforcementMode, setEnforcementMode] = useState<'show' | 'hide' | 'upsell'>('show')
  const [loading, setLoading] = useState(true)

  useState(() => {
    const checkAccess = async () => {
      try {
        const result = await shouldShowFeature(featureName)
        setEnforcementMode(result)
        setHasAccess(result === 'show')
      } catch (error) {
        console.error('Feature access check failed:', error)
        setHasAccess(true) // Fail open for better UX
      } finally {
        setLoading(false)
      }
    }

    checkAccess()
  })

  return { hasAccess, enforcementMode, loading }
}