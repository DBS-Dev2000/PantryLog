'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Container,
  Box,
  Typography,
  Button,
  Paper,
  Grid,
  Card,
  CardContent,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Alert,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  CircularProgress,
  Autocomplete
} from '@mui/material'
import {
  ArrowBack,
  Add,
  Delete,
  Save,
  Restaurant,
  LunchDining,
  FreeBreakfast,
  DinnerDining,
  Cookie,
  Edit,
  Schedule,
  CalendarMonth,
  NavigateBefore,
  NavigateNext
} from '@mui/icons-material'
import { supabase } from '@/lib/supabase'
import { format, addDays, startOfWeek, endOfWeek } from 'date-fns'

interface MealSlot {
  date: string
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  customMealName?: string
  recipeId?: string
  servings: number
  prepTime: number
  notes?: string
}

interface Recipe {
  id: string
  name: string
  prep_time_minutes?: number
  servings?: number
}

export default function ManualMealPlannerPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Plan details
  const [planName, setPlanName] = useState('')
  const [selectedWeek, setSelectedWeek] = useState(new Date())
  const [meals, setMeals] = useState<MealSlot[]>([])
  const [availableRecipes, setAvailableRecipes] = useState<Recipe[]>([])

  // Add meal dialog
  const [addMealOpen, setAddMealOpen] = useState(false)
  const [editingMeal, setEditingMeal] = useState<MealSlot | null>(null)
  const [mealDate, setMealDate] = useState('')
  const [mealType, setMealType] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>('dinner')
  const [mealName, setMealName] = useState('')
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null)
  const [servings, setServings] = useState(4)
  const [prepTime, setPrepTime] = useState(30)
  const [notes, setNotes] = useState('')

  useEffect(() => {
    loadUserRecipes()
    initializeWeek()
  }, [])

  const initializeWeek = () => {
    const weekStart = startOfWeek(selectedWeek, { weekStartsOn: 0 }) // 0 = Sunday
    const weekEnd = endOfWeek(selectedWeek, { weekStartsOn: 0 })
    setPlanName(`Week of ${format(weekStart, 'MMM d, yyyy')}`)
  }

  const loadUserRecipes = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: recipes } = await supabase
      .from('recipes')
      .select('id, name, prep_time_minutes, servings')
      .or(`household_id.eq.${user.id},is_public.eq.true`)
      .order('name')

    setAvailableRecipes(recipes || [])
  }

  const handleAddMeal = () => {
    setEditingMeal(null)
    setMealDate(format(selectedWeek, 'yyyy-MM-dd'))
    setMealType('dinner')
    setMealName('')
    setSelectedRecipe(null)
    setServings(4)
    setPrepTime(30)
    setNotes('')
    setAddMealOpen(true)
  }

  const handleEditMeal = (meal: MealSlot) => {
    setEditingMeal(meal)
    setMealDate(meal.date)
    setMealType(meal.mealType)
    setMealName(meal.customMealName || '')
    setSelectedRecipe(meal.recipeId ? availableRecipes.find(r => r.id === meal.recipeId) || null : null)
    setServings(meal.servings)
    setPrepTime(meal.prepTime)
    setNotes(meal.notes || '')
    setAddMealOpen(true)
  }

  const handleSaveMeal = () => {
    const newMeal: MealSlot = {
      date: mealDate,
      mealType,
      customMealName: selectedRecipe ? undefined : mealName,
      recipeId: selectedRecipe?.id,
      servings,
      prepTime: selectedRecipe?.prep_time_minutes || prepTime,
      notes
    }

    if (editingMeal) {
      // Update existing meal
      setMeals(meals.map(m =>
        (m.date === editingMeal.date && m.mealType === editingMeal.mealType) ? newMeal : m
      ))
    } else {
      // Add new meal
      setMeals([...meals, newMeal])
    }

    setAddMealOpen(false)
    setSuccess('Meal added to plan')
  }

  const handleDeleteMeal = (meal: MealSlot) => {
    setMeals(meals.filter(m =>
      !(m.date === meal.date && m.mealType === meal.mealType)
    ))
  }

  const handleSavePlan = async () => {
    if (!meals.length) {
      setError('Please add at least one meal to your plan')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('Please sign in to save your meal plan')
        return
      }

      // Create the meal plan
      const weekStart = startOfWeek(selectedWeek, { weekStartsOn: 0 }) // 0 = Sunday
      const weekEnd = endOfWeek(selectedWeek, { weekStartsOn: 0 })

      const { data: planData, error: planError } = await supabase
        .from('meal_plans')
        .insert({
          household_id: user.id,
          name: planName,
          start_date: format(weekStart, 'yyyy-MM-dd'),
          end_date: format(weekEnd, 'yyyy-MM-dd'),
          status: 'draft'
        })
        .select()
        .single()

      if (planError) throw planError

      // Create the planned meals
      const plannedMeals = meals.map(meal => ({
        meal_plan_id: planData.id,
        recipe_id: meal.recipeId || null,
        custom_meal_name: meal.customMealName || null,
        meal_date: meal.date,
        meal_type: meal.mealType,
        servings: meal.servings,
        prep_time: meal.prepTime,
        notes: meal.notes || null,
        is_leftover_meal: false
      }))

      const { error: mealsError } = await supabase
        .from('planned_meals')
        .insert(plannedMeals)

      if (mealsError) throw mealsError

      setSuccess('Meal plan saved successfully!')

      // Navigate back to meal planner
      setTimeout(() => {
        router.push('/meal-planner')
      }, 2000)

    } catch (err: any) {
      console.error('Error saving meal plan:', err)
      setError(err.message || 'Failed to save meal plan')
    } finally {
      setSaving(false)
    }
  }

  const getMealIcon = (type: string) => {
    switch (type) {
      case 'breakfast': return <FreeBreakfast />
      case 'lunch': return <LunchDining />
      case 'dinner': return <DinnerDining />
      case 'snack': return <Cookie />
      default: return <Restaurant />
    }
  }

  const getDaysInWeek = () => {
    const weekStart = startOfWeek(selectedWeek, { weekStartsOn: 0 }) // 0 = Sunday
    const days = []
    for (let i = 0; i < 7; i++) {
      days.push(addDays(weekStart, i))
    }
    return days
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <IconButton onClick={() => router.push('/meal-planner')}>
          <ArrowBack />
        </IconButton>
        <Typography variant="h4" sx={{ flexGrow: 1 }}>
          Create Manual Meal Plan
        </Typography>
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

      {/* Plan Details */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <TextField
              label="Plan Name"
              fullWidth
              value={planName}
              onChange={(e) => setPlanName(e.target.value)}
              placeholder="e.g., Week of Jan 20, 2025"
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Select Week
              </Typography>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <IconButton
                  onClick={() => {
                    setSelectedWeek(prev => addDays(prev, -7))
                    setTimeout(initializeWeek, 0)
                  }}
                >
                  <NavigateBefore />
                </IconButton>
                <Box textAlign="center" sx={{ minWidth: 200 }}>
                  <Typography variant="h6">
                    {format(startOfWeek(selectedWeek, { weekStartsOn: 0 }), 'MMM d')} -
                    {' '}{format(endOfWeek(selectedWeek, { weekStartsOn: 0 }), 'MMM d, yyyy')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Sunday to Saturday
                  </Typography>
                </Box>
                <IconButton
                  onClick={() => {
                    setSelectedWeek(prev => addDays(prev, 7))
                    setTimeout(initializeWeek, 0)
                  }}
                >
                  <NavigateNext />
                </IconButton>
              </Box>
              <Box textAlign="center" mt={1}>
                <Button
                  size="small"
                  onClick={() => {
                    setSelectedWeek(new Date())
                    setTimeout(initializeWeek, 0)
                  }}
                >
                  Current Week
                </Button>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </Paper>

      {/* Week View */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">
            <CalendarMonth sx={{ mr: 1, verticalAlign: 'middle' }} />
            Meals for the Week
          </Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={handleAddMeal}
          >
            Add Meal
          </Button>
        </Box>

        <Grid container spacing={2}>
          {getDaysInWeek().map((day) => {
            const dateStr = format(day, 'yyyy-MM-dd')
            const dayMeals = meals.filter(m => m.date === dateStr)

            return (
              <Grid item xs={12} md={6} lg={4} key={dateStr}>
                <Card sx={{ height: '100%' }}>
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                      {format(day, 'EEEE')}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" gutterBottom>
                      {format(day, 'MMM d')}
                    </Typography>

                    <List dense>
                      {dayMeals.length === 0 ? (
                        <ListItem>
                          <ListItemText
                            primary={
                              <Typography variant="body2" color="text.secondary" fontStyle="italic">
                                No meals planned
                              </Typography>
                            }
                          />
                        </ListItem>
                      ) : (
                        dayMeals.sort((a, b) => {
                          const order = { breakfast: 0, lunch: 1, dinner: 2, snack: 3 }
                          return (order[a.mealType] || 4) - (order[b.mealType] || 4)
                        }).map((meal, idx) => (
                          <ListItem key={idx}>
                            <Box display="flex" alignItems="center" gap={1} width="100%">
                              {getMealIcon(meal.mealType)}
                              <ListItemText
                                primary={meal.customMealName || availableRecipes.find(r => r.id === meal.recipeId)?.name}
                                secondary={
                                  <Box display="flex" gap={1} alignItems="center">
                                    <Chip label={meal.mealType} size="small" />
                                    <Typography variant="caption">
                                      {meal.servings} servings • {meal.prepTime} min
                                    </Typography>
                                  </Box>
                                }
                              />
                              <ListItemSecondaryAction>
                                <IconButton size="small" onClick={() => handleEditMeal(meal)}>
                                  <Edit fontSize="small" />
                                </IconButton>
                                <IconButton size="small" onClick={() => handleDeleteMeal(meal)}>
                                  <Delete fontSize="small" />
                                </IconButton>
                              </ListItemSecondaryAction>
                            </Box>
                          </ListItem>
                        ))
                      )}
                    </List>
                  </CardContent>
                </Card>
              </Grid>
            )
          })}
        </Grid>

        <Box display="flex" justifyContent="space-between" mt={3}>
          <Box>
            <Typography variant="body2" color="text.secondary">
              Total meals planned: {meals.length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Total prep time: {meals.reduce((sum, m) => sum + m.prepTime, 0)} minutes
            </Typography>
          </Box>
          <Box display="flex" gap={2}>
            <Button
              variant="outlined"
              onClick={() => router.push('/meal-planner')}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              startIcon={saving ? <CircularProgress size={20} /> : <Save />}
              onClick={handleSavePlan}
              disabled={saving || meals.length === 0}
            >
              {saving ? 'Saving...' : 'Save Meal Plan'}
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* Add/Edit Meal Dialog */}
      <Dialog open={addMealOpen} onClose={() => setAddMealOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingMeal ? 'Edit Meal' : 'Add Meal'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                type="date"
                label="Date"
                fullWidth
                value={mealDate}
                onChange={(e) => setMealDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Meal Type</InputLabel>
                <Select
                  value={mealType}
                  label="Meal Type"
                  onChange={(e) => setMealType(e.target.value as any)}
                >
                  <MenuItem value="breakfast">Breakfast</MenuItem>
                  <MenuItem value="lunch">Lunch</MenuItem>
                  <MenuItem value="dinner">Dinner</MenuItem>
                  <MenuItem value="snack">Snack</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                Choose meal option:
              </Typography>
              <Autocomplete
                options={availableRecipes}
                getOptionLabel={(option) => option.name}
                value={selectedRecipe}
                onChange={(_, value) => {
                  setSelectedRecipe(value)
                  if (value) {
                    setMealName('')
                    if (value.prep_time_minutes) setPrepTime(value.prep_time_minutes)
                    if (value.servings) setServings(value.servings)
                  }
                }}
                renderInput={(params) => (
                  <TextField {...params} label="Select from recipes" placeholder="Type to search..." />
                )}
              />

              <Typography variant="body2" sx={{ my: 2, textAlign: 'center' }}>
                OR
              </Typography>

              <TextField
                label="Custom meal name"
                fullWidth
                value={mealName}
                onChange={(e) => {
                  setMealName(e.target.value)
                  if (e.target.value) setSelectedRecipe(null)
                }}
                placeholder="e.g., Spaghetti Bolognese"
                disabled={!!selectedRecipe}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                type="number"
                label="Servings"
                fullWidth
                value={servings}
                onChange={(e) => setServings(parseInt(e.target.value) || 4)}
                inputProps={{ min: 1 }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                type="number"
                label="Prep Time (minutes)"
                fullWidth
                value={prepTime}
                onChange={(e) => setPrepTime(parseInt(e.target.value) || 30)}
                inputProps={{ min: 1 }}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="Notes (optional)"
                fullWidth
                multiline
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g., Use leftovers from Tuesday"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddMealOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveMeal}
            disabled={!mealDate || (!selectedRecipe && !mealName)}
          >
            {editingMeal ? 'Update' : 'Add'} Meal
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}