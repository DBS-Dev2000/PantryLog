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
  List,
  ListItem,
  ListItemText,
  Divider,
  Paper,
  IconButton
} from '@mui/material'
import {
  ArrowBack as ArrowBackIcon,
  Timer as TimerIcon,
  Group as ServingsIcon,
  Star as StarIcon,
  PlayArrow as PlayIcon,
  Link as LinkIcon,
  Check as CheckIcon,
  Warning as WarningIcon,
  Close as CloseIcon
} from '@mui/icons-material'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface RecipeDetail {
  id: string
  name: string
  title: string
  description?: string
  instructions: string
  prep_time_minutes?: number
  cook_time_minutes?: number
  servings: number
  difficulty: string
  source_url?: string
  source_type: string
  youtube_video_id?: string
  image_url?: string
  cuisine?: string
  tags?: string[]
  rating?: number
  is_favorite: boolean
  times_made: number
  recipe_categories?: {
    name: string
    color: string
  }
}

interface Ingredient {
  ingredient_name: string
  quantity: number
  unit: string
  preparation?: string
  availability_status: string
  available_quantity?: number
}

export default function RecipeDetailPage() {
  const router = useRouter()
  const params = useParams()
  const recipeId = params.id as string

  const [user, setUser] = useState<any>(null)
  const [recipe, setRecipe] = useState<RecipeDetail | null>(null)
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
  }, [router, recipeId])

  const loadRecipeData = async (userId: string) => {
    setLoading(true)
    try {
      // Load recipe details
      const { data: recipeData, error: recipeError } = await supabase
        .from('recipes')
        .select(`
          *,
          recipe_categories(name, color)
        `)
        .eq('id', recipeId)
        .eq('household_id', userId)
        .single()

      if (recipeError) throw recipeError

      setRecipe(recipeData as RecipeDetail)

      // Load ingredients with availability check
      const { data: availabilityData, error: availabilityError } = await supabase
        .rpc('check_recipe_availability', {
          p_recipe_id: recipeId,
          p_household_id: userId
        })

      if (availabilityError && availabilityError.code !== 'PGRST116') {
        console.warn('Availability check failed:', availabilityError)
        // Load ingredients without availability if function doesn't exist
        const { data: ingredientsData } = await supabase
          .from('recipe_ingredients')
          .select('*')
          .eq('recipe_id', recipeId)
          .order('sort_order')

        setIngredients((ingredientsData || []).map(ing => ({
          ...ing,
          availability_status: 'unknown'
        })))
      } else {
        setIngredients(availabilityData || [])
      }

      console.log('🍳 Recipe loaded:', recipeData.name || recipeData.title)

    } catch (err: any) {
      console.error('Error loading recipe:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const getAvailabilityColor = (status: string) => {
    switch (status) {
      case 'available': return 'success'
      case 'partial': return 'warning'
      case 'missing': return 'error'
      default: return 'default'
    }
  }

  const getAvailabilityIcon = (status: string) => {
    switch (status) {
      case 'available': return <CheckIcon />
      case 'partial': return <WarningIcon />
      case 'missing': return <CloseIcon />
      default: return null
    }
  }

  const canMakeRecipe = () => {
    return ingredients.every(ing => ing.availability_status === 'available')
  }

  if (!user || loading) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Typography>Loading recipe...</Typography>
      </Container>
    )
  }

  if (error) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.back()}
        >
          Back to Recipes
        </Button>
      </Container>
    )
  }

  if (!recipe) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Typography>Recipe not found</Typography>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.back()}
        >
          Back to Recipes
        </Button>
      </Container>
    )
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <Box display="flex" alignItems="center" mb={4}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.back()}
          sx={{ mr: 2 }}
        >
          Back to Recipes
        </Button>
        <Typography variant="h4" component="h1">
          {recipe.name || recipe.title}
        </Typography>
      </Box>

      {/* Recipe Header */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <Typography variant="h5" gutterBottom>
                {recipe.name || recipe.title}
              </Typography>

              {recipe.description && (
                <Typography variant="body1" color="textSecondary" paragraph>
                  {recipe.description}
                </Typography>
              )}

              <Box display="flex" gap={2} mb={2}>
                {recipe.prep_time_minutes && (
                  <Chip
                    icon={<TimerIcon />}
                    label={`${(recipe.prep_time_minutes + (recipe.cook_time_minutes || 0))} min`}
                    variant="outlined"
                  />
                )}
                <Chip
                  icon={<ServingsIcon />}
                  label={`${recipe.servings} servings`}
                  variant="outlined"
                />
                <Chip
                  label={recipe.difficulty}
                  color={recipe.difficulty === 'easy' ? 'success' : recipe.difficulty === 'hard' ? 'error' : 'warning'}
                  variant="outlined"
                />
              </Box>

              {recipe.source_url && (
                <Box sx={{ mt: 2 }}>
                  <Button
                    startIcon={<LinkIcon />}
                    onClick={() => window.open(recipe.source_url, '_blank')}
                    variant="outlined"
                    size="small"
                    color="secondary"
                  >
                    View Original Recipe
                  </Button>
                  {recipe.youtube_video_id && (
                    <Button
                      startIcon={<PlayIcon />}
                      onClick={() => window.open(`https://youtube.com/watch?v=${recipe.youtube_video_id}`, '_blank')}
                      variant="outlined"
                      size="small"
                      color="error"
                      sx={{ ml: 1 }}
                    >
                      Watch Video
                    </Button>
                  )}
                </Box>
              )}
            </Grid>

            <Grid item xs={12} md={4}>
              {recipe.image_url && (
                <Avatar
                  src={recipe.image_url}
                  sx={{ width: '100%', height: 200 }}
                  variant="rounded"
                />
              )}
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Ingredients with Availability */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            🥕 Ingredients ({ingredients.length})
          </Typography>

          {canMakeRecipe() && (
            <Alert severity="success" sx={{ mb: 2 }}>
              ✅ You have all ingredients to make this recipe!
            </Alert>
          )}

          <List>
            {ingredients.map((ingredient, index) => (
              <ListItem key={index} sx={{ py: 1 }}>
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="body1">
                        {ingredient.quantity} {ingredient.unit} {ingredient.ingredient_name}
                      </Typography>
                      {ingredient.preparation && (
                        <Typography variant="caption" color="textSecondary">
                          ({ingredient.preparation})
                        </Typography>
                      )}
                    </Box>
                  }
                  secondary={
                    ingredient.availability_status !== 'unknown' && (
                      <Chip
                        size="small"
                        icon={getAvailabilityIcon(ingredient.availability_status)}
                        label={
                          ingredient.availability_status === 'available' ? 'Have it' :
                          ingredient.availability_status === 'partial' ? 'Need more' : 'Need to buy'
                        }
                        color={getAvailabilityColor(ingredient.availability_status) as any}
                        variant="outlined"
                      />
                    )
                  }
                />
              </ListItem>
            ))}
          </List>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            👨‍🍳 Instructions
          </Typography>
          <Typography variant="body1" sx={{ whiteSpace: 'pre-line', lineHeight: 1.6 }}>
            {recipe.instructions}
          </Typography>
        </CardContent>
      </Card>

      {/* Make Recipe Button */}
      {canMakeRecipe() && (
        <Box sx={{ position: 'fixed', bottom: 16, right: 16 }}>
          <Button
            variant="contained"
            size="large"
            color="success"
            onClick={() => router.push(`/recipes/${recipe.id}/make`)}
          >
            Make This Recipe
          </Button>
        </Box>
      )}
    </Container>
  )
}