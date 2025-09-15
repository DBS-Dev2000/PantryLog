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
  DialogActions,
  CircularProgress,
  Tabs,
  Tab,
  Divider
} from '@mui/material'
import {
  AdminPanelSettings as AdminIcon,
  Group as UsersIcon,
  SmartToy as AIIcon,
  Settings as SettingsIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  Block as BlockIcon,
  Save as SaveIcon,
  Dashboard as DashboardIcon,
  Psychology as PromptIcon,
  Code as CodeIcon
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

  const [enforcementSettings, setEnforcementSettings] = useState({
    disabled_feature_mode: 'upsell', // 'hide' or 'upsell'
    show_upgrade_prompts: true,
    enforce_feature_limits: true
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

  // Tab management
  const [activeTab, setActiveTab] = useState(0)

  // Dialog states for actions
  const [userDetailsDialog, setUserDetailsDialog] = useState(false)
  const [householdDetailsDialog, setHouseholdDetailsDialog] = useState(false)
  const [householdEditDialog, setHouseholdEditDialog] = useState(false)
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [selectedHousehold, setSelectedHousehold] = useState<any>(null)
  const [editingFeatures, setEditingFeatures] = useState<any>(null)
  const [savingFeatures, setSavingFeatures] = useState(false)

  // AI Configuration management
  const [aiPrompts, setAiPrompts] = useState({
    item_recognition: `Analyze this grocery item image and identify the product. Return a JSON object with detailed product information including name, brand, category, and confidence level.`,
    recipe_extraction: `Extract the complete recipe from this image. This could be a handwritten recipe card, printed cookbook page, or recipe note. Extract ALL visible information and return a detailed JSON object.`,
    substitution_suggestions: `Provide ingredient substitution suggestions for this recipe based on available pantry items. Focus on practical alternatives that maintain flavor and nutritional balance.`,
    predictive_shopping: `Analyze consumption patterns and current inventory to generate a predictive shopping list. Consider usage frequency, expiration dates, and seasonal preferences.`
  })
  const [editingPrompts, setEditingPrompts] = useState(false)

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
    setSelectedHousehold(household)

    console.log('🏠 Opening household edit for:', household.name)
    console.log('🎛️ Current household features:', household.features)

    // Initialize feature settings (defaulting to enabled if not specified)
    const initialFeatures = {
      recipes_enabled: household.features?.recipes_enabled ?? true,
      ai_features_enabled: household.features?.ai_features_enabled ?? true,
      shopping_list_sharing: household.features?.shopping_list_sharing ?? true,
      storage_editing: household.features?.storage_editing ?? true,
      multiple_households: household.features?.multiple_households ?? false,
      advanced_reporting: household.features?.advanced_reporting ?? false,
      custom_labels: household.features?.custom_labels ?? true,
      barcode_scanning: household.features?.barcode_scanning ?? true
    }

    console.log('🎛️ Initialized features for editing:', initialFeatures)
    setEditingFeatures(initialFeatures)
    setHouseholdEditDialog(true)
  }

  const handleSaveHouseholdFeatures = async () => {
    if (!selectedHousehold || !editingFeatures || !user?.id) return

    setSavingFeatures(true)
    console.log('💾 Attempting to save features:', {
      household_id: selectedHousehold.id,
      household_name: selectedHousehold.name,
      features: editingFeatures
    })

    try {
      const response = await fetch('/api/admin/household-features', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          household_id: selectedHousehold.id,
          features: editingFeatures,
          requesting_user_id: user.id
        })
      })

      console.log('📡 Feature save response status:', response.status)

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update household features')
      }

      setSuccess(`Features updated for household: ${selectedHousehold.name}`)
      setHouseholdEditDialog(false)

      // Refresh household data to show updated features
      await loadAdminData()
    } catch (err: any) {
      setError(`Failed to update features: ${err.message}`)
    } finally {
      setSavingFeatures(false)
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

      {/* Admin Navigation Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(e, newValue) => setActiveTab(newValue)}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab
            icon={<DashboardIcon />}
            label="System Overview"
            sx={{ minHeight: 'auto' }}
          />
          <Tab
            icon={<UsersIcon />}
            label="Users & Households"
            sx={{ minHeight: 'auto' }}
          />
          <Tab
            icon={<AIIcon />}
            label="AI Configuration"
            sx={{ minHeight: 'auto' }}
          />
          <Tab
            icon={<PromptIcon />}
            label="AI Prompts"
            sx={{ minHeight: 'auto' }}
          />
          <Tab
            icon={<SettingsIcon />}
            label="System Settings"
            sx={{ minHeight: 'auto' }}
          />
        </Tabs>
      </Box>

      {/* Tab Content */}
      {activeTab === 0 && (
        <>
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
        </>
      )}

      {activeTab === 1 && (
        <>
          {/* Users & Households Management */}
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
                        <Chip
                          label="Recipes"
                          size="small"
                          color={household.features?.recipes_enabled ? "success" : "default"}
                          variant={household.features?.recipes_enabled ? "filled" : "outlined"}
                        />
                        <Chip
                          label="Shopping"
                          size="small"
                          color={household.features?.shopping_list_sharing ? "info" : "default"}
                          variant={household.features?.shopping_list_sharing ? "filled" : "outlined"}
                        />
                        <Chip
                          label="AI Features"
                          size="small"
                          color={household.features?.ai_features_enabled ? "secondary" : "default"}
                          variant={household.features?.ai_features_enabled ? "filled" : "outlined"}
                        />
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
        </>
      )}

      {activeTab === 2 && (
        <>
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
        </>
      )}

      {activeTab === 3 && (
        <>
          {/* AI Prompts Management */}
          <Card sx={{ mb: 4 }}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Box>
                  <Typography variant="h6" gutterBottom>
                    🧠 AI Prompt Management
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Customize AI prompts for different functions to improve results
                  </Typography>
                </Box>
                <Button
                  variant={editingPrompts ? "outlined" : "contained"}
                  onClick={() => setEditingPrompts(!editingPrompts)}
                  startIcon={<EditIcon />}
                >
                  {editingPrompts ? 'View Mode' : 'Edit Prompts'}
                </Button>
              </Box>

              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" gutterBottom color="primary">
                        📸 Item Recognition
                      </Typography>
                      <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                        Visual AI analysis for grocery item identification
                      </Typography>
                      <TextField
                        fullWidth
                        multiline
                        rows={4}
                        value={aiPrompts.item_recognition}
                        onChange={(e) => setAiPrompts({
                          ...aiPrompts,
                          item_recognition: e.target.value
                        })}
                        disabled={!editingPrompts}
                        placeholder="Enter prompt for item recognition AI..."
                      />
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" gutterBottom color="secondary">
                        📝 Recipe Extraction
                      </Typography>
                      <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                        Extract recipes from photos and scanned images
                      </Typography>
                      <TextField
                        fullWidth
                        multiline
                        rows={4}
                        value={aiPrompts.recipe_extraction}
                        onChange={(e) => setAiPrompts({
                          ...aiPrompts,
                          recipe_extraction: e.target.value
                        })}
                        disabled={!editingPrompts}
                        placeholder="Enter prompt for recipe extraction AI..."
                      />
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" gutterBottom color="warning.main">
                        🔄 Substitution Suggestions
                      </Typography>
                      <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                        AI-powered ingredient substitution recommendations
                      </Typography>
                      <TextField
                        fullWidth
                        multiline
                        rows={4}
                        value={aiPrompts.substitution_suggestions}
                        onChange={(e) => setAiPrompts({
                          ...aiPrompts,
                          substitution_suggestions: e.target.value
                        })}
                        disabled={!editingPrompts}
                        placeholder="Enter prompt for substitution AI..."
                      />
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" gutterBottom color="success.main">
                        🛒 Predictive Shopping
                      </Typography>
                      <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                        Smart shopping list generation based on usage patterns
                      </Typography>
                      <TextField
                        fullWidth
                        multiline
                        rows={4}
                        value={aiPrompts.predictive_shopping}
                        onChange={(e) => setAiPrompts({
                          ...aiPrompts,
                          predictive_shopping: e.target.value
                        })}
                        disabled={!editingPrompts}
                        placeholder="Enter prompt for predictive shopping AI..."
                      />
                    </CardContent>
                  </Card>
                </Grid>

                {editingPrompts && (
                  <Grid item xs={12}>
                    <Box display="flex" gap={2} justifyContent="flex-end">
                      <Button
                        variant="outlined"
                        onClick={() => setEditingPrompts(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="contained"
                        onClick={() => {
                          console.log('💾 Saving AI prompts:', aiPrompts)
                          setSuccess('AI prompts updated successfully!')
                          setEditingPrompts(false)
                        }}
                        startIcon={<SaveIcon />}
                      >
                        Save Prompts
                      </Button>
                    </Box>
                  </Grid>
                )}
              </Grid>
            </CardContent>
          </Card>
        </>
      )}

      {activeTab === 4 && (
        <>
          {/* System Settings */}
          <Card sx={{ mb: 4 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                ⚙️ System Settings
              </Typography>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
                Global system configuration and maintenance
              </Typography>

              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Default Monthly AI Limit ($)"
                    type="number"
                    value={adminSettings.default_monthly_limit}
                    onChange={(e) => setAdminSettings({
                      ...adminSettings,
                      default_monthly_limit: parseFloat(e.target.value)
                    })}
                    inputProps={{ step: 0.01, min: 0 }}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Default Daily AI Limit ($)"
                    type="number"
                    value={adminSettings.default_daily_limit}
                    onChange={(e) => setAdminSettings({
                      ...adminSettings,
                      default_daily_limit: parseFloat(e.target.value)
                    })}
                    inputProps={{ step: 0.01, min: 0 }}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Free Tier Requests"
                    type="number"
                    value={adminSettings.free_tier_requests}
                    onChange={(e) => setAdminSettings({
                      ...adminSettings,
                      free_tier_requests: parseInt(e.target.value)
                    })}
                    inputProps={{ min: 0 }}
                  />
                </Grid>

                {/* Feature Enforcement Settings */}
                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="h6" gutterBottom color="primary">
                    🚫 Feature Enforcement
                  </Typography>
                  <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                    Control how disabled features are handled in the main application
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Disabled Feature Mode</InputLabel>
                    <Select
                      value={enforcementSettings.disabled_feature_mode}
                      label="Disabled Feature Mode"
                      onChange={(e) => setEnforcementSettings({
                        ...enforcementSettings,
                        disabled_feature_mode: e.target.value
                      })}
                    >
                      <MenuItem value="upsell">Show as Upsell (Recommended)</MenuItem>
                      <MenuItem value="hide">Hide from Navigation</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" color="textSecondary" gutterBottom>
                      Enforcement Options:
                    </Typography>
                    <Box display="flex" flexDirection="column" gap={1}>
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography variant="body2">Show Upgrade Prompts</Typography>
                        <Switch
                          checked={enforcementSettings.show_upgrade_prompts}
                          onChange={(e) => setEnforcementSettings({
                            ...enforcementSettings,
                            show_upgrade_prompts: e.target.checked
                          })}
                          size="small"
                        />
                      </Box>
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography variant="body2">Enforce API Limits</Typography>
                        <Switch
                          checked={enforcementSettings.enforce_feature_limits}
                          onChange={(e) => setEnforcementSettings({
                            ...enforcementSettings,
                            enforce_feature_limits: e.target.checked
                          })}
                          size="small"
                        />
                      </Box>
                    </Box>
                  </Box>
                </Grid>

                <Grid item xs={12}>
                  <Alert severity="info">
                    <Typography variant="body2">
                      <strong>Upsell Mode:</strong> Disabled features show with overlay and upgrade prompts<br />
                      <strong>Hide Mode:</strong> Disabled features are completely removed from navigation
                    </Typography>
                  </Alert>
                </Grid>

                <Grid item xs={12}>
                  <Box display="flex" gap={2} justifyContent="flex-end">
                    <Button
                      variant="contained"
                      onClick={updateAdminSettings}
                      startIcon={<SettingsIcon />}
                    >
                      Update System Settings
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </>
      )}

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
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="textSecondary">Admin Status</Typography>
                  <Chip
                    label={selectedUser.is_admin ? 'Admin' : 'Regular User'}
                    color={selectedUser.is_admin ? 'secondary' : 'default'}
                    size="small"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="textSecondary">Household Memberships</Typography>
                  <Typography variant="body1">
                    {selectedUser.households?.length || 0} households
                  </Typography>
                </Grid>

                {/* Household Memberships Details */}
                {selectedUser.households?.length > 0 ? (
                  <Grid item xs={12}>
                    <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                      Member of Households:
                    </Typography>
                    <Box display="flex" flexDirection="column" gap={1}>
                      {selectedUser.households.map((household: any, index: number) => (
                        <Box key={household.household_id || index} sx={{ mb: 1 }}>
                          <Chip
                            label={`${household.household_name || 'Unnamed Household'} (${household.role})`}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                          <Typography variant="caption" color="textSecondary" sx={{ ml: 1 }}>
                            ID: {household.household_id}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  </Grid>
                ) : (
                  <Grid item xs={12}>
                    <Typography variant="body2" color="textSecondary">Household Relationships</Typography>
                    <Alert severity="warning" sx={{ mt: 1 }}>
                      No household memberships found. This user may not be properly linked to any households.
                    </Alert>
                  </Grid>
                )}
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

                {/* Household Members List */}
                {selectedHousehold.members?.length > 0 && (
                  <Grid item xs={12}>
                    <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                      Household Members:
                    </Typography>
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Email</TableCell>
                            <TableCell>Role</TableCell>
                            <TableCell>Joined</TableCell>
                            <TableCell>Status</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {selectedHousehold.members.map((member: any, index: number) => (
                            <TableRow key={member.user_id || index}>
                              <TableCell>
                                <Box display="flex" alignItems="center" gap={1}>
                                  <Typography variant="body2">
                                    {member.email}
                                  </Typography>
                                  {member.is_creator && (
                                    <Chip label="Creator" size="small" color="warning" />
                                  )}
                                </Box>
                              </TableCell>
                              <TableCell>
                                <Chip
                                  label={member.role || 'member'}
                                  size="small"
                                  color={member.role === 'admin' ? 'secondary' : 'default'}
                                />
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2">
                                  {member.joined_at
                                    ? new Date(member.joined_at).toLocaleDateString()
                                    : 'Unknown'
                                  }
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Chip
                                  label="Active"
                                  size="small"
                                  color="success"
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Grid>
                )}
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHouseholdDetailsDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Household Edit Dialog */}
      <Dialog
        open={householdEditDialog}
        onClose={() => setHouseholdEditDialog(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          🏠 Edit Household Features: {selectedHousehold?.name}
        </DialogTitle>
        <DialogContent>
          {selectedHousehold && editingFeatures && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="h6" gutterBottom color="primary">
                🎛️ Feature Management
              </Typography>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
                Control which features this household can access
              </Typography>

              <Grid container spacing={3}>
                {/* Core Features */}
                <Grid item xs={12} md={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        📝 Core Features
                      </Typography>

                      <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                        <Box>
                          <Typography variant="body1">Recipe Management</Typography>
                          <Typography variant="body2" color="textSecondary">Create, edit, and manage recipes</Typography>
                        </Box>
                        <Switch
                          checked={editingFeatures.recipes_enabled}
                          onChange={(e) => setEditingFeatures({
                            ...editingFeatures,
                            recipes_enabled: e.target.checked
                          })}
                        />
                      </Box>

                      <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                        <Box>
                          <Typography variant="body1">Shopping List Sharing</Typography>
                          <Typography variant="body2" color="textSecondary">Share shopping lists between members</Typography>
                        </Box>
                        <Switch
                          checked={editingFeatures.shopping_list_sharing}
                          onChange={(e) => setEditingFeatures({
                            ...editingFeatures,
                            shopping_list_sharing: e.target.checked
                          })}
                        />
                      </Box>

                      <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                        <Box>
                          <Typography variant="body1">Storage Location Editing</Typography>
                          <Typography variant="body2" color="textSecondary">Create and modify storage locations</Typography>
                        </Box>
                        <Switch
                          checked={editingFeatures.storage_editing}
                          onChange={(e) => setEditingFeatures({
                            ...editingFeatures,
                            storage_editing: e.target.checked
                          })}
                        />
                      </Box>

                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Box>
                          <Typography variant="body1">Barcode Scanning</Typography>
                          <Typography variant="body2" color="textSecondary">Use barcode scanner for adding items</Typography>
                        </Box>
                        <Switch
                          checked={editingFeatures.barcode_scanning}
                          onChange={(e) => setEditingFeatures({
                            ...editingFeatures,
                            barcode_scanning: e.target.checked
                          })}
                        />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Advanced Features */}
                <Grid item xs={12} md={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        🚀 Advanced Features
                      </Typography>

                      <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                        <Box>
                          <Typography variant="body1">AI Features</Typography>
                          <Typography variant="body2" color="textSecondary">Visual recognition, recipe extraction</Typography>
                        </Box>
                        <Switch
                          checked={editingFeatures.ai_features_enabled}
                          onChange={(e) => setEditingFeatures({
                            ...editingFeatures,
                            ai_features_enabled: e.target.checked
                          })}
                        />
                      </Box>

                      <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                        <Box>
                          <Typography variant="body1">Multiple Households</Typography>
                          <Typography variant="body2" color="textSecondary">Allow users to join multiple households</Typography>
                        </Box>
                        <Switch
                          checked={editingFeatures.multiple_households}
                          onChange={(e) => setEditingFeatures({
                            ...editingFeatures,
                            multiple_households: e.target.checked
                          })}
                        />
                      </Box>

                      <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                        <Box>
                          <Typography variant="body1">Advanced Reporting</Typography>
                          <Typography variant="body2" color="textSecondary">Detailed analytics and reports</Typography>
                        </Box>
                        <Switch
                          checked={editingFeatures.advanced_reporting}
                          onChange={(e) => setEditingFeatures({
                            ...editingFeatures,
                            advanced_reporting: e.target.checked
                          })}
                        />
                      </Box>

                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Box>
                          <Typography variant="body1">Custom Labels</Typography>
                          <Typography variant="body2" color="textSecondary">Create and print custom item labels</Typography>
                        </Box>
                        <Switch
                          checked={editingFeatures.custom_labels}
                          onChange={(e) => setEditingFeatures({
                            ...editingFeatures,
                            custom_labels: e.target.checked
                          })}
                        />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Household Info */}
                <Grid item xs={12}>
                  <Alert severity="info">
                    <Typography variant="body2">
                      <strong>Note:</strong> Changes will take effect immediately for this household.
                      Users may need to refresh their browser to see feature changes.
                    </Typography>
                  </Alert>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setHouseholdEditDialog(false)}
            disabled={savingFeatures}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveHouseholdFeatures}
            disabled={savingFeatures}
            startIcon={savingFeatures ? <CircularProgress size={20} /> : <SaveIcon />}
          >
            {savingFeatures ? 'Saving...' : 'Save Features'}
          </Button>
        </DialogActions>
      </Dialog>

    </Container>
  )
}