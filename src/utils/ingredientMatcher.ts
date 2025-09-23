import { matchFoodTaxonomy, canSubstitute } from './foodTaxonomyMatcher'
import { supabase } from '@/lib/supabase'

// Cache for taxonomy matches to improve performance
const taxonomyCache = new Map<string, any>()
// Clear cache every 5 minutes to prevent memory leak
setInterval(() => taxonomyCache.clear(), 5 * 60 * 1000)

// Cache for household equivalencies
const householdEquivalenciesCache = new Map<string, Map<string, any[]>>()
// Clear household cache every 10 minutes
setInterval(() => householdEquivalenciesCache.clear(), 10 * 60 * 1000)

// Cache for ML feedback-based corrections
const mlCorrectionsCache = new Map<string, string | null>()
const mlBlockedMatches = new Set<string>()
// Clear ML cache every 10 minutes
setInterval(() => {
  mlCorrectionsCache.clear()
  mlBlockedMatches.clear()
}, 10 * 60 * 1000)

export interface IngredientMatch {
  inventoryItem: any
  matchType: 'exact' | 'partial' | 'category' | 'substitute'
  confidence: number
  notes?: string
}

/**
 * Common ingredient variations and equivalencies
 */
const ingredientEquivalencies: Record<string, string[]> = {
  // Salt variations
  'salt': ['sea salt', 'table salt', 'kosher salt', 'himalayan salt', 'pink salt', 'rock salt', 'fine salt', 'coarse salt', 'mediterranean sea salt', 'celtic salt', 'fleur de sel'],

  // Egg variations
  'eggs': ['egg', 'large eggs', 'medium eggs', 'extra large eggs', 'farm eggs', 'free range eggs', 'organic eggs', 'brown eggs', 'white eggs'],
  'egg whites': ['eggs', 'egg white', 'liquid egg whites', 'egg albumen'],
  'egg yolks': ['eggs', 'egg yolk', 'egg yellow'],
  'egg yolk': ['eggs', 'egg yolks', 'egg yellow'],

  // Sugar variations
  'sugar': ['granulated sugar', 'white sugar', 'cane sugar', 'beet sugar', 'superfine sugar', 'caster sugar', 'baker\'s sugar'],
  'brown sugar': ['light brown sugar', 'dark brown sugar', 'muscovado sugar', 'turbinado sugar', 'demerara sugar'],
  'powdered sugar': ['confectioner\'s sugar', 'icing sugar', '10x sugar', 'confectioners sugar'],

  // Flour variations
  'flour': ['all-purpose flour', 'all purpose flour', 'plain flour', 'white flour', 'wheat flour'],
  'bread flour': ['strong flour', 'high gluten flour', 'baker\'s flour'],
  'cake flour': ['soft flour', 'low protein flour', 'pastry flour'],

  // Butter variations
  'butter': ['unsalted butter', 'salted butter', 'sweet cream butter', 'european butter', 'irish butter', 'cultured butter'],

  // Milk variations
  'milk': ['whole milk', '2% milk', '1% milk', 'skim milk', 'fat free milk', 'reduced fat milk', 'fresh milk'],
  'heavy cream': ['heavy whipping cream', 'whipping cream', 'double cream', '35% cream'],
  'half and half': ['half & half', 'single cream', '18% cream'],

  // Oil variations
  'oil': ['vegetable oil', 'cooking oil', 'neutral oil'],
  'olive oil': ['extra virgin olive oil', 'virgin olive oil', 'light olive oil', 'pure olive oil', 'evoo'],

  // Vinegar variations
  'vinegar': ['white vinegar', 'distilled vinegar', 'white distilled vinegar'],
  'apple cider vinegar': ['acv', 'cider vinegar', 'apple vinegar'],

  // Onion variations
  'onion': ['yellow onion', 'white onion', 'brown onion', 'spanish onion', 'cooking onion'],
  'onions': ['yellow onions', 'white onions', 'brown onions', 'spanish onions'],
  'green onions': ['scallions', 'spring onions', 'salad onions', 'green onion'],

  // Garlic variations
  'garlic': ['fresh garlic', 'garlic cloves', 'garlic bulb', 'minced garlic', 'chopped garlic'],
  'garlic clove': ['garlic', 'clove of garlic', 'garlic cloves', 'fresh garlic'],
  'garlic cloves': ['garlic', 'clove of garlic', 'garlic clove', 'fresh garlic'],
  'garlic powder': ['powdered garlic', 'garlic seasoning', 'dried garlic', 'granulated garlic'],
  'minced garlic': ['garlic', 'chopped garlic', 'crushed garlic'],

  // Pepper variations
  'pepper': ['black pepper', 'ground pepper', 'black peppercorns', 'peppercorns'],
  'black pepper': ['pepper', 'ground black pepper', 'cracked black pepper'],

  // Tomato variations
  'tomatoes': ['fresh tomatoes', 'ripe tomatoes', 'red tomatoes', 'tomato'],
  'canned tomatoes': ['diced tomatoes', 'crushed tomatoes', 'whole tomatoes', 'chopped tomatoes', 'tinned tomatoes'],
  'tomato sauce': ['marinara sauce', 'pasta sauce', 'tomato puree', 'passata'],
  'tomato paste': ['tomato concentrate', 'double concentrated tomato paste'],

  // Cheese variations
  'cheese': ['cheddar', 'cheddar cheese', 'mild cheddar', 'sharp cheddar', 'medium cheddar'],
  'parmesan': ['parmesan cheese', 'parmigiano-reggiano', 'parmigiano reggiano', 'grated parmesan'],
  'mozzarella': ['mozzarella cheese', 'fresh mozzarella', 'low moisture mozzarella', 'shredded mozzarella'],

  // Chicken variations
  'chicken': ['chicken breast', 'chicken thighs', 'chicken legs', 'chicken wings', 'whole chicken'],
  'chicken breast': ['chicken', 'boneless chicken breast', 'skinless chicken breast', 'chicken breasts'],
  'chicken thighs': ['chicken', 'boneless chicken thighs', 'bone-in chicken thighs', 'chicken thigh'],

  // Beef variations
  'beef': ['ground beef', 'beef steak', 'beef roast', 'stew meat'],
  'ground beef': ['beef', 'hamburger', 'minced beef', 'beef mince', 'ground chuck', 'ground sirloin'],
  'steak': ['beef steak', 'ribeye', 't-bone', 'sirloin', 'new york strip', 'filet mignon', 'porterhouse'],

  // Pork variations
  'pork': ['pork chops', 'pork loin', 'pork shoulder', 'pork tenderloin'],
  'bacon': ['sliced bacon', 'thick cut bacon', 'center cut bacon', 'smoked bacon'],

  // Rice variations
  'rice': ['white rice', 'long grain rice', 'jasmine rice', 'basmati rice'],
  'brown rice': ['whole grain rice', 'long grain brown rice', 'short grain brown rice'],

  // Pasta variations
  'pasta': ['spaghetti', 'penne', 'rigatoni', 'fusilli', 'macaroni', 'noodles'],
  'spaghetti': ['pasta', 'long pasta', 'thin spaghetti', 'angel hair'],

  // Broth variations (explicit - not soups)
  'chicken broth': ['chicken stock', 'chicken bouillon', 'chicken base', 'chicken bone broth'],
  'beef broth': ['beef stock', 'beef bouillon', 'beef base', 'beef bone broth'],
  'vegetable broth': ['vegetable stock', 'veggie broth', 'vegetable bouillon'],
  'chicken stock': ['chicken broth', 'chicken bouillon', 'chicken base', 'chicken bone broth'],

  // Herb variations
  'basil': ['fresh basil', 'sweet basil', 'italian basil', 'dried basil'],
  'oregano': ['dried oregano', 'fresh oregano', 'italian oregano', 'greek oregano'],
  'parsley': ['fresh parsley', 'flat leaf parsley', 'italian parsley', 'curly parsley', 'dried parsley'],
  'cilantro': ['fresh cilantro', 'coriander leaves', 'chinese parsley'],
  'thyme': ['fresh thyme', 'dried thyme', 'lemon thyme'],
  'rosemary': ['fresh rosemary', 'dried rosemary'],

  // Spice variations
  'cinnamon': ['ground cinnamon', 'cinnamon powder', 'ceylon cinnamon', 'cassia'],
  'paprika': ['sweet paprika', 'smoked paprika', 'hot paprika', 'spanish paprika', 'hungarian paprika'],
  'cumin': ['ground cumin', 'cumin powder', 'cumin seeds'],
  'chili powder': ['chile powder', 'chilli powder', 'red chili powder'],

  // Baking variations
  'baking soda': ['sodium bicarbonate', 'bicarbonate of soda', 'bicarb'],
  'baking powder': ['double acting baking powder', 'single acting baking powder'],
  'vanilla': ['vanilla extract', 'pure vanilla extract', 'vanilla essence', 'vanilla bean'],
  'chocolate chips': ['chocolate morsels', 'chocolate chunks', 'mini chocolate chips'],

  // Nut variations
  'almonds': ['sliced almonds', 'slivered almonds', 'whole almonds', 'almond slices'],
  'walnuts': ['walnut pieces', 'walnut halves', 'chopped walnuts'],
  'pecans': ['pecan pieces', 'pecan halves', 'chopped pecans'],

  // Common abbreviations
  'evoo': ['extra virgin olive oil', 'olive oil'],
  'acv': ['apple cider vinegar', 'cider vinegar'],
  's&p': ['salt and pepper', 'salt & pepper'],
}

