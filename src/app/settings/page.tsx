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
  Avatar,
  Chip,
  Paper,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider
} from '@mui/material'
import {
  Person as PersonIcon,
  Storage as StorageIcon,
  Notifications as NotificationsIcon,
  Security as SecurityIcon,
  Palette as ThemeIcon,
  Language as LanguageIcon,
  ChevronRight as ChevronRightIcon,
  Email as EmailIcon,
  CalendarToday as CalendarIcon,
  Home as HouseholdIcon
} from '@mui/icons-material'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const settingsCategories = [
  {
    title: 'Account & Profile',
    items: [
      {
        title: 'Profile Settings',
        description: 'Manage your personal information and preferences',
        icon: PersonIcon,
        href: '/settings/profile',
        color: 'primary'
      },
      {
        title: 'Household Management',
        description: 'Manage household members and permissions',
        icon: HouseholdIcon,
        href: '/settings/household',
        color: 'secondary'
      }
    ]
  },
  {
    title: 'Storage & Inventory',
    items: [
      {
        title: 'Storage Configuration',
        description: 'Configure your pantries, freezers, shelves and sections',
        icon: StorageIcon,
        href: '/settings/storage',
        color: 'info'
      }
    ]
  },
  {
    title: 'Application Settings',
    items: [
      {
        title: 'Notifications',
        description: 'Manage expiration alerts and notifications',
        icon: NotificationsIcon,
        href: '/settings/notifications',
        color: 'warning'
      },
      {
        title: 'Privacy & Security',
        description: 'Manage your privacy settings and account security',
        icon: SecurityIcon,
        href: '/settings/security',
        color: 'error'
      },
      {
        title: 'Appearance',
        description: 'Customize theme and display preferences',
        icon: ThemeIcon,
        href: '/settings/appearance',
        color: 'success'
      }
    ]
  }
]

export default function SettingsPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUser(session.user)

        // Try to get additional profile information
        const { data: profileData } = await supabase
          .from('households')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle()

        setProfile(profileData)
      } else {
        router.push('/auth')
      }
      setLoading(false)
    }

    getUser()
  }, [router])

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Typography>Loading...</Typography>
      </Container>
    )
  }

  if (!user) {
    return null
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, pb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Settings
      </Typography>
      <Typography variant="body1" color="textSecondary" paragraph>
        Manage your account, storage configuration, and application preferences
      </Typography>

      {/* User Profile Card */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Box display="flex" alignItems="center" gap={2}>
            <Avatar sx={{ width: 64, height: 64, bgcolor: 'primary.main' }}>
              {user.email?.[0]?.toUpperCase()}
            </Avatar>
            <Box>
              <Typography variant="h6">
                {profile?.name || 'My Household'}
              </Typography>
              <Box display="flex" alignItems="center" gap={1} mt={0.5}>
                <EmailIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography variant="body2" color="textSecondary">
                  {user.email}
                </Typography>
              </Box>
              <Box display="flex" alignItems="center" gap={1} mt={0.5}>
                <CalendarIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography variant="body2" color="textSecondary">
                  Member since {new Date(user.created_at).toLocaleDateString()}
                </Typography>
              </Box>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Settings Categories */}
      {settingsCategories.map((category, categoryIndex) => (
        <Box key={category.title} sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom sx={{ mb: 2, color: 'text.secondary' }}>
            {category.title}
          </Typography>
          <Paper sx={{ overflow: 'hidden' }}>
            <List disablePadding>
              {category.items.map((item, itemIndex) => {
                const Icon = item.icon
                return (
                  <Box key={item.title}>
                    <ListItem disablePadding>
                      <ListItemButton
                        onClick={() => router.push(item.href)}
                        sx={{
                          py: 2,
                          '&:hover': {
                            backgroundColor: 'action.hover',
                          }
                        }}
                      >
                        <ListItemIcon>
                          <Icon color={item.color as any} />
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Typography variant="subtitle1">
                              {item.title}
                            </Typography>
                          }
                          secondary={
                            <Typography variant="body2" color="textSecondary">
                              {item.description}
                            </Typography>
                          }
                        />
                        <ChevronRightIcon color="action" />
                      </ListItemButton>
                    </ListItem>
                    {itemIndex < category.items.length - 1 && <Divider />}
                  </Box>
                )
              })}
            </List>
          </Paper>
        </Box>
      ))}

      {/* Quick Actions */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Quick Actions
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={4}>
            <Button
              variant="outlined"
              fullWidth
              startIcon={<StorageIcon />}
              onClick={() => router.push('/settings/storage')}
            >
              Configure Storage
            </Button>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <Button
              variant="outlined"
              fullWidth
              startIcon={<PersonIcon />}
              onClick={() => router.push('/settings/profile')}
            >
              Edit Profile
            </Button>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <Button
              variant="outlined"
              fullWidth
              startIcon={<NotificationsIcon />}
              onClick={() => router.push('/settings/notifications')}
            >
              Notifications
            </Button>
          </Grid>
        </Grid>
      </Paper>
    </Container>
  )
}