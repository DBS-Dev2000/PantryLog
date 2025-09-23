import { NextRequest, NextResponse } from 'next/server'
import { findIngredientMatches as serverFindIngredientMatches } from '@/utils/ingredientMatcher'

export async function POST(request: NextRequest) {
  try {
    const { ingredientName, inventoryProducts, householdId } = await request.json()

    if (!ingredientName) {
      return NextResponse.json(
        { error: 'Ingredient name is required' },
        { status: 400 }
      )
    }

    // Use the server-side version which has all the data
    const matches = await serverFindIngredientMatches(
      ingredientName,
      inventoryProducts || [],
      householdId
    )

    return NextResponse.json({ matches })
  } catch (error) {
    console.error('Error matching ingredients:', error)
    return NextResponse.json(
      { error: 'Failed to match ingredients' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}