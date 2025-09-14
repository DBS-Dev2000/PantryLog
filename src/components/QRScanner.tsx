'use client'

import { useState, useRef, useEffect } from 'react'
import { BrowserQRCodeReader, NotFoundException } from '@zxing/library'
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
  TextField
} from '@mui/material'
import {
  Close as CloseIcon,
  CameraAlt as CameraIcon,
  QrCodeScanner as QrIcon
} from '@mui/icons-material'

interface QRScannerProps {
  open: boolean
  onClose: () => void
  onScan: (qrCode: string) => void
  title?: string
  description?: string
}

const isBrowser = typeof window !== 'undefined'

export default function QRScanner({
  open,
  onClose,
  onScan,
  title = "Scan Location QR Code",
  description = "Position the QR code in camera view for automatic scanning"
}: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [manualCode, setManualCode] = useState('')
  const [scanning, setScanning] = useState(false)
  const [showManualEntry, setShowManualEntry] = useState(false)
  const qrReaderRef = useRef<BrowserQRCodeReader | null>(null)

  useEffect(() => {
    if (open && isBrowser) {
      console.log('📱 Opening QR scanner dialog')
      startCamera()
    } else {
      stopCamera()
    }

    return () => stopCamera()
  }, [open])

  const startCamera = async () => {
    try {
      console.log('🔍 Requesting camera access for QR scanning...')
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

      console.log('✅ Camera stream obtained for QR scanning')
      setStream(mediaStream)

      // Wait for video element to be available, then assign stream
      const assignStreamToVideo = () => {
        if (videoRef.current) {
          console.log('📹 Assigning stream to QR video element')
          videoRef.current.srcObject = mediaStream

          // Add event handlers
          videoRef.current.onloadedmetadata = () => {
            console.log('📹 QR Video metadata loaded')
            setCameraActive(true)
            startQRScanning()
          }

          videoRef.current.oncanplay = () => {
            console.log('📹 QR Video can play')
            setCameraActive(true)
            startQRScanning()
          }

          videoRef.current.onerror = (e) => {
            console.error('📹 QR Video error:', e)
            setError('Video playback failed')
            setCameraActive(false)
          }

          // Force play the video
          videoRef.current.play()
            .then(() => {
              console.log('📹 QR Video play started successfully')
              setCameraActive(true)
              startQRScanning()
            })
            .catch((e) => {
              console.error('📹 QR Play error:', e)
              setError('Could not start video playback')
              setCameraActive(false)
            })
        } else {
          console.log('⏳ QR Video element not ready, retrying...')
          setTimeout(assignStreamToVideo, 100)
        }
      }

      assignStreamToVideo()

    } catch (err: any) {
      console.error('❌ QR Camera error:', err)
      if (err.name === 'NotAllowedError') {
        setError('Camera permission denied. Please allow camera access.')
      } else if (err.name === 'NotFoundError') {
        setError('No camera found on this device.')
      } else if (err.name === 'NotSupportedError') {
        setError('Camera not supported on this browser.')
      } else {
        setError(`Camera failed to start: ${err.message}`)
      }
    }
  }

  const startQRScanning = () => {
    try {
      console.log('🔍 Starting automatic QR code detection...')
      setScanning(true)

      if (!videoRef.current || qrReaderRef.current) {
        return // Already scanning or video not ready
      }

      const qrReader = new BrowserQRCodeReader()
      qrReaderRef.current = qrReader

      // Start continuous QR scanning
      qrReader.decodeFromVideoDevice(
        undefined, // Use default camera
        videoRef.current,
        (result, error) => {
          if (result) {
            console.log('✅ QR code automatically detected:', result.getText())
            onScan(result.getText())
            handleClose()
          } else if (error && !(error instanceof NotFoundException)) {
            console.log('⚠️ QR scan error (continuing):', error.message)
          }
        }
      )

      // Show manual entry option after 15 seconds if no QR detected
      setTimeout(() => {
        if (cameraActive && !showManualEntry) {
          console.log('⏰ QR Auto-scan timeout, showing manual entry option')
          setShowManualEntry(true)
        }
      }, 15000)

    } catch (err) {
      console.error('❌ Failed to start QR scanning:', err)
      setShowManualEntry(true)
    }
  }

  const stopCamera = () => {
    // Stop QR scanning
    if (qrReaderRef.current) {
      console.log('🛑 Stopping QR scanner')
      qrReaderRef.current.reset()
      qrReaderRef.current = null
    }

    // Stop camera stream
    if (stream) {
      console.log('📷 Stopping QR camera stream')
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
    setManualCode('')
    onClose()
  }

  const handleSubmit = () => {
    if (manualCode.trim()) {
      console.log('✅ Manual QR code entered:', manualCode)
      onScan(manualCode.trim())
      handleClose()
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
            <QrIcon />
            <Typography variant="h6">{title}</Typography>
          </Box>
          <IconButton onClick={handleClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column' }}>
        {error && (
          <Box sx={{ p: 2 }}>
            <Typography variant="body2" color="error">
              {error}
            </Typography>
          </Box>
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
              <QrIcon sx={{ fontSize: 48, mb: 2, color: 'grey.400' }} />
              <Typography variant="body1" sx={{ mb: 2 }}>
                Camera not available
              </Typography>
              <Typography variant="body2" sx={{ mb: 2, opacity: 0.8 }}>
                {error}
              </Typography>
            </Box>
          ) : (
            <Box sx={{ position: 'relative', flexGrow: 1 }}>
              {/* Always render video element */}
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

              {/* QR Scanning Frame Overlay */}
              {cameraActive && (
                <>
                  <Box
                    sx={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      border: scanning ? '3px solid #0088ff' : '3px solid #ffaa00',
                      width: '60%',
                      maxWidth: 200,
                      height: '60%',
                      maxHeight: 200,
                      borderRadius: 2,
                      pointerEvents: 'none',
                      boxShadow: scanning ? '0 0 15px rgba(0,136,255,0.5)' : '0 0 15px rgba(255,170,0,0.5)',
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
                      {scanning ? '🔍 Scanning for QR codes...' : '📱 Position QR code in frame'}
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

        {/* Manual Entry Section for QR codes/URLs */}
        {showManualEntry && (
          <Box sx={{ p: 2, backgroundColor: 'grey.100', borderTop: '1px solid #ddd' }}>
            <Typography variant="body2" color="textSecondary" gutterBottom>
              🔍 Auto-scan not working? Paste the QR code URL or location ID:
            </Typography>
            <Box display="flex" gap={1}>
              <TextField
                label="QR Code URL or Location ID"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="https://bite.prolongedpantry.com/inventory?location=..."
                size="small"
                sx={{ flexGrow: 1 }}
                multiline
                maxRows={2}
                autoFocus
              />
              <Button
                variant="contained"
                onClick={handleSubmit}
                disabled={!manualCode.trim()}
              >
                Use This
              </Button>
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
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
          {scanning ? '🔍 Auto-scanning QR codes...' : '📱 Position QR code in blue frame'}
        </Typography>
        <Button onClick={handleClose}>
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  )
}