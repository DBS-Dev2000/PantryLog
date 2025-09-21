'use client'

import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction
} from '@mui/material'
import {
  Close as CloseIcon,
  CameraAlt as CameraIcon,
  Visibility as EyeIcon,
  Check as CheckIcon,
  Search as SearchIcon,
  ThumbUp as ThumbUpIcon,
  ThumbDown as ThumbDownIcon,
  Edit as EditIcon
} from '@mui/icons-material'

interface VisualItemScannerProps {
  open: boolean
  onClose: () => void
  onItemSelected: (item: any) => void
  title?: string
  userId?: string
}

interface IdentifiedItem {
  name: string
  confidence: number
  category?: string
  brand?: string
  description?: string
  possible_barcodes?: string[]
}

const isBrowser = typeof window !== 'undefined'

export default function VisualItemScanner({
  open,
  onClose,
  onItemSelected,
  title = "Visual Item Recognition",
  userId
}: VisualItemScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [processing, setProcessing] = useState(false)
  const [identifiedItems, setIdentifiedItems] = useState<IdentifiedItem[]>([])
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [showManualEntry, setShowManualEntry] = useState(false)
  const [manualItem, setManualItem] = useState({
    name: '',
    brand: '',
    category: ''
  })

  useEffect(() => {
    if (open && isBrowser) {
      console.log('👁️ Opening visual scanner')
      startCamera()
    } else {
      stopCamera()
    }

    return () => stopCamera()
  }, [open])

  const startCamera = async () => {
    try {
      console.log('📷 Starting camera for visual recognition...')
      setError(null)

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera not supported on this browser')
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 }
        }
      })

      console.log('✅ Camera stream obtained for visual recognition')
      setStream(mediaStream)

      // Wait for video element to be available, then assign stream
      const assignStreamToVideo = () => {
        if (videoRef.current) {
          console.log('📹 Assigning stream to visual recognition video element')
          videoRef.current.srcObject = mediaStream

          // Add event listeners
          videoRef.current.onloadedmetadata = () => {
            console.log('📹 Visual recognition video metadata loaded')
            setCameraActive(true)
          }

          videoRef.current.oncanplay = () => {
            console.log('📹 Visual recognition video can play')
            setCameraActive(true)
          }

          videoRef.current.onplaying = () => {
            console.log('📹 Visual recognition video is playing')
            setCameraActive(true)
          }

          videoRef.current.onerror = (e) => {
            console.error('📹 Visual recognition video error:', e)
            setError('Video playback failed')
            setCameraActive(false)
          }

          // Force play the video
          videoRef.current.play()
            .then(() => {
              console.log('📹 Visual recognition video play started')
              setCameraActive(true)
            })
            .catch((e) => {
              console.error('📹 Visual recognition play error:', e)
              setError('Could not start video playback')
              setCameraActive(false)
            })

          // Fallback timer
          setTimeout(() => {
            console.log('⏰ Visual scanner fallback: Setting camera active')
            setCameraActive(true)
          }, 1000)
        } else {
          console.log('⏳ Visual recognition video element not ready, retrying...')
          setTimeout(assignStreamToVideo, 100)
        }
      }

      assignStreamToVideo()

    } catch (err: any) {
      console.error('❌ Visual recognition camera error:', err)
      if (err.name === 'NotAllowedError') {
        setError('Camera permission denied. Please allow camera access.')
      } else {
        setError(`Camera failed to start: ${err.message}`)
      }
    }
  }

  const stopCamera = () => {
    if (stream) {
      console.log('📷 Stopping visual recognition camera')
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setCameraActive(false)
  }

  const captureAndAnalyze = async () => {
    if (!videoRef.current || !canvasRef.current) return

    setProcessing(true)
    setError(null)

    try {
      // Get current user ID if not provided via props
      let currentUserId = userId
      if (!currentUserId) {
        const { data: { session } } = await supabase.auth.getSession()
        currentUserId = session?.user?.id
        console.log('🔐 Retrieved user ID for AI request:', currentUserId)
      }

      // Capture frame from video
      const video = videoRef.current
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')

      if (!ctx) throw new Error('Canvas context not available')

      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      ctx.drawImage(video, 0, 0)

      // Convert to base64
      const imageData = canvas.toDataURL('image/jpeg', 0.8)
      setCapturedImage(imageData)

      console.log('📸 Image captured, sending for AI analysis...')

      // Send to Claude API for analysis
      const response = await fetch('/api/analyze-item', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: imageData,
          user_id: currentUserId,
          prompt: `Analyze this grocery item image and identify the product. Return a JSON object with:
          {
            "items": [
              {
                "name": "Product name",
                "confidence": 0.95,
                "category": "Food category",
                "brand": "Brand name if visible",
                "description": "Brief description",
                "possible_barcodes": ["barcode if visible"]
              }
            ]
          }

          Look for food items, groceries, packaged goods. Focus on identifying specific products like "Coca-Cola Classic 12-pack", "Lay's Classic Potato Chips", "Bananas", etc.`
        })
      })

      if (!response.ok) {
        throw new Error('Failed to analyze image')
      }

      const result = await response.json()
      console.log('🔍 AI analysis result:', result)

      if (result.items && result.items.length > 0) {
        setIdentifiedItems(result.items)
      } else {
        setError('No items identified in the image. Try a clearer photo or better lighting.')
      }

    } catch (err: any) {
      console.error('❌ Visual recognition error:', err)
      setError('Failed to analyze image. Please try again or use manual entry.')
    } finally {
      setProcessing(false)
    }
  }

  const selectItem = (item: IdentifiedItem) => {
    console.log('✅ User selected identified item:', item.name)

    // Log positive feedback for AI learning
    logAIFeedback(item, 'correct')

    // Convert to product data format
    const productData = {
      name: item.name,
      brand: item.brand,
      category: item.category,
      upc: item.possible_barcodes?.[0] || `VISUAL-${Date.now()}`
    }

    onItemSelected(productData)
    handleClose()
  }

  const rejectItem = (item: IdentifiedItem) => {
    console.log('❌ User rejected AI identification:', item.name)

    // Log negative feedback for AI learning
    logAIFeedback(item, 'incorrect')

    // Show manual entry option
    setShowManualEntry(true)
  }

  const logAIFeedback = async (item: IdentifiedItem, feedback: 'correct' | 'incorrect') => {
    try {
      // Log feedback for AI improvement (future: train custom models)
      await fetch('/api/ai-feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          identified_item: item,
          feedback: feedback,
          image_data: capturedImage,
          timestamp: new Date().toISOString()
        })
      })

      console.log(`📝 AI feedback logged: ${feedback} for ${item.name}`)
    } catch (err) {
      console.warn('Failed to log AI feedback:', err)
    }
  }

  const submitManualItem = () => {
    if (!manualItem.name.trim()) return

    console.log('✅ User provided manual correction:', manualItem.name)

    // Convert manual entry to product data
    const productData = {
      name: manualItem.name,
      brand: manualItem.brand,
      category: manualItem.category,
      upc: `MANUAL-${Date.now()}`
    }

    onItemSelected(productData)
    handleClose()
  }

  const handleClose = () => {
    stopCamera()
    setError(null)
    setCapturedImage(null)
    setIdentifiedItems([])
    setProcessing(false)
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          height: '90vh',
          maxHeight: 700
        }
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1}>
            <EyeIcon />
            <Typography variant="h6">{title}</Typography>
          </Box>
          <IconButton onClick={handleClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column' }}>
        {error && (
          <Alert severity="error" sx={{ m: 2 }}>
            {error}
          </Alert>
        )}

        <Typography variant="body2" color="textSecondary" sx={{ p: 2, pb: 1 }}>
          Point camera at grocery items for AI-powered identification
        </Typography>

        {/* Camera View */}
        <Box
          sx={{
            flexGrow: 1,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'black',
            position: 'relative',
            minHeight: 300
          }}
        >
          <Box sx={{ position: 'relative', flexGrow: 1 }}>
            {/* Always render video element for ref availability */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              webkit-playsinline="true"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                backgroundColor: 'black'
              }}
            />

            {/* Loading overlay when camera not active */}
            {!cameraActive && (
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  backgroundColor: 'rgba(0,0,0,0.8)',
                  color: 'white'
                }}
              >
                <CircularProgress sx={{ color: 'white', mb: 2 }} />
                <Typography>Starting camera...</Typography>
              </Box>
            )}

            {/* Capture Button - only when camera is active */}
            {cameraActive && !processing && (
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 20,
                  left: '50%',
                  transform: 'translateX(-50%)'
                }}
              >
                <Button
                  variant="contained"
                  size="large"
                  onClick={captureAndAnalyze}
                  startIcon={<EyeIcon />}
                  sx={{
                    backgroundColor: 'rgba(25, 118, 210, 0.9)',
                    '&:hover': { backgroundColor: 'rgba(25, 118, 210, 1)' },
                    fontSize: '1.1rem',
                    py: 1.5,
                    px: 3
                  }}
                >
                  Identify Item
                </Button>
              </Box>
            )}

            {/* Processing Overlay */}
            {processing && (
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  backgroundColor: 'rgba(0,0,0,0.8)',
                  color: 'white'
                }}
              >
                <CircularProgress sx={{ color: 'white', mb: 2 }} />
                <Typography variant="h6">🔍 Analyzing Image...</Typography>
                <Typography variant="body2" sx={{ opacity: 0.8 }}>
                  Identifying grocery items
                </Typography>
              </Box>
            )}

            {/* Instructions Overlay */}
            {cameraActive && !processing && (
              <Box
                sx={{
                  position: 'absolute',
                  top: 16,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  backgroundColor: 'rgba(0,0,0,0.8)',
                  color: 'white',
                  px: 2,
                  py: 1,
                  borderRadius: 1,
                  textAlign: 'center'
                }}
              >
                <Typography variant="body2">
                  📱 Center grocery item in view and tap "Identify"
                </Typography>
              </Box>
            )}
          </Box>

          {/* Hidden canvas for image capture */}
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </Box>

        {/* Identified Items Results */}
        {identifiedItems.length > 0 && !showManualEntry && (
          <Box sx={{ p: 2, backgroundColor: 'grey.50', maxHeight: 300, overflow: 'auto' }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">
                🎯 Items Identified
              </Typography>
              <Button
                size="small"
                startIcon={<EditIcon />}
                onClick={() => setShowManualEntry(true)}
                color="secondary"
              >
                Manual Entry
              </Button>
            </Box>
            <List dense>
              {identifiedItems.map((item, index) => (
                <ListItem
                  key={index}
                  sx={{
                    border: '1px solid #ddd',
                    borderRadius: 1,
                    mb: 1,
                    backgroundColor: 'white'
                  }}
                >
                  <ListItemText
                    primary={
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="body1" fontWeight="medium">
                          {item.name}
                        </Typography>
                        <Chip
                          size="small"
                          label={`${Math.round(item.confidence * 100)}%`}
                          color={item.confidence > 0.8 ? 'success' : item.confidence > 0.6 ? 'warning' : 'default'}
                        />
                      </Box>
                    }
                    secondary={
                      <Box>
                        {item.brand && (
                          <Typography variant="caption" color="textSecondary">
                            Brand: {item.brand}
                          </Typography>
                        )}
                        {item.category && (
                          <Chip size="small" label={item.category} variant="outlined" sx={{ ml: 1 }} />
                        )}
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <Box display="flex" gap={0.5}>
                      <IconButton
                        size="small"
                        onClick={() => selectItem(item)}
                        color="success"
                        title="This is correct"
                      >
                        <ThumbUpIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => rejectItem(item)}
                        color="error"
                        title="This is wrong"
                      >
                        <ThumbDownIcon />
                      </IconButton>
                    </Box>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        {/* Manual Entry Form */}
        {showManualEntry && (
          <Box sx={{ p: 2, backgroundColor: 'warning.light' }}>
            <Typography variant="h6" gutterBottom sx={{ color: 'warning.contrastText' }}>
              ✏️ Manual Item Entry
            </Typography>
            <Typography variant="body2" sx={{ color: 'warning.contrastText', mb: 2, opacity: 0.9 }}>
              AI got it wrong? Enter the correct item details:
            </Typography>
            <Grid container spacing={1}>
              <Grid item xs={12}>
                <TextField
                  label="Item Name"
                  fullWidth
                  value={manualItem.name}
                  onChange={(e) => setManualItem({ ...manualItem, name: e.target.value })}
                  placeholder="e.g., Red Apple, Coca-Cola"
                  size="small"
                  autoFocus
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Brand"
                  fullWidth
                  value={manualItem.brand}
                  onChange={(e) => setManualItem({ ...manualItem, brand: e.target.value })}
                  placeholder="Optional"
                  size="small"
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Category"
                  fullWidth
                  value={manualItem.category}
                  onChange={(e) => setManualItem({ ...manualItem, category: e.target.value })}
                  placeholder="e.g., Fresh Produce"
                  size="small"
                />
              </Grid>
              <Grid item xs={12}>
                <Box display="flex" gap={1} justifyContent="flex-end">
                  <Button
                    size="small"
                    onClick={() => setShowManualEntry(false)}
                  >
                    Back to AI Results
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    onClick={submitManualItem}
                    disabled={!manualItem.name.trim()}
                    color="secondary"
                  >
                    Use This Item
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Typography variant="caption" color="textSecondary" sx={{ flexGrow: 1 }}>
          📸 Smart visual item identification
        </Typography>
        <Button onClick={handleClose}>
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  )
}