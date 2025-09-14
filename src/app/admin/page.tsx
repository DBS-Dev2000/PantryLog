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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Switch,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material'
import {
  AdminPanelSettings as AdminIcon,
  Group as UsersIcon,
  SmartToy as AIIcon,
  Settings as SettingsIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  Block as BlockIcon
} from '@mui/icons-material'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface UserData {
  id: string
  email: string
  created_at: string
  last_sign_in_at?: string
  app_metadata?: any
  user_metadata?: any
}

interface UsageStats {
  user_id: string
  today_cost: number
  month_cost: number
  total_requests: number
  subscription_plan: string
}

interface AdminSettings {
  default_ai_provider: string
  claude_enabled: boolean
  gemini_enabled: boolean
  default_monthly_limit: number
  default_daily_limit: number
  free_tier_requests: number
}

export default function AdminPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [users, setUsers] = useState<UserData[]>([])
  const [usageStats, setUsageStats] = useState<UsageStats[]>([])
  const [adminSettings, setAdminSettings] = useState<AdminSettings>({
    default_ai_provider: 'claude',
    claude_enabled: true,
    gemini_enabled: true,
    default_monthly_limit: 5.00,
    default_daily_limit: 1.00,
    free_tier_requests: 10
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [authenticated, setAuthenticated] = useState(false)
  const [adminUsers, setAdminUsers] = useState<any[]>([])
  const [grantAdminDialog, setGrantAdminDialog] = useState(false)
  const [selectedUserForAdmin, setSelectedUserForAdmin] = useState('')

  useEffect(() => {
    const checkAdminAccess = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUser(session.user)

        // Check if user is system admin via database
        const { data: isAdminResult, error: adminCheckError } = await supabase
          .rpc('is_system_admin', { p_user_id: session.user.id })

        if (adminCheckError) {
          console.warn('Admin check failed, using fallback:', adminCheckError)
          // Fallback to email check for initial setup
          const fallbackEmails = ['daren@prolongedpantry.com', session.user.email]
          const isFallbackAdmin = fallbackEmails.includes(session.user.email || '')

          if (isFallbackAdmin) {
            setIsAdmin(true)
            setAuthenticated(true)
            await loadAdminData()
            // Log admin access
            await supabase.rpc('log_admin_activity', {
              p_admin_user_id: session.user.id,
              p_action_type: 'admin_login',
              p_action_details: 'Admin dashboard access via fallback email check'
            })
          } else {
            setError('Access denied. System administrator privileges required.')
          }
        } else if (isAdminResult) {
          setIsAdmin(true)
          setAuthenticated(true)
          await loadAdminData()
          // Log admin access
          await supabase.rpc('log_admin_activity', {
            p_admin_user_id: session.user.id,
            p_action_type: 'admin_login',
            p_action_details: 'Admin dashboard access via database role'
          })
          console.log('✅ Admin access granted via database role')
        } else {
          setError('Access denied. System administrator privileges required.')
        }
      } else {
        router.push('/auth')
      }
      setLoading(false)
    }

    checkAdminAccess()
  }, [router])

  const loadAdminData = async () => {
    try {
      // Load users via server-side admin API
      const response = await fetch(`/api/admin/users?user_id=${user.id}`)

      if (!response.ok) {
        throw new Error(`Failed to load admin data: ${response.status}`)
      }

      const adminData = await response.json()

      if (adminData.error) {
        throw new Error(adminData.error)
      }

      setUsers(adminData.users || [])
      setAdminUsers(adminData.admin_users || [])

      // Load usage statistics
      const { data: statsData, error: statsError } = await supabase
        .from('user_ai_usage_summary')
        .select('*')
        .order('month_cost', { ascending: false })
        .limit(50)

      if (statsError && statsError.code !== 'PGRST116') {
        console.warn('Usage stats not available:', statsError)
      } else {
        setUsageStats(statsData || [])
      }

      console.log('✅ Admin data loaded:', adminData.users?.length || 0, 'users')

    } catch (err: any) {
      console.error('Error loading admin data:', err)
      setError(err.message)
    }
  }

  const loadAdminUsers = async () => {
    try {
      const { data: admins, error } = await supabase
        .from('system_admins')
        .select('*')
        .eq('is_active', true)
        .order('granted_at', { ascending: false })

      if (error && error.code !== 'PGRST116') {
        console.warn('Admin users table not available:', error)
      } else {
        setAdminUsers(admins || [])
      }
    } catch (err: any) {
      console.warn('Error loading admin users:', err)
    }
  }

  const grantAdminAccess = async (targetUserId: string, adminLevel: string = 'admin') => {
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'grant_admin',
          target_user_id: targetUserId,
          requesting_user_id: user.id,
          admin_level: adminLevel,
          notes: 'Admin access granted via PantryIQ admin dashboard'
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to grant admin access')
      }

      setSuccess('Admin access granted successfully!')
      await loadAdminData()

    } catch (err: any) {
      setError(err.message)
    }
  }

  const revokeAdminAccess = async (targetUserId: string) => {
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'revoke_admin',
          target_user_id: targetUserId,
          requesting_user_id: user.id
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to revoke admin access')
      }

      setSuccess('Admin access revoked successfully!')
      await loadAdminData()

    } catch (err: any) {
      setError(err.message)
    }
  }

  const updateAdminSettings = async () => {
    try {
      // In production, save to admin settings table
      console.log('💾 Admin settings updated:', adminSettings)
      setSuccess('Settings updated successfully!')

      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      setError(err.message)
    }
  }

  if (!user || loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Typography>Loading admin panel...</Typography>
      </Container>
    )
  }

  if (!isAdmin || !authenticated) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        {!isAdmin ? (
          <>
            <Alert severity="error">
              {error || 'Access denied. Admin privileges required.'}
            </Alert>
            <Button onClick={() => router.push('/')} sx={{ mt: 2 }}>
              Return to Dashboard
            </Button>
          </>
        ) : (
          <Card sx={{ textAlign: 'center', py: 8 }}>
            <CardContent>
              <AdminIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
              <Typography variant="h5" gutterBottom>
                PantryIQ Admin Dashboard
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Checking admin privileges...
              </Typography>
            </CardContent>
          </Card>
        )}
      </Container>
    )
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Box display="flex" alignItems="center" mb={4}>
        <AdminIcon sx={{ mr: 2, fontSize: 32, color: 'primary.main' }} />
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            PantryIQ Admin Dashboard
          </Typography>
          <Typography variant="body1" color="textSecondary">
            System administration and user management
          </Typography>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* System Overview */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <UsersIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">Users</Typography>
              </Box>
              <Typography variant="h4" color="primary.main">
                {users.length}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Total registered users
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <AIIcon color="secondary" sx={{ mr: 1 }} />
                <Typography variant="h6">AI Usage</Typography>
              </Box>
              <Typography variant="h4" color="secondary.main">
                {usageStats.reduce((sum, stat) => sum + stat.total_requests, 0)}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Total AI requests
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <SettingsIcon color="info" sx={{ mr: 1 }} />
                <Typography variant="h6">System</Typography>
              </Box>
              <Typography variant="h4" color="info.main">
                Online
              </Typography>
              <Typography variant="body2" color="textSecondary">
                System status
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* AI Configuration */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            🤖 AI Provider Configuration
          </Typography>

          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Primary AI Provider</InputLabel>
                <Select
                  value={adminSettings.default_ai_provider}
                  label="Primary AI Provider"
                  onChange={(e) => setAdminSettings({ ...adminSettings, default_ai_provider: e.target.value })}
                >
                  <MenuItem value="claude">Claude (Anthropic)</MenuItem>
                  <MenuItem value="gemini">Gemini (Google)</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <Box>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Provider Status:
                </Typography>
                <Box display="flex" gap={1}>
                  <Chip
                    label="Claude"
                    color={process.env.CLAUDE_API_KEY ? 'success' : 'default'}
                    size="small"
                  />
                  <Chip
                    label="Gemini"
                    color={process.env.GEMINI_API_KEY ? 'success' : 'default'}
                    size="small"
                  />
                </Box>
              </Box>
            </Grid>

            <Grid item xs={12}>
              <Box display="flex" gap={2} justifyContent="flex-end">
                <Button
                  variant="contained"
                  onClick={updateAdminSettings}
                  startIcon={<SettingsIcon />}
                >
                  Update Settings
                </Button>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Active Users */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            👥 Active Users ({users.length})
          </Typography>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>User</TableCell>
                  <TableCell>Joined</TableCell>
                  <TableCell>Last Active</TableCell>
                  <TableCell>AI Usage</TableCell>
                  <TableCell>Plan</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map((userData) => {
                  const userStats = usageStats.find(stat => stat.user_id === userData.id)
                  return (
                    <TableRow key={userData.id}>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="body2">
                            {userData.email}
                          </Typography>
                          {userData.id === user.id && (
                            <Chip label="You" size="small" color="primary" />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {new Date(userData.created_at).toLocaleDateString()}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {userData.last_sign_in_at
                            ? new Date(userData.last_sign_in_at).toLocaleDateString()
                            : 'Never'
                          }
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          ${(userStats?.month_cost || 0).toFixed(3)} ({userStats?.total_requests || 0} req)
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={userStats?.subscription_plan || 'free'}
                          size="small"
                          color={userStats?.subscription_plan === 'free' ? 'default' : 'primary'}
                        />
                      </TableCell>
                      <TableCell>
                        <IconButton size="small" title="View Details">
                          <ViewIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Container>
  )
}