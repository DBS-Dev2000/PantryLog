'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { getUserHouseholdId } from '@/lib/household-utils-client'
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
  Autocomplete,
  Fab,
  useTheme,
  useMediaQuery
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
  Edit as EditIcon,
  RecordVoiceOver as VoiceIcon
} from '@mui/icons-material'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase-client'
import BarcodeScanner from '@/components/BarcodeScanner'
import QRScanner from '@/components/QRScanner'
import VisualItemScanner from '@/components/VisualItemScanner'
import VoiceAssistant from '@/components/VoiceAssistant'
import WhisperVoiceAssistant from '@/components/WhisperVoiceAssistant'
import { canUseVoiceAssistant, getVoiceAssistantType } from '@/lib/features'
import {
  suggestExpirationDate,
  getStorageRecommendation,
  getStorageOptions,
  getDefaultShelfLife,
  type StorageLocation as ShelfLifeLocation
} from '@/utils/shelfLifeCalculator'
import { matchFoodTaxonomy, getPortionInfo } from '@/utils/foodTaxonomyMatcher'

interface ProductData {
  name: string
  brand?: string
  category?: string
  description?: string
  image_url?: string
  upc: string
  // New comprehensive UPC fields
  ean?: string
  title?: string
  model?: string
  color?: string
  size?: string
  weight?: string
  dimension?: any
  lowest_recorded_price?: number
  highest_recorded_price?: number
  currency?: string
  additional_images?: string[]
  offers?: any[]
  asin?: string
  elid?: string
  manufacturer?: string
  ingredients?: string
  nutrition?: any
  raw_api_response?: any
}

interface StorageLocationData {
  id: string
  name: string
  type: string
  description?: string
  full_path?: string
}

function QuickAddPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const productInputRef = useRef<HTMLInputElement>(null)
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

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
  const [storageLocations, setStorageLocations] = useState<any[]>([])
  const [availableProducts, setAvailableProducts] = useState<any[]>([])
  const [continuousMode, setContinuousMode] = useState(false)
  const [lastLocation, setLastLocation] = useState<string>('')
  const [lastInputMethod, setLastInputMethod] = useState<'barcode' | 'ai' | 'search'>('barcode')
  const [voiceAssistantOpen, setVoiceAssistantOpen] = useState(false)
  const [voiceAssistantEnabled, setVoiceAssistantEnabled] = useState(false)
  const [voiceAssistantType, setVoiceAssistantType] = useState<'basic' | 'whisper'>('whisper')

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUser(session.user)
        await loadStorageLocations(session.user.id)
        await loadAvailableProducts(session.user.id)

        // Check if Voice Assistant is enabled for this user's household
        const canUseVA = await canUseVoiceAssistant(session.user.id)
        setVoiceAssistantEnabled(canUseVA)

        // Get voice assistant type for this page
        if (canUseVA) {
          const vaType = await getVoiceAssistantType('quick_add', session.user.id)
          setVoiceAssistantType(vaType)
        }
      } else {
        router.push('/auth')
      }
    }

    getUser()

    if (productInputRef.current) {
      productInputRef.current.focus()
    }
  }, [router])

  const loadStorageLocations = async (userId: string) => {
    try {
      // First try to get the user's household ID from user_profiles
      const { data: userProfile, error: profileError } = await supabase
        .from('user_profiles')
        .select('household_id')
        .eq('id', userId)
        .single()

      let householdId = userProfile?.household_id

      // If user_profiles doesn't exist, fall back to using userId as householdId
      if (profileError || !householdId) {
        console.warn('No user_profiles found, using userId as householdId')
        householdId = userId
      }

      const { data: locations, error } = await supabase
        .from('storage_locations')
        .select('*')
        .eq('household_id', householdId)
        .eq('is_active', true)
        .order('level')
        .order('sort_order')

      if (error) throw error

      // Build full paths for each location
      const locationsWithPaths = (locations || []).map(location => {
        const buildPath = (loc: any): string => {
          const parent = locations?.find(l => l.id === loc.parent_id)
          if (parent) {
            return `${buildPath(parent)} > ${loc.name}`
          }
          return loc.name
        }

        return {
          id: location.id,
          label: location.name,
          fullPath: buildPath(location),
          level: (location as any).level || 0
        }
      })

      setStorageLocations(locationsWithPaths)
      console.log('📦 Stock Up: Loaded storage locations:', locationsWithPaths.length)
    } catch (err: any) {
      console.error('Error loading storage locations in Stock Up:', err)
    }
  }

  const loadAvailableProducts = async (userId: string) => {
    try {
      // First try to get the user's household ID from user_profiles
      const { data: userProfile, error: profileError } = await supabase
        .from('user_profiles')
        .select('household_id')
        .eq('id', userId)
        .single()

      let householdId = userProfile?.household_id

      // If user_profiles doesn't exist, fall back to using userId as householdId
      if (profileError || !householdId) {
        console.warn('No user_profiles found, using userId as householdId')
        householdId = userId
      }

      // Get products that this household has previously added to inventory
      // This ensures privacy - only showing products this household has used
      const { data: inventoryItems, error: invError } = await supabase
        .from('inventory_items')
        .select('product_id')
        .eq('household_id', householdId)

      if (invError) throw invError

      // Get unique product IDs
      const productIds = [...new Set((inventoryItems || []).map(item => item.product_id))]

      if (productIds.length === 0) {
        // No products yet for this household
        setAvailableProducts([])
        console.log('📦 Stock Up: No products found for this household yet')
        return
      }

      // Now get the product details for only these products
      const { data: products, error } = await supabase
        .from('products')
        .select('id, name, brand, upc, category, image_url')
        .in('id', productIds)
        .order('name')

      if (error) throw error

      const productsWithDisplay = (products || []).map(product => ({
        ...product,
        displayName: `${product.name}${product.brand ? ` (${product.brand})` : ''}`,
        searchText: `${product.name} ${product.brand || ''} ${product.category || ''} ${product.upc || ''}`
      }))

      setAvailableProducts(productsWithDisplay)
      console.log('📦 Stock Up: Loaded household products:', productsWithDisplay.length)
    } catch (err: any) {
      console.error('Error loading products in Stock Up:', err)
    }
  }

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

          // Capture ALL available data from the API
          setProductData({
            name: item.title || item.description || 'Unknown Product',
            brand: item.brand || undefined,
            category: item.category || undefined,
            description: item.description || undefined,
            image_url: item.images?.[0] || undefined,
            upc: barcode,
            // New comprehensive fields
            ean: item.ean || undefined,
            title: item.title || undefined,
            model: item.model || undefined,
            color: item.color || undefined,
            size: item.size || undefined,
            weight: item.weight || undefined,
            dimension: item.dimension || undefined,
            lowest_recorded_price: item.lowest_recorded_price || undefined,
            highest_recorded_price: item.highest_recorded_price || undefined,
            currency: item.currency || undefined,
            additional_images: item.images?.slice(1) || undefined, // All images except the first
            offers: item.offers || undefined,
            asin: item.asin || undefined,
            elid: item.elid || undefined,
            manufacturer: item.manufacturer || undefined,
            ingredients: item.ingredients || undefined,
            nutrition: item.nutrition || undefined,
            raw_api_response: apiResponse // Store the entire response
          })

          console.log('📦 Captured UPC data:', {
            basic: { name: item.title, brand: item.brand, upc: barcode },
            additional: { size: item.size, weight: item.weight, model: item.model },
            pricing: { low: item.lowest_recorded_price, high: item.highest_recorded_price },
            offers: item.offers?.length || 0
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
      // Get the user's actual household ID
      const householdId = await getUserHouseholdId(user.id)

      if (!householdId) {
        throw new Error('No household found for user. Please contact support.')
      }

      console.log('🏠 Adding item to household:', householdId)

      console.log('✅ Household ready:', householdId)

      // Find or create product with automatic shelf life calculation
      let productId: string
      let defaultShelfLifeDays: number | null = null

      const { data: existingProduct } = await supabase
        .from('products')
        .select('id, default_shelf_life_days')
        .eq('upc', productData.upc)
        .maybeSingle()

      if (existingProduct) {
        productId = existingProduct.id
        defaultShelfLifeDays = existingProduct.default_shelf_life_days
      } else {
        // Get storage recommendation and default shelf life
        const storageType = storageLocation.type?.toLowerCase() as ShelfLifeLocation ||
                           getStorageRecommendation(productData.name, productData.category)

        // Calculate default shelf life based on our database
        defaultShelfLifeDays = getDefaultShelfLife(
          productData.name,
          productData.category,
          storageType
        )

        // Match food taxonomy for better categorization
        const taxonomyMatch = matchFoodTaxonomy(
          productData.name,
          productData.category,
          productData.brand
        )

        // Enhanced category from taxonomy if we have a good match
        const enhancedCategory = taxonomyMatch && taxonomyMatch.confidence > 0.5
          ? `${taxonomyMatch.category}${taxonomyMatch.subcategory ? `/${taxonomyMatch.subcategory}` : ''}`
          : productData.category

        const { data: newProduct, error: productError } = await supabase
          .from('products')
          .insert([{
            name: productData.name,
            brand: productData.brand || null,
            category: enhancedCategory || null,
            upc: productData.upc,
            image_url: productData.image_url || null,
            default_shelf_life_days: defaultShelfLifeDays,
            created_by: user.id,
            // Comprehensive UPC data fields
            ean: productData.ean || null,
            title: productData.title || null,
            model: productData.model || null,
            color: productData.color || null,
            size: productData.size || null,
            weight: productData.weight || null,
            dimension: productData.dimension || null,
            lowest_recorded_price: productData.lowest_recorded_price || null,
            highest_recorded_price: productData.highest_recorded_price || null,
            currency: productData.currency || null,
            additional_images: productData.additional_images || null,
            offers: productData.offers || null,
            asin: productData.asin || null,
            elid: productData.elid || null,
            manufacturer: productData.manufacturer || null,
            ingredients: productData.ingredients || null,
            nutrition: productData.nutrition || null,
            raw_api_response: productData.raw_api_response || null,
            api_last_updated: new Date().toISOString()
          }])
          .select('id')
          .single()

        if (productError) throw productError
        productId = newProduct.id

        console.log('📊 Product created with taxonomy match:', {
          product: productData.name,
          taxonomyCategory: enhancedCategory,
          confidence: taxonomyMatch?.confidence,
          shelfLife: defaultShelfLifeDays
        })
      }

      // Validate required data before insert
      if (!productId || !storageLocation.id || !householdId) {
        throw new Error('Missing required data for inventory item')
      }

      // Calculate expiration date
      const purchaseDate = new Date().toISOString().split('T')[0]
      const storageType = storageLocation.type?.toLowerCase() as ShelfLifeLocation ||
                         getStorageRecommendation(productData.name, productData.category)

      const expirationDate = defaultShelfLifeDays
        ? suggestExpirationDate(
            productData.name,
            productData.category,
            purchaseDate,
            storageType,
            defaultShelfLifeDays
          )
        : null

      // Get portion information from taxonomy
      const portionInfo = getPortionInfo(productData.name, productData.category)

      // Match food taxonomy for metadata
      const taxonomyMatch = matchFoodTaxonomy(
        productData.name,
        productData.category,
        productData.brand
      )

      console.log('📦 Creating inventory item:', {
        product_id: productId,
        storage_location_id: storageLocation.id,
        household_id: householdId,
        quantity: quantity,
        expiration_date: expirationDate,
        portion_size: portionInfo.standardPortion,
        taxonomy: taxonomyMatch
      })

      // Add inventory item with enhanced metadata
      const { data: newInventoryItem, error: inventoryError } = await supabase
        .from('inventory_items')
        .insert([{
          product_id: productId,
          storage_location_id: storageLocation.id,
          household_id: householdId,
          quantity: quantity,
          unit: 'pieces',
          purchase_date: purchaseDate,
          expiration_date: expirationDate ? expirationDate.toISOString().split('T')[0] : null,
          notes: taxonomyMatch && taxonomyMatch.confidence > 0.5
            ? `Category: ${taxonomyMatch.category}${taxonomyMatch.subcategory ? `/${taxonomyMatch.subcategory}` : ''}`
            : null,
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

      // Remember location for continuous mode
      if (storageLocation) {
        setLastLocation(storageLocation.id)
      }

      if (continuousMode) {
        // Shorter delay for continuous mode
        setTimeout(() => {
          resetForContinuous()
        }, 1500)
      } else {
        setTimeout(() => {
          resetQuickAdd()
        }, 2000)
      }

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
    setContinuousMode(false)
    setLastLocation('')
    setLastInputMethod('barcode')
    setTimeout(() => {
      if (productInputRef.current) {
        productInputRef.current.focus()
      }
    }, 100)
  }

  const resetForContinuous = () => {
    setActiveStep(0)
    setProductData(null)
    setProductBarcode('')
    setLocationCode(lastLocation) // Remember last location
    setQuantity(1)
    setError(null)
    setSuccess(false)

    // Auto-reopen based on last input method
    setTimeout(() => {
      if (lastInputMethod === 'barcode') {
        setShowBarcodeScanner(true)
      } else if (lastInputMethod === 'ai') {
        setShowVisualScanner(true)
      } else {
        // For search method, just focus on product search
        if (productInputRef.current) {
          productInputRef.current.focus()
        }
      }
    }, 200)
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
    setLastInputMethod('barcode')
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
    setLastInputMethod('ai')
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
                      {/* Show smart categorization */}
                      {(() => {
                        const taxonomyMatch = matchFoodTaxonomy(productData.name, productData.category, productData.brand)
                        const storageType = storageLocation?.type?.toLowerCase() as ShelfLifeLocation ||
                                           getStorageRecommendation(productData.name, productData.category)
                        const shelfLife = getDefaultShelfLife(productData.name, productData.category, storageType)

                        return (
                          <>
                            {taxonomyMatch && taxonomyMatch.confidence > 0.5 && (
                              <Grid item xs={12}>
                                <Typography variant="body2" color="textSecondary">Smart Category:</Typography>
                                <Chip
                                  label={`${taxonomyMatch.category}${taxonomyMatch.subcategory ? ` > ${taxonomyMatch.subcategory}` : ''}`}
                                  size="small"
                                  color="primary"
                                  sx={{ mr: 1 }}
                                />
                                <Typography variant="caption" color="textSecondary">
                                  ({Math.round(taxonomyMatch.confidence * 100)}% match)
                                </Typography>
                              </Grid>
                            )}
                            {shelfLife && (
                              <Grid item xs={12}>
                                <Typography variant="body2" color="textSecondary">Auto Shelf Life:</Typography>
                                <Chip
                                  label={`${shelfLife} days in ${storageLocation?.name || storageType}`}
                                  size="small"
                                  color="info"
                                />
                              </Grid>
                            )}
                          </>
                        )
                      })()}
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

      {/* Continuous Mode Toggle */}
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ py: 2 }}>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box>
              <Typography variant="h6">🛍️ Put Groceries Away Mode</Typography>
              <Typography variant="caption" color="textSecondary">
                {continuousMode
                  ? 'Auto-restart after each item for continuous stocking'
                  : 'Enable for bulk grocery put-away sessions'
                }
              </Typography>
            </Box>
            <Button
              variant={continuousMode ? 'contained' : 'outlined'}
              onClick={() => setContinuousMode(!continuousMode)}
              color="secondary"
              size="small"
            >
              {continuousMode ? 'Stop Mode' : 'Start Mode'}
            </Button>
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stepper activeStep={activeStep} orientation="vertical">
            <Step>
              <StepLabel>Find or Add Product</StepLabel>
              <StepContent>
                {/* Unified Product Input - Search/Scan/Type */}
                <Autocomplete
                  freeSolo
                  options={availableProducts}
                  getOptionLabel={(option) => typeof option === 'string' ? option : option.displayName}
                  value={availableProducts.find(p => p.upc === productBarcode) || productBarcode}
                  onChange={(event, newValue) => {
                    if (newValue && typeof newValue === 'object') {
                      setProductBarcode(newValue.upc)
                      setLastInputMethod('search')
                      setProductData({
                        name: newValue.name,
                        brand: newValue.brand,
                        category: newValue.category,
                        image_url: newValue.image_url,
                        upc: newValue.upc
                      })
                      setActiveStep(1) // Move to location step
                    }
                  }}
                  onInputChange={(event, newInputValue) => {
                    setProductBarcode(newInputValue)
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      inputRef={productInputRef}
                      label={isMobile ? "Search/Scan Product" : "Product Search or Barcode"}
                      placeholder={isMobile ? "Search or scan..." : "Search products, scan barcode, or use AI"}
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: isMobile ? params.InputProps.endAdornment : (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            {params.InputProps.endAdornment}
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
                  )}
                  renderOption={(props, option) => (
                    <li {...props}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                        {option.image_url && (
                          <Avatar src={option.image_url} sx={{ width: 32, height: 32 }} />
                        )}
                        <Box sx={{ flexGrow: 1 }}>
                          <Typography variant="body2">{option.name}</Typography>
                          {option.brand && (
                            <Typography variant="caption" color="textSecondary">
                              {option.brand} • {option.category}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </li>
                  )}
                />

                {/* Mobile-optimized button layout */}
                {isMobile ? (
                  <Box>
                    <Box display="flex" gap={1} mb={1}>
                      <IconButton
                        onClick={() => setShowBarcodeScanner(true)}
                        color="primary"
                        sx={{
                          border: '1px solid',
                          borderColor: 'primary.main',
                          borderRadius: 1,
                          flex: 1
                        }}
                      >
                        <CameraIcon />
                      </IconButton>
                      <IconButton
                        onClick={() => setShowVisualScanner(true)}
                        color="secondary"
                        sx={{
                          border: '1px solid',
                          borderColor: 'secondary.main',
                          borderRadius: 1,
                          flex: 1
                        }}
                      >
                        <EyeIcon />
                      </IconButton>
                      <Button
                        variant="contained"
                        onClick={() => lookupProduct(productBarcode)}
                        disabled={!productBarcode || lookupLoading}
                        sx={{ flex: 2 }}
                      >
                        {lookupLoading ? 'Looking...' : 'Lookup'}
                      </Button>
                    </Box>
                    <Button
                      variant="outlined"
                      onClick={() => router.push('/inventory/add?manual=true')}
                      startIcon={<EditIcon />}
                      fullWidth
                      size="small"
                    >
                      Manual Add
                    </Button>
                  </Box>
                ) : (
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
                    {voiceAssistantEnabled && !isMobile && (
                      <Button
                        variant="outlined"
                        onClick={() => setVoiceAssistantOpen(true)}
                        startIcon={<VoiceIcon />}
                        color="secondary"
                      >
                        Voice Add
                      </Button>
                    )}
                  </Box>
                )}

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
                    value={storageLocations.find(loc => loc.id === (locationCode || lastLocation)) || null}
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

      {/* Voice Assistant Floating Action Button - Show on all devices if enabled */}
      {voiceAssistantEnabled && (
        <Fab
          color="secondary"
          aria-label="voice assistant"
          sx={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            zIndex: 1000
          }}
          onClick={() => setVoiceAssistantOpen(true)}
        >
          <VoiceIcon />
        </Fab>
      )}

      {/* Voice Assistant Dialog */}
      {user && voiceAssistantType === 'whisper' ? (
        <WhisperVoiceAssistant
          open={voiceAssistantOpen}
          onClose={() => setVoiceAssistantOpen(false)}
          userId={user?.id}
          mode="add"
          onItemAdded={(item) => {
            // Refresh the page or show success message
            setSuccess(true)
            setTimeout(() => {
              if (continuousMode) {
                resetForContinuous()
              } else {
                router.push('/inventory')
              }
            }, 2000)
          }}
        />
      ) : user && voiceAssistantType === 'basic' ? (
        <VoiceAssistant
          open={voiceAssistantOpen}
          onClose={() => setVoiceAssistantOpen(false)}
          userId={user?.id}
          mode="add"
          onItemAdded={(item) => {
            // Refresh the page or show success message
            setSuccess(true)
            setTimeout(() => {
              if (continuousMode) {
                resetForContinuous()
              } else {
                router.push('/inventory')
              }
            }, 2000)
          }}
        />
      ) : null}
    </Container>
  )
}

export default function QuickAddPage() {
  return (
    <Suspense fallback={
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
          <CircularProgress />
        </Box>
      </Container>
    }>
      <QuickAddPageContent />
    </Suspense>
  )
}