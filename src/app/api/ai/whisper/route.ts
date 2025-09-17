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

    // Convert the audio file to a format OpenAI accepts
    // OpenAI Whisper accepts: mp3, mp4, mpeg, mpga, m4a, wav, or webm
    let fileToSend: File = audioFile

    // If the file doesn't have a proper extension, rename it
    if (!audioFile.name.includes('.')) {
      const buffer = await audioFile.arrayBuffer()
      const blob = new Blob([buffer], { type: audioFile.type || 'audio/webm' })
      fileToSend = new File([blob], 'recording.webm', { type: 'audio/webm' })
    }

    console.log('🎵 Sending to Whisper:', {
      name: fileToSend.name,
      type: fileToSend.type,
      size: fileToSend.size
    })

    // Convert File to the format OpenAI expects
    const transcription = await openai.audio.transcriptions.create({
      file: fileToSend,
      model: 'whisper-1',
      language: 'en', // Specify English for better accuracy
      prompt: 'The user is giving voice commands to add or remove items from their pantry inventory. Common commands include: add milk, remove eggs, stock bread.', // Better context
    })

    console.log('✅ Whisper transcription:', transcription.text)

    return NextResponse.json({
      success: true,
      transcript: transcription.text,
      confidence: 0.95 // Whisper doesn't provide confidence scores, but it's generally very accurate
    })

  } catch (error: any) {
    console.error('❌ Whisper API error:', error)
    console.error('Error details:', {
      message: error?.message,
      type: error?.error?.type,
      code: error?.error?.code,
      statusCode: error?.status,
      response: error?.response?.data
    })

    // Handle specific OpenAI errors
    if (error?.error?.type === 'invalid_api_key' || error?.status === 401) {
      return NextResponse.json(
        { error: 'Invalid OpenAI API key. Please check your API key in .env.local' },
        { status: 401 }
      )
    }

    if (error?.error?.type === 'insufficient_quota' || error?.status === 429) {
      return NextResponse.json(
        { error: 'OpenAI API quota exceeded. Please check your OpenAI account.' },
        { status: 429 }
      )
    }

    if (error?.message?.includes('format')) {
      return NextResponse.json(
        { error: 'Audio format not supported. Please try recording again.' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        error: 'Failed to transcribe audio',
        details: error?.message || 'Unknown error occurred',
        hint: 'Check the console for more details'
      },
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