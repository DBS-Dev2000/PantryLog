import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Service role client for internal operations only
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function createAuthClient(req: NextRequest) {
  const authorization = req.headers.get('authorization')
  if (!authorization) {
    throw new Error('Authentication required. Please log in to generate predictive shopping lists.')
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          authorization
        }
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    }
  )
}

export async function POST(request: NextRequest) {
  try {
    // SECURITY FIX: Get authenticated user instead of accepting user_id from request
    const authSupabase = createAuthClient(request)
    const { data: { user }, error: userError } = await authSupabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Authentication required. Please log in to generate predictive shopping lists.' },
        { status: 401 }
      )
    }

    const { prediction_days = 7 } = await request.json()
    const userId = user.id

    console.log('🔮 Generating predictive shopping list for user:', userId)

    // Analyze consumption patterns
    const consumptionAnalysis = await analyzeConsumptionPatterns(authSupabase, userId, prediction_days)

    // Generate AI-powered predictions
    const predictiveItems = await generatePredictiveItems(authSupabase, userId, consumptionAnalysis)

    console.log('✅ Predictive shopping list generated:', predictiveItems.length, 'items')
    return NextResponse.json({
      predicted_items: predictiveItems,
      analysis: consumptionAnalysis,
      prediction_period_days: prediction_days
    })

  } catch (error: any) {
    console.error('Predictive shopping list error:', error)
    return NextResponse.json(
      { error: 'Failed to generate predictive list: ' + error.message },
      { status: 500 }
    )
  }
}

async function analyzeConsumptionPatterns(supabase: any, userId: string, days: number) {
  const endDate = new Date()
  const startDate = new Date(endDate)
  startDate.setDate(startDate.getDate() - days)

  // Get consumption history from audit log
  const { data: consumptionData, error } = await supabase
    .from('inventory_audit_log')
    .select(`
      inventory_item_id,
      action_type,
      quantity_delta,
      action_date,
      inventory_items (
        products (id, name, brand, category, upc),
        unit
      )
    `)
    .eq('household_id', userId)
    .in('action_type', ['remove', 'consume'])
    .gte('action_date', startDate.toISOString())
    .order('action_date', { ascending: false })

  if (error) {
    console.error('Error getting consumption data:', error)
    return { consumption_rate: {}, trends: [], low_stock: [] }
  }

  // Analyze patterns
  const productConsumption = new Map()
  const categoryTrends = new Map()

  consumptionData?.forEach(record => {
    const product = record.inventory_items?.products
    if (!product) return

    const productKey = product.id
    const category = product.category || 'Other'
    const quantityUsed = Math.abs(record.quantity_delta || 0)

    // Track product consumption
    if (!productConsumption.has(productKey)) {
      productConsumption.set(productKey, {
        product: product,
        total_consumed: 0,
        consumption_events: 0,
        unit: record.inventory_items?.unit || 'pieces',
        avg_consumption_per_week: 0
      })
    }

    const productStats = productConsumption.get(productKey)
    productStats.total_consumed += quantityUsed
    productStats.consumption_events += 1
    productStats.avg_consumption_per_week = (productStats.total_consumed / days) * 7

    // Track category trends
    if (!categoryTrends.has(category)) {
      categoryTrends.set(category, { total: 0, products: new Set() })
    }
    categoryTrends.get(category).total += quantityUsed
    categoryTrends.get(category).products.add(product.name)
  })

  return {
    consumption_rate: Object.fromEntries(productConsumption),
    category_trends: Object.fromEntries(categoryTrends),
    analysis_period_days: days,
    total_products_tracked: productConsumption.size
  }
}

