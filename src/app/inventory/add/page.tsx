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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Paper,
  Divider,
  IconButton,
  CircularProgress,
  Fade,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Link
} from '@mui/material'
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  QrCodeScanner as ScannerIcon,
  CameraAlt as CameraIcon,
  Edit as EditIcon,
  Print as PrintIcon,
  Search as SearchIcon,
  Add as AddIcon,
  Visibility as EyeIcon
} from '@mui/icons-material'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '@/lib/supabase-client'
import BarcodeScanner from '@/components/BarcodeScanner'
import VisualItemScanner from '@/components/VisualItemScanner'
import QRCode from 'qrcode'

const barcodeSchema = z.object({
  barcode: z.string().min(1, 'Please enter a barcode or UPC'),
})

const addItemSchema = z.object({
  productName: z.string().min(1, 'Product name is required'),
  brand: z.string().optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  quantity: z.number().min(0.01, 'Quantity must be greater than 0'),
  unit: z.string().min(1, 'Unit is required'),
  storageLocation: z.string().min(1, 'Storage location is required'),
  purchaseDate: z.string().min(1, 'Purchase date is required'),
  expirationDate: z.string().optional(),
  cost: z.number().optional(),
  notes: z.string().optional(),
  upc: z.string().optional(),
})

type BarcodeForm = z.infer<typeof barcodeSchema>
type AddItemForm = z.infer<typeof addItemSchema>

interface ProductLookupResult {
  name: string
  brand?: string
  category?: string
  description?: string
  image_url?: string
  images?: string[]
  upc: string
  ean?: string
  model?: string
  color?: string
  size?: string
  price_range?: {
    lowest: number
    highest: number
  }
  weight?: string
  dimensions?: string
  offers?: Array<{
    merchant: string
    price: number
    condition: string
    availability: string
  }>
}

interface StorageLocationOption {
  id: string
  label: string
  fullPath: string
  level: number
}

// Default storage types for fallback
const defaultStorageTypes = [
  { value: 'pantry', label: 'Main Pantry' },
  { value: 'freezer', label: 'Main Freezer' },
  { value: 'refrigerator', label: 'Main Refrigerator' },
]

const units = [
  'pieces', 'lbs', 'oz', 'kg', 'g', 'cups', 'tbsp', 'tsp', 'cans', 'bottles', 'boxes', 'bags'
]

const categories = [
  'Pantry Staples', 'Canned Goods', 'Frozen Foods', 'Fresh Produce', 'Dairy', 'Meat & Poultry',
  'Seafood', 'Beverages', 'Snacks', 'Condiments', 'Spices & Seasonings', 'Baking', 'Other'
]

// Function to map API categories to our app categories
const mapApiCategory = (apiCategory?: string): string | undefined => {
  if (!apiCategory) return undefined

  const lowerCategory = apiCategory.toLowerCase()
  console.log('🏷️ Mapping category:', apiCategory, '->', lowerCategory)

  // Check for beverages first (most specific to least specific)
  if (lowerCategory.includes('beverages') || lowerCategory.includes('beverage') ||
      lowerCategory.includes('water') || lowerCategory.includes('drink') ||
      lowerCategory.includes('soda') || lowerCategory.includes('juice')) {
    console.log('✅ Mapped to: Beverages')
    return 'Beverages'
  }

  if (lowerCategory.includes('dairy') || lowerCategory.includes('milk') ||
      lowerCategory.includes('cheese') || lowerCategory.includes('yogurt')) {
    console.log('✅ Mapped to: Dairy')
    return 'Dairy'
  }

  if (lowerCategory.includes('meat') || lowerCategory.includes('poultry') ||
      lowerCategory.includes('chicken') || lowerCategory.includes('beef') ||
      lowerCategory.includes('pork') || lowerCategory.includes('turkey')) {
    console.log('✅ Mapped to: Meat & Poultry')
    return 'Meat & Poultry'
  }

  if (lowerCategory.includes('seafood') || lowerCategory.includes('fish') ||
      lowerCategory.includes('salmon') || lowerCategory.includes('tuna')) {
    console.log('✅ Mapped to: Seafood')
    return 'Seafood'
  }

  if (lowerCategory.includes('snack') || lowerCategory.includes('chip') ||
      lowerCategory.includes('candy') || lowerCategory.includes('cookie') ||
      lowerCategory.includes('cracker')) {
    console.log('✅ Mapped to: Snacks')
    return 'Snacks'
  }

  if (lowerCategory.includes('condiment') || lowerCategory.includes('sauce') ||
      lowerCategory.includes('dressing') || lowerCategory.includes('ketchup') ||
      lowerCategory.includes('mustard') || lowerCategory.includes('mayo')) {
    console.log('✅ Mapped to: Condiments')
    return 'Condiments'
  }

  if (lowerCategory.includes('spice') || lowerCategory.includes('seasoning') ||
      lowerCategory.includes('herb') || lowerCategory.includes('salt') ||
      lowerCategory.includes('pepper')) {
    console.log('✅ Mapped to: Spices & Seasonings')
    return 'Spices & Seasonings'
  }

  if (lowerCategory.includes('baking') || lowerCategory.includes('flour') ||
      lowerCategory.includes('sugar') || lowerCategory.includes('vanilla') ||
      lowerCategory.includes('yeast')) {
    console.log('✅ Mapped to: Baking')
    return 'Baking'
  }

  if (lowerCategory.includes('canned') || lowerCategory.includes('can ') ||
      lowerCategory.includes('jarred') || lowerCategory.includes('preserved')) {
    console.log('✅ Mapped to: Canned Goods')
    return 'Canned Goods'
  }

  if (lowerCategory.includes('frozen')) {
    console.log('✅ Mapped to: Frozen Foods')
    return 'Frozen Foods'
  }

  if (lowerCategory.includes('produce') || lowerCategory.includes('fruit') ||
      lowerCategory.includes('vegetable') || lowerCategory.includes('fresh')) {
    console.log('✅ Mapped to: Fresh Produce')
    return 'Fresh Produce'
  }

  if (lowerCategory.includes('pasta') || lowerCategory.includes('rice') ||
      lowerCategory.includes('bread') || lowerCategory.includes('cereal') ||
      lowerCategory.includes('grain')) {
    console.log('✅ Mapped to: Pantry Staples')
    return 'Pantry Staples'
  }

  console.log('⚠️ No mapping found, using: Other')
  return 'Other'
}

function AddItemPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const barcodeInputRef = useRef<HTMLInputElement>(null)

  const [user, setUser] = useState<any>(null)
  const [step, setStep] = useState<'barcode' | 'details'>('barcode')
  const [lookupLoading, setLookupLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [productData, setProductData] = useState<ProductLookupResult | null>(null)
  const [showCamera, setShowCamera] = useState(false)
  const [printDialogOpen, setPrintDialogOpen] = useState(false)
  const [generatedBarcode, setGeneratedBarcode] = useState<string>('')
  const [customItemQR, setCustomItemQR] = useState<string>('')
  const [storageLocations, setStorageLocations] = useState<StorageLocationOption[]>([])
  const [loadingLocations, setLoadingLocations] = useState(true)
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false)
  const [showVisualScanner, setShowVisualScanner] = useState(false)

  const barcodeForm = useForm<BarcodeForm>({
    resolver: zodResolver(barcodeSchema),
  })

  const detailsForm = useForm<AddItemForm>({
    resolver: zodResolver(addItemSchema),
    defaultValues: {
      quantity: 1,
      unit: 'pieces',
      purchaseDate: new Date().toISOString().split('T')[0],
    }
  })

  // Create default storage locations for a new household
  const createDefaultStorageLocations = async (householdId: string) => {
    const defaultLocations = [
      {
        household_id: householdId,
        name: 'Main Pantry',
        type: 'Pantry',
        description: 'Primary pantry storage location',
        level: 0,
        sort_order: 0,
        is_active: true
      },
      {
        household_id: householdId,
        name: 'Main Freezer',
        type: 'Freezer',
        description: 'Primary freezer storage location',
        level: 0,
        sort_order: 1,
        is_active: true
      },
      {
        household_id: householdId,
        name: 'Main Refrigerator',
        type: 'Refrigerator',
        description: 'Primary refrigerator storage location',
        level: 0,
        sort_order: 2,
        is_active: true
      }
    ]

    const { error } = await supabase
      .from('storage_locations')
      .insert(defaultLocations)

    if (error) {
      console.error('Error creating default storage locations:', error)
      throw error
    }

    console.log('✅ Created default storage locations for household:', householdId)
  }

  // Load storage locations
  const loadStorageLocations = async (currentUser?: any) => {
    const userToUse = currentUser || user
    console.log('📦 [Inventory] Loading storage locations for user:', userToUse?.id)

    if (!userToUse) {
      console.log('❌ [Inventory] No user found')
      setLoadingLocations(false)
      return
    }

    setLoadingLocations(true)
    try {
      // Get the user's actual household ID
      const householdId = await getUserHouseholdId(userToUse.id)

      if (!householdId) {
        throw new Error('No household found for user')
      }

      // Load all storage locations directly
      const { data, error } = await supabase
        .from('storage_locations')
        .select('*')
        .eq('household_id', householdId)
        .eq('is_active', true)
        .order('level')
        .order('sort_order')

      console.log('📊 [Inventory] Raw storage data:', data?.length || 0, 'locations')

      if (error) throw error

      // Build hierarchical structure and flatten for dropdown
      const locationOptions: StorageLocationOption[] = []

      // Helper function to build full path
      const buildLocationPath = (locations: any[], locationId: string): string => {
        const location = locations.find(l => l.id === locationId)
        if (!location) return ''

        if (location.parent_id) {
          const parentPath = buildLocationPath(locations, location.parent_id)
          return parentPath ? `${parentPath} > ${location.name}` : location.name
        }
        return location.name
      }

      // Create options for locations that can store items (level 0, 1, or 2)
      data.forEach(location => {
        const fullPath = buildLocationPath(data, location.id)
        locationOptions.push({
          id: location.id,
          label: location.name,
          fullPath: fullPath,
          level: (location as any).level || 0
        })
      })

      // Sort by level and name
      locationOptions.sort((a, b) => {
        if (a.level !== b.level) return a.level - b.level
        return a.fullPath.localeCompare(b.fullPath)
      })

      console.log('🏗️ [Inventory] Built location options:', locationOptions)
      console.log('📊 [Inventory] Sample locations with hierarchy:')
      locationOptions.slice(0, 3).forEach(loc => {
        console.log(`  - ${loc.fullPath} (level ${loc.level})`)
      })

      setStorageLocations(locationOptions)
      console.log('✅ [Inventory] Storage locations loaded:', locationOptions.length)
    } catch (err: any) {
      console.error('💥 [Inventory] Error loading storage locations:', err)
      setError('Failed to load storage locations')
    } finally {
      console.log('🏁 [Inventory] Storage loading finished')
      setLoadingLocations(false)
    }
  }

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUser(session.user)
        await loadStorageLocations(session.user)

        // Check if coming from Manual Add (skip barcode step)
        const isManualAdd = searchParams.get('manual') === 'true'
        if (isManualAdd) {
          setProductData({ name: '', upc: `MANUAL-${Date.now()}` })
          setStep('details')
        }
      } else {
        router.push('/auth')
      }
    }

    getUser()

    // Auto-focus the barcode input
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus()
    }
  }, [router, searchParams])

  // Look up product by UPC/barcode
  const lookupProduct = async (barcode: string) => {
    setLookupLoading(true)
    setError(null)

    try {
      // First check if we already have this product in our database
      const { data: existingProduct, error: dbError } = await supabase
        .from('products')
        .select('*')
        .eq('upc', barcode)
        .maybeSingle()

      if (existingProduct) {
        // Use existing product data
        setProductData({
          name: existingProduct.name,
          brand: existingProduct.brand || undefined,
          category: existingProduct.category || undefined,
          image_url: existingProduct.image_url || undefined,
          upc: barcode
        })
        setStep('details')
        return
      }

      // If not in our database, try external API lookup via our proxy
      let apiResponse
      try {
        // Use our Next.js API proxy to avoid CORS issues
        const fetchUrl = `/api/barcode/lookup?upc=${barcode}`
        console.log('🔍 Fetching from proxy URL:', fetchUrl)

        const response = await fetch(fetchUrl)
        console.log('📡 Response status:', response.status, response.statusText)

        if (response.ok) {
          apiResponse = await response.json()
          console.log('📦 UPC Lookup Response:', apiResponse)
          console.log('📊 Items found:', apiResponse?.items?.length || 0)

          // Check if the response contains an error from our API
          if (apiResponse.error) {
            console.log('⚠️ API returned error:', apiResponse.error)
            throw new Error(apiResponse.error)
          }
        } else {
          const errorText = await response.text()
          console.log('❌ Response not OK:', response.status, errorText)
          throw new Error(`API request failed: ${response.status}`)
        }
      } catch (apiError) {
        console.log('💥 Barcode lookup failed, will use manual entry:', apiError)
      }

      if (apiResponse?.items?.length > 0) {
        const item = apiResponse.items[0]

        // Extract price information
        const priceRange = item.lowest_recorded_price && item.highest_recorded_price ? {
          lowest: parseFloat(item.lowest_recorded_price),
          highest: parseFloat(item.highest_recorded_price)
        } : undefined

        // Extract store offers
        const offers = item.offers?.slice(0, 5).map((offer: any) => ({
          merchant: offer.merchant || '',
          price: parseFloat(offer.price) || 0,
          condition: offer.condition || '',
          availability: offer.availability || ''
        })) || []

        const productData = {
          name: item.title || item.description || 'Unknown Product',
          brand: item.brand || undefined,
          category: mapApiCategory(item.category),
          description: item.description || undefined,
          image_url: item.images?.[0] || undefined,
          images: item.images || [],
          ean: item.ean || undefined,
          model: item.model || undefined,
          color: item.color || undefined,
          size: item.size || undefined,
          weight: item.weight || undefined,
          dimensions: item.dimension || undefined,
          price_range: priceRange,
          offers: offers,
          upc: barcode
        }

        console.log('✅ Product found:', item.title, 'by', item.brand)
        console.log('📦 Category mapped:', item.category, '->', productData.category)
        console.log('💰 Price range:', priceRange)
        console.log('🏪 Store offers:', offers.length, 'found')
        console.log('🏷️ Setting product data:', productData)

        setProductData(productData)
      } else {
        // No data found, proceed with manual entry
        console.log('⚠️ No items found in API response, using manual entry')
        setProductData({
          name: '',
          upc: barcode
        })
      }

      setStep('details')
    } catch (err: any) {
      setError('Failed to lookup product. You can still add it manually.')
      setProductData({
        name: '',
        upc: barcode
      })
      setStep('details')
    } finally {
      setLookupLoading(false)
    }
  }

  const onBarcodeSubmit = async (data: BarcodeForm) => {
    await lookupProduct(data.barcode)
  }

  const onDetailsSubmit = async (data: AddItemForm) => {
    if (!user) return

    setSaving(true)
    setError(null)

    try {
      // Create or find product
      let productId: string

      if (productData?.upc) {
        // Check if product exists with this UPC
        const { data: existingProduct, error: productSearchError } = await supabase
          .from('products')
          .select('id')
          .eq('upc', productData.upc)
          .maybeSingle()

        if (existingProduct) {
          productId = existingProduct.id
        } else {
          // Create new product with UPC
          const nutritionalInfo = {
            description: data.description || productData?.description || null,
            weight: productData?.weight || null,
            dimensions: productData?.dimensions || null,
            price_data: productData?.price_range ? {
              lowest_price: productData.price_range.lowest,
              highest_price: productData.price_range.highest,
              offers: productData.offers
            } : null,
            additional_images: productData?.images?.slice(1) || [], // Store additional images beyond the primary one
            api_source: 'upcitemdb',
            api_data: {
              ean: productData?.ean || null,
              model: productData?.model || null,
              color: productData?.color || null,
              size: productData?.size || null
            }
          }

          const { data: newProduct, error: productCreateError } = await supabase
            .from('products')
            .insert([
              {
                name: data.productName,
                brand: data.brand || null,
                category: data.category || null,
                upc: productData.upc,
                image_url: productData?.image_url || null,
                nutritional_info: nutritionalInfo,
                is_custom: !productData?.name, // If we had to enter name manually, it's custom
                created_by: user.id,
              }
            ])
            .select('id')
            .single()

          if (productCreateError) throw productCreateError
          productId = newProduct.id
        }
      } else {
        // Create custom product without UPC
        const customUpc = `CUSTOM-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

        const nutritionalInfo = {
          description: data.description || null,
          api_source: 'manual_entry'
        }

        const { data: newProduct, error: productCreateError } = await supabase
          .from('products')
          .insert([
            {
              name: data.productName,
              brand: data.brand || null,
              category: data.category || null,
              upc: customUpc,
              nutritional_info: nutritionalInfo,
              is_custom: true,
              created_by: user.id,
            }
          ])
          .select('id, upc')
          .single()

        if (productCreateError) throw productCreateError
        productId = newProduct.id
        setGeneratedBarcode(newProduct.upc || '') // Save for potential printing
      }

      // Get the user's actual household ID
      const householdId = await getUserHouseholdId(user.id)

      if (!householdId) {
        throw new Error('No household found for user. Please contact support.')
      }

      // Handle storage location
      let storageLocationId: string

      // Check if data.storageLocation is a UUID (from configured locations) or a legacy string
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.storageLocation)

      if (isUUID) {
        // Using configured location - just use the ID directly
        storageLocationId = data.storageLocation
        console.log('✅ Using configured storage location:', storageLocationId)
      } else {
        // Legacy mode or fallback - find or create location
        console.log('🔄 Using legacy storage location mode:', data.storageLocation)

        const { data: existingLocation, error: locationSearchError } = await supabase
          .from('storage_locations')
          .select('id')
          .eq('household_id', householdId)
          .eq('name', defaultStorageTypes.find(t => t.value === data.storageLocation)?.label || data.storageLocation)
          .maybeSingle()

        if (existingLocation) {
          storageLocationId = existingLocation.id
        } else {
          const { data: newLocation, error: locationCreateError } = await supabase
            .from('storage_locations')
            .insert([
              {
                household_id: householdId,
                name: defaultStorageTypes.find(t => t.value === data.storageLocation)?.label || data.storageLocation,
                type: data.storageLocation === 'pantry' ? 'Pantry' :
                      data.storageLocation === 'freezer' ? 'Freezer' : 'Refrigerator',
                level: 0,
                sort_order: 0
              }
            ])
            .select('id')
            .single()

          if (locationCreateError) throw locationCreateError
          storageLocationId = newLocation.id
        }
      }

      // Create inventory item
      const { data: newInventoryItem, error: inventoryError } = await supabase
        .from('inventory_items')
        .insert([
          {
            product_id: productId,
            storage_location_id: storageLocationId,
            household_id: householdId,
            quantity: data.quantity,
            unit: data.unit,
            purchase_date: data.purchaseDate,
            expiration_date: data.expirationDate || null,
            cost: data.cost || null,
            notes: data.notes || null,
            created_by: user.id,
            last_modified_by: user.id,
            last_modified_at: new Date().toISOString()
          }
        ])
        .select('id')
        .single()

      if (inventoryError) throw inventoryError

      setSuccess(true)

      // For custom items (no original barcode), offer to print item QR code
      const isCustomItem = !productData?.upc || productData.upc.startsWith('CUSTOM-')
      if (isCustomItem && newInventoryItem) {
        setTimeout(() => {
          setCustomItemQR(newInventoryItem.id) // Use inventory item ID for QR
          setPrintDialogOpen(true)
        }, 1000)
      }


      setTimeout(() => {
        router.push('/inventory')
      }, 3000)

    } catch (err: any) {
      setError(err.message || 'Failed to add item')
      console.error('Error adding item:', err)
    } finally {
      setSaving(false)
    }
  }

  const startOver = () => {
    setStep('barcode')
    setProductData(null)
    setError(null)
    barcodeForm.reset()
    detailsForm.reset({
      quantity: 1,
      unit: 'pieces',
      purchaseDate: new Date().toISOString().split('T')[0],
    })
    setTimeout(() => {
      if (barcodeInputRef.current) {
        barcodeInputRef.current.focus()
      }
    }, 100)
  }

  const handleBarcodeScanned = (barcode: string) => {
    console.log('📱 Camera scanned barcode:', barcode)
    barcodeForm.setValue('barcode', barcode)
    setShowBarcodeScanner(false)
    // Automatically lookup the product
    lookupProduct(barcode)
  }

  const handleVisualItemSelected = (itemData: any) => {
    console.log('👁️ AI identified item:', itemData)
    setProductData({
      name: itemData.name,
      brand: itemData.brand,
      category: itemData.category,
      upc: itemData.upc
    })
    setShowVisualScanner(false)
    setStep('details')
  }

  const printBarcode = async () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const productName = detailsForm.getValues('productName')
    const isCustomItem = !productData?.upc || productData.upc.startsWith('CUSTOM-')

    try {
      if (isCustomItem && customItemQR) {
        // Generate QR code for custom items (links to inventory item)
        const itemUrl = `${window.location.origin}/inventory/item/${customItemQR}`
        const qrCodeDataUrl = await QRCode.toDataURL(itemUrl, {
          width: 200,
          margin: 2,
          color: { dark: '#000000', light: '#FFFFFF' }
        })

        printWindow.document.write(`
          <html>
            <head>
              <title>Print Item QR Code</title>
              <style>
                body { font-family: Arial, sans-serif; text-align: center; margin: 20px; }
                .qr-container { border: 2px solid #000; padding: 20px; display: inline-block; margin: 20px; }
                .item-info { margin: 10px 0; font-size: 18px; font-weight: bold; }
                .instructions { margin: 10px 0; font-size: 12px; color: #666; }
                .details { margin: 10px 0; font-size: 14px; }
              </style>
            </head>
            <body>
              <div class="qr-container">
                <div class="item-info">${productName}</div>
                <div class="instructions">Scan to view/edit this item</div>
                <img src="${qrCodeDataUrl}" alt="Item QR Code" />
                <div class="footer">
                  PantryIQ - Smart Inventory Management<br>
                  Custom Item • ID: ${customItemQR}
                </div>
              </div>
            </body>
          </html>
        `)
      } else if (generatedBarcode) {
        // Regular barcode for standard products
        printWindow.document.write(`
          <html>
            <head><title>Print Barcode</title></head>
            <body style="text-align: center; font-family: Arial;">
              <h2>${productName}</h2>
              <div style="font-size: 24px; font-family: monospace; margin: 20px;">
                ${generatedBarcode}
              </div>
              <div style="border: 1px solid #000; display: inline-block; padding: 10px;">
                <div style="font-family: monospace; font-size: 12px;">
                  ${generatedBarcode}
                </div>
              </div>
            </body>
          </html>
        `)
      }

      printWindow.document.close()
      printWindow.print()
    } catch (err) {
      console.error('Error generating print content:', err)
    }

    setPrintDialogOpen(false)
  }

  // Populate form when product data is available
  useEffect(() => {
    console.log('🔄 Form population effect triggered:')
    console.log('   productData:', productData)
    console.log('   step:', step)

    if (productData && step === 'details') {
      console.log('📝 Populating form with product data:')
      console.log('   name:', productData.name)
      console.log('   brand:', productData.brand)
      console.log('   category:', productData.category)
      console.log('   description:', productData.description)

      detailsForm.setValue('productName', productData.name)
      if (productData.brand) detailsForm.setValue('brand', productData.brand)

      if (productData.category) {
        console.log('🔄 Setting category field to:', productData.category)
        console.log('📝 Available categories:', categories)
        console.log('🔍 Category exists in list?', categories.includes(productData.category))

        detailsForm.setValue('category', productData.category, {
          shouldValidate: true,
          shouldDirty: true
        })

        // Force a trigger to update the form state and re-render
        detailsForm.trigger('category')

        setTimeout(() => {
          console.log('🔄 Current form category value:', detailsForm.getValues('category'))
        }, 100)
      }

      if (productData.description) detailsForm.setValue('description', productData.description)
      if (productData.upc) detailsForm.setValue('upc', productData.upc)

      // If we have price data, populate the cost field with the lowest price
      if (productData.price_range?.lowest) {
        detailsForm.setValue('cost', productData.price_range.lowest)
        console.log('💰 Setting cost to lowest price:', productData.price_range.lowest)
      }

      console.log('✅ Form population complete')
    }
  }, [productData, step, detailsForm])

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
          <Typography variant="h4" component="h1" gutterBottom>
            Add New Item
          </Typography>
          <Typography variant="body1" color="textSecondary">
            {step === 'barcode' ? 'Scan or enter a barcode to get started' : 'Complete the item details'}
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
          Item added successfully! Redirecting to inventory...
        </Alert>
      )}

      {/* Barcode Entry Step */}
      {step === 'barcode' && (
        <Fade in={true}>
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <ScannerIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
            <Typography variant="h5" gutterBottom>
              Scan or Enter Barcode
            </Typography>
            <Typography variant="body1" color="textSecondary" paragraph>
              Enter a UPC barcode to automatically fetch product information
            </Typography>

            <form onSubmit={barcodeForm.handleSubmit(onBarcodeSubmit)}>
              <Box sx={{ maxWidth: 400, mx: 'auto', mb: 3 }}>
                <Controller
                  name="barcode"
                  control={barcodeForm.control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      inputRef={barcodeInputRef}
                      label="UPC / Barcode"
                      fullWidth
                      placeholder="e.g. 123456789012"
                      error={!!barcodeForm.formState.errors.barcode}
                      helperText={barcodeForm.formState.errors.barcode?.message}
                      InputProps={{
                        endAdornment: (
                          <IconButton
                            onClick={() => setShowCamera(true)}
                            title="Scan with camera"
                          >
                            <CameraIcon />
                          </IconButton>
                        ),
                      }}
                    />
                  )}
                />
              </Box>

              <Box display="flex" gap={2} justifyContent="center" mb={3}>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={lookupLoading ? <CircularProgress size={20} /> : <SearchIcon />}
                  disabled={lookupLoading}
                  size="large"
                >
                  {lookupLoading ? 'Looking up...' : 'Lookup Product'}
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<CameraIcon />}
                  onClick={() => setShowBarcodeScanner(true)}
                  size="large"
                >
                  Scan Barcode
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<EyeIcon />}
                  onClick={() => setShowVisualScanner(true)}
                  size="large"
                  color="secondary"
                >
                  AI Recognition
                </Button>
              </Box>
            </form>

            <Divider sx={{ my: 3 }}>
              <Typography variant="body2" color="textSecondary">
                OR
              </Typography>
            </Divider>

            <Button
              variant="text"
              startIcon={<EditIcon />}
              onClick={() => {
                setProductData({ name: '', upc: '' })
                setStep('details')
              }}
            >
              Add item manually (no barcode)
            </Button>
          </Paper>
        </Fade>
      )}

      {/* Product Details Step */}
      {step === 'details' && (
        <Fade in={true}>
          <Paper sx={{ p: 4 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
              <Typography variant="h6">
                {productData?.name ? 'Complete Product Details' : 'Enter Product Details'}
              </Typography>
              <Button
                variant="outlined"
                size="small"
                onClick={startOver}
              >
                Start Over
              </Button>
            </Box>

            {productData?.upc && (
              <Alert severity="info" sx={{ mb: 3 }}>
                {productData.name ?
                  `Product found: ${productData.name}${productData.brand ? ` by ${productData.brand}` : ''}` :
                  `No product data found for barcode ${productData.upc}. Please enter details manually.`
                }
              </Alert>
            )}

            <form onSubmit={detailsForm.handleSubmit(onDetailsSubmit)}>
              <Grid container spacing={3}>
                {/* Product Information */}
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom>
                    Product Information
                  </Typography>
                </Grid>

                {/* Product Image Display */}
                {productData?.image_url && (
                  <Grid item xs={12} sm={4}>
                    <Paper sx={{ p: 2, textAlign: 'center' }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Product Image
                      </Typography>
                      <Box
                        component="img"
                        src={productData.image_url}
                        alt={productData.name}
                        sx={{
                          maxWidth: '100%',
                          maxHeight: 200,
                          objectFit: 'contain',
                          borderRadius: 1,
                          border: '1px solid #ddd'
                        }}
                        onError={(e) => {
                          console.log('❌ Image failed to load:', productData.image_url)
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    </Paper>
                  </Grid>
                )}

                <Grid item xs={12} sm={productData?.image_url ? 8 : 6}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <Controller
                        name="productName"
                        control={detailsForm.control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            label="Product Name *"
                            fullWidth
                            error={!!detailsForm.formState.errors.productName}
                            helperText={detailsForm.formState.errors.productName?.message}
                          />
                        )}
                      />
                    </Grid>

                    <Grid item xs={12} sm={6}>
                      <Controller
                        name="brand"
                        control={detailsForm.control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            label="Brand"
                            fullWidth
                            error={!!detailsForm.formState.errors.brand}
                            helperText={detailsForm.formState.errors.brand?.message}
                          />
                        )}
                      />
                    </Grid>

                    <Grid item xs={12} sm={6}>
                      <Controller
                        name="category"
                        control={detailsForm.control}
                        render={({ field }) => {
                          console.log('🔄 Category field render, current value:', field.value)
                          return (
                            <FormControl fullWidth>
                              <InputLabel>Category</InputLabel>
                              <Select
                                {...field}
                                label="Category"
                                value={field.value || ''}
                                onChange={(e) => {
                                  console.log('📝 Category changed to:', e.target.value)
                                  field.onChange(e.target.value)
                                }}
                              >
                                {categories.map((category) => (
                                  <MenuItem key={category} value={category}>
                                    {category}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          )
                        }}
                      />
                    </Grid>
                  </Grid>
                </Grid>

                <Grid item xs={12}>
                  <Controller
                    name="description"
                    control={detailsForm.control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Description"
                        multiline
                        rows={2}
                        fullWidth
                        error={!!detailsForm.formState.errors.description}
                        helperText={detailsForm.formState.errors.description?.message}
                      />
                    )}
                  />
                </Grid>

                {/* Price Information Display */}
                {productData?.price_range && (
                  <Grid item xs={12}>
                    <Paper sx={{ p: 2, backgroundColor: 'info.light', color: 'info.contrastText' }}>
                      <Typography variant="h6" gutterBottom>
                        💰 Price Information
                      </Typography>
                      <Typography variant="body2">
                        Price Range: ${productData.price_range.lowest.toFixed(2)} - ${productData.price_range.highest.toFixed(2)}
                      </Typography>
                      {productData.offers && productData.offers.length > 0 && (
                        <Box sx={{ mt: 1 }}>
                          <Typography variant="body2" gutterBottom>Recent Store Prices:</Typography>
                          {productData.offers.slice(0, 3).map((offer, index) => (
                            <Typography key={index} variant="caption" display="block">
                              • {offer.merchant}: ${offer.price.toFixed(2)} ({offer.condition})
                            </Typography>
                          ))}
                        </Box>
                      )}
                    </Paper>
                  </Grid>
                )}

                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="h6" gutterBottom>
                    Quantity & Location
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={4}>
                  <Controller
                    name="quantity"
                    control={detailsForm.control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Quantity *"
                        type="number"
                        inputProps={{ step: 0.01, min: 0 }}
                        fullWidth
                        error={!!detailsForm.formState.errors.quantity}
                        helperText={detailsForm.formState.errors.quantity?.message}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    )}
                  />
                </Grid>

                <Grid item xs={12} sm={4}>
                  <Controller
                    name="unit"
                    control={detailsForm.control}
                    render={({ field }) => (
                      <FormControl fullWidth>
                        <InputLabel>Unit *</InputLabel>
                        <Select {...field} label="Unit *">
                          {units.map((unit) => (
                            <MenuItem key={unit} value={unit}>
                              {unit}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    )}
                  />
                </Grid>

                <Grid item xs={12} sm={4}>
                  <Controller
                    name="storageLocation"
                    control={detailsForm.control}
                    render={({ field }) => (
                      <FormControl fullWidth>
                        <InputLabel>Storage Location *</InputLabel>
                        <Select
                          {...field}
                          label="Storage Location *"
                          disabled={loadingLocations}
                        >
                          {storageLocations.length > 0 ? (
                            storageLocations.map((location) => (
                              <MenuItem
                                key={location.id}
                                value={location.id}
                                sx={{
                                  pl: location.level * 2 + 2, // Indent based on level
                                  fontSize: location.level === 0 ? '1rem' : '0.9rem',
                                  fontWeight: location.level === 0 ? 500 : 400,
                                  color: location.level === 0 ? 'primary.main' : 'text.primary'
                                }}
                              >
                                {location.fullPath}
                              </MenuItem>
                            ))
                          ) : (
                            // Fallback to default storage types if no configured locations
                            defaultStorageTypes.map((type) => (
                              <MenuItem key={type.value} value={type.value}>
                                {type.label}
                              </MenuItem>
                            ))
                          )}
                        </Select>
                        {loadingLocations && (
                          <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                            <Typography variant="caption" color="textSecondary">
                              Loading storage locations...
                            </Typography>
                          </Box>
                        )}
                        {!loadingLocations && storageLocations.length === 0 && (
                          <Box sx={{ mt: 1 }}>
                            <Typography variant="caption" color="warning.main">
                              No storage locations configured.
                              <Link href="/settings/storage" sx={{ ml: 0.5 }}>
                                Configure now
                              </Link>
                            </Typography>
                          </Box>
                        )}
                      </FormControl>
                    )}
                  />
                </Grid>

                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="h6" gutterBottom>
                    Dates & Details
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Controller
                    name="purchaseDate"
                    control={detailsForm.control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Purchase Date *"
                        type="date"
                        fullWidth
                        InputLabelProps={{ shrink: true }}
                        error={!!detailsForm.formState.errors.purchaseDate}
                        helperText={detailsForm.formState.errors.purchaseDate?.message}
                      />
                    )}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Controller
                    name="expirationDate"
                    control={detailsForm.control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Expiration Date"
                        type="date"
                        fullWidth
                        InputLabelProps={{ shrink: true }}
                        error={!!detailsForm.formState.errors.expirationDate}
                        helperText={detailsForm.formState.errors.expirationDate?.message}
                      />
                    )}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Controller
                    name="cost"
                    control={detailsForm.control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Cost"
                        type="number"
                        inputProps={{ step: 0.01, min: 0 }}
                        fullWidth
                        error={!!detailsForm.formState.errors.cost}
                        helperText={detailsForm.formState.errors.cost?.message}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                      />
                    )}
                  />
                </Grid>

                <Grid item xs={12}>
                  <Controller
                    name="notes"
                    control={detailsForm.control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Notes"
                        multiline
                        rows={3}
                        fullWidth
                        error={!!detailsForm.formState.errors.notes}
                        helperText={detailsForm.formState.errors.notes?.message}
                      />
                    )}
                  />
                </Grid>

                <Grid item xs={12}>
                  <Box display="flex" gap={2} justifyContent="flex-end">
                    <Button
                      variant="outlined"
                      onClick={startOver}
                      disabled={saving}
                    >
                      Start Over
                    </Button>
                    <Button
                      type="submit"
                      variant="contained"
                      startIcon={<SaveIcon />}
                      disabled={saving}
                    >
                      {saving ? 'Adding...' : 'Add Item'}
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            </form>
          </Paper>
        </Fade>
      )}

      {/* Print Item Code Dialog */}
      <Dialog open={printDialogOpen} onClose={() => setPrintDialogOpen(false)}>
        <DialogTitle>
          {customItemQR ? 'Print Item QR Code' : 'Print Custom Barcode'}
        </DialogTitle>
        <DialogContent>
          <Typography paragraph>
            {customItemQR
              ? 'A custom QR code has been generated for this item. Perfect for homemade items, garden produce, or meal prep containers!'
              : 'A custom barcode has been generated for this item.'
            }
          </Typography>
          <Typography variant="body2" color="textSecondary">
            {customItemQR
              ? `Item ID: ${customItemQR}`
              : `Barcode: ${generatedBarcode}`
            }
          </Typography>
          {customItemQR && (
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                <strong>Perfect for:</strong> Garden produce, meal prep containers, bulk items,
                homemade foods, and anything without a barcode
              </Typography>
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPrintDialogOpen(false)}>
            Skip
          </Button>
          <Button
            onClick={printBarcode}
            variant="contained"
            startIcon={<PrintIcon />}
          >
            {customItemQR ? 'Print QR Code' : 'Print Barcode'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Barcode Scanner Dialog */}
      <BarcodeScanner
        open={showBarcodeScanner}
        onClose={() => setShowBarcodeScanner(false)}
        onScan={handleBarcodeScanned}
        title="Scan Product Barcode"
        description="Align the product barcode within the green box for automatic scanning"
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

export default function AddItemPage() {
  return (
    <Suspense fallback={
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
          <CircularProgress />
        </Box>
      </Container>
    }>
      <AddItemPageContent />
    </Suspense>
  )
}