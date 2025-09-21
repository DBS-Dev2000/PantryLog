'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getUserHouseholdFeatures } from '@/lib/features'
import MealPlanPreview from './components/MealPlanPreview'
import {
  Box,
  Container,
  Typography,
  Button,
  Paper,
  Grid,
  Card,
  CardContent,
  CardActions,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Tooltip,
  Fab,
  Divider
} from '@mui/material'
import {
  CalendarMonth,
  Restaurant,
  ShoppingCart,
  Add,
  Edit,
  Delete,
  CheckCircle,
  Schedule,
  Person,
  LocalDining,
  Refresh,
  Settings,
  Star,
  StarBorder,
  ContentCopy,
  Print,
  Share,
  AutoAwesome,
  Inventory,
  MenuBook,
  TravelExplore,
  RadioButtonUnchecked,
  RadioButtonChecked,
  NavigateBefore,
  NavigateNext
} from '@mui/icons-material'
import { supabase } from '@/lib/supabase'
import { format, startOfWeek, endOfWeek, addDays } from 'date-fns'

interface MealPlan {
  id: string
  name: string
  start_date: string
  end_date: string
  status: 'draft' | 'active' | 'completed' | 'archived'
  total_cost?: number
  total_prep_time?: number
  shopping_list_generated: boolean
}

interface PlannedMeal {
  id: string
  meal_plan_id: string
  recipe_id?: string
  recipe?: any
  custom_meal_name?: string
  meal_date: string
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  servings: number
  prep_time?: number
  cook_time?: number
  notes?: string
  is_leftover_meal: boolean
  completed: boolean
  rating?: number
}

