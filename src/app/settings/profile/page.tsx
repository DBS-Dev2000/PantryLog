'use client'

import { useState, useEffect } from 'react'
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Button,
  TextField,
  Grid,
  Alert,
  Avatar,
  IconButton,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material'
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Edit as EditIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Store as StoreIcon,
  Receipt as ReceiptIcon,
  CreditCard as CreditCardIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  Link as LinkIcon,
  Home as HomeIcon,
  Star as StarIcon,
  PersonAdd as PersonAddIcon,
  Settings as SettingsIcon
} from '@mui/icons-material'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useHousehold } from '@/contexts/HouseholdContext'

interface UserProfile {
  id: string
  email: string
  display_name?: string
  phone?: string
  preferred_units: string
  budget_tracking: boolean
  receipt_auto_import: boolean
  created_at: string
  last_login?: string
}

interface StoreConnection {
  id: string
  store_name: string
  account_type: string
  connection_status: string
  last_sync?: string
}

const unitPreferences = [
  { value: 'metric', label: 'Metric (kg, g, liters)' },
  { value: 'imperial', label: 'Imperial (lbs, oz, cups)' },
  { value: 'mixed', label: 'Mixed (best for each item)' }
]

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<Partial<UserProfile>>({})
  const [storeConnections, setStoreConnections] = useState<StoreConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [newHouseholdName, setNewHouseholdName] = useState('')
  const [creatingHousehold, setCreatingHousehold] = useState(false)
  const { households, currentHousehold, setDefaultHousehold, refreshHouseholds } = useHousehold()

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUser(session.user)
        await loadProfileData(session.user)
      } else {
        router.push('/auth')
      }
    }

    getUser()
  }, [router])

  const loadProfileData = async (currentUser: any) => {
    setLoading(true)
    try {
      // Load profile from user metadata or create default
      const profileData: Partial<UserProfile> = {
        id: currentUser.id,
        email: currentUser.email,
        display_name: currentUser.user_metadata?.display_name || '',
        phone: currentUser.user_metadata?.phone || '',
        preferred_units: currentUser.user_metadata?.preferred_units || 'mixed',
        budget_tracking: currentUser.user_metadata?.budget_tracking || false,
        receipt_auto_import: currentUser.user_metadata?.receipt_auto_import || false,
        created_at: currentUser.created_at,
        last_login: currentUser.last_sign_in_at
      }

      setProfile(profileData)

      // Load store connections (placeholder for future)
      // This will be replaced with actual store API connections
      setStoreConnections([
        // Example data structure for future implementation
      ])

    } catch (err: any) {
      console.error('Error loading profile:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveProfile = async () => {
    if (!user) return

    setSaving(true)
    setError(null)

    try {
      // Update user metadata in Supabase Auth
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          display_name: profile.display_name,
          phone: profile.phone,
          preferred_units: profile.preferred_units,
          budget_tracking: profile.budget_tracking,
          receipt_auto_import: profile.receipt_auto_import
        }
      })

      if (updateError) throw updateError

      setSuccess('Profile updated successfully!')

      // Reload user data
      setTimeout(() => {
        setSuccess(null)
      }, 3000)

    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleCreateHousehold = async () => {
    if (!user || !newHouseholdName.trim()) return

    setCreatingHousehold(true)
    setError(null)

    try {
      // Create new household
      const { data: household, error: householdError } = await supabase
        .from('households')
        .insert([{ name: newHouseholdName.trim() }])
        .select()
        .single()

      if (householdError) throw householdError

      // Add user as admin of the new household
      const { error: memberError } = await supabase
        .from('household_members')
        .insert([{
          household_id: household.id,
          user_id: user.id,
          role: 'admin'
        }])

      if (memberError) throw memberError

      setSuccess(`Household "${newHouseholdName}" created successfully!`)
      setNewHouseholdName('')
      await refreshHouseholds()

      setTimeout(() => {
        setSuccess(null)
      }, 3000)

    } catch (err: any) {
      setError(err.message)
    } finally {
      setCreatingHousehold(false)
    }
  }

  const handleSetDefault = async (householdId: string) => {
    try {
      setError(null)
      await setDefaultHousehold(householdId)
      setSuccess('Default household updated!')

      setTimeout(() => {
        setSuccess(null)
      }, 3000)

    } catch (err: any) {
      setError(err.message)
    }
  }

  if (!user || loading) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Typography>Loading profile...</Typography>
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
            Profile Settings
          </Typography>
          <Typography variant="body1" color="textSecondary">
            Manage your personal information and BITE preferences
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

      {/* Profile Header */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" alignItems="center" gap={3}>
            <Avatar sx={{ width: 80, height: 80, bgcolor: 'primary.main', fontSize: '2rem' }}>
              {(profile.display_name || profile.email || 'U')[0]?.toUpperCase()}
            </Avatar>
            <Box>
              <Typography variant="h5">
                {profile.display_name || 'User'}
              </Typography>
              <Box display="flex" alignItems="center" gap={1} mt={0.5}>
                <EmailIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography variant="body2" color="textSecondary">
                  {profile.email}
                </Typography>
              </Box>
              <Typography variant="caption" color="textSecondary">
                Member since {new Date(profile.created_at || '').toLocaleDateString()}
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Basic Information */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            <PersonIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Basic Information
          </Typography>

          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Display Name"
                fullWidth
                value={profile.display_name || ''}
                onChange={(e) => setProfile({ ...profile, display_name: e.target.value })}
                placeholder="How others see your name"
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label="Phone Number"
                fullWidth
                value={profile.phone || ''}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                placeholder="(555) 123-4567"
                type="tel"
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Preferred Units</InputLabel>
                <Select
                  value={profile.preferred_units || 'mixed'}
                  label="Preferred Units"
                  onChange={(e) => setProfile({ ...profile, preferred_units: e.target.value })}
                >
                  {unitPreferences.map((unit) => (
                    <MenuItem key={unit.value} value={unit.value}>
                      {unit.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <Box display="flex" gap={2} justifyContent="flex-end">
                <Button
                  variant="contained"
                  onClick={handleSaveProfile}
                  disabled={saving}
                  startIcon={<SaveIcon />}
                >
                  {saving ? 'Saving...' : 'Save Profile'}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Household Management */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            <HomeIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Household Management
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
            Manage your households, create new ones, and set your default household
          </Typography>

          {/* Current Households */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 'medium' }}>
              Your Households
            </Typography>

            {households.length > 0 ? (
              <List>
                {households.map((household) => (
                  <ListItem key={household.household_id} sx={{ px: 0 }}>
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                            {household.household_name}
                          </Typography>
                          {household.is_default && (
                            <Chip
                              label="Default"
                              size="small"
                              color="primary"
                              icon={<StarIcon />}
                              sx={{ height: 24 }}
                            />
                          )}
                        </Box>
                      }
                      secondary={
                        <Box display="flex" alignItems="center" gap={1} mt={0.5}>
                          <Chip
                            label={household.role}
                            size="small"
                            variant="outlined"
                            sx={{ height: 20, fontSize: '0.75rem' }}
                          />
                          <Typography variant="caption" color="textSecondary">
                            Joined {new Date(household.joined_at).toLocaleDateString()}
                          </Typography>
                        </Box>
                      }
                    />
                    <ListItemSecondaryAction>
                      {!household.is_default && (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => handleSetDefault(household.household_id)}
                          startIcon={<StarIcon />}
                        >
                          Set Default
                        </Button>
                      )}
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            ) : (
              <Paper sx={{ p: 3, textAlign: 'center', backgroundColor: 'grey.50' }}>
                <Typography variant="body2" color="textSecondary">
                  No households found. Create your first household below.
                </Typography>
              </Paper>
            )}
          </Box>

          {/* Create New Household */}
          <Divider sx={{ my: 3 }} />

          <Box>
            <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 'medium' }}>
              Create New Household
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
              Create additional households for second homes, RVs, boats, or separate living spaces
            </Typography>

            <Box display="flex" gap={2} alignItems="end">
              <TextField
                label="Household Name"
                value={newHouseholdName}
                onChange={(e) => setNewHouseholdName(e.target.value)}
                placeholder="e.g., Beach House, RV Kitchen, Boat Galley"
                sx={{ flexGrow: 1 }}
                disabled={creatingHousehold}
              />
              <Button
                variant="contained"
                onClick={handleCreateHousehold}
                disabled={!newHouseholdName.trim() || creatingHousehold}
                startIcon={<AddIcon />}
                sx={{ whiteSpace: 'nowrap' }}
              >
                {creatingHousehold ? 'Creating...' : 'Create'}
              </Button>
            </Box>
          </Box>

          {/* Household Actions */}
          <Divider sx={{ my: 3 }} />

          <Box>
            <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 'medium' }}>
              Household Actions
            </Typography>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<PersonAddIcon />}
                  onClick={() => router.push('/settings/household')}
                  sx={{ py: 1.5 }}
                >
                  Invite Members
                </Button>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<SettingsIcon />}
                  onClick={() => router.push('/settings/household')}
                  sx={{ py: 1.5 }}
                >
                  Manage Settings
                </Button>
              </Grid>
            </Grid>
          </Box>
        </CardContent>
      </Card>

      {/* Budget & Receipt Tracking */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            <ReceiptIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Budget & Receipt Tracking
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            Configure automatic budget tracking and receipt import features
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Paper sx={{ p: 2, backgroundColor: 'info.light' }}>
                <Box display="flex" alignItems="center" gap={2}>
                  <CreditCardIcon sx={{ color: 'info.contrastText' }} />
                  <Box>
                    <Typography variant="body1" sx={{ color: 'info.contrastText', fontWeight: 'medium' }}>
                      Budget Tracking
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'info.contrastText', opacity: 0.8 }}>
                      Track spending patterns and food waste costs
                    </Typography>
                  </Box>
                  <Chip
                    label="Coming Soon"
                    size="small"
                    sx={{ ml: 'auto', backgroundColor: 'warning.main', color: 'warning.contrastText' }}
                  />
                </Box>
              </Paper>
            </Grid>

            <Grid item xs={12}>
              <Paper sx={{ p: 2, backgroundColor: 'success.light' }}>
                <Box display="flex" alignItems="center" gap={2}>
                  <ReceiptIcon sx={{ color: 'success.contrastText' }} />
                  <Box>
                    <Typography variant="body1" sx={{ color: 'success.contrastText', fontWeight: 'medium' }}>
                      Receipt Auto-Import
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'success.contrastText', opacity: 0.8 }}>
                      Automatically import purchases from store receipts
                    </Typography>
                  </Box>
                  <Chip
                    label="Coming Soon"
                    size="small"
                    sx={{ ml: 'auto', backgroundColor: 'warning.main', color: 'warning.contrastText' }}
                  />
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Store Account Connections */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">
              <StoreIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Store Account Connections
            </Typography>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              disabled
              size="small"
            >
              Add Store
            </Button>
          </Box>

          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            Connect your grocery store accounts for automatic receipt import and inventory tracking
          </Typography>

          {/* Future store connections will appear here */}
          <Paper sx={{ p: 3, textAlign: 'center', backgroundColor: 'grey.50' }}>
            <StoreIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="textSecondary" gutterBottom>
              Store Connections Coming Soon
            </Typography>
            <Typography variant="body2" color="textSecondary" paragraph>
              Future versions will support automatic receipt import from:
            </Typography>
            <Box display="flex" justifyContent="center" gap={1} flexWrap="wrap">
              <Chip label="Walmart" variant="outlined" size="small" />
              <Chip label="Target" variant="outlined" size="small" />
              <Chip label="Kroger" variant="outlined" size="small" />
              <Chip label="Amazon Fresh" variant="outlined" size="small" />
              <Chip label="Instacart" variant="outlined" size="small" />
            </Box>
          </Paper>
        </CardContent>
      </Card>

      {/* Account Information */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Account Information
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Box>
                <Typography variant="body2" color="textSecondary">Account ID:</Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                  {profile.id}
                </Typography>
              </Box>
            </Grid>

            <Grid item xs={12} sm={6}>
              <Box>
                <Typography variant="body2" color="textSecondary">Last Login:</Typography>
                <Typography variant="body2">
                  {profile.last_login ? new Date(profile.last_login).toLocaleString() : 'Never'}
                </Typography>
              </Box>
            </Grid>

            <Grid item xs={12}>
              <Typography variant="caption" color="textSecondary">
                For account deletion or advanced settings, please contact support.
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Container>
  )
}