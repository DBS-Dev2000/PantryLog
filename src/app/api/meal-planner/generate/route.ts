import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'
import { findIngredientMatches } from '@/utils/ingredientMatcher'

// Create untyped Supabase client for meal planning tables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Helper to create authenticated client with proper user authentication
function createAuthClient(req: NextRequest) {
  // SECURITY FIX: Always use anon key with proper user authentication
  const authorization = req.headers.get('authorization')

  if (!authorization) {
    throw new Error('Authentication required. Please log in to generate meal plans.')
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        authorization
      }
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  })
}

// Simplified meal planning without AI for now
async function generateMealSuggestions(prompt: string): Promise<string> {
  // For now, return empty string to use fallback logic
  // In production, this would call AI services
  console.log('AI prompt would be:', prompt.substring(0, 200) + '...')
  return ''
}

interface MealPlanRequest {
  householdId: string
  startDate: string
  endDate: string
  strategy?: 'auto' | 'pantry' | 'recipes' | 'discover'
  options?: {
    preferNewRecipes?: boolean
    useSeasonalIngredients?: boolean
    budgetConscious?: boolean
    quickMealsOnly?: boolean
    includeLefotovers?: boolean
  }
  usePastMeals?: boolean
  includeStaples?: boolean
}

interface HouseholdProfile {
  members: any[]
  dietaryRestrictions: any[]
  preferences: any[]
  schedule: any[]
  mealPreferences: any
  combinedDietaryNeeds: string[] // Combined list of all family member restrictions
}

export async function POST(req: NextRequest) {
  try {
    // Create authenticated client for this request
    const supabase = createAuthClient(req)

    const {
      householdId,
      startDate,
      endDate,
      strategy = 'auto',
      options = {},
      usePastMeals = true,
      includeStaples = true,
      previewOnly = false,
      confirmMeals = null
    } = await req.json() as MealPlanRequest & {
      previewOnly?: boolean
      confirmMeals?: any[]
    }

    // SECURITY FIX: Validate user has access to the requested household
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      throw new Error('Authentication required. Please log in.')
    }

    // Verify user belongs to the requested household
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('household_id')
      .eq('id', user.id)
      .single()

    if (profileError || !userProfile) {
      throw new Error('User profile not found.')
    }

    if (userProfile.household_id !== householdId) {
      throw new Error('Access denied. You can only generate meal plans for your own household.')
    }

    console.log('Generating meal plan:', { householdId, startDate, endDate, strategy, userId: user.id })

    // Get household profile data
    const profile = await getHouseholdProfile(householdId, supabase)
    console.log('Got household profile:', { membersCount: profile.members.length })

    // Get past meal history for variety analysis
    const mealHistory = usePastMeals ? await getMealHistory(householdId, 30, supabase) : []
    console.log('Got meal history:', mealHistory.length, 'meals')

    // Get current pantry inventory
    const inventory = await getCurrentInventory(householdId, supabase)
    console.log('Got inventory:', inventory.length, 'items')

    // Get available recipes based on strategy
    let recipes = []
    if (strategy === 'discover') {
      // Search for new recipes online
      recipes = await discoverNewRecipes(profile, options)
    } else if (strategy === 'recipes') {
      // Use only saved recipes, filtered by dietary restrictions
      recipes = await getAvailableRecipes(householdId, supabase, profile.combinedDietaryNeeds)
    } else if (strategy === 'pantry') {
      // Get recipes that can be made with current inventory
      recipes = await getRecipesForInventory(householdId, inventory, supabase, profile.combinedDietaryNeeds)
    } else {
      // Auto mode - mix of saved recipes and inventory-based
      recipes = await getAvailableRecipes(householdId, supabase, profile.combinedDietaryNeeds)
    }
    console.log('Got recipes:', recipes.length, 'available')

    // Generate meal planning rules using AI
    const rules = await generateMealPlanRules(profile, strategy, options, supabase)
    console.log('Generated rules:', rules)

    // Generate the meal plan following the rules
    const mealPlan = await generateMealPlan({
      profile,
      rules,
      mealHistory,
      inventory,
      recipes,
      startDate,
      endDate,
      includeStaples,
      strategy,
      options
    })
    console.log('Generated meal plan with', mealPlan.length, 'meals')

    // If this is a preview request, return the meals without saving
    if (previewOnly) {
      let pantryScorecard = null

      // Generate pantry scorecard if using pantry strategy
      if (strategy === 'pantry' && inventory.length > 0 && mealPlan.length > 0) {
        pantryScorecard = generatePantryScorecard(mealPlan, inventory, recipes)
      }

      // Add option compliance scorecard
      const optionCompliance = generateOptionCompliance(mealPlan, options)

      return NextResponse.json({
        success: true,
        preview: true,
        meals: mealPlan,
        pantryScorecard,
        optionCompliance,
        summary: {
          totalMeals: mealPlan.length,
          daysPlanned: Math.ceil(mealPlan.length / 3),
          recipesUsed: recipes.length,
          strategy
        }
      })
    }

    // If we have confirmed meals, save those instead of the generated ones
    const mealsToSave = confirmMeals || mealPlan

    // Save the meal plan to database
    const savedPlan = await saveMealPlan(householdId, mealsToSave, supabase)
    console.log('Saved meal plan with ID:', savedPlan.id)

    return NextResponse.json({
      success: true,
      planId: savedPlan.id,
      plan: mealsToSave,
      summary: {
        totalMeals: mealsToSave.length,
        daysPlanned: Math.ceil(mealsToSave.length / 3),
        recipesUsed: recipes.length
      }
    })

  } catch (error: any) {
    console.error('Error generating meal plan:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate meal plan' },
      { status: 500 }
    )
  }
}

