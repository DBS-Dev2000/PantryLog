import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { url, user_id } = await request.json()

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      )
    }

    console.log('🍳 Recipe import request for URL:', url)

    // Detect source type
    const isYouTube = url.includes('youtube.com') || url.includes('youtu.be')
    const isRecipeSite = isKnownRecipeSite(url)

    let recipeData: any = {}

    if (isYouTube) {
      recipeData = await extractYouTubeRecipe(url)
    } else if (isRecipeSite) {
      recipeData = await extractWebsiteRecipe(url)
    } else {
      // Use AI to extract recipe from any webpage
      recipeData = await extractRecipeWithAI(url, user_id)
    }

    console.log('✅ Recipe extraction complete:', recipeData.title)
    return NextResponse.json(recipeData)

  } catch (error: any) {
    console.error('Recipe import error:', error)
    return NextResponse.json(
      { error: 'Failed to import recipe: ' + error.message },
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
        const recipeData = recipes.find(item => item['@type'] === 'Recipe')

        if (recipeData) {
          return formatStructuredRecipe(recipeData, url)
        }
      } catch (jsonError) {
        console.warn('Failed to parse JSON-LD:', jsonError)
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
    console.log('🤖 Using AI to extract recipe from:', url)

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
        const recipeInfo = JSON.parse(result.content[0].text)

        return {
          ...recipeInfo,
          source_type: 'website',
          source_url: url,
          website_domain: new URL(url).hostname
        }
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
  const getTime = (timeStr: string): number => {
    if (!timeStr) return 0
    const match = timeStr.match(/PT(\d+)M/) || timeStr.match(/(\d+)\s*min/)
    return match ? parseInt(match[1]) : 0
  }

  const formatIngredients = (ingredients: any[]) => {
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
      } else {
        return {
          ingredient_name: ing.name || ing.text || 'Unknown ingredient',
          quantity: parseFloat(ing.amount || ing.quantity || '1'),
          unit: ing.unit || 'pieces',
          preparation: ing.preparation || ''
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

  return {
    source_type: 'website',
    source_url: sourceUrl,
    website_domain: new URL(sourceUrl).hostname,
    title: structuredData.name || 'Imported Recipe',
    description: structuredData.description || '',
    prep_time_minutes: getTime(structuredData.prepTime),
    cook_time_minutes: getTime(structuredData.cookTime),
    total_time_minutes: getTime(structuredData.totalTime),
    servings: parseInt(structuredData.recipeYield) || 4,
    image_url: structuredData.image?.[0] || structuredData.image,
    cuisine: structuredData.recipeCuisine || 'unknown',
    ingredients: formatIngredients(structuredData.recipeIngredient || []),
    instructions: extractInstructionsText(structuredData.recipeInstructions || []),
    steps: formatInstructions(structuredData.recipeInstructions || []),
    calories_per_serving: structuredData.nutrition?.calories ? parseInt(structuredData.nutrition.calories) : undefined,
    protein_grams: structuredData.nutrition?.proteinContent ? parseFloat(structuredData.nutrition.proteinContent) : undefined,
    carbs_grams: structuredData.nutrition?.carbohydrateContent ? parseFloat(structuredData.nutrition.carbohydrateContent) : undefined,
    fat_grams: structuredData.nutrition?.fatContent ? parseFloat(structuredData.nutrition.fatContent) : undefined,
    tags: structuredData.keywords ? structuredData.keywords.split(',').map((k: string) => k.trim()) : []
  }
}