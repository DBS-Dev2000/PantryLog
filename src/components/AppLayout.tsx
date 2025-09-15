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
  useMediaQuery,
  Button,
  Chip
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
  Help as HelpIcon,
  KeyboardArrowDown as ArrowDownIcon,
  Check as CheckIcon,
  Star as StarIcon
} from '@mui/icons-material'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getUserHouseholdFeatures, shouldShowFeature, FeaturePermissions } from '@/lib/features'
import FeatureUpsell from './FeatureUpsell'
// import { useHousehold } from '@/contexts/HouseholdContext' // Temporarily disabled

interface AppLayoutProps {
  children: React.ReactNode
}

const baseNavigation = [
  { name: 'Kitchen', href: '/', icon: HomeIcon, feature: null },
  { name: 'My Pantry', href: '/inventory', icon: PantryIcon, feature: null },
  { name: 'Stock Up', href: '/inventory/quick-add', icon: QrCodeScanner, feature: 'barcode_scanning' },
  { name: 'Grab & Go', href: '/inventory/quick-use', icon: Remove, feature: null },
  { name: 'Recipes', href: '/recipes', icon: Restaurant, feature: 'recipes_enabled' },
  { name: 'Shopping List', href: '/shopping', icon: ShoppingCart, feature: 'shopping_list_sharing' },
  { name: 'Receipt Scan', href: '/inventory/receipt', icon: Receipt, feature: 'ai_features_enabled' },
  { name: 'Help', href: '/help', icon: HelpIcon, feature: null },
  { name: 'Settings', href: '/settings', icon: SettingsIcon, feature: 'storage_editing' },
]

export default function AppLayout({ children }: AppLayoutProps) {
  const [user, setUser] = useState<any>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [featurePermissions, setFeaturePermissions] = useState<FeaturePermissions | null>(null)
  const [upsellDialog, setUpsellDialog] = useState<string | null>(null)
  const [filteredNavigation, setFilteredNavigation] = useState(baseNavigation)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const router = useRouter()
  const pathname = usePathname()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  // Re-enable household functionality gradually
  const [currentHousehold, setCurrentHousehold] = useState<any>(null)
  const [householdLoading, setHouseholdLoading] = useState(true)

  // Load household name for header
  useEffect(() => {
    const loadHouseholdName = async () => {
      if (!user) {
        setHouseholdLoading(false)
        return
      }

      try {
        // Try to get household name from user's household
        const { data: householdData, error } = await supabase
          .from('households')
          .select('id, name')
          .eq('id', user.id)
          .single()

        if (!error && householdData) {
          setCurrentHousehold({
            id: householdData.id,
            name: householdData.name
          })
        }
      } catch (err) {
        console.log('No household found for user')
      } finally {
        setHouseholdLoading(false)
      }
    }

    loadHouseholdName()
  }, [user])

  // Load feature permissions and update navigation
  useEffect(() => {
    const loadFeaturePermissions = async () => {
      if (!user) {
        setFeaturePermissions(null)
        setFilteredNavigation(baseNavigation)
        return
      }

      try {
        console.log('🔍 Loading feature permissions for navigation...')
        const permissions = await getUserHouseholdFeatures(user.id)
        setFeaturePermissions(permissions)

        // Filter navigation based on feature permissions and enforcement mode
        const filteredNav = await Promise.all(
          baseNavigation.map(async (item) => {
            if (!item.feature) {
              // No feature restriction - always show
              return item
            }

            const showResult = await shouldShowFeature(item.feature, user.id)

            if (showResult === 'hide') {
              return null // Will be filtered out
            }

            // Add visual indicator for upsell items
            return {
              ...item,
              isUpsell: showResult === 'upsell',
              disabled: showResult === 'upsell'
            }
          })
        )

        // Remove null items (hidden features)
        const visibleNav = filteredNav.filter(item => item !== null)
        setFilteredNavigation(visibleNav)

        console.log('✅ Navigation filtered based on features:', {
          total_items: baseNavigation.length,
          visible_items: visibleNav.length,
          permissions: permissions
        })

      } catch (error) {
        console.error('❌ Error loading feature permissions:', error)
        // Fail open - show all navigation if error
        setFilteredNavigation(baseNavigation)
      }
    }

    loadFeaturePermissions()
  }, [user])

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
    })

    return () => subscription.unsubscribe()
  }, [])

  // Temporarily disabled household menu handlers

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
          
        </Typography>
      </Toolbar>
      <Divider />
      <List>
        {filteredNavigation.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href))

          return (
            <ListItem key={item.name} disablePadding>
              <ListItemButton
                selected={isActive}
                onClick={() => {
                  if (item.isUpsell) {
                    // Show upsell dialog instead of navigating
                    console.log('🎁 Showing upsell for feature:', item.feature)
                    setUpsellDialog(item.feature)
                  } else {
                    handleNavigation(item.href)
                  }
                }}
                sx={{
                  opacity: item.isUpsell ? 0.6 : 1,
                  '&:hover': {
                    opacity: 1
                  }
                }}
              >
                <ListItemIcon>
                  <Icon color={isActive ? 'primary' : item.isUpsell ? 'disabled' : 'inherit'} />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" gap={1}>
                      <span>{item.name}</span>
                      {item.isUpsell && (
                        <Chip
                          label="Upgrade"
                          size="small"
                          color="warning"
                          sx={{ height: 20, fontSize: '0.7rem' }}
                        />
                      )}
                    </Box>
                  }
                />
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
          <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center' }}>
            {currentHousehold?.name ? (
              <Typography variant="h6" noWrap component="div">
                {currentHousehold.name} | <Box component="span" sx={{ fontWeight: 'bold' }}>PantryIQ</Box>
              </Typography>
            ) : (
              <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 'bold' }}>
                
              </Typography>
            )}
          </Box>
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

          {/* Household Switching Menu - Temporarily Disabled */}
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

      {/* Feature Upsell Dialog */}
      <FeatureUpsell
        open={!!upsellDialog}
        onClose={() => setUpsellDialog(null)}
        featureName={upsellDialog || ''}
      />
    </Box>
  )
}