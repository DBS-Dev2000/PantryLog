'use client'

import { useState, useEffect, useRef } from 'react'
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
  CircularProgress,
  Avatar,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Autocomplete,
  IconButton
} from '@mui/material'
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Edit as EditIcon,
  History as HistoryIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckCircleIcon,
  MoveUp as MoveIcon,
  LocationOn as LocationIcon,
  CameraAlt as CameraIcon,
  CloudUpload as CloudUploadIcon
} from '@mui/icons-material'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface InventoryItemDetail {
  id: string
  quantity: number
  unit: string
  purchase_date: string
  expiration_date?: string
  cost?: number
  notes?: string
  created_by?: string
  created_at: string
  last_modified_by?: string
  last_modified_at?: string
  storage_location_id: string
  products: {
    id: string
    name: string
    brand?: string
    image_url?: string
    upc?: string
  }
  storage_locations: {
    id: string
    name: string
    type: string
  }
}

const units = [
  'pieces', 'lbs', 'oz', 'kg', 'g', 'cups', 'tbsp', 'tsp', 'cans', 'bottles', 'boxes', 'bags'
]

// Helper function to organize locations hierarchically
const organizeLocationsHierarchically = (locations: any[]) => {
  const locationMap = new Map()
  const rootLocations: any[] = []

  // First pass: create a map of all locations
  locations.forEach(loc => {
    locationMap.set(loc.id, { ...loc, children: [] })
  })

  // Second pass: organize into hierarchy
  locations.forEach(loc => {
    if (loc.parent_id) {
      const parent = locationMap.get(loc.parent_id)
      if (parent) {
        parent.children.push(locationMap.get(loc.id))
      }
    } else {
      rootLocations.push(locationMap.get(loc.id))
    }
  })

  // Flatten the hierarchy for display with indentation indicators
  const flattenedLocations: any[] = []
  const addLocationWithChildren = (location: any, level = 0) => {
    flattenedLocations.push({ ...location, level })
    if (location.children && location.children.length > 0) {
      location.children.sort((a: any, b: any) => a.name.localeCompare(b.name))
      location.children.forEach((child: any) => {
        addLocationWithChildren(child, level + 1)
      })
    }
  }

  rootLocations.sort((a, b) => a.name.localeCompare(b.name))
  rootLocations.forEach(loc => addLocationWithChildren(loc))

  return flattenedLocations
}

