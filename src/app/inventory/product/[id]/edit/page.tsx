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
  IconButton,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  FormControlLabel,
  Checkbox
} from '@mui/material'
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Edit as EditIcon,
  CameraAlt as CameraIcon,
  CloudUpload as CloudUploadIcon,
  Inventory as InventoryIcon,
  Category as CategoryIcon,
  Label as LabelIcon,
  Refresh as RefreshIcon,
  Update as UpdateIcon
} from '@mui/icons-material'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase-client'
import HouseholdTaxonomyManager from '@/components/HouseholdTaxonomyManager'

interface ProductDetail {
  id: string
  name: string
  brand?: string
  category?: string
  image_url?: string
  upc?: string
  nutritional_info?: any
  default_shelf_life_days?: number
  is_custom?: boolean
  created_at: string
  updated_at?: string
  // Comprehensive UPC data fields
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
  additional_images?: any
  offers?: any
  asin?: string
  elid?: string
  manufacturer?: string
  ingredients?: string
  nutrition?: any
  raw_api_response?: any
  api_last_updated?: string
}

export default function EditProductPage() {
  const router = useRouter()
  const params = useParams()
  const productId = params.id as string

  const [user, setUser] = useState<any>(null)
  const [product, setProduct] = useState<ProductDetail | null>(null)
  const [originalProduct, setOriginalProduct] = useState<ProductDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Image handling states
  const [productImageUrl, setProductImageUrl] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)
  const [imageUrlInput, setImageUrlInput] = useState('')
  const [showImageOptions, setShowImageOptions] = useState(false)
  const imageUploadRef = useRef<HTMLInputElement>(null)

  // Product name editing
  const [customProductName, setCustomProductName] = useState('')
  const [editingProductName, setEditingProductName] = useState(false)

  // Update Information modal states
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const [updateOptions, setUpdateOptions] = useState({
    size: true,
    weight: true,
    ingredients: true,
    nutrition: true,
    price: true,
    manufacturer: true,
    description: true,
    images: false
  })
  const [updating, setUpdating] = useState(false)
  const [updateData, setUpdateData] = useState<any>(null)

  const categories = [
    'Pantry Staples',
    'Canned Goods',
    'Frozen Foods',
    'Fresh Produce',
    'Dairy',
    'Meat & Poultry',
    'Seafood',
    'Beverages',
    'Snacks',
    'Condiments',
    'Spices & Seasonings',
    'Baking',
    'Other'
  ]

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUser(session.user)
        await loadProductData(session.user.id)
      } else {
        router.push('/auth')
      }
    }

    getUser()
  }, [router, productId])

  const loadProductData = async (userId: string) => {
    setLoading(true)
    try {
      // Load the product
      const { data: productData, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single()

      if (error) throw error

      setProduct(productData as ProductDetail)
      setOriginalProduct(productData as ProductDetail)
      setCustomProductName(productData.name || '')
      setProductImageUrl(productData.image_url || '')
      setImageUrlInput(productData.image_url || '')
      setShowImageOptions(!productData.image_url)
      console.log('📦 Loaded product for editing:', productData.name)

    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!user || !product || !originalProduct) return

    setSaving(true)
    setError(null)

    try {
      // Update product with all comprehensive UPC fields
      const { error: updateError } = await supabase
        .from('products')
        .update({
          name: product.name,
          brand: product.brand || null,
          category: product.category || null,
          image_url: productImageUrl || null,
          upc: product.upc || null,
          default_shelf_life_days: product.default_shelf_life_days || null,
          nutritional_info: product.nutritional_info || null,
          // Comprehensive UPC data fields
          ean: product.ean || null,
          title: product.title || null,
          model: product.model || null,
          color: product.color || null,
          size: product.size || null,
          weight: product.weight || null,
          dimension: product.dimension || null,
          lowest_recorded_price: product.lowest_recorded_price || null,
          highest_recorded_price: product.highest_recorded_price || null,
          currency: product.currency || null,
          additional_images: product.additional_images || null,
          offers: product.offers || null,
          asin: product.asin || null,
          elid: product.elid || null,
          manufacturer: product.manufacturer || null,
          ingredients: product.ingredients || null,
          nutrition: product.nutrition || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', productId)

      if (updateError) throw updateError

      setSuccess(true)
      setOriginalProduct(product)

      // Navigate back after success
      setTimeout(() => {
        router.push(`/inventory/product/${productId}`)
      }, 2000)

    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // Handle image upload
  const handleImageUpload = async (file: File) => {
    if (!file || !product) return

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
      const fileName = `product-${productId}-${Date.now()}.${fileExt}`
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
            const { error: retryError } = await supabase.storage
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

      setProductImageUrl(publicUrl)
      setImageUrlInput(publicUrl)
      setShowImageOptions(false)

    } catch (err: any) {
      console.error('Error uploading image:', err)
      setError(err.message || 'Failed to upload image')
    } finally {
      setUploadingImage(false)
    }
  }

  // Handle image URL change
  const handleImageUrlChange = (url: string) => {
    setImageUrlInput(url)
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      setProductImageUrl(url)
      setShowImageOptions(false)
    }
  }

  // Fetch updated product data from UPC API
  const fetchUpdatedProductData = async () => {
    if (!product?.upc) {
      setError('No UPC code available for this product')
      return
    }

    setUpdating(true)
    setError(null)

    try {
      const response = await fetch(`/api/barcode/lookup?upc=${product.upc}`)
      if (!response.ok) {
        throw new Error('Failed to fetch product data')
      }

      const data = await response.json()

      if (data.items && data.items.length > 0) {
        setUpdateData(data.items[0])
        console.log('Fetched updated product data:', data.items[0])
      } else {
        setError('No product data found for this UPC')
      }
    } catch (err: any) {
      console.error('Error fetching product data:', err)
      setError(err.message || 'Failed to fetch product data')
    } finally {
      setUpdating(false)
    }
  }

  // Apply selected updates to the product
  const applyUpdates = () => {
    if (!updateData || !product) return

    const updatedProduct = { ...product }

    if (updateOptions.size && updateData.size) {
      updatedProduct.size = updateData.size
    }
    if (updateOptions.weight && updateData.weight) {
      updatedProduct.weight = updateData.weight
    }
    if (updateOptions.ingredients && updateData.ingredients) {
      updatedProduct.ingredients = updateData.ingredients
    }
    if (updateOptions.nutrition && updateData.nutrition) {
      updatedProduct.nutrition = updateData.nutrition
    }
    if (updateOptions.price) {
      if (updateData.lowest_recorded_price) {
        updatedProduct.lowest_recorded_price = updateData.lowest_recorded_price
      }
      if (updateData.highest_recorded_price) {
        updatedProduct.highest_recorded_price = updateData.highest_recorded_price
      }
      if (updateData.offers) {
        updatedProduct.offers = updateData.offers
      }
    }
    if (updateOptions.manufacturer && updateData.brand) {
      updatedProduct.manufacturer = updateData.brand
    }
    if (updateOptions.description) {
      if (updateData.title) {
        updatedProduct.title = updateData.title
      }
      if (updateData.description) {
        // Map UPC description to the product description field
        updatedProduct.nutritional_info = {
          ...updatedProduct.nutritional_info,
          description: updateData.description
        }
      }
      if (updateData.model) {
        updatedProduct.model = updateData.model
      }
    }
    if (updateOptions.images && updateData.images && updateData.images.length > 0) {
      updatedProduct.image_url = updateData.images[0]
      setProductImageUrl(updateData.images[0])
      if (updateData.images.length > 1) {
        updatedProduct.additional_images = updateData.images
      }
    }

    // Update other comprehensive fields
    if (updateData.ean) updatedProduct.ean = updateData.ean
    if (updateData.asin) updatedProduct.asin = updateData.asin
    if (updateData.elid) updatedProduct.elid = updateData.elid
    if (updateData.dimension) updatedProduct.dimension = updateData.dimension
    if (updateData.currency) updatedProduct.currency = updateData.currency
    if (updateData.color) updatedProduct.color = updateData.color

    // Store raw API response
    updatedProduct.raw_api_response = updateData
    updatedProduct.api_last_updated = new Date().toISOString()

    setProduct(updatedProduct)
    setShowUpdateModal(false)
    setUpdateData(null)
  }

  if (!user || loading) {
    return (
      <Container maxWidth="md" sx={{ mt: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>Loading product details...</Typography>
      </Container>
    )
  }

  if (error && !product) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.back()}
        >
          Back
        </Button>
      </Container>
    )
  }

  if (!product) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Typography>Product not found</Typography>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.back()}
        >
          Back
        </Button>
      </Container>
    )
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4, px: { xs: 2, sm: 3 } }}>
      <Box
        display="flex"
        flexDirection={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        mb={4}
        gap={{ xs: 2, sm: 0 }}
      >
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push(`/inventory/product/${productId}`)}
          sx={{ mr: { xs: 0, sm: 2 }, mb: { xs: 2, sm: 0 } }}
        >
          Back
        </Button>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom sx={{ fontSize: { xs: '1.75rem', sm: '2.125rem' } }}>
            Edit Product
          </Typography>
          <Typography variant="body1" color="textSecondary">
            Update product information and images
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
          Product updated successfully! Returning to product details...
        </Alert>
      )}

      {/* Product Information Header */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box
            display="flex"
            flexDirection={{ xs: 'column', sm: 'row' }}
            alignItems={{ xs: 'center', sm: 'center' }}
            gap={2}
          >
            {productImageUrl ? (
              <Avatar
                src={productImageUrl}
                sx={{
                  width: { xs: 120, sm: 80 },
                  height: { xs: 120, sm: 80 }
                }}
                variant="rounded"
              />
            ) : (
              <Box
                sx={{
                  width: { xs: 120, sm: 80 },
                  height: { xs: 120, sm: 80 },
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
                <CameraIcon color="primary" fontSize="large" />
              </Box>
            )}
            <Box sx={{ flexGrow: 1, textAlign: { xs: 'center', sm: 'left' }, width: '100%' }}>
              <Typography variant="h5" gutterBottom sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
                {product.name}
              </Typography>
              {product.brand && (
                <Typography variant="body1" color="textSecondary" gutterBottom>
                  Brand: {product.brand}
                </Typography>
              )}
              <Box
                display="flex"
                flexWrap="wrap"
                justifyContent={{ xs: 'center', sm: 'flex-start' }}
                gap={1}
                mt={1}
              >
                {product.category && (
                  <Chip
                    size="small"
                    label={product.category}
                    icon={<CategoryIcon />}
                  />
                )}
                {product.upc && (
                  <Chip size="small" label={`UPC: ${product.upc}`} variant="outlined" />
                )}
                {product.is_custom && (
                  <Chip size="small" label="Custom Item" color="secondary" />
                )}
              </Box>
            </Box>
          </Box>

          {/* Action Buttons */}
          <Box display="flex" gap={1} mt={2}>
            <Button
              variant="outlined"
              color="primary"
              size="small"
              startIcon={<CameraIcon />}
              onClick={() => setShowImageOptions(!showImageOptions)}
            >
              {productImageUrl ? 'Change Image' : 'Add Image'}
            </Button>
            <Button
              variant="outlined"
              color="info"
              size="small"
              startIcon={<UpdateIcon />}
              onClick={() => {
                setShowUpdateModal(true)
                if (!updateData) {
                  fetchUpdatedProductData()
                }
              }}
              disabled={!product.upc}
            >
              Update Information
            </Button>
          </Box>

          {/* Image Options Section */}
          {showImageOptions && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Typography variant="subtitle2" gutterBottom>
                Product Image
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
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
                <Grid item xs={12} sm={6}>
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

              {/* Image Preview */}
              {productImageUrl && (
                <Box sx={{ mt: 2, textAlign: 'center' }}>
                  <img
                    src={productImageUrl}
                    alt="Product"
                    style={{
                      maxWidth: '200px',
                      maxHeight: '200px',
                      borderRadius: '8px'
                    }}
                  />
                </Box>
              )}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Edit Form */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            <EditIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Product Details
          </Typography>

          <Box>
            {/* Product Name - full width */}
            <Box mb={2}>
              <TextField
                label="Product Name"
                fullWidth
                value={product.name}
                onChange={(e) => setProduct({ ...product, name: e.target.value })}
                required
              />
            </Box>

            {/* Brand and Category - side by side */}
            <Box
              display="flex"
              flexDirection={{ xs: 'column', sm: 'row' }}
              gap={2}
              mb={2}
            >
              <TextField
                label="Brand"
                fullWidth
                value={product.brand || ''}
                onChange={(e) => setProduct({ ...product, brand: e.target.value })}
                sx={{ flex: { xs: '1 1 100%', sm: '0 0 33%' } }}
              />
              <FormControl fullWidth sx={{ flex: { xs: '1 1 100%', sm: '0 0 67%' } }}>
                <InputLabel>Category</InputLabel>
                <Select
                  value={product.category || ''}
                  label="Category"
                  onChange={(e) => setProduct({ ...product, category: e.target.value })}
                >
                  <MenuItem value="">None</MenuItem>
                  {categories.map((cat) => (
                    <MenuItem key={cat} value={cat}>
                      {cat}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            {/* UPC and Shelf Life - side by side */}
            <Box
              display="flex"
              flexDirection={{ xs: 'column', sm: 'row' }}
              gap={2}
              mb={2}
            >
              <TextField
                label="UPC/Barcode"
                fullWidth
                value={product.upc || ''}
                onChange={(e) => setProduct({ ...product, upc: e.target.value })}
                helperText="Leave empty for custom items"
                sx={{ flex: { xs: '1 1 100%', sm: 1 } }}
              />
              <TextField
                label="Default Shelf Life (days)"
                type="number"
                fullWidth
                value={product.default_shelf_life_days || ''}
                onChange={(e) => setProduct({
                  ...product,
                  default_shelf_life_days: e.target.value ? parseInt(e.target.value) : undefined
                })}
                helperText="Default expiration days for new inventory"
                sx={{ flex: { xs: '1 1 100%', sm: 1 } }}
              />
            </Box>

            {/* Weight and Size - side by side */}
            <Box
              display="flex"
              flexDirection={{ xs: 'column', sm: 'row' }}
              gap={2}
              mb={2}
            >
              <TextField
                label="Weight"
                fullWidth
                value={product.weight || ''}
                onChange={(e) => setProduct({
                  ...product,
                  weight: e.target.value
                })}
                placeholder="e.g., 1.00lb, 500g"
                sx={{ flex: { xs: '1 1 100%', sm: 1 } }}
              />
              <TextField
                label="Size"
                fullWidth
                value={product.size || ''}
                onChange={(e) => setProduct({
                  ...product,
                  size: e.target.value
                })}
                placeholder="e.g., 1 Liter, 12 oz"
                sx={{ flex: { xs: '1 1 100%', sm: 1 } }}
              />
            </Box>

            {/* Manufacturer and Model - side by side */}
            <Box
              display="flex"
              flexDirection={{ xs: 'column', sm: 'row' }}
              gap={2}
              mb={2}
            >
              <TextField
                label="Manufacturer"
                fullWidth
                value={product.manufacturer || ''}
                onChange={(e) => setProduct({
                  ...product,
                  manufacturer: e.target.value
                })}
                sx={{ flex: { xs: '1 1 100%', sm: 1 } }}
              />
              <TextField
                label="Model"
                fullWidth
                value={product.model || ''}
                onChange={(e) => setProduct({
                  ...product,
                  model: e.target.value
                })}
                sx={{ flex: { xs: '1 1 100%', sm: 1 } }}
              />
            </Box>

            {/* Color and EAN - side by side */}
            <Box
              display="flex"
              flexDirection={{ xs: 'column', sm: 'row' }}
              gap={2}
              mb={2}
            >
              <TextField
                label="Color"
                fullWidth
                value={product.color || ''}
                onChange={(e) => setProduct({
                  ...product,
                  color: e.target.value
                })}
                placeholder="e.g., Clear, Brown"
                sx={{ flex: { xs: '1 1 100%', sm: 1 } }}
              />
              <TextField
                label="EAN"
                fullWidth
                value={product.ean || ''}
                onChange={(e) => setProduct({
                  ...product,
                  ean: e.target.value
                })}
                sx={{ flex: { xs: '1 1 100%', sm: 1 } }}
              />
            </Box>

            {/* Price Range - side by side */}
            <Box
              display="flex"
              flexDirection={{ xs: 'column', sm: 'row' }}
              gap={2}
              mb={2}
            >
              <TextField
                label="Lowest Recorded Price"
                type="number"
                fullWidth
                value={product.lowest_recorded_price || ''}
                onChange={(e) => setProduct({
                  ...product,
                  lowest_recorded_price: e.target.value ? parseFloat(e.target.value) : undefined
                })}
                InputProps={{ startAdornment: '$' }}
                sx={{ flex: { xs: '1 1 100%', sm: 1 } }}
              />
              <TextField
                label="Highest Recorded Price"
                type="number"
                fullWidth
                value={product.highest_recorded_price || ''}
                onChange={(e) => setProduct({
                  ...product,
                  highest_recorded_price: e.target.value ? parseFloat(e.target.value) : undefined
                })}
                InputProps={{ startAdornment: '$' }}
                sx={{ flex: { xs: '1 1 100%', sm: 1 } }}
              />
            </Box>

            {/* External IDs - 3 columns */}
            <Box
              display="flex"
              flexDirection={{ xs: 'column', sm: 'row' }}
              gap={2}
              mb={2}
            >
              <TextField
                label="Amazon ASIN"
                fullWidth
                value={product.asin || ''}
                onChange={(e) => setProduct({
                  ...product,
                  asin: e.target.value
                })}
                sx={{ flex: { xs: '1 1 100%', sm: 1 } }}
              />
              <TextField
                label="eBay ID"
                fullWidth
                value={product.elid || ''}
                onChange={(e) => setProduct({
                  ...product,
                  elid: e.target.value
                })}
                sx={{ flex: { xs: '1 1 100%', sm: 1 } }}
              />
              <TextField
                label="Currency"
                fullWidth
                value={product.currency || 'USD'}
                onChange={(e) => setProduct({
                  ...product,
                  currency: e.target.value
                })}
                sx={{ flex: { xs: '1 1 100%', sm: 1 } }}
              />
            </Box>

            {/* Description on its own line */}
            <Box mb={2}>
              <TextField
                label="Description"
                multiline
                rows={4}
                fullWidth
                value={product.nutritional_info?.description || ''}
                onChange={(e) => setProduct({
                  ...product,
                  nutritional_info: {
                    ...product.nutritional_info,
                    description: e.target.value
                  }
                })}
                placeholder="Product description, nutritional info, notes about the product..."
              />
            </Box>

            {/* Ingredients field */}
            <Box mb={2}>
              <TextField
                label="Ingredients"
                multiline
                rows={3}
                fullWidth
                value={product.ingredients || ''}
                onChange={(e) => setProduct({
                  ...product,
                  ingredients: e.target.value
                })}
                placeholder="List of ingredients..."
              />
            </Box>

            {/* Action buttons */}
            <Box
              display="flex"
              flexDirection={{ xs: 'column', sm: 'row' }}
              gap={2}
              justifyContent={{ xs: 'stretch', sm: 'flex-end' }}
              sx={{ mt: 2 }}
            >
              <Button
                variant="outlined"
                onClick={() => router.push(`/inventory/product/${productId}`)}
                disabled={saving}
                sx={{ width: { xs: '100%', sm: 'auto' } }}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={handleSave}
                disabled={saving}
                startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
                sx={{ width: { xs: '100%', sm: 'auto' } }}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Inventory Stats Card */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            <InventoryIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Product Information
          </Typography>
          <Box sx={{ backgroundColor: 'grey.50', p: 2, borderRadius: 1 }}>
            <Typography variant="body2" color="textSecondary">
              <strong>Created:</strong> {new Date(product.created_at).toLocaleString()}
            </Typography>
            {product.updated_at && (
              <Typography variant="body2" color="textSecondary">
                <strong>Last Updated:</strong> {new Date(product.updated_at).toLocaleString()}
              </Typography>
            )}
            <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
              <strong>Product ID:</strong> {product.id}
            </Typography>
            <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
              This product information is shared across all inventory items
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {/* Household Customizations */}
      {product && user && (
        <HouseholdTaxonomyManager
          productName={product.name}
          householdId={user.id}
          onUpdate={() => {
            // Optionally refresh product data or show success message
            console.log('Household customizations updated')
          }}
        />
      )}

      {/* Update Information Modal */}
      <Dialog
        open={showUpdateModal}
        onClose={() => setShowUpdateModal(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <UpdateIcon />
            Update Product Information
          </Box>
        </DialogTitle>
        <DialogContent>
          {product?.upc ? (
            <>
              <DialogContentText sx={{ mb: 2 }}>
                Select which fields to update from the barcode database.
                {product.upc && (
                  <Box sx={{ mt: 1 }}>
                    <Chip label={`UPC: ${product.upc}`} size="small" />
                  </Box>
                )}
              </DialogContentText>

              {updating ? (
                <Box textAlign="center" py={3}>
                  <CircularProgress size={30} />
                  <Typography variant="body2" sx={{ mt: 2 }}>
                    Fetching product data...
                  </Typography>
                </Box>
              ) : updateData ? (
                <>
                  <Typography variant="subtitle2" gutterBottom>
                    Available Updates:
                  </Typography>
                  <Box sx={{ pl: 2 }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={updateOptions.size}
                          onChange={(e) => setUpdateOptions({ ...updateOptions, size: e.target.checked })}
                        />
                      }
                      label={`Size: ${updateData.size || 'Not available'}`}
                      disabled={!updateData.size}
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={updateOptions.weight}
                          onChange={(e) => setUpdateOptions({ ...updateOptions, weight: e.target.checked })}
                        />
                      }
                      label={`Weight: ${updateData.weight || 'Not available'}`}
                      disabled={!updateData.weight}
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={updateOptions.ingredients}
                          onChange={(e) => setUpdateOptions({ ...updateOptions, ingredients: e.target.checked })}
                        />
                      }
                      label={`Ingredients: ${updateData.ingredients ? 'Available' : 'Not available'}`}
                      disabled={!updateData.ingredients}
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={updateOptions.nutrition}
                          onChange={(e) => setUpdateOptions({ ...updateOptions, nutrition: e.target.checked })}
                        />
                      }
                      label={`Nutrition Facts: ${updateData.nutrition ? 'Available' : 'Not available'}`}
                      disabled={!updateData.nutrition}
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={updateOptions.price}
                          onChange={(e) => setUpdateOptions({ ...updateOptions, price: e.target.checked })}
                        />
                      }
                      label={`Price Info: $${updateData.lowest_recorded_price || '?'} - $${updateData.highest_recorded_price || '?'}`}
                      disabled={!updateData.lowest_recorded_price && !updateData.highest_recorded_price}
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={updateOptions.manufacturer}
                          onChange={(e) => setUpdateOptions({ ...updateOptions, manufacturer: e.target.checked })}
                        />
                      }
                      label={`Manufacturer: ${updateData.brand || 'Not available'}`}
                      disabled={!updateData.brand}
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={updateOptions.description}
                          onChange={(e) => setUpdateOptions({ ...updateOptions, description: e.target.checked })}
                        />
                      }
                      label={`Description/Title: ${updateData.title || updateData.description ? 'Available' : 'Not available'}`}
                      disabled={!updateData.title && !updateData.description}
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={updateOptions.images}
                          onChange={(e) => setUpdateOptions({ ...updateOptions, images: e.target.checked })}
                        />
                      }
                      label={`Product Images: ${updateData.images ? `${updateData.images.length} available` : 'Not available'}`}
                      disabled={!updateData.images || updateData.images.length === 0}
                    />
                  </Box>

                  {updateData.offers && updateData.offers.length > 0 && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="caption" color="textSecondary">
                        Current offers from {updateData.offers.length} merchant(s)
                      </Typography>
                    </Box>
                  )}
                </>
              ) : (
                error && (
                  <Alert severity="error" sx={{ mt: 2 }}>
                    {error}
                  </Alert>
                )
              )}
            </>
          ) : (
            <DialogContentText>
              This product doesn't have a UPC code. Only products with UPC codes can be updated from the barcode database.
            </DialogContentText>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowUpdateModal(false)}>
            Cancel
          </Button>
          {!updating && !updateData && product?.upc && (
            <Button
              onClick={fetchUpdatedProductData}
              variant="contained"
              startIcon={<RefreshIcon />}
            >
              Fetch Data
            </Button>
          )}
          {updateData && (
            <Button
              onClick={applyUpdates}
              variant="contained"
              color="primary"
            >
              Apply Selected Updates
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Container>
  )
}