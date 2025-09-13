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
// Dynamic import for client-side only
const BarcodeScannerComponent = dynamic(
  () => import('react-qr-barcode-scanner').then(mod => mod.BarcodeScannerComponent),
  {
    ssr: false,
    loading: () => <CircularProgress />
  }
)

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
  const [error, setError] = useState<string | null>(null)
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)

  useEffect(() => {
    if (open) {
      // Check camera permission when opening
      navigator.permissions.query({ name: 'camera' as PermissionName })
        .then(permission => {
          setHasPermission(permission.state === 'granted')
        })
        .catch(() => setHasPermission(null))
    }
  }, [open])

  const handleScan = (result: string) => {
    console.log('✅ Barcode scanned:', result)
    onScan(result)
    onClose()
  }

  const handleError = (error: any) => {
    console.error('Barcode scan error:', error)
    if (error?.name === 'NotAllowedError') {
      setError('Camera permission denied. Please allow camera access in your browser settings.')
    } else if (error?.name === 'NotFoundError') {
      setError('No camera found on this device.')
    } else {
      setError('Camera scanning failed. Please try again or enter the barcode manually.')
    }
  }

  const handleClose = () => {
    setError(null)
    onClose()
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
          {open && (
            <Suspense fallback={<CircularProgress sx={{ color: 'white' }} />}>
              <BarcodeScannerComponent
                width="100%"
                height="100%"
                onUpdate={(err: any, result: any) => {
                  try {
                    if (result) {
                      handleScan(result.getText())
                    } else if (err && err.name !== 'NotFoundException') {
                      handleError(err)
                    }
                  } catch (error) {
                    console.error('Scanner update error:', error)
                    handleError(error)
                  }
                }}
                facingMode="environment"
                torch={false}
              />
            </Suspense>
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
          Point camera at barcode and it will scan automatically
        </Typography>
        <Button onClick={handleClose}>
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  )
}