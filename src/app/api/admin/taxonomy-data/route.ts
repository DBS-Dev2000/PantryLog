import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const TAXONOMY_FILE = path.join(process.cwd(), 'src/data/food-taxonomy.json')

interface FoodTaxonomyItem {
  category: string
  subcategory: string
  items: string[]
  properties?: any
}

function flattenTaxonomyData(data: any): FoodTaxonomyItem[] {
  const items: FoodTaxonomyItem[] = []

  // Helper function to extract array fields from an object
  function extractArrays(obj: any): string[] {
    let result: string[] = []

    // Look for common array field names
    const arrayFields = ['cuts', 'items', 'types', 'forms', 'varieties', 'products',
                        'fatContent', 'names', 'options', 'brands', 'categories']

    for (const field of arrayFields) {
      if (obj[field] && Array.isArray(obj[field])) {
        result.push(...obj[field])
      }
    }

    return result
  }

  // Recursive function to process taxonomy structure
  function processLevel(obj: any, categoryPath: string[] = []): void {
    if (!obj || typeof obj !== 'object') return

    for (const [key, value] of Object.entries(obj)) {
      if (!value || typeof value !== 'object') continue

      const currentPath = [...categoryPath, key]
      const valueObj = value as any

      // Extract items at current level
      const directItems = extractArrays(valueObj)

      // If we found direct items, create an entry
      if (directItems.length > 0) {
        const category = currentPath[0] || key
        const subcategory = currentPath.slice(1).join(' → ') || key

        items.push({
          category,
          subcategory,
          items: directItems,
          properties: valueObj.properties
        })
      }

      // Process subcategories if they exist
      if (valueObj.subcategories) {
        for (const [subKey, subValue] of Object.entries(valueObj.subcategories)) {
          const subObj = subValue as any
          const subItems = extractArrays(subObj)

          if (subItems.length > 0) {
            items.push({
              category: currentPath[0] || key,
              subcategory: [...currentPath.slice(1), subKey].join(' → '),
              items: subItems,
              properties: subObj.properties
            })
          }

          // Recursively process deeper levels
          if (subObj.subcategories) {
            processLevel(subObj.subcategories, [...currentPath, subKey])
          }
        }
      }

      // Also process any nested category-like structures
      const skipKeys = ['properties', 'category', 'substitutions', 'recipeMatches',
                       'subcategories', 'cookingMethods', 'averagePortionOz']

      for (const [nestedKey, nestedValue] of Object.entries(valueObj)) {
        if (!skipKeys.includes(nestedKey) &&
            nestedValue &&
            typeof nestedValue === 'object' &&
            !Array.isArray(nestedValue)) {
          processLevel({ [nestedKey]: nestedValue }, currentPath)
        }
      }
    }
  }

  // Start processing from the taxonomy root
  if (data.taxonomy) {
    processLevel(data.taxonomy)
  }

  return items
}

function reconstructTaxonomyData(items: FoodTaxonomyItem[], originalData: any) {
  const newData = { ...originalData }

  // Clear existing taxonomy
  newData.taxonomy = {}

  // Rebuild taxonomy from flat items
  for (const item of items) {
    if (!newData.taxonomy[item.category]) {
      newData.taxonomy[item.category] = {}
    }

    newData.taxonomy[item.category][item.subcategory] = {
      cuts: item.items,
      ...(item.properties && { properties: item.properties })
    }
  }

  return newData
}

export async function GET() {
  try {
    const data = JSON.parse(fs.readFileSync(TAXONOMY_FILE, 'utf8'))
    const flatItems = flattenTaxonomyData(data)
    return NextResponse.json(flatItems)
  } catch (error) {
    console.error('Error loading taxonomy data:', error)
    return NextResponse.json(
      { error: 'Failed to load taxonomy data' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const newItem: FoodTaxonomyItem = await request.json()

    // Load current data
    const originalData = JSON.parse(fs.readFileSync(TAXONOMY_FILE, 'utf8'))
    const currentItems = flattenTaxonomyData(originalData)

    // Check if item already exists
    const existingIndex = currentItems.findIndex(
      item => item.category === newItem.category && item.subcategory === newItem.subcategory
    )

    if (existingIndex >= 0) {
      // Update existing
      currentItems[existingIndex] = newItem
    } else {
      // Add new
      currentItems.push(newItem)
    }

    // Sort by category then subcategory
    currentItems.sort((a, b) => {
      const categoryCompare = a.category.localeCompare(b.category)
      if (categoryCompare !== 0) return categoryCompare
      return a.subcategory.localeCompare(b.subcategory)
    })

    // Reconstruct hierarchical data
    const newData = reconstructTaxonomyData(currentItems, originalData)

    // Update lastUpdated
    newData.lastUpdated = new Date().toISOString().split('T')[0]

    // Backup the original file
    fs.writeFileSync(TAXONOMY_FILE + '.backup', fs.readFileSync(TAXONOMY_FILE))

    // Write updated data
    fs.writeFileSync(TAXONOMY_FILE, JSON.stringify(newData, null, 2))

    return NextResponse.json({ message: 'Taxonomy data saved successfully' })
  } catch (error) {
    console.error('Error saving taxonomy data:', error)
    return NextResponse.json(
      { error: 'Failed to save taxonomy data' },
      { status: 500 }
    )
  }
}

export async function DELETE() {
  try {
    // Implementation for deleting specific taxonomy entries would go here
    return NextResponse.json({ message: 'Delete functionality coming soon' })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete taxonomy data' },
      { status: 500 }
    )
  }
}