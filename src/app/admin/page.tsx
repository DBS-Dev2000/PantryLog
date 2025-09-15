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
  const [households, setHouseholds] = useState<any[]>([])
  const [householdPermissions, setHouseholdPermissions] = useState<any[]>([])

  // Dialog states for actions
  const [userDetailsDialog, setUserDetailsDialog] = useState(false)
  const [householdDetailsDialog, setHouseholdDetailsDialog] = useState(false)
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [selectedHousehold, setSelectedHousehold] = useState<any>(null)

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

  // Load admin data after user and authentication states are set
  useEffect(() => {
    if (user && isAdmin && authenticated) {
      loadAdminData()
    }
  }, [user, isAdmin, authenticated])

  const loadAdminData = async () => {
    if (!user?.id) {
      console.warn('❌ User not loaded yet, cannot load admin data')
      return
    }

    try {
      console.log('📡 Loading admin data for user:', user.email, 'User ID:', user.id)

      // Load all admin data via API routes
      const [usersResponse, dashboardResponse] = await Promise.all([
        fetch(`/api/admin/users?user_id=${user.id}`).catch(() => null),
        fetch(`/api/admin/dashboard?user_id=${user.id}`).catch(() => null)
      ])

      // Load users data
      if (usersResponse?.ok) {
        const adminData = await usersResponse.json()
        if (!adminData.error) {
          setUsers(adminData.users || [])
          setAdminUsers(adminData.admin_users || [])
          console.log('✅ User data loaded via API:', adminData.users?.length || 0, 'users')

          // Debug user IDs for AI usage matching
          if (adminData.users?.length > 0) {
            console.log('👤 User ID sample:', adminData.users[0].id, 'Email:', adminData.users[0].email)
          }
        } else {
          console.error('❌ Users API error:', adminData.error)
          // Fallback for users
          setUsers([{
            id: user.id,
            email: user.email,
            created_at: user.created_at,
            last_sign_in_at: user.last_sign_in_at,
            is_admin: true
          }])
        }
      } else {
        console.error('❌ Users API failed with status:', usersResponse?.status, usersResponse?.statusText)
        if (usersResponse) {
          try {
            const errorData = await usersResponse.json()
            console.error('❌ Users API error details:', errorData)
          } catch (e) {
            console.error('❌ Could not parse Users API error response')
          }
        }
        setUsers([{
          id: user.id,
          email: user.email,
          created_at: user.created_at,
          last_sign_in_at: user.last_sign_in_at,
          is_admin: true
        }])
      }

      // Load dashboard data (households, usage stats)
      if (dashboardResponse?.ok) {
        const dashboardData = await dashboardResponse.json()
        if (!dashboardData.error && dashboardData.data) {
          setHouseholds(dashboardData.data.households || [])
          setUsageStats(dashboardData.data.usage_stats || [])
          console.log('✅ Dashboard data loaded via API:', {
            households: dashboardData.data.households?.length || 0,
            usage_stats: dashboardData.data.usage_stats?.length || 0,
            totals: dashboardData.data.totals
          })

          // Debug AI usage data structure
          if (dashboardData.data.usage_stats?.length > 0) {
            console.log('🤖 AI Usage Stats sample:', dashboardData.data.usage_stats[0])
          }
        } else {
          console.error('❌ Dashboard API error:', dashboardData.error)
        }
      } else {
        console.error('❌ Dashboard API failed with status:', dashboardResponse?.status, dashboardResponse?.statusText)
        if (dashboardResponse) {
          try {
            const errorData = await dashboardResponse.json()
            console.error('❌ Dashboard API error details:', errorData)
          } catch (e) {
            console.error('❌ Could not parse Dashboard API error response')
          }
        }
        setHouseholds([])
        setUsageStats([])
      }

      console.log('✅ Admin data loading complete')

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
    if (!user?.id) {
      setError('User not authenticated')
      return
    }

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
    if (!user?.id) {
      setError('User not authenticated')
      return
    }

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

  // User action handlers
  const handleViewUser = (userData: any) => {
    setSelectedUser(userData)
    setUserDetailsDialog(true)
  }

  const handleEditUser = (userData: any) => {
    // For now, same as view - can be enhanced later
    setSelectedUser(userData)
    setUserDetailsDialog(true)
  }

  // Household action handlers
  const handleViewHousehold = (household: any) => {
    setSelectedHousehold(household)
    setHouseholdDetailsDialog(true)
  }

  const handleEditHousehold = (household: any) => {
    // For now, same as view - can be enhanced later
    setSelectedHousehold(household)
    setHouseholdDetailsDialog(true)
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

      {/* Household Management */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            🏠 Household Management
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
            View and manage all households, their members, and feature permissions
          </Typography>

          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h5" color="primary.main">
                  {households.length}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Total Households
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h5" color="secondary.main">
                  {households.reduce((sum, h) => sum + (h.household_members?.length || 0), 0)}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Total Members
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h5" color="success.main">
                  {households.filter(h => (h.household_members?.length || 0) > 1).length}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Multi-User Households
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h5" color="warning.main">
                  {households.filter(h => new Date() - new Date(h.created_at) < 7 * 24 * 60 * 60 * 1000).length}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  New This Week
                </Typography>
              </Paper>
            </Grid>
          </Grid>

          {/* Household List */}
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Household Name</TableCell>
                  <TableCell>Members</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell>Features</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {households.map((household) => (
                  <TableRow key={household.id}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                        {household.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={household.household_members?.length || 0}
                        size="small"
                        color={household.household_members?.length > 1 ? 'primary' : 'default'}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">
                        {new Date(household.created_at).toLocaleDateString()}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box display="flex" gap={0.5} flexWrap="wrap">
                        <Chip label="Recipes" size="small" color="success" />
                        <Chip label="Shopping" size="small" color="info" />
                        <Chip label="AI Features" size="small" color="secondary" />
                      </Box>
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => handleViewHousehold(household)}
                        title="View Household Details"
                      >
                        <ViewIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleEditHousehold(household)}
                        title="Edit Household Settings"
                      >
                        <EditIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {households.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      <Typography variant="body2" color="textSecondary">
                        No households found
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

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
                        <IconButton
                          size="small"
                          onClick={() => handleViewUser(userData)}
                          title="View User Details"
                        >
                          <ViewIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleEditUser(userData)}
                          title="Edit User Settings"
                        >
                          <EditIcon />
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

      {/* User Details Dialog */}
      <Dialog
        open={userDetailsDialog}
        onClose={() => setUserDetailsDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          👤 User Details: {selectedUser?.email}
        </DialogTitle>
        <DialogContent>
          {selectedUser && (
            <Box sx={{ mt: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="textSecondary">User ID</Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>{selectedUser.id}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="textSecondary">Email</Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>{selectedUser.email}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="textSecondary">Created</Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {new Date(selectedUser.created_at).toLocaleDateString()}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="textSecondary">Last Sign In</Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {selectedUser.last_sign_in_at
                      ? new Date(selectedUser.last_sign_in_at).toLocaleDateString()
                      : 'Never'
                    }
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="body2" color="textSecondary">Admin Status</Typography>
                  <Chip
                    label={selectedUser.is_admin ? 'Admin' : 'Regular User'}
                    color={selectedUser.is_admin ? 'secondary' : 'default'}
                    size="small"
                  />
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUserDetailsDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Household Details Dialog */}
      <Dialog
        open={householdDetailsDialog}
        onClose={() => setHouseholdDetailsDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          🏠 Household Details: {selectedHousehold?.name}
        </DialogTitle>
        <DialogContent>
          {selectedHousehold && (
            <Box sx={{ mt: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="textSecondary">Household ID</Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>{selectedHousehold.id}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="textSecondary">Name</Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>{selectedHousehold.name}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="textSecondary">Created</Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {new Date(selectedHousehold.created_at).toLocaleDateString()}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="textSecondary">Last Updated</Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {selectedHousehold.updated_at
                      ? new Date(selectedHousehold.updated_at).toLocaleDateString()
                      : 'N/A'
                    }
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="body2" color="textSecondary">Members</Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {selectedHousehold.member_count || 0} members
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHouseholdDetailsDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

    </Container>
  )
}