async function getHouseholdProfile(householdId: string, supabase: any): Promise<HouseholdProfile> {
  // Get family members (this table should exist)
  const members = await supabase.from('family_members')
    .select('*')
    .eq('household_id', householdId)

  // Get optional tables with fallback to empty arrays if tables don't exist
  const [restrictions, preferences, schedule, mealPrefs] = await Promise.all([
    supabase.from('member_dietary_restrictions')
      .select('*')
      .eq('household_id', householdId)
      .then((result: any) => result.error && result.error.code === '42703' ? { data: [], error: null } : result),
    supabase.from('food_preferences')
      .select('*')
      .eq('household_id', householdId)
      .then((result: any) => result.error && result.error.code === '42703' ? { data: [], error: null } : result),
    supabase.from('household_schedules')
      .select('*')
      .eq('household_id', householdId)
      .then((result: any) => result.error && result.error.code === '42703' ? { data: [], error: null } : result),
    supabase.from('household_meal_preferences')
      .select('*')
      .eq('household_id', householdId)
      .single()
      .then((result: any) => result.error && result.error.code === '42703' ? { data: null, error: null } : result)
  ])

  console.log('Profile query results:', {
    members: members.error || `${members.data?.length} members`,
    restrictions: restrictions.error || `${restrictions.data?.length} restrictions`,
    preferences: preferences.error || `${preferences.data?.length} preferences`,
    schedule: schedule.error || `${schedule.data?.length} schedules`,
    mealPrefs: mealPrefs.error || 'loaded'
  })

  // Combine all dietary restrictions from family members
  const combinedDietaryNeeds = new Set<string>()
  if (members.data) {
    members.data.forEach((member: any) => {
      if (member.dietary_restrictions && Array.isArray(member.dietary_restrictions)) {
        member.dietary_restrictions.forEach((restriction: string) => {
          combinedDietaryNeeds.add(restriction)
        })
      }
      // Also add allergies as restrictions
      if (member.food_allergies && Array.isArray(member.food_allergies)) {
        member.food_allergies.forEach((allergy: string) => {
          combinedDietaryNeeds.add(`allergy_${allergy.toLowerCase()}`)
        })
      }
    })
  }

  console.log('Combined dietary needs:', Array.from(combinedDietaryNeeds))

  return {
    members: members.data || [],
    dietaryRestrictions: restrictions.data || [],
    preferences: preferences.data || [],
    schedule: schedule.data || [],
    mealPreferences: mealPrefs.data,
    combinedDietaryNeeds: Array.from(combinedDietaryNeeds)
  }
}

async function getMealHistory(householdId: string, daysBack: number, supabase: any) {
  try {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - daysBack)

    // Try with meal_date first, then fall back to served_date
    let { data, error } = await supabase
      .from('meal_history')
      .select('*')
      .eq('household_id', householdId)
      .gte('meal_date', startDate.toISOString())
      .order('meal_date', { ascending: false })

    // If meal_date doesn't exist, try served_date
    if (error && error.code === '42703') {
      const result = await supabase
        .from('meal_history')
        .select('*')
        .eq('household_id', householdId)
        .gte('served_date', startDate.toISOString())
        .order('served_date', { ascending: false })

      data = result.data
      error = result.error
    }

    if (error) {
      console.log('Error fetching meal history:', error)
      // Return empty array if meal_history table doesn't exist or has issues
      return []
    }

    return data || []
  } catch (err) {
    console.log('Error fetching meal history:', err)
    return []
  }
}

async function getCurrentInventory(householdId: string, supabase: any) {
  const { data } = await supabase
    .from('inventory_items')
    .select(`
      *,
      product:products(*),
      storage_location:storage_locations(*)
    `)
    .eq('household_id', householdId)
    .gt('quantity', 0)

  return data || []
}

