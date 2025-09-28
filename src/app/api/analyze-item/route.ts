import { NextRequest, NextResponse } from 'next/server'
import { withAuth, logAIUsage, AuthContext } from '@/utils/auth-middleware'

export async function POST(request: NextRequest) {
  return withAuth(request, handleAnalyzeItem, {
    requireAI: true,
    logAccess: true
  })
}

async function handleAnalyzeItem(authContext: AuthContext, req: NextRequest): Promise<NextResponse> {
  const startTime = Date.now()

  try {
    const { image, prompt } = await req.json()

    if (!image || !prompt) {
      return NextResponse.json(
        { error: 'Image and prompt are required' },
        { status: 400 }
      )
    }

    const userId = authContext.user.id
    console.log('🤖 AI Image Analysis Request Received for user:', userId)

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
          console.log('🤖 Trying Claude API...')
          const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': provider.apiKey,
              'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
              model: 'claude-3-5-sonnet-20241022',
              max_tokens: 1000,
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
          console.log('🤖 Trying Gemini API...')
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
                maxOutputTokens: 1000,
                temperature: 0.1
              }
            })
          })

          if (!response.ok) throw new Error(`Gemini API error: ${response.status}`)

          result = await response.json()
          modelName = 'gemini-1.5-flash'

          // Parse Gemini response format
          const geminiText = result.candidates?.[0]?.content?.parts?.[0]?.text
          if (geminiText) {
            result.analysisResult = JSON.parse(geminiText)
            result.usage = {
              input_tokens: result.usageMetadata?.promptTokenCount || 100,
              output_tokens: result.usageMetadata?.candidatesTokenCount || 50
            }
          } else {
            throw new Error('Invalid Gemini response format')
          }
        }

        // Log successful usage using middleware helper
        if (result.usage) {
          await logAIUsage(authContext, {
            apiProvider: provider.name,
            modelName: modelName,
            apiEndpoint: '/api/analyze-item',
            inputTokens: result.usage.input_tokens || 0,
            outputTokens: result.usage.output_tokens || 0,
            imageCount: 1,
            requestType: 'item_recognition',
            success: true,
            processingTimeMs: Date.now() - startTime
          })
        }

        console.log(`✅ ${provider.name.toUpperCase()} AI Analysis Complete`)
        return NextResponse.json(result.analysisResult)

      } catch (providerError) {
        console.error(`❌ ${provider.name.toUpperCase()} API error:`, providerError)

        // Log failed attempt using middleware helper
        await logAIUsage(authContext, {
          apiProvider: provider.name,
          modelName: modelName || `${provider.name}-model`,
          apiEndpoint: '/api/analyze-item',
          inputTokens: 0,
          outputTokens: 0,
          imageCount: 1,
          requestType: 'item_recognition',
          success: false,
          errorMessage: providerError.message,
          processingTimeMs: Date.now() - startTime
        })

        // Continue to next provider
        continue
      }
    }

    // Mock response for testing or when API key not configured
    console.log('📝 Using mock AI response (add CLAUDE_API_KEY to use real AI)')
    console.log('🖼️ Image data length:', image.length, 'characters')
    console.log('📝 Prompt length:', prompt.length, 'characters')

    // Log usage even for mock (for testing billing system)
    try {
      await logAIUsage(authContext, {
        apiProvider: 'claude',
        modelName: 'claude-3-5-sonnet-mock',
        apiEndpoint: '/api/analyze-item',
        inputTokens: 100, // Mock token counts
        outputTokens: 50,
        imageCount: 1,
        requestType: 'item_recognition',
        success: true,
        processingTimeMs: Date.now() - startTime
      })
      console.log('✅ Mock usage logged for testing')
    } catch (logError) {
      console.warn('❌ Failed to log mock usage:', logError)
    }

    // Simulate AI processing delay
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Enhanced mock response based on common grocery items
    const mockItems = [
      {
        name: "Apple",
        confidence: 0.92,
        category: "Fresh Produce",
        brand: "",
        description: "Fresh apple - red or green variety",
        possible_barcodes: []
      },
      {
        name: "Bananas",
        confidence: 0.88,
        category: "Fresh Produce",
        brand: "",
        description: "Fresh bananas",
        possible_barcodes: []
      },
      {
        name: "Milk",
        confidence: 0.85,
        category: "Dairy",
        brand: "Generic",
        description: "Milk container or carton",
        possible_barcodes: []
      }
    ]

    // Random selection for mock
    const selectedMockItem = mockItems[Math.floor(Math.random() * mockItems.length)]

    const mockResponse = {
      items: [
        {
          ...selectedMockItem,
          description: selectedMockItem.description + " (Mock AI - add CLAUDE_API_KEY for real recognition)"
        }
      ],
      debug: {
        api_key_configured: false,
        image_size: image.length,
        processing_time_ms: Date.now() - startTime,
        user_id: userId
      }
    }

    console.log('✅ Mock Analysis Complete - Identified:', selectedMockItem.name)
    return NextResponse.json(mockResponse)


  } catch (error) {
    console.error('AI analysis error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze image' },
      { status: 500 }
    )
  }
}