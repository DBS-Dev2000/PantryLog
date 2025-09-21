'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  IconButton,
  Chip,
  Checkbox,
  FormControlLabel,
  Alert,
  CircularProgress,
  Tooltip,
  Paper,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material'
import {
  Close,
  CheckCircle,
  Cancel,
  Refresh,
  Restaurant,
  Schedule,
  CalendarMonth,
  Add,
  Delete,
  Edit,
  OpenInNew,
  LocalDining,
  DragHandle,
  Info,
  SwapHoriz,
  AutoAwesome,
  Search,
  Inventory,
  WarningAmber,
  CheckBox,
  ShoppingCart,
  ExpandMore
} from '@mui/icons-material'
import { format, startOfWeek, addDays } from 'date-fns'
import MealAttendanceDialog from './MealAttendanceDialog'
import MealDetailsDialog from './MealDetailsDialog'

interface PlannedMeal {
  id?: string
  date: string
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  recipeId?: string
  customMealName?: string
  recipeName?: string
  recipeUrl?: string
  recipeLink?: string
  recipeImage?: string
  recipeSummary?: string
  recipeRating?: number
  recipeReviewCount?: number
  dietaryTags?: string[]
  dietaryNeeds?: string[]
  servings: number
  prepTime?: number
  cookTime?: number
  notes?: string
  accepted?: boolean
}

interface MealTypeSelection {
  [key: string]: {
    breakfast: boolean
    lunch: boolean
    dinner: boolean
  }
}

interface MealPlanPreviewProps {
  open: boolean
  onClose: () => void
  plannedMeals: PlannedMeal[]
  weekStart: Date
  onConfirm: (meals: PlannedMeal[], mealTypes: MealTypeSelection) => void
  onRegenerateMeals: (missingDays: string[], mealTypes: MealTypeSelection) => Promise<PlannedMeal[]>
  onAddMeal?: (date: string, mealType: string) => void
  onEditMeal?: (meal: PlannedMeal) => void
  onAddToRecipes?: (meal: PlannedMeal) => void
}

