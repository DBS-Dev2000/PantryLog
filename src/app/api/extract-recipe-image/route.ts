import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  let userId: string | null = null

  try {
    const { image, prompt, user_id } = await request.json()

    if (!image || !prompt) {
      return NextResponse.json(
        { error: 'Image and prompt are required' },
        { status: 400 }
      )
    }

    userId = user_id
    console.log('📸 Recipe image extraction request for user:', userId)

    // Check if user can make AI request (within limits)
    if (userId) {
      const { data: canUse, error: limitError } = await supabase
        .rpc('can_user_make_ai_request', { p_user_id: userId })

      if (limitError) {
        console.error('Error checking user limits:', limitError)
      } else if (!canUse) {
        return NextResponse.json(
          {
            error: 'AI usage limit reached. Please upgrade your plan or wait for reset.',
            limit_reached: true
          },
          { status: 429 }
        )
      }
    }

    // Try AI providers in order: Claude -> Gemini -> Mock
    const aiProviders = [
      { name: 'claude', apiKey: process.env.CLAUDE_API_KEY },
      { name: 'gemini', apiKey: process.env.GEMINI_API_KEY }
    ]

    for (const provider of aiProviders) {
      if (!provider.apiKey) continue

      try {
        let result: any
        let modelName: string

        if (provider.name === 'claude') {
          console.log('📷 Processing recipe image...')
          const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': provider.apiKey,
              'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
              model: 'claude-3-5-sonnet-20241022',
              max_tokens: 3000,
              messages: [
                {
                  role: 'user',
                  content: [
                    {
                      type: 'image',
                      source: {
                        type: 'base64',
                        media_type: 'image/jpeg',
                        data: image.split(',')[1]
                      }
                    },
                    {
                      type: 'text',
                      text: prompt
                    }
                  ]
                }
              ]
            })
          })

          if (!response.ok) throw new Error(`Claude API error: ${response.status}`)

          result = await response.json()
          modelName = 'claude-3-5-sonnet-20241022'
          result.analysisResult = JSON.parse(result.content[0].text)

        } else if (provider.name === 'gemini') {
          console.log('📷 Processing recipe image...')
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${provider.apiKey}`, {
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
                    },
                    {
                      inline_data: {
                        mime_type: 'image/jpeg',
                        data: image.split(',')[1]
                      }
                    }
                  ]
                }
              ],
              generationConfig: {
                maxOutputTokens: 3000,
                temperature: 0.1
              }
            })
          })

          if (!response.ok) throw new Error(`Gemini API error: ${response.status}`)

          result = await response.json()
          modelName = 'gemini-1.5-flash'

          const geminiText = result.candidates?.[0]?.content?.parts?.[0]?.text
          if (geminiText) {
            result.analysisResult = JSON.parse(geminiText)
            result.usage = {
              input_tokens: result.usageMetadata?.promptTokenCount || 200,
              output_tokens: result.usageMetadata?.candidatesTokenCount || 150
            }
          } else {
            throw new Error('Invalid Gemini response format')
          }
        }

        // Log successful usage
        if (userId && result.usage) {
          const processingTime = Date.now() - startTime
          await supabase.rpc('log_ai_usage', {
            p_user_id: userId,
            p_household_id: userId,
            p_api_provider: provider.name,
            p_model_name: modelName,
            p_api_endpoint: '/api/extract-recipe-image',
            p_input_tokens: result.usage.input_tokens || 0,
            p_output_tokens: result.usage.output_tokens || 0,
            p_image_count: 1,
            p_total_cost: 0, // Calculated in function
            p_request_type: 'recipe_extraction',
            p_success: true,
            p_error_message: null,
            p_processing_time_ms: processingTime
          })

          console.log(`✅ ${provider.name.toUpperCase()} recipe extraction logged:`, result.usage.input_tokens, 'input +', result.usage.output_tokens, 'output tokens')
        }

        console.log(`✅ ${provider.name.toUpperCase()} Recipe Extraction Complete`)
        return NextResponse.json(result.analysisResult)

      } catch (providerError) {
        console.error(`❌ ${provider.name.toUpperCase()} recipe extraction error:`, providerError)

        // Log failed attempt
        if (userId) {
          await supabase.rpc('log_ai_usage', {
            p_user_id: userId,
            p_household_id: userId,
            p_api_provider: provider.name,
            p_model_name: modelName || `${provider.name}-model`,
            p_api_endpoint: '/api/extract-recipe-image',
            p_input_tokens: 0,
            p_output_tokens: 0,
            p_image_count: 1,
            p_total_cost: 0,
            p_request_type: 'recipe_extraction',
            p_success: false,
            p_error_message: providerError.message,
            p_processing_time_ms: Date.now() - startTime
          })
        }

        continue
      }
    }

    // Mock response if no AI providers available
    console.log('📝 Using mock recipe extraction (add AI API keys for real extraction)')

    if (userId) {
      const processingTime = Date.now() - startTime
      await supabase.rpc('log_ai_usage', {
        p_user_id: userId,
        p_household_id: userId,
        p_api_provider: 'mock',
        p_model_name: 'mock-recipe-extractor',
        p_api_endpoint: '/api/extract-recipe-image',
        p_input_tokens: 100,
        p_output_tokens: 200,
        p_image_count: 1,
        p_total_cost: 0.001,
        p_request_type: 'recipe_extraction',
        p_success: true,
        p_error_message: null,
        p_processing_time_ms: processingTime
      })
    }

    await new Promise(resolve => setTimeout(resolve, 3000))

    const mockResponse = {
      title: "Recipe from Image",
      description: "Recipe extracted from photo - please review and edit as needed",
      ingredients: [
        {
          ingredient_name: "Check image and add ingredients",
          quantity: 1,
          unit: "cup",
          preparation: ""
        }
      ],
      instructions: "Review the image and add the cooking instructions here",
      steps: [
        {
          step_number: 1,
          instruction: "Add cooking steps from the recipe image",
          time_minutes: 0
        }
      ],
      prep_time_minutes: 30,
      cook_time_minutes: 60,
      servings: 4,
      difficulty: 'medium',
      notes: 'Mock extraction - add AI API keys for real recipe extraction from images',
      source_notes: 'Recipe photo (mock extraction)'
    }

    console.log('✅ Mock Recipe Extraction Complete')
    return NextResponse.json(mockResponse)

  } catch (error: any) {
    console.error('Recipe image extraction error:', error)
    return NextResponse.json(
      { error: 'Failed to extract recipe from image: ' + error.message },
      { status: 500 }
    )
  }
}