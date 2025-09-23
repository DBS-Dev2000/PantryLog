'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Button,
  Grid,
  Alert,
  Paper,
  IconButton,
  CircularProgress,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Checkbox,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  LinearProgress,
  Stepper,
  Step,
  StepLabel,
  StepContent
} from '@mui/material'
import {
  ArrowBack as ArrowBackIcon,
  CloudUpload as UploadIcon,
  CameraAlt as CameraIcon,
  Receipt as ReceiptIcon,
  Check as CheckIcon,
  Edit as EditIcon,
  LocationOn as LocationIcon,
  AttachMoney as MoneyIcon,
  CalendarToday as CalendarIcon,
  ShoppingCart as CartIcon
} from '@mui/icons-material'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getUserHouseholdId } from '@/lib/household-utils'

interface ReceiptItem {
  name: string
  price: number
  quantity: number
  category?: string
  matched_product_id?: string
  storage_location_id?: string
  selected: boolean
}

export default function ReceiptScanPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const [user, setUser] = useState<any>(null)
  const [activeStep, setActiveStep] = useState(0)
  const [receiptImage, setReceiptImage] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [extractedItems, setExtractedItems] = useState<ReceiptItem[]>([])
  const [storageLocations, setStorageLocations] = useState<any[]>([])
  const [defaultLocation, setDefaultLocation] = useState<string>('')
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUser(session.user)
        await loadStorageLocations(session.user.id)
      } else {
        router.push('/auth')
      }
    }

    getUser()
  }, [router])

  const loadStorageLocations = async (userId: string) => {
    try {
      // Ensure household exists (don't overwrite existing name)
      const { data: existingHousehold } = await supabase
        .from('households')
        .select('id, name')
        .eq('id', userId)
        .single()

      if (!existingHousehold) {
        await supabase
          .from('households')
          .insert([{ id: userId, name: 'My Household' }])
      }

      // Load storage locations
      const { data: locations, error } = await supabase
        .from('storage_locations')
        .select('*')
        .eq('household_id', userId)
        .eq('is_active', true)
        .order('level')
        .order('sort_order')

      if (error) throw error

      setStorageLocations(locations || [])

      // Find or create "Counter" location as default
      let counterLocation = locations?.find(l => l.name.toLowerCase().includes('counter'))

      if (!counterLocation) {
        // Create Counter location
        const { data: newLocation, error: createError } = await supabase
          .from('storage_locations')
          .insert([{
            household_id: userId,
            name: 'Counter',
            type: 'Staging',
            description: 'Temporary staging area for receipt items',
            level: 0,
            sort_order: 999
          }])
          .select()
          .single()

        if (!createError && newLocation) {
          counterLocation = newLocation
          setStorageLocations(prev => [...prev, newLocation])
        }
      }

      if (counterLocation) {
        setDefaultLocation(counterLocation.id)
        console.log('📍 Default location set to Counter:', counterLocation.id)
      }

    } catch (err: any) {
      console.error('Error loading storage locations:', err)
      setError('Failed to load storage locations')
    }
  }

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      setReceiptImage(result)
      setActiveStep(1)
      console.log('📷 Receipt image loaded')
    }
    reader.readAsDataURL(file)
  }

  const processReceipt = async () => {
    if (!receiptImage) return

    setProcessing(true)
    setError(null)

    try {
      console.log('🔍 Processing receipt with AI...')

      // Create a mock receipt processing for now - replace with actual OCR/AI service
      // In production, this would call an OCR service like Google Vision API or Azure Cognitive Services

      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 3000))

      // Mock extracted items - replace with actual OCR results
      const mockItems: ReceiptItem[] = [
        {
          name: 'Milk (Whole)',
          price: 3.49,
          quantity: 1,
          category: 'Dairy',
          selected: true
        },
        {
          name: 'Bread (Wheat)',
          price: 2.99,
          quantity: 1,
          category: 'Pantry Staples',
          selected: true
        },
        {
          name: 'Bananas',
          price: 1.67,
          quantity: 1,
          category: 'Fresh Produce',
          selected: true
        },
        {
          name: 'Ground Beef',
          price: 8.99,
          quantity: 1,
          category: 'Meat & Poultry',
          selected: true
        },
        {
          name: 'Frozen Pizza',
          price: 4.99,
          quantity: 2,
          category: 'Frozen Foods',
          selected: true
        }
      ]

      // Set default storage location for all items
      const itemsWithDefaults = mockItems.map(item => ({
        ...item,
        storage_location_id: defaultLocation
      }))

      setExtractedItems(itemsWithDefaults)
      setActiveStep(2)

      console.log('✅ Receipt processed, found', mockItems.length, 'items')

    } catch (err: any) {
      console.error('❌ Receipt processing error:', err)
      setError('Failed to process receipt. Please try again or add items manually.')
    } finally {
      setProcessing(false)
    }
  }

  const updateItem = (index: number, updates: Partial<ReceiptItem>) => {
    setExtractedItems(prev =>
      prev.map((item, i) => i === index ? { ...item, ...updates } : item)
    )
  }

  const toggleItemSelection = (index: number) => {
    updateItem(index, { selected: !extractedItems[index].selected })
  }

  const processSelectedItems = async () => {
    if (!user) return

    setSaving(true)
    setError(null)

    try {
      // Get the user's actual household ID
      const householdId = await getUserHouseholdId(user.id)
      if (!householdId) {
        throw new Error('No household found for user')
      }

      const selectedItems = extractedItems.filter(item => item.selected)
      let successCount = 0

      for (const item of selectedItems) {
        try {
          // Create or find product
          const { data: existingProduct } = await supabase
            .from('products')
            .select('id')
            .ilike('name', `%${item.name}%`)
            .maybeSingle()

          let productId: string

          if (existingProduct) {
            productId = existingProduct.id
          } else {
            // Create new product
            const { data: newProduct, error: productError } = await supabase
              .from('products')
              .insert([{
                name: item.name,
                category: item.category,
                is_custom: true,
                created_by: user.id,
                upc: `RECEIPT-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`
              }])
              .select('id')
              .single()

            if (productError) throw productError
            productId = newProduct.id
          }

          // Add to inventory
          const { data: inventoryItem, error: inventoryError } = await supabase
            .from('inventory_items')
            .insert([{
              product_id: productId,
              storage_location_id: item.storage_location_id || defaultLocation,
              household_id: householdId,
              quantity: item.quantity,
              unit: 'pieces',
              purchase_date: receiptDate,
              cost: item.price,
              notes: `From receipt scan - ${new Date().toLocaleDateString()}`,
              created_by: user.id,
              last_modified_by: user.id,
              last_modified_at: new Date().toISOString()
            }])
            .select('id')
            .single()

          if (inventoryError) throw inventoryError

          // Log audit trail
          if (inventoryItem) {
            await supabase
              .from('inventory_audit_log')
              .insert([{
                inventory_item_id: inventoryItem.id,
                household_id: householdId,
                user_id: user.id,
                action_type: 'add',
                quantity_before: 0,
                quantity_after: item.quantity,
                quantity_delta: item.quantity,
                unit_cost: item.price / item.quantity,
                total_value: item.price,
                notes: `Receipt Import: ${item.name} ($${item.price})`,
                source_action: 'receipt_scan'
              }])
          }

          successCount++
          console.log('✅ Added item from receipt:', item.name)

        } catch (itemError) {
          console.error('❌ Failed to add item:', item.name, itemError)
        }
      }

      setSuccess(true)
      console.log('🎉 Receipt processing complete:', successCount, 'items added')

      // Navigate to inventory after success
      setTimeout(() => {
        router.push('/inventory')
      }, 3000)

    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const resetReceipt = () => {
    setActiveStep(0)
    setReceiptImage(null)
    setExtractedItems([])
    setError(null)
    setSuccess(false)
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
            <ReceiptIcon color="primary" />
            <Typography variant="h4" component="h1">
              Receipt Scan
            </Typography>
          </Box>
          <Typography variant="body1" color="textSecondary">
            Upload or photograph your grocery receipt for automatic item detection
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
          Receipt processed successfully! Items added to inventory. Redirecting...
        </Alert>
      )}

      <Card>
        <CardContent>
          <Stepper activeStep={activeStep} orientation="vertical">
            {/* Step 1: Upload Receipt */}
            <Step>
              <StepLabel>Upload Receipt Image</StepLabel>
              <StepContent>
                <Box sx={{ textAlign: 'center', py: 3 }}>
                  {!receiptImage ? (
                    <>
                      <ReceiptIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                      <Typography variant="h6" gutterBottom>
                        Upload Your Receipt
                      </Typography>
                      <Typography variant="body2" color="textSecondary" paragraph>
                        Take a photo or upload an image of your grocery receipt
                      </Typography>

                      <Box display="flex" gap={2} justifyContent="center" flexWrap="wrap">
                        <Button
                          variant="contained"
                          startIcon={<CameraIcon />}
                          onClick={() => cameraInputRef.current?.click()}
                        >
                          Take Photo
                        </Button>
                        <Button
                          variant="outlined"
                          startIcon={<UploadIcon />}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          Upload Image
                        </Button>
                      </Box>

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        style={{ display: 'none' }}
                      />
                      <input
                        ref={cameraInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleImageUpload}
                        style={{ display: 'none' }}
                      />
                    </>
                  ) : (
                    <Box>
                      <Typography variant="h6" gutterBottom>
                        Receipt Uploaded
                      </Typography>
                      <Paper sx={{ p: 2, mb: 2, display: 'inline-block' }}>
                        <img
                          src={receiptImage}
                          alt="Receipt"
                          style={{ maxWidth: '100%', maxHeight: 300, borderRadius: 8 }}
                        />
                      </Paper>
                      <Box>
                        <Button
                          variant="contained"
                          onClick={processReceipt}
                          disabled={processing}
                          startIcon={processing ? <CircularProgress size={20} /> : <CheckIcon />}
                          size="large"
                        >
                          {processing ? 'Processing Receipt...' : 'Process Receipt'}
                        </Button>
                        <Button
                          variant="outlined"
                          onClick={resetReceipt}
                          sx={{ ml: 2 }}
                        >
                          Upload Different Image
                        </Button>
                      </Box>
                    </Box>
                  )}
                </Box>
              </StepContent>
            </Step>

            {/* Step 2: Review Extracted Items */}
            <Step>
              <StepLabel>Review Detected Items</StepLabel>
              <StepContent>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Items Found on Receipt ({extractedItems.filter(i => i.selected).length} selected)
                  </Typography>
                  <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                    Review and adjust the items detected from your receipt. Uncheck items you don't want to add.
                  </Typography>

                  {/* Default Location Setting */}
                  <Paper sx={{ p: 2, mb: 2, backgroundColor: 'info.light' }}>
                    <Box display="flex" alignItems="center" gap={2}>
                      <LocationIcon sx={{ color: 'info.contrastText' }} />
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="body1" sx={{ color: 'info.contrastText', fontWeight: 'medium' }}>
                          Default Location: Counter
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'info.contrastText', opacity: 0.8 }}>
                          Items will be added here first, then you can move them to final locations
                        </Typography>
                      </Box>
                    </Box>
                  </Paper>

                  {/* Purchase Date */}
                  <Box sx={{ mb: 2 }}>
                    <TextField
                      label="Purchase Date"
                      type="date"
                      value={receiptDate}
                      onChange={(e) => setReceiptDate(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      size="small"
                    />
                  </Box>
                </Box>

                {/* Items List */}
                <List sx={{ maxHeight: 400, overflow: 'auto' }}>
                  {extractedItems.map((item, index) => (
                    <ListItem key={index} sx={{ border: '1px solid #eee', mb: 1, borderRadius: 1 }}>
                      <Checkbox
                        checked={item.selected}
                        onChange={() => toggleItemSelection(index)}
                        sx={{ mr: 1 }}
                      />
                      <ListItemText
                        primary={
                          <Box display="flex" alignItems="center" gap={1}>
                            <Typography variant="body1" fontWeight="medium">
                              {item.name}
                            </Typography>
                            {item.category && (
                              <Chip size="small" label={item.category} variant="outlined" />
                            )}
                          </Box>
                        }
                        secondary={
                          <Box display="flex" alignItems="center" gap={2} sx={{ mt: 0.5 }}>
                            <Typography variant="body2">
                              <MoneyIcon sx={{ fontSize: 14, mr: 0.5 }} />
                              ${item.price.toFixed(2)}
                            </Typography>
                            <Typography variant="body2">
                              <CartIcon sx={{ fontSize: 14, mr: 0.5 }} />
                              Qty: {item.quantity}
                            </Typography>
                          </Box>
                        }
                      />
                      <ListItemSecondaryAction>
                        <FormControl size="small" sx={{ minWidth: 120 }}>
                          <Select
                            value={item.storage_location_id || defaultLocation}
                            onChange={(e) => updateItem(index, { storage_location_id: e.target.value })}
                            variant="outlined"
                          >
                            {storageLocations.map((location) => (
                              <MenuItem key={location.id} value={location.id}>
                                {location.name}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>

                <Box sx={{ mt: 3 }}>
                  <Button
                    variant="contained"
                    onClick={processSelectedItems}
                    disabled={saving || extractedItems.filter(i => i.selected).length === 0}
                    startIcon={saving ? <CircularProgress size={20} /> : <CheckIcon />}
                    size="large"
                  >
                    {saving
                      ? 'Adding Items...'
                      : `Add ${extractedItems.filter(i => i.selected).length} Items to Inventory`
                    }
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={resetReceipt}
                    sx={{ ml: 2 }}
                    disabled={saving}
                  >
                    Start Over
                  </Button>
                </Box>
              </StepContent>
            </Step>
          </Stepper>

          {/* Progress indicator */}
          <Box sx={{ mt: 3 }}>
            <LinearProgress
              variant="determinate"
              value={(activeStep / 1) * 100}
              sx={{ height: 6, borderRadius: 3 }}
            />
          </Box>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            📱 How Receipt Scanning Works
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <Box textAlign="center">
                <CameraIcon sx={{ fontSize: 32, color: 'primary.main', mb: 1 }} />
                <Typography variant="body2" fontWeight="medium">
                  1. Capture Receipt
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  Photo or upload image
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Box textAlign="center">
                <ReceiptIcon sx={{ fontSize: 32, color: 'primary.main', mb: 1 }} />
                <Typography variant="body2" fontWeight="medium">
                  2. AI Processing
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  Extract items & prices
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Box textAlign="center">
                <CheckIcon sx={{ fontSize: 32, color: 'primary.main', mb: 1 }} />
                <Typography variant="body2" fontWeight="medium">
                  3. Bulk Add
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  Review & add to inventory
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Container>
  )
}