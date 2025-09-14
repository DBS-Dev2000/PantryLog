import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { user_id, identified_item, feedback, image_data, timestamp } = await request.json()

    console.log('📝 AI feedback received:', feedback, 'for', identified_item?.name)

    // Log feedback to database for AI improvement
    // This data can be used to improve AI models and create training datasets

    const { error } = await supabase
      .from('ai_feedback_log')
      .insert([{
        user_id: user_id,
        api_provider: 'visual_recognition',
        identified_result: identified_item,
        user_feedback: feedback,
        correction_timestamp: timestamp,
        image_hash: image_data ? btoa(image_data.substring(0, 100)) : null, // Hash for privacy
        model_confidence: identified_item?.confidence || 0
      }])

    // Don't fail if feedback logging fails - it's not critical
    if (error && error.code !== 'PGRST116') {
      console.warn('Failed to log AI feedback:', error)
    }

    // In the future, this could:
    // 1. Train custom models based on corrections
    // 2. Adjust confidence thresholds
    // 3. Build user-specific recognition patterns
    // 4. Improve AI prompts based on common mistakes

    return NextResponse.json({
      success: true,
      message: 'Feedback logged for AI improvement'
    })

  } catch (error) {
    console.error('AI feedback error:', error)
    return NextResponse.json(
      { error: 'Failed to log feedback' },
      { status: 500 }
    )
  }
}