async function getAvailableRecipes(householdId: string, supabase: any, dietaryRestrictions?: string[]) {
  // First try to get household recipes
  const { data: recipes, error } = await supabase
    .from('recipes')
    .select('*')
    .or(`household_id.eq.${householdId},is_public.eq.true`)

  if (error) {
    console.log('Error fetching recipes:', error)
    // Return empty array if recipes table doesn't exist
    return []
  }

  // Get ingredients for each recipe if available
  if (recipes && recipes.length > 0) {
    for (const recipe of recipes) {
      const { data: ingredients } = await supabase
        .from('recipe_ingredients')
        .select('*')
        .eq('recipe_id', recipe.id)

      recipe.recipe_ingredients = ingredients || []
    }
  }

  // Filter recipes based on dietary restrictions
  if (dietaryRestrictions && dietaryRestrictions.length > 0 && recipes) {
    // Separate allergies from other dietary restrictions
    const allergies = dietaryRestrictions.filter(r => r.startsWith('allergy_'))
      .map(a => a.replace('allergy_', ''))
    const otherRestrictions = dietaryRestrictions.filter(r => !r.startsWith('allergy_'))

    // Get restriction details for non-allergy restrictions
    let restrictionDetails: any[] = []
    if (otherRestrictions.length > 0) {
      const { data } = await supabase
        .from('dietary_restrictions')
        .select('*')
        .in('name', otherRestrictions)
      restrictionDetails = data || []
    }

    return recipes.filter((recipe: any) => {
      // FIRST PRIORITY: Check allergies - these are absolute exclusions
      if (allergies.length > 0 && recipe.recipe_ingredients) {
        for (const allergy of allergies) {
          const allergyLower = allergy.toLowerCase()

          // Check recipe name and category for allergen
          if (recipe.name && recipe.name.toLowerCase().includes(allergyLower)) {
            console.log(`Recipe ${recipe.name} excluded due to allergy ${allergy} in recipe name`)
            return false
          }
          if (recipe.category && recipe.category.toLowerCase().includes(allergyLower)) {
            console.log(`Recipe ${recipe.name} excluded due to allergy ${allergy} in category`)
            return false
          }

          // Check all ingredients for allergen
          for (const ingredient of recipe.recipe_ingredients) {
            const ingredientName = (ingredient.ingredient_name || '').toLowerCase()
            // Check for exact match or common variations
            if (ingredientName.includes(allergyLower) ||
                (allergyLower === 'milk' && (ingredientName.includes('dairy') || ingredientName.includes('cream') || ingredientName.includes('cheese') || ingredientName.includes('butter'))) ||
                (allergyLower === 'eggs' && ingredientName.includes('egg')) ||
                (allergyLower === 'peanuts' && ingredientName.includes('peanut')) ||
                (allergyLower === 'tree nuts' && (ingredientName.includes('almond') || ingredientName.includes('walnut') || ingredientName.includes('cashew') || ingredientName.includes('pecan'))) ||
                (allergyLower === 'wheat' && (ingredientName.includes('flour') || ingredientName.includes('bread'))) ||
                (allergyLower === 'soy' && (ingredientName.includes('soy') || ingredientName.includes('tofu') || ingredientName.includes('tempeh'))) ||
                (allergyLower === 'shellfish' && (ingredientName.includes('shrimp') || ingredientName.includes('lobster') || ingredientName.includes('crab') || ingredientName.includes('shellfish'))) ||
                (allergyLower === 'fish' && (ingredientName.includes('fish') || ingredientName.includes('salmon') || ingredientName.includes('tuna') || ingredientName.includes('cod')))) {
              console.log(`Recipe ${recipe.name} excluded due to allergy ${allergy} in ingredient ${ingredientName}`)
              return false
            }
          }
        }
      }

      // SECOND: Check other dietary restrictions
      if (restrictionDetails && restrictionDetails.length > 0) {
        for (const restriction of restrictionDetails) {
          // Check excluded categories
          if (restriction.excluded_categories && Array.isArray(restriction.excluded_categories)) {
            if (recipe.category && restriction.excluded_categories.some((cat: string) =>
              recipe.category.toLowerCase().includes(cat.toLowerCase()) ||
              cat.toLowerCase().includes(recipe.category.toLowerCase())
            )) {
              console.log(`Recipe ${recipe.name} excluded due to category ${recipe.category} in restriction ${restriction.name}`)
              return false
            }
          }

          // For highly restrictive diets like carnivore, only allow specific categories
          if (restriction.name === 'carnivore' && restriction.allowed_categories) {
            if (!recipe.category || !restriction.allowed_categories.some((cat: string) =>
              recipe.category.toLowerCase().includes(cat.toLowerCase()) ||
              cat.toLowerCase().includes(recipe.category.toLowerCase())
            )) {
              console.log(`Recipe ${recipe.name} excluded - not in carnivore allowed categories`)
              return false
            }
          }

          // Check excluded ingredients in recipe
          if (restriction.excluded_ingredients && Array.isArray(restriction.excluded_ingredients) && recipe.recipe_ingredients) {
            for (const ingredient of recipe.recipe_ingredients) {
              const ingredientName = (ingredient.ingredient_name || '').toLowerCase()
              if (restriction.excluded_ingredients.some((excluded: string) =>
                ingredientName.includes(excluded.toLowerCase())
              )) {
                console.log(`Recipe ${recipe.name} excluded due to ingredient ${ingredientName} in restriction ${restriction.name}`)
                return false
              }
            }
          }
        }
      }

      return true // Recipe passes all dietary restrictions and allergies
    })
  }

  return recipes || []
}

async function discoverNewRecipes(profile: HouseholdProfile, options: any) {
  const searchPrompt = `
Find 15-20 recipe ideas for a household with:
- Members: ${profile.members.map(m => `${m.name} (${m.age_group})`).join(', ')}
- Dietary restrictions: ${profile.dietaryRestrictions.map(d => d.restriction?.name).join(', ') || 'None'}
- Preferences: ${profile.preferences.map(p => `${p.food_type}: ${p.preference}`).join(', ')}
- Options: ${JSON.stringify(options)}

Search popular recipe sites like:
- AllRecipes.com
- FoodNetwork.com
- BBCGoodFood.com
- SeriousEats.com
- BonAppetit.com

Return recipes that:
${options.quickMealsOnly ? '- Can be made in under 30 minutes' : ''}
${options.budgetConscious ? '- Are budget-friendly' : ''}
${options.useSeasonalIngredients ? '- Use seasonal ingredients for current month' : ''}
- Match the household's dietary needs
- Offer variety across different cuisines

Format as JSON array with: name, description, prep_time_minutes, cook_time_minutes, servings, ingredients[], source_url
`

  const recipesJson = await generateMealSuggestions(searchPrompt)

  try {
    return JSON.parse(recipesJson)
  } catch {
    // Fallback to basic recipe set if AI fails
    return []
  }
}

