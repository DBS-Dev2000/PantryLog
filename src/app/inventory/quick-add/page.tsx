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
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Autocomplete
} from '@mui/material'
import {
  ArrowBack as ArrowBackIcon,
  QrCodeScanner as ScannerIcon,
  CameraAlt as CameraIcon,
  Check as CheckIcon,
  FlashOn as QuickIcon,
  Inventory as InventoryIcon,
  LocationOn as LocationIcon,
  Refresh as RefreshIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  Backspace as BackspaceIcon,
  ExpandMore as ExpandMoreIcon,
  Visibility as EyeIcon,
  Edit as EditIcon
} from '@mui/icons-material'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BarcodeScanner from '@/components/BarcodeScanner'
import QRScanner from '@/components/QRScanner'
import VisualItemScanner from '@/components/VisualItemScanner'

interface ProductData {
  name: string
  brand?: string
  category?: string
  description?: string
  image_url?: string
  upc: string
}

interface StorageLocationData {
  id: string
  name: string
  type: string
  description?: string
  full_path?: string
}

export default function QuickAddPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const productInputRef = useRef<HTMLInputElement>(null)

  const [user, setUser] = useState<any>(null)
  const [activeStep, setActiveStep] = useState(0)
  const [productData, setProductData] = useState<ProductData | null>(null)
  const [storageLocation, setStorageLocation] = useState<StorageLocationData | null>(null)
  const [productBarcode, setProductBarcode] = useState('')
  const [locationCode, setLocationCode] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false)
  const [showQRScanner, setShowQRScanner] = useState(false)
  const [showVisualScanner, setShowVisualScanner] = useState(false)

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

    if (productInputRef.current) {
      productInputRef.current.focus()
    }
  }, [router])

  // Look up product by barcode
  const lookupProduct = async (barcode: string) => {
    setLookupLoading(true)
    setError(null)

    try {
      // Check our database first
      const { data: existingProduct } = await supabase
        .from('products')
        .select('*')
        .eq('upc', barcode)
        .maybeSingle()

      if (existingProduct) {
        setProductData({
          name: existingProduct.name,
          brand: existingProduct.brand || undefined,
          category: existingProduct.category || undefined,
          description: (existingProduct.nutritional_info as any)?.description || undefined,
          image_url: existingProduct.image_url || undefined,
          upc: barcode
        })
        setActiveStep(1)
        return
      }

      // Try external API
      const response = await fetch(`/api/barcode/lookup?upc=${barcode}`)
      if (response.ok) {
        const apiResponse = await response.json()

        if (apiResponse?.items?.length > 0) {
          const item = apiResponse.items[0]
          setProductData({
            name: item.title || item.description || 'Unknown Product',
            brand: item.brand || undefined,
            category: item.category || undefined,
            description: item.description || undefined,
            image_url: item.images?.[0] || undefined,
            upc: barcode
          })
          setActiveStep(1)
        } else {
          setError('Product not found. Please use the regular Add Item page for manual entry.')
        }
      } else {
        setError('Failed to lookup product. Please try again.')
      }
    } catch (err: any) {
      setError('Failed to lookup product. Please try again.')
    } finally {
      setLookupLoading(false)
    }
  }

  // Handle location scan
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

      const { data: location, error } = await supabase
        .from('storage_locations')
        .select('*')
        .eq('id', locationId)
        .single()

      if (error) throw error

      setStorageLocation({
        id: location.id,
        name: location.name,
        type: location.type,
        description: location.description || undefined,
        full_path: location.name
      })

      setActiveStep(2)
    } catch (err) {
      setError('Invalid storage location. Please scan a valid location QR code.')
    }
  }

  // Add the item
  const handleQuickAdd = async () => {
    if (!user || !productData || !storageLocation) return

    setSaving(true)
    setError(null)

    try {
      const householdId = user.id

      console.log('🏠 Ensuring household exists for user:', householdId)

      // Ensure household exists with proper error handling
      const { data: household, error: householdError } = await supabase
        .from('households')
        .upsert([{ id: householdId, name: 'My Household' }], { onConflict: 'id' })
        .select('id')

      if (householdError && householdError.code !== '23505') {
        console.error('❌ Household creation error:', householdError)
        throw new Error(`Household setup failed: ${householdError.message}`)
      }

      console.log('✅ Household ready:', householdId)

      // Find or create product
      let productId: string
      const { data: existingProduct } = await supabase
        .from('products')
        .select('id')
        .eq('upc', productData.upc)
        .maybeSingle()

      if (existingProduct) {
        productId = existingProduct.id
      } else {
        const { data: newProduct, error: productError } = await supabase
          .from('products')
          .insert([{
            name: productData.name,
            brand: productData.brand || null,
            category: productData.category || null,
            upc: productData.upc,
            image_url: productData.image_url || null,
            created_by: user.id
          }])
          .select('id')
          .single()

        if (productError) throw productError
        productId = newProduct.id
      }

      // Validate required data before insert
      if (!productId || !storageLocation.id || !householdId) {
        throw new Error('Missing required data for inventory item')
      }

      console.log('📦 Creating inventory item:', {
        product_id: productId,
        storage_location_id: storageLocation.id,
        household_id: householdId,
        quantity: quantity
      })

      // Add inventory item with audit tracking
      const { data: newInventoryItem, error: inventoryError } = await supabase
        .from('inventory_items')
        .insert([{
          product_id: productId,
          storage_location_id: storageLocation.id,
          household_id: householdId,
          quantity: quantity,
          unit: 'pieces',
          purchase_date: new Date().toISOString().split('T')[0],
          created_by: user.id,
          last_modified_by: user.id,
          last_modified_at: new Date().toISOString()
        }])
        .select('id')
        .single()

      if (inventoryError) throw inventoryError

      // Log the addition in audit trail
      if (newInventoryItem) {
        const { error: auditError } = await supabase
          .from('inventory_audit_log')
          .insert([{
            inventory_item_id: newInventoryItem.id,
            household_id: householdId,
            user_id: user.id,
            action_type: 'add',
            quantity_before: 0,
            quantity_after: quantity,
            quantity_delta: quantity,
            notes: `Quick Add: ${productData?.name || 'Unknown Product'}`,
            source_action: 'quick_add'
          }])

        if (auditError) {
          console.warn('Failed to log audit trail:', auditError)
          // Don't fail the operation if audit logging fails
        } else {
          console.log('✅ Audit logged: Added', quantity, 'items')
        }
      }

      setSuccess(true)

      setTimeout(() => {
        resetQuickAdd()
      }, 2000)

    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const resetQuickAdd = () => {
    setActiveStep(0)
    setProductData(null)
    setStorageLocation(null)
    setProductBarcode('')
    setLocationCode('')
    setQuantity(1)
    setError(null)
    setSuccess(false)
    setTimeout(() => {
      if (productInputRef.current) {
        productInputRef.current.focus()
      }
    }, 100)
  }

  // Number pad functions
  const addToQuantity = (value: number) => {
    if (value === 0 && quantity === 0) return

    if (quantity === 0) {
      setQuantity(value)
    } else {
      const newValue = quantity * 10 + value
      setQuantity(newValue > 999 ? 999 : newValue)
    }
  }

  const removeLastDigit = () => {
    setQuantity(prev => Math.floor(prev / 10))
  }

  const handleBarcodeScanned = (barcode: string) => {
    console.log('📱 Camera scanned barcode:', barcode)
    setProductBarcode(barcode)
    setShowBarcodeScanner(false)
    // Automatically lookup the product
    lookupProduct(barcode)
  }

  const handleQRScanned = (qrCode: string) => {
    console.log('📱 Camera scanned QR code:', qrCode)
    setLocationCode(qrCode)
    setShowQRScanner(false)
    // Automatically process the location
    handleLocationScan(qrCode)
  }

  const handleVisualItemSelected = (itemData: any) => {
    console.log('👁️ AI identified item:', itemData)
    setProductData({
      name: itemData.name,
      brand: itemData.brand,
      category: itemData.category,
      description: itemData.description,
      image_url: itemData.image_url,
      upc: itemData.upc || `VISUAL-${Date.now()}`
    })
    setShowVisualScanner(false)
    setActiveStep(1) // Move to location step
  }

  if (!user) {
    return (
      <Container maxWidth="sm" sx={{ mt: 4 }}>
        <Typography>Loading...</Typography>
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
          <Box display="flex" alignItems="center" gap={1} mb={1}>
            <QuickIcon color="primary" />
            <Typography variant="h4" component="h1">
              Stock Up
            </Typography>
          </Box>
          <Typography variant="body1" color="textSecondary">
            Add items to your pantry - Scan, identify, and stock with intelligent efficiency
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
          Item added successfully! Ready for next item...
        </Alert>
      )}

      {/* Persistent Product and Location Summary */}
      {(productData || storageLocation) && (
        <Box sx={{ mb: 2 }}>
          {/* Product Summary */}
          {productData && (
            <Card sx={{ mb: 1 }}>
              <CardContent sx={{ py: 1 }}>
                <Accordion>
                  <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    sx={{
                      backgroundColor: 'success.light',
                      minHeight: 48,
                      '&.Mui-expanded': { minHeight: 48 },
                      '& .MuiAccordionSummary-content': { margin: '8px 0' },
                      '& .MuiAccordionSummary-content.Mui-expanded': { margin: '8px 0' }
                    }}
                  >
                    <Box display="flex" alignItems="center" gap={2} sx={{ width: '100%' }}>
                      {productData.image_url && (
                        <Avatar src={productData.image_url} sx={{ width: 32, height: 32 }} />
                      )}
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="body1" sx={{ fontWeight: 'medium', color: 'success.contrastText' }}>
                          📦 {productData.name.length > 50 ? `${productData.name.substring(0, 50)}...` : productData.name}
                        </Typography>
                        {productData.brand && (
                          <Typography variant="caption" sx={{ color: 'success.contrastText', opacity: 0.8 }}>
                            by {productData.brand}
                          </Typography>
                        )}
                      </Box>
                      <Chip
                        label={productData.upc}
                        size="small"
                        sx={{
                          backgroundColor: 'success.dark',
                          color: 'success.contrastText',
                          fontSize: '0.7rem'
                        }}
                      />
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Typography variant="body2" color="textSecondary" gutterBottom>Product Details:</Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12}>
                        <Typography variant="body1" sx={{ fontWeight: 'medium' }}>{productData.name}</Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="textSecondary">Brand:</Typography>
                        <Typography variant="body2">{productData.brand || 'Not specified'}</Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="textSecondary">UPC:</Typography>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{productData.upc}</Typography>
                      </Grid>
                      {productData.description && (
                        <Grid item xs={12}>
                          <Typography variant="body2" color="textSecondary">Description:</Typography>
                          <Typography variant="body2">{productData.description}</Typography>
                        </Grid>
                      )}
                    </Grid>
                  </AccordionDetails>
                </Accordion>
              </CardContent>
            </Card>
          )}

          {/* Storage Location Summary */}
          {storageLocation && (
            <Card sx={{ mb: 1 }}>
              <CardContent sx={{ py: 1 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    backgroundColor: 'info.light',
                    p: 1.5,
                    borderRadius: 1
                  }}
                >
                  <LocationIcon sx={{ color: 'info.contrastText' }} />
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="body1" sx={{ fontWeight: 'medium', color: 'info.contrastText' }}>
                      📍 {storageLocation.name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'info.contrastText', opacity: 0.8 }}>
                      {storageLocation.type}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          )}
        </Box>
      )}

      <Card>
        <CardContent>
          <Stepper activeStep={activeStep} orientation="vertical">
            <Step>
              <StepLabel>Scan Product Barcode</StepLabel>
              <StepContent>
                <TextField
                  inputRef={productInputRef}
                  label="Product UPC/Barcode"
                  fullWidth
                  value={productBarcode}
                  onChange={(e) => setProductBarcode(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && productBarcode) {
                      lookupProduct(productBarcode)
                    }
                  }}
                  placeholder="Scan or enter product barcode"
                  InputProps={{
                    endAdornment: (
                      <Box display="flex" gap={0.5}>
                        <IconButton onClick={() => setShowBarcodeScanner(true)} title="Scan Barcode">
                          <CameraIcon />
                        </IconButton>
                        <IconButton onClick={() => setShowVisualScanner(true)} title="AI Identify" color="secondary">
                          <EyeIcon />
                        </IconButton>
                      </Box>
                    ),
                  }}
                  sx={{ mb: 2 }}
                />
                <Box display="flex" gap={1} flexWrap="wrap">
                  <Button
                    variant="contained"
                    onClick={() => lookupProduct(productBarcode)}
                    disabled={!productBarcode || lookupLoading}
                    startIcon={lookupLoading ? <CircularProgress size={20} /> : <ScannerIcon />}
                  >
                    {lookupLoading ? 'Looking up...' : 'Lookup'}
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => router.push('/inventory/add?manual=true')}
                    startIcon={<EditIcon />}
                    color="info"
                  >
                    Manual Add
                  </Button>
                </Box>

                {productData && (
                  <Paper sx={{ p: 2, mt: 2, backgroundColor: 'success.light', color: 'success.contrastText' }}>
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

            <Step>
              <StepLabel>Scan Storage Location QR Code</StepLabel>
              <StepContent>
                <Box sx={{ mb: 2 }}>
                  <Autocomplete
                    options={storageLocations}
                    getOptionLabel={(option) => option.fullPath || option.label}
                    value={storageLocations.find(loc => loc.id === locationCode) || null}
                    onChange={(event, newValue) => {
                      if (newValue) {
                        setLocationCode(newValue.id)
                        handleLocationScan(newValue.id)
                      }
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Choose Storage Location"
                        placeholder="Search for location or scan QR code"
                        InputProps={{
                          ...params.InputProps,
                          endAdornment: (
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              {params.InputProps.endAdornment}
                              <IconButton onClick={() => setShowQRScanner(true)} title="Scan QR Code">
                                <CameraIcon />
                              </IconButton>
                            </Box>
                          ),
                        }}
                      />
                    )}
                    renderOption={(props, option) => (
                      <li {...props} style={{
                        paddingLeft: (option.level * 16) + 16,
                        fontSize: option.level === 0 ? '1rem' : '0.9rem',
                        fontWeight: option.level === 0 ? 500 : 400
                      }}>
                        {option.fullPath || option.label}
                      </li>
                    )}
                  />
                </Box>
                <Button
                  variant="contained"
                  onClick={() => handleLocationScan(locationCode)}
                  disabled={!locationCode}
                  startIcon={<LocationIcon />}
                >
                  Set Location
                </Button>

                {storageLocation && (
                  <Paper sx={{ p: 2, mt: 2, backgroundColor: 'info.light' }}>
                    <Box display="flex" alignItems="center" gap={2}>
                      <LocationIcon />
                      <Box>
                        <Typography variant="h6">{storageLocation.name}</Typography>
                        <Typography variant="body2">{storageLocation.type}</Typography>
                      </Box>
                      <CheckIcon />
                    </Box>
                  </Paper>
                )}
              </StepContent>
            </Step>

            <Step>
              <StepLabel>Set Quantity & Add Item</StepLabel>
              <StepContent>
                {productData && storageLocation && (
                  <Box>
                    <Paper sx={{ p: 2, mb: 2 }}>
                      <Typography variant="h6" gutterBottom>Ready to Add:</Typography>
                      <Box display="flex" alignItems="center" gap={2} mb={2}>
                        <InventoryIcon color="primary" />
                        <Typography>{productData.name}</Typography>
                        <LocationIcon color="primary" />
                        <Typography>{storageLocation.name}</Typography>
                      </Box>
                    </Paper>

                    <Paper sx={{ p: 3, mb: 2 }}>
                      <Typography variant="h6" gutterBottom>Quantity</Typography>

                      <Box sx={{ textAlign: 'center', mb: 2 }}>
                        <Typography variant="h2" sx={{ fontSize: '3rem', fontWeight: 'bold', color: 'primary.main' }}>
                          {quantity}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">pieces</Typography>
                      </Box>

                      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mb: 2 }}>
                        <Button variant="outlined" onClick={() => setQuantity(Math.max(0, quantity - 1))}>
                          <RemoveIcon />
                        </Button>
                        <Button variant="outlined" onClick={() => setQuantity(quantity + 1)}>
                          <AddIcon />
                        </Button>
                      </Box>

                      <Grid container spacing={1} sx={{ maxWidth: 300, mx: 'auto' }}>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                          <Grid item xs={4} key={num}>
                            <Button
                              variant="outlined"
                              onClick={() => addToQuantity(num)}
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
                            onClick={() => addToQuantity(0)}
                            sx={{ width: '100%', height: 50, fontSize: '1.1rem' }}
                          >
                            0
                          </Button>
                        </Grid>
                        <Grid item xs={4}>
                          <Button
                            variant="outlined"
                            onClick={() => setQuantity(1)}
                            sx={{ width: '100%', height: 50 }}
                          >
                            Reset
                          </Button>
                        </Grid>
                      </Grid>
                    </Paper>

                    <Box display="flex" gap={2}>
                      <Button variant="outlined" onClick={resetQuickAdd} disabled={saving}>
                        Start Over
                      </Button>
                      <Button
                        variant="contained"
                        onClick={handleQuickAdd}
                        disabled={saving}
                        startIcon={saving ? <CircularProgress size={20} /> : <CheckIcon />}
                        size="large"
                      >
                        {saving ? 'Adding...' : `Add ${quantity} Items`}
                      </Button>
                    </Box>
                  </Box>
                )}
              </StepContent>
            </Step>
          </Stepper>
        </CardContent>
      </Card>

      <Box sx={{ mt: 3, textAlign: 'center' }}>
        <Button startIcon={<RefreshIcon />} onClick={resetQuickAdd} variant="text">
          Start Over
        </Button>
      </Box>

      {/* Barcode Scanner Dialog */}
      <BarcodeScanner
        open={showBarcodeScanner}
        onClose={() => setShowBarcodeScanner(false)}
        onScan={handleBarcodeScanned}
        title="Scan Product Barcode"
        description="Align the product barcode within the green box for automatic scanning"
      />

      {/* QR Code Scanner Dialog */}
      <QRScanner
        open={showQRScanner}
        onClose={() => setShowQRScanner(false)}
        onScan={handleQRScanned}
        title="Scan Storage Location QR Code"
        description="Align the storage location QR code within the blue box for automatic scanning"
      />

      {/* Visual Item Scanner Dialog */}
      <VisualItemScanner
        open={showVisualScanner}
        onClose={() => setShowVisualScanner(false)}
        onItemSelected={handleVisualItemSelected}
        title="AI Item Recognition"
        userId={user?.id}
      />
    </Container>
  )
}