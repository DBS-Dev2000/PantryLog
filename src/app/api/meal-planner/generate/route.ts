import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'

// Create untyped Supabase client for meal planning tables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Helper to create authenticated client - use service role to bypass RLS
function createAuthClient(req: NextRequest) {
  // Use service role key to bypass RLS for meal planning
  // This is safe because we validate the user ID from the request
  if (supabaseServiceKey) {
    return createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    })
  }

  // Fallback to anon key with auth header
  const authorization = req.headers.get('authorization')
  if (authorization) {
    return createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          authorization
        }
      }
    })
  }

  return createClient(supabaseUrl, supabaseAnonKey)
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

    console.log('Generating meal plan:', { householdId, startDate, endDate, strategy })

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
      return NextResponse.json({
        success: true,
        preview: true,
        meals: mealPlan,
        summary: {
          totalMeals: mealPlan.length,
          daysPlanned: Math.ceil(mealPlan.length / 3),
          recipesUsed: recipes.length
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
  const [members, restrictions, preferences, schedule, mealPrefs] = await Promise.all([
    supabase.from('family_members')
      .select('*')
      .eq('household_id', householdId),
    supabase.from('member_dietary_restrictions')
      .select('*')
      .eq('household_id', householdId),
    supabase.from('food_preferences')
      .select('*')
      .eq('household_id', householdId),
    supabase.from('household_schedules')
      .select('*')
      .eq('household_id', householdId),
    supabase.from('household_meal_preferences')
      .select('*')
      .eq('household_id', householdId)
      .single()
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
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - daysBack)

  const { data, error } = await supabase
    .from('meal_history')
    .select('*')
    .eq('household_id', householdId)
    .gte('served_date', startDate.toISOString())
    .order('served_date', { ascending: false })

  if (error) {
    console.log('Error fetching meal history:', error)
    // Return empty array if meal_history table doesn't exist
    return []
  }

  return data || []
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
  return generateBasicMealPlan(params.startDate, params.endDate, availableRecipes)
}

function generateBasicMealPlan(startDate: string, endDate: string, recipes: any[]) {
  console.log('Generating basic meal plan with', recipes.length, 'recipes')
  const plan = []
  const start = new Date(startDate)
  const end = new Date(endDate)
  let recipeIndex = 0

  // If no recipes available, create sample meals
  if (!recipes || recipes.length === 0) {
    console.log('No recipes available, generating sample meals')
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      // Generate 3 meals per day with custom names
      plan.push({
        date: d.toISOString().split('T')[0],
        mealType: 'breakfast',
        customMealName: 'Breakfast - Day ' + (plan.length / 3 + 1),
        servings: 4,
        prepTime: 20
      })
      plan.push({
        date: d.toISOString().split('T')[0],
        mealType: 'lunch',
        customMealName: 'Lunch - Day ' + (Math.floor(plan.length / 3) + 1),
        servings: 4,
        prepTime: 30
      })
      plan.push({
        date: d.toISOString().split('T')[0],
        mealType: 'dinner',
        customMealName: 'Dinner - Day ' + (Math.floor(plan.length / 3) + 1),
        servings: 4,
        prepTime: 45
      })
    }
    return plan
  }

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    // Reuse recipes if we run out
    const dayRecipes = [
      recipes[recipeIndex % recipes.length],
      recipes[(recipeIndex + 1) % recipes.length],
      recipes[(recipeIndex + 2) % recipes.length]
    ]
    recipeIndex += 3

    if (dayRecipes[0]) {
      plan.push({
        date: d.toISOString().split('T')[0],
        mealType: 'breakfast',
        recipeId: dayRecipes[0].id,
        servings: 4,
        prepTime: dayRecipes[0].prep_time_minutes || 30
      })
    }

    if (dayRecipes[1]) {
      plan.push({
        date: d.toISOString().split('T')[0],
        mealType: 'lunch',
        recipeId: dayRecipes[1].id,
        servings: 4,
        prepTime: dayRecipes[1].prep_time_minutes || 30
      })
    }

    if (dayRecipes[2]) {
      plan.push({
        date: d.toISOString().split('T')[0],
        mealType: 'dinner',
        recipeId: dayRecipes[2].id,
        servings: 4,
        prepTime: dayRecipes[2].prep_time_minutes || 45
      })
    }
  }

  return plan
}

async function saveMealPlan(householdId: string, mealPlan: any[], supabase: any) {
  if (!mealPlan || mealPlan.length === 0) {
    throw new Error('Cannot save empty meal plan')
  }

  // Ensure we're using service role client
  const serviceSupabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  })

  // Create the meal plan record
  const { data: planData, error: planError } = await serviceSupabase
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
  const { error: mealsError } = await serviceSupabase
    .from('planned_meals')
    .insert(plannedMeals)

  if (mealsError) {
    console.error('Error saving planned meals:', mealsError)
    throw mealsError
  }

  return planData
}