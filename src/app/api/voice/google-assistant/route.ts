/**
 * Google Assistant Actions Webhook
 *
 * This endpoint handles Google Assistant voice commands for PantryIQ.
 * Users can say things like:
 * - "Hey Google, ask PantryIQ to add Coca Cola to my pantry"
 * - "Hey Google, tell PantryIQ I used the milk"
 * - "Hey Google, ask PantryIQ what's expiring soon"
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

interface GoogleAssistantRequest {
  handler: {
    name: string
  }
  intent: {
    name: string
    params?: Record<string, any>
  }
  scene?: {
    name: string
    slots?: Record<string, any>
  }
  session: {
    id: string
    params?: Record<string, any>
    user?: {
      locale: string
      params?: {
        userId?: string
      }
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: GoogleAssistantRequest = await request.json()
    console.log('Google Assistant Request:', JSON.stringify(body, null, 2))

    const { intent, session } = body
    const userId = session.user?.params?.userId

    if (!userId) {
      return createGoogleResponse(
        "Please link your PantryIQ account first. Check the Google Home app for instructions.",
        false
      )
    }

    // Handle different intents
    switch (intent.name) {
      case 'AddItem':
        return handleAddItem(userId, intent.params)

      case 'RemoveItem':
        return handleRemoveItem(userId, intent.params)

      case 'CheckExpiring':
        return handleCheckExpiring(userId)

      case 'CheckInventory':
        return handleCheckInventory(userId, intent.params)

      default:
        return createGoogleResponse(
          "I can help you add items, remove items, or check what's expiring. What would you like to do?",
          true
        )
    }

  } catch (error: any) {
    console.error('Google Assistant webhook error:', error)
    return createGoogleResponse(
      "Sorry, I had trouble processing that request. Please try again.",
      false
    )
  }
}

async function handleAddItem(userId: string, params: any) {
  const productName = params?.product?.resolved || params?.product?.original
  const location = params?.location?.resolved || params?.location?.original || 'main pantry'
  const quantity = params?.quantity?.resolved || 1

  if (!productName) {
    return createGoogleResponse(
      "What would you like to add to your inventory?",
      true
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
        notes: 'Added via Google Assistant'
      })

    if (error) throw error

    return createGoogleResponse(
      `I've added ${quantity} ${productName} to your ${location}. Is there anything else?`,
      true
    )

  } catch (error) {
    console.error('Error adding item:', error)
    return createGoogleResponse(
      `Sorry, I couldn't add ${productName} to your inventory. Please try again.`,
      false
    )
  }
}

async function handleRemoveItem(userId: string, params: any) {
  const productName = params?.product?.resolved || params?.product?.original

  if (!productName) {
    return createGoogleResponse(
      "What item would you like to remove from your inventory?",
      true
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
      return createGoogleResponse(
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
      return createGoogleResponse(
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

    return createGoogleResponse(
      `I've removed ${productName} from your inventory. Anything else?`,
      true
    )

  } catch (error) {
    console.error('Error removing item:', error)
    return createGoogleResponse(
      `Sorry, I couldn't remove ${productName}. Please try again.`,
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
      return createGoogleResponse(
        "Good news! Nothing is expiring in the next week.",
        false
      )
    }

    const itemList = items
      .map((item: any) => {
        const daysUntil = Math.ceil(
          (new Date(item.expiration_date).getTime() - today.getTime()) / (24 * 60 * 60 * 1000)
        )
        return `${item.products.name} expires in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}`
      })
      .join(', ')

    return createGoogleResponse(
      `You have ${items.length} items expiring soon: ${itemList}`,
      false
    )

  } catch (error) {
    console.error('Error checking expiring items:', error)
    return createGoogleResponse(
      "Sorry, I couldn't check your expiring items right now.",
      false
    )
  }
}

async function handleCheckInventory(userId: string, params: any) {
  const productName = params?.product?.resolved || params?.product?.original

  if (!productName) {
    // Return general inventory summary
    try {
      const { count } = await supabase
        .from('inventory_items')
        .select('*', { count: 'exact', head: true })
        .eq('household_id', userId)
        .eq('is_consumed', false)

      return createGoogleResponse(
        `You have ${count} items in your inventory. What specific item would you like to check?`,
        true
      )
    } catch (error) {
      return createGoogleResponse(
        "Sorry, I couldn't check your inventory right now.",
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
      return createGoogleResponse(
        `You don't have any ${productName} in your inventory.`,
        false
      )
    }

    const total = items.reduce((sum: number, item: any) => sum + item.quantity, 0)
    const locations = [...new Set(items.map((i: any) => i.storage_locations.name))].join(', ')

    return createGoogleResponse(
      `You have ${total} ${productName} in ${locations}.`,
      false
    )

  } catch (error) {
    console.error('Error checking inventory:', error)
    return createGoogleResponse(
      `Sorry, I couldn't check your ${productName} inventory.`,
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

function createGoogleResponse(prompt: string, expectUserResponse: boolean) {
  return NextResponse.json({
    prompt: {
      override: false,
      firstSimple: {
        speech: prompt,
        text: prompt
      }
    },
    scene: {
      name: 'actions.scene.END_CONVERSATION',
      next: expectUserResponse ? undefined : {
        name: 'actions.scene.END_CONVERSATION'
      }
    }
  })
}