/**
 * Load household equivalencies from database
 */
async function loadHouseholdEquivalencies(householdId: string): Promise<Map<string, any[]>> {
  const cacheKey = householdId

  if (householdEquivalenciesCache.has(cacheKey)) {
    return householdEquivalenciesCache.get(cacheKey)!
  }

  try {
    const { data: equivalencies, error } = await supabase
      .from('household_ingredient_equivalencies')
      .select('*')
      .eq('household_id', householdId)

    if (error) {
      console.warn('Failed to load household equivalencies:', error)
      return new Map()
    }

    const equivalenciesMap = new Map<string, any[]>()

    if (equivalencies) {
      equivalencies.forEach(eq => {
        const key = normalizeIngredient(eq.ingredient_name)
        if (!equivalenciesMap.has(key)) {
          equivalenciesMap.set(key, [])
        }
        equivalenciesMap.get(key)!.push({
          equivalent_name: eq.equivalent_name,
          confidence_score: eq.confidence_score,
          substitution_ratio: eq.substitution_ratio,
          notes: eq.notes,
          is_bidirectional: eq.is_bidirectional
        })

        // Add bidirectional mapping if enabled
        if (eq.is_bidirectional) {
          const reverseKey = normalizeIngredient(eq.equivalent_name)
          if (!equivalenciesMap.has(reverseKey)) {
            equivalenciesMap.set(reverseKey, [])
          }
          equivalenciesMap.get(reverseKey)!.push({
            equivalent_name: eq.ingredient_name,
            confidence_score: eq.confidence_score,
            substitution_ratio: eq.substitution_ratio,
            notes: eq.notes,
            is_bidirectional: eq.is_bidirectional
          })
        }
      })
    }

    householdEquivalenciesCache.set(cacheKey, equivalenciesMap)
    return equivalenciesMap
  } catch (error) {
    console.error('Error loading household equivalencies:', error)
    return new Map()
  }
}

