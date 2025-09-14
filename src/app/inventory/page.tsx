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
  IconButton
} from '@mui/material'
import {
  Add as AddIcon,
  Kitchen as PantryIcon,
  LocationOn as LocationIcon,
  CalendarToday as CalendarIcon,
  Launch as LaunchIcon,
  Edit as EditIcon
} from '@mui/icons-material'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAppDispatch, useAppSelector } from '@/hooks/redux'
import { fetchInventoryItems } from '@/store/slices/inventorySlice'
import { fetchHousehold } from '@/store/slices/householdSlice'
import { supabase } from '@/lib/supabase'

export default function InventoryPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const dispatch = useAppDispatch()
  const { items: reduxItems, loading: reduxLoading, error: reduxError } = useAppSelector((state) => state.inventory)
  const { household } = useAppSelector((state) => state.household)
  const [user, setUser] = useState<any>(null)
  const [storageLocation, setStorageLocation] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [filteredItems, setFilteredItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
      // Ensure household exists
      await supabase
        .from('households')
        .upsert([{ id: userId, name: 'My Household' }], { onConflict: 'id' })

      // First, load all storage locations to build paths
      const { data: allStorageLocations, error: locationsError } = await supabase
        .from('storage_locations')
        .select('*')
        .eq('household_id', userId)
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
        .eq('household_id', userId)
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

    } catch (err: any) {
      console.error('💥 Failed to load inventory:', err)
      setError(`Failed to load inventory: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUser(session.user)
        await loadInventoryItems(session.user.id)

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

  // Filter items by storage location when items or storageLocation changes
  useEffect(() => {
    if (storageLocation && items) {
      const filtered = items.filter((item: any) =>
        item.storage_location_id === storageLocation.id
      )
      console.log('🔍 Filtered items for', storageLocation.name, ':', filtered.length)
      setFilteredItems(filtered)
    } else {
      setFilteredItems(items || [])
    }
  }, [items, storageLocation])

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

  if (!user) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>Loading...</Typography>
      </Container>
    )
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            {storageLocation ? `${storageLocation.name}` : 'My Pantry'}
          </Typography>
          <Typography variant="body1" color="textSecondary">
            {storageLocation
              ? `Items stored in ${storageLocation.name}`
              : 'Your complete pantry and freezer contents'
            }
          </Typography>
          {storageLocation && (
            <Chip
              icon={<LocationIcon />}
              label={`${storageLocation.type} - ${storageLocation.name}`}
              variant="outlined"
              sx={{ mt: 1 }}
            />
          )}
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => router.push('/inventory/quick-add')}
          size="large"
        >
          Add Item
        </Button>
      </Box>

      {/* Quick Stats */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <PantryIcon color="primary" sx={{ mr: 2 }} />
                <Box>
                  <Typography variant="h6">
                    {storageLocation ? filteredItems.length : items.length}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Total Items
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <CalendarIcon color="warning" sx={{ mr: 2 }} />
                <Box>
                  <Typography variant="h6">
                    {items.filter(item => {
                      const days = getDaysUntilExpiration(item.expiration_date)
                      return days !== null && days <= 7
                    }).length}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
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
      ) : (
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
                    <IconButton
                      size="small"
                      onClick={() => router.push(`/inventory/edit/${item.id}`)}
                      title="Edit item details"
                    >
                      <EditIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Container>
  )
}