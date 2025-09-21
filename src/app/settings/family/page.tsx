'use client'

import { useState, useEffect } from 'react'
import {
  Container,
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  FormControlLabel,
  Checkbox,
  Autocomplete,
  Divider,
  Tooltip
} from '@mui/material'
import {
  Add,
  Edit,
  Delete,
  Person,
  Restaurant,
  Save,
  Cancel,
  FamilyRestroom,
  NoMeals,
  SetMeal
} from '@mui/icons-material'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'

interface FamilyMember {
  id: string
  household_id: string
  name: string
  birth_date?: string
  age_group?: string
  is_primary_meal_planner: boolean
  dietary_restrictions?: string[]
  food_allergies?: string[]
  preferred_cuisines?: string[]
  disliked_ingredients?: string[]
  can_edit_recipes?: boolean
  can_delete_items?: boolean
  can_manage_shopping?: boolean
  is_child?: boolean
  role?: string
}

interface DietaryRestriction {
  id: string
  name: string
  display_name: string
  restriction_type: string
  description: string
}

const AGE_GROUPS = ['infant', 'toddler', 'child', 'teen', 'adult', 'senior']

const CUISINE_OPTIONS = [
  'American', 'Italian', 'Mexican', 'Chinese', 'Japanese', 'Thai',
  'Indian', 'Mediterranean', 'French', 'Greek', 'Korean', 'Vietnamese',
  'BBQ', 'Comfort Food', 'Healthy', 'Soul Food'
]

const COMMON_ALLERGENS = [
  'Milk', 'Eggs', 'Fish', 'Shellfish', 'Tree nuts', 'Peanuts',
  'Wheat', 'Soybeans', 'Sesame'
]