export default function MealPlanPreview({
  open,
  onClose,
  plannedMeals: initialMeals,
  weekStart,
  onConfirm,
  onRegenerateMeals,
  onAddMeal,
  onEditMeal,
  onAddToRecipes
}: MealPlanPreviewProps) {
  const [meals, setMeals] = useState<PlannedMeal[]>(initialMeals)
  const [pantryScorecard, setPantryScorecard] = useState<any>(null)
  const [optionCompliance, setOptionCompliance] = useState<any>(null)

  // Extract recipe source from URL
  const getRecipeSource = (url: string | undefined) => {
    if (!url) return null
    try {
      const domain = new URL(url).hostname
      const sourceName = domain
        .replace('www.', '')
        .replace('.com', '')
        .replace('.co.uk', '')
        .split('.')[0]
        .split('-')
        .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
      return sourceName
    } catch {
      return null
    }
  }

  const [mealTypes, setMealTypes] = useState<MealTypeSelection>(() => {
    const types: MealTypeSelection = {}
    for (let i = 0; i < 7; i++) {
      const date = format(addDays(weekStart, i), 'yyyy-MM-dd')
      types[date] = {
        breakfast: i === 0 || i === 6, // Sunday and Saturday
        lunch: i === 6, // Saturday only
        dinner: true // All days
      }
    }
    return types
  })
  const [loading, setLoading] = useState(false)
  const [attendanceDialog, setAttendanceDialog] = useState<{
    open: boolean
    date: string
    mealType: string
    mealName: string
  } | null>(null)
  const [mealAttendance, setMealAttendance] = useState<Record<string, {
    attendingMembers: string[]
    dietaryNeeds: string[]
  }>>({})
  const [mealDetailsDialog, setMealDetailsDialog] = useState<{
    open: boolean
    meal: PlannedMeal | null
    date: string
    mealType: string
  }>({ open: false, meal: null, date: '', mealType: '' })
  const [draggedMeal, setDraggedMeal] = useState<PlannedMeal | null>(null)

  // Update meals when initialMeals prop changes
  useEffect(() => {
    setMeals(initialMeals)
    // Check for pantry scorecard in session storage
    const storedScorecard = sessionStorage.getItem('pantryScorecard')
    if (storedScorecard) {
      setPantryScorecard(JSON.parse(storedScorecard))
      sessionStorage.removeItem('pantryScorecard')
    }
    // Check for option compliance in session storage
    const storedCompliance = sessionStorage.getItem('optionCompliance')
    if (storedCompliance) {
      setOptionCompliance(JSON.parse(storedCompliance))
      sessionStorage.removeItem('optionCompliance')
    }
  }, [initialMeals])

  const getDaysOfWeek = () => {
    const days = []
    for (let i = 0; i < 7; i++) {
      const date = addDays(weekStart, i)
      days.push({
        date: format(date, 'yyyy-MM-dd'),
        dayName: format(date, 'EEEE'),
        dayDate: format(date, 'MMM d')
      })
    }
    return days
  }

  const getMealForDay = (date: string, mealType: string) => {
    return meals.find(m => m.date === date && m.mealType === mealType)
  }

  const getMealsForDay = (date: string, mealType: string) => {
    return meals.filter(m => m.date === date && m.mealType === mealType)
  }

  const toggleMealAcceptance = (mealId: string) => {
    setMeals(prev => prev.map(meal => {
      if (meal.id === mealId ||
          (meal.date === mealId.split('-')[0] && meal.mealType === mealId.split('-')[1])) {
        return { ...meal, accepted: !meal.accepted }
      }
      return meal
    }))
  }

  const toggleMealType = (date: string, mealType: 'breakfast' | 'lunch' | 'dinner') => {
    setMealTypes(prev => ({
      ...prev,
      [date]: {
        ...prev[date],
        [mealType]: !prev[date][mealType]
      }
    }))
  }

  const removeMeal = (date: string, mealType: string) => {
    setMeals(prev => prev.filter(m => !(m.date === date && m.mealType === mealType)))
  }

  const getAcceptedMealsCount = () => {
    return meals.filter(m => m.accepted !== false).length
  }

  const getTotalMealsNeeded = () => {
    let total = 0
    Object.values(mealTypes).forEach(day => {
      if (day.breakfast) total++
      if (day.lunch) total++
      if (day.dinner) total++
    })
    return total
  }

  const handleFindMoreMeals = async () => {
    setLoading(true)
    try {
      // Find which days/meal types are missing
      const missingMeals: string[] = []

      Object.entries(mealTypes).forEach(([date, types]) => {
        if (types.breakfast && !getMealForDay(date, 'breakfast')) {
          missingMeals.push(`${date}-breakfast`)
        }
        if (types.lunch && !getMealForDay(date, 'lunch')) {
          missingMeals.push(`${date}-lunch`)
        }
        if (types.dinner && !getMealForDay(date, 'dinner')) {
          missingMeals.push(`${date}-dinner`)
        }
      })

      if (missingMeals.length > 0) {
        const newMeals = await onRegenerateMeals(missingMeals, mealTypes)
        setMeals(prev => [...prev, ...newMeals])
      }
    } finally {
      setLoading(false)
    }
  }

  const handleAttendanceClick = (date: string, mealType: string, mealName: string) => {
    setAttendanceDialog({
      open: true,
      date,
      mealType,
      mealName
    })
  }

  const handleAttendanceConfirm = (attendingMembers: string[], dietaryNeeds: string[]) => {
    if (attendanceDialog) {
      const key = `${attendanceDialog.date}-${attendanceDialog.mealType}`
      setMealAttendance(prev => ({
        ...prev,
        [key]: { attendingMembers, dietaryNeeds }
      }))
      setAttendanceDialog(null)
    }
  }

  const handleMealDetailsClick = (meal: PlannedMeal, date: string, mealType: string) => {
    setMealDetailsDialog({
      open: true,
      meal,
      date,
      mealType
    })
  }

  const handleMoveMeal = (fromDate: string, fromMealType: string, toDate: string, toMealType: string) => {
    setMeals(prev => {
      const mealToMove = prev.find(m => m.date === fromDate && m.mealType === fromMealType)
      if (!mealToMove) return prev

      // Remove meal from original position
      const withoutMeal = prev.filter(m => !(m.date === fromDate && m.mealType === fromMealType))

      // Check if target slot is occupied
      const targetMeal = prev.find(m => m.date === toDate && m.mealType === toMealType)
      if (targetMeal) {
        // Swap positions
        const updatedMeals = withoutMeal.map(m =>
          m.date === toDate && m.mealType === toMealType
            ? { ...mealToMove, date: toDate, mealType: toMealType as any }
            : m
        )
        return [...updatedMeals, { ...targetMeal, date: fromDate, mealType: fromMealType as any }]
      } else {
        // Move to empty slot
        return [...withoutMeal, { ...mealToMove, date: toDate, mealType: toMealType as any }]
      }
    })
  }

  const handleDragStart = (meal: PlannedMeal) => {
    setDraggedMeal(meal)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent, toDate: string, toMealType: string) => {
    e.preventDefault()
    if (draggedMeal) {
      handleMoveMeal(draggedMeal.date, draggedMeal.mealType, toDate, toMealType)
      setDraggedMeal(null)
    }
  }

  const handleReplaceMeal = (newMeal: PlannedMeal) => {
    setMeals(prev => prev.map(meal =>
      meal.date === mealDetailsDialog.date && meal.mealType === mealDetailsDialog.mealType
        ? { ...newMeal, id: meal.id, accepted: true }
        : meal
    ))
  }

  const handleEditMeal = () => {
    // Close the details dialog and open the edit dialog with the meal data
    const currentMeal = mealDetailsDialog.meal
    setMealDetailsDialog({ open: false, meal: null, date: '', mealType: '' })

    if (onEditMeal && currentMeal) {
      // Pass the meal data to the edit handler
      onEditMeal({
        ...currentMeal,
        date: mealDetailsDialog.date,
        mealType: mealDetailsDialog.mealType as 'breakfast' | 'lunch' | 'dinner' | 'snack'
      })
    } else if (onAddMeal) {
      // Fallback to add meal if no edit handler
      onAddMeal(mealDetailsDialog.date, mealDetailsDialog.mealType)
    }
  }

  const handleConfirm = () => {
    // Only include accepted meals
    const acceptedMeals = meals.filter(m => m.accepted !== false)

    // Add attendance information to meals
    const mealsWithAttendance = acceptedMeals.map(meal => {
      const key = `${meal.date}-${meal.mealType}`
      const attendance = mealAttendance[key]
      return {
        ...meal,
        attendingMembers: attendance?.attendingMembers,
        dietaryNeeds: attendance?.dietaryNeeds
      }
    })

    onConfirm(mealsWithAttendance, mealTypes)
  }

  const days = getDaysOfWeek()

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h5">
            Review Your Meal Plan
          </Typography>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {pantryScorecard && (
          <Accordion sx={{ mb: 2 }}>
            <AccordionSummary
              expandIcon={<ExpandMore />}
              sx={{ bgcolor: 'primary.light', color: 'primary.contrastText' }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Inventory />
                <Typography variant="h6">Pantry Scorecard</Typography>
                {pantryScorecard.highlights && pantryScorecard.highlights[0] && (
                  <Chip
                    label={pantryScorecard.highlights[0].split('-')[0].trim()}
                    size="small"
                    sx={{ ml: 2, bgcolor: 'white', color: 'primary.main' }}
                  />
                )}
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <CheckBox color="success" />
                  <Typography variant="body2">
                    <strong>{pantryScorecard.pantryItemsUsed}</strong> pantry items will be used
                  </Typography>
                </Box>

                {pantryScorecard.expiringItemsUsed?.length > 0 && (
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                    <WarningAmber color="warning" fontSize="small" sx={{ mt: 0.5 }} />
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        Using expiring items:
                      </Typography>
                      {pantryScorecard.expiringItemsUsed.map((item: any, idx: number) => (
                        <Typography key={idx} variant="caption" display="block" sx={{ ml: 1 }}>
                          • {item.name} (expires in {item.expiresIn} day{item.expiresIn !== 1 ? 's' : ''})
                        </Typography>
                      ))}
                    </Box>
                  </Box>
                )}
              </Grid>

              <Grid item xs={12} sm={6}>
                {pantryScorecard.highlights?.map((highlight: string, idx: number) => (
                  <Alert key={idx} severity={highlight.includes('High') ? 'success' : highlight.includes('Limited') ? 'warning' : 'info'} sx={{ mb: 1 }}>
                    <Typography variant="caption">{highlight}</Typography>
                  </Alert>
                ))}
              </Grid>
            </Grid>

            {pantryScorecard.ingredientCoverage?.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>Ingredient Availability by Meal:</Typography>
                <Box sx={{ maxHeight: 200, overflowY: 'auto' }}>
                  {pantryScorecard.ingredientCoverage.map((meal: any, idx: number) => (
                    <Box key={idx} sx={{ mb: 1, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body2">
                          <strong>{meal.meal}</strong>
                        </Typography>
                        <Chip
                          size="small"
                          label={meal.coverage}
                          color={parseInt(meal.coverage) > 70 ? 'success' : parseInt(meal.coverage) > 40 ? 'warning' : 'error'}
                        />
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {meal.availableIngredients} of {meal.totalIngredients} ingredients available
                      </Typography>
                      {meal.missingIngredients?.length > 0 && (
                        <Box sx={{ mt: 0.5 }}>
                          <Typography variant="caption" color="error">
                            Missing: {meal.missingIngredients.slice(0, 3).join(', ')}
                            {meal.missingIngredients.length > 3 && ` +${meal.missingIngredients.length - 3} more`}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  ))}
                </Box>
              </Box>
            )}
            </AccordionDetails>
          </Accordion>
        )}

        {optionCompliance && optionCompliance.highlights && optionCompliance.highlights.length > 0 && (
          <Accordion sx={{ mb: 2 }}>
            <AccordionSummary
              expandIcon={<ExpandMore />}
              sx={{ bgcolor: 'info.light', color: 'info.contrastText' }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AutoAwesome />
                <Typography variant="h6">Meal Plan Optimization</Typography>
                {optionCompliance.highlights && optionCompliance.highlights[0] && (
                  <Chip
                    label={optionCompliance.highlights[0].split(':')[1] ? optionCompliance.highlights[0].split(':')[1].trim() : 'Optimized'}
                    size="small"
                    sx={{ ml: 2, bgcolor: 'white', color: 'info.main' }}
                  />
                )}
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              {optionCompliance.highlights.map((highlight: string, idx: number) => (
              <Alert
                key={idx}
                severity={
                  highlight.includes('✅') ? 'success' :
                  highlight.includes('⚠️') || highlight.includes('💸') ? 'warning' :
                  'info'
                }
                sx={{ mb: 1 }}
              >
                <Typography variant="body2">{highlight}</Typography>
              </Alert>
            ))}

            {/* Quick Meals Details */}
            {optionCompliance.quickMeals?.enabled && optionCompliance.quickMeals.details?.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Prep Time Analysis ({optionCompliance.quickMeals.compliance}% under 30 minutes)
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {optionCompliance.quickMeals.details.slice(0, 5).map((meal: any, idx: number) => (
                    <Chip
                      key={idx}
                      label={`${meal.meal}: ${meal.time} min`}
                      size="small"
                      color={meal.meetsTarget ? 'success' : 'warning'}
                      variant={meal.meetsTarget ? 'filled' : 'outlined'}
                    />
                  ))}
                  {optionCompliance.quickMeals.details.length > 5 && (
                    <Chip
                      label={`+${optionCompliance.quickMeals.details.length - 5} more`}
                      size="small"
                      variant="outlined"
                    />
                  )}
                </Box>
              </Box>
            )}

            {/* Budget Details */}
            {optionCompliance.budgetFriendly?.enabled && optionCompliance.budgetFriendly.details?.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Cost Analysis ({optionCompliance.budgetFriendly.compliance}% under $5.00)
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {optionCompliance.budgetFriendly.details.slice(0, 5).map((meal: any, idx: number) => (
                    <Chip
                      key={idx}
                      label={`${meal.meal}: $${meal.cost?.toFixed(2)}`}
                      size="small"
                      color={meal.meetsTarget ? 'success' : 'warning'}
                      variant={meal.meetsTarget ? 'filled' : 'outlined'}
                    />
                  ))}
                  {optionCompliance.budgetFriendly.details.length > 5 && (
                    <Chip
                      label={`+${optionCompliance.budgetFriendly.details.length - 5} more`}
                      size="small"
                      variant="outlined"
                    />
                  )}
                </Box>
              </Box>
            )}
            </AccordionDetails>
          </Accordion>
        )}

        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2">
            Customize your meal plan by selecting which meals you want for each day.
            Uncheck meals you don't want, or click "Find More Meals" to get additional suggestions.
          </Typography>
        </Alert>

        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" color="text.secondary">
            {getAcceptedMealsCount()} of {getTotalMealsNeeded()} meals selected
          </Typography>
        </Box>

        <Grid container spacing={2}>
          {days.map(({ date, dayName, dayDate }) => (
            <Grid item xs={12} key={date}>
              <Paper elevation={1} sx={{ p: { xs: 1, sm: 2 } }}>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="h6" gutterBottom sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                    {dayName}, {dayDate}
                  </Typography>

                  <Box display="flex" gap={1}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          size="small"
                          checked={mealTypes[date]?.breakfast || false}
                          onChange={() => toggleMealType(date, 'breakfast')}
                        />
                      }
                      label="Breakfast"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          size="small"
                          checked={mealTypes[date]?.lunch || false}
                          onChange={() => toggleMealType(date, 'lunch')}
                        />
                      }
                      label="Lunch"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          size="small"
                          checked={mealTypes[date]?.dinner || false}
                          onChange={() => toggleMealType(date, 'dinner')}
                        />
                      }
                      label="Dinner"
                    />
                  </Box>
                </Box>

                <Grid container spacing={2}>
                  {['breakfast', 'lunch', 'dinner'].map(mealType => {
                    if (!mealTypes[date]?.[mealType as keyof typeof mealTypes[typeof date]]) {
                      return null
                    }

                    const mealsForSlot = getMealsForDay(date, mealType)
                    const meal = mealsForSlot[0] // Show first meal, but indicate if there are more
                    const mealId = meal?.id || `${date}-${mealType}`
                    const hasMultipleMeals = mealsForSlot.length > 1

                    return (
                      <Grid item xs={12} sm={4} key={mealType}>
                        <Card
                          variant="outlined"
                          draggable={!!meal}
                          onDragStart={() => meal && handleDragStart(meal)}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, date, mealType)}
                          sx={{
                            opacity: meal && meal.accepted === false ? 0.5 : 1,
                            border: meal && meal.accepted !== false ? '2px solid' : '1px solid',
                            borderColor: meal && meal.accepted !== false ? 'primary.main' : 'divider',
                            cursor: meal ? 'grab' : 'default',
                            '&:active': {
                              cursor: meal ? 'grabbing' : 'default'
                            },
                            transition: 'all 0.2s',
                            '&:hover': {
                              boxShadow: meal ? 3 : 1
                            }
                          }}
                        >
                          <CardContent>
                            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                              <Box display="flex" alignItems="center" gap={1}>
                                {meal && (
                                  <DragHandle
                                    fontSize="small"
                                    sx={{ color: 'text.secondary', cursor: 'grab' }}
                                  />
                                )}
                                <Chip
                                  size="small"
                                  label={hasMultipleMeals ? `${mealType} (${mealsForSlot.length})` : mealType}
                                  color={
                                    mealType === 'breakfast' ? 'warning' :
                                    mealType === 'lunch' ? 'info' : 'success'
                                  }
                                />
                              </Box>
                              {meal && (
                                <Box>
                                  <Tooltip title="Meal Details">
                                    <IconButton
                                      size="small"
                                      onClick={() => handleMealDetailsClick(meal, date, mealType)}
                                      color="primary"
                                    >
                                      <Info />
                                    </IconButton>
                                  </Tooltip>
                                  <IconButton
                                    size="small"
                                    onClick={() => toggleMealAcceptance(mealId)}
                                    color={meal.accepted !== false ? 'success' : 'default'}
                                  >
                                    {meal.accepted !== false ? <CheckCircle /> : <Cancel />}
                                  </IconButton>
                                  <IconButton
                                    size="small"
                                    onClick={() => removeMeal(date, mealType)}
                                    color="error"
                                  >
                                    <Delete />
                                  </IconButton>
                                </Box>
                              )}
                            </Box>

                            {meal ? (
                              <>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                  <Box sx={{ flexGrow: 1 }}>
                                    <Typography variant="subtitle2">
                                      {meal.recipeName || meal.customMealName || 'Unnamed Meal'}
                                    </Typography>
                                    {(meal.recipeUrl || meal.recipeLink) && (
                                      <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <OpenInNew sx={{ fontSize: 10 }} />
                                        {getRecipeSource(meal.recipeUrl || meal.recipeLink)}
                                      </Typography>
                                    )}
                                  </Box>
                                  {(meal.recipeId || meal.recipeUrl || meal.recipeLink) && (
                                    <Tooltip title="View Recipe">
                                      <IconButton
                                        size="small"
                                        onClick={() => {
                                          const url = meal.recipeUrl || meal.recipeLink
                                          if (url) {
                                            window.open(url, '_blank')
                                          } else if (meal.recipeId) {
                                            window.open(`/recipes/${meal.recipeId}`, '_blank')
                                          }
                                        }}
                                      >
                                        {(meal.recipeUrl || meal.recipeLink) ? <OpenInNew fontSize="small" /> : <LocalDining fontSize="small" />}
                                      </IconButton>
                                    </Tooltip>
                                  )}
                                </Box>

                                {/* Dietary Tags */}
                                {meal.dietaryTags && meal.dietaryTags.length > 0 && (
                                  <Box sx={{ display: 'flex', gap: 0.5, mb: 1, flexWrap: 'wrap' }}>
                                    {meal.dietaryTags.map(tag => (
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
                                        sx={{ fontSize: '0.7rem', height: 20 }}
                                      />
                                    ))}
                                  </Box>
                                )}

                                {meal.prepTime && (
                                  <Typography variant="caption" display="block" color="text.secondary">
                                    <Schedule fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
                                    {meal.prepTime} min prep
                                    {meal.cookTime && ` + ${meal.cookTime} min cook`}
                                  </Typography>
                                )}
                                {meal.servings && (
                                  <Typography variant="caption" display="block" color="text.secondary">
                                    <Restaurant fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
                                    {meal.servings} servings
                                  </Typography>
                                )}

                                <Box sx={{ mt: 1 }}>
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    onClick={() => handleAttendanceClick(
                                      date,
                                      mealType,
                                      meal.recipeName || meal.customMealName || 'Unnamed Meal'
                                    )}
                                    sx={{ fontSize: '0.75rem' }}
                                  >
                                    Who's eating?
                                    {mealAttendance[`${date}-${mealType}`] && (
                                      <Chip
                                        size="small"
                                        label={mealAttendance[`${date}-${mealType}`].attendingMembers.length}
                                        sx={{ ml: 0.5, height: 20, fontSize: '0.7rem' }}
                                      />
                                    )}
                                  </Button>
                                </Box>
                              </>
                            ) : (
                              <Box sx={{ py: 2, textAlign: 'center' }}>
                                <Typography variant="body2" color="text.secondary">
                                  No meal selected
                                </Typography>
                                <Button
                                  size="small"
                                  startIcon={<Add />}
                                  sx={{ mt: 1 }}
                                  onClick={() => onAddMeal?.(date, mealType)}
                                >
                                  Add Meal
                                </Button>
                              </Box>
                            )}
                          </CardContent>
                        </Card>
                      </Grid>
                    )
                  })}
                </Grid>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button
          variant="outlined"
          startIcon={loading ? <CircularProgress size={16} /> : <Refresh />}
          onClick={handleFindMoreMeals}
          disabled={loading || getAcceptedMealsCount() >= getTotalMealsNeeded()}
        >
          Find More Meals
        </Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={getAcceptedMealsCount() === 0}
          startIcon={<CheckCircle />}
        >
          Confirm Plan ({getAcceptedMealsCount()} meals)
        </Button>
      </DialogActions>

      {attendanceDialog && (
        <MealAttendanceDialog
          open={attendanceDialog.open}
          onClose={() => setAttendanceDialog(null)}
          mealDate={attendanceDialog.date}
          mealType={attendanceDialog.mealType}
          mealName={attendanceDialog.mealName}
          onConfirm={handleAttendanceConfirm}
        />
      )}

      <MealDetailsDialog
        open={mealDetailsDialog.open}
        onClose={() => setMealDetailsDialog({ open: false, meal: null, date: '', mealType: '' })}
        meal={mealDetailsDialog.meal}
        date={mealDetailsDialog.date}
        mealType={mealDetailsDialog.mealType}
        onReplaceMeal={handleReplaceMeal}
        onEditMeal={handleEditMeal}
        onAddToRecipes={onAddToRecipes}
      />
    </Dialog>
  )
}