/**
 * Normalize ingredient name for matching
 */
function normalizeIngredient(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, ' ') // Replace special characters with spaces
    .replace(/\s+/g, ' ') // Multiple spaces to single space
    .trim()
}

/**
 * Check if two ingredient names are equivalent
 */
function areIngredientsEquivalent(ingredient1: string, ingredient2: string, householdEquivalencies?: Map<string, any[]>): boolean {
  const norm1 = normalizeIngredient(ingredient1)
  const norm2 = normalizeIngredient(ingredient2)

  // Exact match after normalization
  if (norm1 === norm2) return true

  // Special exclusions - prevent false matches
  // Chicken soup should not match chicken broth
  if ((norm1.includes('soup') && norm2.includes('broth')) ||
      (norm2.includes('soup') && norm1.includes('broth'))) {
    return false
  }

  // Check if one contains the other
  if (norm1.includes(norm2) || norm2.includes(norm1)) return true

  // First check household equivalencies (higher priority)
  if (householdEquivalencies) {
    // Check if ingredient1 has household equivalencies that match ingredient2
    const household1 = householdEquivalencies.get(norm1)
    if (household1) {
      const matches = household1.some(eq => {
        const eqNorm = normalizeIngredient(eq.equivalent_name)
        return norm2.includes(eqNorm) || eqNorm.includes(norm2)
      })
      if (matches) return true
    }

    // Check if ingredient2 has household equivalencies that match ingredient1
    const household2 = householdEquivalencies.get(norm2)
    if (household2) {
      const matches = household2.some(eq => {
        const eqNorm = normalizeIngredient(eq.equivalent_name)
        return norm1.includes(eqNorm) || eqNorm.includes(norm1)
      })
      if (matches) return true
    }
  }

  // Check system equivalency mappings
  for (const [key, equivalents] of Object.entries(ingredientEquivalencies)) {
    const keyNorm = normalizeIngredient(key)
    const equivNorms = equivalents.map(e => normalizeIngredient(e))

    // Check if both ingredients are in the same equivalency group
    const allTerms = [keyNorm, ...equivNorms]
    const has1 = allTerms.some(term => norm1.includes(term) || term.includes(norm1))
    const has2 = allTerms.some(term => norm2.includes(term) || term.includes(norm2))

    if (has1 && has2) return true
  }

  return false
}

