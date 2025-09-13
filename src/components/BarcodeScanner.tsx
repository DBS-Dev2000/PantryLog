'use client'

import { useState, useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library'
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
  title = "Barcode Scanner",
  description = "Position barcode in camera view - auto-detection will scan automatically"
}: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [manualBarcode, setManualBarcode] = useState('')
  const [scanning, setScanning] = useState(false)
  const [showManualEntry, setShowManualEntry] = useState(false)
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null)

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
      setStream(mediaStream)

      // Wait for video element to be available, then assign stream
      const assignStreamToVideo = () => {
        if (videoRef.current) {
          console.log('📹 Assigning stream to video element')
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
              startBarcodeScanning()
            })
            .catch((e) => {
              console.error('📹 Play error:', e)
              setError('Could not start video playback')
              setCameraActive(false)
            })
        } else {
          console.log('⏳ Video element not ready, retrying in 100ms...')
          setTimeout(assignStreamToVideo, 100)
        }
      }

      // Start trying to assign the stream
      assignStreamToVideo()

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

  const startBarcodeScanning = () => {
    try {
      console.log('🔍 Starting automatic barcode detection...')
      setScanning(true)

      if (!videoRef.current) {
        console.log('❌ Video element not available for scanning')
        return
      }

      const codeReader = new BrowserMultiFormatReader()
      codeReaderRef.current = codeReader

      // Start continuous scanning
      codeReader.decodeFromVideoDevice(
        undefined, // Use default camera
        videoRef.current,
        (result, error) => {
          if (result) {
            console.log('✅ Barcode automatically detected:', result.getText())
            onScan(result.getText())
            handleClose()
          } else if (error && !(error instanceof NotFoundException)) {
            console.log('⚠️ Barcode scan error (continuing):', error.message)
          }
        }
      )

      // Show manual entry option after 10 seconds if no barcode detected
      setTimeout(() => {
        if (cameraActive && !showManualEntry) {
          console.log('⏰ Auto-scan timeout, showing manual entry option')
          setShowManualEntry(true)
        }
      }, 10000)

    } catch (err) {
      console.error('❌ Failed to start barcode scanning:', err)
      setShowManualEntry(true)
    }
  }

  const stopCamera = () => {
    // Stop barcode scanning
    if (codeReaderRef.current) {
      console.log('🛑 Stopping barcode scanner')
      codeReaderRef.current.reset()
      codeReaderRef.current = null
    }

    // Stop camera stream
    if (stream) {
      console.log('📷 Stopping camera stream')
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setCameraActive(false)
    setScanning(false)
    setShowManualEntry(false)
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
          ) : (
            <Box sx={{ position: 'relative', flexGrow: 1 }}>
              {/* Always render video element so ref is available */}
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

              {/* Scanning Frame Overlay - only when camera is active */}
              {cameraActive && (
                <>
                  <Box
                    sx={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      border: scanning ? '3px solid #00ff00' : '3px solid #ffff00',
                      width: '80%',
                      maxWidth: 250,
                      height: '25%',
                      borderRadius: 2,
                      pointerEvents: 'none',
                      boxShadow: scanning ? '0 0 15px rgba(0,255,0,0.5)' : '0 0 15px rgba(255,255,0,0.5)',
                      animation: scanning ? 'pulse 1s infinite' : 'none'
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
                      {scanning ? '🔍 Scanning for barcodes...' : '📱 Position barcode in frame'}
                    </Typography>
                  </Box>

                  {/* Manual Entry Button */}
                  {showManualEntry && (
                    <Box
                      sx={{
                        position: 'absolute',
                        bottom: 16,
                        left: '50%',
                        transform: 'translateX(-50%)'
                      }}
                    >
                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => setShowManualEntry(true)}
                        sx={{
                          backgroundColor: 'rgba(255,255,255,0.9)',
                          color: 'black',
                          '&:hover': { backgroundColor: 'white' }
                        }}
                      >
                        📝 Enter Manually
                      </Button>
                    </Box>
                  )}
                </>
              )}
            </Box>
          )}
        </Box>

        {/* Manual Entry Section - Show after timeout or on mobile when needed */}
        {showManualEntry && (
          <Box sx={{ p: 2, backgroundColor: 'grey.100', borderTop: '1px solid #ddd' }}>
            <Typography variant="body2" color="textSecondary" gutterBottom>
              🔍 Auto-scan not working? Enter the barcode numbers manually:
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
                autoFocus
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
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={debugCamera} size="small" sx={{ mr: 'auto' }}>
          Debug
        </Button>
        {!showManualEntry && cameraActive && (
          <Button
            onClick={() => setShowManualEntry(true)}
            variant="outlined"
            size="small"
          >
            📝 Manual Entry
          </Button>
        )}
        <Typography variant="caption" color="textSecondary" sx={{ flexGrow: 1, textAlign: 'center' }}>
          {scanning ? '🔍 Auto-scanning...' : '📷 Position barcode in frame'}
        </Typography>
        <Button onClick={handleClose}>
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  )
}