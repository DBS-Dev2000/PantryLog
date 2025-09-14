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
  Avatar,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  useTheme,
  useMediaQuery
} from '@mui/material'
import {
  ArrowBack as ArrowBackIcon,
  Inventory as InventoryIcon,
  LocationOn as LocationIcon,
  CalendarToday as CalendarIcon,
  Category as CategoryIcon,
  Business as BrandIcon,
  QrCode as QrCodeIcon,
  ExpandMore as ExpandMoreIcon,
  AttachMoney as PriceIcon,
  Description as DescriptionIcon,
  Restaurant as NutritionIcon,
  Store as StoreIcon,
  Image as ImageIcon,
  Print as PrintIcon
} from '@mui/icons-material'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import QRCode from 'qrcode'

interface ProductDetail {
  id: string
  name: string
  brand?: string
  category?: string
  upc?: string
  image_url?: string
  nutritional_info?: any
}

interface InventoryItem {
  id: string
  quantity: number
  unit: string
  purchase_date: string
  expiration_date?: string
  cost?: number
  notes?: string
  storage_locations: {
    id: string
    name: string
    type: string
    description?: string
  }
}

export default function ProductDetailPage() {
  const router = useRouter()
  const params = useParams()
  const productId = params.id as string
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))

  const [user, setUser] = useState<any>(null)
  const [product, setProduct] = useState<ProductDetail | null>(null)
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedAccordions, setExpandedAccordions] = useState<{
    details: boolean
    price: boolean
    images: boolean
  }>({
    details: false,
    price: false,
    images: false
  })

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

  // Build full breadcrumb path for a storage location
  const buildLocationPath = (locationId: string, allLocations: any[]): string => {
    const location = allLocations.find(l => l.id === locationId)
    if (!location) return 'Unknown Location'

    if (location.parent_id) {
      const parentPath = buildLocationPath(location.parent_id, allLocations)
      return `${parentPath} > ${location.name}`
    }
    return location.name
  }

  const loadProductData = async (userId: string) => {
    setLoading(true)
    setError(null)

    try {
      // Load product details
      const { data: productData, error: productError } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single()

      if (productError) throw productError

      setProduct(productData as ProductDetail)

      // Load all storage locations to build paths
      const { data: allStorageLocations, error: locationsError } = await supabase
        .from('storage_locations')
        .select('*')
        .eq('household_id', userId)
        .eq('is_active', true)

      if (locationsError) throw locationsError

      // Load all inventory items for this product
      const { data: itemsData, error: itemsError } = await supabase
        .from('inventory_items')
        .select(`
          *,
          storage_locations (*)
        `)
        .eq('product_id', productId)
        .eq('household_id', userId)
        .eq('is_consumed', false)
        .order('purchase_date', { ascending: false })

      if (itemsError) throw itemsError

      // Build full paths for each item's storage location
      if (itemsData && allStorageLocations) {
        for (const item of itemsData) {
          if (item.storage_locations?.id) {
            const fullPath = buildLocationPath(item.storage_locations.id, allStorageLocations)
            ;(item.storage_locations as any).full_path = fullPath
          }
        }
      }

      console.log('📦 Product inventory items with paths:', itemsData?.length || 0)
      setInventoryItems((itemsData || []) as InventoryItem[])

    } catch (err: any) {
      console.error('Error loading product data:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const getTotalQuantity = () => {
    return inventoryItems.reduce((total, item) => total + parseFloat(item.quantity.toString()), 0)
  }

  const getUniqueLocations = () => {
    const locations = new Set()
    inventoryItems.forEach(item => {
      if (item.storage_locations?.name) {
        locations.add(item.storage_locations.name)
      }
    })
    return locations.size
  }

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

  const handleAccordionChange = (accordion: keyof typeof expandedAccordions) => (
    event: React.SyntheticEvent,
    isExpanded: boolean
  ) => {
    setExpandedAccordions(prev => ({
      ...prev,
      [accordion]: isExpanded
    }))
  }

  const printItemQRCode = async () => {
    if (!product) return

    try {
      // Generate QR code that links to this product's detail page
      const productUrl = `${window.location.origin}/inventory/product/${product.id}`
      const qrCodeDataUrl = await QRCode.toDataURL(productUrl, {
        width: 250,
        margin: 2,
        color: { dark: '#000000', light: '#FFFFFF' }
      })

      const printWindow = window.open('', '_blank')
      if (!printWindow) return

      // Determine if this is a custom item
      const isCustomItem = !product.upc || product.upc.startsWith('CUSTOM-')

      printWindow.document.write(`
        <html>
          <head>
            <title>Print Item QR Code</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; margin: 20px; }
              .qr-container { border: 2px solid #000; padding: 20px; display: inline-block; margin: 20px; max-width: 350px; }
              .item-info { margin: 10px 0; font-size: 18px; font-weight: bold; word-wrap: break-word; }
              .brand-info { margin: 5px 0; font-size: 14px; color: #666; }
              .instructions { margin: 10px 0; font-size: 12px; color: #666; }
              .details { margin: 10px 0; font-size: 14px; }
              .footer { margin-top: 15px; font-size: 10px; color: #999; }
            </style>
          </head>
          <body>
            <div class="qr-container">
              <div class="item-info">${product.name}</div>
              ${product.brand ? `<div class="brand-info">by ${product.brand}</div>` : ''}
              <div class="instructions">Scan to view product details</div>
              <img src="${qrCodeDataUrl}" alt="Product QR Code" style="max-width: 200px;" />
              <div class="footer">
                BITE - Basic Inventory Tracking Engine<br>
                ${isCustomItem ? 'Custom Item' : product.upc ? `UPC: ${product.upc}` : 'Product'} • ID: ${product.id}
              </div>
            </div>
          </body>
        </html>
      `)

      printWindow.document.close()
      printWindow.print()

      console.log('✅ Generated QR code for product:', product.name)
    } catch (err) {
      console.error('Error generating product QR code:', err)
    }
  }

  if (!user || loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>Loading product details...</Typography>
      </Container>
    )
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.back()}
        >
          Back to Inventory
        </Button>
      </Container>
    )
  }

  if (!product) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Typography>Product not found</Typography>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.back()}
        >
          Back to Inventory
        </Button>
      </Container>
    )
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Box display="flex" alignItems="center" mb={4}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.back()}
          sx={{ mr: 2 }}
        >
          Back to Inventory
        </Button>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4" component="h1">
            Product Details
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<PrintIcon />}
          onClick={() => printItemQRCode()}
          sx={{ ml: 2 }}
        >
          Print QR Code
        </Button>
      </Box>

      {/* Mobile-Optimized Product Information */}
      <Box sx={{ mb: 2 }}>
        {/* Main Product Header - Always Visible */}
        <Card sx={{ mb: 1 }}>
          <CardContent sx={{ pb: 2 }}>
            <Box display="flex" alignItems="center" gap={2}>
              {product.image_url && (
                <Avatar
                  src={product.image_url}
                  sx={{
                    width: isMobile ? 60 : 80,
                    height: isMobile ? 60 : 80
                  }}
                  variant="rounded"
                />
              )}
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography
                  variant={isMobile ? "h6" : "h5"}
                  gutterBottom
                  sx={{
                    wordBreak: 'break-word',
                    lineHeight: 1.2
                  }}
                >
                  {product.name}
                </Typography>
                <Box display="flex" flexWrap="wrap" gap={1} alignItems="center">
                  {product.brand && (
                    <Chip size="small" icon={<BrandIcon />} label={product.brand} />
                  )}
                  {product.category && (
                    <Chip size="small" icon={<CategoryIcon />} label={product.category} variant="outlined" />
                  )}
                  {product.upc && (
                    <Chip size="small" icon={<QrCodeIcon />} label={product.upc} variant="outlined" />
                  )}
                </Box>
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* Inventory Summary - Always Visible on Mobile */}
        <Card sx={{ mb: 1 }}>
          <CardContent sx={{ py: 2 }}>
            <Typography variant="h6" gutterBottom sx={{ fontSize: isMobile ? '1.1rem' : '1.25rem' }}>
              📊 Inventory Summary
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={4}>
                <Box textAlign="center">
                  <Typography variant="h5" color="primary.main" sx={{ fontSize: isMobile ? '1.5rem' : '2rem' }}>
                    {getTotalQuantity()}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    Total Items
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={4}>
                <Box textAlign="center">
                  <Typography variant="h5" color="secondary.main" sx={{ fontSize: isMobile ? '1.5rem' : '2rem' }}>
                    {getUniqueLocations()}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    Locations
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={4}>
                <Box textAlign="center">
                  <Typography variant="h5" color="info.main" sx={{ fontSize: isMobile ? '1.5rem' : '2rem' }}>
                    {inventoryItems.length}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    Entries
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Expandable Product Details */}
        {(product.nutritional_info?.description ||
          product.nutritional_info?.price_data ||
          product.nutritional_info?.additional_images?.length > 0) && (
          <Card sx={{ mb: 1 }}>
            <Accordion
              expanded={expandedAccordions.details}
              onChange={handleAccordionChange('details')}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                sx={{ backgroundColor: 'grey.50' }}
              >
                <DescriptionIcon sx={{ mr: 1, color: 'action.active' }} />
                <Typography variant="h6" sx={{ fontSize: isMobile ? '1rem' : '1.25rem' }}>
                  Product Details
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                {product.nutritional_info?.description && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="textSecondary" gutterBottom>
                      Description:
                    </Typography>
                    <Typography variant="body2" sx={{ lineHeight: 1.5 }}>
                      {product.nutritional_info.description}
                    </Typography>
                  </Box>
                )}

                {product.nutritional_info?.api_data && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="textSecondary" gutterBottom>
                      Product Specifications:
                    </Typography>
                    <Grid container spacing={1}>
                      {product.nutritional_info.api_data.weight && (
                        <Grid item xs={6}>
                          <Typography variant="caption" color="textSecondary">Weight:</Typography>
                          <Typography variant="body2">{product.nutritional_info.api_data.weight}</Typography>
                        </Grid>
                      )}
                      {product.nutritional_info.api_data.color && (
                        <Grid item xs={6}>
                          <Typography variant="caption" color="textSecondary">Color:</Typography>
                          <Typography variant="body2">{product.nutritional_info.api_data.color}</Typography>
                        </Grid>
                      )}
                      {product.nutritional_info.api_data.size && (
                        <Grid item xs={6}>
                          <Typography variant="caption" color="textSecondary">Size:</Typography>
                          <Typography variant="body2">{product.nutritional_info.api_data.size}</Typography>
                        </Grid>
                      )}
                    </Grid>
                  </Box>
                )}
              </AccordionDetails>
            </Accordion>
          </Card>
        )}

        {/* Price Information - Expandable */}
        {product.nutritional_info?.price_data && (
          <Card sx={{ mb: 1 }}>
            <Accordion
              expanded={expandedAccordions.price}
              onChange={handleAccordionChange('price')}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                sx={{ backgroundColor: 'success.light' }}
              >
                <PriceIcon sx={{ mr: 1, color: 'success.contrastText' }} />
                <Typography variant="h6" sx={{ fontSize: isMobile ? '1rem' : '1.25rem', color: 'success.contrastText' }}>
                  💰 Price Information
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="h6" color="primary.main">
                    ${product.nutritional_info.price_data.lowest_price?.toFixed(2)} - ${product.nutritional_info.price_data.highest_price?.toFixed(2)}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Price Range
                  </Typography>
                </Box>

                {product.nutritional_info.price_data.offers?.length > 0 && (
                  <Box>
                    <Typography variant="body2" color="textSecondary" gutterBottom>
                      Recent Store Prices:
                    </Typography>
                    <List dense sx={{ py: 0 }}>
                      {product.nutritional_info.price_data.offers.slice(0, 5).map((offer: any, index: number) => (
                        <ListItem key={index} sx={{ px: 0, py: 0.5 }}>
                          <ListItemText
                            primary={
                              <Box display="flex" justifyContent="space-between" alignItems="center">
                                <Typography variant="body2">
                                  <StoreIcon fontSize="small" sx={{ mr: 0.5, verticalAlign: 'middle' }} />
                                  {offer.merchant}
                                </Typography>
                                <Typography variant="body2" fontWeight="medium" color="primary.main">
                                  ${offer.price?.toFixed(2)}
                                </Typography>
                              </Box>
                            }
                            secondary={offer.condition && offer.condition !== 'New' ? offer.condition : null}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                )}
              </AccordionDetails>
            </Accordion>
          </Card>
        )}

        {/* Additional Images - Expandable */}
        {product.nutritional_info?.additional_images?.length > 0 && (
          <Card sx={{ mb: 1 }}>
            <Accordion
              expanded={expandedAccordions.images}
              onChange={handleAccordionChange('images')}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                sx={{ backgroundColor: 'info.light' }}
              >
                <ImageIcon sx={{ mr: 1, color: 'info.contrastText' }} />
                <Typography variant="h6" sx={{ fontSize: isMobile ? '1rem' : '1.25rem', color: 'info.contrastText' }}>
                  📸 Additional Images ({product.nutritional_info.additional_images.length})
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={1}>
                  {product.nutritional_info.additional_images.map((imageUrl: string, index: number) => (
                    <Grid item xs={6} sm={4} key={index}>
                      <Box
                        component="img"
                        src={imageUrl}
                        alt={`${product.name} - Image ${index + 1}`}
                        sx={{
                          width: '100%',
                          height: 120,
                          objectFit: 'contain',
                          border: '1px solid #ddd',
                          borderRadius: 1,
                          backgroundColor: 'white'
                        }}
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    </Grid>
                  ))}
                </Grid>
              </AccordionDetails>
            </Accordion>
          </Card>
        )}
      </Box>

      {/* Inventory Items by Location */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Storage Locations ({inventoryItems.length} items)
          </Typography>

          {inventoryItems.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <InventoryIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="textSecondary" gutterBottom>
                No items in inventory
              </Typography>
              <Typography variant="body2" color="textSecondary">
                This product hasn't been added to your inventory yet.
              </Typography>
            </Box>
          ) : isMobile ? (
            /* Mobile Card Layout */
            <Box>
              {inventoryItems.map((item) => (
                <Card
                  key={item.id}
                  sx={{
                    mb: 1,
                    cursor: 'pointer',
                    '&:hover': { boxShadow: 2 }
                  }}
                  onClick={() => router.push(`/inventory?location=${item.storage_locations.id}`)}
                >
                  <CardContent sx={{ py: 2 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography
                          variant="body1"
                          fontWeight="medium"
                          sx={{
                            color: 'primary.main',
                            wordBreak: 'break-word'
                          }}
                        >
                          <LocationIcon fontSize="small" sx={{ mr: 0.5, verticalAlign: 'middle' }} />
                          {(item.storage_locations as any)?.full_path || item.storage_locations?.name || 'Unknown Location'}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {item.storage_locations?.type}
                        </Typography>
                      </Box>
                      <Chip
                        label={`${item.quantity} ${item.unit}`}
                        size="small"
                        color="primary"
                        sx={{ ml: 1, flexShrink: 0 }}
                      />
                    </Box>

                    <Grid container spacing={1} sx={{ mt: 1 }}>
                      <Grid item xs={6}>
                        <Typography variant="caption" color="textSecondary">Purchase:</Typography>
                        <Typography variant="body2">{formatDate(item.purchase_date)}</Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="caption" color="textSecondary">Expiration:</Typography>
                        {item.expiration_date ? (
                          <Chip
                            label={`${getDaysUntilExpiration(item.expiration_date)} days`}
                            size="small"
                            color={getExpirationColor(item.expiration_date) as any}
                          />
                        ) : (
                          <Typography variant="body2" color="textSecondary">None</Typography>
                        )}
                      </Grid>
                      {(item.cost || item.notes) && (
                        <>
                          {item.cost && (
                            <Grid item xs={6}>
                              <Typography variant="caption" color="textSecondary">Cost:</Typography>
                              <Typography variant="body2">${item.cost.toFixed(2)}</Typography>
                            </Grid>
                          )}
                          {item.notes && (
                            <Grid item xs={item.cost ? 6 : 12}>
                              <Typography variant="caption" color="textSecondary">Notes:</Typography>
                              <Typography variant="body2">{item.notes}</Typography>
                            </Grid>
                          )}
                        </>
                      )}
                    </Grid>
                  </CardContent>
                </Card>
              ))}
            </Box>
          ) : (
            /* Desktop Table Layout */
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Storage Location</TableCell>
                    <TableCell>Quantity</TableCell>
                    <TableCell>Purchase Date</TableCell>
                    <TableCell>Expiration</TableCell>
                    <TableCell>Cost</TableCell>
                    <TableCell>Notes</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {inventoryItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Box
                          display="flex"
                          alignItems="center"
                          onClick={() => router.push(`/inventory?location=${item.storage_locations.id}`)}
                          sx={{
                            cursor: 'pointer',
                            '&:hover': {
                              backgroundColor: 'action.hover',
                              borderRadius: 1,
                              p: 0.5,
                              m: -0.5
                            }
                          }}
                        >
                          <LocationIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                          <Box>
                            <Typography
                              variant="body2"
                              sx={{
                                color: 'primary.main',
                                textDecoration: 'underline',
                                '&:hover': { color: 'primary.dark' }
                              }}
                            >
                              {(item.storage_locations as any)?.full_path || item.storage_locations?.name || 'Unknown Location'}
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                              {item.storage_locations?.type}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {item.quantity} {item.unit}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {formatDate(item.purchase_date)}
                      </TableCell>
                      <TableCell>
                        {item.expiration_date ? (
                          <Chip
                            label={`${getDaysUntilExpiration(item.expiration_date)} days`}
                            size="small"
                            color={getExpirationColor(item.expiration_date) as any}
                          />
                        ) : (
                          <Typography variant="caption" color="textSecondary">
                            No expiration
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.cost ? `$${item.cost.toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="textSecondary">
                          {item.notes || '-'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Container>
  )
}