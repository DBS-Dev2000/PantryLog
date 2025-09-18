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

      // Set up MediaRecorder with better settings
      let mimeType = 'audio/webm'

      // Try different mime types based on browser support
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus'
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = 'audio/webm'
      } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
        mimeType = 'audio/ogg;codecs=opus'
      }

      console.log('🎙️ Using mime type:', mimeType)

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType,
        audioBitsPerSecond: 128000 // Higher quality audio
      })

      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
          console.log('📊 Audio chunk received:', event.data.size, 'bytes')
        }
      }

      mediaRecorder.onstop = async () => {
        // Create audio blob
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
        console.log('🎵 Total audio size:', audioBlob.size, 'bytes')
        console.log('🎵 Audio chunks count:', audioChunksRef.current.length)

        // Check if we actually recorded something
        if (audioBlob.size < 1000) {
          setError('No audio was recorded. Please check your microphone.')
          setState('error')
          return
        }

        // Create a URL for the audio blob to test playback (for debugging)
        const audioUrl = URL.createObjectURL(audioBlob)
        console.log('🔊 Audio playback URL:', audioUrl)
        console.log('🔊 To test audio, paste this in console: new Audio("' + audioUrl + '").play()')

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

      // First, load all storage locations and existing products for this user
      const [locationsResult, productsResult] = await Promise.all([
        supabase
          .from('storage_locations')
          .select('id, name, parent_id, type')
          .eq('household_id', userId)
          .eq('is_active', true),
        supabase
          .from('products')
          .select('id, name, brand, category')
          .limit(1000) // Get common products
      ])

      const storageLocations = locationsResult.data
      const existingProducts = productsResult.data

      const lowerText = text.toLowerCase()

      // Check if this looks like a command at all
      const commandKeywords = ['add', 'adding', 'stock', 'put', 'store', 'remove', 'removing', 'use', 'take', 'grab']
      const hasCommandWord = commandKeywords.some(word => lowerText.includes(word))

      if (!hasCommandWord) {
        // Check for common non-command phrases
        if (lowerText.includes('www.') || lowerText.includes('http') || lowerText.includes('.com') || lowerText.includes('.gov')) {
          setError('That doesn\'t sound like an inventory command. Try saying something like "Add milk" or "Remove eggs"')
        } else if (lowerText.length < 3) {
          setError('Command too short. Please say "add" or "remove" followed by the item name')
        } else {
          setError(`I heard: "${text}"\n\nPlease use commands like:\n• "Add 2 gallons of milk"\n• "Remove eggs"\n• "Stock up on bread"`)
        }
        setState('error')

        // Auto-reset after 3 seconds for retry
        setTimeout(() => {
          setState('idle')
          setError(null)
          setTranscript('')
        }, 3000)
        return
      }

      // Detect action (add or remove)
      let action: 'add' | 'remove' | null = null
      if (lowerText.includes('add') || lowerText.includes('stock') || lowerText.includes('put')) {
        action = 'add'
      } else if (lowerText.includes('remove') || lowerText.includes('use') || lowerText.includes('take') || lowerText.includes('grab')) {
        action = 'remove'
      }

      if (!action) {
        setError('Could not determine if you want to add or remove items. Please be more specific.')
        setState('error')
        setTimeout(() => {
          setState('idle')
          setError(null)
          setTranscript('')
        }, 3000)
        return
      }

      // Start with the original text
      let itemName = text

      // Extract quantity first if mentioned
      let quantity = 1
      const quantityMatch = text.match(/\b(\d+)\b/)
      if (quantityMatch) {
        quantity = parseInt(quantityMatch[1])
        itemName = itemName.replace(quantityMatch[0], '').trim()
      }

      // Extract location if mentioned
      let locationHint: string | null = null
      let matchedLocation: any = null

      // Check if any storage location name is mentioned in the command
      if (storageLocations && storageLocations.length > 0) {
        const lowerItemName = itemName.toLowerCase()

        // Build hierarchical location names (e.g., "Hall Pantry > Top Shelf")
        const locationsWithPaths = storageLocations.map(loc => {
          let path = loc.name
          let currentLoc = loc

          // Build full path by traversing parent locations
          while (currentLoc.parent_id) {
            const parent = storageLocations.find(l => l.id === currentLoc.parent_id)
            if (parent) {
              path = `${parent.name} ${path}`
              currentLoc = parent
            } else {
              break
            }
          }

          return { ...loc, fullPath: path }
        })

        // Sort locations by path length (descending) to match longer, more specific names first
        const sortedLocations = locationsWithPaths.sort((a, b) => b.fullPath.length - a.fullPath.length)

        // Try to find the best matching location
        let bestMatch = null
        let bestScore = 0

        for (const location of sortedLocations) {
          const locationName = location.name.toLowerCase()
          const fullPath = location.fullPath.toLowerCase()
          const locationWords = fullPath.split(/\s+/)

          let score = 0
          let foundWords = []

          // Check how many words from the location match the command
          for (const word of locationWords) {
            if (lowerItemName.includes(word)) {
              score++
              foundWords.push(word)
            }
          }

          // Bonus points for exact name match or full path match
          if (lowerItemName.includes(fullPath)) {
            score += 10
          } else if (lowerItemName.includes(locationName)) {
            score += 5
          }

          // If this is the best match so far, remember it
          if (score > bestScore) {
            bestScore = score
            bestMatch = location
          }
        }

        // If we found a good match, use it
        if (bestMatch && bestScore > 0) {
          matchedLocation = bestMatch
          locationHint = bestMatch.name

          // Remove all matched location words from item name
          const fullPath = bestMatch.fullPath
          const words = fullPath.split(/\s+/)

          for (const word of words) {
            const wordPattern = new RegExp(`\\b(?:to|in|on|into|onto|at|from)?\\s*(?:the\\s+)?${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
            itemName = itemName.replace(wordPattern, ' ')
          }

          itemName = itemName.replace(/\s+/g, ' ').trim()
        }
      }

      // Now remove action words from the cleaned item name
      itemName = itemName
        .replace(/\b(add|adding|stock|put|store|remove|removing|use|take|grab|an?)\b/gi, '')
        .replace(/\b(to|from|in|on|at|the|my|our)\b/gi, '')
        .replace(/\s+/g, ' ') // Collapse multiple spaces
        .trim()

      if (!itemName || itemName.length < 2) {
        setError('Could not understand the item name. Please try again.')
        setState('error')
        setTimeout(() => {
          setState('idle')
          setError(null)
          setTranscript('')
        }, 3000)
        return
      }

      console.log('Parsed command:', { action, quantity, itemName, locationHint })
      setFeedback(`${action === 'add' ? 'Adding' : 'Removing'} ${quantity} ${itemName}${locationHint ? ` to ${locationHint}` : ''}...`)

      // Actually add the item to inventory
      if (action === 'add') {
        try {
          // First, try to find the best matching product
          let productId: string | null = null
          let productName: string = itemName

          // Try to find the best matching product from our loaded list
          if (existingProducts && existingProducts.length > 0) {
            const lowerItemName = itemName.toLowerCase()
            let bestProductMatch = null
            let bestProductScore = 0

            for (const product of existingProducts) {
              const productNameLower = product.name.toLowerCase()
              let score = 0

              // Exact match
              if (productNameLower === lowerItemName) {
                score = 100
              }
              // Product name contains the item name
              else if (productNameLower.includes(lowerItemName)) {
                score = 50 + (lowerItemName.length / productNameLower.length) * 30
              }
              // Item name contains the product name
              else if (lowerItemName.includes(productNameLower)) {
                score = 40 + (productNameLower.length / lowerItemName.length) * 30
              }
              // Word-by-word matching
              else {
                const itemWords = lowerItemName.split(/\s+/)
                const productWords = productNameLower.split(/\s+/)
                let matchedWords = 0

                for (const itemWord of itemWords) {
                  if (productWords.some(pw => pw.includes(itemWord) || itemWord.includes(pw))) {
                    matchedWords++
                  }
                }

                if (matchedWords > 0) {
                  score = (matchedWords / Math.max(itemWords.length, productWords.length)) * 30
                }
              }

              if (score > bestProductScore) {
                bestProductScore = score
                bestProductMatch = product
              }
            }

            // Use the best match if it's good enough
            if (bestProductMatch && bestProductScore > 20) {
              productId = bestProductMatch.id
              productName = bestProductMatch.name
              console.log(`Found matching product: ${productName} (score: ${bestProductScore})`)
            }
          }

          // If no good match found, search the database
          if (!productId) {
            const { data: searchResults } = await supabase
              .from('products')
              .select('id, name')
              .ilike('name', `%${itemName}%`)
              .limit(1)

            if (searchResults && searchResults.length > 0) {
              productId = searchResults[0].id
              productName = searchResults[0].name
              console.log('Found product in database search:', productName)
            }
          }

          // If still no match, create a new product
          if (!productId) {
            // Create new product
            const { data: newProduct, error: productError } = await supabase
              .from('products')
              .insert([{
                name: itemName,
                created_by: userId
              }])
              .select('id')
              .single()

            if (productError) throw productError
            productId = newProduct.id
            console.log('Created new product:', itemName)
          }

          // Find the appropriate storage location
          let locationId: string
          let locationName: string

          if (matchedLocation) {
            // We already found the exact location during parsing
            locationId = matchedLocation.id
            locationName = matchedLocation.name
            console.log('Using matched location:', locationName)
          } else if (locationHint) {
            // We have a hint but no exact match - try fuzzy matching
            const { data: matchingLocations } = await supabase
              .from('storage_locations')
              .select('id, name')
              .eq('household_id', userId)
              .eq('is_active', true)
              .ilike('name', `%${locationHint}%`)

            if (matchingLocations && matchingLocations.length > 0) {
              if (matchingLocations.length === 1) {
                // Perfect - found exactly one match
                locationId = matchingLocations[0].id
                locationName = matchingLocations[0].name
                console.log('Found matching location:', locationName)
              } else {
                // Multiple matches - list them and use the first one for now
                const locationNames = matchingLocations.map(l => l.name).join(', ')
                console.log('Multiple matching locations found:', locationNames)

                // Use the first match but inform the user
                locationId = matchingLocations[0].id
                locationName = matchingLocations[0].name
                setFeedback(`Found multiple locations matching "${locationHint}": ${locationNames}. Using ${locationName}.`)
              }
            } else {
              // No match for the hint, fall back to default
              console.log(`No location found matching "${locationHint}", using default`)
              const { data: defaultLocation } = await supabase
                .from('storage_locations')
                .select('id, name')
                .eq('household_id', userId)
                .eq('is_active', true)
                .limit(1)

              if (!defaultLocation || defaultLocation.length === 0) {
                throw new Error('No storage locations found. Please create a storage location first.')
              }

              locationId = defaultLocation[0].id
              locationName = defaultLocation[0].name
              setFeedback(`Couldn't find "${locationHint}", using default location: ${locationName}`)
            }
          } else {
            // No location specified, use default
            const { data: defaultLocation } = await supabase
              .from('storage_locations')
              .select('id, name')
              .eq('household_id', userId)
              .eq('is_active', true)
              .limit(1)

            if (!defaultLocation || defaultLocation.length === 0) {
              throw new Error('No storage locations found. Please create a storage location first.')
            }

            locationId = defaultLocation[0].id
            locationName = defaultLocation[0].name
            console.log('Using default storage location:', locationName)
          }

          // Add to inventory
          const { error: inventoryError } = await supabase
            .from('inventory_items')
            .insert([{
              product_id: productId,
              storage_location_id: locationId,
              household_id: userId,
              quantity: quantity,
              unit: 'pieces',
              purchase_date: new Date().toISOString().split('T')[0],
              created_by: userId,
              last_modified_by: userId,
              last_modified_at: new Date().toISOString()
            }])

          if (inventoryError) throw inventoryError

          setState('complete')
          setFeedback(`✅ Successfully added ${quantity} ${productName} to ${locationName}`)

          // Call the callback
          if (onItemAdded) {
            onItemAdded({ name: itemName, quantity, location: locationName })
          }

        } catch (err: any) {
          console.error('Failed to add item:', err)
          setError(`Failed to add item: ${err.message}`)
          setState('error')
          return
        }
      } else {
        // Handle remove action (to be implemented)
        setState('complete')
        setFeedback(`✅ Successfully ${action === 'add' ? 'added' : 'removed'} ${quantity} ${itemName}`)

        if (onItemRemoved) {
          onItemRemoved({ name: itemName, quantity })
        }
      }

      // Reset after 3 seconds
      setTimeout(() => {
        setState('idle')
        setTranscript('')
        setFeedback('')
        setError(null)
      }, 3000)

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