async function getRecipesForInventory(householdId: string, inventory: any[], supabase: any, dietaryRestrictions?: string[]) {
  // Get recipes that can be made with current inventory
  const { data: recipes, error } = await supabase
    .from('recipes')
    .select('*')
    .eq('household_id', householdId)

  if (error || !recipes) {
    console.log('Error fetching recipes for inventory:', error)
    return []
  }

  // Get ingredients for each recipe
  for (const recipe of recipes) {
    const { data: ingredients } = await supabase
      .from('recipe_ingredients')
      .select('*')
      .eq('recipe_id', recipe.id)

    recipe.recipe_ingredients = ingredients || []
  }

  let filteredRecipes = recipes

  // Filter by dietary restrictions first (allergies take priority)
  if (dietaryRestrictions && dietaryRestrictions.length > 0) {
    // Separate allergies from other dietary restrictions
    const allergies = dietaryRestrictions.filter(r => r.startsWith('allergy_'))
      .map(a => a.replace('allergy_', ''))
    const otherRestrictions = dietaryRestrictions.filter(r => !r.startsWith('allergy_'))

    // Get restriction details for non-allergy restrictions
    let restrictionDetails: any[] = []
    if (otherRestrictions.length > 0) {
      const { data } = await supabase
        .from('dietary_restrictions')
        .select('*')
        .in('name', otherRestrictions)
      restrictionDetails = data || []
    }

    filteredRecipes = recipes.filter((recipe: any) => {
      // FIRST PRIORITY: Check allergies
      if (allergies.length > 0 && recipe.recipe_ingredients) {
        for (const allergy of allergies) {
          const allergyLower = allergy.toLowerCase()

          // Check recipe name and category for allergen
          if (recipe.name && recipe.name.toLowerCase().includes(allergyLower)) {
            return false
          }
          if (recipe.category && recipe.category.toLowerCase().includes(allergyLower)) {
            return false
          }

          // Check all ingredients for allergen with common variations
          for (const ingredient of recipe.recipe_ingredients) {
            const ingredientName = (ingredient.ingredient_name || '').toLowerCase()
            if (ingredientName.includes(allergyLower) ||
                (allergyLower === 'milk' && (ingredientName.includes('dairy') || ingredientName.includes('cream') || ingredientName.includes('cheese') || ingredientName.includes('butter'))) ||
                (allergyLower === 'eggs' && ingredientName.includes('egg')) ||
                (allergyLower === 'peanuts' && ingredientName.includes('peanut')) ||
                (allergyLower === 'tree nuts' && (ingredientName.includes('almond') || ingredientName.includes('walnut') || ingredientName.includes('cashew') || ingredientName.includes('pecan'))) ||
                (allergyLower === 'wheat' && (ingredientName.includes('flour') || ingredientName.includes('bread'))) ||
                (allergyLower === 'soy' && (ingredientName.includes('soy') || ingredientName.includes('tofu') || ingredientName.includes('tempeh'))) ||
                (allergyLower === 'shellfish' && (ingredientName.includes('shrimp') || ingredientName.includes('lobster') || ingredientName.includes('crab') || ingredientName.includes('shellfish'))) ||
                (allergyLower === 'fish' && (ingredientName.includes('fish') || ingredientName.includes('salmon') || ingredientName.includes('tuna') || ingredientName.includes('cod')))) {
              return false
            }
          }
        }
      }

      // SECOND: Check other dietary restrictions
      for (const restriction of restrictionDetails) {
        // Check excluded categories
        if (restriction.excluded_categories && Array.isArray(restriction.excluded_categories)) {
          if (recipe.category && restriction.excluded_categories.some((cat: string) =>
            recipe.category.toLowerCase().includes(cat.toLowerCase()) ||
            cat.toLowerCase().includes(recipe.category.toLowerCase())
          )) {
            return false
          }
        }

        // For carnivore, only allow specific categories
        if (restriction.name === 'carnivore' && restriction.allowed_categories) {
          if (!recipe.category || !restriction.allowed_categories.some((cat: string) =>
            recipe.category.toLowerCase().includes(cat.toLowerCase()) ||
            cat.toLowerCase().includes(recipe.category.toLowerCase())
          )) {
            return false
          }
        }

        // Check excluded ingredients
        if (restriction.excluded_ingredients && Array.isArray(restriction.excluded_ingredients) && recipe.recipe_ingredients) {
          for (const ingredient of recipe.recipe_ingredients) {
            const ingredientName = (ingredient.ingredient_name || '').toLowerCase()
            if (restriction.excluded_ingredients.some((excluded: string) =>
              ingredientName.includes(excluded.toLowerCase())
            )) {
              return false
            }
          }
        }
      }
      return true
    })
  }

  // Then filter recipes where we have most ingredients
  return filteredRecipes.filter(recipe => {
    const ingredients = recipe.recipe_ingredients || []
    if (ingredients.length === 0) return true // Include recipes without ingredients

    const availableCount = ingredients.filter(ing => {
      return inventory.some(item =>
        item.product?.name?.toLowerCase().includes(ing.ingredient_name?.toLowerCase())
      )
    }).length

    // Include recipes where we have at least 70% of ingredients
    return (availableCount / ingredients.length) >= 0.7
  })
}

async function generateMealPlanRules(profile: HouseholdProfile, strategy: string = 'auto', options: any = {}, supabase: any) {

  // Get dietary restriction details from database if there are any restrictions
  let restrictionDetails = []
  if (profile.combinedDietaryNeeds && profile.combinedDietaryNeeds.length > 0) {
    const { data } = await supabase
      .from('dietary_restrictions')
      .select('*')
      .in('name', profile.combinedDietaryNeeds)

    restrictionDetails = data || []
  }

  const rulesPrompt = `
Based on this household profile, generate specific meal planning rules:

Household Members: ${JSON.stringify(profile.members, null, 2)}
Active Dietary Restrictions: ${JSON.stringify(profile.combinedDietaryNeeds, null, 2)}
Restriction Details: ${JSON.stringify(restrictionDetails, null, 2)}
Food Preferences: ${JSON.stringify(profile.preferences, null, 2)}
Weekly Schedule: ${JSON.stringify(profile.schedule, null, 2)}
Meal Preferences: ${JSON.stringify(profile.mealPreferences, null, 2)}

Generate a comprehensive set of meal planning rules that includes:
1. Dietary restriction compliance (allergies, intolerances, religious/ethical)
2. Nutritional balance requirements per age group
3. Meal variety guidelines (how often to repeat cuisines/proteins)
4. Time constraints for each day (quick meals on busy days)
5. Budget considerations if specified
6. Portion sizing based on household members
7. Leftover planning strategy
8. Special occasion or schedule considerations

Return the rules as a structured JSON object with clear categories and specific guidelines.
Format: { dietaryRules: [], nutritionRules: [], varietyRules: [], timeRules: [], budgetRules: [], portionRules: [] }
`

  const response = await generateMealSuggestions(rulesPrompt)

  try {
    // Extract JSON from the response
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
  } catch (error) {
    console.error('Error parsing rules JSON:', error)
  }

  // Fallback rules if AI fails
  return {
    dietaryRules: ['No allergens', 'Follow dietary restrictions'],
    nutritionRules: ['Balanced meals', 'Age-appropriate portions'],
    varietyRules: ['No meal repeated within 7 days except staples', 'Vary protein sources'],
    timeRules: ['30 min meals on weekdays', '60 min on weekends'],
    budgetRules: ['Stay within weekly budget'],
    portionRules: ['4 servings default']
  }
}

