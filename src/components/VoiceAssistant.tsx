'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemText,
  Avatar,
  Fade,
  Zoom,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack
} from '@mui/material'
import {
  Mic as MicIcon,
  MicOff as MicOffIcon,
  SmartToy as AIIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  Inventory as InventoryIcon,
  LocationOn as LocationIcon,
  CheckCircle as CheckIcon,
  Cancel as CancelIcon,
  VolumeUp as SpeakIcon,
  Refresh as RetryIcon,
  Close as CloseIcon
} from '@mui/icons-material'
import { supabase } from '@/lib/supabase'

interface VoiceAssistantProps {
  open: boolean
  onClose: () => void
  userId: string
}

type ConversationState =
  | 'idle'
  | 'listening-action'
  | 'listening-product'
  | 'processing-product'
  | 'confirming-product'
  | 'listening-location'
  | 'processing-location'
  | 'confirming-action'
  | 'executing'
  | 'complete'
  | 'error'

interface ProductMatch {
  id?: string
  upc?: string
  name: string
  brand?: string
  size?: string
  category?: string
  confidence: number
}

interface ParsedLocation {
  area: string
  specific?: string
  raw: string
}

export default function VoiceAssistant({ open, onClose, userId }: VoiceAssistantProps) {
  const [state, setState] = useState<ConversationState>('idle')
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [action, setAction] = useState<'add' | 'remove' | null>(null)
  const [productMatch, setProductMatch] = useState<ProductMatch | null>(null)
  const [location, setLocation] = useState<ParsedLocation | null>(null)
  const [storageLocations, setStorageLocations] = useState<any[]>([])
  const [selectedLocationId, setSelectedLocationId] = useState<string>('')
  const [quantity, setQuantity] = useState(1)
  const [messages, setMessages] = useState<Array<{role: 'assistant' | 'user', text: string}>>([])
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<any>(null)
  const [speechSupported, setSpeechSupported] = useState(false)

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (SpeechRecognition) {
        setSpeechSupported(true)
        const recognition = new SpeechRecognition()
        recognition.continuous = true
        recognition.interimResults = true
        recognition.lang = 'en-US'

        recognition.onresult = (event: any) => {
          let interim = ''
          let final = ''

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript
            if (event.results[i].isFinal) {
              final += transcript + ' '
            } else {
              interim += transcript
            }
          }

          if (final) {
            setTranscript(prev => prev + final)
            setInterimTranscript('')
            processTranscript(final.trim())
          } else {
            setInterimTranscript(interim)
          }
        }

        recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error)
          setIsListening(false)
          setError(`Speech recognition error: ${event.error}`)
        }

        recognition.onend = () => {
          setIsListening(false)
        }

        recognitionRef.current = recognition
      }
    }

    // Load storage locations
    loadStorageLocations()
  }, [])

  const loadStorageLocations = async () => {
    const { data, error } = await supabase
      .from('storage_locations')
      .select('*')
      .eq('household_id', userId)
      .eq('is_active', true)
      .order('name')

    if (!error && data) {
      setStorageLocations(data)
    }
  }

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      setTranscript('')
      setInterimTranscript('')
      recognitionRef.current.start()
      setIsListening(true)
    }
  }

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    }
  }

  const processTranscript = async (text: string) => {
    const lowerText = text.toLowerCase()

    switch (state) {
      case 'idle':
      case 'listening-action':
        if (lowerText.includes('add') || lowerText.includes('put') || lowerText.includes('store')) {
          setAction('add')
          setState('listening-product')
          addMessage('assistant', "What product would you like to add? You can describe it like 'Coca Cola 12 pack' or 'Organic whole milk gallon'")
          speak("What product would you like to add?")
        } else if (lowerText.includes('remove') || lowerText.includes('take') || lowerText.includes('use')) {
          setAction('remove')
          setState('listening-product')
          addMessage('assistant', "What product would you like to remove? Just tell me what it is.")
          speak("What product would you like to remove?")
        }
        break

      case 'listening-product':
        addMessage('user', text)
        setState('processing-product')
        stopListening()
        await lookupProduct(text)
        break

      case 'listening-location':
        addMessage('user', text)
        setState('processing-location')
        stopListening()
        parseLocation(text)
        break

      case 'confirming-product':
        if (lowerText.includes('yes') || lowerText.includes('correct') || lowerText.includes('right')) {
          if (action === 'add') {
            setState('listening-location')
            addMessage('assistant', "Where should I store this? You can say something like 'hall pantry, right side, second shelf' or just pick from the list below.")
            speak("Where should I store this?")
          } else {
            // For remove, go straight to execution
            setState('executing')
            executeAction()
          }
        } else if (lowerText.includes('no') || lowerText.includes('wrong')) {
          setState('listening-product')
          addMessage('assistant', "Let's try again. Please describe the product.")
          speak("Please describe the product again")
        }
        break

      case 'confirming-action':
        if (lowerText.includes('yes') || lowerText.includes('confirm') || lowerText.includes('correct')) {
          setState('executing')
          executeAction()
        } else if (lowerText.includes('no') || lowerText.includes('cancel')) {
          setState('idle')
          addMessage('assistant', "Action cancelled. What would you like to do?")
        }
        break
    }
  }

  const lookupProduct = async (description: string) => {
    try {
      // First try to find in existing products
      const { data: products } = await supabase
        .from('products')
        .select('*')
        .ilike('name', `%${description}%`)
        .limit(5)

      if (products && products.length > 0) {
        // Use the first match for now
        const product = products[0]
        setProductMatch({
          id: product.id,
          upc: product.upc,
          name: product.name,
          brand: product.brand,
          size: product.size,
          category: product.category,
          confidence: 0.9
        })
        setState('confirming-product')
        addMessage('assistant', `I found "${product.name}"${product.brand ? ` by ${product.brand}` : ''}. Is this correct?`)
        speak(`I found ${product.name}. Is this correct?`)
      } else {
        // Use AI to extract product details
        const productInfo = await extractProductInfo(description)
        setProductMatch(productInfo)
        setState('confirming-product')
        addMessage('assistant', `I understood "${productInfo.name}"${productInfo.size ? ` ${productInfo.size}` : ''}. Is this correct?`)
        speak(`I understood ${productInfo.name}. Is this correct?`)
      }
    } catch (error) {
      console.error('Product lookup error:', error)
      setError('Failed to lookup product')
      setState('error')
    }
  }

  const extractProductInfo = async (description: string): Promise<ProductMatch> => {
    // Use AI to parse the product description
    try {
      const response = await fetch('/api/ai/extract-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, userId })
      })

      if (response.ok) {
        const data = await response.json()
        return data
      }
    } catch (error) {
      console.error('AI extraction error:', error)
    }

    // Fallback to basic parsing
    return {
      name: description,
      confidence: 0.5
    }
  }

  const parseLocation = (text: string) => {
    const lowerText = text.toLowerCase()

    // Try to match with existing locations
    const matchedLocation = storageLocations.find(loc =>
      lowerText.includes(loc.name.toLowerCase())
    )

    if (matchedLocation) {
      setSelectedLocationId(matchedLocation.id)
      setLocation({
        area: matchedLocation.name,
        specific: text.replace(new RegExp(matchedLocation.name, 'gi'), '').trim(),
        raw: text
      })
      setState('confirming-action')
      addMessage('assistant', `Got it! I'll ${action} "${productMatch?.name}" ${action === 'add' ? `to ${matchedLocation.name}` : 'from your inventory'}. Confirm?`)
      speak(`Ready to ${action} ${productMatch?.name}. Confirm?`)
    } else {
      // Parse location description
      setLocation({
        area: text,
        specific: '',
        raw: text
      })
      addMessage('assistant', "I couldn't find that exact location. Please select from the list below or create a new one.")
      setState('confirming-action')
    }
  }

  const executeAction = async () => {
    try {
      if (action === 'add' && productMatch) {
        // Create or get product
        let productId = productMatch.id

        if (!productId) {
          // Create new product
          const { data: newProduct, error: productError } = await supabase
            .from('products')
            .insert({
              name: productMatch.name,
              brand: productMatch.brand,
              category: productMatch.category || 'Other',
              size: productMatch.size
            })
            .select()
            .single()

          if (productError) throw productError
          productId = newProduct.id
        }

        // Add to inventory
        const { error: inventoryError } = await supabase
          .from('inventory_items')
          .insert({
            product_id: productId,
            storage_location_id: selectedLocationId,
            household_id: userId,
            quantity: quantity,
            unit: 'pieces',
            purchase_date: new Date().toISOString().split('T')[0],
            notes: location?.specific || ''
          })

        if (inventoryError) throw inventoryError

        setState('complete')
        addMessage('assistant', `✅ Successfully added ${productMatch.name} to your inventory!`)
        speak(`Successfully added ${productMatch.name}`)
        setTimeout(() => onClose(), 3000)

      } else if (action === 'remove' && productMatch) {
        // Find and mark item as consumed
        const { data: items, error: findError } = await supabase
          .from('inventory_items')
          .select('*')
          .eq('household_id', userId)
          .eq('is_consumed', false)

        if (findError) throw findError

        // Find matching item (simple match for now)
        const item = items?.find(i => i.product_id === productMatch.id)

        if (item) {
          const { error: updateError } = await supabase
            .from('inventory_items')
            .update({
              is_consumed: true,
              consumed_date: new Date().toISOString()
            })
            .eq('id', item.id)

          if (updateError) throw updateError

          setState('complete')
          addMessage('assistant', `✅ Successfully removed ${productMatch.name} from your inventory!`)
          speak(`Successfully removed ${productMatch.name}`)
          setTimeout(() => onClose(), 3000)
        } else {
          throw new Error('Item not found in inventory')
        }
      }
    } catch (error: any) {
      console.error('Execution error:', error)
      setError(error.message)
      setState('error')
      addMessage('assistant', `❌ Error: ${error.message}`)
      speak('Sorry, there was an error')
    }
  }

  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 1.0
      utterance.pitch = 1.0
      speechSynthesis.speak(utterance)
    }
  }

  const addMessage = (role: 'assistant' | 'user', text: string) => {
    setMessages(prev => [...prev, { role, text }])
  }

  const reset = () => {
    setState('idle')
    setAction(null)
    setProductMatch(null)
    setLocation(null)
    setSelectedLocationId('')
    setTranscript('')
    setInterimTranscript('')
    setMessages([])
    setError(null)
  }

  const handleStart = () => {
    reset()
    setState('listening-action')
    addMessage('assistant', "Hi! I'm your inventory assistant. Say 'add' to add items or 'remove' to use items from your inventory.")
    speak("Hi! Say add or remove to manage your inventory")
    startListening()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          minHeight: '600px'
        }
      }}
    >
      <DialogTitle sx={{ pb: 0 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={2}>
            <Avatar sx={{ bgcolor: 'primary.main' }}>
              <AIIcon />
            </Avatar>
            <Box>
              <Typography variant="h6">Voice Inventory Assistant</Typography>
              <Typography variant="caption" color="textSecondary">
                Powered by AI
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        {!speechSupported ? (
          <Alert severity="error" sx={{ mt: 2 }}>
            Speech recognition is not supported in your browser. Please use Chrome, Edge, or Safari.
          </Alert>
        ) : (
          <>
            {/* Status Display */}
            <Card variant="outlined" sx={{ mb: 3, bgcolor: 'background.default' }}>
              <CardContent>
                <Box display="flex" alignItems="center" gap={2} mb={2}>
                  <Chip
                    label={state.replace(/-/g, ' ').toUpperCase()}
                    color={isListening ? 'error' : 'default'}
                    icon={isListening ? <MicIcon /> : undefined}
                    size="small"
                  />
                  {action && (
                    <Chip
                      label={`Action: ${action.toUpperCase()}`}
                      color={action === 'add' ? 'success' : 'warning'}
                      size="small"
                    />
                  )}
                </Box>

                {/* Live Transcript */}
                {(transcript || interimTranscript) && (
                  <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50', minHeight: 60 }}>
                    <Typography variant="body1">
                      {transcript}
                      <span style={{ color: '#999' }}>{interimTranscript}</span>
                    </Typography>
                  </Paper>
                )}

                {/* Product Match Display */}
                {productMatch && (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Detected Product:
                    </Typography>
                    <Typography variant="body1" fontWeight="bold">
                      {productMatch.name}
                    </Typography>
                    {productMatch.brand && (
                      <Typography variant="caption">Brand: {productMatch.brand}</Typography>
                    )}
                    {productMatch.size && (
                      <Typography variant="caption"> | Size: {productMatch.size}</Typography>
                    )}
                  </Alert>
                )}

                {/* Location Selection */}
                {state === 'listening-location' && storageLocations.length > 0 && (
                  <FormControl fullWidth sx={{ mt: 2 }}>
                    <InputLabel>Or select a location</InputLabel>
                    <Select
                      value={selectedLocationId}
                      label="Or select a location"
                      onChange={(e) => {
                        setSelectedLocationId(e.target.value)
                        const loc = storageLocations.find(l => l.id === e.target.value)
                        if (loc) {
                          setLocation({
                            area: loc.name,
                            specific: '',
                            raw: loc.name
                          })
                          setState('confirming-action')
                          stopListening()
                        }
                      }}
                    >
                      {storageLocations.map(loc => (
                        <MenuItem key={loc.id} value={loc.id}>
                          <Box display="flex" alignItems="center" gap={1}>
                            <LocationIcon fontSize="small" />
                            {loc.name}
                            {loc.type && (
                              <Chip label={loc.type} size="small" variant="outlined" />
                            )}
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              </CardContent>
            </Card>

            {/* Conversation History */}
            <Box sx={{ maxHeight: 300, overflowY: 'auto', mb: 3 }}>
              {messages.map((msg, index) => (
                <Fade in key={index}>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                      mb: 1
                    }}
                  >
                    <Paper
                      sx={{
                        p: 1.5,
                        maxWidth: '70%',
                        bgcolor: msg.role === 'user' ? 'primary.light' : 'grey.100',
                        color: msg.role === 'user' ? 'primary.contrastText' : 'text.primary'
                      }}
                    >
                      <Typography variant="body2">{msg.text}</Typography>
                    </Paper>
                  </Box>
                </Fade>
              ))}
            </Box>

            {/* Action Buttons */}
            <Box display="flex" justifyContent="center" gap={2}>
              {state === 'idle' && (
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<MicIcon />}
                  onClick={handleStart}
                  color="primary"
                >
                  Start Voice Assistant
                </Button>
              )}

              {isListening && (
                <IconButton
                  size="large"
                  color="error"
                  onClick={stopListening}
                  sx={{
                    bgcolor: 'error.light',
                    '&:hover': { bgcolor: 'error.main' }
                  }}
                >
                  <MicOffIcon fontSize="large" />
                </IconButton>
              )}

              {!isListening && state !== 'idle' && state !== 'complete' && state !== 'error' && (
                <IconButton
                  size="large"
                  color="primary"
                  onClick={startListening}
                  sx={{
                    bgcolor: 'primary.light',
                    animation: 'pulse 2s infinite',
                    '@keyframes pulse': {
                      '0%': { transform: 'scale(1)' },
                      '50%': { transform: 'scale(1.1)' },
                      '100%': { transform: 'scale(1)' }
                    }
                  }}
                >
                  <MicIcon fontSize="large" />
                </IconButton>
              )}

              {state === 'error' && (
                <Button
                  variant="outlined"
                  startIcon={<RetryIcon />}
                  onClick={handleStart}
                >
                  Try Again
                </Button>
              )}

              {state === 'complete' && (
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<CheckIcon />}
                  onClick={onClose}
                >
                  Done
                </Button>
              )}
            </Box>

            {error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}