'use client'

import { useState, useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Alert,
  IconButton,
  CircularProgress,
  TextField
} from '@mui/material'
import {
  Close as CloseIcon,
  CameraAlt as CameraIcon,
  FlashOn as FlashOnIcon,
  FlashOff as FlashOffIcon,
  FlipCameraAndroid as FlipCameraIcon
} from '@mui/icons-material'
// Dynamic import for html5-qrcode to avoid SSR issues
const Html5QrcodeScanner = dynamic(
  () => import('html5-qrcode').then(mod => mod.Html5QrcodeScanner),
  { ssr: false }
)

const isBrowser = typeof window !== 'undefined'

interface BarcodeScannerProps {
  open: boolean
  onClose: () => void
  onScan: (barcode: string) => void
  title?: string
  description?: string
}

export default function BarcodeScanner({
  open,
  onClose,
  onScan,
  title = "Camera Barcode Helper",
  description = "Use your camera to see the barcode clearly, then enter it manually"
}: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [manualBarcode, setManualBarcode] = useState('')

  useEffect(() => {
    if (open && isBrowser) {
      console.log('📷 Opening camera dialog')
      startCamera()
    } else {
      stopCamera()
    }

    return () => stopCamera()
  }, [open])

  const startCamera = async () => {
    try {
      console.log('🔍 Requesting camera access...')
      setError(null)

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera not supported on this browser')
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Use back camera on mobile
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 }
        }
      })

      console.log('✅ Camera stream obtained')

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream

        // Add event listeners to handle video loading
        videoRef.current.onloadedmetadata = () => {
          console.log('📹 Video metadata loaded, setting camera active')
          setCameraActive(true)
        }

        videoRef.current.oncanplay = () => {
          console.log('📹 Video can play, setting camera active')
          setCameraActive(true)
        }

        videoRef.current.onplaying = () => {
          console.log('📹 Video is playing, camera should be visible')
          setCameraActive(true)
        }

        videoRef.current.onerror = (e) => {
          console.error('📹 Video error:', e)
          setError('Video playback failed')
          setCameraActive(false)
        }

        // Force play the video
        videoRef.current.play()
          .then(() => {
            console.log('📹 Video play started successfully')
            setCameraActive(true)
          })
          .catch((e) => {
            console.error('📹 Play error:', e)
            setError('Could not start video playback')
            setCameraActive(false)
          })

        // Also set camera active after a short delay as fallback
        setTimeout(() => {
          console.log('⏰ Fallback: Setting camera active after delay')
          setCameraActive(true)
        }, 1000)
      }

      setStream(mediaStream)

    } catch (err: any) {
      console.error('❌ Camera error:', err)
      if (err.name === 'NotAllowedError') {
        setError('Camera permission denied. Please allow camera access and try again.')
      } else if (err.name === 'NotFoundError') {
        setError('No camera found on this device.')
      } else if (err.name === 'NotSupportedError') {
        setError('Camera not supported on this browser.')
      } else {
        setError(`Camera failed to start: ${err.message}`)
      }
    }
  }

  const stopCamera = () => {
    if (stream) {
      console.log('📷 Stopping camera stream')
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setCameraActive(false)
  }

  const handleClose = () => {
    stopCamera()
    setError(null)
    setManualBarcode('')
    onClose()
  }

  const handleSubmit = () => {
    if (manualBarcode.trim()) {
      console.log('✅ Manual barcode entered:', manualBarcode)
      onScan(manualBarcode.trim())
      handleClose()
    }
  }

  const debugCamera = () => {
    console.log('🔍 Camera Debug Info:')
    console.log('   cameraActive:', cameraActive)
    console.log('   stream:', stream)
    console.log('   video element:', videoRef.current)
    console.log('   video srcObject:', videoRef.current?.srcObject)
    console.log('   video readyState:', videoRef.current?.readyState)
    console.log('   video paused:', videoRef.current?.paused)

    if (videoRef.current && !videoRef.current.paused) {
      console.log('🎬 Attempting to play video...')
      videoRef.current.play().catch(console.error)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          height: '80vh',
          maxHeight: 600
        }
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1}>
            <CameraIcon />
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
          {description}
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
          {error ? (
            <Box sx={{ textAlign: 'center', color: 'white', p: 3, flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <CameraIcon sx={{ fontSize: 48, mb: 2, color: 'grey.400' }} />
              <Typography variant="body1" sx={{ mb: 2 }}>
                Camera not available
              </Typography>
              <Typography variant="body2" sx={{ mb: 2, opacity: 0.8 }}>
                {error}
              </Typography>
            </Box>
          ) : !cameraActive ? (
            <Box sx={{ textAlign: 'center', color: 'white', p: 3, flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
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
                webkit-playsinline="true"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  backgroundColor: 'black'
                }}
              />

              {/* Scanning Frame Overlay */}
              <Box
                sx={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  border: '3px solid #00ff00',
                  width: '80%',
                  maxWidth: 250,
                  height: '25%',
                  borderRadius: 2,
                  pointerEvents: 'none',
                  boxShadow: '0 0 15px rgba(0,255,0,0.5)'
                }}
              />

              {/* Instructions */}
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
                  📱 Position barcode in green frame
                </Typography>
              </Box>
            </Box>
          )}
        </Box>

        {/* Manual Entry Section */}
        <Box sx={{ p: 2, backgroundColor: 'grey.100' }}>
          <Typography variant="body2" color="textSecondary" gutterBottom>
            Enter the barcode numbers you see:
          </Typography>
          <Box display="flex" gap={1}>
            <TextField
              label="Barcode Numbers"
              value={manualBarcode}
              onChange={(e) => setManualBarcode(e.target.value)}
              placeholder="e.g. 012000161155"
              size="small"
              sx={{ flexGrow: 1 }}
              inputProps={{
                inputMode: 'numeric',
                pattern: '[0-9]*'
              }}
            />
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={!manualBarcode.trim()}
            >
              Use This Code
            </Button>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={debugCamera} size="small" sx={{ mr: 'auto' }}>
          Debug
        </Button>
        <Typography variant="caption" color="textSecondary" sx={{ flexGrow: 1 }}>
          📷 Camera helps you see the barcode - Type the numbers in the field above
        </Typography>
        <Button onClick={handleClose}>
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  )
}