/**
 * Find matching inventory items for a recipe ingredient
 */
export function findIngredientMatches(
  recipeIngredient: string,
  inventoryItems: Array<{
    id: string
    name: string
    products?: {
      name: string
      category?: string | null
      brand?: string | null
    }
    quantity: number
    unit?: string | null
  }>,
  householdId?: string
): IngredientMatch[] | Promise<IngredientMatch[]> {
  // If no household ID provided, use sync version (backward compatibility)
  if (!householdId) {
    return findIngredientMatchesSync(recipeIngredient, inventoryItems)
  }

  // Otherwise use async version with household data
  return findIngredientMatchesAsync(recipeIngredient, inventoryItems, householdId)
}

function findIngredientMatchesSync(
  recipeIngredient: string,
  inventoryItems: Array<{
    id: string
    name: string
    products?: {
      name: string
      category?: string | null
      brand?: string | null
    }
    quantity: number
    unit?: string | null
  }>
): IngredientMatch[] {
  const matches: IngredientMatch[] = []
  const normIngredient = normalizeIngredient(recipeIngredient)

  // No household equivalencies in sync version (backward compatibility)

  for (const item of inventoryItems) {
    // Early exit if we have enough high-confidence matches
    if (matches.filter(m => m.confidence >= 0.8).length >= 3) {
      break;
    }

    // Skip items with no quantity
    if (item.quantity <= 0) continue

    const productName = item.products?.name || item.name
    const productCategory = item.products?.category
    const productBrand = item.products?.brand

    // Check if ML feedback has blocked this match
    const blockKey = `${normIngredient}:${normalizeIngredient(productName)}`
    if (mlBlockedMatches.has(blockKey)) {
      continue // Skip this item as it's been marked as incorrect
    }

    // Check for exact or equivalent match (system defaults only in sync version)
    if (areIngredientsEquivalent(recipeIngredient, productName)) {
      matches.push({
        inventoryItem: item,
        matchType: 'exact',
        confidence: 1.0
      })
      continue
    }

    // Check for partial match (ingredient is part of product name or vice versa)
    const normProduct = normalizeIngredient(productName)

    // Special exclusions for partial matching
    // Prevent soup from matching broth
    if ((normIngredient.includes('broth') && normProduct.includes('soup')) ||
        (normIngredient.includes('soup') && normProduct.includes('broth'))) {
      // Skip this match - soup is not broth
    }
    // Prevent pepper from matching non-pepper items (like tomato paste)
    else if (normIngredient === 'pepper' &&
             !normProduct.includes('pepper') &&
             !normProduct.includes('peppercorn')) {
      // Skip this match - pepper should only match pepper products
    }
    // Prevent butter from matching butter-flavored chips or similar compounds
    else if ((normIngredient === 'butter' && normProduct.includes('chips')) ||
             (normIngredient === 'butter' && normProduct.includes('crackers')) ||
             (normIngredient === 'butter' && normProduct.includes('cookies')) ||
             (normIngredient === 'butter' && normProduct.includes('popcorn'))) {
      // Skip this match - butter chips/crackers/cookies are not butter
    } else {
      // Only do partial matching if there's meaningful overlap
      // Avoid matching unrelated items like "garlic" with "mustard"
      const ingredientWords = normIngredient.split(' ').filter(w => w.length > 2)
      const productWords = normProduct.split(' ').filter(w => w.length > 2)

      // Check for meaningful word overlap (not just single letters)
      // Also require at least one full word match for better accuracy

      // Don't match if the product is clearly a flavored/compound product
      // e.g., "butter" shouldn't match "butter toffee", "peanut butter cups", etc.
      const isCompoundProduct = (
        productWords.length > ingredientWords.length &&
        (normProduct.includes('flavored') || normProduct.includes('flavor') ||
         normProduct.includes('chips') || normProduct.includes('crackers') ||
         normProduct.includes('cookies') || normProduct.includes('candy') ||
         normProduct.includes('toffee') || normProduct.includes('popcorn'))
      )

      // For very short ingredients (like "pepper"), require exact word match
      const requireExactMatch = normIngredient.length <= 6

      const hasSignificantOverlap = !isCompoundProduct && ingredientWords.some(word =>
        productWords.some(pWord => {
          if (requireExactMatch) {
            // For short ingredients, only allow exact word match
            return word === pWord
          }
          return (word === pWord) || // Exact word match
                 (word.length > 4 && pWord === word) || // Longer words must match exactly
                 (word.length > 3 && pWord.length > 3 && pWord.includes(word) && word !== 'soup' && word !== 'broth') // Substring match for 3+ char words
        })
      )

      if (hasSignificantOverlap) {
        matches.push({
          inventoryItem: item,
          matchType: 'partial',
          confidence: 0.5, // Lower confidence for partial matches
          notes: `Partial match: "${productName}" for "${recipeIngredient}"`
        })
        continue
      }
    }

    // Check taxonomy match with caching
    const ingredientCacheKey = `ing:${recipeIngredient}`
    let ingredientTaxonomy = taxonomyCache.get(ingredientCacheKey)
    if (ingredientTaxonomy === undefined) {
      ingredientTaxonomy = matchFoodTaxonomy(recipeIngredient)
      taxonomyCache.set(ingredientCacheKey, ingredientTaxonomy)
    }

    const productCacheKey = `prod:${productName}:${productCategory}:${productBrand}`
    let productTaxonomy = taxonomyCache.get(productCacheKey)
    if (productTaxonomy === undefined) {
      productTaxonomy = matchFoodTaxonomy(productName, productCategory, productBrand)
      taxonomyCache.set(productCacheKey, productTaxonomy)
    }

    if (ingredientTaxonomy && productTaxonomy) {
      // Same category and subcategory
      if (ingredientTaxonomy.category === productTaxonomy.category) {
        if (ingredientTaxonomy.subcategory === productTaxonomy.subcategory) {
          matches.push({
            inventoryItem: item,
            matchType: 'category',
            confidence: 0.8,
            notes: `Category match: Both are ${ingredientTaxonomy.category}/${ingredientTaxonomy.subcategory}`
          })
          continue
        } else {
          // Same category but different subcategory
          matches.push({
            inventoryItem: item,
            matchType: 'category',
            confidence: 0.5,
            notes: `Category match: Both are ${ingredientTaxonomy.category}`
          })
          continue
        }
      }
    }

    // Check if items can substitute for each other (skip if we already have good matches)
    if (matches.length < 3 && canSubstitute(recipeIngredient, productName, null, productCategory)) {
      matches.push({
        inventoryItem: item,
        matchType: 'substitute',
        confidence: 0.4,
        notes: `Substitute: "${productName}" can replace "${recipeIngredient}"`
      })
    }
  }

  // Sort by confidence and match type
  matches.sort((a, b) => {
    if (a.confidence !== b.confidence) {
      return b.confidence - a.confidence
    }
    // Prefer exact > partial > category > substitute
    const typeOrder = { 'exact': 0, 'partial': 1, 'category': 2, 'substitute': 3 }
    return typeOrder[a.matchType] - typeOrder[b.matchType]
  })

  // Apply ML feedback boost to confirmed good matches
  const boostedMatches = matches.map(match => {
    const productName = match.inventoryItem.products?.name || match.inventoryItem.name
    const confirmKey = `confirmed:${normIngredient}:${normalizeIngredient(productName)}`

    if (mlCorrectionsCache.get(confirmKey) === 'CONFIRMED') {
      // Boost confidence for ML-confirmed matches
      return {
        ...match,
        confidence: Math.min(1.0, match.confidence * 1.2),
        notes: (match.notes || '') + ' (ML confirmed)'
      }
    }
    return match
  })

  // Sort matches by confidence (highest first)
  return boostedMatches.sort((a, b) => b.confidence - a.confidence)
}

