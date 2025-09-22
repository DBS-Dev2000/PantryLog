'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Button,
  Grid,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Tabs,
  Tab,
  IconButton,
  Collapse,
  List,
  ListItem,
  ListItemText,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider
} from '@mui/material'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  ExpandMore as ExpandMoreIcon,
  Storage as DataIcon,
  Category as TaxonomyIcon,
  Schedule as ShelfLifeIcon,
  RestaurantMenu as EquivalencyIcon,
  LocalDining as DietaryIcon
} from '@mui/icons-material'
import { supabase } from '@/lib/supabase'

interface User {
  id: string
  email: string
}

interface IngredientEquivalency {
  ingredient: string
  variations: string[]
}

interface ShelfLifeItem {
  category: string
  item: string
  pantry: number
  refrigerator: number
  freezer: number
  notes?: string
}

interface FoodTaxonomyItem {
  category: string
  subcategory: string
  items: string[]
  properties?: any
}

export default function DataManagementAdmin() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(0)
  const [openDialog, setOpenDialog] = useState<string | null>(null)

  // Data states
  const [equivalencies, setEquivalencies] = useState<IngredientEquivalency[]>([])
  const [shelfLifeData, setShelfLifeData] = useState<ShelfLifeItem[]>([])
  const [taxonomyData, setTaxonomyData] = useState<FoodTaxonomyItem[]>([])

  // Edit states
  const [editingItem, setEditingItem] = useState<any>(null)
  const [newItem, setNewItem] = useState<any>({})

  useEffect(() => {
    checkUser()
    loadData()
  }, [])

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession()

    if (!session?.user) {
      router.push('/auth')
      return
    }

    if (session?.user) {
      setUser(session.user)

      // Check if user is a system admin
      const { data: adminUser } = await supabase
        .from('system_admins')
        .select('*')
        .eq('user_id', session.user.id)
        .single()

      if (adminUser) {
        setIsAdmin(true)
      } else {
        router.push('/')
        return
      }
    }

    setLoading(false)
  }

  const loadData = async () => {
    try {
      // Load ingredient equivalencies (from TypeScript file)
      const equivalenciesResponse = await fetch('/api/admin/ingredient-equivalencies')
      if (equivalenciesResponse.ok) {
        const data = await equivalenciesResponse.json()
        setEquivalencies(data)
      }

      // Load shelf life data
      const shelfLifeResponse = await fetch('/api/admin/shelf-life-data')
      if (shelfLifeResponse.ok) {
        const data = await shelfLifeResponse.json()
        setShelfLifeData(data)
      }

      // Load taxonomy data
      const taxonomyResponse = await fetch('/api/admin/taxonomy-data')
      if (taxonomyResponse.ok) {
        const data = await taxonomyResponse.json()
        setTaxonomyData(data)
      }

    } catch (error) {
      console.error('Error loading data:', error)
    }
  }

  const handleSaveEquivalency = async (equivalency: IngredientEquivalency) => {
    try {
      const response = await fetch('/api/admin/ingredient-equivalencies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(equivalency)
      })

      if (response.ok) {
        loadData()
        setOpenDialog(null)
        setEditingItem(null)
        setNewItem({})
      }
    } catch (error) {
      console.error('Error saving equivalency:', error)
    }
  }

  const handleSaveShelfLife = async (item: ShelfLifeItem) => {
    try {
      const response = await fetch('/api/admin/shelf-life-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
      })

      if (response.ok) {
        loadData()
        setOpenDialog(null)
        setEditingItem(null)
        setNewItem({})
      }
    } catch (error) {
      console.error('Error saving shelf life data:', error)
    }
  }

  const handleDeleteItem = async (type: string, id: string) => {
    try {
      const response = await fetch(`/api/admin/${type}/${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        loadData()
      }
    } catch (error) {
      console.error('Error deleting item:', error)
    }
  }

  if (loading) {
    return (
      <Container>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
          <Typography>Loading...</Typography>
        </Box>
      </Container>
    )
  }

  if (!isAdmin) {
    return (
      <Container>
        <Alert severity="error">
          Access denied. This page is only available to system administrators.
        </Alert>
      </Container>
    )
  }

  const renderEquivalenciesTab = () => (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h6">Ingredient Equivalencies</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setNewItem({ ingredient: '', variations: [''] })
            setOpenDialog('equivalency')
          }}
        >
          Add Equivalency
        </Button>
      </Box>

      <Grid container spacing={2}>
        {equivalencies.map((equiv, index) => (
          <Grid item xs={12} md={6} key={index}>
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6" color="primary">
                    {equiv.ingredient}
                  </Typography>
                  <Box>
                    <IconButton
                      size="small"
                      onClick={() => {
                        setEditingItem(equiv)
                        setOpenDialog('equivalency')
                      }}
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleDeleteItem('ingredient-equivalencies', equiv.ingredient)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                </Box>
                <Box display="flex" flexWrap="wrap" gap={1}>
                  {equiv.variations.map((variation, vIndex) => (
                    <Chip
                      key={vIndex}
                      label={variation}
                      size="small"
                      variant="outlined"
                    />
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  )

  const renderShelfLifeTab = () => (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h6">Food Shelf Life Database</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setNewItem({ category: '', item: '', pantry: 0, refrigerator: 0, freezer: 0, notes: '' })
            setOpenDialog('shelflife')
          }}
        >
          Add Shelf Life Entry
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Category</TableCell>
              <TableCell>Item</TableCell>
              <TableCell>Pantry (days)</TableCell>
              <TableCell>Refrigerator (days)</TableCell>
              <TableCell>Freezer (days)</TableCell>
              <TableCell>Notes</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {shelfLifeData.map((item, index) => (
              <TableRow key={index}>
                <TableCell>{item.category}</TableCell>
                <TableCell>{item.item}</TableCell>
                <TableCell>{item.pantry}</TableCell>
                <TableCell>{item.refrigerator}</TableCell>
                <TableCell>{item.freezer}</TableCell>
                <TableCell>{item.notes}</TableCell>
                <TableCell>
                  <IconButton
                    size="small"
                    onClick={() => {
                      setEditingItem(item)
                      setOpenDialog('shelflife')
                    }}
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => handleDeleteItem('shelf-life-data', `${item.category}-${item.item}`)}
                  >
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )

  const renderTaxonomyTab = () => (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h6">Food Taxonomy</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setNewItem({ category: '', subcategory: '', items: [''] })
            setOpenDialog('taxonomy')
          }}
        >
          Add Taxonomy Entry
        </Button>
      </Box>

      {taxonomyData.map((category, index) => (
        <Accordion key={index}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">
              {category.category} → {category.subcategory}
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Box display="flex" flexWrap="wrap" gap={1}>
                {category.items.map((item, itemIndex) => (
                  <Chip
                    key={itemIndex}
                    label={item}
                    variant="outlined"
                  />
                ))}
              </Box>
              <Box>
                <IconButton
                  size="small"
                  onClick={() => {
                    setEditingItem(category)
                    setOpenDialog('taxonomy')
                  }}
                >
                  <EditIcon />
                </IconButton>
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => handleDeleteItem('taxonomy-data', `${category.category}-${category.subcategory}`)}
                >
                  <DeleteIcon />
                </IconButton>
              </Box>
            </Box>
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  )

  const renderEquivalencyDialog = () => {
    const item = editingItem || newItem
    return (
      <Dialog open={openDialog === 'equivalency'} onClose={() => setOpenDialog(null)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingItem ? 'Edit Ingredient Equivalency' : 'Add New Ingredient Equivalency'}
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Main Ingredient"
            value={item.ingredient || ''}
            onChange={(e) => setNewItem({ ...item, ingredient: e.target.value })}
            margin="dense"
          />

          <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
            Variations (one per line):
          </Typography>

          {(item.variations || ['']).map((variation: string, index: number) => (
            <Box key={index} display="flex" gap={1} mb={1}>
              <TextField
                fullWidth
                size="small"
                value={variation}
                onChange={(e) => {
                  const newVariations = [...(item.variations || [])]
                  newVariations[index] = e.target.value
                  setNewItem({ ...item, variations: newVariations })
                }}
                placeholder="Enter variation"
              />
              {index === (item.variations || []).length - 1 && (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => {
                    const newVariations = [...(item.variations || []), '']
                    setNewItem({ ...item, variations: newVariations })
                  }}
                >
                  <AddIcon />
                </Button>
              )}
              {(item.variations || []).length > 1 && (
                <Button
                  variant="outlined"
                  size="small"
                  color="error"
                  onClick={() => {
                    const newVariations = (item.variations || []).filter((_: any, i: number) => i !== index)
                    setNewItem({ ...item, variations: newVariations })
                  }}
                >
                  <DeleteIcon />
                </Button>
              )}
            </Box>
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(null)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => handleSaveEquivalency(item)}
            disabled={!item.ingredient || !item.variations?.some((v: string) => v.trim())}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    )
  }

  const renderShelfLifeDialog = () => {
    const item = editingItem || newItem
    return (
      <Dialog open={openDialog === 'shelflife'} onClose={() => setOpenDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingItem ? 'Edit Shelf Life Entry' : 'Add New Shelf Life Entry'}
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Category"
            value={item.category || ''}
            onChange={(e) => setNewItem({ ...item, category: e.target.value })}
            margin="dense"
          />
          <TextField
            fullWidth
            label="Item Name"
            value={item.item || ''}
            onChange={(e) => setNewItem({ ...item, item: e.target.value })}
            margin="dense"
          />
          <TextField
            fullWidth
            label="Pantry (days)"
            type="number"
            value={item.pantry || 0}
            onChange={(e) => setNewItem({ ...item, pantry: parseInt(e.target.value) })}
            margin="dense"
          />
          <TextField
            fullWidth
            label="Refrigerator (days)"
            type="number"
            value={item.refrigerator || 0}
            onChange={(e) => setNewItem({ ...item, refrigerator: parseInt(e.target.value) })}
            margin="dense"
          />
          <TextField
            fullWidth
            label="Freezer (days)"
            type="number"
            value={item.freezer || 0}
            onChange={(e) => setNewItem({ ...item, freezer: parseInt(e.target.value) })}
            margin="dense"
          />
          <TextField
            fullWidth
            label="Notes"
            multiline
            rows={2}
            value={item.notes || ''}
            onChange={(e) => setNewItem({ ...item, notes: e.target.value })}
            margin="dense"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(null)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => handleSaveShelfLife(item)}
            disabled={!item.category || !item.item}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    )
  }

  return (
    <Container maxWidth="xl">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Data Management
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" gutterBottom>
          Manage JSON databases, ingredient equivalencies, shelf life data, and food taxonomy
        </Typography>

        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Tabs
              value={activeTab}
              onChange={(e, newValue) => setActiveTab(newValue)}
              variant="scrollable"
              scrollButtons="auto"
            >
              <Tab
                icon={<EquivalencyIcon />}
                label="Ingredient Equivalencies"
                iconPosition="start"
              />
              <Tab
                icon={<ShelfLifeIcon />}
                label="Shelf Life Database"
                iconPosition="start"
              />
              <Tab
                icon={<TaxonomyIcon />}
                label="Food Taxonomy"
                iconPosition="start"
              />
              <Tab
                icon={<DietaryIcon />}
                label="Dietary Rules"
                iconPosition="start"
              />
            </Tabs>

            <Divider sx={{ my: 3 }} />

            <Box sx={{ mt: 3 }}>
              {activeTab === 0 && renderEquivalenciesTab()}
              {activeTab === 1 && renderShelfLifeTab()}
              {activeTab === 2 && renderTaxonomyTab()}
              {activeTab === 3 && (
                <Box>
                  <Typography variant="h6">Dietary Rules Management</Typography>
                  <Alert severity="info" sx={{ mt: 2 }}>
                    Dietary rules management coming soon. This will include allergies, medical conditions,
                    lifestyle diets, and meal planning strategies.
                  </Alert>
                </Box>
              )}
            </Box>
          </CardContent>
        </Card>

        {/* Dialogs */}
        {renderEquivalencyDialog()}
        {renderShelfLifeDialog()}
      </Box>
    </Container>
  )
}