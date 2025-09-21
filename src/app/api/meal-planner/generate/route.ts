import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Simple AI provider for meal planning
async function callAI(prompt: string): Promise<string> {
  // Use the existing AI provider endpoints
  const providers = [
    { name: 'claude', endpoint: '/api/ai/claude' },
    { name: 'gemini', endpoint: '/api/ai/gemini' },
    { name: 'openai', endpoint: '/api/ai/openai' }
  ]

  // Try providers in order until one works
  for (const provider of providers) {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_URL || ''}${provider.endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      })

      if (response.ok) {
        const data = await response.json()
        return data.response || data.text || data.content || ''
      }
    } catch (error) {
      console.error(`${provider.name} provider failed:`, error)
    }
  }

  // Fallback if no AI providers work
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
}

export async function POST(req: NextRequest) {
  try {
    const {
      householdId,
      startDate,
      endDate,
      strategy = 'auto',
      options = {},
      usePastMeals = true,
      includeStaples = true
    } = await req.json() as MealPlanRequest

    // Get household profile data
    const profile = await getHouseholdProfile(householdId)

    // Get past meal history for variety analysis
    const mealHistory = usePastMeals ? await getMealHistory(householdId, 30) : []

    // Get current pantry inventory
    const inventory = await getCurrentInventory(householdId)

    // Get available recipes based on strategy
    let recipes = []
    if (strategy === 'discover') {
      // Search for new recipes online
      recipes = await discoverNewRecipes(profile, options)
    } else if (strategy === 'recipes') {
      // Use only saved recipes
      recipes = await getAvailableRecipes(householdId)
    } else if (strategy === 'pantry') {
      // Get recipes that can be made with current inventory
      recipes = await getRecipesForInventory(householdId, inventory)
    } else {
      // Auto mode - mix of saved recipes and inventory-based
      recipes = await getAvailableRecipes(householdId)
    }

    // Generate meal planning rules using AI
    const rules = await generateMealPlanRules(profile, strategy, options)

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

    // Save the meal plan to database
    const savedPlan = await saveMealPlan(householdId, mealPlan)

    return NextResponse.json({
      success: true,
      planId: savedPlan.id,
      plan: mealPlan
    })

  } catch (error: any) {
    console.error('Error generating meal plan:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate meal plan' },
      { status: 500 }
    )
  }
}

async function getHouseholdProfile(householdId: string): Promise<HouseholdProfile> {
  const [members, restrictions, preferences, schedule, mealPrefs] = await Promise.all([
    supabase.from('family_members')
      .select('*')
      .eq('household_id', householdId),
    supabase.from('member_dietary_restrictions')
      .select('*, member:family_members(*), restriction:dietary_restrictions(*)')
      .eq('member.household_id', householdId),
    supabase.from('food_preferences')
      .select('*, member:family_members(*)')
      .eq('member.household_id', householdId),
    supabase.from('household_schedules')
      .select('*')
      .eq('household_id', householdId),
    supabase.from('household_meal_preferences')
      .select('*')
      .eq('household_id', householdId)
      .single()
  ])

  return {
    members: members.data || [],
    dietaryRestrictions: restrictions.data || [],
    preferences: preferences.data || [],
    schedule: schedule.data || [],
    mealPreferences: mealPrefs.data
  }
}

async function getMealHistory(householdId: string, daysBack: number) {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - daysBack)

  const { data } = await supabase
    .from('meal_history')
    .select(`
      *,
      recipe:recipes(*)
    `)
    .eq('household_id', householdId)
    .gte('served_date', startDate.toISOString())
    .order('served_date', { ascending: false })

  return data || []
}

async function getCurrentInventory(householdId: string) {
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

async function getAvailableRecipes(householdId: string) {
  const { data } = await supabase
    .from('recipes')
    .select(`
      *,
      recipe_ingredients(*)
    `)
    .or(`household_id.eq.${householdId},is_public.eq.true`)

  return data || []
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

  const recipesJson = await getAIResponse(searchPrompt)

  try {
    return JSON.parse(recipesJson)
  } catch {
    // Fallback to basic recipe set if AI fails
    return []
  }
}

async function getRecipesForInventory(householdId: string, inventory: any[]) {
  // Get recipes that can be made with current inventory
  const { data: recipes } = await supabase
    .from('recipes')
    .select('*, recipe_ingredients(*)')
    .eq('household_id', householdId)

  if (!recipes) return []

  // Filter recipes where we have most ingredients
  return recipes.filter(recipe => {
    const ingredients = recipe.recipe_ingredients || []
    const availableCount = ingredients.filter(ing => {
      return inventory.some(item =>
        item.product?.name?.toLowerCase().includes(ing.ingredient_name?.toLowerCase())
      )
    }).length

    // Include recipes where we have at least 70% of ingredients
    return ingredients.length === 0 || (availableCount / ingredients.length) >= 0.7
  })
}

async function generateMealPlanRules(profile: HouseholdProfile, strategy: string = 'auto', options: any = {}) {

  const rulesPrompt = `
Based on this household profile, generate specific meal planning rules:

Household Members: ${JSON.stringify(profile.members, null, 2)}
Dietary Restrictions: ${JSON.stringify(profile.dietaryRestrictions, null, 2)}
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

  const response = await callAI(rulesPrompt)

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

  const response = await aiProvider.complete(mealPlanPrompt)

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
  const plan = []
  const start = new Date(startDate)
  const end = new Date(endDate)

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayRecipes = recipes.slice(plan.length * 3, (plan.length + 1) * 3)

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

async function saveMealPlan(householdId: string, mealPlan: any[]) {
  // Create the meal plan record
  const { data: planData, error: planError } = await supabase
    .from('meal_plans')
    .insert({
      household_id: householdId,
      name: `Week of ${mealPlan[0].date}`,
      start_date: mealPlan[0].date,
      end_date: mealPlan[mealPlan.length - 1].date,
      status: 'draft',
      total_prep_time: mealPlan.reduce((sum, m) => sum + (m.prepTime || 0), 0)
    })
    .select()
    .single()

  if (planError) throw planError

  // Create the planned meals
  const plannedMeals = mealPlan.map(meal => ({
    meal_plan_id: planData.id,
    recipe_id: meal.recipeId,
    custom_meal_name: meal.customMealName,
    meal_date: meal.date,
    meal_type: meal.mealType,
    servings: meal.servings,
    prep_time: meal.prepTime,
    notes: meal.notes,
    is_leftover_meal: meal.isLeftover
  }))

  const { error: mealsError } = await supabase
    .from('planned_meals')
    .insert(plannedMeals)

  if (mealsError) throw mealsError

  return planData
}