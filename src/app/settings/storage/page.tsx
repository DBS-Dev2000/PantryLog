'use client'

import { useState, useEffect } from 'react'
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Button,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Alert,
  Chip,
  Divider,
  Paper
} from '@mui/material'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  Storage as StorageIcon,
  Kitchen as KitchenIcon,
  AcUnit as FreezerIcon,
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  QrCode as QrCodeIcon,
  Print as PrintIcon
} from '@mui/icons-material'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import QRCode from 'qrcode'

interface StorageLocation {
  id: string
  name: string
  type: string
  description?: string
  parent_id?: string
  level: number
  sort_order: number
  is_active: boolean
  children?: StorageLocation[]
}

const storageTypes = [
  { value: 'Pantry', label: 'Pantry', icon: KitchenIcon, color: 'primary' },
  { value: 'Freezer', label: 'Standing Freezer', icon: FreezerIcon, color: 'info' },
  { value: 'Refrigerator', label: 'Refrigerator', icon: KitchenIcon, color: 'success' },
  { value: 'DeepFreezer', label: 'Deep Freeze Chest', icon: FreezerIcon, color: 'secondary' },
  { value: 'Shelf', label: 'Shelf', icon: StorageIcon, color: 'default' },
  { value: 'Section', label: 'Section', icon: StorageIcon, color: 'default' },
  { value: 'Drawer', label: 'Drawer', icon: StorageIcon, color: 'default' },
  { value: 'Compartment', label: 'Compartment', icon: StorageIcon, color: 'default' }
]

const getTypeIcon = (type: string) => {
  const typeConfig = storageTypes.find(t => t.value === type)
  return typeConfig ? typeConfig.icon : StorageIcon
}

const getTypeColor = (type: string) => {
  const typeConfig = storageTypes.find(t => t.value === type)
  return typeConfig ? typeConfig.color : 'default'
}

