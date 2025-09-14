import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { image, prompt } = await request.json()

    if (!image || !prompt) {
      return NextResponse.json(
        { error: 'Image and prompt are required' },
        { status: 400 }
      )
    }

    console.log('🤖 AI Image Analysis Request Received')

    // Check if Claude API key is configured
    const claudeApiKey = process.env.CLAUDE_API_KEY

    if (claudeApiKey) {
      // Use actual Claude API
      try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': claudeApiKey,
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
                      data: image.split(',')[1] // Remove data:image/jpeg;base64, prefix
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

        if (!response.ok) {
          throw new Error(`Claude API error: ${response.status}`)
        }

        const result = await response.json()
        const analysisResult = JSON.parse(result.content[0].text)

        console.log('✅ Claude AI Analysis Complete')
        return NextResponse.json(analysisResult)

      } catch (claudeError) {
        console.error('❌ Claude API error, falling back to mock:', claudeError)
        // Fall through to mock response if Claude API fails
      }
    }

    // Mock response for testing or when API key not configured
    console.log('📝 Using mock AI response (add CLAUDE_API_KEY to use real AI)')

    // Simulate AI processing delay
    await new Promise(resolve => setTimeout(resolve, 2000))

    const mockResponse = {
      items: [
        {
          name: "Grocery Item",
          confidence: 0.85,
          category: "Food",
          brand: "Unknown",
          description: "AI analysis coming soon - add CLAUDE_API_KEY to enable",
          possible_barcodes: []
        }
      ]
    }

    console.log('✅ Mock Analysis Complete')
    return NextResponse.json(mockResponse)


  } catch (error) {
    console.error('AI analysis error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze image' },
      { status: 500 }
    )
  }
}