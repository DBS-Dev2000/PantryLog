/**
 * Alexa Skills Kit Webhook
 *
 * This endpoint handles Alexa voice commands for PantryIQ.
 * Users can say:
 * - "Alexa, ask PantryIQ to add milk to my pantry"
 * - "Alexa, tell PantryIQ I used the chicken"
 * - "Alexa, ask PantryIQ what's expiring"
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { voiceApiLimiter, rateLimitExceededResponse } from '@/lib/rate-limit'

interface AlexaRequest {
  version: string
  session: {
    sessionId: string
    user: {
      userId: string
      accessToken?: string
    }
  }
  request: {
    type: string
    requestId: string
    intent?: {
      name: string
      slots?: Record<string, {
        name: string
        value?: string
        resolutions?: {
          resolutionsPerAuthority: Array<{
            values: Array<{
              value: {
                name: string
                id: string
              }
            }>
          }>
        }
      }>
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting for voice API
    const rateLimitResult = voiceApiLimiter.check(request)
    if (!rateLimitResult.success) {
      console.log('🚫 Rate limit exceeded for Alexa voice endpoint')
      // For Alexa, return a voice response instead of HTTP 429
      return NextResponse.json(createAlexaResponse(
        "You're using voice commands too frequently. Please wait a moment and try again.",
        true
      ))
    }

    const body: AlexaRequest = await request.json()
    console.log('Alexa Request:', JSON.stringify(body, null, 2))

    const { request: alexaRequest, session } = body

    // Get user ID from account linking
    const userId = session.user.accessToken // This would be set up through Alexa account linking

    if (!userId) {
      return createAlexaResponse(
        "Please link your PantryIQ account in the Alexa app first.",
        false
      )
    }

    // Handle different request types
    switch (alexaRequest.type) {
      case 'LaunchRequest':
        return createAlexaResponse(
          "Welcome to PantryIQ! You can add items, remove items, or check what's expiring. What would you like to do?",
          false
        )

      case 'IntentRequest':
        return handleIntent(userId, alexaRequest.intent!)

      case 'SessionEndedRequest':
        return createAlexaResponse("Goodbye!", true)

      default:
        return createAlexaResponse(
          "I didn't understand that. You can add items, remove items, or check expiring items.",
          false
        )
    }

  } catch (error: any) {
    console.error('Alexa webhook error:', error)
    return createAlexaResponse(
      "Sorry, I had trouble with that request. Please try again.",
      false
    )
  }
}

async function handleIntent(userId: string, intent: any) {
  switch (intent.name) {
    case 'AddItemIntent':
      return handleAddItem(userId, intent.slots)

    case 'RemoveItemIntent':
      return handleRemoveItem(userId, intent.slots)

    case 'CheckExpiringIntent':
      return handleCheckExpiring(userId)

    case 'CheckInventoryIntent':
      return handleCheckInventory(userId, intent.slots)

    case 'AMAZON.HelpIntent':
      return createAlexaResponse(
        "You can say things like: Add milk to my pantry, Remove chicken from inventory, or What's expiring soon?",
        false
      )

    case 'AMAZON.CancelIntent':
    case 'AMAZON.StopIntent':
      return createAlexaResponse("Goodbye!", true)

    default:
      return createAlexaResponse(
        "I can help you add items, remove items, or check what's expiring. What would you like?",
        false
      )
  }
}

async function handleAddItem(userId: string, slots: any) {
  const productSlot = slots?.product
  const productName = productSlot?.value
  const locationSlot = slots?.location
  const location = locationSlot?.value || 'pantry'
  const quantitySlot = slots?.quantity
  const quantity = parseInt(quantitySlot?.value || '1')

  if (!productName) {
    return createAlexaResponse(
      "What would you like to add to your inventory?",
      false
    )
  }

  try {
    // Extract product information
    const productInfo = await extractProductInfo(productName)

    // Find or create product
    let productId = await findOrCreateProduct(productInfo, userId)

    // Find storage location
    const { data: storageLocation } = await supabase
      .from('storage_locations')
      .select('id')
      .eq('household_id', userId)
      .ilike('name', `%${location}%`)
      .single()

    const locationId = storageLocation?.id || await getDefaultLocation(userId)

    // Add to inventory
    const { error } = await supabase
      .from('inventory_items')
      .insert({
        product_id: productId,
        storage_location_id: locationId,
        household_id: userId,
        quantity: quantity,
        unit: 'pieces',
        purchase_date: new Date().toISOString().split('T')[0],
        notes: 'Added via Alexa'
      })

    if (error) throw error

    return createAlexaResponse(
      `I've added ${quantity} ${productName} to your ${location}.`,
      false
    )

  } catch (error) {
    console.error('Error adding item:', error)
    return createAlexaResponse(
      `Sorry, I couldn't add ${productName} to your inventory.`,
      false
    )
  }
}

async function handleRemoveItem(userId: string, slots: any) {
  const productSlot = slots?.product
  const productName = productSlot?.value

  if (!productName) {
    return createAlexaResponse(
      "What item would you like to remove?",
      false
    )
  }

  try {
    // Find the product
    const { data: products } = await supabase
      .from('products')
      .select('id')
      .ilike('name', `%${productName}%`)
      .limit(1)

    if (!products || products.length === 0) {
      return createAlexaResponse(
        `I couldn't find ${productName} in your inventory.`,
        false
      )
    }

    // Find and consume the oldest item (FIFO)
    const { data: items } = await supabase
      .from('inventory_items')
      .select('id')
      .eq('household_id', userId)
      .eq('product_id', products[0].id)
      .eq('is_consumed', false)
      .order('purchase_date', { ascending: true })
      .limit(1)

    if (!items || items.length === 0) {
      return createAlexaResponse(
        `You don't have any ${productName} in your inventory.`,
        false
      )
    }

    // Mark as consumed
    const { error } = await supabase
      .from('inventory_items')
      .update({
        is_consumed: true,
        consumed_date: new Date().toISOString()
      })
      .eq('id', items[0].id)

    if (error) throw error

    return createAlexaResponse(
      `I've removed ${productName} from your inventory.`,
      false
    )

  } catch (error) {
    console.error('Error removing item:', error)
    return createAlexaResponse(
      `Sorry, I couldn't remove ${productName}.`,
      false
    )
  }
}

async function handleCheckExpiring(userId: string) {
  try {
    const today = new Date()
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)

    const { data: items } = await supabase
      .from('inventory_items')
      .select('*, products(name)')
      .eq('household_id', userId)
      .eq('is_consumed', false)
      .gte('expiration_date', today.toISOString())
      .lte('expiration_date', nextWeek.toISOString())
      .order('expiration_date')
      .limit(5)

    if (!items || items.length === 0) {
      return createAlexaResponse(
        "Good news! Nothing is expiring in the next week.",
        false
      )
    }

    const itemList = items
      .map((item: any) => {
        const daysUntil = Math.ceil(
          (new Date(item.expiration_date).getTime() - today.getTime()) / (24 * 60 * 60 * 1000)
        )
        return `${item.products.name} in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}`
      })
      .join(', ')

    return createAlexaResponse(
      `You have ${items.length} items expiring soon: ${itemList}`,
      false
    )

  } catch (error) {
    console.error('Error checking expiring items:', error)
    return createAlexaResponse(
      "Sorry, I couldn't check your expiring items.",
      false
    )
  }
}

async function handleCheckInventory(userId: string, slots: any) {
  const productSlot = slots?.product
  const productName = productSlot?.value

  if (!productName) {
    // Return general summary
    try {
      const { count } = await supabase
        .from('inventory_items')
        .select('*', { count: 'exact', head: true })
        .eq('household_id', userId)
        .eq('is_consumed', false)

      return createAlexaResponse(
        `You have ${count} items in your inventory.`,
        false
      )
    } catch (error) {
      return createAlexaResponse(
        "Sorry, I couldn't check your inventory.",
        false
      )
    }
  }

  // Check specific product
  try {
    const { data: items } = await supabase
      .from('inventory_items')
      .select('*, products(name), storage_locations(name)')
      .eq('household_id', userId)
      .eq('is_consumed', false)
      .ilike('products.name', `%${productName}%`)

    if (!items || items.length === 0) {
      return createAlexaResponse(
        `You don't have any ${productName} in your inventory.`,
        false
      )
    }

    const total = items.reduce((sum: number, item: any) => sum + item.quantity, 0)

    return createAlexaResponse(
      `You have ${total} ${productName} in your inventory.`,
      false
    )

  } catch (error) {
    console.error('Error checking inventory:', error)
    return createAlexaResponse(
      `Sorry, I couldn't check ${productName}.`,
      false
    )
  }
}

async function extractProductInfo(description: string) {
  const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/ai/extract-product`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description })
  })

  if (response.ok) {
    return await response.json()
  }

  return { name: description, confidence: 0.5 }
}

async function findOrCreateProduct(productInfo: any, userId: string) {
  // Try to find existing product
  const { data: existing } = await supabase
    .from('products')
    .select('id')
    .ilike('name', `%${productInfo.name}%`)
    .limit(1)

  if (existing && existing.length > 0) {
    return existing[0].id
  }

  // Create new product
  const { data: newProduct, error } = await supabase
    .from('products')
    .insert({
      name: productInfo.name,
      brand: productInfo.brand,
      category: productInfo.category || 'Other',
      is_custom: true,
      created_by: userId
    })
    .select('id')
    .single()

  if (error) throw error
  return newProduct.id
}

async function getDefaultLocation(userId: string) {
  const { data: location } = await supabase
    .from('storage_locations')
    .select('id')
    .eq('household_id', userId)
    .eq('is_active', true)
    .order('created_date')
    .limit(1)
    .single()

  return location?.id
}

function createAlexaResponse(speechText: string, shouldEndSession: boolean) {
  return NextResponse.json({
    version: '1.0',
    response: {
      outputSpeech: {
        type: 'PlainText',
        text: speechText
      },
      shouldEndSession: shouldEndSession
    }
  })
}