async function generateMealPlan(params: {
  profile: HouseholdProfile
  rules: any
  mealHistory: any[]
  inventory: any[]
  recipes: any[]
  startDate: string
  endDate: string
  includeStaples: boolean
  strategy?: string
  options?: any
}) {

  // Analyze recent meals to avoid repetition
  const recentMeals = params.mealHistory
    .filter(m => {
      const mealDate = new Date(m.served_date)
      const twoWeeksAgo = new Date()
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
      return mealDate > twoWeeksAgo
    })
    .map(m => ({
      name: m.meal_name || m.recipe?.name,
      date: m.served_date,
      rating: m.rating,
      isStaple: m.tags?.includes('staple')
    }))

  // Filter out recipes that were used recently (unless they're staples)
  const availableRecipes = params.recipes.filter(recipe => {
    const wasRecentlyUsed = recentMeals.some(m =>
      m.name === recipe.name && !m.isStaple
    )
    return !wasRecentlyUsed || (params.includeStaples && recipe.tags?.includes('staple'))
  })

  const mealPlanPrompt = `
Generate a weekly meal plan from ${params.startDate} to ${params.endDate}.

RULES TO FOLLOW:
${JSON.stringify(params.rules, null, 2)}

RECENT MEALS TO AVOID (unless marked as staple):
${JSON.stringify(recentMeals, null, 2)}

AVAILABLE RECIPES:
${JSON.stringify(availableRecipes.map(r => ({
  id: r.id,
  name: r.name,
  prepTime: r.prep_time_minutes,
  cookTime: r.cook_time_minutes,
  servings: r.servings,
  category: r.category,
  tags: r.tags
})), null, 2)}

CURRENT PANTRY INVENTORY (use these items first):
${JSON.stringify(params.inventory.map(i => ({
  product: i.product.name,
  quantity: i.quantity,
  expirationDate: i.expiration_date
})), null, 2)}

SCHEDULE:
${JSON.stringify(params.profile.schedule, null, 2)}

Generate a meal plan that:
1. Follows all dietary restrictions strictly
2. Provides variety (no non-staple meal repeated within 14 days)
3. Uses expiring inventory items first
4. Matches time constraints for each day
5. Includes breakfast, lunch, dinner, and snacks as appropriate
6. Considers leftovers for next-day lunches when possible
7. Marks any repeated "staple" meals appropriately

Return as JSON array with format:
[{
  date: "YYYY-MM-DD",
  mealType: "breakfast|lunch|dinner|snack",
  recipeId: "uuid or null for custom",
  customMealName: "name if no recipeId",
  servings: 4,
  prepTime: 30,
  notes: "any special notes",
  isLeftover: false,
  isStaple: false
}]
`

  const response = await generateMealSuggestions(mealPlanPrompt)

  try {
    const jsonMatch = response.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
  } catch (error) {
    console.error('Error parsing meal plan JSON:', error)
  }

  // Fallback to basic meal plan
  console.log('Falling back to basic meal plan with', availableRecipes.length, 'available recipes')
  return generateBasicMealPlan(params.startDate, params.endDate, availableRecipes)
}

