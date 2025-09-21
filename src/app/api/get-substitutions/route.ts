import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { ingredient, category, recipe_context, user_id, pantry_items } = await request.json()

    if (!ingredient) {
      return NextResponse.json(
        { error: 'Ingredient is required' },
        { status: 400 }
      )
    }

    console.log('🤖 AI substitution request for:', ingredient)
    console.log('🏠 Pantry items available:', pantry_items?.length || 0)

    // Try AI providers for smart substitutions
    const claudeApiKey = process.env.CLAUDE_API_KEY
    const geminiApiKey = process.env.GEMINI_API_KEY

    if (claudeApiKey || geminiApiKey) {
      try {
        let result: any

        const pantryList = pantry_items?.map((item: any) => `${item.name} (${item.quantity} ${item.unit})`).join(', ') || 'none'

        const prompt = `Provide smart cooking substitutions for the ingredient "${ingredient}" in the context of ${recipe_context || 'general cooking'}.

        IMPORTANT: First check if any of these items from the user's pantry could work as substitutions:
        ${pantryList}

        Consider:
        - Ingredient category: ${category || 'unknown'}
        - Cooking method and recipe type
        - Nutritional equivalency
        - Flavor profile compatibility
        - Measurement conversions if needed
        - PRIORITIZE items from the user's pantry when suitable

        Return a JSON array of substitutions:
        [
          {
            "substitute": "ground turkey",
            "reason": "Leaner protein, similar cooking method",
            "ratio": "1:1",
            "notes": "Will be less fatty, may need extra seasoning",
            "category": "protein",
            "quality": "excellent",
            "from_pantry": true  // Add this field if the item is from the user's pantry
          },
          {
            "substitute": "ground chicken",
            "reason": "Similar lean protein profile",
            "ratio": "1:1",
            "notes": "Mild flavor, cooks similarly",
            "category": "protein",
            "quality": "good",
            "from_pantry": false
          }
        ]

        Focus on practical substitutions that:
        1. Are commonly available in grocery stores
        2. Have similar cooking properties
        3. Won't drastically change the recipe outcome
        4. Include helpful cooking tips

        Provide 3-5 realistic substitutions ordered by quality (excellent, good, fair).`

        if (claudeApiKey) {
          const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': claudeApiKey,
              'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
              model: 'claude-3-5-sonnet-20241022',
              max_tokens: 1500,
              messages: [
                {
                  role: 'user',
                  content: prompt
                }
              ]
            })
          })

          if (response.ok) {
            result = await response.json()
            const substitutions = JSON.parse(result.content[0].text)

            console.log('✅ Claude AI substitutions generated for:', ingredient)
            return NextResponse.json({ substitutions })
          }
        }

        if (geminiApiKey) {
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: prompt
                    }
                  ]
                }
              ],
              generationConfig: {
                maxOutputTokens: 1500,
                temperature: 0.1
              }
            })
          })

          if (response.ok) {
            result = await response.json()
            const geminiText = result.candidates?.[0]?.content?.parts?.[0]?.text

            if (geminiText) {
              const substitutions = JSON.parse(geminiText)
              console.log('✅ Gemini AI substitutions generated for:', ingredient)
              return NextResponse.json({ substitutions })
            }
          }
        }

        throw new Error('AI substitution generation failed')

      } catch (aiError) {
        console.error('AI substitution error:', aiError)
        // Fall through to manual substitutions
      }
    }

    // Manual/hardcoded substitutions as fallback
    const manualSubstitutions = getManualSubstitutions(ingredient, category)

    console.log('📝 Using manual substitutions for:', ingredient)
    return NextResponse.json({ substitutions: manualSubstitutions })

  } catch (error: any) {
    console.error('Substitution API error:', error)
    return NextResponse.json(
      { error: 'Failed to get substitutions: ' + error.message },
      { status: 500 }
    )
  }
}

function getManualSubstitutions(ingredient: string, category?: string) {
  const lower = ingredient.toLowerCase()

  // Protein substitutions
  if (lower.includes('ground beef') || lower.includes('beef')) {
    return [
      {
        substitute: "ground turkey",
        reason: "Leaner protein with similar cooking properties",
        ratio: "1:1",
        notes: "Less fat, may need extra seasoning",
        category: "protein",
        quality: "excellent"
      },
      {
        substitute: "ground chicken",
        reason: "Mild lean protein",
        ratio: "1:1",
        notes: "Very mild flavor, add extra spices",
        category: "protein",
        quality: "good"
      },
      {
        substitute: "plant-based ground",
        reason: "Vegetarian alternative",
        ratio: "1:1",
        notes: "Pre-seasoned, adjust other seasonings",
        category: "protein",
        quality: "fair"
      }
    ]
  }

  // Salt substitutions
  if (lower.includes('salt')) {
    return [
      {
        substitute: "sea salt",
        reason: "Natural salt with minerals",
        ratio: "1:1",
        notes: "Perfect substitute",
        category: "seasoning",
        quality: "excellent"
      },
      {
        substitute: "kosher salt",
        reason: "Pure salt with larger crystals",
        ratio: "1.5:1",
        notes: "Use slightly more due to crystal size",
        category: "seasoning",
        quality: "excellent"
      }
    ]
  }

  // Sugar substitutions
  if (lower.includes('sugar')) {
    return [
      {
        substitute: "brown sugar",
        reason: "Adds molasses flavor",
        ratio: "1:1",
        notes: "Will add slight caramel notes",
        category: "sweetener",
        quality: "good"
      },
      {
        substitute: "honey",
        reason: "Natural liquid sweetener",
        ratio: "0.75:1",
        notes: "Use 3/4 amount, reduce other liquids slightly",
        category: "sweetener",
        quality: "good"
      }
    ]
  }

  // Default response
  return [
    {
      substitute: "Check pantry for similar items",
      reason: "Look for related ingredients",
      ratio: "varies",
      notes: "Substitutions depend on specific recipe context",
      category: "general",
      quality: "fair"
    }
  ]
}