async function findIngredientMatchesAsync(
  recipeIngredient: string,
  inventoryItems: Array<{
    id: string
    name: string
    products?: {
      name: string
      category?: string | null
      brand?: string | null
    }
    quantity: number
    unit?: string | null
  }>,
  householdId: string
): Promise<IngredientMatch[]> {
  const matches: IngredientMatch[] = []
  const normIngredient = normalizeIngredient(recipeIngredient)

  // Load household equivalencies for async version
  let householdEquivalencies: Map<string, any[]> = new Map()
  try {
    householdEquivalencies = await loadHouseholdEquivalencies(householdId)
  } catch (error) {
    console.warn('Failed to load household equivalencies, using system defaults:', error)
  }

  for (const item of inventoryItems) {
    // Early exit if we have enough high-confidence matches
    if (matches.filter(m => m.confidence >= 0.8).length >= 3) {
      break;
    }

    // Skip items with no quantity
    if (item.quantity <= 0) continue

    const productName = item.products?.name || item.name
    const productCategory = item.products?.category
    const productBrand = item.products?.brand

    // Check if ML feedback has blocked this match
    const blockKey = `${normIngredient}:${normalizeIngredient(productName)}`
    if (mlBlockedMatches.has(blockKey)) {
      continue // Skip this item as it's been marked as incorrect
    }

    // Check for exact or equivalent match (including household equivalencies)
    if (areIngredientsEquivalent(recipeIngredient, productName, householdEquivalencies)) {
      // Check if this is a household-specific match for higher confidence
      let confidence = 1.0
      let notes = undefined

      if (householdEquivalencies?.has(normIngredient) || householdEquivalencies?.has(normalizeIngredient(productName))) {
        confidence = 1.0
        notes = `Household equivalency: "${productName}" for "${recipeIngredient}"`
      }

      matches.push({
        inventoryItem: item,
        matchType: 'exact',
        confidence,
        notes
      })
      continue
    }

    // Continue with the same logic as sync version for partial matches, taxonomy, etc.
    // [Rest of the matching logic would go here - for now using the sync logic]

    // Check for partial match (ingredient is part of product name or vice versa)
    const normProduct = normalizeIngredient(productName)

    // Special exclusions for partial matching
    // Prevent soup from matching broth
    if ((normIngredient.includes('broth') && normProduct.includes('soup')) ||
        (normIngredient.includes('soup') && normProduct.includes('broth'))) {
      // Skip this match - soup is not broth
    }
    // Prevent pepper from matching non-pepper items (like tomato paste)
    else if (normIngredient === 'pepper' &&
             !normProduct.includes('pepper') &&
             !normProduct.includes('peppercorn')) {
      // Skip this match - pepper should only match pepper products
    }
    // Prevent butter from matching butter-flavored chips or similar compounds
    else if ((normIngredient === 'butter' && normProduct.includes('chips')) ||
             (normIngredient === 'butter' && normProduct.includes('crackers')) ||
             (normIngredient === 'butter' && normProduct.includes('cookies')) ||
             (normIngredient === 'butter' && normProduct.includes('popcorn'))) {
      // Skip this match - butter chips/crackers/cookies are not butter
    } else {
      // Only do partial matching if there's meaningful overlap
      // Avoid matching unrelated items like "garlic" with "mustard"
      const ingredientWords = normIngredient.split(' ').filter(w => w.length > 2)
      const productWords = normProduct.split(' ').filter(w => w.length > 2)

      // Skip partial matching for complex compound products like snacks
      const isCompoundProduct = (
        normProduct.includes('chips') || normProduct.includes('crackers') ||
        normProduct.includes('cookies') || normProduct.includes('candy') ||
        normProduct.includes('toffee') || normProduct.includes('popcorn')
      )

      // For very short ingredients (like "pepper"), require exact word match
      const requireExactMatch = normIngredient.length <= 6

      const hasSignificantOverlap = !isCompoundProduct && ingredientWords.some(word =>
        productWords.some(pWord => {
          if (requireExactMatch) {
            // For short ingredients, only allow exact word match
            return word === pWord
          }
          return (word === pWord) || // Exact word match
                 (word.length > 4 && pWord === word) || // Longer words must match exactly
                 (word.length > 3 && pWord.length > 3 && pWord.includes(word) && word !== 'soup' && word !== 'broth') // Substring match for 3+ char words
        })
      )

      if (hasSignificantOverlap) {
        matches.push({
          inventoryItem: item,
          matchType: 'partial',
          confidence: 0.5, // Lower confidence for partial matches
          notes: `Partial match: "${productName}" for "${recipeIngredient}"`
        })
        continue
      }
    }

    // Check taxonomy match with caching
    const ingredientCacheKey = `ing:${recipeIngredient}`
    let ingredientTaxonomy = taxonomyCache.get(ingredientCacheKey)
    if (ingredientTaxonomy === undefined) {
      ingredientTaxonomy = matchFoodTaxonomy(recipeIngredient)
      taxonomyCache.set(ingredientCacheKey, ingredientTaxonomy)
    }

    const productCacheKey = `prod:${productName}:${productCategory}:${productBrand}`
    let productTaxonomy = taxonomyCache.get(productCacheKey)
    if (productTaxonomy === undefined) {
      productTaxonomy = matchFoodTaxonomy(productName, productCategory, productBrand)
      taxonomyCache.set(productCacheKey, productTaxonomy)
    }

    if (ingredientTaxonomy && productTaxonomy) {
      // Same category and subcategory
      if (ingredientTaxonomy.category === productTaxonomy.category) {
        if (ingredientTaxonomy.subcategory === productTaxonomy.subcategory) {
          matches.push({
            inventoryItem: item,
            matchType: 'category',
            confidence: 0.8,
            notes: `Category match: Both are ${ingredientTaxonomy.category}/${ingredientTaxonomy.subcategory}`
          })
          continue
        } else {
          // Same category but different subcategory
          matches.push({
            inventoryItem: item,
            matchType: 'category',
            confidence: 0.5,
            notes: `Category match: Both are ${ingredientTaxonomy.category}`
          })
          continue
        }
      }
    }

    // Check if items can substitute for each other (skip if we already have good matches)
    if (matches.length < 3 && canSubstitute(recipeIngredient, productName, null, productCategory)) {
      matches.push({
        inventoryItem: item,
        matchType: 'substitute',
        confidence: 0.4,
        notes: `Substitute: "${productName}" can replace "${recipeIngredient}"`
      })
    }
  }

  // Sort by confidence and match type
  matches.sort((a, b) => {
    if (a.confidence !== b.confidence) {
      return b.confidence - a.confidence
    }
    // Prefer exact > partial > category > substitute
    const typeOrder = { 'exact': 0, 'partial': 1, 'category': 2, 'substitute': 3 }
    return typeOrder[a.matchType] - typeOrder[b.matchType]
  })

  // Apply ML feedback boost to confirmed good matches
  const boostedMatches = matches.map(match => {
    const productName = match.inventoryItem.products?.name || match.inventoryItem.name
    const confirmKey = `confirmed:${normIngredient}:${normalizeIngredient(productName)}`

    if (mlCorrectionsCache.get(confirmKey) === 'CONFIRMED') {
      // Boost confidence for ML-confirmed matches
      return {
        ...match,
        confidence: Math.min(1.0, match.confidence * 1.2),
        notes: match.notes ? `${match.notes} (ML confirmed)` : 'ML confirmed match'
      }
    }
    return match
  })

  // Sort matches by confidence (highest first)
  return boostedMatches.sort((a, b) => b.confidence - a.confidence)
}