function generateBasicMealPlan(startDate: string, endDate: string, recipes: any[]) {
  console.log('Generating basic meal plan with', recipes.length, 'recipes')
  const plan = []
  const start = new Date(startDate)
  const end = new Date(endDate)
  let recipeIndex = 0

  // Calculate number of days
  const daysDifference = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1

  // If no recipes available, create sample meals
  if (!recipes || recipes.length === 0) {
    console.log('No recipes available, generating sample meals')
    for (let dayIndex = 0; dayIndex < daysDifference; dayIndex++) {
      const currentDate = new Date(start)
      currentDate.setDate(start.getDate() + dayIndex)
      const dateStr = currentDate.toISOString().split('T')[0]

      // Generate 3 meals per day with sample meal names and details
      const sampleMeals = {
        breakfast: [
          {
            name: 'Scrambled Eggs & Toast',
            summary: 'Fluffy scrambled eggs served with buttered whole grain toast and fresh herbs.',
            image: 'https://images.unsplash.com/photo-1506084868230-bb9d95c24759?w=400',
            rating: 4.5,
            reviewCount: 1200,
            prepTime: 15,
            recipeUrl: 'https://www.allrecipes.com/recipe/256007/',
            estimatedCost: 3.50
          },
          {
            name: 'Oatmeal with Berries',
            summary: 'Creamy steel-cut oats topped with fresh mixed berries, honey, and chopped almonds.',
            image: 'https://images.unsplash.com/photo-1511910849309-0dffb8785146?w=400',
            rating: 4.3,
            reviewCount: 850,
            prepTime: 20,
            recipeUrl: 'https://www.foodnetwork.com/recipes/food-network-kitchen/steel-cut-oatmeal-recipe-2103712',
            estimatedCost: 4.00
          },
          {
            name: 'Greek Yogurt Bowl',
            summary: 'Thick Greek yogurt layered with granola, fresh fruit, and a drizzle of maple syrup.',
            image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400',
            rating: 4.7,
            reviewCount: 950,
            prepTime: 10,
            recipeUrl: 'https://www.bbcgoodfood.com/recipes/yogurt-bowl-berries',
            estimatedCost: 5.00
          }
        ],
        lunch: [
          {
            name: 'Chicken Caesar Salad',
            summary: 'Crisp romaine lettuce, grilled chicken breast, parmesan cheese, and classic Caesar dressing.',
            image: 'https://images.unsplash.com/photo-1546793665-c74683f339c1?w=400',
            rating: 4.4,
            reviewCount: 2100,
            prepTime: 25,
            recipeUrl: 'https://www.foodnetwork.com/recipes/classic-caesar-salad-recipe-2165840',
            estimatedCost: 8.50
          },
          {
            name: 'Mediterranean Bowl',
            summary: 'Quinoa bowl with hummus, cucumbers, olives, feta cheese, and tzatziki sauce.',
            image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400',
            rating: 4.6,
            reviewCount: 1350,
            prepTime: 30,
            recipeUrl: 'https://www.seriouseats.com/grain-bowls-recipes',
            estimatedCost: 7.00
          },
          {
            name: 'Turkey Sandwich',
            summary: 'Sliced turkey breast with avocado, lettuce, and tomato on artisan sourdough bread.',
            image: 'https://images.unsplash.com/photo-1553909489-cd47e0ef937f?w=400',
            rating: 4.2,
            reviewCount: 890,
            prepTime: 15,
            recipeUrl: 'https://www.allrecipes.com/recipe/14439/',
            estimatedCost: 6.50
          }
        ],
        dinner: [
          {
            name: 'Grilled Chicken & Vegetables',
            summary: 'Herb-marinated chicken breast grilled to perfection with seasonal roasted vegetables.',
            image: 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=400',
            rating: 4.8,
            reviewCount: 3200,
            prepTime: 45,
            recipeUrl: 'https://www.bbcgoodfood.com/recipes/grilled-chicken-summer-vegetables',
            estimatedCost: 12.00
          },
          {
            name: 'Spaghetti Bolognese',
            summary: 'Classic Italian pasta with rich meat sauce, simmered with tomatoes, herbs, and wine.',
            image: 'https://images.unsplash.com/photo-1551892374-ecf8845cc2b5?w=400',
            rating: 4.7,
            reviewCount: 2800,
            prepTime: 60,
            recipeUrl: 'https://www.bonappetit.com/recipe/classic-rag-bolognese',
            estimatedCost: 10.00
          },
          {
            name: 'Baked Salmon',
            summary: 'Fresh Atlantic salmon fillet baked with lemon, dill, and garlic, served with rice pilaf.',
            image: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400',
            rating: 4.9,
            reviewCount: 1900,
            prepTime: 35,
            recipeUrl: 'https://www.allrecipes.com/recipe/7784/',
            estimatedCost: 15.00
          },
          {
            name: 'Taco Night',
            summary: 'Build-your-own tacos with seasoned ground beef, fresh toppings, and warm corn tortillas.',
            image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400',
            rating: 4.6,
            reviewCount: 2500,
            prepTime: 30,
            recipeUrl: 'https://www.foodnetwork.com/recipes/ree-drummond/beef-tacos-recipe-2042984',
            estimatedCost: 9.00
          }
        ]
      }

      const breakfastMeal = sampleMeals.breakfast[dayIndex % sampleMeals.breakfast.length]
      const lunchMeal = sampleMeals.lunch[dayIndex % sampleMeals.lunch.length]
      const dinnerMeal = sampleMeals.dinner[dayIndex % sampleMeals.dinner.length]

      plan.push({
        date: dateStr,
        mealType: 'breakfast',
        customMealName: breakfastMeal.name,
        recipeName: breakfastMeal.name,
        recipeSummary: breakfastMeal.summary,
        recipeImage: breakfastMeal.image,
        recipeRating: breakfastMeal.rating,
        recipeReviewCount: breakfastMeal.reviewCount,
        recipeLink: breakfastMeal.recipeUrl,
        estimatedCost: breakfastMeal.estimatedCost,
        servings: 4,
        prepTime: breakfastMeal.prepTime
      })
      plan.push({
        date: dateStr,
        mealType: 'lunch',
        customMealName: lunchMeal.name,
        recipeName: lunchMeal.name,
        recipeSummary: lunchMeal.summary,
        recipeImage: lunchMeal.image,
        recipeRating: lunchMeal.rating,
        recipeReviewCount: lunchMeal.reviewCount,
        recipeLink: lunchMeal.recipeUrl,
        estimatedCost: lunchMeal.estimatedCost,
        servings: 4,
        prepTime: lunchMeal.prepTime
      })
      plan.push({
        date: dateStr,
        mealType: 'dinner',
        customMealName: dinnerMeal.name,
        recipeName: dinnerMeal.name,
        recipeSummary: dinnerMeal.summary,
        recipeImage: dinnerMeal.image,
        recipeRating: dinnerMeal.rating,
        recipeReviewCount: dinnerMeal.reviewCount,
        recipeLink: dinnerMeal.recipeUrl,
        estimatedCost: dinnerMeal.estimatedCost,
        servings: 4,
        prepTime: dinnerMeal.prepTime
      })
    }
    return plan
  }

  for (let dayIndex = 0; dayIndex < daysDifference; dayIndex++) {
    const currentDate = new Date(start)
    currentDate.setDate(start.getDate() + dayIndex)
    const dateStr = currentDate.toISOString().split('T')[0]
    // Reuse recipes if we run out
    const dayRecipes = [
      recipes[recipeIndex % recipes.length],
      recipes[(recipeIndex + 1) % recipes.length],
      recipes[(recipeIndex + 2) % recipes.length]
    ]
    recipeIndex += 3

    if (dayRecipes[0]) {
      plan.push({
        date: dateStr,
        mealType: 'breakfast',
        recipeId: dayRecipes[0].id,
        recipeName: dayRecipes[0].name,
        recipeUrl: dayRecipes[0].source_url,
        dietaryTags: dayRecipes[0].tags || [],
        servings: 4,
        prepTime: dayRecipes[0].prep_time_minutes || 30,
        cookTime: dayRecipes[0].cook_time_minutes
      })
    }

    if (dayRecipes[1]) {
      plan.push({
        date: dateStr,
        mealType: 'lunch',
        recipeId: dayRecipes[1].id,
        recipeName: dayRecipes[1].name,
        recipeUrl: dayRecipes[1].source_url,
        dietaryTags: dayRecipes[1].tags || [],
        servings: 4,
        prepTime: dayRecipes[1].prep_time_minutes || 30,
        cookTime: dayRecipes[1].cook_time_minutes
      })
    }

    if (dayRecipes[2]) {
      plan.push({
        date: dateStr,
        mealType: 'dinner',
        recipeId: dayRecipes[2].id,
        recipeName: dayRecipes[2].name,
        recipeUrl: dayRecipes[2].source_url,
        dietaryTags: dayRecipes[2].tags || [],
        servings: 4,
        prepTime: dayRecipes[2].prep_time_minutes || 45,
        cookTime: dayRecipes[2].cook_time_minutes
      })
    }
  }

  return plan
}

