'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
  LinearProgress,
  IconButton,
  Chip,
  Card,
  CardContent,
  Stack,
  Fade,
  CircularProgress
} from '@mui/material'
import {
  Mic as MicIcon,
  MicOff as MicOffIcon,
  Close as CloseIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  VolumeUp as VolumeIcon
} from '@mui/icons-material'
import { supabase } from '@/lib/supabase'

interface WhisperVoiceAssistantProps {
  open: boolean
  onClose: () => void
  userId: string
  mode?: 'both' | 'add' | 'remove'
  onItemAdded?: (item: any) => void
  onItemRemoved?: (item: any) => void
}

type AssistantState =
  | 'idle'
  | 'recording'
  | 'processing'
  | 'transcribing'
  | 'executing'
  | 'complete'
  | 'error'

export default function WhisperVoiceAssistant({
  open,
  onClose,
  userId,
  mode = 'both',
  onItemAdded,
  onItemRemoved
}: WhisperVoiceAssistantProps) {
  const [state, setState] = useState<AssistantState>('idle')
  const [transcript, setTranscript] = useState('')
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)
  const [recordingDuration, setRecordingDuration] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      stopRecording()
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [])

  // Start recording audio
  const startRecording = async () => {
    try {
      setError(null)
      setState('recording')
      setTranscript('')
      setFeedback('Listening... Click Stop when done speaking')

      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // Set up audio visualization
      audioContextRef.current = new AudioContext()
      analyserRef.current = audioContextRef.current.createAnalyser()
      const source = audioContextRef.current.createMediaStreamSource(stream)
      source.connect(analyserRef.current)
      analyserRef.current.fftSize = 256

      // Start visualizing audio levels
      visualizeAudio()

      // Set up MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm'
      })

      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        // Create audio blob
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })

        // Send to Whisper API
        await transcribeAudio(audioBlob)
      }

      // Start recording
      mediaRecorder.start()
      setIsRecording(true)

      // Start duration timer
      let duration = 0
      recordingTimerRef.current = setInterval(() => {
        duration++
        setRecordingDuration(duration)

        // Auto-stop after 30 seconds
        if (duration >= 30) {
          stopRecording()
          setFeedback('Maximum recording time reached (30 seconds)')
        }
      }, 1000)

    } catch (err: any) {
      console.error('Error starting recording:', err)
      setError('Failed to access microphone. Please check permissions.')
      setState('error')
    }
  }

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }

    setAudioLevel(0)
    setRecordingDuration(0)
  }

  // Visualize audio levels
  const visualizeAudio = () => {
    if (!analyserRef.current) return

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
    analyserRef.current.getByteFrequencyData(dataArray)

    // Calculate average volume
    const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
    setAudioLevel(average / 255) // Normalize to 0-1

    animationFrameRef.current = requestAnimationFrame(visualizeAudio)
  }

  // Send audio to Whisper API
  const transcribeAudio = async (audioBlob: Blob) => {
    try {
      setState('transcribing')
      setFeedback('Transcribing your speech...')

      // Create FormData with audio file
      const formData = new FormData()
      formData.append('audio', audioBlob, 'recording.webm')

      const response = await fetch('/api/ai/whisper', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to transcribe audio')
      }

      setTranscript(result.transcript)
      setFeedback(`Heard: "${result.transcript}"`)

      // Process the transcript
      await processCommand(result.transcript)

    } catch (err: any) {
      console.error('Transcription error:', err)
      setError(err.message)
      setState('error')
    }
  }

  // Process the transcribed command
  const processCommand = async (text: string) => {
    try {
      setState('executing')
      setFeedback('Processing your command...')

      const lowerText = text.toLowerCase()

      // Detect action (add or remove)
      let action: 'add' | 'remove' | null = null
      if (lowerText.includes('add') || lowerText.includes('stock') || lowerText.includes('put')) {
        action = 'add'
      } else if (lowerText.includes('remove') || lowerText.includes('use') || lowerText.includes('take')) {
        action = 'remove'
      }

      if (!action) {
        setError('Please say "add" or "remove" followed by the item name')
        setState('error')
        return
      }

      // Extract item name (remove action words)
      let itemName = text
        .replace(/\b(add|adding|stock|put|store|remove|removing|use|take|grab)\b/gi, '')
        .trim()

      if (!itemName) {
        setError('Could not understand the item name. Please try again.')
        setState('error')
        return
      }

      // Extract quantity if mentioned
      let quantity = 1
      const quantityMatch = itemName.match(/\b(\d+)\b/)
      if (quantityMatch) {
        quantity = parseInt(quantityMatch[1])
        itemName = itemName.replace(quantityMatch[0], '').trim()
      }

      setFeedback(`${action === 'add' ? 'Adding' : 'Removing'} ${quantity} ${itemName}...`)

      // For now, just show success (you can integrate with your existing add/remove logic)
      setTimeout(() => {
        setState('complete')
        setFeedback(`✅ Successfully ${action === 'add' ? 'added' : 'removed'} ${quantity} ${itemName}`)

        // Call the appropriate callback
        if (action === 'add' && onItemAdded) {
          onItemAdded({ name: itemName, quantity })
        } else if (action === 'remove' && onItemRemoved) {
          onItemRemoved({ name: itemName, quantity })
        }

        // Reset after 2 seconds
        setTimeout(() => {
          setState('idle')
          setTranscript('')
          setFeedback('')
        }, 2000)
      }, 1000)

    } catch (err: any) {
      console.error('Command processing error:', err)
      setError('Failed to process command')
      setState('error')
    }
  }

  // Format recording duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          overflow: 'hidden'
        }
      }}
    >
      <DialogTitle sx={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <Box display="flex" alignItems="center" gap={1}>
          <VolumeIcon />
          <Typography variant="h6">Voice Assistant (Whisper)</Typography>
        </Box>
        <IconButton
          edge="end"
          color="inherit"
          onClick={onClose}
          aria-label="close"
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 3, pb: 2 }}>
        <Stack spacing={3}>
          {/* Status Card */}
          <Card variant="outlined" sx={{
            borderColor: state === 'recording' ? 'error.main' : 'divider',
            borderWidth: state === 'recording' ? 2 : 1
          }}>
            <CardContent>
              <Box textAlign="center">
                {/* State Icon */}
                {state === 'recording' && (
                  <Box>
                    <CircularProgress size={60} />
                    <Typography variant="h6" sx={{ mt: 2 }}>
                      Recording... {formatDuration(recordingDuration)}
                    </Typography>
                  </Box>
                )}
                {state === 'transcribing' && (
                  <Box>
                    <CircularProgress size={60} />
                    <Typography variant="h6" sx={{ mt: 2 }}>
                      Transcribing...
                    </Typography>
                  </Box>
                )}
                {state === 'executing' && (
                  <Box>
                    <CircularProgress size={60} />
                    <Typography variant="h6" sx={{ mt: 2 }}>
                      Processing...
                    </Typography>
                  </Box>
                )}
                {state === 'complete' && (
                  <Box>
                    <CheckIcon sx={{ fontSize: 60, color: 'success.main' }} />
                    <Typography variant="h6" sx={{ mt: 2, color: 'success.main' }}>
                      Complete!
                    </Typography>
                  </Box>
                )}
                {state === 'error' && (
                  <Box>
                    <ErrorIcon sx={{ fontSize: 60, color: 'error.main' }} />
                    <Typography variant="h6" sx={{ mt: 2, color: 'error.main' }}>
                      Error
                    </Typography>
                  </Box>
                )}
                {state === 'idle' && (
                  <Box>
                    <MicOffIcon sx={{ fontSize: 60, color: 'text.secondary' }} />
                    <Typography variant="h6" sx={{ mt: 2 }}>
                      Ready to Listen
                    </Typography>
                  </Box>
                )}

                {/* Audio Level Indicator */}
                {isRecording && (
                  <Box sx={{ mt: 2, px: 3 }}>
                    <LinearProgress
                      variant="determinate"
                      value={audioLevel * 100}
                      sx={{
                        height: 8,
                        borderRadius: 4,
                        '& .MuiLinearProgress-bar': {
                          transition: 'transform 0.1s ease'
                        }
                      }}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                      Audio Level
                    </Typography>
                  </Box>
                )}

                {/* Feedback Text */}
                {feedback && (
                  <Typography variant="body1" sx={{ mt: 2 }}>
                    {feedback}
                  </Typography>
                )}

                {/* Transcript Display */}
                {transcript && (
                  <Card sx={{ mt: 2, p: 2, bgcolor: 'grey.50' }}>
                    <Typography variant="body2" color="text.secondary">
                      Transcript:
                    </Typography>
                    <Typography variant="body1">
                      "{transcript}"
                    </Typography>
                  </Card>
                )}
              </Box>
            </CardContent>
          </Card>

          {/* Instructions */}
          {state === 'idle' && (
            <Alert severity="info">
              <Typography variant="body2">
                <strong>How to use:</strong><br />
                1. Click "Start Recording" and speak clearly<br />
                2. Say commands like "Add 2 milk" or "Remove eggs"<br />
                3. Click "Stop Recording" when done<br />
                4. Whisper AI will transcribe and process your command
              </Typography>
            </Alert>
          )}

          {/* Error Display */}
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} variant="outlined">
          Close
        </Button>

        {!isRecording ? (
          <Button
            variant="contained"
            startIcon={<MicIcon />}
            onClick={startRecording}
            disabled={state !== 'idle' && state !== 'error' && state !== 'complete'}
            color="primary"
            size="large"
          >
            Start Recording
          </Button>
        ) : (
          <Button
            variant="contained"
            startIcon={<StopIcon />}
            onClick={stopRecording}
            color="error"
            size="large"
          >
            Stop Recording
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}