export default function StorageConfigPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [locations, setLocations] = useState<StorageLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingLocation, setEditingLocation] = useState<StorageLocation | null>(null)
  const [parentLocation, setParentLocation] = useState<StorageLocation | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [qrDialogOpen, setQrDialogOpen] = useState(false)
  const [selectedLocationForQR, setSelectedLocationForQR] = useState<StorageLocation | null>(null)
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('')

  const [formData, setFormData] = useState({
    name: '',
    type: '',
    description: '',
  })

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUser(session.user)
        await loadStorageLocations(session.user)
      } else {
        router.push('/auth')
      }
    }

    getUser()
  }, [router])

  // Ensure household exists
  const ensureHouseholdExists = async (householdId: string) => {
    console.log('🏠 Ensuring household exists:', householdId)

    // First, try to insert the household record
    const { data: insertData, error: insertError } = await supabase
      .from('households')
      .insert([
        {
          id: householdId,
          name: 'My Household',
        }
      ])
      .select('id')

    if (insertError) {
      // If it's a unique constraint violation, that's fine - household already exists
      if (insertError.code === '23505') {
        console.log('✅ Household already exists')
        return
      } else {
        console.error('❌ Error creating household:', insertError)
        throw insertError
      }
    } else {
      console.log('✅ Household created successfully')
    }
  }

  // Create default storage locations for a new household
  const createDefaultStorageLocations = async (householdId: string) => {
    // First ensure household exists
    await ensureHouseholdExists(householdId)

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

  const loadStorageLocations = async (currentUser?: any) => {
    const userToUse = currentUser || user
    console.log('🔄 loadStorageLocations called, user:', userToUse?.id)

    if (!userToUse) {
      console.log('❌ No user found, returning')
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      console.log('👤 Loading storage locations for user:', userToUse.id)

      // Ensure household exists first
      const householdId = userToUse.id
      await ensureHouseholdExists(householdId)

      // Check if this household has any storage locations
      console.log('🔍 Checking for existing storage locations...')
      const { data: existingLocations, error: checkError } = await supabase
        .from('storage_locations')
        .select('id')
        .eq('household_id', householdId)
        .limit(1)

      if (checkError) {
        console.error('❌ Error checking existing locations:', checkError)
        throw checkError
      }

      console.log('📊 Existing locations found:', existingLocations?.length || 0)

      // If no storage locations exist, create default ones
      if (!existingLocations || existingLocations.length === 0) {
        console.log('🏗️ No storage locations found, creating defaults...')
        try {
          await createDefaultStorageLocations(householdId)
          console.log('✅ Default storage locations created')
        } catch (defaultError) {
          console.error('❌ Error creating default locations:', defaultError)
          throw defaultError
        }
      }

      // Now load all storage locations
      console.log('📦 Loading all storage locations...')
      const { data, error } = await supabase
        .from('storage_locations')
        .select('*')
        .eq('household_id', householdId)
        .eq('is_active', true)
        .order('level')
        .order('sort_order')

      if (error) {
        console.error('❌ Error loading storage locations:', error)
        throw error
      }

      console.log('📦 Loaded storage locations:', data?.length || 0, 'items')

      // Build hierarchical structure
      const locationMap = new Map<string, StorageLocation>()
      const rootLocations: StorageLocation[] = []

      // First pass: create all locations
      data?.forEach(location => {
        locationMap.set(location.id, {
          ...location,
          children: [],
          level: (location as any).level || 0,
          sort_order: (location as any).sort_order || 0,
          parent_id: (location as any).parent_id || undefined
        })
      })

      // Second pass: build hierarchy
      data?.forEach(location => {
        const loc = locationMap.get(location.id)!
        if ((location as any).parent_id) {
          const parent = locationMap.get((location as any).parent_id)
          if (parent) {
            parent.children!.push(loc)
          }
        } else {
          rootLocations.push(loc)
        }
      })

      console.log('🌳 Built hierarchy, root locations:', rootLocations.length)
      setLocations(rootLocations)
    } catch (err: any) {
      console.error('💥 Storage locations loading failed:', err)
      setError(`Failed to load storage locations: ${err.message}`)
    } finally {
      console.log('🏁 Storage locations loading finished')
      setLoading(false)
    }
  }

  const generateQRCode = async (location: StorageLocation) => {
    try {
      setSelectedLocationForQR(location)

      // Create URL that links to inventory page filtered by this storage location
      const baseUrl = window.location.origin
      const inventoryUrl = `${baseUrl}/inventory?location=${location.id}`

      console.log('🔗 Generating QR code for URL:', inventoryUrl)

      // Generate QR code as data URL
      const qrDataUrl = await QRCode.toDataURL(inventoryUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      })

      setQrCodeDataUrl(qrDataUrl)
      setQrDialogOpen(true)
    } catch (err) {
      console.error('Error generating QR code:', err)
      setError('Failed to generate QR code')
    }
  }

  const printQRCode = () => {
    if (!selectedLocationForQR || !qrCodeDataUrl) return

    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Storage Location QR Code</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                text-align: center;
                margin: 20px;
              }
              .qr-container {
                border: 2px solid #000;
                padding: 20px;
                display: inline-block;
                margin: 20px;
              }
              .location-info {
                margin: 10px 0;
                font-size: 18px;
                font-weight: bold;
              }
              .instructions {
                margin: 10px 0;
                font-size: 14px;
                color: #666;
              }
            </style>
          </head>
          <body>
            <div class="qr-container">
              <div class="location-info">${selectedLocationForQR.name}</div>
              <div class="instructions">Scan to view inventory</div>
              <img src="${qrCodeDataUrl}" alt="QR Code for ${selectedLocationForQR.name}" />
              <div class="instructions">
                Type: ${selectedLocationForQR.type}<br>
                ${selectedLocationForQR.description || ''}
              </div>
            </div>
          </body>
        </html>
      `)
      printWindow.document.close()
      printWindow.print()
    }
  }

  const openAddDialog = (parent?: StorageLocation) => {
    setParentLocation(parent || null)
    setEditingLocation(null)
    setFormData({ name: '', type: parent ? 'Shelf' : 'Pantry', description: '' })
    setDialogOpen(true)
  }

  const openEditDialog = (location: StorageLocation) => {
    setEditingLocation(location)
    setParentLocation(null)
    setFormData({
      name: location.name,
      type: location.type,
      description: location.description || ''
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!user) return

    setSaving(true)
    setError(null)

    try {
      // Ensure household exists first
      const householdId = user.id
      await ensureHouseholdExists(householdId)

      if (editingLocation) {
        // Update existing location
        const { error } = await supabase
          .from('storage_locations')
          .update({
            name: formData.name,
            type: formData.type,
            description: formData.description
          })
          .eq('id', editingLocation.id)

        if (error) throw error
        setSuccess('Storage location updated successfully!')
      } else {
        // Create new location
        const level = parentLocation ? parentLocation.level + 1 : 0
        const { error } = await supabase
          .from('storage_locations')
          .insert([{
            household_id: householdId,
            name: formData.name,
            type: formData.type,
            description: formData.description,
            parent_id: parentLocation?.id || null,
            level: level,
            sort_order: 0
          }])

        if (error) throw error
        setSuccess('Storage location added successfully!')
      }

      setDialogOpen(false)
      await loadStorageLocations()
    } catch (err: any) {
      setError(`Failed to save storage location: ${err.message}`)
      console.error('Storage location save error:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (location: StorageLocation) => {
    if (!confirm(`Are you sure you want to delete "${location.name}"? This will also delete all its sub-locations.`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('storage_locations')
        .update({ is_active: false })
        .eq('id', location.id)

      if (error) throw error

      setSuccess('Storage location deleted successfully!')
      await loadStorageLocations()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const printAllQRCodes = async () => {
    try {
      setError(null)
      console.log('🖨️ Generating batch QR codes for', locations.length, 'storage locations')

      const printWindow = window.open('', '_blank')
      if (!printWindow) return

      // Flatten all locations (including children) into a single array
      const allLocations: StorageLocation[] = []

      const flattenLocations = (locationList: StorageLocation[]) => {
        locationList.forEach(location => {
          allLocations.push(location)
          if (location.children && location.children.length > 0) {
            flattenLocations(location.children)
          }
        })
      }

      flattenLocations(locations)

      // Generate QR codes for each location
      const qrCodePromises = allLocations.map(async (location) => {
        const inventoryUrl = `${window.location.origin}/inventory?location=${location.id}`
        const qrDataUrl = await QRCode.toDataURL(inventoryUrl, {
          width: 200,
          margin: 1,
          color: { dark: '#000000', light: '#FFFFFF' }
        })

        // Build full path for location
        const buildPath = (loc: StorageLocation): string => {
          const parent = allLocations.find(l => l.id === loc.parent_id)
          if (parent) {
            return `${buildPath(parent)} > ${loc.name}`
          }
          return loc.name
        }

        return {
          ...location,
          qrCode: qrDataUrl,
          fullPath: buildPath(location)
        }
      })

      const locationsWithQR = await Promise.all(qrCodePromises)

      // Create 8.5x11 printable layout (3 columns x 4 rows = 12 per page)
      printWindow.document.write(`
        <html>
          <head>
            <title>PantryIQ Storage Location QR Codes</title>
            <style>
              @page {
                size: letter;
                margin: 0.5in;
              }
              body {
                font-family: Arial, sans-serif;
                margin: 0;
                padding: 0;
              }
              .header {
                text-align: center;
                margin-bottom: 20px;
                border-bottom: 2px solid #2C3E50;
                padding-bottom: 10px;
              }
              .title {
                font-size: 24px;
                font-weight: bold;
                color: #2C3E50;
                margin-bottom: 5px;
              }
              .subtitle {
                font-size: 14px;
                color: #87A96B;
                font-style: italic;
              }
              .grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 15px;
                margin-bottom: 20px;
              }
              .qr-item {
                border: 2px solid #2C3E50;
                padding: 12px;
                text-align: center;
                background: white;
                border-radius: 8px;
                page-break-inside: avoid;
                min-height: 220px;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
              }
              .location-name {
                font-size: 13px;
                font-weight: bold;
                color: #2C3E50;
                margin-bottom: 3px;
                word-wrap: break-word;
                line-height: 1.2;
                min-height: 30px;
                display: flex;
                align-items: center;
                justify-content: center;
              }
              .location-type {
                font-size: 11px;
                color: #87A96B;
                margin-bottom: 8px;
              }
              .qr-code {
                flex-grow: 1;
                display: flex;
                align-items: center;
                justify-content: center;
              }
              .footer-info {
                font-size: 9px;
                color: #666;
                margin-top: 5px;
              }
              .page-footer {
                text-align: center;
                font-size: 10px;
                color: #999;
                margin-top: 20px;
                border-top: 1px solid #E8E8E8;
                padding-top: 10px;
              }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="title">PantryIQ Storage Locations</div>
              <div class="subtitle">Scan QR codes to instantly view location inventory</div>
            </div>

            <div class="grid">
              ${locationsWithQR.map(location => `
                <div class="qr-item">
                  <div>
                    <div class="location-name">${location.fullPath}</div>
                    <div class="location-type">${location.type}</div>
                  </div>
                  <div class="qr-code">
                    <img src="${location.qrCode}" alt="QR Code for ${location.name}" style="width: 130px; height: 130px;" />
                  </div>
                  <div class="footer-info">
                    Scan with PantryIQ
                  </div>
                </div>
              `).join('')}
            </div>

            <div class="page-footer">
              PantryIQ - Smart Inventory Management<br>
              Generated: ${new Date().toLocaleDateString()} • ${allLocations.length} locations • Cut along borders
            </div>
          </body>
        </html>
      `)

      printWindow.document.close()
      printWindow.print()

      console.log('✅ Generated batch QR codes for', allLocations.length, 'locations')
      setSuccess(`Generated ${allLocations.length} QR codes for printing and cutting!`)

    } catch (err: any) {
      console.error('Error generating batch QR codes:', err)
      setError('Failed to generate QR codes. Please try again.')
    }
  }

  const renderLocationTree = (locations: StorageLocation[], depth = 0) => {
    return locations.map((location) => {
      const TypeIcon = getTypeIcon(location.type)
      const hasChildren = location.children && location.children.length > 0

      return (
        <Box key={location.id} sx={{ ml: depth * 2 }}>
          <Paper
            sx={{
              p: 2,
              mb: 1,
              display: 'flex',
              alignItems: 'center',
              backgroundColor: depth === 0 ? 'background.paper' : 'grey.50'
            }}
          >
            <TypeIcon sx={{ mr: 2, color: 'primary.main' }} />
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant={depth === 0 ? 'h6' : 'body1'} component="div">
                {location.name}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip
                  size="small"
                  label={location.type}
                  color={getTypeColor(location.type) as any}
                  variant="outlined"
                />
                {location.description && (
                  <Typography variant="caption" color="textSecondary">
                    {location.description}
                  </Typography>
                )}
              </Box>
            </Box>
            <Box>
              {depth < 2 && (
                <IconButton
                  size="small"
                  onClick={() => openAddDialog(location)}
                  title={`Add ${depth === 0 ? 'shelf' : 'section'}`}
                >
                  <AddIcon />
                </IconButton>
              )}
              <IconButton
                size="small"
                onClick={() => generateQRCode(location)}
                title="Generate QR Code"
                color="primary"
              >
                <QrCodeIcon />
              </IconButton>
              <IconButton
                size="small"
                onClick={() => openEditDialog(location)}
                title="Edit"
              >
                <EditIcon />
              </IconButton>
              <IconButton
                size="small"
                onClick={() => handleDelete(location)}
                title="Delete"
                color="error"
              >
                <DeleteIcon />
              </IconButton>
            </Box>
          </Paper>

          {hasChildren && (
            <Box sx={{ ml: 2 }}>
              {renderLocationTree(location.children!, depth + 1)}
            </Box>
          )}
        </Box>
      )
    })
  }

  if (!user || loading) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Typography>Loading...</Typography>
      </Container>
    )
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Box display="flex" alignItems="center" mb={4}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push('/settings')}
          sx={{ mr: 2 }}
        >
          Back to Settings
        </Button>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Storage Configuration
          </Typography>
          <Typography variant="body1" color="textSecondary">
            Configure your pantries, freezers, shelves and sections
          </Typography>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Box sx={{ mb: 3 }}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => openAddDialog()}
          size="large"
          sx={{ mr: 2 }}
        >
          Add Main Storage Location
        </Button>
        <Button
          variant="outlined"
          startIcon={<PrintIcon />}
          onClick={printAllQRCodes}
          size="large"
          disabled={locations.length === 0}
        >
          Print All QR Codes
        </Button>

        {locations.length === 0 && (
          <Button
            variant="outlined"
            onClick={async () => {
              if (user) {
                console.log('🔧 Force creating default storage locations...')
                try {
                  await createDefaultStorageLocations(user.id)
                  await loadStorageLocations()
                  setSuccess('Default storage locations created!')
                } catch (err: any) {
                  setError(`Failed to create defaults: ${err.message}`)
                  console.error('Force create error:', err)
                }
              }
            }}
          >
            Create Default Storage
          </Button>
        )}
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Your Storage Locations ({locations.length} loaded)
              </Typography>

              {locations.length > 0 && locations.length === 3 &&
               locations.some(l => l.name === 'Main Pantry') &&
               locations.some(l => l.name === 'Main Freezer') &&
               locations.some(l => l.name === 'Main Refrigerator') && (
                <Alert severity="info" sx={{ mb: 3 }}>
                  <Typography variant="body2">
                    <strong>Default storage locations created!</strong> You can rename these default locations or add additional pantries, freezers, shelves, and sections as needed.
                  </Typography>
                </Alert>
              )}

              {locations.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <StorageIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" color="textSecondary" gutterBottom>
                    Setting up your storage...
                  </Typography>
                  <Typography variant="body2" color="textSecondary" paragraph>
                    Default storage locations will be created automatically
                  </Typography>
                </Box>
              ) : (
                <Box>
                  {renderLocationTree(locations)}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingLocation ? 'Edit Storage Location' : 'Add Storage Location'}
          {parentLocation && (
            <Typography variant="caption" display="block" color="textSecondary">
              Adding to: {parentLocation.name}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                label="Location Name"
                fullWidth
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Kitchen Pantry, Main Freezer, Top Shelf"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Type</InputLabel>
                <Select
                  value={formData.type}
                  label="Type"
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                >
                  {storageTypes
                    .filter(type => {
                      // Determine the level we're working with
                      let currentLevel = 0;

                      if (editingLocation) {
                        // When editing, use the location's current level
                        currentLevel = editingLocation.level;
                      } else if (parentLocation) {
                        // When adding, use parent level + 1
                        currentLevel = parentLocation.level + 1;
                      } else {
                        // When adding at root level
                        currentLevel = 0;
                      }

                      if (currentLevel === 0) {
                        // Root level: only main storage types
                        return ['Pantry', 'Freezer', 'Refrigerator', 'DeepFreezer'].includes(type.value)
                      } else if (currentLevel === 1) {
                        // Level 1: shelves, sections, etc.
                        return ['Shelf', 'Section', 'Drawer'].includes(type.value)
                      } else {
                        // Level 2: compartments, sections
                        return ['Section', 'Compartment'].includes(type.value)
                      }
                    })
                    .map((type) => (
                      <MenuItem key={type.value} value={type.value}>
                        {type.label}
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Description (Optional)"
                fullWidth
                multiline
                rows={2}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Additional details about this location..."
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={!formData.name || !formData.type || saving}
            startIcon={<SaveIcon />}
          >
            {saving ? 'Saving...' : editingLocation ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* QR Code Dialog */}
      <Dialog open={qrDialogOpen} onClose={() => setQrDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Storage Location QR Code
          {selectedLocationForQR && (
            <Typography variant="subtitle2" color="textSecondary">
              {selectedLocationForQR.name}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ textAlign: 'center', py: 2 }}>
            {qrCodeDataUrl && (
              <Box>
                <img
                  src={qrCodeDataUrl}
                  alt="QR Code"
                  style={{ maxWidth: '100%', height: 'auto', border: '1px solid #ddd', borderRadius: '8px' }}
                />
                <Typography variant="body2" color="textSecondary" sx={{ mt: 2 }}>
                  Scan this QR code to view inventory for this storage location
                </Typography>
                {selectedLocationForQR && (
                  <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                    Links to: /inventory?location={selectedLocationForQR.id}
                  </Typography>
                )}
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setQrDialogOpen(false)}>Close</Button>
          <Button
            onClick={printQRCode}
            variant="contained"
            startIcon={<PrintIcon />}
            disabled={!qrCodeDataUrl}
          >
            Print QR Code
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}