/**
 * Check if inventory has all ingredients for a recipe
 */
export function checkRecipeAvailability(
  recipeIngredients: Array<{
    name: string
    quantity?: number
    unit?: string
    optional?: boolean
  }>,
  inventoryItems: Array<{
    id: string
    name: string
    products?: {
      name: string
      category?: string | null
      brand?: string | null
    }
    quantity: number
    unit?: string | null
  }>
): {
  canMake: boolean
  availableIngredients: Array<{ ingredient: string; matches: IngredientMatch[] }>
  missingIngredients: string[]
  optionalMissing: string[]
  availability: number // percentage
} {
  const availableIngredients: Array<{ ingredient: string; matches: IngredientMatch[] }> = []
  const missingIngredients: string[] = []
  const optionalMissing: string[] = []

  let requiredCount = 0
  let availableCount = 0

  for (const ingredient of recipeIngredients) {
    const matches = findIngredientMatches(ingredient.name, inventoryItems)

    if (!ingredient.optional) {
      requiredCount++
    }

    if (matches.length > 0) {
      availableIngredients.push({
        ingredient: ingredient.name,
        matches
      })
      if (!ingredient.optional) {
        availableCount++
      }
    } else {
      if (ingredient.optional) {
        optionalMissing.push(ingredient.name)
      } else {
        missingIngredients.push(ingredient.name)
      }
    }
  }

  const availability = requiredCount > 0 ? (availableCount / requiredCount) * 100 : 100

  return {
    canMake: missingIngredients.length === 0,
    availableIngredients,
    missingIngredients,
    optionalMissing,
    availability
  }
}

