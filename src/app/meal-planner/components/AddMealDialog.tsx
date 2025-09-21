'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Box,
  Typography,
  Chip,
  Autocomplete,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Avatar,
  Alert
} from '@mui/material'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { LocalizationProvider } from '@mui/x-date-pickers'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { Person, Restaurant } from '@mui/icons-material'
import { supabase } from '@/lib/supabase'

interface AddMealDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: (mealData: any) => void
  initialDate?: Date | null
  initialMealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  familyMembers: any[]
  existingMeal?: any
  currentPlanDates?: { start: Date, end: Date }
}

export default function AddMealDialog({
  open,
  onClose,
  onConfirm,
  initialDate,
  initialMealType = 'dinner',
  familyMembers,
  existingMeal,
  currentPlanDates
}: AddMealDialogProps) {
  const [mealDate, setMealDate] = useState<Date | null>(initialDate || new Date())
  const [mealType, setMealType] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>(
    existingMeal?.meal_type || initialMealType
  )
  const [selectedRecipe, setSelectedRecipe] = useState<any>(null)
  const [customMealName, setCustomMealName] = useState(existingMeal?.custom_meal_name || '')
  const [servings, setServings] = useState(existingMeal?.servings || 4)
  const [notes, setNotes] = useState(existingMeal?.notes || '')
  const [attendees, setAttendees] = useState<string[]>(existingMeal?.attendees || familyMembers.map(m => m.id))
  const [recipes, setRecipes] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [dietaryNeeds, setDietaryNeeds] = useState<string[]>([])
  const [attendancePreset, setAttendancePreset] = useState<'everyone' | 'custom'>('everyone')
  const [guests, setGuests] = useState<Array<{
    name: string
    dietaryRestrictions: string[]
  }>>([])
  const [showGuestForm, setShowGuestForm] = useState(false)
  const [newGuestName, setNewGuestName] = useState('')
  const [newGuestDiet, setNewGuestDiet] = useState<string[]>([])

  useEffect(() => {
    if (open) {
      loadRecipes()
      if (existingMeal) {
        setMealDate(new Date(existingMeal.meal_date))
        setMealType(existingMeal.meal_type)
        setCustomMealName(existingMeal.custom_meal_name || '')
        setServings(existingMeal.servings || 4)
        setNotes(existingMeal.notes || '')
        setAttendees(existingMeal.attendees || familyMembers.map(m => m.id))
        if (existingMeal.recipe_id) {
          // Load the recipe if editing
          loadRecipe(existingMeal.recipe_id)
        }
      }
    }
  }, [open, existingMeal])

  useEffect(() => {
    // Calculate dietary needs based on selected attendees
    const needs = new Set<string>()
    familyMembers
      .filter(member => attendees.includes(member.id))
      .forEach(member => {
        if (member.dietary_preferences) {
          Object.entries(member.dietary_preferences).forEach(([key, value]) => {
            if (value) needs.add(key)
          })
        }
      })
    setDietaryNeeds(Array.from(needs))
  }, [attendees, familyMembers])

  const loadRecipes = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase
          .from('recipes')
          .select('*')
          .eq('household_id', user.id)
          .order('name')

        setRecipes(data || [])
      }
    } catch (error) {
      console.error('Error loading recipes:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadRecipe = async (recipeId: string) => {
    const recipe = recipes.find(r => r.id === recipeId)
    if (recipe) {
      setSelectedRecipe(recipe)
    } else {
      // Load from database if not in list
      const { data } = await supabase
        .from('recipes')
        .select('*')
        .eq('id', recipeId)
        .single()

      if (data) {
        setSelectedRecipe(data)
      }
    }
  }

  const handleConfirm = () => {
    const mealData = {
      date: mealDate,
      mealType,
      recipeId: selectedRecipe?.id,
      customName: !selectedRecipe ? customMealName : null,
      servings,
      notes,
      attendees,
      dietaryNeeds
    }

    onConfirm(mealData)
  }

  const handleAttendeeToggle = (memberId: string) => {
    setAttendees(prev =>
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    )
    setAttendancePreset('custom')
  }

  const handleAttendancePresetChange = (preset: 'everyone' | 'custom') => {
    setAttendancePreset(preset)
    if (preset === 'everyone') {
      setAttendees(familyMembers.map(m => m.id))
    }
  }

  const handleAddGuest = () => {
    if (newGuestName.trim()) {
      setGuests(prev => [...prev, {
        name: newGuestName.trim(),
        dietaryRestrictions: newGuestDiet
      }])
      setNewGuestName('')
      setNewGuestDiet([])
      setShowGuestForm(false)
      // Update servings to account for guest
      setServings(prev => prev + 1)
    }
  }

  const handleRemoveGuest = (index: number) => {
    setGuests(prev => prev.filter((_, i) => i !== index))
    setServings(prev => Math.max(1, prev - 1))
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <Restaurant color="primary" />
            {existingMeal ? 'Edit Meal' : 'Add Meal'}
          </Box>
        </DialogTitle>

        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            {/* Date and Type Selection */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <DatePicker
                label="Meal Date"
                value={mealDate}
                onChange={setMealDate}
                minDate={currentPlanDates?.start}
                maxDate={currentPlanDates?.end}
                slotProps={{
                  textField: { fullWidth: true, size: 'small' }
                }}
              />

              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Meal Type</InputLabel>
                <Select
                  value={mealType}
                  onChange={(e) => setMealType(e.target.value as any)}
                  label="Meal Type"
                >
                  <MenuItem value="breakfast">Breakfast</MenuItem>
                  <MenuItem value="lunch">Lunch</MenuItem>
                  <MenuItem value="dinner">Dinner</MenuItem>
                  <MenuItem value="snack">Snack</MenuItem>
                </Select>
              </FormControl>
            </Box>

            {/* Who's Attending */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Who's attending this meal?
              </Typography>

              {/* Attendance Presets */}
              <FormGroup row sx={{ mb: 2 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={attendancePreset === 'everyone'}
                      onChange={() => handleAttendancePresetChange('everyone')}
                    />
                  }
                  label="Everyone home"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={attendancePreset === 'custom'}
                      onChange={() => handleAttendancePresetChange('custom')}
                    />
                  }
                  label="Custom selection"
                />
              </FormGroup>

              {/* Family Members */}
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                {familyMembers.map(member => (
                  <Chip
                    key={member.id}
                    avatar={<Avatar sx={{ width: 24, height: 24 }}>{member.name[0]}</Avatar>}
                    label={member.name}
                    onClick={() => handleAttendeeToggle(member.id)}
                    color={attendees.includes(member.id) ? 'primary' : 'default'}
                    variant={attendees.includes(member.id) ? 'filled' : 'outlined'}
                  />
                ))}
              </Box>

              {/* Guests Section */}
              <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 1, p: 2, mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Guests for this meal
                </Typography>

                {guests.length > 0 && (
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                    {guests.map((guest, index) => (
                      <Chip
                        key={index}
                        avatar={<Person sx={{ width: 16, height: 16 }} />}
                        label={`${guest.name}${guest.dietaryRestrictions.length > 0 ? ` (${guest.dietaryRestrictions.join(', ')})` : ''}`}
                        onDelete={() => handleRemoveGuest(index)}
                        color="secondary"
                        variant="outlined"
                      />
                    ))}
                  </Box>
                )}

                {showGuestForm ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <TextField
                      label="Guest Name"
                      value={newGuestName}
                      onChange={(e) => setNewGuestName(e.target.value)}
                      size="small"
                      placeholder="Enter guest name"
                    />
                    <Autocomplete
                      multiple
                      options={['vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'nut-free', 'shellfish-free']}
                      value={newGuestDiet}
                      onChange={(_, newValue) => setNewGuestDiet(newValue)}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Dietary Restrictions"
                          size="small"
                          placeholder="Select dietary restrictions"
                        />
                      )}
                      renderTags={(value, getTagProps) =>
                        value.map((option, index) => (
                          <Chip
                            label={option}
                            {...getTagProps({ index })}
                            size="small"
                            key={option}
                          />
                        ))
                      }
                    />
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        onClick={handleAddGuest}
                        variant="contained"
                        size="small"
                        disabled={!newGuestName.trim()}
                      >
                        Add Guest
                      </Button>
                      <Button
                        onClick={() => setShowGuestForm(false)}
                        size="small"
                      >
                        Cancel
                      </Button>
                    </Box>
                  </Box>
                ) : (
                  <Button
                    onClick={() => setShowGuestForm(true)}
                    variant="outlined"
                    size="small"
                    startIcon={<Person />}
                  >
                    Add Guest
                  </Button>
                )}
              </Box>

              {dietaryNeeds.length > 0 && (
                <Alert severity="info" sx={{ mt: 1 }}>
                  <Typography variant="caption">
                    Dietary needs for this meal: {dietaryNeeds.join(', ')}
                  </Typography>
                </Alert>
              )}
            </Box>

            {/* Recipe Selection or Custom Meal */}
            <Autocomplete
              options={recipes}
              getOptionLabel={(option) => option.name || ''}
              value={selectedRecipe}
              onChange={(_, newValue) => {
                setSelectedRecipe(newValue)
                if (newValue) {
                  setCustomMealName('')
                }
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Select Recipe"
                  size="small"
                  helperText="Or leave blank to enter a custom meal"
                />
              )}
              renderOption={(props, option) => (
                <Box component="li" {...props}>
                  <Box>
                    <Typography variant="body2">{option.name}</Typography>
                    {option.tags?.includes('vegetarian') && (
                      <Chip label="Vegetarian" size="small" sx={{ ml: 1 }} />
                    )}
                    {option.tags?.includes('vegan') && (
                      <Chip label="Vegan" size="small" sx={{ ml: 1 }} />
                    )}
                  </Box>
                </Box>
              )}
            />

            {!selectedRecipe && (
              <TextField
                label="Custom Meal Name"
                value={customMealName}
                onChange={(e) => setCustomMealName(e.target.value)}
                size="small"
                placeholder="e.g., Takeout Pizza, Leftovers, etc."
              />
            )}

            {/* Servings */}
            <TextField
              label="Servings"
              type="number"
              value={servings}
              onChange={(e) => setServings(parseInt(e.target.value) || 4)}
              size="small"
              inputProps={{ min: 1, max: 20 }}
            />

            {/* Notes */}
            <TextField
              label="Notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              multiline
              rows={2}
              size="small"
              placeholder="Any special notes about this meal..."
            />
          </Box>
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleConfirm}
            variant="contained"
            disabled={!mealDate || (!selectedRecipe && !customMealName) || attendees.length === 0}
          >
            {existingMeal ? 'Update' : 'Add'} Meal
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  )
}