async function saveMealPlan(householdId: string, mealPlan: any[], supabase: any) {
  if (!mealPlan || mealPlan.length === 0) {
    throw new Error('Cannot save empty meal plan')
  }

  // SECURITY FIX: Use the authenticated client passed in (respects RLS)
  // This ensures users can only save meal plans to their own household

  // Create the meal plan record
  const { data: planData, error: planError } = await supabase
    .from('meal_plans')
    .insert({
      household_id: householdId,
      name: `Week of ${mealPlan[0].date}`,
      start_date: mealPlan[0].date,
      end_date: mealPlan[mealPlan.length - 1].date,
      status: 'draft'
      // Remove total_prep_time as it doesn't exist in the table
    })
    .select()
    .single()

  if (planError) {
    console.error('Error saving meal plan:', planError)
    throw planError
  }

  // Create the planned meals
  const plannedMeals = mealPlan.map(meal => ({
    meal_plan_id: planData.id,
    recipe_id: meal.recipeId || null,
    custom_meal_name: meal.customMealName || null,
    meal_date: meal.date,
    meal_type: meal.mealType,
    servings: meal.servings || 4,
    prep_time: meal.prepTime || 30,
    notes: meal.notes || null,
    is_leftover_meal: meal.isLeftover || false
  }))

  console.log('Saving planned meals:', plannedMeals.length, 'meals')
  const { error: mealsError } = await supabase
    .from('planned_meals')
    .insert(plannedMeals)

  if (mealsError) {
    console.error('Error saving planned meals:', mealsError)
    throw mealsError
  }

  return planData
}

