import foodTaxonomy from '@/data/food-taxonomy.json'
import { StorageLocation } from './shelfLifeCalculator'

export interface FoodMatch {
  category: string
  subcategory?: string
  type?: string
  confidence: number
  recipeMatches?: string[]
  substitutions?: string[]
  portionSize?: number
  leftoverDays?: number
}

/**
 * Match a product to the food taxonomy
 */
export function matchFoodTaxonomy(
  productName: string,
  category?: string | null,
  brand?: string | null
): FoodMatch | null {
  const name = productName?.toLowerCase() || ''
  const cat = category?.toLowerCase() || ''
  const br = brand?.toLowerCase() || ''

  // Combine all text for better matching
  const searchText = `${name} ${cat} ${br}`.toLowerCase()

  let bestMatch: FoodMatch | null = null
  let highestConfidence = 0

  // Search through taxonomy
  for (const [mainCategory, mainData] of Object.entries(foodTaxonomy.taxonomy)) {
    const categoryMatch = searchInTaxonomy(
      mainData as any,
      searchText,
      name,
      mainCategory
    )

    if (categoryMatch && categoryMatch.confidence > highestConfidence) {
      highestConfidence = categoryMatch.confidence
      bestMatch = categoryMatch
    }
  }

  return bestMatch
}

/**
 * Recursively search taxonomy for matches
 */
function searchInTaxonomy(
  taxonomyData: any,
  searchText: string,
  productName: string,
  category: string,
  subcategory?: string,
  type?: string
): FoodMatch | null {
  let bestMatch: FoodMatch | null = null
  let highestConfidence = 0

  // Check direct items/cuts arrays
  if (taxonomyData.items && Array.isArray(taxonomyData.items)) {
    for (const item of taxonomyData.items) {
      const confidence = calculateConfidence(item, searchText, productName)
      if (confidence > highestConfidence) {
        highestConfidence = confidence
        bestMatch = {
          category,
          subcategory,
          type: type || item,
          confidence,
          recipeMatches: taxonomyData.recipeMatches?.direct,
          substitutions: taxonomyData.substitutions,
          portionSize: taxonomyData.portionManagement?.standardPortion,
          leftoverDays: taxonomyData.leftoverUses?.storageLife
        }
      }
    }
  }

  if (taxonomyData.cuts && Array.isArray(taxonomyData.cuts)) {
    for (const cut of taxonomyData.cuts) {
      const confidence = calculateConfidence(cut, searchText, productName)
      if (confidence > highestConfidence) {
        highestConfidence = confidence
        bestMatch = {
          category,
          subcategory,
          type: type || cut,
          confidence,
          recipeMatches: taxonomyData.recipeMatches?.direct,
          substitutions: taxonomyData.substitutions,
          portionSize: taxonomyData.portionManagement?.standardPortion,
          leftoverDays: taxonomyData.leftoverUses?.storageLife
        }
      }
    }
  }

  // Search subcategories
  if (taxonomyData.subcategories) {
    for (const [subcat, subData] of Object.entries(taxonomyData.subcategories)) {
      const subMatch = searchInTaxonomy(
        subData,
        searchText,
        productName,
        category,
        subcat,
        type
      )

      if (subMatch && subMatch.confidence > highestConfidence) {
        highestConfidence = subMatch.confidence
        bestMatch = subMatch
      }
    }
  }

  // Check if the category itself is a match
  if (!bestMatch && taxonomyData.keywords) {
    for (const keyword of taxonomyData.keywords) {
      if (searchText.includes(keyword.toLowerCase())) {
        const confidence = calculateConfidence(keyword, searchText, productName)
        if (confidence > 0.3) {
          bestMatch = {
            category,
            subcategory,
            type,
            confidence,
            recipeMatches: taxonomyData.recipeMatches?.direct,
            substitutions: taxonomyData.substitutions,
            portionSize: taxonomyData.portionManagement?.standardPortion,
            leftoverDays: taxonomyData.leftoverUses?.storageLife
          }
          break
        }
      }
    }
  }

  return bestMatch
}

