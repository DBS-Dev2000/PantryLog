'use client'

import { useState, useEffect } from 'react'
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Button,
  Grid,
  Alert,
  LinearProgress,
  Chip
} from '@mui/material'
import {
  ArrowBack as ArrowBackIcon,
  SmartToy as AIIcon,
  AttachMoney as MoneyIcon,
  TrendingUp as TrendingIcon
} from '@mui/icons-material'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function UsagePage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUser(session.user)
      } else {
        router.push('/auth')
      }
      setLoading(false)
    }

    getUser()
  }, [router])

  if (!user || loading) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Typography>Loading...</Typography>
      </Container>
    )
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <Box display="flex" alignItems="center" mb={4}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push('/settings')}
          sx={{ mr: 2 }}
        >
          Back to Settings
        </Button>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            AI Usage & Billing
          </Typography>
          <Typography variant="body1" color="textSecondary">
            Monitor your AI-powered feature usage and costs
          </Typography>
        </Box>
      </Box>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            🤖 AI Features Coming Soon
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Comprehensive usage tracking and billing dashboard will be available once
            AI features are fully configured.
          </Typography>
          <Chip label="In Development" color="primary" sx={{ mt: 2 }} />
        </CardContent>
      </Card>
    </Container>
  )
}