'use client'

import { useState, useEffect } from 'react'
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Button,
  TextField,
  Grid,
  Chip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Switch,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Paper,
  Divider,
  Tooltip
} from '@mui/material'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  SwapHoriz as SwapIcon,
  Info as InfoIcon,
  Search as SearchIcon
} from '@mui/icons-material'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface Substitution {
  id?: string
  ingredient_name: string
  equivalent_name: string
  confidence_score: number
  substitution_ratio: string
  notes?: string
  is_bidirectional: boolean
  substitution_mode?: 'always' | 'when_available'
  is_active?: boolean
}

export default function SubstitutionsPage() {
  const [substitutions, setSubstitutions] = useState<Substitution[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [showDialog, setShowDialog] = useState(false)
  const [editingItem, setEditingItem] = useState<Substitution | null>(null)
  const [user, setUser] = useState<any>(null)
  const [householdId, setHouseholdId] = useState<string | null>(null)
  const router = useRouter()

  // Form fields
  const [formData, setFormData] = useState<Substitution>({
    ingredient_name: '',
    equivalent_name: '',
    confidence_score: 1.0,
    substitution_ratio: '1:1',
    notes: '',
    is_bidirectional: true,
    substitution_mode: 'when_available',
    is_active: true
  })

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (householdId) {
      loadSubstitutions()
    }
  }, [householdId])

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }
    setUser(user)

    // Get household ID - first try user_profiles, then household_members
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('household_id')
      .eq('user_id', user.id)
      .single()

    if (profile?.household_id) {
      setHouseholdId(profile.household_id)
    } else {
      // Try household_members table
      const { data: member } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', user.id)
        .single()

      if (member?.household_id) {
        setHouseholdId(member.household_id)
      } else {
        // Last resort - check if user.id is a household_id itself (legacy)
        const { data: household } = await supabase
          .from('households')
          .select('id')
          .eq('id', user.id)
          .single()

        if (household) {
          setHouseholdId(user.id)
        } else {
          setError('No household found. Please contact support.')
        }
      }
    }
  }

  const loadSubstitutions = async () => {
    if (!householdId) return

    setLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase
        .from('household_ingredient_equivalencies')
        .select('*')
        .eq('household_id', householdId)
        .order('ingredient_name')

      if (error) throw error
      setSubstitutions(data || [])
    } catch (err: any) {
      setError('Failed to load substitutions')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = () => {
    setEditingItem(null)
    setFormData({
      ingredient_name: '',
      equivalent_name: '',
      confidence_score: 1.0,
      substitution_ratio: '1:1',
      notes: '',
      is_bidirectional: true,
      substitution_mode: 'when_available',
      is_active: true
    })
    setShowDialog(true)
  }

  const handleEdit = (item: Substitution) => {
    setEditingItem(item)
    setFormData(item)
    setShowDialog(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this substitution?')) return

    try {
      const { error } = await supabase
        .from('household_ingredient_equivalencies')
        .delete()
        .eq('id', id)

      if (error) throw error
      setSuccess('Substitution deleted successfully')
      loadSubstitutions()
    } catch (err: any) {
      setError('Failed to delete substitution')
      console.error(err)
    }
  }

  const handleSave = async () => {
    console.log('Saving substitution:', { householdId, formData, user })

    if (!householdId) {
      setError('No household found. Please refresh the page or contact support.')
      return
    }

    if (!formData.ingredient_name?.trim() || !formData.equivalent_name?.trim()) {
      setError('Please fill in both ingredient names')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const dataToSave = {
        ...formData,
        household_id: householdId,
        created_by: user?.id
      }

      if (editingItem?.id) {
        // Update existing
        const { error } = await supabase
          .from('household_ingredient_equivalencies')
          .update(dataToSave)
          .eq('id', editingItem.id)

        if (error) throw error
        setSuccess('Substitution updated successfully')
      } else {
        // Insert new
        const { error } = await supabase
          .from('household_ingredient_equivalencies')
          .insert([dataToSave])

        if (error) throw error
        setSuccess('Substitution added successfully')
      }

      setShowDialog(false)
      loadSubstitutions()
    } catch (err: any) {
      setError('Failed to save substitution')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const filteredSubstitutions = substitutions.filter(sub =>
    sub.ingredient_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sub.equivalent_name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Common substitutions to suggest
  const commonSubstitutions = [
    { from: 'cooking spray', to: 'butter', ratio: '1 spray : 1 tsp', notes: 'Butter adds more flavor' },
    { from: 'cooking spray', to: 'olive oil', ratio: '1 spray : 1 tsp', notes: 'Brush or drizzle oil instead' },
    { from: 'buttermilk', to: 'milk + vinegar', ratio: '1 cup : 1 cup milk + 1 tbsp vinegar', notes: 'Let sit 5 minutes' },
    { from: 'heavy cream', to: 'milk + butter', ratio: '1 cup : 3/4 cup milk + 1/4 cup melted butter', notes: 'For cooking, not whipping' },
    { from: 'brown sugar', to: 'white sugar + molasses', ratio: '1 cup : 1 cup sugar + 1 tbsp molasses', notes: 'Mix well' },
    { from: 'self-rising flour', to: 'all-purpose flour + baking powder + salt', ratio: '1 cup : 1 cup flour + 1.5 tsp baking powder + 0.25 tsp salt', notes: 'Mix thoroughly' }
  ]

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        <Typography variant="h4" gutterBottom>
          🔄 Ingredient Substitutions
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          Manage your household's ingredient substitutions and equivalencies
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

        {/* Info Card */}
        <Card sx={{ mb: 3, bgcolor: 'info.light', color: 'info.contrastText' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              <InfoIcon sx={{ mr: 1, verticalAlign: 'bottom' }} />
              How Substitutions Work
            </Typography>
            <Typography variant="body2">
              When a recipe calls for an ingredient you don't have, the system will automatically suggest
              your configured substitutions. Set up bidirectional substitutions for ingredients that can
              be swapped either way (like butter ↔ margarine).
            </Typography>
          </CardContent>
        </Card>

        {/* Search and Add */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={8}>
                <TextField
                  fullWidth
                  placeholder="Search substitutions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  InputProps={{
                    startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                  }}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={handleAdd}
                >
                  Add Substitution
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Current Substitutions */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Your Substitutions
            </Typography>
            <List>
              {loading ? (
                <ListItem>
                  <ListItemText primary="Loading..." />
                </ListItem>
              ) : filteredSubstitutions.length === 0 ? (
                <ListItem>
                  <ListItemText
                    primary="No substitutions configured"
                    secondary="Add your first substitution to get started"
                  />
                </ListItem>
              ) : (
                filteredSubstitutions.map(sub => (
                  <React.Fragment key={sub.id}>
                    <ListItem>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="subtitle1" sx={{
                              opacity: sub.is_active ? 1 : 0.5,
                              textDecoration: sub.is_active ? 'none' : 'line-through'
                            }}>
                              {sub.ingredient_name}
                            </Typography>
                            <SwapIcon sx={{ color: 'text.secondary' }} />
                            <Typography variant="subtitle1" sx={{
                              opacity: sub.is_active ? 1 : 0.5,
                              textDecoration: sub.is_active ? 'none' : 'line-through'
                            }}>
                              {sub.equivalent_name}
                            </Typography>
                            {sub.is_bidirectional && (
                              <Chip label="↔" size="small" color="primary" />
                            )}
                            {sub.substitution_mode === 'always' && (
                              <Chip label="Always" size="small" color="error" />
                            )}
                            {!sub.is_active && (
                              <Chip label="Disabled" size="small" variant="outlined" />
                            )}
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="body2">
                              Ratio: {sub.substitution_ratio} •
                              Confidence: {Math.round(sub.confidence_score * 100)}% •
                              Mode: {sub.substitution_mode === 'always' ? 'Always substitute' : 'When available'}
                            </Typography>
                            {sub.notes && (
                              <Typography variant="caption" color="text.secondary">
                                {sub.notes}
                              </Typography>
                            )}
                          </Box>
                        }
                      />
                      <ListItemSecondaryAction>
                        <IconButton onClick={() => handleEdit(sub)} size="small">
                          <EditIcon />
                        </IconButton>
                        <IconButton onClick={() => handleDelete(sub.id!)} size="small" color="error">
                          <DeleteIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                    <Divider />
                  </React.Fragment>
                ))
              )}
            </List>
          </CardContent>
        </Card>

        {/* Common Substitutions Suggestions */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              💡 Common Substitutions
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Click to add these popular substitutions to your household
            </Typography>
            <Grid container spacing={1}>
              {commonSubstitutions.map((sub, idx) => (
                <Grid item xs={12} sm={6} key={idx}>
                  <Paper
                    sx={{
                      p: 2,
                      cursor: 'pointer',
                      '&:hover': { bgcolor: 'action.hover' }
                    }}
                    onClick={() => {
                      setFormData({
                        ingredient_name: sub.from,
                        equivalent_name: sub.to,
                        substitution_ratio: sub.ratio,
                        notes: sub.notes,
                        confidence_score: 1.0,
                        is_bidirectional: false,
                        substitution_mode: 'when_available',
                        is_active: true
                      })
                      setEditingItem(null)
                      setShowDialog(true)
                    }}
                  >
                    <Typography variant="subtitle2">
                      {sub.from} → {sub.to}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {sub.ratio}
                    </Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>

        {/* Add/Edit Dialog */}
        <Dialog open={showDialog} onClose={() => setShowDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>
            {editingItem ? 'Edit Substitution' : 'Add Substitution'}
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Original Ingredient"
                  value={formData.ingredient_name}
                  onChange={(e) => setFormData({ ...formData, ingredient_name: e.target.value })}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Substitute With"
                  value={formData.equivalent_name}
                  onChange={(e) => setFormData({ ...formData, equivalent_name: e.target.value })}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Ratio"
                  value={formData.substitution_ratio}
                  onChange={(e) => setFormData({ ...formData, substitution_ratio: e.target.value })}
                  placeholder="1:1"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Confidence %"
                  type="number"
                  value={Math.round(formData.confidence_score * 100)}
                  onChange={(e) => setFormData({
                    ...formData,
                    confidence_score: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) / 100
                  })}
                  InputProps={{ inputProps: { min: 0, max: 100 } }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Notes (optional)"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  multiline
                  rows={2}
                  placeholder="e.g., For baking only, or Let sit 5 minutes"
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.is_bidirectional}
                      onChange={(e) => setFormData({ ...formData, is_bidirectional: e.target.checked })}
                    />
                  }
                  label="Bidirectional (can substitute either way)"
                />
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  Substitution Mode
                </Typography>
                <Grid container spacing={1}>
                  <Grid item>
                    <Chip
                      label="When Available"
                      color={formData.substitution_mode === 'when_available' ? 'primary' : 'default'}
                      onClick={() => setFormData({ ...formData, substitution_mode: 'when_available' })}
                      sx={{ cursor: 'pointer' }}
                    />
                  </Grid>
                  <Grid item>
                    <Chip
                      label="Always (Hard Rule)"
                      color={formData.substitution_mode === 'always' ? 'error' : 'default'}
                      onClick={() => setFormData({ ...formData, substitution_mode: 'always' })}
                      sx={{ cursor: 'pointer' }}
                    />
                  </Grid>
                </Grid>
                <Typography variant="caption" color="text.secondary">
                  {formData.substitution_mode === 'always'
                    ? 'Always use the substitute, even if the original is available'
                    : 'Only suggest the substitute when the original is not available'}
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.is_active !== false}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    />
                  }
                  label="Active (enable this substitution)"
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSave} variant="contained" disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Container>
  )
}