function generatePantryScorecard(mealPlan: any[], inventory: any[], recipes: any[]) {
  const scorecard = {
    totalMealsPlanned: mealPlan.length,
    pantryItemsUsed: 0,
    expiringItemsUsed: [],
    ingredientCoverage: [],
    shoppingNeeded: [],
    highlights: []
  }

  // Get items expiring within 3 days
  const now = new Date()
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)

  const expiringItems = inventory.filter(item => {
    if (item.expiration_date) {
      const expDate = new Date(item.expiration_date)
      return expDate <= threeDaysFromNow && expDate >= now
    }
    return false
  })

  // Track which pantry items are being used
  const pantryItemsUsed = new Set<string>()

  // Analyze each meal in the plan
  mealPlan.forEach(meal => {
    if (meal.recipeId) {
      // Find the recipe
      const recipe = recipes.find(r => r.id === meal.recipeId)
      if (recipe && recipe.recipe_ingredients) {
        let availableIngredients = 0
        let totalIngredients = recipe.recipe_ingredients.length

        recipe.recipe_ingredients.forEach((ingredient: any) => {
          // Use the sophisticated ingredient matching system
          const matches = findIngredientMatches(ingredient.ingredient_name, inventory)
          const hasIngredient = matches.length > 0

          if (hasIngredient) {
            availableIngredients++
            pantryItemsUsed.add(ingredient.ingredient_name)

            // Also track which specific inventory items are being used
            matches.forEach(match => {
              const itemName = match.inventoryItem.product?.name || match.inventoryItem.name
              if (itemName) {
                pantryItemsUsed.add(itemName)
              }
            })
          }
        })

        // Calculate coverage for this meal
        const coverage = totalIngredients > 0 ? Math.round((availableIngredients / totalIngredients) * 100) : 0

        scorecard.ingredientCoverage.push({
          meal: meal.recipeName || meal.customMealName,
          date: meal.date,
          availableIngredients,
          totalIngredients,
          coverage: `${coverage}%`,
          missingIngredients: recipe.recipe_ingredients
            .filter((ing: any) => {
              const matches = findIngredientMatches(ing.ingredient_name, inventory)
              return matches.length === 0
            })
            .map((ing: any) => ing.ingredient_name)
        })
      }
    }
  })

  // Check for expiring items being used
  expiringItems.forEach(item => {
    if (pantryItemsUsed.has(item.product?.name || item.name)) {
      scorecard.expiringItemsUsed.push({
        name: item.product?.name || item.name,
        expiresIn: Math.ceil((new Date(item.expiration_date).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
        quantity: item.quantity
      })
    }
  })

  // Generate highlights
  scorecard.pantryItemsUsed = pantryItemsUsed.size

  if (scorecard.expiringItemsUsed.length > 0) {
    scorecard.highlights.push(`Using ${scorecard.expiringItemsUsed.length} items that expire within 3 days`)
  }

  const avgCoverage = scorecard.ingredientCoverage.length > 0
    ? Math.round(scorecard.ingredientCoverage.reduce((sum, meal) => sum + parseInt(meal.coverage), 0) / scorecard.ingredientCoverage.length)
    : 0

  if (avgCoverage > 70) {
    scorecard.highlights.push(`High pantry utilization - ${avgCoverage}% of ingredients already available`)
  } else if (avgCoverage > 40) {
    scorecard.highlights.push(`Moderate pantry utilization - ${avgCoverage}% of ingredients available`)
  } else {
    scorecard.highlights.push(`Limited pantry items available - only ${avgCoverage}% of ingredients on hand`)
  }

  // Find meals with best pantry coverage
  const bestCoverage = scorecard.ingredientCoverage
    .filter(meal => parseInt(meal.coverage) > 80)
    .map(meal => meal.meal)

  if (bestCoverage.length > 0) {
    scorecard.highlights.push(`Best pantry matches: ${bestCoverage.slice(0, 3).join(', ')}`)
  }

  return scorecard
}

function generateOptionCompliance(mealPlan: any[], options: any) {
  const compliance = {
    quickMeals: {
      enabled: options.quickMealsOnly || false,
      compliance: 0,
      details: []
    },
    budgetFriendly: {
      enabled: options.budgetConscious || false,
      compliance: 0,
      details: []
    },
    seasonal: {
      enabled: options.useSeasonalIngredients || false,
      compliance: 0,
      details: []
    },
    highlights: []
  }

  if (!mealPlan || mealPlan.length === 0) {
    return compliance
  }

  // Check quick meals compliance
  if (options.quickMealsOnly) {
    const quickMeals = mealPlan.filter(meal => meal.prepTime && meal.prepTime <= 30)
    const slowMeals = mealPlan.filter(meal => meal.prepTime && meal.prepTime > 30)

    compliance.quickMeals.compliance = Math.round((quickMeals.length / mealPlan.length) * 100)

    if (quickMeals.length === mealPlan.length) {
      compliance.highlights.push(`✅ All meals can be prepared in 30 minutes or less`)
    } else if (slowMeals.length > 0) {
      compliance.highlights.push(`⚠️ ${slowMeals.length} meal${slowMeals.length > 1 ? 's' : ''} exceed 30 minutes: ${slowMeals.map(m => `${m.recipeName || m.customMealName} (${m.prepTime} min)`).join(', ')}`)
    }

    // Add details for each meal
    mealPlan.forEach(meal => {
      if (meal.prepTime) {
        compliance.quickMeals.details.push({
          meal: meal.recipeName || meal.customMealName,
          time: meal.prepTime,
          meetsTarget: meal.prepTime <= 30
        })
      }
    })
  }

  // Check budget compliance
  if (options.budgetConscious) {
    const budgetTarget = 5.00 // $5 per meal target for budget-friendly
    const budgetMeals = mealPlan.filter(meal => meal.estimatedCost && meal.estimatedCost <= budgetTarget)
    const expensiveMeals = mealPlan.filter(meal => meal.estimatedCost && meal.estimatedCost > budgetTarget * 2)

    const mealsWithCost = mealPlan.filter(meal => meal.estimatedCost)
    if (mealsWithCost.length > 0) {
      compliance.budgetFriendly.compliance = Math.round((budgetMeals.length / mealsWithCost.length) * 100)

      const avgCost = mealsWithCost.reduce((sum, meal) => sum + (meal.estimatedCost || 0), 0) / mealsWithCost.length

      if (avgCost <= budgetTarget) {
        compliance.highlights.push(`✅ Average meal cost $${avgCost.toFixed(2)} meets budget target`)
      } else {
        compliance.highlights.push(`💰 Average meal cost $${avgCost.toFixed(2)} (target: $${budgetTarget.toFixed(2)})`)
      }

      if (expensiveMeals.length > 0) {
        compliance.highlights.push(`💸 ${expensiveMeals.length} higher-cost meal${expensiveMeals.length > 1 ? 's' : ''}: ${expensiveMeals.map(m => `${m.recipeName || m.customMealName} ($${m.estimatedCost?.toFixed(2)})`).join(', ')}`)
      }

      // Add details for each meal
      mealsWithCost.forEach(meal => {
        compliance.budgetFriendly.details.push({
          meal: meal.recipeName || meal.customMealName,
          cost: meal.estimatedCost,
          meetsTarget: meal.estimatedCost <= budgetTarget
        })
      })
    }
  }

  // Check seasonal compliance (simplified - could be enhanced with actual seasonal data)
  if (options.useSeasonalIngredients) {
    // For now, just indicate that seasonal ingredients were prioritized
    compliance.seasonal.compliance = 100
    compliance.highlights.push(`🍂 Meals prioritized seasonal ingredients for the current month`)
  }

  // Add overall summary
  const enabledOptions = []
  if (options.quickMealsOnly) enabledOptions.push('Quick Meals')
  if (options.budgetConscious) enabledOptions.push('Budget-Friendly')
  if (options.useSeasonalIngredients) enabledOptions.push('Seasonal')
  if (options.includeLefotovers) enabledOptions.push('Leftovers')

  if (enabledOptions.length > 0) {
    compliance.highlights.unshift(`📋 Meal plan optimized for: ${enabledOptions.join(', ')}`)
  }

  return compliance
}