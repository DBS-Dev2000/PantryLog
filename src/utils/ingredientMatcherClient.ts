/**
 * Lightweight client-side ingredient matcher that calls API
 * This avoids loading the large ingredient database on the client
 */

export interface IngredientMatch {
  productId: string
  productName: string
  matchType: 'exact' | 'equivalency' | 'partial' | 'category' | 'substitute'
  confidence: number
  reason: string
  quantity?: number
  unit?: string
}

/**
 * Find matching products for a recipe ingredient via API
 * @param ingredientName The name of the ingredient to match
 * @param inventoryProducts Array of products currently in inventory
 * @param householdId Optional household ID for taxonomy matching
 * @returns Array of matching products with confidence scores
 */
export async function findIngredientMatches(
  ingredientName: string,
  inventoryProducts: any[],
  householdId?: string
): Promise<IngredientMatch[]> {
  try {
    const response = await fetch('/api/ingredients/match', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ingredientName,
        inventoryProducts,
        householdId,
      }),
    })

    if (!response.ok) {
      console.error('Failed to match ingredients:', response.statusText)
      return []
    }

    const data = await response.json()
    return data.matches || []
  } catch (error) {
    console.error('Error calling ingredient match API:', error)
    return []
  }
}

/**
 * Check recipe availability based on inventory (client-side calculation)
 * This is lightweight and doesn't need the full database
 */
export function checkRecipeAvailability(
  ingredients: Array<{ ingredient_name: string; quantity?: number; unit?: string }>,
  matches: IngredientMatch[]
): {
  canMake: boolean
  availableCount: number
  totalCount: number
  missingIngredients: string[]
  availableIngredients: string[]
  percentageAvailable: number
} {
  const totalCount = ingredients.length
  const availableIngredients: string[] = []
  const missingIngredients: string[] = []

  ingredients.forEach(ingredient => {
    const hasMatch = matches.some(
      match => match.confidence > 30 &&
      ingredient.ingredient_name.toLowerCase().includes(match.productName.toLowerCase().split(' ')[0])
    )

    if (hasMatch) {
      availableIngredients.push(ingredient.ingredient_name)
    } else {
      missingIngredients.push(ingredient.ingredient_name)
    }
  })

  const availableCount = availableIngredients.length
  const percentageAvailable = totalCount > 0 ? Math.round((availableCount / totalCount) * 100) : 0

  return {
    canMake: missingIngredients.length === 0,
    availableCount,
    totalCount,
    missingIngredients,
    availableIngredients,
    percentageAvailable,
  }
}