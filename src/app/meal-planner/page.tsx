'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getUserHouseholdFeatures } from '@/lib/features'
import MealPlanPreview from './components/MealPlanPreview'
import DateRangePicker from './components/DateRangePicker'
import AddMealDialog from './components/AddMealDialog'
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
  Divider,
  Menu,
  useTheme,
  useMediaQuery
} from '@mui/material'
import {
  CalendarMonth,
  Restaurant,
  ShoppingCart,
  Add,
  Edit,
  Delete,
  Archive,
  MoreVert,
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
  NavigateNext,
  OpenInNew
} from '@mui/icons-material'
import { supabase } from '@/lib/supabase'
import { format, startOfWeek, endOfWeek, addDays, addWeeks, subWeeks } from 'date-fns'

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
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const [loading, setLoading] = useState(true)
  const [plans, setPlans] = useState<MealPlan[]>([])
  const [currentPlan, setCurrentPlan] = useState<MealPlan | null>(null)
  const [plannedMeals, setPlannedMeals] = useState<PlannedMeal[]>([])
  const [tabValue, setTabValue] = useState(0)
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false)
  const [selectedStartDate, setSelectedStartDate] = useState<Date | null>(startOfWeek(new Date(), { weekStartsOn: 0 }))
  const [selectedEndDate, setSelectedEndDate] = useState<Date | null>(endOfWeek(new Date(), { weekStartsOn: 0 }))
  const [dateRangeDialogOpen, setDateRangeDialogOpen] = useState(false)
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
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false)
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [addMealDialogOpen, setAddMealDialogOpen] = useState(false)
  const [editMealDialogOpen, setEditMealDialogOpen] = useState(false)
  const [selectedMeal, setSelectedMeal] = useState<PlannedMeal | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedMealType, setSelectedMealType] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>('dinner')
  const [previewAddMealDialogOpen, setPreviewAddMealDialogOpen] = useState(false)
  const [previewMealDate, setPreviewMealDate] = useState<Date | null>(null)
  const [previewMealType, setPreviewMealType] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>('dinner')
  const [familyMembers, setFamilyMembers] = useState<any[]>([])
  const [selectedAttendees, setSelectedAttendees] = useState<string[]>([])

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

      // Check if profile is complete and load family members
      const { data: members } = await supabase
        .from('family_members')
        .select('*')
        .eq('household_id', household.id)

      if (!members || members.length === 0) {
        router.push('/meal-planner/setup')
        return
      }

      setFamilyMembers(members)
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

      // Use selected date range or default to current week
      const startDate = selectedStartDate || startOfWeek(new Date(), { weekStartsOn: 0 })
      const endDate = selectedEndDate || endOfWeek(new Date(), { weekStartsOn: 0 })
      console.log('Generating for dates:', format(startDate, 'yyyy-MM-dd'), 'to', format(endDate, 'yyyy-MM-dd'))

      const requestBody = {
        householdId: user.id,
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd'),
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
        console.log('Preview meals received:', result.meals)
        console.log('Number of preview meals:', (result.meals || []).length)
        console.log('Pantry scorecard:', result.pantryScorecard)
        console.log('Option compliance:', result.optionCompliance)

        // Store scorecards in session storage for display
        if (result.pantryScorecard) {
          sessionStorage.setItem('pantryScorecard', JSON.stringify(result.pantryScorecard))
        }
        if (result.optionCompliance) {
          sessionStorage.setItem('optionCompliance', JSON.stringify(result.optionCompliance))
        }

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

  const handleDeletePlan = async () => {
    if (!selectedPlanId) return

    setDeleteDialogOpen(false)
    setLoading(true)

    try {
      // Delete all meals associated with this plan first
      await supabase
        .from('meal_planner_meals')
        .delete()
        .eq('plan_id', selectedPlanId)

      // Then delete the plan itself
      const { error } = await supabase
        .from('meal_plans')
        .delete()
        .eq('id', selectedPlanId)

      if (error) throw error

      // Reload the plans list
      await checkProfileAndLoadPlans()
      setSelectedPlanId(null)
    } catch (error) {
      console.error('Error deleting meal plan:', error)
      setError('Failed to delete meal plan')
    } finally {
      setLoading(false)
    }
  }

  const handleArchivePlan = async () => {
    if (!selectedPlanId) return

    setArchiveDialogOpen(false)
    setLoading(true)

    try {
      const { error } = await supabase
        .from('meal_plans')
        .update({ status: 'archived' })
        .eq('id', selectedPlanId)

      if (error) throw error

      // Reload the plans list
      await checkProfileAndLoadPlans()
      setSelectedPlanId(null)
    } catch (error) {
      console.error('Error archiving meal plan:', error)
      setError('Failed to archive meal plan')
    } finally {
      setLoading(false)
    }
  }

  const handleAddMeal = async (mealData: any) => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('Please sign in to add meals')
        return
      }

      let planToUse = currentPlan

      // If no current plan exists, create one
      if (!planToUse) {
        const mealDate = new Date(mealData.date)
        const startDate = startOfWeek(mealDate, { weekStartsOn: 0 })
        const endDate = endOfWeek(mealDate, { weekStartsOn: 0 })

        const { data: newPlan, error: planError } = await supabase
          .from('meal_plans')
          .insert({
            household_id: user.id,
            name: `Week of ${format(startDate, 'MMM d, yyyy')}`,
            start_date: format(startDate, 'yyyy-MM-dd'),
            end_date: format(endDate, 'yyyy-MM-dd'),
            status: 'active'
          })
          .select()
          .single()

        if (planError) throw planError

        planToUse = newPlan
        setCurrentPlan(newPlan)
      }

      const { error } = await supabase
        .from('planned_meals')
        .insert({
          meal_plan_id: planToUse.id,
          meal_date: format(mealData.date, 'yyyy-MM-dd'),
          meal_type: mealData.mealType,
          recipe_id: mealData.recipeId,
          custom_meal_name: mealData.customName,
          servings: mealData.servings || 4,
          notes: mealData.notes,
          attendees: mealData.attendees
        })

      if (error) throw error

      await loadPlannedMeals(planToUse.id)
      setAddMealDialogOpen(false)
      setSuccess('Meal added successfully!')
    } catch (error) {
      console.error('Error adding meal:', error)
      setError('Failed to add meal')
    } finally {
      setLoading(false)
    }
  }

  const handleEditMeal = async (mealData: any) => {
    if (!selectedMeal) return

    setLoading(true)
    try {
      const { error } = await supabase
        .from('planned_meals')
        .update({
          meal_date: format(mealData.date, 'yyyy-MM-dd'),
          meal_type: mealData.mealType,
          recipe_id: mealData.recipeId,
          custom_meal_name: mealData.customName,
          servings: mealData.servings,
          notes: mealData.notes,
          attendees: mealData.attendees
        })
        .eq('id', selectedMeal.id)

      if (error) throw error

      if (currentPlan) {
        await loadPlannedMeals(currentPlan.id)
      }
      setEditMealDialogOpen(false)
      setSelectedMeal(null)
      setSuccess('Meal updated successfully!')
    } catch (error) {
      console.error('Error updating meal:', error)
      setError('Failed to update meal')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteMeal = async (mealId: string) => {
    setLoading(true)
    try {
      const { error } = await supabase
        .from('planned_meals')
        .delete()
        .eq('id', mealId)

      if (error) throw error

      if (currentPlan) {
        await loadPlannedMeals(currentPlan.id)
      }
      setSuccess('Meal removed successfully!')
    } catch (error) {
      console.error('Error deleting meal:', error)
      setError('Failed to delete meal')
    } finally {
      setLoading(false)
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

      const startDate = selectedStartDate || startOfWeek(new Date(), { weekStartsOn: 0 })
      const endDate = selectedEndDate || endOfWeek(new Date(), { weekStartsOn: 0 })

      // Send confirmed meals to save
      const requestBody = {
        householdId: user.id,
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd'),
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

  const handlePreviewAddMeal = (date: string, mealType: string) => {
    setPreviewMealDate(new Date(date))
    setPreviewMealType(mealType as 'breakfast' | 'lunch' | 'dinner' | 'snack')
    setPreviewAddMealDialogOpen(true)
  }

  const handlePreviewEditMeal = (meal: any) => {
    // Set the selected meal for editing
    setSelectedMeal(meal)
    setPreviewMealDate(new Date(meal.date))
    setPreviewMealType(meal.mealType)
    // Open the add meal dialog in edit mode with the meal data
    setPreviewAddMealDialogOpen(true)
  }

  const handlePreviewMealAdded = async (mealData: any) => {
    try {
      if (selectedMeal) {
        // Editing existing meal - update it
        setPreviewMeals(prev => prev.map(meal => {
          if ((meal.id && meal.id === selectedMeal.id) ||
              (meal.date === selectedMeal.date && meal.mealType === selectedMeal.mealType)) {
            return {
              ...meal,
              date: format(mealData.date, 'yyyy-MM-dd'),
              mealType: mealData.mealType,
              recipeId: mealData.recipeId,
              customMealName: mealData.customName,
              recipeName: mealData.recipeId ? 'Selected Recipe' : mealData.customName,
              servings: mealData.servings,
              notes: mealData.notes,
              attendees: mealData.attendees,
              dietaryNeeds: mealData.dietaryNeeds,
              accepted: true
            }
          }
          return meal
        }))
        setSelectedMeal(null)
      } else {
        // Adding new meal
        const newMeal = {
          id: `preview-${Date.now()}`,
          date: format(mealData.date, 'yyyy-MM-dd'),
          mealType: mealData.mealType,
          recipeId: mealData.recipeId,
          customMealName: mealData.customName,
          recipeName: mealData.recipeId ? 'Selected Recipe' : mealData.customName,
          servings: mealData.servings,
          notes: mealData.notes,
          attendees: mealData.attendees,
          dietaryNeeds: mealData.dietaryNeeds,
          accepted: true
        }
        setPreviewMeals(prev => [...prev, newMeal])
      }

      setPreviewAddMealDialogOpen(false)
    } catch (error) {
      console.error('Error adding/updating meal in preview:', error)
    }
  }

  const handleAddToRecipes = async (meal: any) => {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('Please sign in to add recipes')
        return
      }

      // Create a new recipe from the external meal data
      const { data: newRecipe, error: recipeError } = await supabase
        .from('recipes')
        .insert({
          household_id: user.id,
          name: meal.recipeName || meal.customMealName,
          description: meal.recipeSummary || '',
          source_url: meal.recipeLink,
          prep_time: meal.prepTime,
          servings: meal.servings || 4,
          tags: meal.dietaryNeeds || [],
          rating: meal.recipeRating,
          review_count: meal.recipeReviewCount,
          image_url: meal.recipeImage
        })
        .select()
        .single()

      if (recipeError) {
        console.error('Error adding recipe:', recipeError)
        setError('Failed to add recipe to your collection')
        return
      }

      setSuccess(`"${meal.recipeName || meal.customMealName}" has been added to your recipes!`)
    } catch (error) {
      console.error('Error adding recipe:', error)
      setError('Failed to add recipe to your collection')
    } finally {
      setLoading(false)
    }
  }

  const getMealsByDay = () => {
    const mealsByDay: Record<string, PlannedMeal[]> = {}

    plannedMeals.forEach(meal => {
      // Format the meal date to ensure consistent format (yyyy-MM-dd)
      const mealDate = meal.meal_date ? format(new Date(meal.meal_date), 'yyyy-MM-dd') : ''

      if (mealDate) {
        if (!mealsByDay[mealDate]) {
          mealsByDay[mealDate] = []
        }
        mealsByDay[mealDate].push(meal)
      }
    })

    // Log for debugging
    console.log('Meals by day:', mealsByDay)
    console.log('Planned meals count:', plannedMeals.length)

    return mealsByDay
  }

  const renderWeekView = () => {
    const mealsByDay = getMealsByDay()
    const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

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

    // Use startOfWeek to ensure we start on Sunday
    const planStart = new Date(currentPlan.start_date)
    const startDate = startOfWeek(planStart, { weekStartsOn: 0 }) // 0 = Sunday

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

                    if (!meal) {
                      // Show empty slot with + button
                      return (
                        <ListItem
                          key={`empty-${mealType}`}
                          sx={{
                            pl: 0,
                            cursor: 'pointer',
                            '&:hover': { backgroundColor: 'action.hover' },
                            borderRadius: 1,
                            border: '1px dashed',
                            borderColor: 'divider',
                            mb: 0.5
                          }}
                          onClick={() => {
                            setSelectedDate(date)
                            setSelectedMealType(mealType as any)
                            setAddMealDialogOpen(true)
                          }}
                        >
                          <ListItemText
                            primary={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, opacity: 0.6 }}>
                                <Chip
                                  size="small"
                                  label={mealType}
                                  variant="outlined"
                                  color={
                                    mealType === 'breakfast' ? 'warning' :
                                    mealType === 'lunch' ? 'info' :
                                    mealType === 'dinner' ? 'success' : 'default'
                                  }
                                />
                                <Add fontSize="small" />
                                <Typography variant="body2" color="text.secondary">
                                  Add {mealType}
                                </Typography>
                              </Box>
                            }
                          />
                        </ListItem>
                      )
                    }

                    return (
                      <ListItem
                        key={meal.id}
                        sx={{
                          pl: 0,
                          cursor: 'pointer',
                          '&:hover': { backgroundColor: 'action.hover' },
                          borderRadius: 1
                        }}
                        onClick={() => {
                          setSelectedMeal(meal)
                          setEditMealDialogOpen(true)
                        }}
                      >
                        <ListItemText
                          primaryTypographyProps={{ component: 'div' }}
                          secondaryTypographyProps={{ component: 'div' }}
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
                              {meal.attendees && meal.attendees.length > 0 && (
                                <Chip
                                  size="small"
                                  label={`${meal.attendees.length} attending`}
                                  variant="outlined"
                                  icon={<Person fontSize="small" />}
                                />
                              )}
                            </Box>
                          }
                          secondary={
                            <>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                <Typography component="span" variant="body2">
                                  {meal.recipe?.name || meal.custom_meal_name}
                                </Typography>
                                {meal.recipe?.id && (
                                  <Tooltip title="View Recipe">
                                    <IconButton
                                      size="small"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        if (meal.recipe?.source_url) {
                                          window.open(meal.recipe.source_url, '_blank')
                                        } else {
                                          window.open(`/recipes/${meal.recipe.id}`, '_blank')
                                        }
                                      }}
                                      sx={{ p: 0.25 }}
                                    >
                                      {meal.recipe?.source_url ? <OpenInNew fontSize="small" /> : <LocalDining fontSize="small" />}
                                    </IconButton>
                                  </Tooltip>
                                )}
                              </Box>

                              {/* Dietary Tags */}
                              {meal.recipe?.tags && meal.recipe.tags.length > 0 && (
                                <Box sx={{ display: 'flex', gap: 0.5, mb: 0.5, flexWrap: 'wrap' }}>
                                  {meal.recipe.tags.map((tag: string) => (
                                    <Chip
                                      key={tag}
                                      label={tag}
                                      size="small"
                                      variant="outlined"
                                      color={
                                        tag.includes('vegetarian') || tag.includes('vegan') ? 'success' :
                                        tag.includes('gluten') || tag.includes('dairy') ? 'warning' :
                                        'default'
                                      }
                                      sx={{ fontSize: '0.65rem', height: 18 }}
                                    />
                                  ))}
                                </Box>
                              )}

                              <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                                {meal.servings && (
                                  <Typography component="span" variant="caption" color="text.secondary">
                                    • {meal.servings} servings
                                  </Typography>
                                )}
                                {meal.prep_time && (
                                  <Typography component="span" variant="caption" color="text.secondary">
                                    <Schedule fontSize="small" sx={{ fontSize: 12, mr: 0.5, verticalAlign: 'middle' }} />
                                    {meal.prep_time} min
                                  </Typography>
                                )}
                              </Box>

                              {meal.notes && (
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontStyle: 'italic', mt: 0.5 }}>
                                  {meal.notes}
                                </Typography>
                              )}
                            </>
                          }
                        />
                        <ListItemSecondaryAction>
                          <Tooltip title={meal.recipe?.tags?.includes('staple') ? 'Remove from staples' : 'Mark as staple'}>
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleToggleStaple(meal.id)
                              }}
                            >
                              {meal.recipe?.tags?.includes('staple') ? <Star /> : <StarBorder />}
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete meal">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteMeal(meal.id)
                              }}
                              sx={{ color: 'error.main' }}
                            >
                              <Delete fontSize="small" />
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
    <Container maxWidth="xl" sx={{ py: isMobile ? 2 : 4 }}>
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

      <Box sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: isMobile ? 'stretch' : 'center',
        mb: 3,
        flexDirection: isMobile ? 'column' : 'row',
        gap: isMobile ? 2 : 0
      }}>
        <Typography variant={isMobile ? "h5" : "h4"} component="h1">
          <CalendarMonth sx={{ mr: 1, verticalAlign: 'middle', fontSize: isMobile ? 24 : 32 }} />
          {isMobile ? "Meal Plans" : "Meal Planner"}
        </Typography>

        <Box sx={{
          display: 'flex',
          gap: isMobile ? 1 : 2,
          width: isMobile ? '100%' : 'auto',
          flexDirection: isMobile ? 'column' : 'row'
        }}>
          {!isMobile && (
            <Button
              variant="outlined"
              startIcon={<Settings />}
              onClick={() => router.push('/meal-planner/setup')}
            >
              Setup
            </Button>
          )}

          {!isMobile && (
            <Button
              variant="outlined"
              onClick={() => router.push('/meal-planner/manual')}
            >
              Manual Plan
            </Button>
          )}

          <Button
            variant="contained"
            startIcon={!isMobile && <Add />}
            onClick={() => setGenerateDialogOpen(true)}
            fullWidth={isMobile}
            size={isMobile ? "large" : "medium"}
          >
            {isMobile && <Add sx={{ mr: 1 }} />}
            Generate {isMobile ? "New " : ""}Plan
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

                  <IconButton
                    onClick={(e) => {
                      setMenuAnchorEl(e.currentTarget)
                      setSelectedPlanId(currentPlan.id)
                    }}
                  >
                    <MoreVert />
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
        maxWidth={isMobile ? "sm" : "md"}
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
              Select Dates for Meal Plan
            </Typography>
            <Box textAlign="center">
              {selectedStartDate && selectedEndDate ? (
                <Box>
                  <Typography variant="h6">
                    {format(selectedStartDate, 'MMM d')} - {format(selectedEndDate, 'MMM d, yyyy')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {Math.floor((selectedEndDate.getTime() - selectedStartDate.getTime()) / (1000 * 60 * 60 * 24)) + 1} days
                  </Typography>
                </Box>
              ) : (
                <Typography variant="body1" color="text.secondary">
                  No dates selected
                </Typography>
              )}
              <Button
                variant="outlined"
                startIcon={<CalendarMonth />}
                onClick={() => setDateRangeDialogOpen(true)}
                sx={{ mt: 2 }}
                fullWidth
              >
                {selectedStartDate ? 'Change Dates' : 'Select Dates'}
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
        weekStart={selectedStartDate || startOfWeek(new Date(), { weekStartsOn: 0 })}
        onConfirm={handleConfirmMealPlan}
        onRegenerateMeals={handleRegenerateMeals}
        onAddMeal={handlePreviewAddMeal}
        onEditMeal={handlePreviewEditMeal}
        onAddToRecipes={handleAddToRecipes}
      />

      <DateRangePicker
        open={dateRangeDialogOpen}
        onClose={() => setDateRangeDialogOpen(false)}
        onConfirm={(start, end) => {
          setSelectedStartDate(start)
          setSelectedEndDate(end)
          setDateRangeDialogOpen(false)
        }}
        initialStartDate={selectedStartDate}
        initialEndDate={selectedEndDate}
        title="Select Meal Plan Dates"
      />

      {/* Menu for meal plan actions */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={() => setMenuAnchorEl(null)}
      >
        <MenuItem
          onClick={() => {
            setMenuAnchorEl(null)
            setArchiveDialogOpen(true)
          }}
        >
          <Archive fontSize="small" sx={{ mr: 1 }} />
          Archive Plan
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchorEl(null)
            setDeleteDialogOpen(true)
          }}
          sx={{ color: 'error.main' }}
        >
          <Delete fontSize="small" sx={{ mr: 1 }} />
          Delete Plan
        </MenuItem>
      </Menu>

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Delete Meal Plan?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this meal plan? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleDeletePlan}
            color="error"
            variant="contained"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Archive confirmation dialog */}
      <Dialog
        open={archiveDialogOpen}
        onClose={() => setArchiveDialogOpen(false)}
      >
        <DialogTitle>Archive Meal Plan?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to archive this meal plan? You can unarchive it later from the history.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setArchiveDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleArchivePlan}
            color="primary"
            variant="contained"
          >
            Archive
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Meal Dialog */}
      <AddMealDialog
        open={addMealDialogOpen}
        onClose={() => setAddMealDialogOpen(false)}
        onConfirm={handleAddMeal}
        initialDate={selectedDate}
        initialMealType={selectedMealType}
        familyMembers={familyMembers}
        currentPlanDates={currentPlan ? {
          start: new Date(currentPlan.start_date),
          end: new Date(currentPlan.end_date)
        } : undefined}
      />

      {/* Edit Meal Dialog */}
      <AddMealDialog
        open={editMealDialogOpen}
        onClose={() => {
          setEditMealDialogOpen(false)
          setSelectedMeal(null)
        }}
        onConfirm={handleEditMeal}
        familyMembers={familyMembers}
        existingMeal={selectedMeal}
        currentPlanDates={currentPlan ? {
          start: new Date(currentPlan.start_date),
          end: new Date(currentPlan.end_date)
        } : undefined}
      />

      {/* Preview Add Meal Dialog */}
      <AddMealDialog
        open={previewAddMealDialogOpen}
        onClose={() => {
          setPreviewAddMealDialogOpen(false)
          setSelectedMeal(null)
        }}
        onConfirm={handlePreviewMealAdded}
        initialDate={previewMealDate}
        initialMealType={previewMealType}
        familyMembers={familyMembers}
        existingMeal={selectedMeal}
        currentPlanDates={{
          start: selectedStartDate || startOfWeek(new Date(), { weekStartsOn: 0 }),
          end: selectedEndDate || endOfWeek(new Date(), { weekStartsOn: 0 })
        }}
      />

      {/* Floating Action Button for adding meals */}
      {currentPlan && (
        <Fab
          color="primary"
          sx={{
            position: 'fixed',
            bottom: isMobile ? 80 : 32,
            right: isMobile ? 16 : 32,
            zIndex: 1000
          }}
          onClick={() => {
            setSelectedDate(new Date())
            setSelectedMealType('dinner')
            setAddMealDialogOpen(true)
          }}
        >
          <Add />
        </Fab>
      )}
    </Container>
  )
}