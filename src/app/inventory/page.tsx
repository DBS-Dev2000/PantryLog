'use client'

import { useState, useEffect, Suspense, useMemo } from 'react'
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Grid,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Alert,
  CircularProgress,
  Link,
  IconButton,
  useTheme,
  useMediaQuery,
  Stack,
  CardActions,
  Divider,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  TextField,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Collapse,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Avatar
} from '@mui/material'
import {
  Add as AddIcon,
  Kitchen as PantryIcon,
  LocationOn as LocationIcon,
  CalendarToday as CalendarIcon,
  Launch as LaunchIcon,
  Edit as EditIcon,
  RecordVoiceOver as VoiceIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Clear as ClearIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  RemoveCircleOutline as UseIcon
} from '@mui/icons-material'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAppDispatch, useAppSelector } from '@/hooks/redux'
import { fetchInventoryItems } from '@/store/slices/inventorySlice'
import { fetchHousehold } from '@/store/slices/householdSlice'
import { supabase } from '@/lib/supabase-client'
import VoiceAssistant from '@/components/VoiceAssistant'
import WhisperVoiceAssistant from '@/components/WhisperVoiceAssistant'
import { canUseVoiceAssistant, getVoiceAssistantType } from '@/lib/features'

function InventoryPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const dispatch = useAppDispatch()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const isTablet = useMediaQuery(theme.breakpoints.down('md'))
  const { items: reduxItems, loading: reduxLoading, error: reduxError } = useAppSelector((state) => state.inventory)
  const { household } = useAppSelector((state) => state.household)
  const [user, setUser] = useState<any>(null)
  const [storageLocation, setStorageLocation] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [filteredItems, setFilteredItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [voiceAssistantOpen, setVoiceAssistantOpen] = useState(false)
  const [voiceAssistantEnabled, setVoiceAssistantEnabled] = useState(false)
  const [voiceAssistantType, setVoiceAssistantType] = useState<'basic' | 'whisper'>('whisper')

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedLocation, setSelectedLocation] = useState<string>('all')
  const [showFilters, setShowFilters] = useState(false)
  const [categories, setCategories] = useState<string[]>([])
  const [locations, setLocations] = useState<any[]>([])

  // Use item dialog states
  const [useDialogOpen, setUseDialogOpen] = useState(false)
  const [useItem, setUseItem] = useState<any>(null)
  const [useQuantity, setUseQuantity] = useState<number>(1)

  // Build full breadcrumb path for a storage location
  const buildLocationPath = async (locationId: string, allLocations: any[]): Promise<string> => {
    const location = allLocations.find(l => l.id === locationId)
    if (!location) return 'Unknown Location'

    if (location.parent_id) {
      const parentPath = await buildLocationPath(location.parent_id, allLocations)
      return `${parentPath} > ${location.name}`
    }
    return location.name
  }

  // Load inventory items directly from database
  const loadInventoryItems = async (userId: string) => {
    console.log('📦 Loading inventory items for user:', userId)
    setLoading(true)
    setError(null)

    try {
      // Get the user's actual household ID from household_members table
      const { data: membership, error: memberError } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', userId)
        .order('joined_at', { ascending: true })
        .limit(1)
        .single()

      let householdId = membership?.household_id

      // Legacy fallback - check if user.id is a household.id (old system)
      if (!householdId) {
        const { data: household } = await supabase
          .from('households')
          .select('id')
          .eq('id', userId)
          .single()

        if (household) {
          console.warn('⚠️ Using legacy household lookup (user.id = household.id)')
          householdId = userId
        }
      }

      if (!householdId) {
        throw new Error('No household found for user. Please contact support.')
      }

      console.log('🏠 Loading inventory for household:', householdId)

      // First, load all storage locations to build paths
      const { data: allStorageLocations, error: locationsError } = await supabase
        .from('storage_locations')
        .select('*')
        .eq('household_id', householdId)
        .eq('is_active', true)

      if (locationsError) throw locationsError

      // Load inventory items with related data
      const { data: inventoryData, error: inventoryError } = await supabase
        .from('inventory_items')
        .select(`
          *,
          products (*),
          storage_locations (*)
        `)
        .eq('household_id', householdId)
        .eq('is_consumed', false)
        .order('created_at', { ascending: false })

      if (inventoryError) {
        console.error('❌ Error loading inventory:', inventoryError)
        throw inventoryError
      }

      console.log('✅ Loaded inventory items:', inventoryData?.length || 0)

      // Build full paths for each item's storage location
      if (inventoryData && allStorageLocations) {
        for (const item of inventoryData) {
          if (item.storage_locations?.id) {
            const fullPath = await buildLocationPath(item.storage_locations.id, allStorageLocations)
            ;(item.storage_locations as any).full_path = fullPath
          }
        }
      }

      console.log('🗂️ Built location paths for', inventoryData?.length || 0, 'items')
      setItems(inventoryData || [])

      // Extract unique categories and locations for filters
      const uniqueCategories = [...new Set(inventoryData?.map(item => item.products?.category).filter(Boolean) || [])]
      setCategories(uniqueCategories.sort())
      setLocations(allStorageLocations || [])

    } catch (err: any) {
      console.error('💥 Failed to load inventory:', err)
      setError(`Failed to load inventory: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const getUser = async () => {
      // Always get a fresh session to avoid stale data
      const { data: { session }, error } = await supabase.auth.refreshSession()

      if (error) {
        console.error('Session refresh error:', error)
        // Fallback to current session
        const { data: { session: currentSession } } = await supabase.auth.getSession()
        if (currentSession?.user) {
          setUser(currentSession.user)
          await loadInventoryItems(currentSession.user.id)
        } else {
          router.push('/auth')
        }
        return
      }

      if (session?.user) {
        setUser(session.user)
        await loadInventoryItems(session.user.id)

        // Check if Voice Assistant is enabled for this user's household
        const canUseVA = await canUseVoiceAssistant(session.user.id)
        setVoiceAssistantEnabled(canUseVA)

        // Get voice assistant type for this page
        if (canUseVA) {
          const vaType = await getVoiceAssistantType('inventory', session.user.id)
          setVoiceAssistantType(vaType)
        }

        // Check if we're filtering by a specific storage location
        const locationId = searchParams.get('location')
        if (locationId) {
          console.log('🔍 Filtering inventory by storage location:', locationId)
          loadStorageLocationInfo(locationId)
        }
      } else {
        router.push('/auth')
      }
    }

    getUser()
  }, [router, searchParams])

  // Load storage location information for filtering
  const loadStorageLocationInfo = async (locationId: string) => {
    try {
      const { data: location, error } = await supabase
        .from('storage_locations')
        .select('*')
        .eq('id', locationId)
        .single()

      if (error) throw error

      console.log('📍 Storage location loaded:', location.name)
      setStorageLocation(location)
    } catch (err) {
      console.error('Error loading storage location:', err)
    }
  }

  // Apply search and filters
  const applyFilters = useMemo(() => {
    let filtered = [...items]

    // Apply storage location filter from URL
    if (storageLocation) {
      filtered = filtered.filter((item: any) =>
        item.storage_location_id === storageLocation.id
      )
    }

    // Apply search term filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      filtered = filtered.filter((item: any) => {
        const productName = item.products?.name?.toLowerCase() || ''
        const brandName = item.products?.brand?.toLowerCase() || ''
        const locationName = item.storage_locations?.name?.toLowerCase() || ''
        const notes = item.notes?.toLowerCase() || ''

        return productName.includes(searchLower) ||
               brandName.includes(searchLower) ||
               locationName.includes(searchLower) ||
               notes.includes(searchLower)
      })
    }

    // Apply category filter
    if (selectedCategory && selectedCategory !== 'all') {
      filtered = filtered.filter((item: any) =>
        item.products?.category === selectedCategory
      )
    }

    // Apply location filter
    if (selectedLocation && selectedLocation !== 'all') {
      filtered = filtered.filter((item: any) =>
        item.storage_location_id === selectedLocation
      )
    }

    return filtered
  }, [items, storageLocation, searchTerm, selectedCategory, selectedLocation])

  // Update filtered items when filters change
  useEffect(() => {
    setFilteredItems(applyFilters)
  }, [applyFilters])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  const getDaysUntilExpiration = (expirationDate: string) => {
    if (!expirationDate) return null
    const today = new Date()
    const expiry = new Date(expirationDate)
    const diffTime = expiry.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const getExpirationColor = (expirationDate: string) => {
    const days = getDaysUntilExpiration(expirationDate)
    if (days === null) return 'default'
    if (days < 0) return 'error'
    if (days <= 3) return 'warning'
    if (days <= 7) return 'info'
    return 'success'
  }

  // Handle use item click
  const handleUseItemClick = (item: any) => {
    setUseItem(item)
    setUseQuantity(1)
    setUseDialogOpen(true)
  }

  // Handle use item confirmation
  const handleUseItemConfirm = async () => {
    if (!useItem || !user) return

    try {
      const quantityToUse = useItem.quantity <= 1 ? useItem.quantity : useQuantity
      const newQuantity = useItem.quantity - quantityToUse

      if (newQuantity <= 0) {
        // Mark item as consumed
        const { error } = await supabase
          .from('inventory_items')
          .update({
            quantity: 0,
            is_consumed: true,
            consumed_date: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', useItem.id)

        if (error) throw error
      } else {
        // Update quantity
        const { error } = await supabase
          .from('inventory_items')
          .update({
            quantity: newQuantity,
            updated_at: new Date().toISOString()
          })
          .eq('id', useItem.id)

        if (error) throw error
      }

      // Log usage in inventory_usage_log (if table exists)
      await supabase
        .from('inventory_usage_log')
        .insert({
          inventory_item_id: useItem.id,
          product_id: useItem.product_id,
          household_id: user.id,
          quantity_used: quantityToUse,
          unit: useItem.unit,
          used_date: new Date().toISOString(),
          remaining_quantity: newQuantity
        })
        .single()

      // Reload inventory
      await loadInventoryItems(user.id)
      setUseDialogOpen(false)
      setUseItem(null)
    } catch (error) {
      console.error('Error using item:', error)
    }
  }

  if (!user) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>Loading...</Typography>
      </Container>
    )
  }

  return (
    <Container maxWidth="lg" sx={{ mt: isMobile ? 2 : 4, px: isMobile ? 1 : 2 }}>
      {/* Mobile-Responsive Header */}
      <Box
        display="flex"
        flexDirection={isMobile ? 'column' : 'row'}
        justifyContent="space-between"
        alignItems={isMobile ? 'stretch' : 'center'}
        mb={3}
        gap={2}
      >
        <Box sx={{ mb: isMobile ? 2 : 0 }}>
          <Typography
            variant={isMobile ? "h5" : "h4"}
            component="h1"
            gutterBottom
            sx={{ fontSize: isMobile ? '1.5rem' : '2rem' }}
          >
            {storageLocation ? `${storageLocation.name}` : 'My Pantry'}
          </Typography>
          <Typography
            variant={isMobile ? "body2" : "body1"}
            color="textSecondary"
            sx={{ fontSize: isMobile ? '0.875rem' : '1rem' }}
          >
            {storageLocation
              ? `Items in ${storageLocation.name}`
              : 'Your pantry and freezer contents'
            }
          </Typography>
          {storageLocation && (
            <Chip
              icon={<LocationIcon />}
              label={`${storageLocation.type} - ${storageLocation.name}`}
              variant="outlined"
              size={isMobile ? "small" : "medium"}
              sx={{ mt: 1 }}
            />
          )}
        </Box>

        {/* Action Buttons - Stack on Mobile */}
        {isMobile ? (
          <Stack spacing={1} direction="column">
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => router.push('/inventory/quick-add')}
              fullWidth
              size="medium"
            >
              Add Item
            </Button>
            {voiceAssistantEnabled && (
              <Button
                variant="outlined"
                startIcon={<VoiceIcon />}
                onClick={() => setVoiceAssistantOpen(true)}
                fullWidth
                size="medium"
                color="secondary"
              >
                Voice Assistant
              </Button>
            )}
          </Stack>
        ) : (
          <Box display="flex" gap={2}>
            {voiceAssistantEnabled && (
              <Button
                variant="outlined"
                startIcon={<VoiceIcon />}
                onClick={() => setVoiceAssistantOpen(true)}
                size="large"
                color="secondary"
              >
                Voice Assistant
              </Button>
            )}
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => router.push('/inventory/quick-add')}
              size="large"
            >
              Add Item
            </Button>
          </Box>
        )}
      </Box>

      {/* Search and Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ mb: showFilters ? 2 : 0 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                placeholder="Search products, brands, locations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                  endAdornment: searchTerm && (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        onClick={() => setSearchTerm('')}
                      >
                        <ClearIcon />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                size={isMobile ? "small" : "medium"}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Box display="flex" gap={1}>
                <Button
                  variant="outlined"
                  startIcon={showFilters ? <ExpandLessIcon /> : <FilterIcon />}
                  onClick={() => setShowFilters(!showFilters)}
                  fullWidth={isMobile}
                >
                  {showFilters ? 'Hide Filters' : `Filters ${(selectedCategory !== 'all' || selectedLocation !== 'all') ? `(${[selectedCategory !== 'all' && 'category', selectedLocation !== 'all' && 'location'].filter(Boolean).length})` : ''}`}
                </Button>
                {(searchTerm || selectedCategory !== 'all' || selectedLocation !== 'all') && (
                  <Button
                    variant="text"
                    color="secondary"
                    onClick={() => {
                      setSearchTerm('')
                      setSelectedCategory('all')
                      setSelectedLocation('all')
                    }}
                  >
                    Clear All
                  </Button>
                )}
              </Box>
            </Grid>
          </Grid>
        </Box>

        <Collapse in={showFilters}>
          <Divider sx={{ my: 2 }} />
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size={isMobile ? "small" : "medium"}>
                <InputLabel>Category</InputLabel>
                <Select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  label="Category"
                >
                  <MenuItem value="all">All Categories</MenuItem>
                  {categories.map((category) => (
                    <MenuItem key={category} value={category}>
                      {category}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size={isMobile ? "small" : "medium"}>
                <InputLabel>Storage Location</InputLabel>
                <Select
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  label="Storage Location"
                  disabled={!!storageLocation} // Disable if filtered from URL
                >
                  <MenuItem value="all">All Locations</MenuItem>
                  {locations.map((location) => (
                    <MenuItem key={location.id} value={location.id}>
                      {location.name} ({location.type})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Collapse>
      </Paper>

      {/* Quick Stats - Responsive Grid */}
      <Grid container spacing={isMobile ? 2 : 3} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={6} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: isMobile ? 1.5 : 2 }}>
              <Box display="flex" alignItems="center">
                <PantryIcon
                  color="primary"
                  sx={{
                    mr: isMobile ? 1 : 2,
                    fontSize: isMobile ? 24 : 30
                  }}
                />
                <Box>
                  <Typography
                    variant={isMobile ? "body1" : "h6"}
                    sx={{ fontWeight: 'bold', fontSize: isMobile ? '1rem' : '1.25rem' }}
                  >
                    {storageLocation ? filteredItems.length : items.length}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="textSecondary"
                    sx={{ fontSize: isMobile ? '0.7rem' : '0.875rem' }}
                  >
                    Total Items
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={6} sm={6} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: isMobile ? 1.5 : 2 }}>
              <Box display="flex" alignItems="center">
                <CalendarIcon
                  color="warning"
                  sx={{
                    mr: isMobile ? 1 : 2,
                    fontSize: isMobile ? 24 : 30
                  }}
                />
                <Box>
                  <Typography
                    variant={isMobile ? "body1" : "h6"}
                    sx={{ fontWeight: 'bold', fontSize: isMobile ? '1rem' : '1.25rem' }}
                  >
                    {items.filter(item => {
                      const days = getDaysUntilExpiration(item.expiration_date)
                      return days !== null && days <= 7
                    }).length}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="textSecondary"
                    sx={{ fontSize: isMobile ? '0.7rem' : '0.875rem' }}
                  >
                    Expiring Soon
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Show loading state */}
      {loading && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <CircularProgress />
          <Typography sx={{ mt: 2 }}>Loading your inventory...</Typography>
        </Box>
      )}

      {/* Inventory Table */}
      {loading ? (
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error" sx={{ mb: 4 }}>
          {error}
        </Alert>
      ) : filteredItems.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <PantryIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            No items in your pantry yet
          </Typography>
          <Typography variant="body2" color="textSecondary" paragraph>
            Start by adding some items to track your pantry and freezer contents.
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => router.push('/inventory/quick-add')}
          >
            Add Your First Item
          </Button>
        </Paper>
      ) : isMobile ? (
        // Mobile Card View
        <Stack spacing={2}>
          {filteredItems.map((item) => (
            <Card key={item.id} variant="outlined">
              <CardContent sx={{ pb: 1 }}>
                {/* Product with Thumbnail */}
                <Box display="flex" mb={1} gap={1.5}>
                  {/* Thumbnail */}
                  {item.products?.image_url && (
                    <Avatar
                      src={item.products.image_url}
                      variant="rounded"
                      sx={{ width: 48, height: 48 }}
                    />
                  )}
                  {/* Product Name and Brand */}
                  <Box flex={1}>
                    <Typography
                      variant="subtitle1"
                      fontWeight="bold"
                      onClick={() => {
                        if (item.products?.id) {
                          router.push(`/inventory/product/${item.products.id}`)
                        }
                      }}
                      sx={{
                        color: item.products?.id ? 'primary.main' : 'text.primary',
                        textDecoration: 'none',
                        '&:active': { opacity: 0.8 }
                      }}
                    >
                      {item.products?.name || 'Unknown Product'}
                    </Typography>
                    {item.products?.brand && (
                      <Typography variant="caption" color="textSecondary" display="block">
                        {item.products.brand}
                      </Typography>
                    )}
                  </Box>
                </Box>

                {/* Quantity and Location Row */}
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Chip
                    label={`${item.quantity} ${item.unit}`}
                    size="small"
                    variant="outlined"
                  />
                  <Box
                    display="flex"
                    alignItems="center"
                    onClick={() => {
                      if (item.storage_locations?.id) {
                        router.push(`/inventory?location=${item.storage_locations.id}`)
                      }
                    }}
                    sx={{ '&:active': { opacity: 0.8 } }}
                  >
                    <LocationIcon fontSize="small" sx={{ mr: 0.5, fontSize: 16 }} />
                    <Typography variant="body2" color="primary">
                      {item.storage_locations?.name || 'Unknown'}
                    </Typography>
                  </Box>
                </Box>

                {/* Dates Row */}
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography variant="caption" color="textSecondary">
                    Purchased: {formatDate(item.purchase_date)}
                  </Typography>
                  {item.expiration_date && (
                    <Typography variant="caption" color="textSecondary">
                      Expires: {formatDate(item.expiration_date)}
                    </Typography>
                  )}
                </Box>

                {/* Status and Actions */}
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  {item.expiration_date && (
                    <Chip
                      size="small"
                      label={
                        getDaysUntilExpiration(item.expiration_date)! < 0
                          ? 'Expired'
                          : getDaysUntilExpiration(item.expiration_date) === 0
                          ? 'Today'
                          : `${getDaysUntilExpiration(item.expiration_date)} days`
                      }
                      color={getExpirationColor(item.expiration_date)}
                    />
                  )}
                  <Box display="flex" gap={1} sx={{ ml: 'auto' }}>
                    <Button
                      size="small"
                      startIcon={<UseIcon />}
                      onClick={() => handleUseItemClick(item)}
                      color="secondary"
                    >
                      Use
                    </Button>
                    <IconButton
                      size="small"
                      onClick={() => router.push(`/inventory/edit/${item.id}`)}
                      title="Edit"
                    >
                      <EditIcon />
                    </IconButton>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Stack>
      ) : (
        // Desktop Table View
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Product</TableCell>
                <TableCell>Quantity</TableCell>
                <TableCell>Location</TableCell>
                <TableCell>Purchase Date</TableCell>
                <TableCell>Expiration</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Box
                      display="flex"
                      alignItems="center"
                      gap={2}
                      onClick={() => {
                        if (item.products?.id) {
                          router.push(`/inventory/product/${item.products.id}`)
                        }
                      }}
                      sx={{
                        cursor: item.products?.id ? 'pointer' : 'default',
                        '&:hover': item.products?.id ? {
                          backgroundColor: 'action.hover',
                          borderRadius: 1,
                          p: 0.5,
                          m: -0.5
                        } : {}
                      }}
                    >
                      {/* Product Thumbnail */}
                      {item.products?.image_url && (
                        <Avatar
                          src={item.products.image_url}
                          variant="rounded"
                          sx={{ width: 40, height: 40 }}
                        />
                      )}
                      <Box>
                        <Typography
                          variant="body2"
                          fontWeight="medium"
                          sx={{
                            color: item.products?.id ? 'primary.main' : 'text.primary',
                            textDecoration: item.products?.id ? 'underline' : 'none',
                            '&:hover': item.products?.id ? { color: 'primary.dark' } : {}
                          }}
                        >
                          {item.products?.name || 'Unknown Product'}
                        </Typography>
                        {item.products?.brand && (
                          <Typography variant="caption" color="textSecondary">
                            {item.products.brand}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    {item.quantity} {item.unit}
                  </TableCell>
                  <TableCell>
                    <Box
                      display="flex"
                      alignItems="center"
                      onClick={() => {
                        if (item.storage_locations?.id) {
                          router.push(`/inventory?location=${item.storage_locations.id}`)
                        }
                      }}
                      sx={{
                        cursor: item.storage_locations?.id ? 'pointer' : 'default',
                        '&:hover': item.storage_locations?.id ? {
                          backgroundColor: 'action.hover',
                          borderRadius: 1,
                          p: 0.5,
                          m: -0.5
                        } : {}
                      }}
                    >
                      <LocationIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                      <Box>
                        <Typography
                          variant="body2"
                          sx={{
                            color: item.storage_locations?.id ? 'primary.main' : 'text.primary',
                            textDecoration: item.storage_locations?.id ? 'underline' : 'none',
                            '&:hover': item.storage_locations?.id ? { color: 'primary.dark' } : {}
                          }}
                        >
                          {(item.storage_locations as any)?.full_path || item.storage_locations?.name || 'Unknown Location'}
                        </Typography>
                        {(item.storage_locations as any)?.full_path && (item.storage_locations as any)?.full_path !== item.storage_locations?.name && (
                          <Typography variant="caption" color="textSecondary">
                            {item.storage_locations.type}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    {formatDate(item.purchase_date)}
                  </TableCell>
                  <TableCell>
                    {item.expiration_date ? formatDate(item.expiration_date) : 'No expiration'}
                  </TableCell>
                  <TableCell>
                    {item.expiration_date && (
                      <Chip
                        size="small"
                        label={
                          getDaysUntilExpiration(item.expiration_date)! < 0
                            ? 'Expired'
                            : getDaysUntilExpiration(item.expiration_date) === 0
                            ? 'Expires today'
                            : `${getDaysUntilExpiration(item.expiration_date)} days`
                        }
                        color={getExpirationColor(item.expiration_date)}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <Box display="flex" gap={1}>
                      <Button
                        size="small"
                        startIcon={<UseIcon />}
                        onClick={() => handleUseItemClick(item)}
                        color="secondary"
                        variant="outlined"
                      >
                        Use
                      </Button>
                      <IconButton
                        size="small"
                        onClick={() => router.push(`/inventory/edit/${item.id}`)}
                        title="Edit item details"
                      >
                        <EditIcon />
                      </IconButton>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Mobile Floating Action Button */}
      {isMobile && (
        <SpeedDial
          ariaLabel="Quick actions"
          sx={{
            position: 'fixed',
            bottom: 16,
            right: 16
          }}
          icon={<SpeedDialIcon />}
        >
          <SpeedDialAction
            icon={<AddIcon />}
            tooltipTitle="Add Item"
            onClick={() => router.push('/inventory/quick-add')}
          />
          {voiceAssistantEnabled && (
            <SpeedDialAction
              icon={<VoiceIcon />}
              tooltipTitle="Voice Assistant"
              onClick={() => setVoiceAssistantOpen(true)}
            />
          )}
        </SpeedDial>
      )}

      {/* Use Item Dialog */}
      <Dialog open={useDialogOpen} onClose={() => setUseDialogOpen(false)}>
        <DialogTitle>Use Item</DialogTitle>
        <DialogContent>
          {useItem && (
            <>
              <Box display="flex" alignItems="center" gap={2} mb={2}>
                {useItem.products?.image_url && (
                  <Avatar
                    src={useItem.products.image_url}
                    variant="rounded"
                    sx={{ width: 60, height: 60 }}
                  />
                )}
                <Box>
                  <Typography variant="h6">
                    {useItem.products?.name || 'Unknown Product'}
                  </Typography>
                  {useItem.products?.brand && (
                    <Typography variant="body2" color="textSecondary">
                      {useItem.products.brand}
                    </Typography>
                  )}
                  <Typography variant="body2" color="textSecondary">
                    Current quantity: {useItem.quantity} {useItem.unit}
                  </Typography>
                </Box>
              </Box>

              {useItem.quantity > 1 && (
                <>
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    How many {useItem.unit} would you like to use?
                  </Typography>
                  <TextField
                    type="number"
                    label="Quantity to use"
                    value={useQuantity}
                    onChange={(e) => setUseQuantity(Math.min(Number(e.target.value), useItem.quantity))}
                    InputProps={{
                      inputProps: {
                        min: 1,
                        max: useItem.quantity
                      }
                    }}
                    fullWidth
                    autoFocus
                  />
                </>
              )}

              {useItem.quantity <= 1 && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  This will mark the item as completely used.
                </Alert>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUseDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleUseItemConfirm}
            variant="contained"
            color="secondary"
            disabled={!useItem || (useItem.quantity > 1 && (!useQuantity || useQuantity <= 0))}
          >
            Confirm Use
          </Button>
        </DialogActions>
      </Dialog>

      {/* Voice Assistant Dialog */}
      {user && voiceAssistantType === 'whisper' ? (
        <WhisperVoiceAssistant
          open={voiceAssistantOpen}
          onClose={() => setVoiceAssistantOpen(false)}
          userId={user.id}
          onSuccess={async () => {
            // Reload inventory after successful voice command
            await loadInventoryItems(user.id)
          }}
        />
      ) : user && voiceAssistantType === 'basic' ? (
        <VoiceAssistant
          open={voiceAssistantOpen}
          onClose={() => setVoiceAssistantOpen(false)}
          userId={user.id}
        />
      ) : null}
    </Container>
  )
}

export default function InventoryPage() {
  return (
    <Suspense fallback={
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
          <CircularProgress />
        </Box>
      </Container>
    }>
      <InventoryPageContent />
    </Suspense>
  )
}