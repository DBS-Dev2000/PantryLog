'use client'

import { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  TextField,
  Grid,
  Chip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  Tooltip
} from '@mui/material'
import {
  ExpandMore as ExpandMoreIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  RestoreFromTrash as RestoreIcon,
  Info as InfoIcon
} from '@mui/icons-material'
import { supabase } from '@/lib/supabase'

interface TaxonomyEntry {
  id?: string
  product_name: string
  category: string
  subcategory?: string
  shelf_life_pantry?: number
  shelf_life_fridge?: number
  shelf_life_freezer?: number
  storage_recommendation?: string
  confidence_score: number
  is_override: boolean
  source?: 'household' | 'system'
}

interface EquivalencyEntry {
  id?: string
  ingredient_name: string
  equivalent_name: string
  confidence_score: number
  substitution_ratio: string
  notes?: string
  is_bidirectional: boolean
  source?: 'household' | 'system'
}

interface Props {
  productName: string
  householdId: string
  onUpdate?: () => void
}

export default function HouseholdTaxonomyManager({ productName, householdId, onUpdate }: Props) {
  const [taxonomyData, setTaxonomyData] = useState<TaxonomyEntry | null>(null)
  const [equivalencies, setEquivalencies] = useState<EquivalencyEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Dialog states
  const [showTaxonomyDialog, setShowTaxonomyDialog] = useState(false)
  const [showEquivalencyDialog, setShowEquivalencyDialog] = useState(false)
  const [editingTaxonomy, setEditingTaxonomy] = useState<TaxonomyEntry | null>(null)
  const [editingEquivalency, setEditingEquivalency] = useState<EquivalencyEntry | null>(null)

  const categories = [
    'Proteins', 'Dairy', 'Grains', 'Vegetables', 'Fruits', 'Herbs & Spices',
    'Pantry Staples', 'Canned Goods', 'Frozen Foods', 'Beverages', 'Snacks',
    'Condiments', 'Baking', 'Other'
  ]

  const storageTypes = [
    'pantry', 'refrigerator', 'freezer', 'counter', 'cellar'
  ]

  useEffect(() => {
    loadData()
  }, [productName, householdId])

  const loadData = async () => {
    setLoading(true)
    setError(null)

    try {
      // Load taxonomy data for this product
      const { data: taxonomy } = await supabase
        .rpc('get_household_food_taxonomy', {
          p_household_id: householdId,
          p_product_name: productName
        })

      if (taxonomy && taxonomy.length > 0) {
        setTaxonomyData(taxonomy[0])
      }

      // Load equivalencies for this product
      const { data: equivalenciesData } = await supabase
        .rpc('get_household_ingredient_equivalencies', {
          p_household_id: householdId,
          p_ingredient_name: productName
        })

      setEquivalencies(equivalenciesData || [])

    } catch (err: any) {
      console.error('Error loading household taxonomy data:', err)
      setError('Failed to load household customizations')
    } finally {
      setLoading(false)
    }
  }

  const saveTaxonomyOverride = async (taxonomy: TaxonomyEntry) => {
    setSaving(true)
    setError(null)

    try {
      const { error: saveError } = await supabase
        .from('household_food_taxonomy')
        .upsert({
          household_id: householdId,
          product_name: productName,
          category: taxonomy.category,
          subcategory: taxonomy.subcategory || null,
          shelf_life_pantry: taxonomy.shelf_life_pantry || null,
          shelf_life_fridge: taxonomy.shelf_life_fridge || null,
          shelf_life_freezer: taxonomy.shelf_life_freezer || null,
          storage_recommendation: taxonomy.storage_recommendation || null,
          confidence_score: taxonomy.confidence_score,
          is_override: true
        }, {
          onConflict: 'household_id,product_name'
        })

      if (saveError) throw saveError

      await loadData()
      setShowTaxonomyDialog(false)
      setEditingTaxonomy(null)
      onUpdate?.()

    } catch (err: any) {
      console.error('Error saving taxonomy override:', err)
      setError('Failed to save taxonomy override')
    } finally {
      setSaving(false)
    }
  }

  const saveEquivalencyOverride = async (equivalency: EquivalencyEntry) => {
    setSaving(true)
    setError(null)

    try {
      const { error: saveError } = await supabase
        .from('household_ingredient_equivalencies')
        .upsert({
          household_id: householdId,
          ingredient_name: productName,
          equivalent_name: equivalency.equivalent_name,
          confidence_score: equivalency.confidence_score,
          substitution_ratio: equivalency.substitution_ratio,
          notes: equivalency.notes || null,
          is_bidirectional: equivalency.is_bidirectional
        }, {
          onConflict: 'household_id,ingredient_name,equivalent_name'
        })

      if (saveError) throw saveError

      await loadData()
      setShowEquivalencyDialog(false)
      setEditingEquivalency(null)
      onUpdate?.()

    } catch (err: any) {
      console.error('Error saving equivalency override:', err)
      setError('Failed to save equivalency override')
    } finally {
      setSaving(false)
    }
  }

  const deleteOverride = async (type: 'taxonomy' | 'equivalency', id?: string) => {
    if (!id) return

    setSaving(true)
    setError(null)

    try {
      const table = type === 'taxonomy' ? 'household_food_taxonomy' : 'household_ingredient_equivalencies'
      const { error: deleteError } = await supabase
        .from(table)
        .delete()
        .eq('id', id)

      if (deleteError) throw deleteError

      await loadData()
      onUpdate?.()

    } catch (err: any) {
      console.error(`Error deleting ${type} override:`, err)
      setError(`Failed to delete ${type} override`)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Typography>Loading household customizations...</Typography>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <Typography variant="h6">
            🏠 Household Food Customizations
          </Typography>
          <Tooltip title="Customize how this food is classified and what it can substitute for in your household">
            <IconButton size="small">
              <InfoIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
          Customize food classification and ingredient equivalencies for <strong>{productName}</strong> in your household
        </Typography>

        {/* Food Taxonomy Section */}
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="subtitle1">Food Classification</Typography>
              {taxonomyData?.source === 'household' && (
                <Chip label="Customized" color="primary" size="small" />
              )}
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            {taxonomyData ? (
              <Box>
                <Grid container spacing={2} mb={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">Category:</Typography>
                    <Typography variant="body1">{taxonomyData.category}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">Subcategory:</Typography>
                    <Typography variant="body1">{taxonomyData.subcategory || 'None'}</Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="body2" color="textSecondary">Pantry Life:</Typography>
                    <Typography variant="body1">{taxonomyData.shelf_life_pantry || 'Not set'} days</Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="body2" color="textSecondary">Fridge Life:</Typography>
                    <Typography variant="body1">{taxonomyData.shelf_life_fridge || 'Not set'} days</Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="body2" color="textSecondary">Freezer Life:</Typography>
                    <Typography variant="body1">{taxonomyData.shelf_life_freezer || 'Not set'} days</Typography>
                  </Grid>
                </Grid>
                <Box display="flex" gap={1}>
                  <Button
                    size="small"
                    startIcon={<EditIcon />}
                    onClick={() => {
                      setEditingTaxonomy(taxonomyData)
                      setShowTaxonomyDialog(true)
                    }}
                  >
                    {taxonomyData.source === 'household' ? 'Edit Override' : 'Create Override'}
                  </Button>
                  {taxonomyData.source === 'household' && (
                    <Button
                      size="small"
                      color="error"
                      startIcon={<RestoreIcon />}
                      onClick={() => deleteOverride('taxonomy', taxonomyData.id)}
                    >
                      Restore Default
                    </Button>
                  )}
                </Box>
              </Box>
            ) : (
              <Box>
                <Typography variant="body2" color="textSecondary" mb={2}>
                  No classification found. Create a custom classification for this product.
                </Typography>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => {
                    setEditingTaxonomy({
                      product_name: productName,
                      category: '',
                      confidence_score: 1.0,
                      is_override: true
                    })
                    setShowTaxonomyDialog(true)
                  }}
                >
                  Add Classification
                </Button>
              </Box>
            )}
          </AccordionDetails>
        </Accordion>

        {/* Ingredient Equivalencies Section */}
        <Accordion sx={{ mt: 1 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="subtitle1">Ingredient Equivalencies</Typography>
              <Chip
                label={equivalencies.length}
                size="small"
                color={equivalencies.some(e => e.source === 'household') ? 'primary' : 'default'}
              />
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            {equivalencies.length > 0 ? (
              <Box>
                <Typography variant="body2" color="textSecondary" mb={2}>
                  <strong>{productName}</strong> can be substituted with:
                </Typography>
                <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
                  {equivalencies.map((eq, index) => (
                    <Chip
                      key={index}
                      label={`${eq.equivalent_name} ${eq.substitution_ratio !== '1:1' ? `(${eq.substitution_ratio})` : ''}`}
                      variant={eq.source === 'household' ? 'filled' : 'outlined'}
                      color={eq.source === 'household' ? 'primary' : 'default'}
                      size="small"
                      onDelete={eq.source === 'household' ? () => deleteOverride('equivalency', eq.id) : undefined}
                    />
                  ))}
                </Box>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => {
                    setEditingEquivalency({
                      ingredient_name: productName,
                      equivalent_name: '',
                      confidence_score: 1.0,
                      substitution_ratio: '1:1',
                      is_bidirectional: true
                    })
                    setShowEquivalencyDialog(true)
                  }}
                >
                  Add Equivalency
                </Button>
              </Box>
            ) : (
              <Box>
                <Typography variant="body2" color="textSecondary" mb={2}>
                  No ingredient equivalencies defined. Add regional or personal substitutions.
                </Typography>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => {
                    setEditingEquivalency({
                      ingredient_name: productName,
                      equivalent_name: '',
                      confidence_score: 1.0,
                      substitution_ratio: '1:1',
                      is_bidirectional: true
                    })
                    setShowEquivalencyDialog(true)
                  }}
                >
                  Add Equivalency
                </Button>
              </Box>
            )}
          </AccordionDetails>
        </Accordion>

        {/* Taxonomy Edit Dialog */}
        <Dialog open={showTaxonomyDialog} onClose={() => setShowTaxonomyDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>
            {editingTaxonomy?.source === 'household' ? 'Edit' : 'Create'} Food Classification
          </DialogTitle>
          <DialogContent>
            {editingTaxonomy && (
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Category</InputLabel>
                    <Select
                      value={editingTaxonomy.category}
                      label="Category"
                      onChange={(e) => setEditingTaxonomy({
                        ...editingTaxonomy,
                        category: e.target.value
                      })}
                    >
                      {categories.map((cat) => (
                        <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Subcategory (optional)"
                    value={editingTaxonomy.subcategory || ''}
                    onChange={(e) => setEditingTaxonomy({
                      ...editingTaxonomy,
                      subcategory: e.target.value
                    })}
                  />
                </Grid>
                <Grid item xs={4}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Pantry Days"
                    value={editingTaxonomy.shelf_life_pantry || ''}
                    onChange={(e) => setEditingTaxonomy({
                      ...editingTaxonomy,
                      shelf_life_pantry: parseInt(e.target.value) || undefined
                    })}
                  />
                </Grid>
                <Grid item xs={4}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Fridge Days"
                    value={editingTaxonomy.shelf_life_fridge || ''}
                    onChange={(e) => setEditingTaxonomy({
                      ...editingTaxonomy,
                      shelf_life_fridge: parseInt(e.target.value) || undefined
                    })}
                  />
                </Grid>
                <Grid item xs={4}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Freezer Days"
                    value={editingTaxonomy.shelf_life_freezer || ''}
                    onChange={(e) => setEditingTaxonomy({
                      ...editingTaxonomy,
                      shelf_life_freezer: parseInt(e.target.value) || undefined
                    })}
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Recommended Storage</InputLabel>
                    <Select
                      value={editingTaxonomy.storage_recommendation || ''}
                      label="Recommended Storage"
                      onChange={(e) => setEditingTaxonomy({
                        ...editingTaxonomy,
                        storage_recommendation: e.target.value
                      })}
                    >
                      {storageTypes.map((type) => (
                        <MenuItem key={type} value={type}>{type}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowTaxonomyDialog(false)}>Cancel</Button>
            <Button
              onClick={() => editingTaxonomy && saveTaxonomyOverride(editingTaxonomy)}
              variant="contained"
              disabled={saving || !editingTaxonomy?.category}
            >
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Equivalency Edit Dialog */}
        <Dialog open={showEquivalencyDialog} onClose={() => setShowEquivalencyDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Add Ingredient Equivalency</DialogTitle>
          <DialogContent>
            {editingEquivalency && (
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Equivalent Ingredient"
                    value={editingEquivalency.equivalent_name}
                    onChange={(e) => setEditingEquivalency({
                      ...editingEquivalency,
                      equivalent_name: e.target.value
                    })}
                    placeholder="e.g., squirrel, wild turkey, venison"
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Substitution Ratio"
                    value={editingEquivalency.substitution_ratio}
                    onChange={(e) => setEditingEquivalency({
                      ...editingEquivalency,
                      substitution_ratio: e.target.value
                    })}
                    placeholder="e.g., 1:1, 2:1, 1:2"
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Quality Score"
                    value={editingEquivalency.confidence_score}
                    onChange={(e) => setEditingEquivalency({
                      ...editingEquivalency,
                      confidence_score: parseFloat(e.target.value) || 1.0
                    })}
                    inputProps={{ min: 0.1, max: 1.0, step: 0.1 }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={2}
                    label="Notes (optional)"
                    value={editingEquivalency.notes || ''}
                    onChange={(e) => setEditingEquivalency({
                      ...editingEquivalency,
                      notes: e.target.value
                    })}
                    placeholder="Cooking notes, preparation differences..."
                  />
                </Grid>
              </Grid>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowEquivalencyDialog(false)}>Cancel</Button>
            <Button
              onClick={() => editingEquivalency && saveEquivalencyOverride(editingEquivalency)}
              variant="contained"
              disabled={saving || !editingEquivalency?.equivalent_name}
            >
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogActions>
        </Dialog>
      </CardContent>
    </Card>
  )
}