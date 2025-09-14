'use client'

import { useState, useEffect } from 'react'
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  Avatar,
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  useTheme,
  useMediaQuery
} from '@mui/material'
import {
  Menu as MenuIcon,
  Home as HomeIcon,
  Kitchen as PantryIcon,
  Add as AddIcon,
  Settings as SettingsIcon,
  AccountCircle as AccountIcon,
  Logout as LogoutIcon,
  Storage as StorageIcon,
  Person as PersonIcon,
  QrCodeScanner,
  Remove,
  Receipt,
  ShoppingCart,
  Restaurant,
  Help as HelpIcon
} from '@mui/icons-material'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface AppLayoutProps {
  children: React.ReactNode
}

const navigation = [
  { name: 'Kitchen', href: '/', icon: HomeIcon },
  { name: 'My Pantry', href: '/inventory', icon: PantryIcon },
  { name: 'Stock Up', href: '/inventory/quick-add', icon: QrCodeScanner },
  { name: 'Grab & Go', href: '/inventory/quick-use', icon: Remove },
  { name: 'Recipes', href: '/recipes', icon: Restaurant },
  { name: 'Shopping List', href: '/shopping', icon: ShoppingCart },
  { name: 'Receipt Scan', href: '/inventory/receipt', icon: Receipt },
  { name: 'Help', href: '/help', icon: HelpIcon },
  { name: 'Settings', href: '/settings', icon: SettingsIcon },
]

export default function AppLayout({ children }: AppLayoutProps) {
  const [user, setUser] = useState<any>(null)
  const [householdName, setHouseholdName] = useState<string>('')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const router = useRouter()
  const pathname = usePathname()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user)
    }

    getSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user)
      if (session?.user) {
        loadHouseholdNameSafely(session.user.id)
      } else {
        setHouseholdName('')
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const loadHouseholdNameSafely = async (userId: string) => {
    try {
      const { data: householdData, error } = await supabase
        .from('households')
        .select('name')
        .eq('id', userId)
        .single()

      if (error) {
        console.log('No household found, using default')
        return
      }

      if (householdData?.name && householdData.name !== 'My Household') {
        setHouseholdName(householdData.name)
      }
    } catch (err) {
      // Silently handle errors to prevent app crashes
      console.log('Error loading household name:', err)
    }
  }

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen)
  }

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleMenuClose = () => {
    setAnchorEl(null)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/auth')
    handleMenuClose()
  }

  const handleNavigation = (href: string) => {
    router.push(href)
    if (isMobile) {
      setMobileOpen(false)
    }
  }

  const drawer = (
    <Box>
      <Toolbar>
        <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 'bold' }}>
          {householdName ? `${householdName} | PantryIQ` : 'PantryIQ'}
        </Typography>
      </Toolbar>
      <Divider />
      <List>
        {navigation.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href))

          return (
            <ListItem key={item.name} disablePadding>
              <ListItemButton
                selected={isActive}
                onClick={() => handleNavigation(item.href)}
              >
                <ListItemIcon>
                  <Icon color={isActive ? 'primary' : 'inherit'} />
                </ListItemIcon>
                <ListItemText primary={item.name} />
              </ListItemButton>
            </ListItem>
          )
        })}
      </List>
    </Box>
  )

  if (!user) {
    return <>{children}</>
  }

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - 240px)` },
          ml: { md: '240px' },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
            {householdName ? `${householdName} | PantryIQ` : 'PantryIQ'}
          </Typography>
          <IconButton
            size="large"
            edge="end"
            aria-label="account of current user"
            aria-controls="menu-appbar"
            aria-haspopup="true"
            onClick={handleMenuOpen}
            color="inherit"
          >
            <Avatar sx={{ width: 32, height: 32 }}>
              {user.email?.[0]?.toUpperCase()}
            </Avatar>
          </IconButton>
          <Menu
            id="menu-appbar"
            anchorEl={anchorEl}
            anchorOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            keepMounted
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
          >
            <MenuItem onClick={() => { handleNavigation('/settings/profile'); handleMenuClose() }}>
              <PersonIcon sx={{ mr: 1 }} />
              Profile
            </MenuItem>
            <MenuItem onClick={() => { handleNavigation('/settings'); handleMenuClose() }}>
              <SettingsIcon sx={{ mr: 1 }} />
              Settings
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleSignOut}>
              <LogoutIcon sx={{ mr: 1 }} />
              Sign Out
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Box
        component="nav"
        sx={{ width: { md: 240 }, flexShrink: { md: 0 } }}
        aria-label="navigation menu"
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: 240 },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: 240 },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - 240px)` },
          minHeight: '100vh',
          backgroundColor: 'grey.50'
        }}
      >
        <Toolbar />
        {children}
      </Box>
    </Box>
  )
}