export default function EditInventoryItemPage() {
  const router = useRouter()
  const params = useParams()
  const itemId = params.id as string

  const [user, setUser] = useState<any>(null)
  const [item, setItem] = useState<InventoryItemDetail | null>(null)
  const [originalItem, setOriginalItem] = useState<InventoryItemDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [markUsedDialogOpen, setMarkUsedDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [markingUsed, setMarkingUsed] = useState(false)
  const [availableLocations, setAvailableLocations] = useState<any[]>([])
  const [customProductName, setCustomProductName] = useState('')
  const [editingProductName, setEditingProductName] = useState(false)

  // Image handling states
  const [productImageUrl, setProductImageUrl] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)
  const [imageUrlInput, setImageUrlInput] = useState('')
  const [showImageOptions, setShowImageOptions] = useState(false)
  const imageUploadRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUser(session.user)
        await loadItemData(session.user.id)
      } else {
        router.push('/auth')
      }
    }

    getUser()
  }, [router, itemId])

  const loadItemData = async (userId: string) => {
    setLoading(true)
    try {
      // Load the food item
      const { data: itemData, error } = await supabase
        .from('inventory_items')
        .select(`
          *,
          products (*),
          storage_locations (*)
        `)
        .eq('id', itemId)
        .eq('household_id', userId)
        .single()

      if (error) throw error

      setItem(itemData as InventoryItemDetail)
      setOriginalItem(itemData as InventoryItemDetail) // Keep original for comparison
      setCustomProductName(itemData.products?.name || '')
      setProductImageUrl(itemData.products?.image_url || '')
      setImageUrlInput(itemData.products?.image_url || '')
      setShowImageOptions(!itemData.products?.image_url)
      console.log('📦 Loaded item for editing:', itemData.products?.name)

      // Load available storage locations for moving
      const { data: locations, error: locError } = await supabase
        .from('storage_locations')
        .select('*')
        .eq('household_id', userId)
        .eq('is_active', true)
        .order('parent_id', { nullsFirst: true })
        .order('name')

      if (locError) {
        console.warn('Failed to load locations:', locError)
      } else {
        // Organize locations hierarchically
        const organizedLocations = organizeLocationsHierarchically(locations || [])
        setAvailableLocations(organizedLocations)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!user || !item || !originalItem) return

    setSaving(true)
    setError(null)

    try {
      // Calculate what changed for audit logging
      const changes: string[] = []
      let hasChanges = false

      if (item.quantity !== originalItem.quantity) {
        changes.push(`Quantity: ${originalItem.quantity} → ${item.quantity}`)
        hasChanges = true
      }
      if (item.unit !== originalItem.unit) {
        changes.push(`Unit: ${originalItem.unit} → ${item.unit}`)
        hasChanges = true
      }
      if (item.purchase_date !== originalItem.purchase_date) {
        changes.push(`Purchase Date: ${originalItem.purchase_date} → ${item.purchase_date}`)
        hasChanges = true
      }
      if (item.expiration_date !== originalItem.expiration_date) {
        changes.push(`Expiration: ${originalItem.expiration_date || 'None'} → ${item.expiration_date || 'None'}`)
        hasChanges = true
      }
      if (item.cost !== originalItem.cost) {
        changes.push(`Cost: $${originalItem.cost || 0} → $${item.cost || 0}`)
        hasChanges = true
      }
      if (item.notes !== originalItem.notes) {
        changes.push(`Notes: ${originalItem.notes || 'None'} → ${item.notes || 'None'}`)
        hasChanges = true
      }

      if (!hasChanges) {
        setError('No changes detected')
        setSaving(false)
        return
      }

      // Update food item
      const { error: updateError } = await supabase
        .from('inventory_items')
        .update({
          quantity: item.quantity,
          unit: item.unit,
          purchase_date: item.purchase_date,
          expiration_date: item.expiration_date || null,
          cost: item.cost || null,
          notes: item.notes || null,
          last_modified_by: user.id,
          last_modified_at: new Date().toISOString()
        })
        .eq('id', itemId)

      if (updateError) throw updateError

      // Log the edit in audit trail
      const { error: auditError } = await supabase
        .from('inventory_audit_log')
        .insert([{
          inventory_item_id: itemId,
          household_id: user.id,
          user_id: user.id,
          action_type: 'edit',
          quantity_before: originalItem.quantity,
          quantity_after: item.quantity,
          quantity_delta: item.quantity - originalItem.quantity,
          unit_cost: item.cost ? item.cost / item.quantity : 0,
          total_value: Math.abs(item.quantity - originalItem.quantity) * (item.cost ? item.cost / item.quantity : 0),
          notes: `Manual Edit: ${changes.join('; ')}`,
          source_action: 'manual_edit'
        }])

      if (auditError) {
        console.warn('Failed to log audit trail:', auditError)
      } else {
        console.log('✅ Audit logged: Manual edit with changes:', changes.length)
      }

      setSuccess(true)
      setOriginalItem(item) // Update original for future comparisons

      // Navigate back after success
      setTimeout(() => {
        router.back()
      }, 2000)

    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleMarkAsUsed = async () => {
    if (!user || !item) return

    setMarkingUsed(true)
    setError(null)

    try {
      // Log in audit trail as consumed
      const { error: auditError } = await supabase
        .from('inventory_audit_log')
        .insert([{
          inventory_item_id: itemId,
          household_id: user.id,
          user_id: user.id,
          action_type: 'consume',
          quantity_before: item.quantity,
          quantity_after: 0,
          quantity_delta: -item.quantity,
          unit_cost: item.cost ? item.cost / item.quantity : 0,
          total_value: item.cost || 0,
          notes: `Food marked as used/consumed`,
          source_action: 'manual_consume'
        }])

      if (auditError) {
        console.warn('Failed to log audit trail:', auditError)
      }

      // Delete the food item (or set quantity to 0)
      const { error: deleteError } = await supabase
        .from('inventory_items')
        .delete()
        .eq('id', itemId)

      if (deleteError) throw deleteError

      console.log('✅ Food marked as used and logged for stats')
      setSuccess(true)
      setMarkUsedDialogOpen(false)

      // Navigate back after success
      setTimeout(() => {
        router.push('/inventory')
      }, 1500)

    } catch (err: any) {
      setError(err.message)
    } finally {
      setMarkingUsed(false)
    }
  }

  const handleDelete = async () => {
    if (!user || !item) return

    setDeleting(true)
    setError(null)

    try {
      // Log in audit trail as deleted
      const { error: auditError } = await supabase
        .from('inventory_audit_log')
        .insert([{
          inventory_item_id: itemId,
          household_id: user.id,
          user_id: user.id,
          action_type: 'delete',
          quantity_before: item.quantity,
          quantity_after: 0,
          quantity_delta: -item.quantity,
          notes: `Food deleted (data entry error or AI mistake)`,
          source_action: 'manual_delete'
        }])

      if (auditError) {
        console.warn('Failed to log audit trail:', auditError)
      }

      // Delete the food item
      const { error: deleteError } = await supabase
        .from('inventory_items')
        .delete()
        .eq('id', itemId)

      if (deleteError) throw deleteError

      console.log('🗑️ Food deleted from pantry')
      setDeleteDialogOpen(false)

      // Navigate back immediately
      router.push('/inventory')

    } catch (err: any) {
      setError(err.message)
    } finally {
      setDeleting(false)
    }
  }

  const handleUpdateProductName = async () => {
    if (!user || !item || !customProductName) return

    try {
      // Update the product name
      const { error: updateError } = await supabase
        .from('products')
        .update({ name: customProductName })
        .eq('id', item.products.id)

      if (updateError) throw updateError

      // Update local state
      setItem({
        ...item,
        products: {
          ...item.products,
          name: customProductName
        }
      })

      setEditingProductName(false)
      console.log('✅ Product name updated')
    } catch (err: any) {
      console.error('Failed to update product name:', err)
      setError('Failed to update product name')
    }
  }

  // Handle image upload
  const handleImageUpload = async (file: File) => {
    if (!file || !item) return

    setUploadingImage(true)
    setError(null)

    try {
      // Validate file type
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
      if (!validTypes.includes(file.type)) {
        throw new Error('Invalid file type. Please upload a JPEG, PNG, GIF, or WebP image.')
      }

      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('File size must be less than 5MB')
      }

      const fileExt = file.name.split('.').pop()
      const fileName = `product-${item.products.id}-${Date.now()}.${fileExt}`
      const filePath = `product-images/${fileName}`

      console.log('📤 Uploading product image:', filePath)

      // Upload to Supabase storage
      const { error: uploadError, data } = await supabase.storage
        .from('product-images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        console.error('Storage upload error:', uploadError)
        if (uploadError.message?.includes('Bucket not found')) {
          // Try to create the bucket
          const { error: bucketError } = await supabase.storage.createBucket('product-images', {
            public: true
          })

          if (!bucketError || bucketError.message?.includes('already exists')) {
            // Retry upload
            const { error: retryError, data: retryData } = await supabase.storage
              .from('product-images')
              .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
              })

            if (retryError) throw retryError
          } else {
            throw new Error('Storage bucket not configured. Please contact support.')
          }
        } else {
          throw uploadError
        }
      }

      console.log('✅ Upload successful:', data)

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath)

      await updateProductImage(publicUrl)

    } catch (err: any) {
      console.error('Error uploading image:', err)
      setError(err.message || 'Failed to upload image')
    } finally {
      setUploadingImage(false)
    }
  }

  // Handle image URL change
  const handleImageUrlChange = async (url: string) => {
    setImageUrlInput(url)
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      await updateProductImage(url)
    }
  }

  // Update product with new image
  const updateProductImage = async (imageUrl: string) => {
    if (!item) return

    try {
      // Update the product image
      const { error: updateError } = await supabase
        .from('products')
        .update({ image_url: imageUrl })
        .eq('id', item.products.id)

      if (updateError) throw updateError

      // Update local state
      setProductImageUrl(imageUrl)
      setItem({
        ...item,
        products: {
          ...item.products,
          image_url: imageUrl
        }
      })

      setShowImageOptions(false)
      console.log('✅ Product image updated')
    } catch (err: any) {
      console.error('Failed to update product image:', err)
      setError('Failed to update product image')
    }
  }

  if (!user || loading) {
    return (
      <Container maxWidth="md" sx={{ mt: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>Loading food details...</Typography>
      </Container>
    )
  }

  if (error && !item) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.back()}
        >
          Back to Pantry
        </Button>
      </Container>
    )
  }

  if (!item) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Typography>Food item not found</Typography>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.back()}
        >
          Back to Pantry
        </Button>
      </Container>
    )
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <Box display="flex" alignItems="center" mb={4}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.back()}
          sx={{ mr: 2 }}
        >
          Back
        </Button>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Edit Food Item
          </Typography>
          <Typography variant="body1" color="textSecondary">
            Adjust purchase date, price, and other details
          </Typography>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Food item updated successfully! Returning to pantry...
        </Alert>
      )}

      {/* Product Information Header */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" alignItems="center" gap={2}>
            {productImageUrl ? (
              <Avatar
                src={productImageUrl}
                sx={{ width: 60, height: 60 }}
                variant="rounded"
              />
            ) : (
              <Box
                sx={{
                  width: 60,
                  height: 60,
                  border: '2px dashed',
                  borderColor: 'primary.main',
                  borderRadius: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  bgcolor: 'action.hover',
                  '&:hover': {
                    bgcolor: 'action.selected'
                  }
                }}
                onClick={() => setShowImageOptions(true)}
                title="Click to add product image"
              >
                <CameraIcon color="primary" />
              </Box>
            )}
            <Box sx={{ flexGrow: 1 }}>
              {editingProductName ? (
                <Box display="flex" gap={1} alignItems="center">
                  <TextField
                    value={customProductName}
                    onChange={(e) => setCustomProductName(e.target.value)}
                    size="small"
                    sx={{ flexGrow: 1 }}
                  />
                  <Button size="small" onClick={handleUpdateProductName}>Save</Button>
                  <Button size="small" onClick={() => {
                    setEditingProductName(false)
                    setCustomProductName(item.products?.name || '')
                  }}>Cancel</Button>
                </Box>
              ) : (
                <Box display="flex" alignItems="center" gap={1}>
                  <Typography variant="h6">{item.products?.name}</Typography>
                  <IconButton
                    size="small"
                    onClick={() => setEditingProductName(true)}
                    title="Edit product name"
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Box>
              )}
              {item.products?.brand && (
                <Typography variant="body2" color="textSecondary">
                  by {item.products.brand}
                </Typography>
              )}
              <Box display="flex" gap={1} mt={1}>
                <Chip
                  size="small"
                  label={item.storage_locations?.name}
                  icon={<LocationIcon />}
                />
                {item.products?.upc && (
                  <Chip size="small" label={item.products.upc} variant="outlined" />
                )}
              </Box>
            </Box>
          </Box>

          {/* Quick Action Buttons */}
          <Box display="flex" gap={1} mt={2} flexWrap="wrap">
            <Button
              variant="outlined"
              color="success"
              size="small"
              startIcon={<CheckCircleIcon />}
              onClick={() => setMarkUsedDialogOpen(true)}
            >
              Mark as Used
            </Button>
            <Button
              variant="outlined"
              color="error"
              size="small"
              startIcon={<DeleteIcon />}
              onClick={() => setDeleteDialogOpen(true)}
            >
              Delete Food Item
            </Button>
            <Button
              variant="outlined"
              color="info"
              size="small"
              startIcon={<CameraIcon />}
              onClick={() => setShowImageOptions(!showImageOptions)}
            >
              {productImageUrl ? 'Change Image' : 'Add Image'}
            </Button>
          </Box>

          {/* Image Options Section */}
          {showImageOptions && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Typography variant="subtitle2" gutterBottom>
                Add Product Image
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Button
                    variant="outlined"
                    startIcon={<CloudUploadIcon />}
                    onClick={() => imageUploadRef.current?.click()}
                    disabled={uploadingImage}
                    fullWidth
                  >
                    {uploadingImage ? 'Uploading...' : 'Upload Image'}
                  </Button>
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    ref={imageUploadRef}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleImageUpload(file)
                    }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Or paste image URL"
                    value={imageUrlInput}
                    onChange={(e) => setImageUrlInput(e.target.value)}
                    placeholder="https://example.com/image.jpg"
                    size="small"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleImageUrlChange(imageUrlInput)
                      }
                    }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Box display="flex" gap={1}>
                    <Button
                      size="small"
                      onClick={() => handleImageUrlChange(imageUrlInput)}
                      disabled={!imageUrlInput || uploadingImage}
                    >
                      Save URL
                    </Button>
                    <Button
                      size="small"
                      color="secondary"
                      onClick={() => {
                        setShowImageOptions(false)
                        setImageUrlInput(productImageUrl)
                      }}
                    >
                      Cancel
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            </Box>
          )}

          {/* Image Preview if just added */}
          {productImageUrl && showImageOptions && (
            <Box sx={{ mt: 1, textAlign: 'center' }}>
              <img
                src={productImageUrl}
                alt="Product"
                style={{
                  maxWidth: '200px',
                  maxHeight: '200px',
                  borderRadius: '8px'
                }}
              />
              <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                Image added successfully!
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Edit Form */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            <EditIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Food Details
          </Typography>

          <Box>
            {/* First row: Quantity and Unit */}
            <Box
              display="flex"
              flexDirection={{ xs: 'column', sm: 'row' }}
              gap={2}
              mb={2}
            >
              <TextField
                label="Quantity"
                type="number"
                fullWidth
                value={item.quantity}
                onChange={(e) => setItem({ ...item, quantity: parseFloat(e.target.value) || 0 })}
                inputProps={{ step: 0.01, min: 0 }}
                sx={{ flex: { xs: '1 1 100%', sm: 1 } }}
              />
              <FormControl fullWidth sx={{ flex: { xs: '1 1 100%', sm: 1 } }}>
                <InputLabel>Unit</InputLabel>
                <Select
                  value={item.unit}
                  label="Unit"
                  onChange={(e) => setItem({ ...item, unit: e.target.value })}
                >
                  {units.map((unit) => (
                    <MenuItem key={unit} value={unit}>
                      {unit}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            {/* Row 2: Dates side by side */}
            <Box
              display="flex"
              flexDirection={{ xs: 'column', sm: 'row' }}
              gap={2}
              mb={2}
            >
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="Purchase Date"
                  value={item.purchase_date ? new Date(item.purchase_date) : null}
                  onChange={(newValue) => {
                    setItem({
                      ...item,
                      purchase_date: newValue ? newValue.toISOString().split('T')[0] : ''
                    })
                  }}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      sx: { flex: 1 }
                    }
                  }}
                />
              </LocalizationProvider>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="Expiration Date"
                  value={item.expiration_date ? new Date(item.expiration_date) : null}
                  onChange={(newValue) => {
                    setItem({
                      ...item,
                      expiration_date: newValue ? newValue.toISOString().split('T')[0] : undefined
                    })
                  }}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      sx: { flex: 1 }
                    }
                  }}
                />
              </LocalizationProvider>
            </Box>

            {/* Third row: Storage Location (full width) */}
            <Box mb={2}>
              <FormControl fullWidth>
                <InputLabel>Storage Location</InputLabel>
                <Select
                  value={item.storage_location_id}
                  label="Storage Location"
                  onChange={(e) => {
                    const newLocationId = e.target.value
                    const newLocation = availableLocations.find(l => l.id === newLocationId)
                    if (newLocation) {
                      setItem({
                        ...item,
                        storage_location_id: newLocationId,
                        storage_locations: newLocation
                      })
                    }
                  }}
                  startAdornment={<MoveIcon sx={{ mr: 1, color: 'action.active' }} />}
                >
                  {availableLocations.map((location) => (
                    <MenuItem key={location.id} value={location.id}>
                      <Box
                        display="flex"
                        alignItems="center"
                        gap={1}
                        sx={{ pl: location.level ? location.level * 3 : 0 }}
                      >
                        {location.level > 0 && (
                          <Box
                            component="span"
                            sx={{
                              color: 'text.secondary',
                              fontSize: '0.875rem',
                              mr: 0.5
                            }}
                          >
                            └─
                          </Box>
                        )}
                        <LocationIcon fontSize="small" />
                        <Typography
                          fontWeight={location.level === 0 ? 600 : 400}
                        >
                          {location.name}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          ({location.type})
                        </Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            {/* Fourth row: Total Cost and Cost per unit */}
            <Box
              display="flex"
              flexDirection={{ xs: 'column', sm: 'row' }}
              gap={2}
              mb={2}
            >
              <TextField
                label="Total Cost"
                type="number"
                fullWidth
                value={item.cost || ''}
                onChange={(e) => setItem({ ...item, cost: parseFloat(e.target.value) || undefined })}
                inputProps={{ step: 0.01, min: 0 }}
                helperText="Total cost for this quantity"
                sx={{ flex: { xs: '1 1 100%', sm: 1 } }}
              />
              <Box sx={{ flex: { xs: '1 1 100%', sm: 1 } }}>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Cost per unit:
                </Typography>
                <Typography variant="h6" color="primary.main">
                  ${item.cost && item.quantity ? (item.cost / item.quantity).toFixed(2) : '0.00'}
                </Typography>
              </Box>
            </Box>

            {/* Fifth row: Notes (full width) */}
            <Box mb={2}>
              <TextField
                label="Notes"
                multiline
                rows={3}
                fullWidth
                value={item.notes || ''}
                onChange={(e) => setItem({ ...item, notes: e.target.value })}
                placeholder="Add any notes about this item..."
              />
            </Box>

            {/* Last row: Action buttons on their own line */}
            <Box display="flex" gap={2} justifyContent="flex-end">
              <Button
                variant="outlined"
                onClick={() => router.back()}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={handleSave}
                disabled={saving}
                startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Audit Trail Preview */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            <HistoryIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Food History
          </Typography>
          <Box sx={{ backgroundColor: 'grey.50', p: 2, borderRadius: 1 }}>
            <Typography variant="body2" color="textSecondary">
              <strong>Created:</strong> {new Date(item.created_at).toLocaleString()}
            </Typography>
            {item.last_modified_at && item.last_modified_at !== item.created_at && (
              <Typography variant="body2" color="textSecondary">
                <strong>Last Modified:</strong> {new Date(item.last_modified_at).toLocaleString()}
              </Typography>
            )}
            <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
              Full audit trail available in pantry management system
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {/* Mark as Used Confirmation Dialog */}
      <Dialog
        open={markUsedDialogOpen}
        onClose={() => setMarkUsedDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <CheckCircleIcon color="success" />
            Mark Food as Used
          </Box>
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to mark this food as used? This will:
          </DialogContentText>
          <Box sx={{ mt: 2, pl: 2 }}>
            <Typography variant="body2" component="li">
              Remove the food from your pantry
            </Typography>
            <Typography variant="body2" component="li">
              Log the consumption for budget tracking
            </Typography>
            <Typography variant="body2" component="li">
              Update your usage statistics
            </Typography>
          </Box>
          <Alert severity="info" sx={{ mt: 2 }}>
            Food: <strong>{item?.products?.name}</strong> ({item?.quantity} {item?.unit})
            {item?.cost && (
              <Box>Value: <strong>${item.cost.toFixed(2)}</strong></Box>
            )}
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMarkUsedDialogOpen(false)} disabled={markingUsed}>
            Cancel
          </Button>
          <Button
            onClick={handleMarkAsUsed}
            color="success"
            variant="contained"
            disabled={markingUsed}
            startIcon={markingUsed ? <CircularProgress size={20} /> : <CheckCircleIcon />}
          >
            {markingUsed ? 'Processing...' : 'Mark as Used'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <DeleteIcon color="error" />
            Delete Food Item
          </Box>
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this food item? This action cannot be undone.
          </DialogContentText>
          <Alert severity="warning" sx={{ mt: 2 }}>
            This should only be used if the food was added by mistake or AI incorrectly identified it.
            If you've consumed the food, use "Mark as Used" instead.
          </Alert>
          <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
            <Typography variant="body2">
              Food: <strong>{item?.products?.name}</strong>
            </Typography>
            <Typography variant="body2">
              Quantity: {item?.quantity} {item?.unit}
            </Typography>
            <Typography variant="body2">
              Location: {item?.storage_locations?.name}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button
            onClick={handleDelete}
            color="error"
            variant="contained"
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={20} /> : <DeleteIcon />}
          >
            {deleting ? 'Deleting...' : 'Delete Food Item'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}
