'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  Tabs,
  Tab,
  Divider
} from '@mui/material'
import { useAppDispatch, useAppSelector } from '@/hooks/redux'
import { signIn, signUp, clearError } from '@/store/slices/authSlice'

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`auth-tabpanel-${index}`}
      aria-labelledby={`auth-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  )
}

export default function AuthPage() {
  const [tab, setTab] = useState(0)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [householdName, setHouseholdName] = useState('')
  const dispatch = useAppDispatch()
  const { loading, error } = useAppSelector((state) => state.auth)
  const router = useRouter()

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTab(newValue)
    dispatch(clearError())
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await dispatch(signIn({ email, password })).unwrap()
      router.push('/')
    } catch (error) {
      // Error is handled by the reducer
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await dispatch(signUp({ email, password, householdName })).unwrap()
      router.push('/')
    } catch (error) {
      // Error is handled by the reducer
    }
  }

  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Paper elevation={3} sx={{ p: 0 }}>
        <Box sx={{ textAlign: 'center', pt: 4, pb: 2 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            PantryIQ
          </Typography>
          <Typography variant="body1" color="textSecondary">
            Where modern efficiency meets traditional preparedness
          </Typography>
        </Box>

        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={tab}
            onChange={handleTabChange}
            aria-label="authentication tabs"
            centered
          >
            <Tab label="Sign In" id="auth-tab-0" />
            <Tab label="Sign Up" id="auth-tab-1" />
          </Tabs>
        </Box>

        {error && (
          <Box sx={{ p: 3, pb: 0 }}>
            <Alert severity="error" onClose={() => dispatch(clearError())}>
              {error}
            </Alert>
          </Box>
        )}

        <TabPanel value={tab} index={0}>
          <form onSubmit={handleSignIn}>
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              sx={{ mb: 2 }}
              autoComplete="email"
            />
            <TextField
              fullWidth
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              sx={{ mb: 3 }}
              autoComplete="current-password"
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={loading}
              sx={{ mb: 2 }}
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </Button>
          </form>
        </TabPanel>

        <TabPanel value={tab} index={1}>
          <form onSubmit={handleSignUp}>
            <TextField
              fullWidth
              label="Household Name"
              value={householdName}
              onChange={(e) => setHouseholdName(e.target.value)}
              required
              sx={{ mb: 2 }}
              helperText="Give your household a name (e.g., 'The Smith Family')"
            />
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              sx={{ mb: 2 }}
              autoComplete="email"
            />
            <TextField
              fullWidth
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              sx={{ mb: 3 }}
              autoComplete="new-password"
              helperText="Password should be at least 6 characters"
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={loading}
              sx={{ mb: 2 }}
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </Button>
          </form>
        </TabPanel>
      </Paper>

      <Box sx={{ mt: 3, textAlign: 'center' }}>
        <Typography variant="body2" color="textSecondary">
          By signing up, you agree to our terms of service and privacy policy.
        </Typography>
      </Box>
    </Container>
  )
}