export default function MealPlannerPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [plans, setPlans] = useState<MealPlan[]>([])
  const [currentPlan, setCurrentPlan] = useState<MealPlan | null>(null)
  const [plannedMeals, setPlannedMeals] = useState<PlannedMeal[]>([])
  const [tabValue, setTabValue] = useState(0)
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false)
  const [selectedWeek, setSelectedWeek] = useState(new Date())
  const [generating, setGenerating] = useState(false)
  const [hasProfile, setHasProfile] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [generationStrategy, setGenerationStrategy] = useState<'auto' | 'pantry' | 'recipes' | 'discover'>('auto')
  const [generationOptions, setGenerationOptions] = useState({
    preferNewRecipes: false,
    useSeasonalIngredients: true,
    budgetConscious: false,
    quickMealsOnly: false,
    includeLefotovers: true
  })
  const [previewMeals, setPreviewMeals] = useState<any[]>([])
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false)

  useEffect(() => {
    checkProfileAndLoadPlans()
  }, [])

  const checkProfileAndLoadPlans = async () => {

    try {
      // Check if household has completed setup
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth')
        return
      }

      // Check if meal planning is enabled for this household
      const features = await getUserHouseholdFeatures(user.id)
      if (!features.meal_planner_enabled) {
        // Redirect back to home with a message
        router.push('/?feature=meal_planner_disabled')
        return
      }

      const { data: household } = await supabase
        .from('households')
        .select('id')
        .eq('id', user.id)
        .single()

      if (!household) {
        router.push('/meal-planner/setup')
        return
      }

      // Check if profile is complete
      const { data: members } = await supabase
        .from('family_members')
        .select('id')
        .eq('household_id', household.id)
        .limit(1)

      if (!members || members.length === 0) {
        router.push('/meal-planner/setup')
        return
      }

      setHasProfile(true)

      // Load existing meal plans
      const { data: plansData } = await supabase
        .from('meal_plans')
        .select('*')
        .eq('household_id', household.id)
        .order('start_date', { ascending: false })

      setPlans(plansData || [])

      // Load most recent plan (active or draft)
      const recentPlan = plansData?.find(p => p.status === 'active') || plansData?.[0]
      if (recentPlan) {
        setCurrentPlan(recentPlan)
        loadPlannedMeals(recentPlan.id)
      }

      setLoading(false)
    } catch (error) {
      console.error('Error loading meal plans:', error)
      setLoading(false)
    }
  }

  const loadPlannedMeals = async (planId: string) => {
  
    const { data } = await supabase
      .from('planned_meals')
      .select(`
        *,
        recipe:recipes(*)
      `)
      .eq('meal_plan_id', planId)
      .order('meal_date', { ascending: true })

    setPlannedMeals(data || [])
  }

  const handleGeneratePlan = async () => {
    console.log('Generate plan clicked')
    setGenerating(true)
    setError('')
    setSuccess('')

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        console.error('Auth error:', authError)
        setError('Please sign in to generate a meal plan')
        setGenerating(false)
        return
      }

      console.log('Got user:', user.id)

      const weekStart = startOfWeek(selectedWeek, { weekStartsOn: 0 }) // 0 = Sunday
      const weekEnd = endOfWeek(selectedWeek, { weekStartsOn: 0 })
      console.log('Generating for dates:', format(weekStart, 'yyyy-MM-dd'), 'to', format(weekEnd, 'yyyy-MM-dd'))

      const requestBody = {
        householdId: user.id,
        startDate: format(weekStart, 'yyyy-MM-dd'),
        endDate: format(weekEnd, 'yyyy-MM-dd'),
        strategy: generationStrategy,
        options: generationOptions,
        usePastMeals: generationStrategy !== 'discover',
        includeStaples: true,
        previewOnly: true // Request preview mode
      }
      console.log('Sending request:', requestBody)

      // Get the session token for authentication
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const response = await fetch('/api/meal-planner/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify(requestBody)
      })

      console.log('Response status:', response.status)

      if (!response.ok) {
        const errorData = await response.json()
        console.error('API Error:', errorData)
        setError(`Failed to generate meal plan: ${errorData.error || 'Unknown error'}`)
        return
      }

      const result = await response.json()
      console.log('Generation result:', result)

      if (result.success && result.preview) {
        // Show preview dialog with generated meals
        setPreviewMeals(result.meals || [])
        setGenerateDialogOpen(false)
        setPreviewDialogOpen(true)
      } else if (result.success) {
        await checkProfileAndLoadPlans()
        setGenerateDialogOpen(false)
        setSuccess('Meal plan generated successfully!')

        // Load the newly generated plan
        if (result.planId) {
          // Reload plans to get the new one
          await checkProfileAndLoadPlans()
          const newPlan = plans.find(p => p.id === result.planId)
          if (newPlan) {
            setCurrentPlan(newPlan)
            await loadPlannedMeals(newPlan.id)
          }
        }
      } else {
        setError(result.error || 'Failed to generate meal plan')
      }
    } catch (error: any) {
      console.error('Error generating meal plan:', error)
      setError(error.message || 'Failed to generate meal plan')
    } finally {
      setGenerating(false)
    }
  }

  const handleMarkComplete = async (mealId: string) => {
  
    const { error } = await supabase
      .from('planned_meals')
      .update({ completed: true })
      .eq('id', mealId)

    if (!error && currentPlan) {
      loadPlannedMeals(currentPlan.id)
    }
  }

  const handleRateMeal = async (mealId: string, rating: number) => {
  
    const meal = plannedMeals.find(m => m.id === mealId)
    if (!meal) return

    // Update the planned meal rating
    await supabase
      .from('planned_meals')
      .update({ rating })
      .eq('id', mealId)

    // Add to meal history for future planning
    const { data: { user } } = await supabase.auth.getUser()
    if (user && meal.recipe_id) {
      await supabase
        .from('meal_history')
        .insert({
          household_id: user.id,
          recipe_id: meal.recipe_id,
          meal_name: meal.recipe?.name || meal.custom_meal_name,
          served_date: meal.meal_date,
          meal_type: meal.meal_type,
          servings: meal.servings,
          rating,
          would_make_again: rating >= 4
        })
    }

    if (currentPlan) {
      loadPlannedMeals(currentPlan.id)
    }
  }

  const handleToggleStaple = async (mealId: string) => {
      const meal = plannedMeals.find(m => m.id === mealId)
    if (!meal || !meal.recipe_id) return

    // Toggle staple tag on the recipe
    const { data: recipe } = await supabase
      .from('recipes')
      .select('tags')
      .eq('id', meal.recipe_id)
      .single()

    const tags = recipe?.tags || []
    const isStaple = tags.includes('staple')

    const newTags = isStaple
      ? tags.filter((t: string) => t !== 'staple')
      : [...tags, 'staple']

    await supabase
      .from('recipes')
      .update({ tags: newTags })
      .eq('id', meal.recipe_id)

    if (currentPlan) {
      loadPlannedMeals(currentPlan.id)
    }
  }

  const handleConfirmMealPlan = async (confirmedMeals: any[], mealTypes: any) => {
    setPreviewDialogOpen(false)
    setGenerating(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('Please sign in to save meal plan')
        return
      }

      const weekStart = startOfWeek(selectedWeek, { weekStartsOn: 0 })
      const weekEnd = endOfWeek(selectedWeek, { weekStartsOn: 0 })

      // Send confirmed meals to save
      const requestBody = {
        householdId: user.id,
        startDate: format(weekStart, 'yyyy-MM-dd'),
        endDate: format(weekEnd, 'yyyy-MM-dd'),
        strategy: generationStrategy,
        options: generationOptions,
        confirmMeals: confirmedMeals,
        previewOnly: false
      }

      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const response = await fetch('/api/meal-planner/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const errorData = await response.json()
        setError(`Failed to save meal plan: ${errorData.error || 'Unknown error'}`)
        return
      }

      const result = await response.json()
      if (result.success && result.planId) {
        setSuccess('Meal plan saved successfully!')

        // Reload all plans
        const { data: { user: currentUser } } = await supabase.auth.getUser()
        if (currentUser) {
          const { data: newPlans } = await supabase
            .from('meal_plans')
            .select('*')
            .eq('household_id', currentUser.id)
            .order('start_date', { ascending: false })

          if (newPlans && newPlans.length > 0) {
            setPlans(newPlans)
            const newPlan = newPlans.find(p => p.id === result.planId)
            if (newPlan) {
              setCurrentPlan(newPlan)
              await loadPlannedMeals(newPlan.id)
            }
          }
        }
      }
    } catch (error: any) {
      console.error('Error saving meal plan:', error)
      setError(error.message || 'Failed to save meal plan')
    } finally {
      setGenerating(false)
    }
  }

  const handleRegenerateMeals = async (missingDays: string[], mealTypes: any) => {
    // Generate additional meals for missing slots
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []

      // Parse missing days to determine what needs to be generated
      const mealsNeeded = missingDays.map(dayMeal => {
        const [date, mealType] = dayMeal.split('-')
        return { date, mealType }
      })

      // For now, return dummy meals - this would call the API
      return mealsNeeded.map(({ date, mealType }) => ({
        date,
        mealType: mealType as any,
        customMealName: `Additional ${mealType}`,
        servings: 4,
        prepTime: 30,
        accepted: true
      }))
    } catch (error) {
      console.error('Error regenerating meals:', error)
      return []
    }
  }

  const getMealsByDay = () => {
    const mealsByDay: Record<string, PlannedMeal[]> = {}

    plannedMeals.forEach(meal => {
      if (!mealsByDay[meal.meal_date]) {
        mealsByDay[meal.meal_date] = []
      }
      mealsByDay[meal.meal_date].push(meal)
    })

    return mealsByDay
  }

  const renderWeekView = () => {
    const mealsByDay = getMealsByDay()
    const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

    if (!currentPlan) {
      return (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="h6" gutterBottom>
            No active meal plan
          </Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setGenerateDialogOpen(true)}
            sx={{ mt: 2 }}
          >
            Generate New Plan
          </Button>
        </Box>
      )
    }

    const startDate = new Date(currentPlan.start_date)

    return (
      <Grid container spacing={2}>
        {weekDays.map((day, index) => {
          const date = addDays(startDate, index)
          const dateStr = format(date, 'yyyy-MM-dd')
          const meals = mealsByDay[dateStr] || []

          return (
            <Grid item xs={12} md={6} lg={3} key={day}>
              <Paper elevation={2} sx={{ p: 2, height: '100%' }}>
                <Typography variant="h6" gutterBottom>
                  {day}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {format(date, 'MMM d')}
                </Typography>

                <List dense sx={{ mt: 1 }}>
                  {['breakfast', 'lunch', 'dinner', 'snack'].map(mealType => {
                    const meal = meals.find(m => m.meal_type === mealType)
                    if (!meal) return null

                    return (
                      <ListItem key={meal.id} sx={{ pl: 0 }}>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Chip
                                size="small"
                                label={mealType}
                                color={
                                  mealType === 'breakfast' ? 'warning' :
                                  mealType === 'lunch' ? 'info' :
                                  mealType === 'dinner' ? 'success' : 'default'
                                }
                              />
                              {meal.completed && <CheckCircle color="success" fontSize="small" />}
                            </Box>
                          }
                          secondary={
                            <Box>
                              <Typography variant="body2">
                                {meal.recipe?.name || meal.custom_meal_name}
                              </Typography>
                              {meal.prep_time && (
                                <Typography variant="caption" color="text.secondary">
                                  <Schedule fontSize="small" sx={{ fontSize: 12, mr: 0.5 }} />
                                  {meal.prep_time} min
                                </Typography>
                              )}
                            </Box>
                          }
                        />
                        <ListItemSecondaryAction>
                          <Tooltip title={meal.recipe?.tags?.includes('staple') ? 'Remove from staples' : 'Mark as staple'}>
                            <IconButton
                              size="small"
                              onClick={() => handleToggleStaple(meal.id)}
                            >
                              {meal.recipe?.tags?.includes('staple') ? <Star /> : <StarBorder />}
                            </IconButton>
                          </Tooltip>
                        </ListItemSecondaryAction>
                      </ListItem>
                    )
                  })}
                </List>
              </Paper>
            </Grid>
          )
        })}
      </Grid>
    )
  }

  const renderListView = () => {
    const mealsByDay = getMealsByDay()

    return (
      <Box>
        {Object.entries(mealsByDay).map(([date, meals]) => (
          <Paper key={date} elevation={1} sx={{ mb: 2, p: 2 }}>
            <Typography variant="h6" gutterBottom>
              {format(new Date(date), 'EEEE, MMMM d')}
            </Typography>

            <Grid container spacing={2}>
              {meals.map(meal => (
                <Grid item xs={12} md={6} lg={3} key={meal.id}>
                  <Card variant="outlined">
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Chip
                          size="small"
                          label={meal.meal_type}
                          color={
                            meal.meal_type === 'breakfast' ? 'warning' :
                            meal.meal_type === 'lunch' ? 'info' :
                            meal.meal_type === 'dinner' ? 'success' : 'default'
                          }
                        />
                        {meal.completed && <CheckCircle color="success" />}
                      </Box>

                      <Typography variant="subtitle1">
                        {meal.recipe?.name || meal.custom_meal_name}
                      </Typography>

                      {meal.prep_time && (
                        <Typography variant="caption" color="text.secondary">
                          Prep: {meal.prep_time} min
                        </Typography>
                      )}

                      {meal.is_leftover_meal && (
                        <Chip label="Leftover" size="small" sx={{ mt: 1 }} />
                      )}

                      <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                        {[1, 2, 3, 4, 5].map(star => (
                          <IconButton
                            key={star}
                            size="small"
                            onClick={() => handleRateMeal(meal.id, star)}
                            color={meal.rating && meal.rating >= star ? 'warning' : 'default'}
                          >
                            {meal.rating && meal.rating >= star ? <Star /> : <StarBorder />}
                          </IconButton>
                        ))}
                      </Box>
                    </CardContent>

                    <CardActions>
                      {!meal.completed && (
                        <Button
                          size="small"
                          onClick={() => handleMarkComplete(meal.id)}
                        >
                          Mark Complete
                        </Button>
                      )}
                      <IconButton
                        size="small"
                        onClick={() => handleToggleStaple(meal.id)}
                      >
                        {meal.recipe?.tags?.includes('staple') ? <Star /> : <StarBorder />}
                      </IconButton>
                    </CardActions>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Paper>
        ))}
      </Box>
    )
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
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

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          <CalendarMonth sx={{ mr: 1, verticalAlign: 'middle' }} />
          Meal Planner
        </Typography>

        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<Settings />}
            onClick={() => router.push('/meal-planner/setup')}
          >
            Setup
          </Button>

          <Button
            variant="outlined"
            onClick={() => router.push('/meal-planner/manual')}
          >
            Manual Plan
          </Button>

          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setGenerateDialogOpen(true)}
          >
            Generate Plan
          </Button>
        </Box>
      </Box>

      {!hasProfile && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Complete your household profile to start meal planning!
          <Button
            size="small"
            onClick={() => router.push('/meal-planner/setup')}
            sx={{ ml: 2 }}
          >
            Complete Setup
          </Button>
        </Alert>
      )}

      {plans.length > 0 && (
        <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ flexGrow: 1 }}>
              <FormControl sx={{ minWidth: 300 }}>
                <InputLabel id="plan-select-label">Select Meal Plan</InputLabel>
                <Select
                  labelId="plan-select-label"
                  value={currentPlan?.id || ''}
                  onChange={async (e) => {
                    const plan = plans.find(p => p.id === e.target.value)
                    if (plan) {
                      setCurrentPlan(plan)
                      await loadPlannedMeals(plan.id)
                    }
                  }}
                  label="Select Meal Plan"
                  size="small"
                >
                  {plans.map(plan => (
                    <MenuItem key={plan.id} value={plan.id}>
                      {plan.name} ({format(new Date(plan.start_date), 'MMM d')} - {format(new Date(plan.end_date), 'MMM d')})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {currentPlan && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {format(new Date(currentPlan.start_date), 'MMMM d')} - {format(new Date(currentPlan.end_date), 'MMMM d, yyyy')}
                </Typography>
              )}
            </Box>

            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              {currentPlan && (
                <>
                  <Chip
                    label={currentPlan.status}
                    color={currentPlan.status === 'active' ? 'success' : 'default'}
                  />

                  {currentPlan.total_prep_time && (
                    <Typography variant="body2">
                      Total prep: {Math.round(currentPlan.total_prep_time / 60)} hrs
                    </Typography>
                  )}

                  <IconButton>
                    <ShoppingCart />
                  </IconButton>

                  <IconButton>
                    <Print />
                  </IconButton>

                  <IconButton>
                    <Share />
                  </IconButton>
                </>
              )}
            </Box>
          </Box>
        </Paper>
      )}

      <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ mb: 3 }}>
        <Tab label="Week View" />
        <Tab label="List View" />
        <Tab label="Shopping List" />
        <Tab label="History" />
      </Tabs>

      <Box sx={{ mt: 3 }}>
        {tabValue === 0 && renderWeekView()}
        {tabValue === 1 && renderListView()}
        {tabValue === 2 && (
          <Alert severity="info">
            Shopping list generation coming soon!
          </Alert>
        )}
        {tabValue === 3 && (
          <Alert severity="info">
            Meal history view coming soon!
          </Alert>
        )}
      </Box>

      <Dialog
        open={generateDialogOpen}
        onClose={() => setGenerateDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <AutoAwesome color="primary" />
            Generate Meal Plan
          </Box>
        </DialogTitle>
        <DialogContent>
          <Paper sx={{ p: 2, mt: 2, mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              Select Week for Meal Plan
            </Typography>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <IconButton
                onClick={() => setSelectedWeek(prev => addDays(prev, -7))}
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
                onClick={() => setSelectedWeek(prev => addDays(prev, 7))}
              >
                <NavigateNext />
              </IconButton>
            </Box>
            <Box textAlign="center" mt={1}>
              <Button
                size="small"
                onClick={() => setSelectedWeek(new Date())}
              >
                Current Week
              </Button>
            </Box>
          </Paper>

          <Typography variant="h6" gutterBottom>
            How would you like to plan your meals?
          </Typography>

          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6}>
              <Card
                sx={{
                  cursor: 'pointer',
                  border: generationStrategy === 'auto' ? '2px solid' : '1px solid',
                  borderColor: generationStrategy === 'auto' ? 'primary.main' : 'divider',
                  transition: 'all 0.3s',
                  '&:hover': { transform: 'translateY(-2px)', boxShadow: 2 }
                }}
                onClick={() => setGenerationStrategy('auto')}
              >
                <CardContent>
                  <Box display="flex" alignItems="center" gap={1} mb={1}>
                    <AutoAwesome color={generationStrategy === 'auto' ? 'primary' : 'disabled'} />
                    <Typography variant="subtitle1" fontWeight="bold">
                      Smart Auto-Generate
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Let AI create a balanced plan based on your preferences, past favorites, and what's in season
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6}>
              <Card
                sx={{
                  cursor: 'pointer',
                  border: generationStrategy === 'pantry' ? '2px solid' : '1px solid',
                  borderColor: generationStrategy === 'pantry' ? 'primary.main' : 'divider',
                  transition: 'all 0.3s',
                  '&:hover': { transform: 'translateY(-2px)', boxShadow: 2 }
                }}
                onClick={() => setGenerationStrategy('pantry')}
              >
                <CardContent>
                  <Box display="flex" alignItems="center" gap={1} mb={1}>
                    <Inventory color={generationStrategy === 'pantry' ? 'primary' : 'disabled'} />
                    <Typography variant="subtitle1" fontWeight="bold">
                      Use Pantry Items
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Prioritize meals using ingredients you already have to reduce waste and save money
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6}>
              <Card
                sx={{
                  cursor: 'pointer',
                  border: generationStrategy === 'recipes' ? '2px solid' : '1px solid',
                  borderColor: generationStrategy === 'recipes' ? 'primary.main' : 'divider',
                  transition: 'all 0.3s',
                  '&:hover': { transform: 'translateY(-2px)', boxShadow: 2 }
                }}
                onClick={() => setGenerationStrategy('recipes')}
              >
                <CardContent>
                  <Box display="flex" alignItems="center" gap={1} mb={1}>
                    <MenuBook color={generationStrategy === 'recipes' ? 'primary' : 'disabled'} />
                    <Typography variant="subtitle1" fontWeight="bold">
                      My Recipe Collection
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Choose from your saved recipes and family favorites
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6}>
              <Card
                sx={{
                  cursor: 'pointer',
                  border: generationStrategy === 'discover' ? '2px solid' : '1px solid',
                  borderColor: generationStrategy === 'discover' ? 'primary.main' : 'divider',
                  transition: 'all 0.3s',
                  '&:hover': { transform: 'translateY(-2px)', boxShadow: 2 }
                }}
                onClick={() => setGenerationStrategy('discover')}
              >
                <CardContent>
                  <Box display="flex" alignItems="center" gap={1} mb={1}>
                    <TravelExplore color={generationStrategy === 'discover' ? 'primary' : 'disabled'} />
                    <Typography variant="subtitle1" fontWeight="bold">
                      Discover New Recipes
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    AI searches popular recipe sites for fresh meal ideas matching your preferences
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 2 }}>OR</Divider>
            </Grid>

            <Grid item xs={12}>
              <Card
                sx={{
                  cursor: 'pointer',
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'grey.50',
                  transition: 'all 0.3s',
                  '&:hover': { transform: 'translateY(-2px)', boxShadow: 2, bgcolor: 'grey.100' }
                }}
                onClick={() => {
                  setGenerateDialogOpen(false)
                  router.push('/meal-planner/manual')
                }}
              >
                <CardContent>
                  <Box display="flex" alignItems="center" gap={1} mb={1}>
                    <Edit color="action" />
                    <Typography variant="subtitle1" fontWeight="bold">
                      Create Manual Plan
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Build your meal plan manually without AI - add your own meals exactly as you want them
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Additional Options
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box
              sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }}
              onClick={() => setGenerationOptions({...generationOptions, useSeasonalIngredients: !generationOptions.useSeasonalIngredients})}
            >
              {generationOptions.useSeasonalIngredients ?
                <RadioButtonChecked color="primary" fontSize="small" /> :
                <RadioButtonUnchecked fontSize="small" />
              }
              <Typography variant="body2">Use seasonal ingredients</Typography>
            </Box>

            <Box
              sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }}
              onClick={() => setGenerationOptions({...generationOptions, budgetConscious: !generationOptions.budgetConscious})}
            >
              {generationOptions.budgetConscious ?
                <RadioButtonChecked color="primary" fontSize="small" /> :
                <RadioButtonUnchecked fontSize="small" />
              }
              <Typography variant="body2">Focus on budget-friendly meals</Typography>
            </Box>

            <Box
              sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }}
              onClick={() => setGenerationOptions({...generationOptions, quickMealsOnly: !generationOptions.quickMealsOnly})}
            >
              {generationOptions.quickMealsOnly ?
                <RadioButtonChecked color="primary" fontSize="small" /> :
                <RadioButtonUnchecked fontSize="small" />
              }
              <Typography variant="body2">Quick meals only (under 30 minutes)</Typography>
            </Box>

            <Box
              sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }}
              onClick={() => setGenerationOptions({...generationOptions, includeLefotovers: !generationOptions.includeLefotovers})}
            >
              {generationOptions.includeLefotovers ?
                <RadioButtonChecked color="primary" fontSize="small" /> :
                <RadioButtonUnchecked fontSize="small" />
              }
              <Typography variant="body2">Plan for leftovers</Typography>
            </Box>
          </Box>

          {generationStrategy === 'discover' && (
            <Alert severity="info" sx={{ mt: 2 }}>
              AI will search popular recipe sites like AllRecipes, Food Network, and BBC Good Food
              for new meal ideas that match your family's preferences and dietary needs.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGenerateDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              console.log('Generate button in dialog clicked')
              handleGeneratePlan()
            }}
            disabled={generating}
            startIcon={generating ? <CircularProgress size={20} /> : <AutoAwesome />}
          >
            {generating ? 'Generating...' : 'Generate Plan'}
          </Button>
        </DialogActions>
      </Dialog>

      <MealPlanPreview
        open={previewDialogOpen}
        onClose={() => setPreviewDialogOpen(false)}
        plannedMeals={previewMeals}
        weekStart={startOfWeek(selectedWeek, { weekStartsOn: 0 })}
        onConfirm={handleConfirmMealPlan}
        onRegenerateMeals={handleRegenerateMeals}
      />
    </Container>
  )
}