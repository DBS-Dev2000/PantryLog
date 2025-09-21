'use client'

import { useState, useRef } from 'react'
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
  Paper,
  Card,
  CardContent,
  Tabs,
  Tab
} from '@mui/material'
import {
  Close as CloseIcon,
  CameraAlt as CameraIcon,
  CloudUpload as UploadIcon,
  AutoAwesome as AIIcon,
  MenuBook as RecipeIcon
} from '@mui/icons-material'

interface RecipePhotoScannerProps {
  open: boolean
  onClose: () => void
  onRecipeExtracted: (recipeData: any) => void
  userId?: string
}

export default function RecipePhotoScanner({
  open,
  onClose,
  onRecipeExtracted,
  userId
}: RecipePhotoScannerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const [tabValue, setTabValue] = useState(0)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleImageCapture = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      setCapturedImage(result)
      console.log('📸 Recipe image captured/uploaded')
    }
    reader.readAsDataURL(file)
  }

  const extractRecipeFromImage = async () => {
    if (!capturedImage) return

    setProcessing(true)
    setError(null)

    try {
      // Get current user ID if not provided via props
      let currentUserId = userId
      if (!currentUserId) {
        const { data: { session } } = await supabase.auth.getSession()
        currentUserId = session?.user?.id
        console.log('🔐 Retrieved user ID for recipe extraction:', currentUserId)
      }

      console.log('📷 Extracting recipe from image...')

      const response = await fetch('/api/extract-recipe-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: capturedImage,
          user_id: currentUserId,
          prompt: `Extract the complete recipe from this image. This could be:
          - A handwritten recipe card
          - A printed cookbook page
          - A recipe note or card
          - A recipe from a magazine or book

          Extract ALL visible information and return a detailed JSON object:
          {
            "title": "Recipe name from the image",
            "description": "Brief description if visible",
            "ingredients": [
              {
                "ingredient_name": "Exact ingredient name from image",
                "quantity": 2.0,
                "unit": "cups",
                "preparation": "diced, chopped, etc if specified"
              }
            ],
            "instructions": "Complete cooking instructions as written",
            "steps": [
              {
                "step_number": 1,
                "instruction": "Detailed step as written in image",
                "time_minutes": 10
              }
            ],
            "prep_time_minutes": 30,
            "cook_time_minutes": 60,
            "servings": 4,
            "difficulty": "easy|medium|hard",
            "notes": "Any additional notes or tips from the image",
            "source_notes": "Handwritten recipe card, Cookbook page, etc."
          }

          Be very careful to read ALL text in the image including:
          - Ingredient lists with quantities and measurements
          - Step-by-step cooking instructions
          - Cooking times and temperatures
          - Serving sizes and notes
          - Any handwritten additions or modifications

          Extract exactly what you see - don't add or assume information not visible in the image.`
        })
      })

      if (!response.ok) {
        throw new Error('Failed to extract recipe from image')
      }

      const extractedData = await response.json()

      if (extractedData.error) {
        throw new Error(extractedData.error)
      }

      console.log('✅ Recipe extracted from image:', extractedData.title)
      onRecipeExtracted({
        ...extractedData,
        source_type: 'photo',
        image_url: capturedImage // Use the captured image as recipe image
      })

      handleClose()

    } catch (err: any) {
      console.error('Recipe extraction error:', err)
      setError(err.message || 'Failed to extract recipe from image')
    } finally {
      setProcessing(false)
    }
  }

  const handleClose = () => {
    setCapturedImage(null)
    setProcessing(false)
    setError(null)
    setTabValue(0)
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
            <RecipeIcon />
            <Typography variant="h6">Scan Recipe from Photo</Typography>
          </Box>
          <IconButton onClick={handleClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 2 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {!capturedImage ? (
          <>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 3, textAlign: 'center' }}>
              Perfect for recipe cards, cookbook pages, handwritten notes, and magazine recipes
            </Typography>

            <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)} centered sx={{ mb: 3 }}>
              <Tab label="Take Photo" icon={<CameraIcon />} />
              <Tab label="Upload Image" icon={<UploadIcon />} />
            </Tabs>

            <Box sx={{ textAlign: 'center', py: 4 }}>
              {tabValue === 0 ? (
                <Card sx={{ p: 4, backgroundColor: 'primary.light' }}>
                  <CardContent>
                    <CameraIcon sx={{ fontSize: 64, color: 'primary.contrastText', mb: 2 }} />
                    <Typography variant="h6" sx={{ color: 'primary.contrastText', mb: 2 }}>
                      Photograph Recipe
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'primary.contrastText', mb: 3, opacity: 0.9 }}>
                      Take a photo of recipe cards, cookbook pages, or handwritten recipes
                    </Typography>
                    <Button
                      variant="contained"
                      size="large"
                      onClick={() => {
                        console.log('📷 Camera button clicked')
                        console.log('📱 Camera input ref:', cameraInputRef.current)
                        if (cameraInputRef.current) {
                          cameraInputRef.current.click()
                        } else {
                          console.error('❌ Camera input ref not available')
                        }
                      }}
                      sx={{ backgroundColor: 'white', color: 'primary.main', '&:hover': { backgroundColor: 'grey.100' } }}
                    >
                      Open Camera
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <Card sx={{ p: 4, backgroundColor: 'secondary.light' }}>
                  <CardContent>
                    <UploadIcon sx={{ fontSize: 64, color: 'secondary.contrastText', mb: 2 }} />
                    <Typography variant="h6" sx={{ color: 'secondary.contrastText', mb: 2 }}>
                      Upload Recipe Photo
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'secondary.contrastText', mb: 3, opacity: 0.9 }}>
                      Upload an existing photo of a recipe from your device
                    </Typography>
                    <Button
                      variant="contained"
                      size="large"
                      onClick={() => fileInputRef.current?.click()}
                      sx={{ backgroundColor: 'white', color: 'secondary.main', '&:hover': { backgroundColor: 'grey.100' } }}
                    >
                      Choose File
                    </Button>
                  </CardContent>
                </Card>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageCapture}
                style={{ display: 'none' }}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleImageCapture}
                style={{ display: 'none' }}
              />
            </Box>
          </>
        ) : (
          <Box>
            <Typography variant="h6" gutterBottom>
              📸 Recipe Image Captured
            </Typography>
            <Paper sx={{ p: 2, mb: 3, textAlign: 'center' }}>
              <img
                src={capturedImage}
                alt="Recipe"
                style={{
                  maxWidth: '100%',
                  maxHeight: 400,
                  borderRadius: 8,
                  border: '1px solid #ddd'
                }}
              />
            </Paper>

            {processing ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <CircularProgress size={60} sx={{ color: 'primary.main', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  📷 Extracting Recipe
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Reading ingredients, instructions, and recipe details...
                </Typography>
              </Box>
            ) : (
              <Box sx={{ textAlign: 'center' }}>
                <Button
                  variant="contained"
                  size="large"
                  onClick={extractRecipeFromImage}
                  startIcon={<AIIcon />}
                  color="primary"
                  sx={{ mb: 2 }}
                >
                  Extract Recipe with AI
                </Button>
                <Typography variant="caption" color="textSecondary" display="block">
                  AI will read the recipe and extract ingredients, instructions, and details
                </Typography>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Typography variant="caption" color="textSecondary" sx={{ flexGrow: 1 }}>
          🤖 Perfect for handwritten recipes, cookbook pages, and recipe cards
        </Typography>
        {capturedImage && !processing && (
          <Button onClick={() => setCapturedImage(null)} variant="outlined">
            Try Different Photo
          </Button>
        )}
        <Button onClick={handleClose}>
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  )
}