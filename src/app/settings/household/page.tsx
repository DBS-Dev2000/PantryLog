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
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Chip,
  Avatar,
  Paper,
  Divider,
  Fab,
  Tooltip
} from '@mui/material'
import {
  ArrowBack as ArrowBackIcon,
  PersonAdd as PersonAddIcon,
  Email as EmailIcon,
  ContentCopy as CopyIcon,
  Delete as DeleteIcon,
  AdminPanelSettings as AdminIcon,
  Person as PersonIcon,
  Share as ShareIcon,
  QrCode as QrCodeIcon,
  Settings as SettingsIcon
} from '@mui/icons-material'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import QRCode from 'qrcode'

interface HouseholdMember {
  id: string
  user_id: string
  role: string
  joined_at: string
  user_email?: string
}

interface HouseholdInvite {
  id: string
  invited_email: string
  invite_code: string
  expires_at: string
  invited_by: string
  accepted_at?: string
}

export default function HouseholdPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [household, setHousehold] = useState<any>(null)
  const [members, setMembers] = useState<HouseholdMember[]>([])
  const [invites, setInvites] = useState<HouseholdInvite[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteQrDialogOpen, setInviteQrDialogOpen] = useState(false)
  const [inviteCode, setInviteCode] = useState('')
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [newHouseholdName, setNewHouseholdName] = useState('')

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUser(session.user)
        await loadHouseholdData(session.user)
      } else {
        router.push('/auth')
      }
    }

    getUser()
  }, [router])

  const loadHouseholdData = async (currentUser: any) => {
    console.log('🔄 loadHouseholdData called in household management')
    setLoading(true)
    try {
      // Get user's household - first check if they're a member, then check legacy
      let householdId = currentUser.id // Default to legacy mode

      const { data: membershipData } = await supabase
        .from('household_members')
        .select('household_id, role')
        .eq('user_id', currentUser.id)
        .maybeSingle()

      if (membershipData) {
        householdId = membershipData.household_id
      }

      // Load household details
      console.log('🏠 Loading household data for ID:', householdId)
      const { data: householdData, error: householdError } = await supabase
        .from('households')
        .select('*')
        .eq('id', householdId)
        .single()

      console.log('📊 Loaded household data:', householdData)

      if (householdError) throw householdError
      setHousehold(householdData)

      // Load household members
      const { data: membersData, error: membersError } = await supabase
        .from('household_members')
        .select('*')
        .eq('household_id', householdId)
        .order('joined_at')

      if (membersError && membersError.code !== 'PGRST116') {
        throw membersError
      }

      setMembers(membersData || [])

      // Load active (non-expired) invites
      const { data: invitesData, error: invitesError } = await supabase
        .from('household_invites')
        .select('*')
        .eq('household_id', householdId)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })

      if (invitesError && invitesError.code !== 'PGRST116') {
        throw invitesError
      }

      setInvites(invitesData || [])

    } catch (err: any) {
      console.error('Error loading household data:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const createInvite = async () => {
    if (!user || !household || !inviteEmail) return

    try {
      setError(null)

      // Generate invite with 24-hour expiration
      const expiresAt = new Date()
      expiresAt.setHours(expiresAt.getHours() + 24)

      const { data: inviteData, error: inviteError } = await supabase
        .from('household_invites')
        .insert([{
          household_id: household.id,
          invited_email: inviteEmail,
          invite_code: Math.random().toString(36).substring(2, 10).toUpperCase(),
          invited_by: user.id,
          expires_at: expiresAt.toISOString()
        }])
        .select()
        .single()

      if (inviteError) throw inviteError

      setSuccess(`Invitation sent to ${inviteEmail}!`)
      setInviteEmail('')
      setInviteDialogOpen(false)
      await loadHouseholdData(user)

    } catch (err: any) {
      setError(err.message)
    }
  }

  const generateInviteQR = async () => {
    if (!household) return

    try {
      const inviteCode = Math.random().toString(36).substring(2, 10).toUpperCase()

      // Create invite record with 24-hour expiration
      const expiresAt = new Date()
      expiresAt.setHours(expiresAt.getHours() + 24)

      await supabase
        .from('household_invites')
        .insert([{
          household_id: household.id,
          invited_email: 'QR_INVITE',
          invite_code: inviteCode,
          invited_by: user.id,
          expires_at: expiresAt.toISOString()
        }])

      const inviteUrl = `${window.location.origin}/join/${inviteCode}`

      const qrDataUrl = await QRCode.toDataURL(inviteUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      })

      setInviteCode(inviteCode)
      setQrCodeDataUrl(qrDataUrl)
      setInviteQrDialogOpen(true)

    } catch (err: any) {
      setError(err.message)
    }
  }

  const removeInvite = async (inviteId: string) => {
    try {
      const { error } = await supabase
        .from('household_invites')
        .delete()
        .eq('id', inviteId)

      if (error) throw error

      setSuccess('Invitation cancelled')
      await loadHouseholdData(user)
    } catch (err: any) {
      setError(err.message)
    }
  }

  const updateHouseholdName = async (newName: string) => {
    try {
      console.log('🏠 Updating household name:', newName)
      console.log('📍 Household ID:', household?.id)

      const { data, error } = await supabase
        .from('households')
        .update({ name: newName })
        .eq('id', household?.id)
        .select()

      console.log('📊 Update result:', data)

      if (error) {
        console.error('❌ Update error:', error)
        throw error
      }

      console.log('✅ Household name updated successfully')
      setSuccess(`Household name updated to "${newName}"!`)
      await loadHouseholdData(user)
    } catch (err: any) {
      console.error('❌ Household name update failed:', err)
      setError(err.message)
    }
  }

  const copyInviteLink = (code: string) => {
    const inviteUrl = `${window.location.origin}/join/${code}`
    navigator.clipboard.writeText(inviteUrl)
    setSuccess('Invite link copied to clipboard!')
  }

  const regenerateQRCode = async (code: string) => {
    try {
      const inviteUrl = `${window.location.origin}/join/${code}`

      const qrDataUrl = await QRCode.toDataURL(inviteUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      })

      setInviteCode(code)
      setQrCodeDataUrl(qrDataUrl)
      setInviteQrDialogOpen(true)

    } catch (err: any) {
      setError('Failed to generate QR code')
    }
  }

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
            Household Management
          </Typography>
          <Typography variant="body1" color="textSecondary">
            Invite family members to share your pantry inventory
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

      {/* Household Info */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          {editingName ? (
            <Box>
              <Typography variant="h6" gutterBottom>
                Edit Household Name
              </Typography>
              <Box display="flex" gap={2} alignItems="center">
                <TextField
                  label="Household Name"
                  value={newHouseholdName}
                  onChange={(e) => setNewHouseholdName(e.target.value)}
                  placeholder="Enter household name"
                  sx={{ flexGrow: 1 }}
                  autoFocus
                />
                <Button
                  variant="contained"
                  onClick={async () => {
                    console.log('💾 Save button clicked, new name:', newHouseholdName.trim())
                    if (newHouseholdName.trim()) {
                      await updateHouseholdName(newHouseholdName.trim())
                      setEditingName(false)
                    } else {
                      console.warn('⚠️ No household name entered')
                    }
                  }}
                  disabled={!newHouseholdName.trim()}
                  color="primary"
                >
                  Save
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setEditingName(false)
                    setNewHouseholdName('')
                  }}
                >
                  Cancel
                </Button>
              </Box>
            </Box>
          ) : (
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="h6" gutterBottom>
                  {household?.name || 'My Household'}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Household ID: {household?.id}
                </Typography>
              </Box>
              <Button
                variant="outlined"
                startIcon={<SettingsIcon />}
                onClick={() => {
                  setNewHouseholdName(household?.name || 'My Household')
                  setEditingName(true)
                }}
                size="small"
              >
                Edit Name
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Current Members */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">
              Household Members ({members.length + 1})
            </Typography>
            <Box>
              <Button
                variant="outlined"
                startIcon={<QrCodeIcon />}
                onClick={generateInviteQR}
                sx={{ mr: 1 }}
              >
                QR Invite
              </Button>
              <Button
                variant="contained"
                startIcon={<PersonAddIcon />}
                onClick={() => setInviteDialogOpen(true)}
              >
                Invite Member
              </Button>
            </Box>
          </Box>

          <List>
            {/* Current User */}
            <ListItem>
              <Avatar sx={{ mr: 2, bgcolor: 'primary.main' }}>
                {user.email?.[0]?.toUpperCase()}
              </Avatar>
              <ListItemText
                primary={
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography>{user.email}</Typography>
                    <Chip size="small" label="You" color="primary" />
                    <Chip size="small" label="Admin" icon={<AdminIcon />} />
                  </Box>
                }
                secondary={`Joined ${new Date(user.created_at).toLocaleDateString()}`}
              />
            </ListItem>

            {/* Other Members */}
            {members.map((member) => (
              <ListItem key={member.id}>
                <Avatar sx={{ mr: 2, bgcolor: 'secondary.main' }}>
                  {member.user_email?.[0]?.toUpperCase() || 'U'}
                </Avatar>
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography>{member.user_email || `User ${member.user_id.substring(0, 8)}`}</Typography>
                      <Chip
                        size="small"
                        label={member.role}
                        icon={member.role === 'admin' ? <AdminIcon /> : <PersonIcon />}
                        color={member.role === 'admin' ? 'primary' : 'default'}
                      />
                    </Box>
                  }
                  secondary={`Joined ${new Date(member.joined_at).toLocaleDateString()}`}
                />
              </ListItem>
            ))}
          </List>
        </CardContent>
      </Card>

      {/* Pending Invites */}
      {invites.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Pending Invitations ({invites.length})
            </Typography>
            <List>
              {invites.map((invite) => (
                <ListItem key={invite.id}>
                  <EmailIcon sx={{ mr: 2, color: 'warning.main' }} />
                  <ListItemText
                    primary={invite.invited_email}
                    secondary={
                      <Box>
                        <Typography variant="caption">
                          Code: {invite.invite_code} • Expires: {new Date(invite.expires_at).toLocaleDateString()}
                        </Typography>
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <Tooltip title="Copy invite link">
                      <IconButton onClick={() => copyInviteLink(invite.invite_code)}>
                        <CopyIcon />
                      </IconButton>
                    </Tooltip>
                    {invite.invited_email === 'QR_INVITE' && (
                      <Tooltip title="Show QR Code">
                        <IconButton onClick={() => regenerateQRCode(invite.invite_code)} color="primary">
                          <QrCodeIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title="Cancel invitation">
                      <IconButton onClick={() => removeInvite(invite.id)} color="error">
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      )}

      {/* Invite Dialog */}
      <Dialog open={inviteDialogOpen} onClose={() => setInviteDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Invite Household Member</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            Send an invitation to join your household and share the pantry inventory.
          </Typography>
          <TextField
            label="Email Address"
            type="email"
            fullWidth
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="family@example.com"
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInviteDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={createInvite}
            variant="contained"
            disabled={!inviteEmail}
            startIcon={<EmailIcon />}
          >
            Send Invitation
          </Button>
        </DialogActions>
      </Dialog>

      {/* QR Code Invite Dialog */}
      <Dialog open={inviteQrDialogOpen} onClose={() => setInviteQrDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>QR Code Invitation</DialogTitle>
        <DialogContent>
          <Box sx={{ textAlign: 'center', py: 2 }}>
            {qrCodeDataUrl && (
              <Box>
                <img
                  src={qrCodeDataUrl}
                  alt="Household Invite QR Code"
                  style={{ maxWidth: '100%', height: 'auto', border: '1px solid #ddd', borderRadius: '8px' }}
                />
                <Typography variant="body2" color="textSecondary" sx={{ mt: 2 }}>
                  Share this QR code with family members to join your household
                </Typography>
                <Paper sx={{ p: 2, mt: 2, backgroundColor: 'grey.100' }}>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                    Invite Code: {inviteCode}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    Or share this code manually
                  </Typography>
                </Paper>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInviteQrDialogOpen(false)}>Close</Button>
          <Button
            onClick={() => copyInviteLink(inviteCode)}
            variant="contained"
            startIcon={<CopyIcon />}
          >
            Copy Invite Link
          </Button>
        </DialogActions>
      </Dialog>

      {/* Floating Action Button for Quick Invite */}
      <Fab
        color="primary"
        aria-label="invite"
        sx={{
          position: 'fixed',
          bottom: 16,
          right: 16
        }}
        onClick={() => setInviteDialogOpen(true)}
      >
        <PersonAddIcon />
      </Fab>
    </Container>
  )
}