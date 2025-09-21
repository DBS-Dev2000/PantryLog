import { NextRequest, NextResponse } from 'next/server'
import { aiEndpointLimiter, rateLimitResponse, rateLimitExceededResponse } from '@/lib/rate-limit'
import { RecipeImportSchema, validateRequest } from '@/lib/validation'

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting for AI-powered recipe import
    const rateLimitResult = aiEndpointLimiter.check(request)
    if (!rateLimitResult.success) {
      console.log('🚫 Rate limit exceeded for import-recipe endpoint')
      return rateLimitExceededResponse(rateLimitResult.resetTime)
    }

    const requestBody = await request.json()

    // Validate and sanitize input
    const validation = await validateRequest(RecipeImportSchema)(requestBody)
    if (!validation.success) {
      return NextResponse.json({
        error: 'Invalid input',
        details: validation.errors
      }, { status: 400 })
    }

    const { url, user_id } = validation.data

    console.log('🍳 Recipe import request for URL:', url)

    // Detect source type
    const isYouTube = url.includes('youtube.com') || url.includes('youtu.be')
    const isRecipeSite = isKnownRecipeSite(url)

    let recipeData: any = {}

    try {
      if (isYouTube) {
        console.log('📺 Extracting YouTube recipe...')
        recipeData = await extractYouTubeRecipe(url)
      } else if (isRecipeSite) {
        console.log('🌐 Extracting from known recipe site...')
        recipeData = await extractWebsiteRecipe(url)
      } else {
        console.log('🔍 Analyzing recipe from webpage...')
        recipeData = await extractRecipeWithAI(url, user_id)
      }
    } catch (extractionError) {
      console.error('❌ Recipe extraction failed:', extractionError)
      throw new Error(`Extraction failed: ${extractionError.message}`)
    }

    console.log('✅ Recipe extraction complete:', recipeData.title)

    const response = NextResponse.json(recipeData)

    // Add rate limit headers
    const rateLimitHeaders = rateLimitResponse(rateLimitResult.remaining, rateLimitResult.resetTime)
    rateLimitHeaders.forEach((value, key) => {
      response.headers.set(key, value)
    })

    return response

  } catch (error: any) {
    console.error('🚨 Recipe import server error:', error)
    console.error('📍 Error stack:', error.stack)

    return NextResponse.json(
      {
        error: 'Failed to import recipe: ' + error.message,
        debug: {
          error_type: error.constructor.name,
          error_message: error.message,
          url: url,
          has_claude_key: Boolean(process.env.CLAUDE_API_KEY),
          has_gemini_key: Boolean(process.env.GEMINI_API_KEY)
        }
      },
      { status: 500 }
    )
  }
}

function isKnownRecipeSite(url: string): boolean {
  const knownSites = [
    'allrecipes.com',
    'foodnetwork.com',
    'food.com',
    'epicurious.com',
    'seriouseats.com',
    'tasty.co',
    'delish.com',
    'bhg.com',
    'pillsbury.com',
    'kingarthurbaking.com'
  ]

  return knownSites.some(site => url.includes(site))
}

async function extractYouTubeRecipe(url: string) {
  // Extract video ID
  const videoIdMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/)
  const videoId = videoIdMatch?.[1]

  if (!videoId) {
    throw new Error('Invalid YouTube URL')
  }

  // In production, use YouTube Data API v3
  // For now, return structured data that can be filled in manually

  return {
    source_type: 'youtube',
    youtube_video_id: videoId,
    source_url: url,
    title: 'YouTube Recipe Video',
    description: 'Recipe imported from YouTube - please fill in details below',
    thumbnail_url: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    video_url: url,
    instructions: 'Watch the YouTube video for detailed cooking instructions.',
    prep_time_minutes: 30,
    cook_time_minutes: 60,
    servings: 4,
    ingredients: [
      {
        ingredient_name: 'Ingredient 1',
        quantity: 1,
        unit: 'cup',
        preparation: '',
        notes: 'Fill in ingredients from video'
      }
    ],
    steps: [
      {
        step_number: 1,
        instruction: 'Watch YouTube video and add detailed steps here',
        time_minutes: 30
      }
    ],
    tags: ['youtube', 'video-recipe'],
    cuisine: 'unknown'
  }
}

