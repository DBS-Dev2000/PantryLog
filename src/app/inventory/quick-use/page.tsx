'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Grid,
  Alert,
  Paper,
  IconButton,
  CircularProgress,
  Fade,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Chip,
  Avatar,
  LinearProgress,
  ButtonGroup,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Radio,
  RadioGroup,
  FormControlLabel
} from '@mui/material'
import {
  ArrowBack as ArrowBackIcon,
  QrCodeScanner as ScannerIcon,
  CameraAlt as CameraIcon,
  Check as CheckIcon,
  Remove as RemoveIcon,
  Inventory as InventoryIcon,
  LocationOn as LocationIcon,
  Refresh as RefreshIcon,
  Add as AddIcon,
  Backspace as BackspaceIcon,
  SwapHoriz as SwapIcon
} from '@mui/icons-material'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BarcodeScanner from '@/components/BarcodeScanner'
import QRScanner from '@/components/QRScanner'

interface ProductData {
  id: string
  name: string
  brand?: string
  image_url?: string
  upc: string
}

interface StorageLocationData {
  id: string
  name: string
  type: string
  full_path?: string
}

interface InventoryItem {
  id: string
  quantity: number
  unit: string
  purchase_date: string
  expiration_date?: string
  storage_location_id: string
  product_id: string
}

type WorkflowMode = 'location-first' | 'item-first'

