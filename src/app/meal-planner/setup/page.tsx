'use client'

import { useState, useEffect } from 'react'
import {
  Container,
  Box,
  Stepper,
  Step,
  StepLabel,
  StepButton,
  Button,
  Typography,
  Paper,
  TextField,
  Grid,
  Card,
  CardContent,
  IconButton,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Slider,
  Alert,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  RadioGroup,
  Radio,
  Autocomplete,
  ToggleButton,
  ToggleButtonGroup,
  Divider,
  CircularProgress,
  Fab,
  useTheme,
  useMediaQuery
} from '@mui/material'
import {
  Person as PersonIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Restaurant as RestaurantIcon,
  Schedule as ScheduleIcon,
  Kitchen as KitchenIcon,
  LocalGroceryStore as StoreIcon,
  Check as CheckIcon,
  Edit as EditIcon,
  NavigateNext as NextIcon,
  NavigateBefore as BackIcon,
  FitnessCenter as FitnessIcon,
  Warning as AllergyIcon,
  Favorite as FavoriteIcon,
  ThumbDown as DislikeIcon,
  AttachMoney as BudgetIcon,
  Timer as TimerIcon,
  School as SchoolIcon,
  Work as WorkIcon,
  SportsSoccer as SportsIcon,
  Home as HomeIcon
} from '@mui/icons-material'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getUserHouseholdFeatures } from '@/lib/features'

// Types
interface HouseholdMember {
  id?: string
  name: string
  ageGroup: string
  birthDate?: string
  isPrimaryPlanner: boolean
  dietaryRestrictions: DietaryRestriction[]
  dietType?: string
  nutritionalGoals?: NutritionalGoals
  foodPreferences: FoodPreference[]
}

interface DietaryRestriction {
  type: 'allergy' | 'intolerance' | 'preference' | 'medical' | 'religious' | 'ethical'
  name: string
  severity?: 'mild' | 'moderate' | 'severe' | 'life_threatening'
}

interface NutritionalGoals {
  calorieTarget?: number
  proteinTarget?: number
  carbTarget?: number
  fatTarget?: number
  sodiumLimit?: number
}

interface FoodPreference {
  type: 'like' | 'dislike' | 'favorite'
  category: 'ingredient' | 'cuisine' | 'cooking_method'
  value: string
  intensity: number
}

interface WeeklySchedule {
  [key: string]: {
    breakfast?: { time: number; location: string; attendees: number }
    lunch?: { time: number; location: string; attendees: number }
    dinner?: { time: number; location: string; attendees: number }
  }
}

const steps = [
  'Household Members',
  'Dietary Needs',
  'Food Preferences',
  'Schedule & Lifestyle',
  'Cooking Preferences',
  'Review & Confirm'
]

const ageGroups = [
  { value: 'infant', label: 'Infant (0-1)' },
  { value: 'toddler', label: 'Toddler (1-3)' },
  { value: 'child', label: 'Child (4-12)' },
  { value: 'teen', label: 'Teen (13-17)' },
  { value: 'adult', label: 'Adult (18-64)' },
  { value: 'senior', label: 'Senior (65+)' }
]

const dietTypes = [
  'Standard',
  'Vegetarian',
  'Vegan',
  'Pescatarian',
  'Keto',
  'Paleo',
  'Mediterranean',
  'Low Carb',
  'Low Fat',
  'Diabetic',
  'Gluten Free',
  'Dairy Free',
  'Halal',
  'Kosher'
]

const commonAllergies = [
  'Milk',
  'Eggs',
  'Peanuts',
  'Tree nuts',
  'Fish',
  'Shellfish',
  'Wheat',
  'Soy',
  'Sesame'
]

const cuisineTypes = [
  'American',
  'Italian',
  'Mexican',
  'Chinese',
  'Japanese',
  'Indian',
  'Thai',
  'Mediterranean',
  'French',
  'Greek',
  'Korean',
  'Vietnamese'
]

const cookingMethods = [
  'Grilled',
  'Baked',
  'Fried',
  'Steamed',
  'Roasted',
  'Slow Cooked',
  'Instant Pot',
  'Air Fried',
  'Raw/Fresh',
  'Stir-fried'
]