async function extractWebsiteRecipe(url: string) {
  try {
    // Fetch the webpage
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PantryIQ-Bot/1.0)'
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch recipe: ${response.status}`)
    }

    const html = await response.text()

    // Look for JSON-LD structured data (common on recipe sites)
    const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/is)

    if (jsonLdMatch) {
      try {
        const structuredData = JSON.parse(jsonLdMatch[1])

        // Handle arrays of structured data
        const recipes = Array.isArray(structuredData) ? structuredData : [structuredData]
        const recipeData = recipes.find(item =>
          item['@type'] === 'Recipe' ||
          (Array.isArray(item['@type']) && item['@type'].includes('Recipe'))
        )

        if (recipeData) {
          console.log('📊 Found structured recipe data for:', url)

          // Special handling for King Arthur Baking
          if (url.includes('kingarthurbaking.com')) {
            console.log('👑 Processing King Arthur Baking recipe format')
            // Their site might have nested structure
            if (recipeData['@graph']) {
              const graphRecipe = recipeData['@graph'].find((item: any) =>
                item['@type'] === 'Recipe' ||
                (Array.isArray(item['@type']) && item['@type'].includes('Recipe'))
              )
              if (graphRecipe) {
                return formatStructuredRecipe(graphRecipe, url)
              }
            }
          }

          return formatStructuredRecipe(recipeData, url)
        }
      } catch (jsonError) {
        console.warn('Failed to parse JSON-LD:', jsonError)
        console.warn('JSON-LD content:', jsonLdMatch[1]?.substring(0, 500))
      }
    }

    // Fallback: Basic extraction with AI assistance
    return await extractRecipeWithAI(url, null)

  } catch (error) {
    console.error('Website recipe extraction error:', error)
    throw error
  }
}

async function extractRecipeWithAI(url: string, userId?: string) {
  try {
    console.log('📝 Extracting recipe from:', url)

    // Fetch webpage content
    const response = await fetch(url)
    const html = await response.text()

    // Clean HTML and extract text content with better instruction preservation
    const textContent = html
      .replace(/<script[^>]*>.*?<\/script>/gis, '')
      .replace(/<style[^>]*>.*?<\/style>/gis, '')
      .replace(/<nav[^>]*>.*?<\/nav>/gis, '') // Remove navigation
      .replace(/<header[^>]*>.*?<\/header>/gis, '') // Remove headers
      .replace(/<footer[^>]*>.*?<\/footer>/gis, '') // Remove footers
      .replace(/<aside[^>]*>.*?<\/aside>/gis, '') // Remove sidebars
      .replace(/<\/(div|p|li|h[1-6])>/gi, '\n') // Preserve line breaks for important elements
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 15000) // Increased limit for better instruction extraction

    // Use Claude API to extract recipe information
    const claudeApiKey = process.env.CLAUDE_API_KEY

    if (claudeApiKey) {
      const aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': claudeApiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 3000, // Increased for better instruction extraction
          messages: [
            {
              role: 'user',
              content: `Extract recipe information from this webpage content and return a JSON object. Pay special attention to cooking instructions and steps.

Website URL: ${url}
Content: ${textContent}

Return JSON format:
{
  "title": "Recipe title",
  "description": "Brief description",
  "prep_time_minutes": 30,
  "cook_time_minutes": 60,
  "servings": 4,
  "difficulty": "easy|medium|hard",
  "cuisine": "cuisine type",
  "tags": ["tag1", "tag2"],
  "ingredients": [
    {
      "ingredient_name": "Ingredient name",
      "quantity": 1.5,
      "unit": "cups",
      "preparation": "diced, chopped, etc"
    }
  ],
  "instructions": "Complete cooking instructions as a single text block with all steps",
  "steps": [
    {
      "step_number": 1,
      "instruction": "Detailed step-by-step instruction - be very specific about what to do",
      "time_minutes": 10
    },
    {
      "step_number": 2,
      "instruction": "Next detailed step with specific actions and techniques",
      "time_minutes": 15
    }
  ],
  "calories_per_serving": 350,
  "nutrition": {
    "protein_grams": 20,
    "carbs_grams": 45,
    "fat_grams": 15
  }
}

IMPORTANT:
- Extract ALL cooking steps and instructions in detail
- Include both "instructions" (complete text) and "steps" (numbered array)
- Look for cooking directions, preparation steps, baking instructions
- Include specific temperatures, times, and techniques
- Be thorough with step-by-step cooking process
- If nutrition info not available, omit those fields`
            }
          ]
        })
      })

      if (aiResponse.ok) {
        const result = await aiResponse.json()
        console.log('✨ Recipe data extracted:', result)

        try {
          const recipeInfo = JSON.parse(result.content[0].text)
          console.log('✅ Parsed recipe info:', recipeInfo.title)

          return {
            ...recipeInfo,
            source_type: 'website',
            source_url: url,
            website_domain: new URL(url).hostname
          }
        } catch (parseError) {
          console.error('❌ Failed to parse Claude AI response:', parseError)
          console.log('📝 Raw Claude text:', result.content[0].text)
          throw new Error('AI response parsing failed')
        }
      } else {
        console.error('❌ Claude API request failed:', aiResponse.status, aiResponse.statusText)
        throw new Error(`Claude API error: ${aiResponse.status}`)
      }
    }

    // Fallback if AI not available
    return {
      source_type: 'website',
      source_url: url,
      website_domain: new URL(url).hostname,
      title: 'Imported Recipe',
      description: 'Recipe imported from website - please fill in details',
      instructions: 'Add cooking instructions here',
      prep_time_minutes: 30,
      cook_time_minutes: 60,
      servings: 4,
      ingredients: [
        {
          ingredient_name: 'Add ingredients from website',
          quantity: 1,
          unit: 'cup',
          preparation: ''
        }
      ],
      steps: [
        {
          step_number: 1,
          instruction: 'Add cooking steps from the website',
          time_minutes: 30
        }
      ]
    }

  } catch (error) {
    console.error('AI recipe extraction error:', error)
    throw error
  }
}

function formatStructuredRecipe(structuredData: any, sourceUrl: string) {
  try {
    console.log('🔧 Formatting structured recipe data')

    const getTime = (timeStr: string): number => {
      if (!timeStr) return 0
      // Handle ISO 8601 duration format (PT30M) and other formats
      const isoMatch = timeStr.match(/PT(?:(\d+)H)?(?:(\d+)M)?/)
      if (isoMatch) {
        const hours = parseInt(isoMatch[1] || '0')
        const minutes = parseInt(isoMatch[2] || '0')
        return hours * 60 + minutes
      }
      const minMatch = timeStr.match(/(\d+)\s*min/)
      return minMatch ? parseInt(minMatch[1]) : 0
    }

    const formatIngredients = (ingredients: any[]) => {
      if (!ingredients || !Array.isArray(ingredients)) {
        console.warn('⚠️ No ingredients array found')
        return []
      }

      return ingredients.map((ing, index) => {
        if (typeof ing === 'string') {
          // Parse ingredient string like "2 cups flour"
          const parts = ing.match(/^(\d+(?:\.\d+)?|\d+\/\d+)?\s*(\w+)?\s*(.+)$/)
          return {
            ingredient_name: ing,
            quantity: parts?.[1] ? parseFloat(parts[1]) : 1,
            unit: parts?.[2] || 'pieces',
            preparation: ''
          }
        } else if (ing && typeof ing === 'object') {
          return {
            ingredient_name: ing.name || ing.text || ing.ingredient || 'Unknown ingredient',
            quantity: parseFloat(ing.amount || ing.quantity || '1'),
            unit: ing.unit || ing.unitText || 'pieces',
            preparation: ing.preparation || ''
          }
        } else {
          return {
            ingredient_name: String(ing),
            quantity: 1,
            unit: 'pieces',
            preparation: ''
          }
        }
      })
    }

  const extractInstructionsText = (instructions: any): string => {
    if (Array.isArray(instructions)) {
      return instructions.map((inst, index) => {
        let instruction = ''
        if (typeof inst === 'string') {
          instruction = inst
        } else if (inst.text) {
          instruction = inst.text
        } else if (inst.name) {
          instruction = inst.name
        } else if (inst.instruction) {
          instruction = inst.instruction
        }
        return `${index + 1}. ${instruction.trim()}`
      }).join('\n\n')
    } else if (typeof instructions === 'string') {
      return instructions
    }
    return ''
  }

  const formatInstructions = (instructions: any) => {
    if (Array.isArray(instructions)) {
      return instructions.map((inst, index) => {
        let instruction = ''

        if (typeof inst === 'string') {
          instruction = inst
        } else if (inst.text) {
          instruction = inst.text
        } else if (inst.name) {
          instruction = inst.name
        } else if (inst.instruction) {
          instruction = inst.instruction
        } else {
          instruction = 'Step instruction'
        }

        return {
          step_number: index + 1,
          instruction: instruction.trim(),
          time_minutes: 0
        }
      })
    } else if (typeof instructions === 'string') {
      // Better parsing for instruction strings
      const steps = instructions
        .split(/(?:\d+\.|\n|Step \d+[:.]?)/)
        .map(step => step.trim())
        .filter(step => step.length > 15) // Filter out very short fragments

      return steps.map((step, index) => ({
        step_number: index + 1,
        instruction: step.replace(/^[^\w]*/, '').trim(), // Remove leading punctuation
        time_minutes: 0
      }))
    }
    return []
  }

    // Handle different image formats
    let imageUrl = null
    if (structuredData.image) {
      if (typeof structuredData.image === 'string') {
        imageUrl = structuredData.image
      } else if (Array.isArray(structuredData.image)) {
        imageUrl = structuredData.image[0]?.url || structuredData.image[0]
      } else if (structuredData.image.url) {
        imageUrl = structuredData.image.url
      }
    }

    return {
      source_type: 'website',
      source_url: sourceUrl,
      website_domain: new URL(sourceUrl).hostname,
      title: structuredData.name || 'Imported Recipe',
      description: structuredData.description || '',
      prep_time_minutes: getTime(structuredData.prepTime),
      cook_time_minutes: getTime(structuredData.cookTime),
      total_time_minutes: getTime(structuredData.totalTime),
      servings: parseInt(structuredData.recipeYield) || parseInt(structuredData.yield) || 4,
      image_url: imageUrl,
      cuisine: structuredData.recipeCuisine || 'unknown',
      ingredients: formatIngredients(structuredData.recipeIngredient || structuredData.ingredients || []),
      instructions: extractInstructionsText(structuredData.recipeInstructions || []),
      steps: formatInstructions(structuredData.recipeInstructions || []),
      calories_per_serving: structuredData.nutrition?.calories ? parseInt(structuredData.nutrition.calories) : undefined,
      protein_grams: structuredData.nutrition?.proteinContent ? parseFloat(structuredData.nutrition.proteinContent) : undefined,
      carbs_grams: structuredData.nutrition?.carbohydrateContent ? parseFloat(structuredData.nutrition.carbohydrateContent) : undefined,
      fat_grams: structuredData.nutrition?.fatContent ? parseFloat(structuredData.nutrition.fatContent) : undefined,
      tags: structuredData.keywords ? structuredData.keywords.split(',').map((k: string) => k.trim()) : []
    }
  } catch (error) {
    console.error('🚨 Error formatting structured recipe:', error)
    console.error('Structured data keys:', Object.keys(structuredData || {}))
    throw new Error(`Failed to format recipe: ${error.message}`)
  }
}