/**
 * Lightweight ingredient matcher that uses database queries
 * This replaces the heavy client-side matcher to improve performance
 */

import { supabase } from '@/lib/supabase-client'

export interface IngredientMatch {
  productId: string
  productName: string
  matchType: 'exact' | 'equivalency' | 'partial' | 'category' | 'substitute'
  confidence: number
  reason: string
}

/**
 * Find matching products using database function
 */
export async function findIngredientMatchesDB(
  ingredientName: string,
  inventoryProducts: any[],
  householdId?: string
): Promise<IngredientMatch[]> {
  try {
    // Call the database function
    const { data, error } = await supabase.rpc('find_ingredient_matches', {
      p_ingredient_name: ingredientName,
      p_household_id: householdId
    })

    if (error) {
      console.error('Error finding matches:', error)
      return []
    }

    // Filter to only products in inventory
    const inventoryProductIds = new Set(inventoryProducts.map(p => p.id))

    return (data || [])
      .filter((match: any) => inventoryProductIds.has(match.product_id))
      .map((match: any) => ({
        productId: match.product_id,
        productName: match.product_name,
        matchType: match.match_type,
        confidence: match.confidence,
        reason: `${match.match_type} match`
      }))
  } catch (error) {
    console.error('Error calling database:', error)
    return []
  }
}

/**
 * Get shelf life from database
 */
export async function getShelfLifeDB(
  foodName: string,
  storageType: 'pantry' | 'fridge' | 'freezer' = 'pantry'
): Promise<number> {
  try {
    const { data, error } = await supabase.rpc('get_shelf_life', {
      p_food_name: foodName,
      p_storage_type: storageType
    })

    if (error) {
      console.error('Error getting shelf life:', error)
      return 30 // Default 30 days
    }

    return data || 30
  } catch (error) {
    console.error('Error:', error)
    return 30
  }
}

/**
 * Simple availability check without heavy data
 */
export function checkRecipeAvailabilityLight(
  ingredients: Array<{ ingredient_name: string }>,
  inventoryProducts: Array<{ name: string }>
): {
  canMake: boolean
  availableCount: number
  totalCount: number
  missingIngredients: string[]
  percentageAvailable: number
} {
  const totalCount = ingredients.length
  const missingIngredients: string[] = []

  // Simple name matching for quick checks
  const productNames = new Set(
    inventoryProducts.map(p => p.name.toLowerCase())
  )

  ingredients.forEach(ingredient => {
    const ingredientLower = ingredient.ingredient_name.toLowerCase()
    let found = false

    // Check for direct match or partial match
    for (const productName of productNames) {
      if (productName.includes(ingredientLower) ||
          ingredientLower.includes(productName)) {
        found = true
        break
      }
    }

    if (!found) {
      missingIngredients.push(ingredient.ingredient_name)
    }
  })

  const availableCount = totalCount - missingIngredients.length
  const percentageAvailable = totalCount > 0
    ? Math.round((availableCount / totalCount) * 100)
    : 0

  return {
    canMake: missingIngredients.length === 0,
    availableCount,
    totalCount,
    missingIngredients,
    percentageAvailable
  }
}