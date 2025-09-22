import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const SHELF_LIFE_FILE = path.join(process.cwd(), 'src/data/food-shelf-life.json')

interface ShelfLifeItem {
  category: string
  item: string
  pantry: number
  refrigerator: number
  freezer: number
  notes?: string
}

function flattenShelfLifeData(data: any): ShelfLifeItem[] {
  const items: ShelfLifeItem[] = []

  function traverse(obj: any, categoryPath: string[] = []) {
    for (const [key, value] of Object.entries(obj)) {
      if (value && typeof value === 'object') {
        if ('pantry' in value && 'refrigerator' in value && 'freezer' in value) {
          // This is a shelf life entry
          items.push({
            category: categoryPath.join(' → '),
            item: key,
            pantry: value.pantry,
            refrigerator: value.refrigerator,
            freezer: value.freezer,
            notes: value.notes
          })
        } else {
          // This is a category, continue traversing
          traverse(value, [...categoryPath, key])
        }
      }
    }
  }

  if (data.categories) {
    traverse(data.categories)
  }

  return items
}

function reconstructShelfLifeData(items: ShelfLifeItem[], originalData: any) {
  const newData = { ...originalData }

  // Clear existing categories
  newData.categories = {}

  // Rebuild categories from flat items
  for (const item of items) {
    const categoryParts = item.category.split(' → ')
    let current = newData.categories

    // Navigate/create category structure
    for (let i = 0; i < categoryParts.length; i++) {
      const part = categoryParts[i]
      if (!current[part]) {
        current[part] = {}
      }
      current = current[part]
    }

    // Add the item
    current[item.item] = {
      pantry: item.pantry,
      refrigerator: item.refrigerator,
      freezer: item.freezer,
      ...(item.notes && { notes: item.notes })
    }
  }

  return newData
}

export async function GET() {
  try {
    const data = JSON.parse(fs.readFileSync(SHELF_LIFE_FILE, 'utf8'))
    const flatItems = flattenShelfLifeData(data)
    return NextResponse.json(flatItems)
  } catch (error) {
    console.error('Error loading shelf life data:', error)
    return NextResponse.json(
      { error: 'Failed to load shelf life data' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const newItem: ShelfLifeItem = await request.json()

    // Load current data
    const originalData = JSON.parse(fs.readFileSync(SHELF_LIFE_FILE, 'utf8'))
    const currentItems = flattenShelfLifeData(originalData)

    // Check if item already exists
    const existingIndex = currentItems.findIndex(
      item => item.category === newItem.category && item.item === newItem.item
    )

    if (existingIndex >= 0) {
      // Update existing
      currentItems[existingIndex] = newItem
    } else {
      // Add new
      currentItems.push(newItem)
    }

    // Sort by category then item name
    currentItems.sort((a, b) => {
      const categoryCompare = a.category.localeCompare(b.category)
      if (categoryCompare !== 0) return categoryCompare
      return a.item.localeCompare(b.item)
    })

    // Reconstruct hierarchical data
    const newData = reconstructShelfLifeData(currentItems, originalData)

    // Update lastUpdated
    newData.lastUpdated = new Date().toISOString().split('T')[0]

    // Backup the original file
    fs.writeFileSync(SHELF_LIFE_FILE + '.backup', fs.readFileSync(SHELF_LIFE_FILE))

    // Write updated data
    fs.writeFileSync(SHELF_LIFE_FILE, JSON.stringify(newData, null, 2))

    return NextResponse.json({ message: 'Shelf life data saved successfully' })
  } catch (error) {
    console.error('Error saving shelf life data:', error)
    return NextResponse.json(
      { error: 'Failed to save shelf life data' },
      { status: 500 }
    )
  }
}

export async function DELETE() {
  try {
    // Implementation for deleting specific shelf life entries would go here
    return NextResponse.json({ message: 'Delete functionality coming soon' })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete shelf life data' },
      { status: 500 }
    )
  }
}