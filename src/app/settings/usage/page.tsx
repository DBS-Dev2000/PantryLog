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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Avatar
} from '@mui/material'
import {
  ArrowBack as ArrowBackIcon,
  SmartToy as AIIcon,
  AttachMoney as MoneyIcon,
  TrendingUp as TrendingIcon,
  History as HistoryIcon,
  Visibility as EyeIcon,
  Receipt as ReceiptIcon
} from '@mui/icons-material'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface UsageSummary {
  today_cost: number
  today_requests: number
  month_cost: number
  month_requests: number
  total_cost: number
  total_requests: number
  monthly_limit_dollars: number
  daily_limit_dollars: number
  free_tier_requests: number
  free_tier_used: number
  subscription_plan: string
}

interface UsageRecord {
  id: string
  request_date: string
  api_provider: string
  request_type: string
  total_tokens: number
  total_cost: number
  success: boolean
  processing_time_ms?: number
}

export default function UsagePage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [usageSummary, setUsageSummary] = useState<UsageSummary | null>(null)
  const [recentUsage, setRecentUsage] = useState<UsageRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUser(session.user)
        await loadUsageData(session.user.id)
      } else {
        router.push('/auth')
      }
    }

    getUser()
  }, [router])

  const loadUsageData = async (userId: string) => {
    setLoading(true)
    try {
      // Load usage summary
      const { data: summary, error: summaryError } = await supabase
        .from('user_ai_usage_summary')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()

      if (summaryError && summaryError.code !== 'PGRST116') {
        throw summaryError
      }

      setUsageSummary(summary)

      // Load recent usage records
      const { data: usage, error: usageError } = await supabase
        .from('user_ai_usage')
        .select('*')
        .eq('user_id', userId)
        .order('request_date', { ascending: false })
        .limit(20)

      if (usageError && usageError.code !== 'PGRST116') {
        throw usageError
      }

      setRecentUsage(usage || [])

    } catch (err: any) {
      console.error('Error loading usage data:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const getUsagePercentage = (used: number, limit: number) => {
    return Math.min((used / limit) * 100, 100)
  }

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return 'error'
    if (percentage >= 75) return 'warning'
    return 'primary'
  }

  if (!user || loading) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Typography>Loading usage data...</Typography>
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

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Usage Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <MoneyIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">Today's Usage</Typography>
              </Box>
              <Typography variant="h4" color="primary.main">
                ${(usageSummary?.today_cost || 0).toFixed(4)}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {usageSummary?.today_requests || 0} AI requests
              </Typography>
              <LinearProgress
                variant="determinate"
                value={getUsagePercentage(usageSummary?.today_cost || 0, usageSummary?.daily_limit_dollars || 1)}
                color={getProgressColor(getUsagePercentage(usageSummary?.today_cost || 0, usageSummary?.daily_limit_dollars || 1)) as any}
                sx={{ mt: 1 }}
              />
              <Typography variant="caption" color="textSecondary">
                Daily limit: ${usageSummary?.daily_limit_dollars || 1}/day
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <TrendingIcon color="secondary" sx={{ mr: 1 }} />
                <Typography variant="h6">Monthly Usage</Typography>
              </Box>
              <Typography variant="h4" color="secondary.main">
                ${(usageSummary?.month_cost || 0).toFixed(2)}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {usageSummary?.month_requests || 0} AI requests
              </Typography>
              <LinearProgress
                variant="determinate"
                value={getUsagePercentage(usageSummary?.month_cost || 0, usageSummary?.monthly_limit_dollars || 5)}
                color={getProgressColor(getUsagePercentage(usageSummary?.month_cost || 0, usageSummary?.monthly_limit_dollars || 5)) as any}
                sx={{ mt: 1 }}
              />
              <Typography variant="caption" color="textSecondary">
                Monthly limit: ${usageSummary?.monthly_limit_dollars || 5}/month
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Free Tier Status */}
      {usageSummary?.subscription_plan === 'free' && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box display="flex" alignItems="center" mb={2}>
              <AIIcon color="success" sx={{ mr: 1 }} />
              <Typography variant="h6">Free Tier Status</Typography>
            </Box>
            <Box display="flex" alignItems="center" gap={2}>
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="body1">
                  {(usageSummary.free_tier_requests - usageSummary.free_tier_used)} free AI requests remaining
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={(usageSummary.free_tier_used / usageSummary.free_tier_requests) * 100}
                  color="success"
                  sx={{ mt: 1 }}
                />
                <Typography variant="caption" color="textSecondary">
                  {usageSummary.free_tier_used} of {usageSummary.free_tier_requests} used this month
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Recent Usage History */}
      <Card>
        <CardContent>
          <Box display="flex" alignItems="center" mb={2}>
            <HistoryIcon sx={{ mr: 1 }} />
            <Typography variant="h6">Recent AI Usage</Typography>
          </Box>

          {recentUsage.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <AIIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="body1" color="textSecondary">
                No AI usage recorded yet
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Try using AI Recognition or Receipt Scan features
              </Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Feature</TableCell>
                    <TableCell>Tokens</TableCell>
                    <TableCell>Cost</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recentUsage.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        <Typography variant="body2">
                          {new Date(record.request_date).toLocaleDateString()}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {new Date(record.request_date).toLocaleTimeString()}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          {record.request_type === 'item_recognition' ? (
                            <EyeIcon fontSize="small" />
                          ) : (
                            <ReceiptIcon fontSize="small" />
                          )}
                          <Typography variant="body2">
                            {record.request_type === 'item_recognition' ? 'AI Recognition' : 'Receipt Scan'}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {record.total_tokens.toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          ${record.total_cost.toFixed(4)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={record.success ? 'Success' : 'Failed'}
                          color={record.success ? 'success' : 'error'}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Billing Information */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            💳 Billing Information
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            Current plan: <strong>{usageSummary?.subscription_plan || 'Free'}</strong>
          </Typography>
          <Typography variant="body2" color="textSecondary">
            • <strong>Free Tier:</strong> {usageSummary?.free_tier_requests || 10} requests/month<br>
            • <strong>Daily Limit:</strong> ${usageSummary?.daily_limit_dollars || 1}/day<br>
            • <strong>Monthly Limit:</strong> ${usageSummary?.monthly_limit_dollars || 5}/month<br>
            • <strong>All-time Usage:</strong> ${(usageSummary?.total_cost || 0).toFixed(2)} ({usageSummary?.total_requests || 0} requests)
          </Typography>
        </CardContent>
      </Card>
    </Container>
  )
}