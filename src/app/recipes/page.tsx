'use client'

import { useState, useEffect } from 'react'
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Button,
  Grid,
  Alert,
  Chip,
  Avatar,
  IconButton,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tabs,
  Tab,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Fab,
  CardMedia,
  CardActions,
  useTheme,
  useMediaQuery,
  Stack,
  Rating
} from '@mui/material'
import {
  Restaurant as RecipeIcon,
  Add as AddIcon,
  Link as LinkIcon,
  YouTube as YouTubeIcon,
  Web as WebIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Timer as TimerIcon,
  Group as ServingsIcon,
  Star as StarIcon,
  Inventory as InventoryIcon,
  PlayArrow as PlayIcon,
  Warning as WarningIcon,
  CameraAlt as CameraIcon
} from '@mui/icons-material'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { checkRecipeAvailability } from '@/utils/ingredientMatcher'
import RecipePhotoScanner from '@/components/RecipePhotoScanner'
import FeatureGuard from '@/components/FeatureGuard'

interface Recipe {
  id: string
  title: string
  description?: string
  category_id?: string
  category_name?: string
  prep_time_minutes?: number
  cook_time_minutes?: number
  servings: number
  difficulty: string
  source_type: string
  source_url?: string
  youtube_video_id?: string
  image_url?: string
  rating?: number
  average_rating?: number
  total_ratings?: number
  times_made: number
  is_favorite: boolean
  tags: string[]
  cuisine?: string
  availability_status?: 'can_make' | 'partial' | 'missing_ingredients'
  available_ingredients?: number
  total_ingredients?: number
}

interface RecipeCategory {
  id: string
  name: string
  icon_name: string
  color: string
}