async function generatePredictiveItems(supabase: any, userId: string, analysis: any) {
  const predictedItems = []

  // Get current inventory levels
  const { data: currentInventory, error } = await supabase
    .from('inventory_items')
    .select(`
      product_id,
      quantity,
      unit,
      purchase_date,
      expiration_date,
      products (id, name, brand, category, upc)
    `)
    .eq('household_id', userId)
    .eq('is_consumed', false)

  if (error) {
    console.error('Error getting current inventory:', error)
    return []
  }

  // Create inventory map
  const inventoryMap = new Map()
  currentInventory?.forEach(item => {
    if (item.products) {
      inventoryMap.set(item.products.id, {
        current_quantity: item.quantity,
        unit: item.unit,
        days_since_purchase: Math.floor((new Date().getTime() - new Date(item.purchase_date).getTime()) / (1000 * 60 * 60 * 24)),
        expiration_date: item.expiration_date
      })
    }
  })

  // Generate predictions based on consumption patterns
  Object.entries(analysis.consumption_rate).forEach(([productId, stats]: [string, any]) => {
    const currentStock = inventoryMap.get(productId)
    const weeklyConsumption = stats.avg_consumption_per_week

    if (weeklyConsumption > 0) {
      const currentQuantity = currentStock?.current_quantity || 0
      const daysUntilEmpty = currentQuantity / (weeklyConsumption / 7)

      // Predict if we'll need more within prediction period
      if (daysUntilEmpty <= 14) { // Will run out in 2 weeks
        const priority = daysUntilEmpty <= 3 ? 5 : daysUntilEmpty <= 7 ? 4 : 3

        predictedItems.push({
          product_id: productId,
          product_name: stats.product.name,
          brand: stats.product.brand,
          category: stats.product.category,
          predicted_quantity: Math.ceil(weeklyConsumption * 2), // 2 weeks supply
          unit: stats.unit,
          priority: priority,
          reason: `Predicted to run out in ${Math.ceil(daysUntilEmpty)} days`,
          confidence: Math.min(stats.consumption_events / 5 * 100, 100), // More events = higher confidence
          weekly_usage: weeklyConsumption,
          current_stock: currentQuantity,
          prediction_type: 'consumption_pattern'
        })
      }
    }
  })

  // Add items expiring soon
  currentInventory?.forEach(item => {
    if (item.expiration_date && item.products) {
      const daysUntilExpiry = Math.floor((new Date(item.expiration_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))

      if (daysUntilExpiry <= 7 && daysUntilExpiry > 0) {
        // Check if not already in predicted items
        const alreadyPredicted = predictedItems.some(pred => pred.product_id === item.products!.id)

        if (!alreadyPredicted) {
          predictedItems.push({
            product_id: item.products.id,
            product_name: item.products.name,
            brand: item.products.brand,
            category: item.products.category,
            predicted_quantity: 1,
            unit: item.unit,
            priority: 3,
            reason: `Current stock expires in ${daysUntilExpiry} days`,
            confidence: 90,
            current_stock: item.quantity,
            expiration_date: item.expiration_date,
            prediction_type: 'expiration_replacement'
          })
        }
      }
    }
  })

  // Sort by priority and confidence
  return predictedItems
    .sort((a, b) => b.priority - a.priority || b.confidence - a.confidence)
    .slice(0, 20) // Limit to top 20 predictions
}

// Enhanced version with AI analysis
async function generateAIPredictiveItems(userId: string, analysis: any, aiProvider: 'claude' | 'gemini') {
  const claudeApiKey = process.env.CLAUDE_API_KEY
  const geminiApiKey = process.env.GEMINI_API_KEY

  if (!claudeApiKey && !geminiApiKey) {
    return generatePredictiveItems(userId, analysis)
  }

  const analysisPrompt = `Analyze this household's consumption patterns and generate intelligent shopping list predictions:

  Consumption Analysis:
  ${JSON.stringify(analysis, null, 2)}

  Generate smart shopping predictions considering:
  1. Consumption velocity and trends
  2. Seasonal factors and typical household needs
  3. Category-based shopping patterns
  4. Expiration replacement timing
  5. Bulk buying opportunities

  Return JSON array of predictions:
  [
    {
      "product_name": "Milk",
      "category": "Dairy",
      "predicted_quantity": 2,
      "unit": "gallons",
      "priority": 4,
      "reason": "High consumption rate, current stock expires soon",
      "confidence": 85,
      "prediction_type": "ai_analysis",
      "shopping_tips": "Buy 2 gallons, check expiration dates"
    }
  ]

  Focus on realistic, actionable predictions based on actual consumption data.`

  try {
    if (aiProvider === 'claude' && claudeApiKey) {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': claudeApiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 2000,
          messages: [
            {
              role: 'user',
              content: analysisPrompt
            }
          ]
        })
      })

      if (response.ok) {
        const result = await response.json()
        const aiPredictions = JSON.parse(result.content[0].text)

        console.log('✅ AI-generated shopping predictions:', aiPredictions.length)
        return aiPredictions
      }
    }

    // Fallback to rule-based predictions
    return generatePredictiveItems(userId, analysis)

  } catch (error) {
    console.error('AI prediction error:', error)
    return generatePredictiveItems(userId, analysis)
  }
}