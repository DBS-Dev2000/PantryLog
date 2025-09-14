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
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  FormControlLabel
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
  Close as CloseIcon,
  Delete as DeleteIcon,
  ShoppingCart as ShoppingIcon,
  Add as AddIcon
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
  const [deleteDialog, setDeleteDialog] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [shoppingDialog, setShoppingDialog] = useState(false)
  const [shoppingLists, setShoppingLists] = useState<any[]>([])
  const [selectedShoppingList, setSelectedShoppingList] = useState('')
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([])

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

      // Load recipe ingredients first
      const { data: ingredientsData, error: ingredientsError } = await supabase
        .from('recipe_ingredients')
        .select('*')
        .eq('recipe_id', recipeId)
        .order('sort_order')

      if (ingredientsError) {
        console.error('Error loading ingredients:', ingredientsError)
      }

      console.log('🥕 Loaded recipe ingredients:', ingredientsData?.length || 0)

      if (ingredientsData && ingredientsData.length > 0) {
        // Try availability check if function exists
        try {
          const { data: availabilityData, error: availabilityError } = await supabase
            .rpc('check_recipe_availability', {
              p_recipe_id: recipeId,
              p_household_id: userId
            })

          if (availabilityError) {
            console.warn('Availability check function not available:', availabilityError)
            // Use ingredients without availability check
            setIngredients(ingredientsData.map(ing => ({
              ...ing,
              availability_status: 'missing' // Default to missing for shopping list functionality
            })))
          } else {
            console.log('✅ Availability check complete:', availabilityData?.length || 0)
            setIngredients(availabilityData || [])
          }
        } catch (rpcError) {
          console.warn('RPC function error, using basic ingredients:', rpcError)
          // Fallback: Mark all ingredients as missing so shopping list works
          setIngredients(ingredientsData.map(ing => ({
            ...ing,
            availability_status: 'missing'
          })))
        }
      } else {
        console.warn('❌ No ingredients found for recipe')
        setIngredients([])
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

  const getMissingIngredients = () => {
    // If no ingredients in recipe, all ingredients are "missing" in a sense
    if (ingredients.length === 0) {
      return []
    }
    return ingredients.filter(ing => ing.availability_status === 'missing' || ing.availability_status === 'partial')
  }

  const hasIngredients = () => {
    return ingredients.length > 0
  }

  const deleteRecipe = async () => {
    if (deleteConfirmation.toLowerCase() !== 'delete') {
      setError('Please type "DELETE" to confirm recipe deletion')
      return
    }

    setDeleting(true)
    try {
      const { error } = await supabase
        .from('recipes')
        .delete()
        .eq('id', recipeId)

      if (error) throw error

      console.log('✅ Recipe deleted successfully')
      router.push('/recipes')

    } catch (err: any) {
      setError(err.message)
      setDeleting(false)
    }
  }

  const loadShoppingLists = async () => {
    try {
      const { data: lists, error } = await supabase
        .from('shopping_lists')
        .select('*')
        .eq('household_id', user?.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })

      if (error) throw error

      setShoppingLists(lists || [])

      // Auto-select the first list if available
      if (lists && lists.length > 0) {
        setSelectedShoppingList(lists[0].id)
      }

    } catch (err: any) {
      console.error('Error loading shopping lists:', err)
    }
  }

  const addMissingToShoppingList = async () => {
    if (!selectedShoppingList || selectedIngredients.length === 0) return

    try {
      const missingIngredients = getMissingIngredients()
      const selectedIngredientData = missingIngredients.filter(ing =>
        selectedIngredients.includes(ing.ingredient_name)
      )

      const shoppingItems = selectedIngredientData.map(ingredient => ({
        shopping_list_id: selectedShoppingList,
        item_name: ingredient.ingredient_name,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        priority: 3, // Medium priority
        notes: `From recipe: ${recipe?.name || recipe?.title}`,
        added_by: user?.id
      }))

      const { error } = await supabase
        .from('shopping_list_items')
        .insert(shoppingItems)

      if (error) throw error

      setShoppingDialog(false)
      setSelectedIngredients([])
      setError(null)
      console.log('✅ Added', selectedIngredientData.length, 'selected ingredients to shopping list')

      // Show success message
      const listName = shoppingLists.find(l => l.id === selectedShoppingList)?.name || 'shopping list'
      setError(`Added ${selectedIngredientData.length} ingredients to ${listName}!`)

    } catch (err: any) {
      setError(err.message)
    }
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
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4" component="h1">
            {recipe.name || recipe.title}
          </Typography>
        </Box>
        <Button
          startIcon={<DeleteIcon />}
          onClick={() => setDeleteDialog(true)}
          color="error"
          variant="outlined"
        >
          Delete Recipe
        </Button>
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
              {recipe.image_url ? (
                <Box>
                  <img
                    src={recipe.image_url}
                    alt={recipe.name || recipe.title}
                    style={{
                      width: '100%',
                      height: 200,
                      objectFit: 'cover',
                      borderRadius: 8,
                      border: '1px solid #ddd'
                    }}
                    onError={(e) => {
                      console.log('❌ Recipe image failed to load:', recipe.image_url)
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                </Box>
              ) : (
                <Box
                  sx={{
                    width: '100%',
                    height: 200,
                    backgroundColor: 'grey.100',
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px dashed #ccc'
                  }}
                >
                  <Typography variant="body2" color="textSecondary">
                    No image available
                  </Typography>
                </Box>
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

          {!hasIngredients() ? (
            <Alert severity="info" sx={{ mb: 2 }}>
              ℹ️ No ingredients found for this recipe. Please edit the recipe to add ingredients.
            </Alert>
          ) : canMakeRecipe() ? (
            <Alert severity="success" sx={{ mb: 2 }}>
              ✅ You have all ingredients to make this recipe!
            </Alert>
          ) : (
            <Alert severity="info" sx={{ mb: 2 }}>
              ℹ️ Check ingredients you need to buy, then add them to your shopping list
            </Alert>
          )}

          <List>
            {ingredients.map((ingredient, index) => (
              <ListItem key={index} sx={{ py: 1 }}>
                <Checkbox
                  checked={selectedIngredients.includes(ingredient.ingredient_name)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedIngredients(prev => [...prev, ingredient.ingredient_name])
                    } else {
                      setSelectedIngredients(prev => prev.filter(name => name !== ingredient.ingredient_name))
                    }
                  }}
                  color="secondary"
                  disabled={ingredient.availability_status === 'available'}
                />
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography
                        variant="body1"
                        sx={{
                          textDecoration: ingredient.availability_status === 'available' ? 'line-through' : 'none',
                          color: ingredient.availability_status === 'available' ? 'text.secondary' : 'text.primary'
                        }}
                      >
                        {ingredient.quantity} {ingredient.unit} {ingredient.ingredient_name}
                      </Typography>
                      {ingredient.preparation && (
                        <Typography variant="caption" color="textSecondary">
                          ({ingredient.preparation})
                        </Typography>
                      )}
                      {ingredient.availability_status === 'available' && (
                        <Chip
                          size="small"
                          label="✓ Have it"
                          color="success"
                          variant="outlined"
                        />
                      )}
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>

          {/* Shopping List Actions */}
          {selectedIngredients.length > 0 && (
            <Box sx={{ mt: 2, textAlign: 'center' }}>
              <Button
                variant="contained"
                startIcon={<ShoppingIcon />}
                onClick={() => {
                  loadShoppingLists()
                  setShoppingDialog(true)
                }}
                color="secondary"
              >
                Add {selectedIngredients.length} to Shopping List
              </Button>
            </Box>
          )}
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog} onClose={() => setDeleteDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ color: 'error.main' }}>
          🗑️ Delete Recipe
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            Are you sure you want to delete "{recipe.name || recipe.title}"?
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
            This action cannot be undone. All recipe data, ingredients, and cooking steps will be permanently removed.
          </Typography>

          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>Type "DELETE" to confirm:</strong>
            </Typography>
          </Alert>

          <TextField
            label="Confirmation"
            fullWidth
            value={deleteConfirmation}
            onChange={(e) => setDeleteConfirmation(e.target.value)}
            placeholder="Type DELETE to confirm"
            error={deleteConfirmation.length > 0 && deleteConfirmation.toLowerCase() !== 'delete'}
            helperText={deleteConfirmation.length > 0 && deleteConfirmation.toLowerCase() !== 'delete' ? 'Must type DELETE exactly' : ''}
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setDeleteDialog(false)
            setDeleteConfirmation('')
          }}>
            Cancel
          </Button>
          <Button
            onClick={deleteRecipe}
            variant="contained"
            color="error"
            disabled={deleteConfirmation.toLowerCase() !== 'delete' || deleting}
          >
            {deleting ? 'Deleting...' : 'Delete Recipe'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Simple Shopping List Selection Dialog */}
      <Dialog open={shoppingDialog} onClose={() => setShoppingDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          🛒 Choose Shopping List
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
            Add {selectedIngredients.length} selected ingredients to which shopping list?
          </Typography>

          <FormControl fullWidth>
            <InputLabel>Shopping List</InputLabel>
            <Select
              value={selectedShoppingList}
              label="Shopping List"
              onChange={(e) => setSelectedShoppingList(e.target.value)}
            >
              {shoppingLists.map((list) => (
                <MenuItem key={list.id} value={list.id}>
                  {list.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShoppingDialog(false)}>
            Cancel
          </Button>
          <Button
            onClick={addMissingToShoppingList}
            variant="contained"
            disabled={!selectedShoppingList}
            startIcon={<AddIcon />}
            color="secondary"
          >
            Add to List
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}