export default function QuickUsePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const itemInputRef = useRef<HTMLInputElement>(null)
  const locationInputRef = useRef<HTMLInputElement>(null)

  const [user, setUser] = useState<any>(null)
  const [workflowMode, setWorkflowMode] = useState<WorkflowMode>('item-first')
  const [activeStep, setActiveStep] = useState(0)
  const [productData, setProductData] = useState<ProductData | null>(null)
  const [storageLocation, setStorageLocation] = useState<StorageLocationData | null>(null)
  const [availableItems, setAvailableItems] = useState<InventoryItem[]>([])
  const [selectedItem, setSelectedItem] = useState<string>('')
  const [itemBarcode, setItemBarcode] = useState('')
  const [locationCode, setLocationCode] = useState('')
  const [removeQuantity, setRemoveQuantity] = useState(1)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false)
  const [showQRScanner, setShowQRScanner] = useState(false)

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUser(session.user)
      } else {
        router.push('/auth')
      }
    }

    getUser()

    // Check if we came from a QR code scan or barcode scan
    const locationParam = searchParams.get('location')
    const itemParam = searchParams.get('item')

    if (locationParam) {
      console.log('🔗 Came from location QR scan:', locationParam)
      setWorkflowMode('location-first')
      setLocationCode(locationParam)
      loadStorageLocationFromId(locationParam)
    } else if (itemParam) {
      console.log('🔗 Came from item barcode scan:', itemParam)
      setWorkflowMode('item-first')
      setItemBarcode(itemParam)
      lookupProduct(itemParam)
    }
  }, [router, searchParams])

  // Load storage location from QR code
  const loadStorageLocationFromId = async (locationId: string) => {
    try {
      const { data: location, error } = await supabase
        .from('storage_locations')
        .select('*')
        .eq('id', locationId)
        .single()

      if (error) throw error

      // Build full path
      const { data: allLocations } = await supabase
        .from('storage_locations')
        .select('*')
        .eq('household_id', user?.id || '')

      const fullPath = buildLocationPath(locationId, allLocations || [])

      setStorageLocation({
        ...location,
        full_path: fullPath
      })

      if (workflowMode === 'location-first') {
        setActiveStep(1)
        await loadLocationInventory(locationId)
      }

      console.log('📍 Location loaded:', location.name)
    } catch (err) {
      console.error('Error loading location:', err)
      setError('Invalid storage location')
    }
  }

  // Load inventory items in a specific location
  const loadLocationInventory = async (locationId: string) => {
    try {
      const { data: items, error } = await supabase
        .from('inventory_items')
        .select(`
          *,
          products (*)
        `)
        .eq('storage_location_id', locationId)
        .eq('household_id', user?.id || '')
        .eq('is_consumed', false)
        .order('purchase_date')

      if (error) throw error

      setAvailableItems(items || [])
      console.log('📦 Loaded location inventory:', items?.length || 0, 'items')
    } catch (err) {
      console.error('Error loading location inventory:', err)
      setError('Failed to load location inventory')
    }
  }

  // Build location path helper
  const buildLocationPath = (locationId: string, allLocations: any[]): string => {
    const location = allLocations.find(l => l.id === locationId)
    if (!location) return 'Unknown Location'

    if (location.parent_id) {
      const parentPath = buildLocationPath(location.parent_id, allLocations)
      return `${parentPath} > ${location.name}`
    }
    return location.name
  }

  // Look up product by barcode
  const lookupProduct = async (barcode: string) => {
    setLookupLoading(true)
    setError(null)

    try {
      // Check database first
      const { data: existingProduct, error: dbError } = await supabase
        .from('products')
        .select('*')
        .eq('upc', barcode)
        .maybeSingle()

      if (existingProduct) {
        setProductData({
          id: existingProduct.id,
          name: existingProduct.name,
          brand: existingProduct.brand || undefined,
          image_url: existingProduct.image_url || undefined,
          upc: barcode
        })

        if (workflowMode === 'item-first') {
          setActiveStep(1)
          await loadProductLocations(existingProduct.id)
        } else {
          // Location-first mode, move to quantity step
          setActiveStep(2)
        }
        return
      }

      // Try external API
      const response = await fetch(`/api/barcode/lookup?upc=${barcode}`)
      if (response.ok) {
        const apiResponse = await response.json()

        if (apiResponse?.items?.length > 0) {
          const item = apiResponse.items[0]
          setProductData({
            id: '', // Will be created if needed
            name: item.title || item.description || 'Unknown Product',
            brand: item.brand || undefined,
            image_url: item.images?.[0] || undefined,
            upc: barcode
          })

          if (workflowMode === 'item-first') {
            setActiveStep(1)
            await loadProductLocations('') // Will need to search by UPC
          } else {
            setActiveStep(2)
          }
          console.log('✅ Product found via API:', item.title)
        } else {
          setError('Product not found in inventory. Please check the barcode and try again.')
        }
      } else {
        setError('Failed to lookup product. Please try again.')
      }
    } catch (err: any) {
      setError('Failed to lookup product. Please try again.')
      console.error('Product lookup error:', err)
    } finally {
      setLookupLoading(false)
    }
  }

  // Load all locations where a product is stored
  const loadProductLocations = async (productId: string) => {
    try {
      // If productId is empty, search by UPC
      let query = supabase
        .from('inventory_items')
        .select(`
          *,
          storage_locations (*)
        `)
        .eq('household_id', user?.id || '')
        .eq('is_consumed', false)

      if (productId) {
        query = query.eq('product_id', productId)
      } else if (productData?.upc) {
        // Search by UPC through products table
        const { data: product } = await supabase
          .from('products')
          .select('id')
          .eq('upc', productData.upc)
          .single()

        if (product) {
          query = query.eq('product_id', product.id)
        }
      }

      const { data: items, error } = await query.order('purchase_date')

      if (error) throw error

      setAvailableItems(items || [])
      console.log('📦 Product found in', items?.length || 0, 'locations')
    } catch (err) {
      console.error('Error loading product locations:', err)
      setError('Failed to find product in inventory')
    }
  }

  // Handle location QR scan
  const handleLocationScan = async (locationInput: string) => {
    setError(null)

    try {
      let locationId = locationInput

      if (locationInput.includes('/inventory?location=')) {
        const url = new URL(locationInput)
        locationId = url.searchParams.get('location') || ''
      }

      if (!locationId) {
        setError('Invalid location QR code')
        return
      }

      await loadStorageLocationFromId(locationId)
    } catch (err) {
      setError('Invalid storage location. Please scan a valid location QR code.')
      console.error('Location scan error:', err)
    }
  }

  // Handle item QR code scan (for custom items or damaged barcodes)
  const handleItemQRScan = async (qrInput: string) => {
    setError(null)

    try {
      let productId = qrInput

      // Check if it's a QR code URL to product details
      if (qrInput.includes('/inventory/product/')) {
        const url = new URL(qrInput)
        const pathParts = url.pathname.split('/')
        productId = pathParts[pathParts.length - 1]
      }

      if (!productId) {
        setError('Invalid item QR code')
        return
      }

      // Load product by ID instead of barcode
      const { data: productData, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single()

      if (error) throw error

      setProductData({
        id: productData.id,
        name: productData.name,
        brand: productData.brand || undefined,
        image_url: productData.image_url || undefined,
        upc: productData.upc || 'CUSTOM'
      })

      if (workflowMode === 'item-first') {
        setActiveStep(1)
        await loadProductLocations(productData.id)
      }

      console.log('✅ Product loaded from QR code:', productData.name)
    } catch (err) {
      setError('Invalid item QR code. Please scan a valid product QR code.')
      console.error('Item QR scan error:', err)
    }
  }

  // Remove/use item from inventory
  const handleQuickUse = async () => {
    if (!user || !selectedItem) return

    setSaving(true)
    setError(null)

    try {
      const itemToUpdate = availableItems.find(item => item.id === selectedItem)
      if (!itemToUpdate) throw new Error('Item not found')

      const oldQuantity = itemToUpdate.quantity
      const newQuantity = Math.max(0, oldQuantity - removeQuantity)

      // Calculate FIFO cost for removed items
      const costPerUnit = itemToUpdate.cost ? itemToUpdate.cost / oldQuantity : 0
      const totalRemovedValue = removeQuantity * costPerUnit

      if (newQuantity === 0) {
        // Mark as consumed
        const { error } = await supabase
          .from('inventory_items')
          .update({
            is_consumed: true,
            consumed_date: new Date().toISOString(),
            quantity: 0,
            last_modified_by: user.id,
            last_modified_at: new Date().toISOString()
          })
          .eq('id', selectedItem)

        if (error) throw error
        console.log('✅ Item marked as consumed')
      } else {
        // Update quantity
        const { error } = await supabase
          .from('inventory_items')
          .update({
            quantity: newQuantity,
            last_modified_by: user.id,
            last_modified_at: new Date().toISOString()
          })
          .eq('id', selectedItem)

        if (error) throw error
        console.log('✅ Item quantity updated:', newQuantity)
      }

      // Log the removal in audit trail
      const actionType = newQuantity === 0 ? 'consume' : 'remove'
      const productName = (itemToUpdate as any).products?.name || productData?.name || 'Unknown Product'

      const { error: auditError } = await supabase
        .from('inventory_audit_log')
        .insert([{
          inventory_item_id: selectedItem,
          household_id: user.id,
          user_id: user.id,
          action_type: actionType,
          quantity_before: oldQuantity,
          quantity_after: newQuantity,
          quantity_delta: -removeQuantity,
          unit_cost: costPerUnit,
          total_value: totalRemovedValue,
          notes: `Quick Use: ${productName} (${removeQuantity} ${itemToUpdate.unit})`,
          source_action: 'quick_use'
        }])

      if (auditError) {
        console.warn('Failed to log audit trail:', auditError)
        // Don't fail the operation if audit logging fails
      } else {
        console.log('✅ Audit logged: Removed', removeQuantity, 'items, value:', totalRemovedValue)
      }

      setSuccess(true)

      // Reset for next item after 2 seconds
      setTimeout(() => {
        resetQuickUse()
      }, 2000)

    } catch (err: any) {
      setError(err.message)
      console.error('Quick use error:', err)
    } finally {
      setSaving(false)
    }
  }

  const resetQuickUse = () => {
    setActiveStep(0)
    setProductData(null)
    setStorageLocation(null)
    setAvailableItems([])
    setSelectedItem('')
    setItemBarcode('')
    setLocationCode('')
    setRemoveQuantity(1)
    setError(null)
    setSuccess(false)
  }

  const switchWorkflow = () => {
    setWorkflowMode(workflowMode === 'location-first' ? 'item-first' : 'location-first')
    resetQuickUse()
  }

  // Number pad functions for remove quantity
  const addToRemoveQuantity = (value: number) => {
    if (value === 0 && removeQuantity === 0) return

    if (removeQuantity === 0) {
      setRemoveQuantity(value)
    } else {
      const newValue = removeQuantity * 10 + value
      setRemoveQuantity(newValue > 999 ? 999 : newValue)
    }
  }

  const removeLastDigit = () => {
    setRemoveQuantity(prev => Math.floor(prev / 10))
  }

  // Scanner handlers
  const handleBarcodeScanned = (barcode: string) => {
    console.log('📱 Camera scanned product barcode:', barcode)
    setItemBarcode(barcode)
    setShowBarcodeScanner(false)
    lookupProduct(barcode)
  }

  const handleQRScanned = (qrCode: string) => {
    console.log('📱 Camera scanned QR code:', qrCode)
    setShowQRScanner(false)

    // Determine if this is a location QR or item QR
    if (qrCode.includes('/inventory/product/')) {
      // Item QR code
      console.log('🔍 Detected item QR code')
      setItemBarcode(qrCode)
      handleItemQRScan(qrCode)
    } else if (qrCode.includes('/inventory?location=')) {
      // Location QR code
      console.log('📍 Detected location QR code')
      setLocationCode(qrCode)
      handleLocationScan(qrCode)
    } else {
      // Try as location ID first, then as item ID
      if (qrCode.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
        // Looks like a UUID - try as location first
        setLocationCode(qrCode)
        handleLocationScan(qrCode)
      } else {
        setError('Unrecognized QR code format')
      }
    }
  }

  if (!user) {
    return (
      <Container maxWidth="sm" sx={{ mt: 4 }}>
        <Typography>Loading...</Typography>
      </Container>
    )
  }

  const getSteps = () => {
    if (workflowMode === 'location-first') {
      return ['Scan Storage Location', 'Select Item to Remove', 'Set Quantity & Remove']
    } else {
      return ['Scan Product Barcode', 'Select Location', 'Set Quantity & Remove']
    }
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
          <Box display="flex" alignItems="center" gap={1} mb={1}>
            <RemoveIcon color="primary" />
            <Typography variant="h4" component="h1">
              Quick Use
            </Typography>
          </Box>
          <Typography variant="body1" color="textSecondary">
            Remove items from inventory - scan location or product to get started
          </Typography>
        </Box>
      </Box>

      {/* Workflow Mode Selector */}
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ py: 2 }}>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Typography variant="h6">Workflow Mode:</Typography>
            <ButtonGroup variant="outlined" size="small">
              <Button
                onClick={() => setWorkflowMode('item-first')}
                variant={workflowMode === 'item-first' ? 'contained' : 'outlined'}
              >
                📦 Item First
              </Button>
              <Button
                onClick={() => setWorkflowMode('location-first')}
                variant={workflowMode === 'location-first' ? 'contained' : 'outlined'}
              >
                📍 Location First
              </Button>
            </ButtonGroup>
          </Box>
          <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
            {workflowMode === 'location-first'
              ? 'Scan location QR → Select item from that location → Remove quantity'
              : 'Scan product barcode → Select location (if multiple) → Remove quantity'
            }
          </Typography>
        </CardContent>
      </Card>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Item removed from inventory! Ready for next item...
        </Alert>
      )}

      <Card>
        <CardContent>
          <Stepper activeStep={activeStep} orientation="vertical">
            {/* Step 1: Scan Location or Item based on workflow */}
            <Step>
              <StepLabel>
                {workflowMode === 'location-first' ? 'Scan Storage Location QR Code' : 'Scan Product Barcode'}
              </StepLabel>
              <StepContent>
                {workflowMode === 'location-first' ? (
                  /* Location-first workflow */
                  <Box>
                    <TextField
                      inputRef={locationInputRef}
                      label="Storage Location QR Code"
                      fullWidth
                      value={locationCode}
                      onChange={(e) => setLocationCode(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && locationCode) {
                          handleLocationScan(locationCode)
                        }
                      }}
                      placeholder="Scan location QR code or paste URL"
                      InputProps={{
                        endAdornment: (
                          <IconButton onClick={() => setShowQRScanner(true)}>
                            <CameraIcon />
                          </IconButton>
                        ),
                      }}
                      sx={{ mb: 2 }}
                    />
                    <Button
                      variant="contained"
                      onClick={() => handleLocationScan(locationCode)}
                      disabled={!locationCode}
                      startIcon={<LocationIcon />}
                    >
                      Load Location Inventory
                    </Button>
                  </Box>
                ) : (
                  /* Item-first workflow */
                  <Box>
                    <TextField
                      inputRef={itemInputRef}
                      label="Product UPC/Barcode"
                      fullWidth
                      value={itemBarcode}
                      onChange={(e) => setItemBarcode(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && itemBarcode) {
                          lookupProduct(itemBarcode)
                        }
                      }}
                      placeholder="Scan or enter product barcode"
                      InputProps={{
                        endAdornment: (
                          <IconButton onClick={() => setShowBarcodeScanner(true)}>
                            <CameraIcon />
                          </IconButton>
                        ),
                      }}
                      sx={{ mb: 2 }}
                    />
                    <Button
                      variant="contained"
                      onClick={() => lookupProduct(itemBarcode)}
                      disabled={!itemBarcode || lookupLoading}
                      startIcon={lookupLoading ? <CircularProgress size={20} /> : <ScannerIcon />}
                    >
                      {lookupLoading ? 'Looking up...' : 'Find Product'}
                    </Button>
                  </Box>
                )}

                {/* Show scanned data */}
                {storageLocation && workflowMode === 'location-first' && (
                  <Paper sx={{ p: 2, mt: 2, backgroundColor: 'info.light' }}>
                    <Box display="flex" alignItems="center" gap={2}>
                      <LocationIcon />
                      <Box>
                        <Typography variant="h6">{storageLocation.name}</Typography>
                        <Typography variant="body2">{storageLocation.type}</Typography>
                        {storageLocation.full_path && (
                          <Typography variant="caption">{storageLocation.full_path}</Typography>
                        )}
                      </Box>
                      <CheckIcon />
                    </Box>
                  </Paper>
                )}

                {productData && workflowMode === 'item-first' && (
                  <Paper sx={{ p: 2, mt: 2, backgroundColor: 'success.light' }}>
                    <Box display="flex" alignItems="center" gap={2}>
                      {productData.image_url && (
                        <Avatar src={productData.image_url} sx={{ width: 50, height: 50 }} />
                      )}
                      <Box>
                        <Typography variant="h6">{productData.name}</Typography>
                        {productData.brand && (
                          <Typography variant="body2">by {productData.brand}</Typography>
                        )}
                      </Box>
                      <CheckIcon />
                    </Box>
                  </Paper>
                )}
              </StepContent>
            </Step>

            {/* Step 2: Select Item or Location */}
            <Step>
              <StepLabel>
                {workflowMode === 'location-first' ? 'Select Item to Remove' : 'Select Storage Location'}
              </StepLabel>
              <StepContent>
                {availableItems.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 3 }}>
                    <Typography variant="body1" color="textSecondary">
                      {workflowMode === 'location-first'
                        ? 'No items found in this location'
                        : 'This product is not in your inventory'
                      }
                    </Typography>
                  </Box>
                ) : availableItems.length === 1 ? (
                  /* Auto-select single item */
                  <Box>
                    <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                      Only one item found - automatically selected:
                    </Typography>
                    <Paper sx={{ p: 2, backgroundColor: 'primary.light', color: 'primary.contrastText' }}>
                      <Box display="flex" alignItems="center" gap={2}>
                        <InventoryIcon />
                        <Box>
                          <Typography variant="body1" fontWeight="medium">
                            {workflowMode === 'location-first'
                              ? (availableItems[0] as any).products?.name
                              : (availableItems[0] as any).storage_locations?.name
                            }
                          </Typography>
                          <Typography variant="body2">
                            {availableItems[0].quantity} {availableItems[0].unit} available
                          </Typography>
                        </Box>
                      </Box>
                    </Paper>
                    <Button
                      variant="contained"
                      onClick={() => {
                        setSelectedItem(availableItems[0].id)
                        setActiveStep(2)
                      }}
                      sx={{ mt: 2 }}
                    >
                      Continue with this item
                    </Button>
                  </Box>
                ) : (
                  /* Multiple items - let user choose */
                  <Box>
                    <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                      Select which item to remove:
                    </Typography>
                    <RadioGroup
                      value={selectedItem}
                      onChange={(e) => setSelectedItem(e.target.value)}
                    >
                      {availableItems.map((item) => (
                        <FormControlLabel
                          key={item.id}
                          value={item.id}
                          control={<Radio />}
                          label={
                            <Box>
                              <Typography variant="body1">
                                {workflowMode === 'location-first'
                                  ? (item as any).products?.name
                                  : (item as any).storage_locations?.name
                                }
                              </Typography>
                              <Typography variant="body2" color="textSecondary">
                                {item.quantity} {item.unit} available • Purchased {new Date(item.purchase_date).toLocaleDateString()}
                              </Typography>
                            </Box>
                          }
                        />
                      ))}
                    </RadioGroup>
                    <Button
                      variant="contained"
                      onClick={() => setActiveStep(2)}
                      disabled={!selectedItem}
                      sx={{ mt: 2 }}
                    >
                      Continue with Selected Item
                    </Button>
                  </Box>
                )}
              </StepContent>
            </Step>

            {/* Step 3: Set Quantity and Remove */}
            <Step>
              <StepLabel>Set Remove Quantity</StepLabel>
              <StepContent>
                {selectedItem && (
                  <Box>
                    {(() => {
                      const item = availableItems.find(i => i.id === selectedItem)
                      return item ? (
                        <Box>
                          <Paper sx={{ p: 2, mb: 2 }}>
                            <Typography variant="h6" gutterBottom>Removing from:</Typography>
                            <Box display="flex" alignItems="center" gap={2} mb={1}>
                              <InventoryIcon color="primary" />
                              <Typography>{(item as any).products?.name || productData?.name}</Typography>
                            </Box>
                            <Box display="flex" alignItems="center" gap={2}>
                              <LocationIcon color="primary" />
                              <Typography>{(item as any).storage_locations?.name || storageLocation?.name}</Typography>
                            </Box>
                            <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                              Available: {item.quantity} {item.unit}
                            </Typography>
                          </Paper>

                          {/* Quantity Selector */}
                          <Paper sx={{ p: 3, mb: 2 }}>
                            <Typography variant="h6" gutterBottom>Remove Quantity</Typography>

                            <Box sx={{ textAlign: 'center', mb: 2 }}>
                              <Typography variant="h2" sx={{ fontSize: '3rem', fontWeight: 'bold', color: 'error.main' }}>
                                {removeQuantity}
                              </Typography>
                              <Typography variant="body2" color="textSecondary">
                                {item.unit} to remove
                              </Typography>
                            </Box>

                            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mb: 2 }}>
                              <Button variant="outlined" onClick={() => setRemoveQuantity(Math.max(0, removeQuantity - 1))}>
                                <RemoveIcon />
                              </Button>
                              <Button variant="outlined" onClick={() => setRemoveQuantity(removeQuantity + 1)}>
                                <AddIcon />
                              </Button>
                            </Box>

                            <Grid container spacing={1} sx={{ maxWidth: 300, mx: 'auto' }}>
                              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                                <Grid item xs={4} key={num}>
                                  <Button
                                    variant="outlined"
                                    onClick={() => addToRemoveQuantity(num)}
                                    sx={{ width: '100%', height: 50, fontSize: '1.1rem' }}
                                  >
                                    {num}
                                  </Button>
                                </Grid>
                              ))}
                              <Grid item xs={4}>
                                <Button
                                  variant="outlined"
                                  onClick={removeLastDigit}
                                  sx={{ width: '100%', height: 50, color: 'error.main' }}
                                >
                                  <BackspaceIcon />
                                </Button>
                              </Grid>
                              <Grid item xs={4}>
                                <Button
                                  variant="outlined"
                                  onClick={() => addToRemoveQuantity(0)}
                                  sx={{ width: '100%', height: 50, fontSize: '1.1rem' }}
                                >
                                  0
                                </Button>
                              </Grid>
                              <Grid item xs={4}>
                                <Button
                                  variant="outlined"
                                  onClick={() => setRemoveQuantity(item.quantity)}
                                  sx={{ width: '100%', height: 50 }}
                                >
                                  Use All
                                </Button>
                              </Grid>
                            </Grid>
                          </Paper>

                          <Box display="flex" gap={2}>
                            <Button variant="outlined" onClick={resetQuickUse} disabled={saving}>
                              Start Over
                            </Button>
                            <Button
                              variant="contained"
                              onClick={handleQuickUse}
                              disabled={saving || removeQuantity <= 0}
                              startIcon={saving ? <CircularProgress size={20} /> : <CheckIcon />}
                              size="large"
                              color="error"
                            >
                              {saving ? 'Removing...' : `Remove ${removeQuantity} ${item.unit}`}
                            </Button>
                          </Box>
                        </Box>
                      ) : null
                    })()}
                  </Box>
                )}
              </StepContent>
            </Step>
          </Stepper>
        </CardContent>
      </Card>

      <Box sx={{ mt: 3, textAlign: 'center' }}>
        <Button startIcon={<RefreshIcon />} onClick={resetQuickUse} variant="text">
          Start Over
        </Button>
      </Box>

      {/* Barcode Scanner Dialog */}
      <BarcodeScanner
        open={showBarcodeScanner}
        onClose={() => setShowBarcodeScanner(false)}
        onScan={handleBarcodeScanned}
        title="Scan Product Barcode"
        description="Scan the barcode of the product you want to remove from inventory"
      />

      {/* QR Code Scanner Dialog */}
      <QRScanner
        open={showQRScanner}
        onClose={() => setShowQRScanner(false)}
        onScan={handleQRScanned}
        title="Scan Storage Location QR Code"
        description="Scan the QR code of the storage location to see its inventory"
      />
    </Container>
  )
}