export default function MealPlannerSetup() {
  const router = useRouter()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const [activeStep, setActiveStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form data
  const [members, setMembers] = useState<HouseholdMember[]>([
    {
      name: '',
      ageGroup: 'adult',
      isPrimaryPlanner: true,
      dietaryRestrictions: [],
      foodPreferences: []
    }
  ])

  const [currentMemberIndex, setCurrentMemberIndex] = useState(0)
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklySchedule>({})
  const [cookingPreferences, setCookingPreferences] = useState({
    skillLevel: 'intermediate',
    weekdayPrepTime: 30,
    weekendPrepTime: 60,
    mealPrepDay: '',
    shoppingDay: 'saturday',
    budgetPerWeek: 150,
    preferredStores: [],
    kitchenEquipment: [],
    preferredCuisines: []
  })

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        // Check if meal planning is enabled
        const features = await getUserHouseholdFeatures(session.user.id)
        if (!features.meal_planner_enabled) {
          router.push('/?feature=meal_planner_disabled')
          return
        }
        setUser(session.user)

        // Load existing family members and preferences
        await loadExistingData(session.user.id)
      } else {
        router.push('/auth')
      }
    }
    getUser()
  }, [router])

  const loadExistingData = async (userId: string) => {
    try {
      setLoading(true)

      // Get household ID
      const { data: householdData } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', userId)
        .single()

      const householdId = householdData?.household_id || userId

      // Load family members
      const { data: familyMembers } = await supabase
        .from('family_members')
        .select('*')
        .eq('household_id', householdId)
        .order('created_at', { ascending: true })

      if (familyMembers && familyMembers.length > 0) {
        // Convert family members data to the format used by the form
        const membersWithDetails = familyMembers.map(member => {
          // Parse dietary restrictions and allergies
          const dietaryRestrictions: DietaryRestriction[] = []

          // Add diet type as a restriction if it exists
          if (member.dietary_restrictions && Array.isArray(member.dietary_restrictions)) {
            // Find if any of the dietary restrictions is a known diet type
            const dietType = member.dietary_restrictions.find((r: string) =>
              dietTypes.includes(r.charAt(0).toUpperCase() + r.slice(1))
            )

            // Add allergies from food_allergies array
            if (member.food_allergies && Array.isArray(member.food_allergies)) {
              member.food_allergies.forEach((allergy: string) => {
                dietaryRestrictions.push({
                  type: 'allergy',
                  name: allergy,
                  severity: 'severe'
                })
              })
            }

            // Add other dietary restrictions
            member.dietary_restrictions.forEach((restriction: string) => {
              if (!dietTypes.some(dt => dt.toLowerCase() === restriction.toLowerCase())) {
                dietaryRestrictions.push({
                  type: 'restriction',
                  name: restriction,
                  severity: 'preference'
                })
              }
            })

            // Parse food preferences from different columns
            const foodPrefs: FoodPreference[] = []

            // Add disliked ingredients
            if (member.disliked_ingredients && Array.isArray(member.disliked_ingredients)) {
              member.disliked_ingredients.forEach((item: string) => {
                foodPrefs.push({
                  type: 'dislike',
                  category: 'ingredient',
                  value: item,
                  intensity: 8
                })
              })
            }

            // Add preferred cuisines
            if (member.preferred_cuisines && Array.isArray(member.preferred_cuisines)) {
              member.preferred_cuisines.forEach((cuisine: string) => {
                foodPrefs.push({
                  type: 'like',
                  category: 'cuisine',
                  value: cuisine,
                  intensity: 7
                })
              })
            }

            return {
              id: member.id,
              name: member.name,
              ageGroup: member.age_group || 'adult',
              birthDate: member.birth_date,
              isPrimaryPlanner: member.is_primary_meal_planner || false,
              dietType: dietType ? dietType.charAt(0).toUpperCase() + dietType.slice(1) : '',
              dietaryRestrictions,
              foodPreferences: foodPrefs
            }
          }

          return {
            id: member.id,
            name: member.name,
            ageGroup: member.age_group || 'adult',
            birthDate: member.birth_date,
            isPrimaryPlanner: member.is_primary_meal_planner || false,
            dietType: '',
            dietaryRestrictions,
            foodPreferences: []
          }
        })

        setMembers(membersWithDetails)
      }

      // Load household meal preferences
      const { data: mealPrefs } = await supabase
        .from('household_meal_preferences')
        .select('*')
        .eq('household_id', householdId)
        .single()

      if (mealPrefs) {
        setCookingPreferences({
          skillLevel: mealPrefs.cooking_skill_level || 'intermediate',
          weekdayPrepTime: mealPrefs.max_cooking_time_minutes || 30,
          weekendPrepTime: 60,
          mealPrepDay: '',
          shoppingDay: mealPrefs.shopping_day || 'saturday',
          budgetPerWeek: mealPrefs.budget_per_week || 150,
          preferredStores: mealPrefs.preferred_stores || [],
          kitchenEquipment: mealPrefs.kitchen_equipment || [],
          preferredCuisines: mealPrefs.preferred_cuisines || []
        })
      }

      setSuccess('Loaded existing meal planning profile')
    } catch (error) {
      console.error('Error loading existing data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleNext = () => {
    setActiveStep((prevStep) => prevStep + 1)
  }

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1)
  }

  const handleAddMember = () => {
    setMembers([
      ...members,
      {
        name: '',
        ageGroup: 'adult',
        isPrimaryPlanner: false,
        dietaryRestrictions: [],
        foodPreferences: []
      }
    ])
  }

  const handleRemoveMember = (index: number) => {
    setMembers(members.filter((_, i) => i !== index))
  }

  const handleMemberChange = (index: number, field: string, value: any) => {
    const updatedMembers = [...members]
    updatedMembers[index] = { ...updatedMembers[index], [field]: value }
    setMembers(updatedMembers)
  }

  const handleAddRestriction = (memberIndex: number, restriction: DietaryRestriction) => {
    const updatedMembers = [...members]
    updatedMembers[memberIndex].dietaryRestrictions.push(restriction)
    setMembers(updatedMembers)
  }

  const handleAddPreference = (memberIndex: number, preference: FoodPreference) => {
    const updatedMembers = [...members]
    updatedMembers[memberIndex].foodPreferences.push(preference)
    setMembers(updatedMembers)
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)

    try {
      // Get the user's household ID
      const { data: householdData, error: householdError } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', user.id)
        .single()

      if (householdError) {
        // Try using user.id as household_id (legacy single-user mode)
        console.log('Using user.id as household_id')
      }

      const householdId = householdData?.household_id || user.id

      // Save all the data to the database
      for (const member of members) {
        let savedMember

        // Prepare dietary data for saving
        const dietaryRestrictionsList: string[] = []
        const allergyList: string[] = []

        // Add diet type to dietary restrictions if set
        if (member.dietType && member.dietType !== '') {
          dietaryRestrictionsList.push(member.dietType.toLowerCase())
        }

        // Separate allergies and other restrictions
        member.dietaryRestrictions.forEach(restriction => {
          if (restriction.type === 'allergy') {
            allergyList.push(restriction.name)
          } else if (restriction.name && !dietTypes.some(dt => dt.toLowerCase() === restriction.name.toLowerCase())) {
            dietaryRestrictionsList.push(restriction.name.toLowerCase())
          }
        })

        // Get disliked ingredients and preferred cuisines from food preferences
        const dislikedIngredients = member.foodPreferences
          ?.filter(p => p.type === 'dislike' && p.category === 'ingredient')
          ?.map(p => p.value) || []

        const preferredCuisines = member.foodPreferences
          ?.filter(p => p.type === 'like' && p.category === 'cuisine')
          ?.map(p => p.value) || []

        if (member.id) {
          // Update existing member with dietary preferences
          const { data, error: memberError } = await supabase
            .from('family_members')
            .update({
              name: member.name,
              age_group: member.ageGroup,
              is_primary_meal_planner: member.isPrimaryPlanner,
              dietary_restrictions: dietaryRestrictionsList,
              food_allergies: allergyList,
              disliked_ingredients: dislikedIngredients,
              preferred_cuisines: preferredCuisines,
              updated_at: new Date().toISOString()
            })
            .eq('id', member.id)
            .select()
            .single()

          if (memberError) {
            console.error('Error updating member:', memberError)
            throw new Error(`Failed to update member ${member.name}: ${memberError.message}`)
          }
          savedMember = data
        } else {
          // Insert new member with dietary preferences
          const { data, error: memberError } = await supabase
            .from('family_members')
            .insert({
              household_id: householdId,
              name: member.name,
              age_group: member.ageGroup,
              is_primary_meal_planner: member.isPrimaryPlanner,
              dietary_restrictions: dietaryRestrictionsList,
              food_allergies: allergyList,
              disliked_ingredients: dislikedIngredients,
              preferred_cuisines: preferredCuisines
            })
            .select()
            .single()

          if (memberError) {
            console.error('Error saving member:', memberError)
            throw new Error(`Failed to save member ${member.name}: ${memberError.message}`)
          }
          savedMember = data
        }

        // All dietary data is now saved directly in the family_members table columns
        // No need for separate member_dietary_restrictions or food_preferences tables
      }

      // Save household meal preferences
      const { error: householdPrefError } = await supabase
        .from('household_meal_preferences')
        .upsert({
          household_id: householdId,
          cooking_skill_level: cookingPreferences.skillLevel,
          max_cooking_time_minutes: cookingPreferences.weekdayPrepTime, // Using weekday prep time as max cooking time
          shopping_day: cookingPreferences.shoppingDay,
          budget_per_week: cookingPreferences.budgetPerWeek,
          preferred_cuisines: cookingPreferences.preferredCuisines || [],
          kitchen_equipment: cookingPreferences.kitchenEquipment || [],
          preferred_stores: cookingPreferences.preferredStores || [],
          servings_per_meal: 4,
          include_leftovers: true
        }, {
          onConflict: 'household_id' // Upsert if preferences already exist
        })

      if (householdPrefError) {
        console.error('Error saving household preferences:', householdPrefError)
        throw new Error(`Failed to save household preferences: ${householdPrefError.message}`)
      }

      // Success! Navigate to meal planner
      setSuccess('Meal planning profile saved successfully!')
      setTimeout(() => {
        router.push('/meal-planner')
      }, 1500)
    } catch (error: any) {
      console.error('Error saving meal planning preferences:', error)
      setError(error.message || 'Failed to save meal planning preferences. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const renderStepContent = () => {
    switch (activeStep) {
      case 0: // Household Members
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Who's in your household?
            </Typography>
            <Typography variant="body2" color="textSecondary" paragraph>
              Add each person who will be included in meal planning
            </Typography>

            <List>
              {members.map((member, index) => (
                <Card key={index} sx={{ mb: 2 }}>
                  <CardContent>
                    <Grid container spacing={2} alignItems="center">
                      <Grid item xs={12} sm={4}>
                        <TextField
                          fullWidth
                          label="Name"
                          value={member.name}
                          onChange={(e) => handleMemberChange(index, 'name', e.target.value)}
                          placeholder="e.g., John"
                        />
                      </Grid>
                      <Grid item xs={12} sm={3}>
                        <FormControl fullWidth>
                          <InputLabel>Age Group</InputLabel>
                          <Select
                            value={member.ageGroup}
                            onChange={(e) => handleMemberChange(index, 'ageGroup', e.target.value)}
                            label="Age Group"
                          >
                            {ageGroups.map((group) => (
                              <MenuItem key={group.value} value={group.value}>
                                {group.label}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} sm={3}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={member.isPrimaryPlanner}
                              onChange={(e) => handleMemberChange(index, 'isPrimaryPlanner', e.target.checked)}
                            />
                          }
                          label="Primary Planner"
                        />
                      </Grid>
                      <Grid item xs={12} sm={2}>
                        {members.length > 1 && (
                          <IconButton
                            color="error"
                            onClick={() => handleRemoveMember(index)}
                          >
                            <DeleteIcon />
                          </IconButton>
                        )}
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              ))}
            </List>

            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={handleAddMember}
              fullWidth
            >
              Add Another Member
            </Button>
          </Box>
        )

      case 1: // Dietary Needs
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Dietary Restrictions & Allergies
            </Typography>

            {members.map((member, memberIndex) => (
              <Card key={memberIndex} sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="subtitle1" gutterBottom>
                    <PersonIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
                    {member.name || 'Member ' + (memberIndex + 1)}
                  </Typography>

                  {/* Diet Type */}
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>Diet Type</InputLabel>
                    <Select
                      value={member.dietType || ''}
                      onChange={(e) => handleMemberChange(memberIndex, 'dietType', e.target.value)}
                      label="Diet Type"
                    >
                      <MenuItem value="">None</MenuItem>
                      {dietTypes.map((diet) => (
                        <MenuItem key={diet} value={diet}>
                          {diet}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  {/* Allergies */}
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    Select any allergies or intolerances:
                  </Typography>
                  <Box sx={{ mb: 2 }}>
                    {commonAllergies.map((allergy) => (
                      <Chip
                        key={allergy}
                        label={allergy}
                        onClick={() => {
                          const exists = member.dietaryRestrictions.some(
                            r => r.name === allergy && r.type === 'allergy'
                          )
                          if (!exists) {
                            handleAddRestriction(memberIndex, {
                              type: 'allergy',
                              name: allergy,
                              severity: 'moderate'
                            })
                          }
                        }}
                        color={
                          member.dietaryRestrictions.some(r => r.name === allergy)
                            ? 'primary'
                            : 'default'
                        }
                        sx={{ m: 0.5 }}
                      />
                    ))}
                  </Box>

                  {/* Current Restrictions */}
                  {member.dietaryRestrictions.length > 0 && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="body2" gutterBottom>
                        Current Restrictions:
                      </Typography>
                      {member.dietaryRestrictions.map((restriction, rIndex) => (
                        <Chip
                          key={rIndex}
                          label={`${restriction.name} (${restriction.type})`}
                          onDelete={() => {
                            const updated = [...members]
                            updated[memberIndex].dietaryRestrictions =
                              updated[memberIndex].dietaryRestrictions.filter((_, i) => i !== rIndex)
                            setMembers(updated)
                          }}
                          color="error"
                          sx={{ m: 0.5 }}
                        />
                      ))}
                    </Box>
                  )}
                </CardContent>
              </Card>
            ))}
          </Box>
        )

      case 2: // Food Preferences
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Food Preferences
            </Typography>

            {members.map((member, memberIndex) => (
              <Card key={memberIndex} sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="subtitle1" gutterBottom>
                    <PersonIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
                    {member.name || 'Member ' + (memberIndex + 1)}
                  </Typography>

                  {/* Cuisine Preferences */}
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    Favorite Cuisines:
                  </Typography>
                  <Box sx={{ mb: 2 }}>
                    {cuisineTypes.map((cuisine) => (
                      <Chip
                        key={cuisine}
                        label={cuisine}
                        onClick={() => {
                          handleAddPreference(memberIndex, {
                            type: 'like',
                            category: 'cuisine',
                            value: cuisine,
                            intensity: 7
                          })
                        }}
                        color={
                          member.foodPreferences.some(
                            p => p.value === cuisine && p.type === 'like'
                          ) ? 'primary' : 'default'
                        }
                        sx={{ m: 0.5 }}
                      />
                    ))}
                  </Box>

                  {/* Cooking Methods */}
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    Preferred Cooking Methods:
                  </Typography>
                  <Box sx={{ mb: 2 }}>
                    {cookingMethods.map((method) => (
                      <Chip
                        key={method}
                        label={method}
                        onClick={() => {
                          handleAddPreference(memberIndex, {
                            type: 'like',
                            category: 'cooking_method',
                            value: method,
                            intensity: 7
                          })
                        }}
                        color={
                          member.foodPreferences.some(
                            p => p.value === method && p.type === 'like'
                          ) ? 'primary' : 'default'
                        }
                        sx={{ m: 0.5 }}
                      />
                    ))}
                  </Box>

                  {/* Dislikes */}
                  <TextField
                    fullWidth
                    label="Foods to Avoid (comma separated)"
                    placeholder="e.g., mushrooms, olives, spicy food"
                    onBlur={(e) => {
                      const dislikes = e.target.value.split(',').map(s => s.trim()).filter(s => s)
                      dislikes.forEach(dislike => {
                        handleAddPreference(memberIndex, {
                          type: 'dislike',
                          category: 'ingredient',
                          value: dislike,
                          intensity: 8
                        })
                      })
                    }}
                    sx={{ mt: 2 }}
                  />
                </CardContent>
              </Card>
            ))}
          </Box>
        )

      case 3: // Schedule & Lifestyle
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Weekly Schedule & Lifestyle
            </Typography>
            <Typography variant="body2" color="textSecondary" paragraph>
              Help us understand your typical week so we can suggest appropriate meals
            </Typography>

            <Grid container spacing={3}>
              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day) => (
                <Grid item xs={12} key={day}>
                  <Card>
                    <CardContent>
                      <Typography variant="subtitle2" gutterBottom>
                        {day}
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={4}>
                          <TextField
                            fullWidth
                            label="Dinner Prep Time"
                            type="number"
                            InputProps={{ endAdornment: 'min' }}
                            defaultValue={30}
                            onChange={(e) => {
                              setWeeklySchedule({
                                ...weeklySchedule,
                                [day.toLowerCase()]: {
                                  ...weeklySchedule[day.toLowerCase()],
                                  dinner: {
                                    time: parseInt(e.target.value),
                                    location: 'home',
                                    attendees: members.length
                                  }
                                }
                              })
                            }}
                          />
                        </Grid>
                        <Grid item xs={8}>
                          <TextField
                            fullWidth
                            label="Notes (optional)"
                            placeholder="e.g., Soccer practice, Late meeting"
                          />
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        )

      case 4: // Cooking Preferences
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Cooking Preferences & Kitchen Setup
            </Typography>

            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Cooking Skill Level</InputLabel>
                  <Select
                    value={cookingPreferences.skillLevel}
                    onChange={(e) => setCookingPreferences({
                      ...cookingPreferences,
                      skillLevel: e.target.value
                    })}
                    label="Cooking Skill Level"
                  >
                    <MenuItem value="beginner">Beginner</MenuItem>
                    <MenuItem value="intermediate">Intermediate</MenuItem>
                    <MenuItem value="advanced">Advanced</MenuItem>
                    <MenuItem value="expert">Expert</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Weekly Grocery Budget"
                  type="number"
                  InputProps={{ startAdornment: '$' }}
                  value={cookingPreferences.budgetPerWeek}
                  onChange={(e) => setCookingPreferences({
                    ...cookingPreferences,
                    budgetPerWeek: parseInt(e.target.value)
                  })}
                />
              </Grid>

              <Grid item xs={12}>
                <Typography variant="body2" gutterBottom>
                  Typical Weekday Prep Time: {cookingPreferences.weekdayPrepTime} minutes
                </Typography>
                <Slider
                  value={cookingPreferences.weekdayPrepTime}
                  onChange={(_, value) => setCookingPreferences({
                    ...cookingPreferences,
                    weekdayPrepTime: value as number
                  })}
                  min={15}
                  max={90}
                  step={15}
                  marks
                  valueLabelDisplay="auto"
                />
              </Grid>

              <Grid item xs={12}>
                <Typography variant="body2" gutterBottom>
                  Weekend Prep Time: {cookingPreferences.weekendPrepTime} minutes
                </Typography>
                <Slider
                  value={cookingPreferences.weekendPrepTime}
                  onChange={(_, value) => setCookingPreferences({
                    ...cookingPreferences,
                    weekendPrepTime: value as number
                  })}
                  min={30}
                  max={180}
                  step={15}
                  marks
                  valueLabelDisplay="auto"
                />
              </Grid>

              <Grid item xs={12}>
                <Typography variant="body2" gutterBottom>
                  Kitchen Equipment Available:
                </Typography>
                <Box>
                  {['Instant Pot', 'Slow Cooker', 'Air Fryer', 'Grill', 'Stand Mixer', 'Food Processor'].map((equipment) => (
                    <Chip
                      key={equipment}
                      label={equipment}
                      onClick={() => {
                        const updated = cookingPreferences.kitchenEquipment.includes(equipment)
                          ? cookingPreferences.kitchenEquipment.filter(e => e !== equipment)
                          : [...cookingPreferences.kitchenEquipment, equipment]
                        setCookingPreferences({
                          ...cookingPreferences,
                          kitchenEquipment: updated
                        })
                      }}
                      color={cookingPreferences.kitchenEquipment.includes(equipment) ? 'primary' : 'default'}
                      sx={{ m: 0.5 }}
                    />
                  ))}
                </Box>
              </Grid>
            </Grid>
          </Box>
        )

      case 5: // Review & Confirm
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Review Your Preferences
            </Typography>

            <Alert severity="info" sx={{ mb: 2 }}>
              We'll use this information to create personalized meal plans that work for your household!
            </Alert>

            <Paper sx={{ p: 2, mb: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                <PersonIcon /> Household Members ({members.length})
              </Typography>
              {members.map((member, index) => (
                <Typography key={index} variant="body2">
                  • {member.name} ({member.ageGroup})
                  {member.dietType && ` - ${member.dietType}`}
                  {member.dietaryRestrictions.length > 0 &&
                    ` - ${member.dietaryRestrictions.length} restriction(s)`}
                </Typography>
              ))}
            </Paper>

            <Paper sx={{ p: 2, mb: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                <KitchenIcon /> Cooking Preferences
              </Typography>
              <Typography variant="body2">• Skill Level: {cookingPreferences.skillLevel}</Typography>
              <Typography variant="body2">• Weekly Budget: ${cookingPreferences.budgetPerWeek}</Typography>
              <Typography variant="body2">• Weekday Prep Time: {cookingPreferences.weekdayPrepTime} min</Typography>
              <Typography variant="body2">• Weekend Prep Time: {cookingPreferences.weekendPrepTime} min</Typography>
            </Paper>

            <Button
              variant="contained"
              color="primary"
              fullWidth
              size="large"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : (members.some(m => m.id) ? 'Update Meal Planning Profile' : 'Start Meal Planning!')}
            </Button>
          </Box>
        )

      default:
        return null
    }
  }

  return (
    <Container maxWidth="md" sx={{ py: isMobile ? 2 : 4 }}>
      <Paper sx={{ p: isMobile ? 2 : 3 }}>
        <Typography variant={isMobile ? "h5" : "h4"} gutterBottom align="center">
          <RestaurantIcon sx={{ verticalAlign: 'middle', mr: isMobile ? 1 : 2, fontSize: isMobile ? 24 : 32 }} />
          {isMobile ? "Meal Setup" : "Meal Planning Setup"}
        </Typography>

        <Stepper
          activeStep={activeStep}
          sx={{ my: isMobile ? 2 : 4 }}
          orientation={isMobile ? 'vertical' : 'horizontal'}
          alternativeLabel={!isMobile}
        >
          {steps.map((label, index) => (
            <Step key={label}>
              <StepButton onClick={() => setActiveStep(index)}>
                {isMobile ? label.split(' ').slice(0, 2).join(' ') : label}
              </StepButton>
            </Step>
          ))}
        </Stepper>

        {error && (
          <Alert severity="error" sx={{ mt: 2, mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mt: 2, mb: 2 }}>
            {success}
          </Alert>
        )}

        <Box sx={{ mt: 3, mb: 2 }}>
          {renderStepContent()}
        </Box>

        <Box sx={{
          display: 'flex',
          justifyContent: 'space-between',
          mt: 3,
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? 2 : 0
        }}>
          <Button
            disabled={activeStep === 0}
            onClick={handleBack}
            startIcon={!isMobile && <BackIcon />}
            fullWidth={isMobile}
            variant={isMobile ? "outlined" : "text"}
          >
            {isMobile && <BackIcon sx={{ mr: 1 }} />}
            Back
          </Button>

          {activeStep < steps.length - 1 ? (
            <Button
              variant="contained"
              onClick={handleNext}
              endIcon={!isMobile && <NextIcon />}
              disabled={
                activeStep === 0 && members.some(m => !m.name) // Require names
              }
              fullWidth={isMobile}
            >
              Next
              {isMobile && <NextIcon sx={{ ml: 1 }} />}
            </Button>
          ) : null}
        </Box>
      </Paper>
    </Container>
  )
}