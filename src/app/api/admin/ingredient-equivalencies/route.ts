import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const INGREDIENT_MATCHER_FILE = path.join(process.cwd(), 'src/utils/ingredientMatcher.ts')

// Extract ingredient equivalencies from the TypeScript file
function parseIngredientEquivalencies() {
  try {
    const content = fs.readFileSync(INGREDIENT_MATCHER_FILE, 'utf8')

    // Find the ingredientEquivalencies object
    const startPattern = /const ingredientEquivalencies.*?= \{/
    const match = content.match(startPattern)

    if (!match) {
      throw new Error('Could not find ingredientEquivalencies object')
    }

    const startIndex = match.index! + match[0].length

    // Find the closing brace
    let braceCount = 1
    let endIndex = startIndex

    for (let i = startIndex; i < content.length && braceCount > 0; i++) {
      if (content[i] === '{') braceCount++
      if (content[i] === '}') braceCount--
      endIndex = i
    }

    const objectContent = content.substring(startIndex, endIndex)

    // Parse the object content into a more manageable format
    const equivalencies: Array<{ingredient: string, variations: string[]}> = []

    // Split by comma (but be careful of commas within arrays)
    const lines = objectContent.split('\n')
    let currentIngredient = ''
    let currentVariations: string[] = []

    for (const line of lines) {
      const trimmed = line.trim()

      // Skip comments and empty lines
      if (trimmed.startsWith('//') || !trimmed) continue

      // Look for ingredient lines like 'salt': [
      const ingredientMatch = trimmed.match(/['"]([^'"]+)['"]:\s*\[/)
      if (ingredientMatch) {
        // Save previous ingredient if exists
        if (currentIngredient && currentVariations.length > 0) {
          equivalencies.push({
            ingredient: currentIngredient,
            variations: [...currentVariations]
          })
        }

        currentIngredient = ingredientMatch[1]
        currentVariations = []

        // Extract variations from the same line if they exist
        const sameLineVariations = trimmed.match(/\[(.*?)\]/)
        if (sameLineVariations) {
          const variations = sameLineVariations[1]
            .split(',')
            .map(v => v.trim().replace(/['"]/g, ''))
            .filter(v => v)
          currentVariations.push(...variations)
        }
      } else if (trimmed.includes("'") || trimmed.includes('"')) {
        // This is a variation line
        const variations = trimmed
          .split(',')
          .map(v => v.trim().replace(/['"]/g, '').replace(/,$/, ''))
          .filter(v => v && !v.includes(']'))
        currentVariations.push(...variations)
      }
    }

    // Don't forget the last ingredient
    if (currentIngredient && currentVariations.length > 0) {
      equivalencies.push({
        ingredient: currentIngredient,
        variations: [...currentVariations]
      })
    }

    return equivalencies

  } catch (error) {
    console.error('Error parsing ingredient equivalencies:', error)
    return []
  }
}

// Update the TypeScript file with new equivalencies
function updateIngredientEquivalencies(equivalencies: Array<{ingredient: string, variations: string[]}>) {
  try {
    let content = fs.readFileSync(INGREDIENT_MATCHER_FILE, 'utf8')

    // Generate new equivalencies object
    const newEquivalencies = equivalencies.map(eq => {
      const variations = eq.variations.map(v => `'${v.replace(/'/g, "\\'")}'`).join(', ')
      return `  '${eq.ingredient.replace(/'/g, "\\'")}': [${variations}]`
    }).join(',\n\n')

    // Replace the existing equivalencies object
    const startPattern = /(const ingredientEquivalencies.*?= \{)/
    const endPattern = /(\}\s*;?\s*(?=\/\/|const|export|function|\n\n))/

    const startMatch = content.match(startPattern)
    const afterStart = content.substring(startMatch!.index! + startMatch![0].length)
    const endMatch = afterStart.match(endPattern)

    if (startMatch && endMatch) {
      const before = content.substring(0, startMatch.index! + startMatch[0].length)
      const after = afterStart.substring(endMatch.index!)

      content = before + '\n' + newEquivalencies + '\n' + after
    }

    // Backup the original file
    fs.writeFileSync(INGREDIENT_MATCHER_FILE + '.backup', fs.readFileSync(INGREDIENT_MATCHER_FILE))

    // Write the updated content
    fs.writeFileSync(INGREDIENT_MATCHER_FILE, content)

    return true
  } catch (error) {
    console.error('Error updating ingredient equivalencies:', error)
    return false
  }
}

export async function GET() {
  try {
    const equivalencies = parseIngredientEquivalencies()
    return NextResponse.json(equivalencies)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to load ingredient equivalencies' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const newEquivalency = await request.json()
    const currentEquivalencies = parseIngredientEquivalencies()

    // Check if ingredient already exists
    const existingIndex = currentEquivalencies.findIndex(
      eq => eq.ingredient.toLowerCase() === newEquivalency.ingredient.toLowerCase()
    )

    if (existingIndex >= 0) {
      // Update existing
      currentEquivalencies[existingIndex] = newEquivalency
    } else {
      // Add new
      currentEquivalencies.push(newEquivalency)
    }

    // Sort alphabetically by ingredient name
    currentEquivalencies.sort((a, b) => a.ingredient.localeCompare(b.ingredient))

    const success = updateIngredientEquivalencies(currentEquivalencies)

    if (success) {
      return NextResponse.json({ message: 'Ingredient equivalency saved successfully' })
    } else {
      return NextResponse.json(
        { error: 'Failed to save ingredient equivalency' },
        { status: 500 }
      )
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to save ingredient equivalency' },
      { status: 500 }
    )
  }
}

export async function DELETE() {
  try {
    // Implementation for deleting specific equivalencies would go here
    return NextResponse.json({ message: 'Delete functionality coming soon' })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete ingredient equivalency' },
      { status: 500 }
    )
  }
}