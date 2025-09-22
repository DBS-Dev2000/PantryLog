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

  if (data.taxonomy) {
    for (const [category, categoryData] of Object.entries(data.taxonomy)) {
      if (categoryData && typeof categoryData === 'object') {
        for (const [subcategory, subcategoryData] of Object.entries(categoryData)) {
          if (subcategoryData && typeof subcategoryData === 'object') {
            const subcategoryObj = subcategoryData as any

            // Extract items from different possible structures
            let itemsArray: string[] = []

            if (subcategoryObj.subcategories) {
              // Handle nested subcategories like beef -> steaks -> cuts
              for (const [nestedSub, nestedData] of Object.entries(subcategoryObj.subcategories)) {
                const nestedObj = nestedData as any
                if (nestedObj.cuts && Array.isArray(nestedObj.cuts)) {
                  itemsArray.push(...nestedObj.cuts)
                }
                if (nestedObj.items && Array.isArray(nestedObj.items)) {
                  itemsArray.push(...nestedObj.items)
                }
              }
            }

            if (subcategoryObj.cuts && Array.isArray(subcategoryObj.cuts)) {
              itemsArray.push(...subcategoryObj.cuts)
            }

            if (subcategoryObj.items && Array.isArray(subcategoryObj.items)) {
              itemsArray.push(...subcategoryObj.items)
            }

            if (subcategoryObj.fatContent && Array.isArray(subcategoryObj.fatContent)) {
              itemsArray.push(...subcategoryObj.fatContent)
            }

            // If we found items, add this taxonomy entry
            if (itemsArray.length > 0) {
              items.push({
                category,
                subcategory,
                items: itemsArray,
                properties: subcategoryObj.properties
              })
            }
          }
        }
      }
    }
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