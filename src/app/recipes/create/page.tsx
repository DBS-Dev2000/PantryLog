'use client'

import { useState, useEffect, Suspense } from 'react'
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Button,
  TextField,
  Grid,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Backdrop,
  CircularProgress,
  Paper,
  useTheme,
  useMediaQuery
} from '@mui/material'
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Restaurant as RecipeIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Link as LinkIcon,
  Download as ImportIcon
} from '@mui/icons-material'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface RecipeIngredient {
  ingredient_name: string
  quantity: number
  unit: string
  preparation: string
}

interface RecipeStep {
  step_number: number
  instruction: string
  time_minutes: number
}

function CreateRecipePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const [user, setUser] = useState<any>(null)
  const [categories, setCategories] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [importUrl, setImportUrl] = useState('')
  const [importing, setImporting] = useState(false)

  const [recipe, setRecipe] = useState({
    title: '',
    description: '',
    category_id: '',
    prep_time_minutes: 30,
    cook_time_minutes: 60,
    total_time_minutes: 90,
    servings: 4,
    difficulty: 'medium',
    instructions: '',
    cuisine: '',
    tags: [] as string[],
    image_url: '',
    thumbnail_url: '',
    video_url: '',
    source_type: 'manual',
    source_url: '',
    source_title: '',
    youtube_video_id: '',
    website_domain: '',
    calories_per_serving: 0,
    protein_grams: 0,
    carbs_grams: 0,
    fat_grams: 0,
    rating: 0,
    is_favorite: false
  })

  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([
    { ingredient_name: '', quantity: 1, unit: 'cup', preparation: '' }
  ])

  const [steps, setSteps] = useState<RecipeStep[]>([
    { step_number: 1, instruction: '', time_minutes: 0 }
  ])

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUser(session.user)
        await loadCategories()

        // Check if importing from URL
        const importData = searchParams.get('import')
        if (importData) {
          try {
            const imported = JSON.parse(decodeURIComponent(importData))
            populateFromImport(imported)
          } catch (err) {
            console.error('Error parsing import data:', err)
          }
        }
      } else {
        router.push('/auth')
      }
    }

    getUser()
  }, [router, searchParams])

  const loadCategories = async () => {
    try {
      const { data: categoriesData, error } = await supabase
        .from('recipe_categories')
        .select('*')
        .order('sort_order')

      if (error) throw error
      setCategories(categoriesData || [])
    } catch (err: any) {
      console.error('Error loading categories:', err)
    }
  }

  const populateFromImport = (importedData: any) => {
    console.log('🔄 Populating form with imported data...')

    setRecipe({
      title: importedData.title || '',
      description: importedData.description || '',
      category_id: '',
      prep_time_minutes: importedData.prep_time_minutes || 30,
      cook_time_minutes: importedData.cook_time_minutes || 60,
      total_time_minutes: (importedData.prep_time_minutes || 30) + (importedData.cook_time_minutes || 60),
      servings: importedData.servings || 4,
      difficulty: importedData.difficulty || 'medium',
      instructions: importedData.instructions || '',
      cuisine: importedData.cuisine || '',
      tags: importedData.tags || [],
      image_url: importedData.image_url || '',
      thumbnail_url: importedData.thumbnail_url || '',
      video_url: importedData.video_url || '',
      source_type: importedData.source_type || 'imported',
      source_url: importUrl,
      source_title: importedData.title || '',
      youtube_video_id: importedData.youtube_video_id || '',
      website_domain: importedData.website_domain || '',
      calories_per_serving: importedData.calories_per_serving || 0,
      protein_grams: importedData.nutrition?.protein_grams || 0,
      carbs_grams: importedData.nutrition?.carbs_grams || 0,
      fat_grams: importedData.nutrition?.fat_grams || 0,
      rating: 0,
      is_favorite: false
    })

    console.log('📋 Setting recipe data:', {
      title: importedData.title,
      description: importedData.description,
      instructions: importedData.instructions?.substring(0, 100) + '...'
    })

    if (importedData.ingredients && importedData.ingredients.length > 0) {
      console.log('🥕 Setting ingredients:', importedData.ingredients.length, 'items')
      setIngredients(importedData.ingredients)
    } else {
      console.warn('❌ No ingredients found in imported data')
    }

    if (importedData.steps && importedData.steps.length > 0) {
      console.log('📊 Setting steps:', importedData.steps.length, 'steps')
      setSteps(importedData.steps)
    } else if (importedData.instructions) {
      console.log('📝 Parsing steps from instructions text')
      // Parse steps from instructions text if steps not provided
      parseStepsFromInstructions(importedData.instructions)
    } else {
      console.warn('❌ No instructions or steps found in imported data')
    }

    // Clear import URL after successful import
    setImportUrl('')
    console.log('✅ Form population complete')
  }

  const parseStepsFromInstructions = (instructionsText: string) => {
    // Extract numbered steps from instruction text
    const stepMatches = instructionsText.match(/(?:^|\n)\s*(?:Step\s*)?(\d+)[\.\):\-\s]+([^\n]+)/gi)

    if (stepMatches && stepMatches.length > 0) {
      const parsedSteps = stepMatches.map((match, index) => {
        const cleanStep = match.replace(/(?:^|\n)\s*(?:Step\s*)?\d+[\.\):\-\s]+/, '').trim()
        return {
          step_number: index + 1,
          instruction: cleanStep,
          time_minutes: 0
        }
      })

      setSteps(parsedSteps)
      console.log('📋 Parsed', parsedSteps.length, 'steps from instructions')
    }
  }

  const importFromUrl = async () => {
    if (!importUrl.trim()) return

    setImporting(true)
    setError(null)

    try {
      console.log('📥 Importing recipe from URL:', importUrl)

      const response = await fetch('/api/import-recipe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: importUrl,
          user_id: user?.id
        })
      })

      if (!response.ok) {
        throw new Error('Failed to import recipe from URL')
      }

      const importedData = await response.json()

      console.log('📥 Raw imported data:', importedData)
      console.log('📋 Title:', importedData.title)
      console.log('🥕 Ingredients:', importedData.ingredients?.length || 0)
      console.log('👨‍🍳 Instructions:', importedData.instructions?.length || 0)
      console.log('📊 Steps:', importedData.steps?.length || 0)

      // Check for errors in the response
      if (importedData.error) {
        throw new Error(importedData.error)
      }

      // Populate form with imported data
      populateFromImport(importedData)

      console.log('✅ Recipe imported successfully:', importedData.title || 'No title')

    } catch (err: any) {
      console.error('Recipe import error:', err)
      setError(err.message)
    } finally {
      setImporting(false)
    }
  }

  const addIngredient = () => {
    setIngredients([...ingredients, { ingredient_name: '', quantity: 1, unit: 'cup', preparation: '' }])
  }

  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index))
  }

  const updateIngredient = (index: number, field: keyof RecipeIngredient, value: any) => {
    const updated = [...ingredients]
    updated[index] = { ...updated[index], [field]: value }
    setIngredients(updated)
  }

  const addStep = () => {
    setSteps([...steps, { step_number: steps.length + 1, instruction: '', time_minutes: 0 }])
  }

  const removeStep = (index: number) => {
    const updated = steps.filter((_, i) => i !== index)
    setSteps(updated.map((step, i) => ({ ...step, step_number: i + 1 })))
  }

  const updateStep = (index: number, field: keyof RecipeStep, value: any) => {
    const updated = [...steps]
    updated[index] = { ...updated[index], [field]: value }
    setSteps(updated)
  }

  const extractYouTubeId = (url: string): string | null => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/)
    return match?.[1] || null
  }

  const saveRecipe = async () => {
    if (!user || !recipe.title.trim()) {
      setError('Recipe title is required')
      return
    }

    setSaving(true)
    setError(null)

    try {
      // Determine source info
      const isImported = Boolean(importUrl || searchParams.get('import'))
      const sourceType = importUrl.includes('youtube') ? 'youtube' :
                        importUrl.includes('allrecipes') || importUrl.includes('foodnetwork') ? 'website' :
                        isImported ? 'imported' : 'manual'

      // Create recipe with all required fields
      const { data: newRecipe, error: recipeError } = await supabase
        .from('recipes')
        .insert([{
          household_id: user.id,
          name: recipe.title, // Use name column for recipe title
          title: recipe.title,
          description: recipe.description || 'No description provided',
          category_id: recipe.category_id || null,
          instructions: recipe.instructions || 'No instructions provided',
          prep_time_minutes: recipe.prep_time_minutes || 30,
          cook_time_minutes: recipe.cook_time_minutes || 60,
          total_time_minutes: recipe.total_time_minutes || (recipe.prep_time_minutes + recipe.cook_time_minutes),
          servings: recipe.servings || 4,
          difficulty: recipe.difficulty || 'medium',
          source_type: recipe.source_type || sourceType,
          source_url: recipe.source_url || importUrl || null,
          source_title: recipe.source_title || recipe.title,
          youtube_video_id: recipe.youtube_video_id || (sourceType === 'youtube' ? extractYouTubeId(importUrl) : null),
          website_domain: recipe.website_domain || (sourceType === 'website' && importUrl ? new URL(importUrl).hostname : null),
          calories_per_serving: recipe.calories_per_serving || null,
          protein_grams: recipe.protein_grams || null,
          carbs_grams: recipe.carbs_grams || null,
          fat_grams: recipe.fat_grams || null,
          image_url: recipe.image_url || null,
          thumbnail_url: recipe.thumbnail_url || null,
          video_url: recipe.video_url || null,
          is_favorite: recipe.is_favorite || false,
          rating: recipe.rating || null,
          tags: recipe.tags || [],
          cuisine: recipe.cuisine || null,
          created_by: user.id
        }])
        .select()
        .single()

      if (recipeError) throw recipeError

      // Add ingredients
      if (ingredients.some(ing => ing.ingredient_name.trim())) {
        const ingredientData = ingredients
          .filter(ing => ing.ingredient_name.trim())
          .map((ing, index) => ({
            recipe_id: newRecipe.id,
            ingredient_name: ing.ingredient_name,
            quantity: ing.quantity,
            unit: ing.unit,
            preparation: ing.preparation,
            sort_order: index
          }))

        const { error: ingredientsError } = await supabase
          .from('recipe_ingredients')
          .insert(ingredientData)

        if (ingredientsError) throw ingredientsError
      }

      // Add cooking steps
      if (steps.some(step => step.instruction.trim())) {
        const stepData = steps
          .filter(step => step.instruction.trim())
          .map((step) => ({
            recipe_id: newRecipe.id,
            step_number: step.step_number,
            instruction: step.instruction,
            time_minutes: step.time_minutes
          }))

        const { error: stepsError } = await supabase
          .from('recipe_cooking_steps')
          .insert(stepData)

        if (stepsError) throw stepsError
      }

      console.log('✅ Recipe created successfully:', recipe.title)
      router.push('/recipes')

    } catch (err: any) {
      console.error('Error saving recipe:', err)
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!user) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Typography>Loading...</Typography>
      </Container>
    )
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      {/* Mobile-Responsive Header */}
      <Box mb={4}>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <IconButton onClick={() => router.back()} sx={{ flexShrink: 0 }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography
            variant={isMobile ? "h5" : "h4"}
            component="h1"
            sx={{ flex: 1 }}
          >
            Create Recipe
          </Typography>
        </Box>
        {!isMobile && (
          <Typography variant="body1" color="textSecondary" sx={{ ml: 6 }}>
            Add a new recipe to your PantryIQ collection
          </Typography>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* URL Import Section */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            🔗 Import from URL
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            Import recipe from YouTube, AllRecipes, Food Network, or any recipe website
          </Typography>

          <Box display="flex" gap={1} alignItems="flex-start" flexDirection={isMobile ? 'column' : 'row'}>
            <TextField
              label="Recipe URL"
              fullWidth
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              placeholder={isMobile ? "Paste recipe URL" : "https://youtube.com/watch?v=... or https://allrecipes.com/..."}
              size="small"
            />
            <Button
              variant="contained"
              onClick={importFromUrl}
              disabled={!importUrl.trim() || importing}
              startIcon={importing ? <ImportIcon /> : <LinkIcon />}
              color="secondary"
              fullWidth={isMobile}
              sx={{ minWidth: isMobile ? 'auto' : 120 }}
            >
              {importing ? 'Importing...' : 'Import'}
            </Button>
          </Box>

          <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
            Supports: YouTube, AllRecipes, Food Network, Tasty, and most recipe websites
          </Typography>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Grid container spacing={3}>
            {/* Basic Recipe Info */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                📝 Recipe Details
              </Typography>
            </Grid>

            <Grid item xs={12} sm={8}>
              <TextField
                label="Recipe Title"
                fullWidth
                value={recipe.title}
                onChange={(e) => setRecipe({ ...recipe, title: e.target.value })}
                placeholder="e.g., Chicken Alfredo Pasta"
                required
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select
                  value={recipe.category_id}
                  label="Category"
                  onChange={(e) => setRecipe({ ...recipe, category_id: e.target.value })}
                >
                  {categories.map((cat) => (
                    <MenuItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="Description"
                fullWidth
                multiline
                rows={2}
                value={recipe.description}
                onChange={(e) => setRecipe({ ...recipe, description: e.target.value })}
                placeholder="Brief description of the recipe"
              />
            </Grid>

            {/* Source URL Display */}
            {recipe.source_url && (
              <Grid item xs={12}>
                <Card sx={{ backgroundColor: 'info.light', p: 2 }}>
                  <Typography variant="body2" sx={{ color: 'info.contrastText', mb: 1 }}>
                    📋 Imported from:
                  </Typography>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="body2" sx={{ color: 'info.contrastText', flexGrow: 1 }}>
                      {recipe.source_url}
                    </Typography>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => window.open(recipe.source_url, '_blank')}
                      sx={{ color: 'info.contrastText', borderColor: 'info.contrastText' }}
                    >
                      View Original
                    </Button>
                  </Box>
                </Card>
              </Grid>
            )}

            <Grid item xs={6} sm={3}>
              <TextField
                label="Prep Time (min)"
                type="number"
                fullWidth
                value={recipe.prep_time_minutes}
                onChange={(e) => setRecipe({ ...recipe, prep_time_minutes: parseInt(e.target.value) || 0 })}
              />
            </Grid>

            <Grid item xs={6} sm={3}>
              <TextField
                label="Cook Time (min)"
                type="number"
                fullWidth
                value={recipe.cook_time_minutes}
                onChange={(e) => setRecipe({ ...recipe, cook_time_minutes: parseInt(e.target.value) || 0 })}
              />
            </Grid>

            <Grid item xs={6} sm={3}>
              <TextField
                label="Servings"
                type="number"
                fullWidth
                value={recipe.servings}
                onChange={(e) => setRecipe({ ...recipe, servings: parseInt(e.target.value) || 1 })}
              />
            </Grid>

            <Grid item xs={6} sm={3}>
              <FormControl fullWidth>
                <InputLabel>Difficulty</InputLabel>
                <Select
                  value={recipe.difficulty}
                  label="Difficulty"
                  onChange={(e) => setRecipe({ ...recipe, difficulty: e.target.value })}
                >
                  <MenuItem value="easy">Easy</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="hard">Hard</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Ingredients Section */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                🥕 Ingredients
              </Typography>
            </Grid>

            {ingredients.map((ingredient, index) => (
              <Grid item xs={12} key={index}>
                <Box display="flex" gap={1} alignItems="center">
                  <TextField
                    label="Ingredient"
                    value={ingredient.ingredient_name}
                    onChange={(e) => updateIngredient(index, 'ingredient_name', e.target.value)}
                    sx={{ flexGrow: 1 }}
                    placeholder="e.g., Chicken breast"
                  />
                  <TextField
                    label="Qty"
                    type="number"
                    value={ingredient.quantity}
                    onChange={(e) => updateIngredient(index, 'quantity', parseFloat(e.target.value) || 0)}
                    sx={{ width: 80 }}
                  />
                  <TextField
                    label="Unit"
                    value={ingredient.unit}
                    onChange={(e) => updateIngredient(index, 'unit', e.target.value)}
                    sx={{ width: 100 }}
                    placeholder="cups"
                  />
                  <TextField
                    label="Prep"
                    value={ingredient.preparation}
                    onChange={(e) => updateIngredient(index, 'preparation', e.target.value)}
                    sx={{ width: 120 }}
                    placeholder="diced"
                  />
                  <IconButton
                    onClick={() => removeIngredient(index)}
                    color="error"
                    disabled={ingredients.length === 1}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Box>
              </Grid>
            ))}

            <Grid item xs={12}>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={addIngredient}
                size="small"
              >
                Add Ingredient
              </Button>
            </Grid>

            {/* Instructions */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                👨‍🍳 Instructions
              </Typography>
              <TextField
                label="Cooking Instructions"
                fullWidth
                multiline
                rows={6}
                value={recipe.instructions}
                onChange={(e) => setRecipe({ ...recipe, instructions: e.target.value })}
                placeholder="Enter detailed cooking instructions..."
                required
              />
            </Grid>

            {/* Save Button */}
            <Grid item xs={12}>
              <Box display="flex" gap={2} justifyContent="flex-end" sx={{ mt: 3 }}>
                <Button
                  variant="outlined"
                  onClick={() => router.back()}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  onClick={saveRecipe}
                  disabled={saving || !recipe.title.trim()}
                  startIcon={<SaveIcon />}
                  color="primary"
                >
                  {saving ? 'Saving...' : 'Save Recipe'}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Recipe Import Loading Overlay */}
      <Backdrop
        open={importing}
        sx={{
          color: '#fff',
          zIndex: (theme) => theme.zIndex.drawer + 1,
          backgroundColor: 'rgba(135, 169, 107, 0.8)' // Sage green with transparency
        }}
      >
        <Paper
          sx={{
            p: 4,
            textAlign: 'center',
            backgroundColor: 'white',
            borderRadius: 2,
            boxShadow: 3,
            minWidth: 300
          }}
        >
          <CircularProgress
            size={60}
            sx={{ color: 'primary.main', mb: 2 }}
          />
          <Typography variant="h6" gutterBottom sx={{ color: 'primary.main' }}>
            📥 Importing Recipe
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            Analyzing the webpage and extracting:
          </Typography>
          <Box display="flex" flexDirection="column" gap={0.5}>
            <Typography variant="caption" color="primary.main">
              ✓ Recipe title and details
            </Typography>
            <Typography variant="caption" color="primary.main">
              ✓ Ingredients list with quantities
            </Typography>
            <Typography variant="caption" color="primary.main">
              ✓ Cooking instructions and steps
            </Typography>
            <Typography variant="caption" color="primary.main">
              ✓ Nutrition and timing information
            </Typography>
          </Box>
          <Typography variant="caption" color="textSecondary" sx={{ mt: 2, display: 'block' }}>
            This may take 10-15 seconds...
          </Typography>
        </Paper>
      </Backdrop>
    </Container>
  )
}

export default function CreateRecipePage() {
  return (
    <Suspense fallback={
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
          <CircularProgress />
        </Box>
      </Container>
    }>
      <CreateRecipePageContent />
    </Suspense>
  )
}