export default function RecipesPage() {
  const router = useRouter()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))

  const [user, setUser] = useState<any>(null)
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [categories, setCategories] = useState<RecipeCategory[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [availabilityFilter, setAvailabilityFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [importDialog, setImportDialog] = useState(false)
  const [importUrl, setImportUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const [photoScannerOpen, setPhotoScannerOpen] = useState(false)

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUser(session.user)
        await loadRecipeData(session.user.id)
      } else {
        router.push('/auth')
      }
    }

    getUser()
  }, [router])

  const loadRecipeData = async (userId: string) => {
    setLoading(true)
    try {
      // Load categories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('recipe_categories')
        .select('*')
        .order('sort_order')

      if (categoriesError) throw categoriesError
      setCategories(categoriesData || [])

      // Load recipes with availability check
      const { data: recipesData, error: recipesError } = await supabase
        .from('recipes')
        .select(`
          *,
          recipe_categories(name)
        `)
        .eq('household_id', userId)
        .order('created_at', { ascending: false })

      if (recipesError) throw recipesError

      // Get inventory items for availability checking
      const { data: inventoryItems } = await supabase
        .from('inventory_items')
        .select(`
          id,
          quantity,
          unit,
          products (
            name,
            category,
            brand
          )
        `)
        .eq('household_id', userId)
        .gt('quantity', 0)

      // Transform inventory for matching
      const inventoryForMatching = inventoryItems?.map(item => ({
        id: item.id,
        name: item.products?.name || '',
        products: item.products,
        quantity: item.quantity,
        unit: item.unit
      })) || []

      // For each recipe, check ingredient availability using our intelligent matcher
      const recipesWithAvailability = await Promise.all(
        (recipesData || []).map(async (recipe) => {
          try {
            // Get recipe ingredients
            const { data: ingredients } = await supabase
              .from('recipe_ingredients')
              .select('ingredient_name, quantity, unit')
              .eq('recipe_id', recipe.id)

            if (!ingredients || ingredients.length === 0) {
              return {
                ...recipe,
                category_name: recipe.recipe_categories?.name,
                availability_status: 'missing_ingredients' as const,
                available_ingredients: 0,
                total_ingredients: 0
              }
            }

            // Check availability using our intelligent matcher
            const availabilityCheck = checkRecipeAvailability(
              ingredients.map(ing => ({
                name: ing.ingredient_name,
                quantity: ing.quantity,
                unit: ing.unit
              })),
              inventoryForMatching
            )

            let status: 'can_make' | 'partial' | 'missing_ingredients' = 'missing_ingredients'
            if (availabilityCheck.canMake) {
              status = 'can_make'
            } else if (availabilityCheck.availability > 0) {
              status = 'partial'
            }

            return {
              ...recipe,
              category_name: recipe.recipe_categories?.name,
              availability_status: status,
              available_ingredients: availabilityCheck.availableIngredients.length,
              total_ingredients: ingredients.length
            }
          } catch (err) {
            console.warn('Error checking availability for recipe:', recipe.title, err)
            return {
              ...recipe,
              category_name: recipe.recipe_categories?.name,
              availability_status: 'missing_ingredients' as const,
              available_ingredients: 0,
              total_ingredients: 0
            }
          }
        })
      )

      setRecipes(recipesWithAvailability)
      console.log('🍳 Loaded', recipesWithAvailability.length, 'recipes')

    } catch (err: any) {
      console.error('Error loading recipes:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const importRecipe = async () => {
    if (!importUrl.trim()) return

    setImporting(true)
    setError(null)

    try {
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
        throw new Error('Failed to import recipe')
      }

      const recipeData = await response.json()
      console.log('📥 Recipe imported:', recipeData.title)

      // Navigate to create/edit page with imported data
      router.push(`/recipes/create?import=${encodeURIComponent(JSON.stringify(recipeData))}`)

    } catch (err: any) {
      setError(err.message)
    } finally {
      setImporting(false)
      setImportDialog(false)
      setImportUrl('')
    }
  }

  const handlePhotoRecipeExtracted = (recipeData: any) => {
    console.log('📸 Recipe extracted from photo:', recipeData.title)
    // Navigate to create page with photo-extracted data
    router.push(`/recipes/create?import=${encodeURIComponent(JSON.stringify(recipeData))}`)
  }

  const getFilteredRecipes = () => {
    let filtered = recipes

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(recipe => recipe.category_id === selectedCategory)
    }

    if (availabilityFilter !== 'all') {
      filtered = filtered.filter(recipe => recipe.availability_status === availabilityFilter)
    }

    return filtered
  }

  const getAvailabilityColor = (status: string) => {
    switch (status) {
      case 'can_make': return 'success'
      case 'partial': return 'warning'
      case 'missing_ingredients': return 'error'
      default: return 'default'
    }
  }

  const getAvailabilityLabel = (status: string) => {
    switch (status) {
      case 'can_make': return 'Can Make Now'
      case 'partial': return 'Missing Some'
      case 'missing_ingredients': return 'Need Ingredients'
      default: return 'Unknown'
    }
  }

  if (!user || loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Typography>Loading recipes...</Typography>
      </Container>
    )
  }

  const filteredRecipes = getFilteredRecipes()

  return (
    <FeatureGuard feature="recipes_enabled">
      <Container maxWidth={isMobile ? "sm" : "lg"} sx={{ mt: 4, px: isMobile ? 2 : 3 }}>
        <Box sx={{ mb: 3 }}>
        <Box display="flex" alignItems="center" mb={2}>
          <RecipeIcon sx={{ mr: 2, fontSize: isMobile ? 28 : 32, color: 'primary.main' }} />
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant={isMobile ? "h5" : "h4"} component="h1" gutterBottom>
              Recipe Manager
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Smart recipes with inventory checking
            </Typography>
          </Box>
        </Box>

        {/* Mobile-friendly button layout */}
        {isMobile ? (
          <Stack spacing={1}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => router.push('/recipes/create')}
              color="primary"
              fullWidth
              size="large"
            >
              Create Recipe
            </Button>
            <Box display="flex" gap={1}>
              <Button
                variant="outlined"
                startIcon={<CameraIcon />}
                onClick={() => setPhotoScannerOpen(true)}
                color="info"
                size="small"
                sx={{ flex: 1 }}
              >
                Scan
              </Button>
              <Button
                variant="outlined"
                startIcon={<LinkIcon />}
                onClick={() => setImportDialog(true)}
                color="secondary"
                size="small"
                sx={{ flex: 1 }}
              >
                Import
              </Button>
            </Box>
          </Stack>
        ) : (
          <Box display="flex" gap={1}>
            <Button
              variant="outlined"
              startIcon={<CameraIcon />}
              onClick={() => setPhotoScannerOpen(true)}
              color="info"
            >
              Scan Recipe
            </Button>
            <Button
              variant="outlined"
              startIcon={<LinkIcon />}
              onClick={() => setImportDialog(true)}
              color="secondary"
            >
              Import URL
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => router.push('/recipes/create')}
              color="primary"
            >
              Create Recipe
            </Button>
          </Box>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* Filter Controls */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ py: isMobile ? 2 : 3 }}>
          <Typography variant="h6" gutterBottom sx={{ fontSize: isMobile ? '1rem' : '1.25rem' }}>
            🔍 Filter Recipes
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size={isMobile ? "medium" : "small"}>
                <InputLabel>Category</InputLabel>
                <Select
                  value={selectedCategory}
                  label="Category"
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  <MenuItem value="all">All Categories</MenuItem>
                  {categories.map((cat) => (
                    <MenuItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size={isMobile ? "medium" : "small"}>
                <InputLabel>Availability</InputLabel>
                <Select
                  value={availabilityFilter}
                  label="Availability"
                  onChange={(e) => setAvailabilityFilter(e.target.value)}
                >
                  <MenuItem value="all">All Recipes</MenuItem>
                  <MenuItem value="can_make">Can Make Now</MenuItem>
                  <MenuItem value="partial">Missing Some Ingredients</MenuItem>
                  <MenuItem value="missing_ingredients">Need Ingredients</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Recipes Grid */}
      {filteredRecipes.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <RecipeIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="textSecondary" gutterBottom>
              No recipes found
            </Typography>
            <Typography variant="body2" color="textSecondary" paragraph>
              {recipes.length === 0
                ? 'Start by creating a recipe or importing from YouTube/recipe websites'
                : 'Try adjusting your filters to see more recipes'
              }
            </Typography>
            <Box display="flex" gap={2} justifyContent="center">
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => router.push('/recipes/create')}
                color="primary"
              >
                Create Recipe
              </Button>
              <Button
                variant="outlined"
                startIcon={<LinkIcon />}
                onClick={() => setImportDialog(true)}
                color="secondary"
              >
                Import Recipe
              </Button>
            </Box>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {filteredRecipes.map((recipe) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={recipe.id}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: { xs: 'auto', sm: 400 }
                }}>
                {recipe.image_url && (
                  <CardMedia
                    component="img"
                    height={isMobile ? "160" : "200"}
                    image={recipe.image_url.replace('http://', 'https://')}
                    alt={recipe.title}
                    sx={{ objectFit: 'cover' }}
                    onError={(e: any) => {
                      const target = e.currentTarget
                      const originalSrc = recipe.image_url

                      // If already tried HTTPS, show placeholder
                      if (target.src.startsWith('https://')) {
                        console.log('⚠️ Recipe image failed to load:', originalSrc)
                        target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200"%3E%3Crect width="400" height="200" fill="%23f5f5f5"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="%23999"%3ENo Image%3C/text%3E%3C/svg%3E'
                      }
                    }}
                  />
                )}

                <CardContent sx={{ flexGrow: 1, p: isMobile ? 2 : 3 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                    <Typography
                      variant={isMobile ? "body1" : "h6"}
                      component="h2"
                      sx={{
                        fontWeight: 'medium',
                        fontSize: isMobile ? '1rem' : '1.25rem',
                        lineHeight: 1.3
                      }}
                    >
                      {recipe.title}
                    </Typography>
                    {recipe.is_favorite && (
                      <StarIcon sx={{ color: 'warning.main', ml: 1, fontSize: isMobile ? 20 : 24 }} />
                    )}
                  </Box>

                  <Box display="flex" gap={1} mb={2} flexWrap="wrap">
                    <Chip
                      size="small"
                      label={getAvailabilityLabel(recipe.availability_status || 'missing_ingredients')}
                      color={getAvailabilityColor(recipe.availability_status || 'missing_ingredients') as any}
                    />
                    {recipe.category_name && (
                      <Chip size="small" label={recipe.category_name} variant="outlined" />
                    )}
                    {recipe.source_type === 'youtube' && (
                      <Chip size="small" icon={<YouTubeIcon />} label="YouTube" color="error" variant="outlined" />
                    )}
                  </Box>

                  <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                    {recipe.description || 'No description available'}
                  </Typography>

                  <Box display="flex" gap={2} mb={2} flexWrap="wrap">
                    {recipe.prep_time_minutes && (
                      <Box display="flex" alignItems="center" gap={0.5}>
                        <TimerIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                        <Typography variant="caption">
                          {recipe.prep_time_minutes + (recipe.cook_time_minutes || 0)} min
                        </Typography>
                      </Box>
                    )}
                    <Box display="flex" alignItems="center" gap={0.5}>
                      <ServingsIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                      <Typography variant="caption">
                        {recipe.servings} servings
                      </Typography>
                    </Box>
                    <Box display="flex" alignItems="center" gap={0.5}>
                      <InventoryIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                      <Typography variant="caption">
                        {recipe.available_ingredients}/{recipe.total_ingredients} ingredients
                      </Typography>
                    </Box>
                  </Box>

                  {/* Rating Display */}
                  {(recipe.average_rating || recipe.total_ratings) && (
                    <Box display="flex" alignItems="center" gap={1} mb={2}>
                      <Rating
                        value={recipe.average_rating || 0}
                        readOnly
                        size="small"
                        precision={0.1}
                      />
                      <Typography variant="caption" color="text.secondary">
                        {(recipe.average_rating || 0).toFixed(1)} ({recipe.total_ratings || 0})
                      </Typography>
                    </Box>
                  )}

                  {recipe.tags && recipe.tags.length > 0 && (
                    <Box display="flex" gap={0.5} flexWrap="wrap">
                      {recipe.tags.slice(0, 3).map((tag, index) => (
                        <Chip key={index} size="small" label={tag} variant="outlined" sx={{ fontSize: '0.7rem' }} />
                      ))}
                      {recipe.tags.length > 3 && (
                        <Typography variant="caption" color="textSecondary">
                          +{recipe.tags.length - 3} more
                        </Typography>
                      )}
                    </Box>
                  )}
                </CardContent>

                <CardActions>
                  <Button
                    size="small"
                    onClick={() => router.push(`/recipes/${recipe.id}`)}
                    color="primary"
                  >
                    View Recipe
                  </Button>
                  {recipe.source_type === 'youtube' && recipe.youtube_video_id && (
                    <Button
                      size="small"
                      startIcon={<PlayIcon />}
                      onClick={() => window.open(`https://youtube.com/watch?v=${recipe.youtube_video_id}`, '_blank')}
                      color="error"
                    >
                      Watch
                    </Button>
                  )}
                  {recipe.availability_status === 'can_make' && (
                    <Button
                      size="small"
                      variant="contained"
                      color="success"
                      onClick={() => router.push(`/recipes/${recipe.id}/make`)}
                    >
                      Make This
                    </Button>
                  )}
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Import Recipe Dialog */}
      <Dialog open={importDialog} onClose={() => setImportDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Import Recipe from URL
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            Import recipes from YouTube videos or popular recipe websites
          </Typography>

          <TextField
            label="Recipe URL"
            fullWidth
            value={importUrl}
            onChange={(e) => setImportUrl(e.target.value)}
            placeholder="https://youtube.com/watch?v=... or https://allrecipes.com/..."
            sx={{ mb: 2 }}
          />

          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="textSecondary" gutterBottom>
              Supported sources:
            </Typography>
            <Box display="flex" gap={1} flexWrap="wrap">
              <Chip size="small" icon={<YouTubeIcon />} label="YouTube" color="error" variant="outlined" />
              <Chip size="small" label="AllRecipes" variant="outlined" />
              <Chip size="small" label="Food Network" variant="outlined" />
              <Chip size="small" label="Tasty" variant="outlined" />
              <Chip size="small" label="Any Recipe Site" variant="outlined" />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportDialog(false)}>Cancel</Button>
          <Button
            onClick={importRecipe}
            variant="contained"
            disabled={!importUrl.trim() || importing}
            startIcon={importing ? <InventoryIcon /> : <LinkIcon />}
            color="secondary"
          >
            {importing ? 'Importing...' : 'Import Recipe'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Recipe Photo Scanner Dialog */}
      <RecipePhotoScanner
        open={photoScannerOpen}
        onClose={() => setPhotoScannerOpen(false)}
        onRecipeExtracted={handlePhotoRecipeExtracted}
        userId={user?.id}
      />

      {/* Floating Action Button */}
      <Fab
        color="primary"
        aria-label="add recipe"
        sx={{
          position: 'fixed',
          bottom: 16,
          right: 16
        }}
        onClick={() => router.push('/recipes/create')}
      >
        <AddIcon />
      </Fab>
      </Container>
    </FeatureGuard>
  )
}