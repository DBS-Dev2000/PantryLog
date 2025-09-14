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
  Alert
} from '@mui/material'
import {
  Kitchen as PantryIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  Restaurant as RecipeIcon,
  List as ListIcon
} from '@mui/icons-material'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function HomePage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user)
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
            <CardContent sx={{ textAlign: 'center', py: 3 }}>
              <AddIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
              <Typography variant="h6" gutterBottom>
                Stock Up
              </Typography>
              <Button
                variant="contained"
                fullWidth
                size="large"
                color="primary"
                onClick={() => router.push('/inventory/quick-add')}
              >
                Stock Up
              </Button>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ textAlign: 'center', py: 3 }}>
              <RemoveIcon sx={{ fontSize: 48, color: 'secondary.main', mb: 1 }} />
              <Typography variant="h6" gutterBottom>
                Grab & Go
              </Typography>
              <Button
                variant="contained"
                fullWidth
                size="large"
                color="secondary"
                onClick={() => router.push('/inventory/quick-use')}
              >
                Grab & Go
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Secondary Actions */}
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
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

        <Grid item xs={12} sm={6}>
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
    </Container>
  )
}