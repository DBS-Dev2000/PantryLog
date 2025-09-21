'use client'

import { useState } from 'react'
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
  Divider
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
  Edit
} from '@mui/icons-material'
import { format, startOfWeek, addDays } from 'date-fns'
import MealAttendanceDialog from './MealAttendanceDialog'

interface PlannedMeal {
  id?: string
  date: string
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  recipeId?: string
  customMealName?: string
  recipeName?: string
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
}

export default function MealPlanPreview({
  open,
  onClose,
  plannedMeals: initialMeals,
  weekStart,
  onConfirm,
  onRegenerateMeals
}: MealPlanPreviewProps) {
  const [meals, setMeals] = useState<PlannedMeal[]>(initialMeals)
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
              <Paper elevation={1} sx={{ p: 2 }}>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="h6" gutterBottom>
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

                    const meal = getMealForDay(date, mealType)
                    const mealId = meal?.id || `${date}-${mealType}`

                    return (
                      <Grid item xs={12} sm={4} key={mealType}>
                        <Card
                          variant="outlined"
                          sx={{
                            opacity: meal && meal.accepted === false ? 0.5 : 1,
                            border: meal && meal.accepted !== false ? '2px solid' : '1px solid',
                            borderColor: meal && meal.accepted !== false ? 'primary.main' : 'divider'
                          }}
                        >
                          <CardContent>
                            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                              <Chip
                                size="small"
                                label={mealType}
                                color={
                                  mealType === 'breakfast' ? 'warning' :
                                  mealType === 'lunch' ? 'info' : 'success'
                                }
                              />
                              {meal && (
                                <Box>
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
                                <Typography variant="subtitle2" gutterBottom>
                                  {meal.recipeName || meal.customMealName || 'Unnamed Meal'}
                                </Typography>
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
                                  onClick={() => {/* TODO: Open meal selector */}}
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
    </Dialog>
  )
}