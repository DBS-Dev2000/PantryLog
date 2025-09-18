'use client'

import { useState, useEffect } from 'react'
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Grid,
  Button,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material'
import {
  Kitchen as PantryIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  Restaurant as RecipeIcon,
  List as ListIcon,
  CalendarMonth as CalendarIcon
} from '@mui/icons-material'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getUserHouseholdFeatures } from '@/lib/features'

export default function HomePage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [features, setFeatures] = useState<any>(null)
  const [upsellDialog, setUpsellDialog] = useState(false)

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user)

      // Load feature permissions
      if (session?.user) {
        const permissions = await getUserHouseholdFeatures(session.user.id)
        setFeatures(permissions)
      }

      setLoading(false)
    }

    getSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Typography>Loading...</Typography>
      </Container>
    )
  }

  if (!user) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Box textAlign="center" sx={{ mb: 4 }}>
          <Typography variant="h2" component="h1" gutterBottom>
            PantryLog
          </Typography>
          <Typography variant="h5" color="textSecondary" gutterBottom>
            Smart Inventory Management for Your Kitchen
          </Typography>
          <Typography variant="body1" sx={{ mb: 4 }}>
            Track food items, manage expiration dates, and reduce waste with our comprehensive inventory system.
          </Typography>
          <Button
            variant="contained"
            size="large"
            onClick={() => router.push('/auth')}
          >
            Get Started
          </Button>
        </Box>
      </Container>
    )
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Welcome to PantryIQ
        </Typography>
        <Typography variant="body1" color="textSecondary">
          Where modern efficiency meets traditional preparedness. Smart inventory management evolved.
        </Typography>
      </Box>


      {/* Primary Actions - Mobile First */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 2 }}>
              <Button
                variant="contained"
                fullWidth
                size="large"
                color="primary"
                onClick={() => router.push('/inventory/quick-add')}
                sx={{
                  py: 4,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1,
                  fontSize: '1.1rem',
                  fontWeight: 'bold'
                }}
              >
                <AddIcon sx={{ fontSize: 60 }} />
                Stock Up
              </Button>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 2 }}>
              <Button
                variant="contained"
                fullWidth
                size="large"
                color="secondary"
                onClick={() => router.push('/inventory/quick-use')}
                sx={{
                  py: 4,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1,
                  fontSize: '1.1rem',
                  fontWeight: 'bold'
                }}
              >
                <RemoveIcon sx={{ fontSize: 60 }} />
                Grab & Go
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Secondary Actions */}
      <Grid container spacing={2}>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <CalendarIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">Meal Planner</Typography>
              </Box>
              <Typography variant="body2" color="textSecondary" paragraph>
                AI-powered weekly meal planning
              </Typography>
              <Button
                variant="outlined"
                fullWidth
                onClick={() => {
                  if (features?.meal_planner_enabled) {
                    router.push('/meal-planner')
                  } else {
                    setUpsellDialog(true)
                  }
                }}
                disabled={features?.enforcement_mode === 'hide' && !features?.meal_planner_enabled}
              >
                {features?.meal_planner_enabled ? 'Plan Meals' : 'Upgrade to Plan Meals'}
              </Button>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <RecipeIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">Recipes</Typography>
              </Box>
              <Typography variant="body2" color="textSecondary" paragraph>
                Find recipes based on available ingredients
              </Typography>
              <Button variant="outlined" fullWidth onClick={() => router.push('/recipes')}>
                View Recipes
              </Button>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <PantryIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">My Pantry</Typography>
              </Box>
              <Typography variant="body2" color="textSecondary" paragraph>
                View and manage all your stored items
              </Typography>
              <Button variant="outlined" fullWidth onClick={() => router.push('/inventory')}>
                View My Pantry
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Meal Planner Upsell Dialog */}
      <Dialog
        open={upsellDialog}
        onClose={() => setUpsellDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center">
            <CalendarIcon color="primary" sx={{ mr: 1 }} />
            Unlock AI-Powered Meal Planning
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography paragraph>
            Transform your kitchen efficiency with our intelligent meal planning system!
          </Typography>
          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
            Premium Features Include:
          </Typography>
          <Box component="ul" sx={{ pl: 2 }}>
            <li>
              <Typography variant="body2">
                <strong>AI-Generated Meal Plans</strong> - Personalized weekly menus based on your household preferences
              </Typography>
            </li>
            <li>
              <Typography variant="body2">
                <strong>Dietary Management</strong> - Track allergies, restrictions, and nutritional goals for each family member
              </Typography>
            </li>
            <li>
              <Typography variant="body2">
                <strong>Smart Recipe Rotation</strong> - Avoid meal fatigue with intelligent variety algorithms
              </Typography>
            </li>
            <li>
              <Typography variant="body2">
                <strong>Inventory Integration</strong> - Plans that use what you have and reduce waste
              </Typography>
            </li>
            <li>
              <Typography variant="body2">
                <strong>Shopping List Generation</strong> - Automated lists organized by store layout
              </Typography>
            </li>
            <li>
              <Typography variant="body2">
                <strong>Time-Based Planning</strong> - Quick weeknight meals, elaborate weekend dishes
              </Typography>
            </li>
          </Box>
          <Alert severity="info" sx={{ mt: 2 }}>
            Upgrade to <strong>PantryIQ Premium</strong> to unlock meal planning and save hours every week!
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUpsellDialog(false)}>
            Maybe Later
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => {
              // TODO: Implement subscription upgrade flow
              setUpsellDialog(false)
            }}
          >
            Upgrade to Premium
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}