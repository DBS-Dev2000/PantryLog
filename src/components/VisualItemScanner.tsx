'use client'

import { useState, useRef, useEffect } from 'react'
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
  Search as SearchIcon
} from '@mui/icons-material'

interface VisualItemScannerProps {
  open: boolean
  onClose: () => void
  onItemSelected: (item: any) => void
  title?: string
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
  title = "Visual Item Recognition"
}: VisualItemScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [processing, setProcessing] = useState(false)
  const [identifiedItems, setIdentifiedItems] = useState<IdentifiedItem[]>([])
  const [capturedImage, setCapturedImage] = useState<string | null>(null)

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

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream

        videoRef.current.onloadedmetadata = () => {
          console.log('📹 Visual recognition video ready')
          setCameraActive(true)
        }

        videoRef.current.play().catch(console.error)
      }

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
          {!cameraActive ? (
            <Box sx={{
              textAlign: 'center',
              color: 'white',
              p: 3,
              flexGrow: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center'
            }}>
              <CircularProgress sx={{ color: 'white', mb: 2 }} />
              <Typography>Starting camera...</Typography>
            </Box>
          ) : (
            <Box sx={{ position: 'relative', flexGrow: 1 }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }}
              />

              {/* Capture Button */}
              {!processing && (
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
                  <Typography variant="h6">🤖 AI Analyzing Image...</Typography>
                  <Typography variant="body2" sx={{ opacity: 0.8 }}>
                    Identifying grocery items
                  </Typography>
                </Box>
              )}

              {/* Instructions Overlay */}
              {!processing && (
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
          )}

          {/* Hidden canvas for image capture */}
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </Box>

        {/* Identified Items Results */}
        {identifiedItems.length > 0 && (
          <Box sx={{ p: 2, backgroundColor: 'grey.50', maxHeight: 200, overflow: 'auto' }}>
            <Typography variant="h6" gutterBottom>
              🎯 Items Identified
            </Typography>
            <List dense>
              {identifiedItems.map((item, index) => (
                <ListItem
                  key={index}
                  sx={{
                    border: '1px solid #ddd',
                    borderRadius: 1,
                    mb: 1,
                    backgroundColor: 'white',
                    cursor: 'pointer',
                    '&:hover': { backgroundColor: 'action.hover' }
                  }}
                  onClick={() => selectItem(item)}
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
                    <Button size="small" variant="outlined">
                      Select
                    </Button>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Typography variant="caption" color="textSecondary" sx={{ flexGrow: 1 }}>
          🤖 AI-powered grocery item identification using Claude Vision
        </Typography>
        <Button onClick={handleClose}>
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  )
}