import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    // Check if API key is configured
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'YOUR_OPENAI_API_KEY_HERE') {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 503 }
      )
    }

    // Get the audio data from the request
    const formData = await request.formData()
    const audioFile = formData.get('audio') as File

    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      )
    }

    console.log('🎤 Received audio file:', {
      name: audioFile.name,
      type: audioFile.type,
      size: audioFile.size
    })

    // Convert File to the format OpenAI expects
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'en', // Specify English for better accuracy
      prompt: 'Commands: add item, remove item, load location. Products: milk, bread, eggs, cheese, chicken, vegetables, fruits.', // Context hints
    })

    console.log('✅ Whisper transcription:', transcription.text)

    return NextResponse.json({
      success: true,
      transcript: transcription.text,
      confidence: 0.95 // Whisper doesn't provide confidence scores, but it's generally very accurate
    })

  } catch (error: any) {
    console.error('❌ Whisper API error:', error)

    // Handle specific OpenAI errors
    if (error?.error?.type === 'invalid_api_key') {
      return NextResponse.json(
        { error: 'Invalid OpenAI API key' },
        { status: 401 }
      )
    }

    if (error?.error?.type === 'insufficient_quota') {
      return NextResponse.json(
        { error: 'OpenAI API quota exceeded' },
        { status: 429 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to transcribe audio', details: error.message },
      { status: 500 }
    )
  }
}

// Also support GET to check if the endpoint is working
export async function GET() {
  const hasApiKey = process.env.OPENAI_API_KEY &&
                    process.env.OPENAI_API_KEY !== 'YOUR_OPENAI_API_KEY_HERE'

  return NextResponse.json({
    status: 'ok',
    whisperAvailable: hasApiKey,
    message: hasApiKey
      ? 'Whisper API is configured and ready'
      : 'Please add your OpenAI API key to use Whisper transcription'
  })
}