'use client'

import { useState, useEffect } from 'react'
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Button,
  Alert,
  CircularProgress,
  Avatar,
  Chip
} from '@mui/material'
import {
  Check as CheckIcon,
  Home as HouseholdIcon,
  Person as PersonIcon,
  Login as LoginIcon
} from '@mui/icons-material'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface InviteDetails {
  id: string
  household_id: string
  invited_email: string
  invite_code: string
  expires_at: string
  household: {
    name: string
    created_at: string
  }
  invited_by_user?: {
    email: string
  }
}

export default function JoinHouseholdPage() {
  const router = useRouter()
  const params = useParams()
  const inviteCode = params.code as string

  const [user, setUser] = useState<any>(null)
  const [invite, setInvite] = useState<InviteDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user || null)
      await loadInviteDetails()
    }

    checkUser()
  }, [inviteCode])

  const loadInviteDetails = async () => {
    setLoading(true)
    try {
      const { data: inviteData, error: inviteError } = await supabase
        .from('household_invites')
        .select(`
          *,
          households (name, created_at)
        `)
        .eq('invite_code', inviteCode)
        .gt('expires_at', new Date().toISOString())
        .single()

      if (inviteError) {
        if (inviteError.code === 'PGRST116') {
          throw new Error('Invitation not found or expired')
        }
        throw inviteError
      }

      setInvite(inviteData as any)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const acceptInvite = async () => {
    if (!user || !invite) return

    setJoining(true)
    try {
      // Check if user is already a member of this household
      const { data: existingMember } = await supabase
        .from('household_members')
        .select('id')
        .eq('household_id', invite.household_id)
        .eq('user_id', user.id)
        .single()

      if (existingMember) {
        setError('You are already a member of this household!')
        return
      }

      // Add user to household
      const { error: memberError } = await supabase
        .from('household_members')
        .insert([{
          household_id: invite.household_id,
          user_id: user.id,
          role: 'member',
          invited_by: invite.invited_by
        }])

      if (memberError) throw memberError

      // Note: We don't mark the invite as consumed so it can be reused by other users
      // The household_members table prevents the same user from joining twice

      setSuccess(true)

      // Redirect to inventory after success
      setTimeout(() => {
        router.push('/inventory')
      }, 3000)

    } catch (err: any) {
      setError(err.message)
    } finally {
      setJoining(false)
    }
  }

  if (loading) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8, textAlign: 'center' }}>
        <CircularProgress size={60} />
        <Typography sx={{ mt: 2 }}>Loading invitation...</Typography>
      </Container>
    )
  }

  if (error) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8 }}>
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="h5" color="error" gutterBottom>
              Invalid Invitation
            </Typography>
            <Typography variant="body1" color="textSecondary" paragraph>
              {error}
            </Typography>
            <Button
              variant="contained"
              onClick={() => router.push('/')}
            >
              Go to PantryLog
            </Button>
          </CardContent>
        </Card>
      </Container>
    )
  }

  if (success) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8 }}>
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 4 }}>
            <CheckIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
            <Typography variant="h5" color="success.main" gutterBottom>
              Welcome to the Household!
            </Typography>
            <Typography variant="body1" color="textSecondary" paragraph>
              You've successfully joined "{invite?.household?.name}".
              You now have access to the shared pantry inventory.
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Redirecting to inventory...
            </Typography>
          </CardContent>
        </Card>
      </Container>
    )
  }

  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Card>
        <CardContent sx={{ textAlign: 'center', py: 4 }}>
          <HouseholdIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
          <Typography variant="h5" gutterBottom>
            Join PantryIQ Household
          </Typography>
          <Typography variant="body2" color="primary.main" sx={{ fontStyle: 'italic', mb: 2 }}>
            Smart inventory management for the whole family
          </Typography>

          {invite && (
            <Box sx={{ mt: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                "{(invite as any).households?.name || invite.household?.name || 'Unknown Household'}"
              </Typography>
              <Typography variant="body2" color="textSecondary" paragraph>
                You've been invited to join this household and share the pantry inventory.
              </Typography>

              <Box sx={{ mb: 2 }}>
                <Chip label={`Invite Code: ${invite.invite_code}`} variant="outlined" />
              </Box>

              <Typography variant="caption" color="textSecondary">
                Expires: {new Date(invite.expires_at).toLocaleString()}
              </Typography>
            </Box>
          )}

          {!user ? (
            <Box>
              <Typography variant="body2" color="textSecondary" paragraph>
                Sign in to your account or create a new one to join this household.
              </Typography>
              <Box display="flex" flexDirection="column" gap={2}>
                <Button
                  variant="outlined"
                  startIcon={<LoginIcon />}
                  onClick={() => router.push(`/auth?tab=0&invite=${inviteCode}`)}
                  size="large"
                >
                  Sign In to Existing Account
                </Button>
                <Button
                  variant="contained"
                  onClick={() => router.push(`/auth?tab=1&invite=${inviteCode}&join=true`)}
                  size="large"
                >
                  Create New Account & Join
                </Button>
              </Box>
            </Box>
          ) : (
            <Box>
              <Typography variant="body2" color="textSecondary" paragraph>
                Signed in as: {user.email}
              </Typography>
              <Button
                variant="contained"
                onClick={acceptInvite}
                disabled={joining}
                startIcon={joining ? <CircularProgress size={20} /> : <CheckIcon />}
                size="large"
              >
                {joining ? 'Joining...' : 'Join Household'}
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>
    </Container>
  )
}