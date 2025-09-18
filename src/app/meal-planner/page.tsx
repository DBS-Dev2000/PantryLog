'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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
  Fab
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
  Share
} from '@mui/icons-material'
import { createClient } from '@/lib/supabase-client'
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

  useEffect(() => {
    checkProfileAndLoadPlans()
  }, [])

  const checkProfileAndLoadPlans = async () => {
    const supabase = createClient()

    try {
      // Check if household has completed setup
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth')
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
        .from('household_members')
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

      // Load current active plan if exists
      const activePlan = plansData?.find(p => p.status === 'active')
      if (activePlan) {
        setCurrentPlan(activePlan)
        loadPlannedMeals(activePlan.id)
      }

      setLoading(false)
    } catch (error) {
      console.error('Error loading meal plans:', error)
      setLoading(false)
    }
  }

  const loadPlannedMeals = async (planId: string) => {
    const supabase = createClient()

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
    setGenerating(true)
    const supabase = createClient()

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const weekStart = startOfWeek(selectedWeek, { weekStartsOn: 1 })
      const weekEnd = endOfWeek(selectedWeek, { weekStartsOn: 1 })

      const response = await fetch('/api/meal-planner/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          householdId: user.id,
          startDate: format(weekStart, 'yyyy-MM-dd'),
          endDate: format(weekEnd, 'yyyy-MM-dd'),
          usePastMeals: true,
          includeStaples: true
        })
      })

      const result = await response.json()

      if (result.success) {
        await checkProfileAndLoadPlans()
        setGenerateDialogOpen(false)

        // Load the newly generated plan
        const newPlan = plans.find(p => p.id === result.planId)
        if (newPlan) {
          setCurrentPlan(newPlan)
          loadPlannedMeals(newPlan.id)
        }
      }
    } catch (error) {
      console.error('Error generating meal plan:', error)
    } finally {
      setGenerating(false)
    }
  }

  const handleMarkComplete = async (mealId: string) => {
    const supabase = createClient()

    const { error } = await supabase
      .from('planned_meals')
      .update({ completed: true })
      .eq('id', mealId)

    if (!error && currentPlan) {
      loadPlannedMeals(currentPlan.id)
    }
  }

  const handleRateMeal = async (mealId: string, rating: number) => {
    const supabase = createClient()

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
    const supabase = createClient()
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

      {currentPlan && (
        <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="h6">
                {currentPlan.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {format(new Date(currentPlan.start_date), 'MMM d')} - {format(new Date(currentPlan.end_date), 'MMM d, yyyy')}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
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
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Generate Meal Plan</DialogTitle>
        <DialogContent>
          <TextField
            type="week"
            label="Select Week"
            fullWidth
            value={format(selectedWeek, "yyyy-'W'ww")}
            onChange={(e) => {
              const [year, week] = e.target.value.split('-W')
              const date = new Date(parseInt(year), 0, 1)
              date.setDate(date.getDate() + (parseInt(week) - 1) * 7)
              setSelectedWeek(date)
            }}
            sx={{ mt: 2 }}
          />

          <Alert severity="info" sx={{ mt: 2 }}>
            AI will generate a meal plan based on your household preferences, dietary restrictions,
            and past meal history. Staple meals may be repeated weekly.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGenerateDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleGeneratePlan}
            disabled={generating}
          >
            {generating ? <CircularProgress size={24} /> : 'Generate'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}