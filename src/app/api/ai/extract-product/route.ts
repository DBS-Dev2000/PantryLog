import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { description, userId } = await request.json()

    if (!description) {
      return NextResponse.json({ error: 'Description required' }, { status: 400 })
    }

    // Parse common patterns in product descriptions
    const productInfo = parseProductDescription(description)

    // Try to match with UPC database if we have enough info
    let upcMatch = null
    if (productInfo.name && productInfo.brand) {
      upcMatch = await searchUPCDatabase(productInfo.name, productInfo.brand)
    }

    // Use AI to enhance the product information
    const enhancedInfo = await enhanceWithAI(description, productInfo)

    return NextResponse.json({
      ...enhancedInfo,
      upc: upcMatch?.upc,
      confidence: calculateConfidence(enhancedInfo, upcMatch)
    })

  } catch (error: any) {
    console.error('Product extraction error:', error)
    return NextResponse.json(
      { error: 'Failed to extract product information' },
      { status: 500 }
    )
  }
}

function parseProductDescription(description: string) {
  const lowerDesc = description.toLowerCase()
  const result: any = {}

  // Extract size patterns
  const sizePatterns = [
    /(\d+\.?\d*)\s*(oz|ounce|lb|pound|g|gram|kg|kilogram|ml|milliliter|l|liter|gallon|quart|pint)/i,
    /(\d+)\s*(pack|pk|count|ct)/i,
    /(small|medium|large|xl|extra large|family size|king size)/i
  ]

  for (const pattern of sizePatterns) {
    const match = description.match(pattern)
    if (match) {
      result.size = match[0]
      break
    }
  }

  // Extract brand names (common brands)
  const commonBrands = [
    'coca cola', 'coke', 'pepsi', 'nestle', 'kraft', 'heinz', 'kellogg',
    'general mills', 'campbells', 'nabisco', 'oreo', 'lays', 'doritos',
    'tide', 'bounty', 'charmin', 'kleenex', 'huggies', 'pampers'
  ]

  for (const brand of commonBrands) {
    if (lowerDesc.includes(brand)) {
      result.brand = brand.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
      break
    }
  }

  // Extract product category hints
  const categories = {
    'Beverages': ['soda', 'juice', 'water', 'tea', 'coffee', 'drink', 'cola', 'milk'],
    'Snacks': ['chips', 'cookies', 'crackers', 'candy', 'chocolate', 'popcorn'],
    'Dairy': ['milk', 'cheese', 'yogurt', 'butter', 'cream', 'dairy'],
    'Meat': ['chicken', 'beef', 'pork', 'turkey', 'bacon', 'sausage', 'meat'],
    'Produce': ['apple', 'banana', 'orange', 'lettuce', 'tomato', 'potato', 'onion'],
    'Pantry': ['rice', 'pasta', 'beans', 'flour', 'sugar', 'salt', 'oil'],
    'Household': ['paper towel', 'toilet paper', 'tissue', 'detergent', 'soap', 'cleaner'],
    'Personal Care': ['shampoo', 'toothpaste', 'deodorant', 'lotion', 'razor']
  }

  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some(keyword => lowerDesc.includes(keyword))) {
      result.category = category
      break
    }
  }

  // Extract the main product name (remove size, brand, etc)
  let productName = description
  if (result.size) {
    productName = productName.replace(new RegExp(result.size, 'gi'), '')
  }
  if (result.brand) {
    productName = productName.replace(new RegExp(result.brand, 'gi'), '')
  }
  result.name = productName.trim()

  return result
}

async function searchUPCDatabase(name: string, brand: string) {
  // This would integrate with a real UPC database API
  // For now, return mock data for common products
  const mockDatabase: Record<string, any> = {
    'coca cola 12': { upc: '049000006346', exact: true },
    'pepsi 12': { upc: '012000001242', exact: true },
    'oreo cookies': { upc: '044000032029', exact: true },
    'tide detergent': { upc: '037000468271', exact: true }
  }

  const searchKey = `${brand} ${name}`.toLowerCase()
  for (const [key, value] of Object.entries(mockDatabase)) {
    if (searchKey.includes(key)) {
      return value
    }
  }

  return null
}

async function enhanceWithAI(description: string, basicInfo: any) {
  // Use Claude AI to enhance product understanding
  try {
    // Get AI usage record for tracking
    const { data: { session } } = await supabase.auth.getSession()
    const userId = session?.user?.id

    if (userId) {
      // Check if user has AI access
      const { data: household } = await supabase
        .from('households')
        .select('features')
        .eq('id', userId)
        .single()

      if (!household?.features?.ai_features_enabled) {
        // Return basic parsing without AI enhancement
        return basicInfo
      }
    }

    // In production, this would call Claude or another AI service
    // For now, we'll use the basic parsing with some enhancements
    const enhanced = { ...basicInfo }

    // Clean up the product name
    if (enhanced.name) {
      enhanced.name = enhanced.name
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
    }

    // Add default category if missing
    if (!enhanced.category) {
      enhanced.category = 'Other'
    }

    return enhanced

  } catch (error) {
    console.error('AI enhancement error:', error)
    return basicInfo
  }
}

function calculateConfidence(productInfo: any, upcMatch: any) {
  let confidence = 0.5 // Base confidence

  if (productInfo.name) confidence += 0.2
  if (productInfo.brand) confidence += 0.15
  if (productInfo.size) confidence += 0.1
  if (productInfo.category && productInfo.category !== 'Other') confidence += 0.05
  if (upcMatch?.exact) confidence = 1.0
  else if (upcMatch) confidence += 0.3

  return Math.min(confidence, 1.0)
}