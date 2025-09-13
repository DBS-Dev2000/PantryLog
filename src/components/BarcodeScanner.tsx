'use client'

import { useState, useRef, useEffect, Suspense } from 'react'
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
  CircularProgress
} from '@mui/material'
import {
  Close as CloseIcon,
  CameraAlt as CameraIcon,
  FlashOn as FlashOnIcon,
  FlashOff as FlashOffIcon,
  FlipCameraAndroid as FlipCameraIcon
} from '@mui/icons-material'
// Use a simpler approach for production compatibility
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
  title = "Scan Barcode",
  description = "Position the barcode within the camera view"
}: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)

  useEffect(() => {
    if (open && isBrowser) {
      startCamera()
    } else {
      stopCamera()
    }

    return () => stopCamera()
  }, [open])

  const startCamera = async () => {
    try {
      setError(null)
      setScanning(true)

      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment', // Use back camera
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        })

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream
        }

        setStream(mediaStream)
        setScanning(false)
      } else {
        throw new Error('Camera not supported on this device')
      }
    } catch (err: any) {
      console.error('Camera error:', err)
      if (err.name === 'NotAllowedError') {
        setError('Camera permission denied. Please allow camera access.')
      } else if (err.name === 'NotFoundError') {
        setError('No camera found on this device.')
      } else {
        setError('Failed to start camera. Please try manual entry.')
      }
      setScanning(false)
    }
  }

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }

  const handleClose = () => {
    stopCamera()
    setError(null)
    onClose()
  }

  const handleManualEntry = () => {
    const barcode = prompt('Enter barcode manually:')
    if (barcode) {
      onScan(barcode)
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

        {/* Camera Scanner */}
        <Box
          sx={{
            flexGrow: 1,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'black',
            position: 'relative',
            minHeight: 300
          }}
        >
          {scanning ? (
            <Box sx={{ textAlign: 'center', color: 'white' }}>
              <CircularProgress sx={{ color: 'white', mb: 2 }} />
              <Typography>Starting camera...</Typography>
            </Box>
          ) : error ? (
            <Box sx={{ textAlign: 'center', color: 'white', p: 3 }}>
              <Typography variant="body1" sx={{ mb: 2 }}>
                Camera not available
              </Typography>
              <Button
                variant="contained"
                onClick={handleManualEntry}
                color="primary"
              >
                Enter Barcode Manually
              </Button>
            </Box>
          ) : (
            <>
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

              {/* Manual Entry Overlay */}
              <Box
                sx={{
                  position: 'absolute',
                  top: 16,
                  right: 16
                }}
              >
                <Button
                  variant="contained"
                  size="small"
                  onClick={handleManualEntry}
                  sx={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
                >
                  Manual Entry
                </Button>
              </Box>
            </>
          )}

          {/* Scanning Overlay */}
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              border: '3px solid #00ff00',
              width: '80%',
              maxWidth: 300,
              height: '30%',
              borderRadius: 2,
              pointerEvents: 'none',
              boxShadow: '0 0 20px rgba(0,255,0,0.5)',
              animation: 'pulse 2s infinite'
            }}
          />

          {/* Instructions Overlay */}
          <Box
            sx={{
              position: 'absolute',
              top: 16,
              left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: 'rgba(0,0,0,0.7)',
              color: 'white',
              px: 2,
              py: 1,
              borderRadius: 1,
              textAlign: 'center'
            }}
          >
            <Typography variant="body2">
              Align barcode within the green box
            </Typography>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions>
        <Typography variant="caption" color="textSecondary" sx={{ flexGrow: 1 }}>
          Camera view for barcode positioning - Use manual entry button to input barcode
        </Typography>
        <Button onClick={handleManualEntry} variant="outlined">
          Manual Entry
        </Button>
        <Button onClick={handleClose}>
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  )
}