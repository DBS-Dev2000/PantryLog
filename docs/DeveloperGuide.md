# PantryIQ Developer Guide

**Version:** 1.0
**Last Updated:** January 22, 2025
**Platform:** Next.js 15.5.3 with TypeScript and Supabase

## 📋 Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Intelligent Ingredient Matching System](#intelligent-ingredient-matching-system)
3. [Food Taxonomy System](#food-taxonomy-system)
4. [UI Component Patterns](#ui-component-patterns)
5. [Database Schema](#database-schema)
6. [API Endpoints](#api-endpoints)
7. [Development Guidelines](#development-guidelines)

## 🏗️ Architecture Overview

### Technology Stack
- **Frontend**: Next.js 15.5.3, React 19, TypeScript
- **UI Library**: Material-UI (MUI) 6.x
- **Backend**: Supabase (PostgreSQL + Auth + Realtime)
- **AI Services**: Claude API, Gemini API
- **State Management**: React Context + Local State
- **Styling**: Emotion CSS-in-JS + MUI Theme

### Project Structure
```
PantryLog/
├── src/
│   ├── app/              # Next.js app router pages
│   ├── components/       # Reusable React components
│   ├── utils/           # Utility functions
│   │   ├── ingredientMatcher.ts    # Ingredient matching logic
│   │   ├── foodTaxonomyMatcher.ts  # Food classification
│   │   └── shelfLifeCalculator.ts  # Expiration calculations
│   ├── lib/             # External service configs
│   └── types/           # TypeScript type definitions
├── supabase/            # Database migrations and functions
└── docs/               # Documentation
```

## 🧠 Intelligent Ingredient Matching System

### Core Module: `ingredientMatcher.ts`

The ingredient matching system uses a multi-tier confidence scoring approach:

```typescript
export interface IngredientMatch {
  inventoryItem: any
  matchType: 'exact' | 'partial' | 'category' | 'substitute'
  confidence: number  // 0.0 to 1.0
  notes?: string
}
```

### Matching Tiers

#### 1. Exact Match (100% confidence)
```typescript
// Direct name match after normalization
normalizeIngredient("Sea Salt") === normalizeIngredient("sea salt")
```

#### 2. Equivalency Match (100% confidence)
```typescript
const ingredientEquivalencies = {
  'salt': ['sea salt', 'kosher salt', 'table salt', 'himalayan salt'],
  'eggs': ['egg whites', 'egg yolks', 'large eggs', 'medium eggs'],
  'chicken broth': ['chicken stock', 'chicken bouillon', 'bone broth']
  // 100+ more entries
}
```

#### 3. Partial Match (50% confidence)
```typescript
// Meaningful word overlap (4+ characters)
// "garlic cloves" matches "fresh garlic"
// BUT prevents "garlic" matching "garlic mustard"
const hasSignificantOverlap = ingredientWords.some(word =>
  productWords.some(pWord =>
    (word === pWord) ||
    (word.length > 4 && pWord === word) ||
    (word.length > 3 && pWord.includes(word))
  )
)
```

#### 4. Category Match (30-80% confidence)
```typescript
// Same food taxonomy category
if (ingredientTaxonomy.category === productTaxonomy.category) {
  if (ingredientTaxonomy.subcategory === productTaxonomy.subcategory) {
    confidence = 0.8  // Same subcategory
  } else {
    confidence = 0.5  // Same category only
  }
}
```

#### 5. Substitute Match (40% confidence)
```typescript
// Can substitute in recipes
canSubstitute('chicken broth', 'vegetable broth') // true
canSubstitute('chicken soup', 'chicken broth')    // false
```

### Smart Exclusions

Prevent common false matches:

```typescript
// Special exclusions
if ((norm1.includes('soup') && norm2.includes('broth')) ||
    (norm2.includes('soup') && norm1.includes('broth'))) {
  return false  // Soup is not broth
}
```

### Usage Example

```typescript
import { findIngredientMatches } from '@/utils/ingredientMatcher'

// Find matches for a recipe ingredient
const matches = findIngredientMatches(
  'garlic cloves',  // Recipe ingredient
  inventoryItems    // User's pantry items
)

// Results sorted by confidence
matches.forEach(match => {
  console.log(`${match.inventoryItem.name}: ${match.confidence * 100}%`)
})
```

## 🍽️ Food Taxonomy System

### Module: `foodTaxonomyMatcher.ts`

Hierarchical food classification system:

```typescript
interface FoodTaxonomy {
  category: string      // 'proteins', 'dairy', 'grains'
  subcategory: string   // 'beef', 'milk', 'bread'
  specific?: string     // 'steaks', 'whole milk', 'white bread'
}
```

### Taxonomy Hierarchy
```
proteins/
├── beef/
│   ├── steaks/
│   │   ├── ribeye
│   │   ├── t-bone
│   │   └── sirloin
│   └── ground/
├── poultry/
│   ├── chicken/
│   └── turkey/
└── seafood/
```

### Shelf Life Integration

```typescript
const shelfLifeDatabase = {
  'proteins/beef/steaks': {
    pantry: 0,      // Not safe at room temp
    refrigerator: 3,  // 3 days
    freezer: 180     // 6 months
  },
  'dairy/milk': {
    pantry: 0,
    refrigerator: 7,
    freezer: 90
  }
}
```

## 🎨 UI Component Patterns

### Recipe Ingredient Display

```tsx
// Color-coded shopping buttons
<Button
  variant={isInStock ? 'outlined' : 'contained'}
  color={
    isInStock ? 'success' :      // Green
    isLowStock ? 'warning' :     // Yellow
    'primary'                     // Blue (softer than red)
  }
>
  {isInStock ? 'In Stock' :
   isLowStock ? 'Low Stock' :
   'Add to List'}
</Button>
```

### Feedback System

```tsx
// ML feedback buttons
<IconButton onClick={() => handleFeedback('positive')}>
  👍
</IconButton>
<IconButton onClick={() => openFeedbackDialog()}>
  👎
</IconButton>
```

### Enhanced Skip Button

```tsx
<Button
  variant={isSkipped ? 'contained' : 'outlined'}
  color={isSkipped ? 'success' : 'warning'}
  sx={{
    fontWeight: 'medium',
    borderWidth: isSkipped ? 1 : 2
  }}
>
  {isSkipped ? 'Include' : 'Skip'}
</Button>
```

## 💾 Database Schema

### Key Tables for Matching

```sql
-- Inventory items with products
CREATE TABLE inventory_items (
  id UUID PRIMARY KEY,
  product_id UUID REFERENCES products(id),
  household_id UUID,
  name TEXT,
  quantity NUMERIC,
  unit TEXT,
  storage_location_id UUID
);

-- Products master table
CREATE TABLE products (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  brand TEXT,
  barcode TEXT,
  food_taxonomy JSONB
);

-- ML feedback for matching
CREATE TABLE ingredient_match_feedback (
  id UUID PRIMARY KEY,
  recipe_ingredient TEXT,
  matched_product TEXT,
  is_correct BOOLEAN,
  user_feedback TEXT,
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 🔌 API Endpoints

### Ingredient Matching

```typescript
// GET /api/recipes/[id]/check-ingredients
// Returns ingredient availability with matches
{
  ingredients: [
    {
      ingredient_name: "garlic cloves",
      availability_status: "available",
      matched_product_name: "Fresh Garlic",
      match_strength: "85% confidence",
      matches: [...]
    }
  ]
}
```

### Feedback Submission

```typescript
// POST /api/feedback/ingredient-match
{
  recipe_ingredient: "chicken broth",
  incorrect_match: "chicken soup",
  reason: "Soup is not the same as broth",
  recipe_id: "uuid",
  user_id: "uuid"
}
```

## 📝 Development Guidelines

### Adding New Equivalencies

1. Edit `src/utils/ingredientMatcher.ts`
2. Add to `ingredientEquivalencies` object
3. Test with common variations
4. Consider exclusions needed

```typescript
// Example: Adding a new equivalency
'yogurt': [
  'greek yogurt',
  'plain yogurt',
  'natural yogurt',
  'whole milk yogurt'
]
```

### Improving Match Accuracy

1. Collect user feedback through thumbs up/down
2. Analyze false positives/negatives
3. Add exclusions for common mistakes
4. Adjust confidence thresholds

### Testing Matches

```typescript
// Test utility
import { areIngredientsEquivalent } from '@/utils/ingredientMatcher'

describe('Ingredient Matching', () => {
  test('salt variations match', () => {
    expect(areIngredientsEquivalent('salt', 'sea salt')).toBe(true)
    expect(areIngredientsEquivalent('salt', 'kosher salt')).toBe(true)
  })

  test('soup does not match broth', () => {
    expect(areIngredientsEquivalent('chicken soup', 'chicken broth')).toBe(false)
  })
})
```

### Performance Considerations

- Ingredient matching runs client-side for instant feedback
- Cache taxonomy lookups in component state
- Batch API calls when checking multiple ingredients
- Use React.memo for ingredient list items

### Common Pitfalls to Avoid

1. **Don't match too broadly**: "egg" shouldn't match "eggplant"
2. **Respect exclusions**: Soup ≠ Broth, even if names overlap
3. **Consider context**: "Chicken" in main dish vs garnish
4. **Handle plurals**: "egg" should match "eggs"
5. **Normalize consistently**: Remove special chars, lowercase

## 🚀 Future Enhancements

### Planned Improvements

1. **Machine Learning Integration**
   - Train on user feedback data
   - Improve confidence scoring
   - Auto-learn new equivalencies

2. **Context-Aware Matching**
   - Consider recipe type (baking vs cooking)
   - Understand quantity requirements
   - Factor in dietary restrictions

3. **Performance Optimizations**
   - Server-side matching for large inventories
   - Redis caching for common queries
   - Elasticsearch for fuzzy matching

4. **Advanced Features**
   - Brand-specific matching
   - Regional variation support
   - Allergen awareness

## 📚 Resources

- [Material-UI Documentation](https://mui.com/material-ui/)
- [Next.js App Router](https://nextjs.org/docs/app)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## 🤝 Contributing

1. Follow existing code patterns
2. Add tests for new features
3. Update equivalency database thoughtfully
4. Document complex logic
5. Consider mobile UX

---

**Questions?** Check the main CLAUDE.md file for project overview or reach out to the development team.