/**
 * Get best match for an ingredient from inventory
 */
export function getBestIngredientMatch(
  recipeIngredient: string,
  inventoryItems: any[]
): IngredientMatch | null {
  const matches = findIngredientMatches(recipeIngredient, inventoryItems)
  return matches.length > 0 ? matches[0] : null
}

/**
 * Check if a specific inventory item can be used for a recipe ingredient
 */
export function canUseForIngredient(
  recipeIngredient: string,
  inventoryItemName: string,
  inventoryItemCategory?: string | null
): boolean {
  // Check direct equivalency
  if (areIngredientsEquivalent(recipeIngredient, inventoryItemName)) {
    return true
  }

  // Check taxonomy match
  const ingredientTaxonomy = matchFoodTaxonomy(recipeIngredient)
  const itemTaxonomy = matchFoodTaxonomy(inventoryItemName, inventoryItemCategory)

  if (ingredientTaxonomy && itemTaxonomy &&
      ingredientTaxonomy.category === itemTaxonomy.category &&
      ingredientTaxonomy.subcategory === itemTaxonomy.subcategory) {
    return true
  }

  // Check substitution
  return canSubstitute(recipeIngredient, inventoryItemName, null, inventoryItemCategory)
}

/**
 * Apply ML feedback to improve matching
 * Called when loading feedback from database
 */
export function applyMLFeedback(
  ingredient: string,
  incorrectProduct: string,
  correctProduct: string | null
) {
  const blockKey = `${normalizeIngredient(ingredient)}:${normalizeIngredient(incorrectProduct)}`
  mlBlockedMatches.add(blockKey)

  if (correctProduct) {
    const correctionKey = `${normalizeIngredient(ingredient)}:${normalizeIngredient(incorrectProduct)}`
    mlCorrectionsCache.set(correctionKey, correctProduct)
  }
}

/**
 * Apply positive ML feedback
 */
export function confirmMLMatch(
  ingredient: string,
  product: string
) {
  const confirmKey = `confirmed:${normalizeIngredient(ingredient)}:${normalizeIngredient(product)}`
  mlCorrectionsCache.set(confirmKey, 'CONFIRMED')
}