export default function FamilyMembersPage() {
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [dietaryRestrictions, setDietaryRestrictions] = useState<DietaryRestriction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    birth_date: '',
    age_group: 'adult',
    is_primary_meal_planner: false,
    dietary_restrictions: [] as string[],
    food_allergies: [] as string[],
    preferred_cuisines: [] as string[],
    disliked_ingredients: [] as string[],
    can_edit_recipes: true,
    can_delete_items: true,
    can_manage_shopping: true,
    is_child: false,
    role: 'member'
  })

  useEffect(() => {
    loadFamilyMembers()
    loadDietaryRestrictions()
  }, [])

  const loadFamilyMembers = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('family_members')
        .select('*')
        .eq('household_id', user.id)
        .order('created_at')

      if (error) throw error

      setMembers(data || [])
    } catch (err: any) {
      console.error('Error loading family members:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadDietaryRestrictions = async () => {
    try {
      const { data, error } = await supabase
        .from('dietary_restrictions')
        .select('*')
        .eq('is_active', true)
        .order('display_name')

      if (error) throw error

      setDietaryRestrictions(data || [])
    } catch (err: any) {
      console.error('Error loading dietary restrictions:', err)
    }
  }

  const handleOpenDialog = (member?: FamilyMember) => {
    if (member) {
      setEditingMember(member)
      setFormData({
        name: member.name,
        birth_date: member.birth_date || '',
        age_group: member.age_group || 'adult',
        is_primary_meal_planner: member.is_primary_meal_planner,
        dietary_restrictions: member.dietary_restrictions || [],
        food_allergies: member.food_allergies || [],
        preferred_cuisines: member.preferred_cuisines || [],
        disliked_ingredients: member.disliked_ingredients || [],
        can_edit_recipes: member.can_edit_recipes !== false,
        can_delete_items: member.can_delete_items !== false,
        can_manage_shopping: member.can_manage_shopping !== false,
        is_child: member.is_child || false,
        role: member.role || 'member'
      })
    } else {
      setEditingMember(null)
      setFormData({
        name: '',
        birth_date: '',
        age_group: 'adult',
        is_primary_meal_planner: false,
        dietary_restrictions: [],
        food_allergies: [],
        preferred_cuisines: [],
        disliked_ingredients: [],
        can_edit_recipes: true,
        can_delete_items: true,
        can_manage_shopping: true,
        is_child: false,
        role: 'member'
      })
    }
    setDialogOpen(true)
  }

  const handleSaveMember = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const memberData = {
        household_id: user.id,
        ...formData,
        birth_date: formData.birth_date || null
      }

      if (editingMember) {
        // Update existing member
        const { error } = await supabase
          .from('family_members')
          .update(memberData)
          .eq('id', editingMember.id)

        if (error) throw error
        setSuccess('Family member updated successfully!')
      } else {
        // Create new member
        const { error } = await supabase
          .from('family_members')
          .insert(memberData)

        if (error) throw error
        setSuccess('Family member added successfully!')
      }

      await loadFamilyMembers()
      setDialogOpen(false)
    } catch (err: any) {
      console.error('Error saving family member:', err)
      setError(err.message)
    }
  }

  const handleDeleteMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this family member?')) return

    try {
      const { error } = await supabase
        .from('family_members')
        .delete()
        .eq('id', memberId)

      if (error) throw error

      setSuccess('Family member removed successfully!')
      await loadFamilyMembers()
    } catch (err: any) {
      console.error('Error deleting family member:', err)
      setError(err.message)
    }
  }

  const getDietaryRestrictionColor = (type: string) => {
    switch (type) {
      case 'lifestyle': return 'primary'
      case 'medical': return 'error'
      case 'allergy': return 'warning'
      case 'religious': return 'secondary'
      default: return 'default'
    }
  }

  if (loading) return <Box>Loading...</Box>

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">
          <FamilyRestroom sx={{ mr: 1, verticalAlign: 'middle' }} />
          Family Members
        </Typography>

        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => handleOpenDialog()}
        >
          Add Family Member
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Grid container spacing={3}>
        {members.map(member => (
          <Grid item xs={12} md={6} lg={4} key={member.id}>
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Avatar>
                      <Person />
                    </Avatar>
                    <Box>
                      <Typography variant="h6">{member.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {member.role && member.role !== 'member' && `${member.role.charAt(0).toUpperCase() + member.role.slice(1)} • `}
                        {member.age_group && `${member.age_group.charAt(0).toUpperCase() + member.age_group.slice(1)}`}
                        {member.birth_date && ` • ${format(new Date(member.birth_date), 'MMM d, yyyy')}`}
                      </Typography>
                      <Box display="flex" gap={0.5} flexWrap="wrap" mt={0.5}>
                        {member.is_primary_meal_planner && (
                          <Chip
                            size="small"
                            label="Meal Planner"
                            color="primary"
                          />
                        )}
                        {member.is_child && (
                          <Chip
                            size="small"
                            label="Child Account"
                            color="secondary"
                          />
                        )}
                        {member.role === 'admin' && (
                          <Chip
                            size="small"
                            label="Admin"
                            color="success"
                          />
                        )}
                      </Box>
                    </Box>
                  </Box>

                  <Box>
                    <IconButton size="small" onClick={() => handleOpenDialog(member)}>
                      <Edit />
                    </IconButton>
                    <IconButton size="small" onClick={() => handleDeleteMember(member.id)} color="error">
                      <Delete />
                    </IconButton>
                  </Box>
                </Box>

                {/* Dietary Restrictions */}
                {member.dietary_restrictions && member.dietary_restrictions.length > 0 && (
                  <Box mb={2}>
                    <Typography variant="subtitle2" gutterBottom>
                      Dietary Restrictions
                    </Typography>
                    <Box display="flex" gap={0.5} flexWrap="wrap">
                      {member.dietary_restrictions.map(restriction => {
                        const diet = dietaryRestrictions.find(d => d.name === restriction)
                        return (
                          <Chip
                            key={restriction}
                            size="small"
                            label={diet?.display_name || restriction}
                            color={diet ? getDietaryRestrictionColor(diet.restriction_type) : 'default'}
                          />
                        )
                      })}
                    </Box>
                  </Box>
                )}

                {/* Allergies */}
                {member.food_allergies && member.food_allergies.length > 0 && (
                  <Box mb={2}>
                    <Typography variant="subtitle2" gutterBottom>
                      Allergies
                    </Typography>
                    <Box display="flex" gap={0.5} flexWrap="wrap">
                      {member.food_allergies.map(allergy => (
                        <Chip
                          key={allergy}
                          size="small"
                          label={allergy}
                          color="warning"
                          variant="outlined"
                        />
                      ))}
                    </Box>
                  </Box>
                )}

                {/* Preferred Cuisines */}
                {member.preferred_cuisines && member.preferred_cuisines.length > 0 && (
                  <Box mb={2}>
                    <Typography variant="subtitle2" gutterBottom>
                      Preferred Cuisines
                    </Typography>
                    <Box display="flex" gap={0.5} flexWrap="wrap">
                      {member.preferred_cuisines.map(cuisine => (
                        <Chip
                          key={cuisine}
                          size="small"
                          label={cuisine}
                          variant="outlined"
                          color="success"
                        />
                      ))}
                    </Box>
                  </Box>
                )}

                {/* Disliked Ingredients */}
                {member.disliked_ingredients && member.disliked_ingredients.length > 0 && (
                  <Box mb={2}>
                    <Typography variant="subtitle2" gutterBottom>
                      Dislikes
                    </Typography>
                    <Box display="flex" gap={0.5} flexWrap="wrap">
                      {member.disliked_ingredients.map(ingredient => (
                        <Chip
                          key={ingredient}
                          size="small"
                          label={ingredient}
                          variant="outlined"
                          color="error"
                        />
                      ))}
                    </Box>
                  </Box>
                )}

                {/* Permissions */}
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Permissions
                  </Typography>
                  <Box display="flex" gap={0.5} flexWrap="wrap">
                    {member.can_edit_recipes !== false && (
                      <Chip size="small" label="Can Edit Recipes" variant="outlined" />
                    )}
                    {member.can_delete_items !== false && (
                      <Chip size="small" label="Can Delete Items" variant="outlined" />
                    )}
                    {member.can_manage_shopping !== false && (
                      <Chip size="small" label="Can Manage Shopping" variant="outlined" />
                    )}
                    {member.can_edit_recipes === false && member.can_delete_items === false && (
                      <Chip size="small" label="View Only" variant="outlined" color="warning" />
                    )}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingMember ? 'Edit Family Member' : 'Add Family Member'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Birth Date"
                type="date"
                value={formData.birth_date}
                onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Age Group</InputLabel>
                <Select
                  value={formData.age_group}
                  label="Age Group"
                  onChange={(e) => setFormData({ ...formData, age_group: e.target.value })}
                >
                  {AGE_GROUPS.map(group => (
                    <MenuItem key={group} value={group}>
                      {group.charAt(0).toUpperCase() + group.slice(1)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.is_primary_meal_planner}
                    onChange={(e) => setFormData({ ...formData, is_primary_meal_planner: e.target.checked })}
                  />
                }
                label="Primary Meal Planner"
              />
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                Permissions
              </Typography>
            </Grid>

            <Grid item xs={12} sm={4}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.can_edit_recipes !== false}
                    onChange={(e) => setFormData({ ...formData, can_edit_recipes: e.target.checked })}
                  />
                }
                label="Can Edit Recipes"
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.can_delete_items !== false}
                    onChange={(e) => setFormData({ ...formData, can_delete_items: e.target.checked })}
                  />
                }
                label="Can Delete Items"
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.can_manage_shopping !== false}
                    onChange={(e) => setFormData({ ...formData, can_manage_shopping: e.target.checked })}
                  />
                }
                label="Can Manage Shopping"
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Member Role</InputLabel>
                <Select
                  value={formData.role || 'member'}
                  label="Member Role"
                  onChange={(e) => {
                    const role = e.target.value
                    setFormData({
                      ...formData,
                      role,
                      // Auto-set permissions based on role
                      is_child: role === 'child',
                      can_edit_recipes: role !== 'child',
                      can_delete_items: role !== 'child' && role !== 'guest',
                      can_manage_shopping: role !== 'child' && role !== 'guest'
                    })
                  }}
                >
                  <MenuItem value="admin">Admin</MenuItem>
                  <MenuItem value="adult">Adult</MenuItem>
                  <MenuItem value="teen">Teen</MenuItem>
                  <MenuItem value="child">Child</MenuItem>
                  <MenuItem value="guest">Guest</MenuItem>
                  <MenuItem value="member">Member</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.is_child || false}
                    onChange={(e) => {
                      const isChild = e.target.checked
                      setFormData({
                        ...formData,
                        is_child: isChild,
                        // If marking as child, restrict permissions
                        can_edit_recipes: isChild ? false : formData.can_edit_recipes,
                        can_delete_items: isChild ? false : formData.can_delete_items,
                        can_manage_shopping: isChild ? false : formData.can_manage_shopping,
                        role: isChild ? 'child' : formData.role
                      })
                    }}
                  />
                }
                label="Is Child (Restricts Permissions)"
              />
            </Grid>

            <Grid item xs={12}>
              <Autocomplete
                multiple
                options={dietaryRestrictions}
                getOptionLabel={(option) => option.display_name}
                value={dietaryRestrictions.filter(d => formData.dietary_restrictions.includes(d.name))}
                onChange={(e, value) => {
                  setFormData({ ...formData, dietary_restrictions: value.map(v => v.name) })
                }}
                renderInput={(params) => (
                  <TextField {...params} label="Dietary Restrictions" />
                )}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      {...getTagProps({ index })}
                      label={option.display_name}
                      color={getDietaryRestrictionColor(option.restriction_type)}
                      size="small"
                    />
                  ))
                }
              />
            </Grid>

            <Grid item xs={12}>
              <Autocomplete
                multiple
                freeSolo
                options={COMMON_ALLERGENS}
                value={formData.food_allergies}
                onChange={(e, value) => setFormData({ ...formData, food_allergies: value })}
                renderInput={(params) => (
                  <TextField {...params} label="Food Allergies" placeholder="Type and press Enter" />
                )}
              />
            </Grid>

            <Grid item xs={12}>
              <Autocomplete
                multiple
                options={CUISINE_OPTIONS}
                value={formData.preferred_cuisines}
                onChange={(e, value) => setFormData({ ...formData, preferred_cuisines: value })}
                renderInput={(params) => (
                  <TextField {...params} label="Preferred Cuisines" />
                )}
              />
            </Grid>

            <Grid item xs={12}>
              <Autocomplete
                multiple
                freeSolo
                options={[]}
                value={formData.disliked_ingredients}
                onChange={(e, value) => setFormData({ ...formData, disliked_ingredients: value })}
                renderInput={(params) => (
                  <TextField {...params} label="Disliked Ingredients" placeholder="Type and press Enter" />
                )}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveMember} variant="contained" disabled={!formData.name}>
            {editingMember ? 'Update' : 'Add'} Member
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}