/**
 * Calculate confidence score for a match
 */
function calculateConfidence(
  matchTerm: string,
  searchText: string,
  productName: string
): number {
  const term = matchTerm.toLowerCase()

  // Exact match in product name
  if (productName === term) return 1.0

  // Product name contains the term as a whole word
  const wordBoundary = new RegExp(`\\b${term}\\b`, 'i')
  if (wordBoundary.test(productName)) return 0.9

  // Product name contains the term
  if (productName.includes(term)) return 0.7

  // Search text contains the term as a whole word
  if (wordBoundary.test(searchText)) return 0.5

  // Search text contains the term
  if (searchText.includes(term)) return 0.3

  // Fuzzy match (Levenshtein distance)
  const distance = levenshteinDistance(productName, term)
  const maxLength = Math.max(productName.length, term.length)
  const similarity = 1 - (distance / maxLength)

  if (similarity > 0.7) return similarity * 0.5

  return 0
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = []

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        )
      }
    }
  }

  return matrix[str2.length][str1.length]
}

/**
 * Get recipe matches for a product
 */
export function getRecipeMatches(productName: string, category?: string | null): string[] {
  const match = matchFoodTaxonomy(productName, category)
  return match?.recipeMatches || []
}

/**
 * Get substitution options for a product
 */
export function getSubstitutions(productName: string, category?: string | null): string[] {
  const match = matchFoodTaxonomy(productName, category)
  return match?.substitutions || []
}

/**
 * Check if two products can be substituted for each other
 */
export function canSubstitute(
  product1: string,
  product2: string,
  category1?: string | null,
  category2?: string | null
): boolean {
  const match1 = matchFoodTaxonomy(product1, category1)
  const match2 = matchFoodTaxonomy(product2, category2)

  if (!match1 || !match2) return false

  // Same category and subcategory
  if (match1.category === match2.category && match1.subcategory === match2.subcategory) {
    return true
  }

  // Check if one is in the other's substitutions
  const subs1 = match1.substitutions || []
  const subs2 = match2.substitutions || []

  if (subs1.some(sub => product2.toLowerCase().includes(sub.toLowerCase()))) {
    return true
  }

  if (subs2.some(sub => product1.toLowerCase().includes(sub.toLowerCase()))) {
    return true
  }

  return false
}

/**
 * Get portion information for leftovers
 */
export function getPortionInfo(productName: string, category?: string | null): {
  standardPortion?: number
  leftoverDays?: number
} {
  const match = matchFoodTaxonomy(productName, category)

  return {
    standardPortion: match?.portionSize,
    leftoverDays: match?.leftoverDays
  }
}

/**
 * Find inventory items that can be used for a recipe ingredient
 */
export function findMatchingInventoryItems(
  recipeIngredient: string,
  inventoryItems: Array<{ name: string; category?: string | null }>
): Array<{ item: any; confidence: number }> {
  const matches: Array<{ item: any; confidence: number }> = []

  const ingredientMatch = matchFoodTaxonomy(recipeIngredient)

  for (const item of inventoryItems) {
    // Direct name match
    if (item.name.toLowerCase().includes(recipeIngredient.toLowerCase())) {
      matches.push({ item, confidence: 0.9 })
      continue
    }

    // Check if item can substitute
    if (canSubstitute(recipeIngredient, item.name, null, item.category)) {
      matches.push({ item, confidence: 0.7 })
      continue
    }

    // Check taxonomy match
    const itemMatch = matchFoodTaxonomy(item.name, item.category)
    if (itemMatch && ingredientMatch &&
        itemMatch.category === ingredientMatch.category &&
        itemMatch.subcategory === ingredientMatch.subcategory) {
      matches.push({ item, confidence: 0.5 })
    }
  }

  // Sort by confidence
  matches.sort((a, b) => b.confidence - a.confidence)

  return matches
}