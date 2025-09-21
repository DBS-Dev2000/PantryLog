'use client'

import { useState, useEffect, useRef } from 'react'
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
  FormControlLabel,
  Rating,
  CircularProgress
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
  Edit as EditIcon,
  ShoppingCart as ShoppingIcon,
  Add as AddIcon,
  Nature as NatureIcon,
  Comment as CommentIcon,
  PhotoCamera as CameraIcon,
  Send as SendIcon
} from '@mui/icons-material'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'

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
  average_rating?: number
  total_ratings?: number
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

interface RecipeRating {
  id: string
  rating: number
  family_member_id: string
  family_members: {
    name: string
  }
  created_at: string
}

interface RecipeComment {
  id: string
  comment: string
  image_url?: string
  family_member_id: string
  family_members: {
    name: string
  }
  created_at: string
}

interface FamilyMember {
  id: string
  name: string
  household_id: string
  can_edit_recipes: boolean
  role: string
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

  // Rating and comments state
  const [currentUserRating, setCurrentUserRating] = useState<number>(0)
  const [ratings, setRatings] = useState<RecipeRating[]>([])
  const [comments, setComments] = useState<RecipeComment[]>([])
  const [newComment, setNewComment] = useState('')
  const [commentImage, setCommentImage] = useState<File | null>(null)
  const [commentImagePreview, setCommentImagePreview] = useState<string>('')
  const [currentFamilyMember, setCurrentFamilyMember] = useState<FamilyMember | null>(null)
  const [showCommentDialog, setShowCommentDialog] = useState(false)
  const [canEditRecipe, setCanEditRecipe] = useState(false)

  // File upload refs
  const commentImageUploadRef = useRef<HTMLInputElement>(null)
  const [selectedShoppingList, setSelectedShoppingList] = useState('')
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([])
  const [ingredientSubstitutions, setIngredientSubstitutions] = useState<{[key: string]: string}>({})
  const [omittedIngredients, setOmittedIngredients] = useState<string[]>([])
  const [makingRecipe, setMakingRecipe] = useState(false)
  const [loadingSubstitutions, setLoadingSubstitutions] = useState<{[key: string]: boolean}>({})

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUser(session.user)
        await loadRecipeData(session.user.id)
        await loadCurrentFamilyMember(session.user.id)
        await loadRatingsAndComments()
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
        // Try smart availability check first, then fall back to basic check
        try {
          const { data: smartAvailability, error: smartError } = await supabase
            .rpc('check_recipe_availability_smart', {
              p_recipe_id: recipeId,
              p_household_id: userId
            })

          if (smartError) {
            console.log('Smart availability check not available, trying basic check:', smartError)

            // Fall back to basic availability check
            const { data: basicAvailability, error: basicError } = await supabase
              .rpc('check_recipe_availability', {
                p_recipe_id: recipeId,
                p_household_id: userId
              })

            if (basicError) {
              console.warn('Basic availability check also failed:', basicError)
              // Use ingredients without availability check
              setIngredients(ingredientsData.map(ing => ({
                ...ing,
                availability_status: 'missing'
              })))
            } else {
              console.log('✅ Basic availability check complete:', basicAvailability?.length || 0)
              setIngredients(basicAvailability || [])
            }
          } else {
            console.log('✅ Smart ingredient matching complete:', smartAvailability?.length || 0)
            console.log('🧠 Ingredient matches found:', smartAvailability?.filter((ing: any) => ing.match_type !== null).length || 0)

            // Log some example matches for debugging
            smartAvailability?.slice(0, 3).forEach((ing: any) => {
              if (ing.matched_product_name) {
                console.log(`🔍 "${ing.ingredient_name}" → "${ing.matched_product_name}" (${ing.match_type}, ${ing.match_strength})`)
              }
            })

            setIngredients(smartAvailability || [])
          }
        } catch (rpcError) {
          console.warn('All availability checks failed, using basic ingredients:', rpcError)
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

  const loadCurrentFamilyMember = async (userId: string) => {
    try {
      // Get household from households table
      const { data: householdData } = await supabase
        .from('households')
        .select('id')
        .eq('id', userId)
        .single()

      const householdId = householdData?.id || userId

      // Get the family member for this user
      const { data: memberData, error } = await supabase
        .from('family_members')
        .select('id, name, household_id, can_edit_recipes, role')
        .eq('household_id', householdId)
        .order('created_at', { ascending: true })
        .limit(1)
        .single()

      if (error) {
        console.log('Could not load family member:', error)
        return
      }

      setCurrentFamilyMember(memberData)
      setCanEditRecipe(memberData?.can_edit_recipes || false)
    } catch (err) {
      console.error('Error loading current family member:', err)
    }
  }

  const loadRatingsAndComments = async () => {
    try {
      // Load ratings
      const { data: ratingsData, error: ratingsError } = await supabase
        .from('recipe_ratings')
        .select(`
          id,
          rating,
          family_member_id,
          created_at,
          family_members(name)
        `)
        .eq('recipe_id', recipeId)
        .order('created_at', { ascending: false })

      if (!ratingsError && ratingsData) {
        setRatings(ratingsData)

        // Find current user's rating if they have one
        if (currentFamilyMember && ratingsData) {
          const userRating = ratingsData.find(r => r.family_member_id === currentFamilyMember.id)
          setCurrentUserRating(userRating?.rating || 0)
        }
      }

      // Load comments
      const { data: commentsData, error: commentsError } = await supabase
        .from('recipe_comments')
        .select(`
          id,
          comment,
          image_url,
          family_member_id,
          created_at,
          family_members(name)
        `)
        .eq('recipe_id', recipeId)
        .order('created_at', { ascending: false })

      if (!commentsError && commentsData) {
        setComments(commentsData)
      }
    } catch (err) {
      console.error('Error loading ratings and comments:', err)
    }
  }

  const handleRatingChange = async (newRating: number) => {
    if (!currentFamilyMember || !user) return

    try {
      const { error } = await supabase
        .from('recipe_ratings')
        .upsert({
          recipe_id: recipeId,
          family_member_id: currentFamilyMember.id,
          household_id: currentFamilyMember.household_id || user.id,
          rating: newRating
        })

      if (error) throw error

      setCurrentUserRating(newRating)
      loadRatingsAndComments() // Reload to update display
    } catch (err: any) {
      console.error('Error saving rating:', err)
      setError('Failed to save rating')
    }
  }

  const handleCommentSubmit = async () => {
    if (!newComment.trim() || !currentFamilyMember || !user) return

    try {
      let commentImageUrl = ''

      // Upload comment image if provided
      if (commentImage) {
        const fileExt = commentImage.name.split('.').pop()
        const fileName = `comment-${Date.now()}.${fileExt}`
        const filePath = `recipe-comments/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('recipe-images')
          .upload(filePath, commentImage)

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
          .from('recipe-images')
          .getPublicUrl(filePath)

        commentImageUrl = publicUrl
      }

      const { error } = await supabase
        .from('recipe_comments')
        .insert({
          recipe_id: recipeId,
          family_member_id: currentFamilyMember.id,
          household_id: currentFamilyMember.household_id || user.id,
          comment: newComment,
          image_url: commentImageUrl
        })

      if (error) throw error

      setNewComment('')
      setCommentImage(null)
      setCommentImagePreview('')
      setShowCommentDialog(false)
      loadRatingsAndComments() // Reload comments
    } catch (err: any) {
      console.error('Error saving comment:', err)
      setError('Failed to save comment')
    }
  }

  const handleCommentImageSelect = (file: File) => {
    setCommentImage(file)
    const reader = new FileReader()
    reader.onload = (e) => {
      setCommentImagePreview(e.target?.result as string)
    }
    reader.readAsDataURL(file)
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
      case 'available': return <CheckIcon sx={{ color: 'success.main' }} />
      case 'partial': return <WarningIcon sx={{ color: 'warning.main' }} />
      case 'missing': return <CloseIcon sx={{ color: 'error.main' }} />
      default: return <WarningIcon sx={{ color: 'grey.400' }} />
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
        {canEditRecipe && (
          <Button
            startIcon={<EditIcon />}
            onClick={() => router.push(`/recipes/edit/${recipeId}`)}
            sx={{ mr: 1 }}
          >
            Edit
          </Button>
        )}
        <Button
          startIcon={<DeleteIcon />}
          onClick={() => setDeleteDialog(true)}
          color="error"
          variant="outlined"
        >
          Delete
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
                      console.log('⚠️ Recipe image failed to load:', recipe.image_url)
                      // Instead of hiding, show a placeholder
                      e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200"%3E%3Crect width="400" height="200" fill="%23f5f5f5"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="%23999"%3EImage not available%3C/text%3E%3C/svg%3E'
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
                {/* Availability Icon */}
                <Box sx={{ mr: 2, display: 'flex', alignItems: 'center' }}>
                  {getAvailabilityIcon(ingredient.availability_status)}
                </Box>

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
                  sx={{ ml: 1 }}
                />
                <Box sx={{ flexGrow: 1 }}>
                  <Box display="flex" alignItems="center" gap={1} sx={{ mb: 1 }}>
                    <Typography
                      variant="body1"
                      sx={{
                        textDecoration: ingredient.availability_status === 'available' || omittedIngredients.includes(ingredient.ingredient_name) ? 'line-through' : 'none',
                        color: ingredient.availability_status === 'available' || omittedIngredients.includes(ingredient.ingredient_name) ? 'text.secondary' : 'text.primary'
                      }}
                    >
                      {ingredient.quantity} {ingredient.unit} {ingredient.ingredient_name}
                    </Typography>
                    {ingredient.preparation && (
                      <Typography variant="caption" color="textSecondary">
                        ({ingredient.preparation})
                      </Typography>
                    )}
                  </Box>

                  {/* Ingredient Controls */}
                  <Box display="flex" gap={1} alignItems="center" flexWrap="wrap">
                    {/* AI-Powered Substitution Dropdown */}
                    {!omittedIngredients.includes(ingredient.ingredient_name) && (
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={async () => {
                          setLoadingSubstitutions(prev => ({ ...prev, [ingredient.ingredient_name]: true }))
                          try {
                            console.log('🌿 Getting AI substitutions for:', ingredient.ingredient_name)
                            const response = await fetch('/api/get-substitutions', {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                              },
                              body: JSON.stringify({
                                ingredient: ingredient.ingredient_name,
                                category: (ingredient as any).category,
                                recipe_context: recipe?.title,
                                user_id: user?.id
                              })
                            })

                            if (response.ok) {
                              const data = await response.json()
                              console.log('✅ AI substitutions received:', data.substitutions?.length || 0)

                              // Handle both array and object responses
                              const substitutions = Array.isArray(data.substitutions) ? data.substitutions : []
                              const bestSub = substitutions.find((sub: any) => sub.quality === 'excellent')
                              if (bestSub) {
                                setIngredientSubstitutions(prev => ({
                                  ...prev,
                                  [ingredient.ingredient_name]: bestSub.substitute
                                }))
                                console.log(`🔄 Auto-substituted: ${ingredient.ingredient_name} → ${bestSub.substitute}`)
                              } else if (substitutions.length > 0) {
                                // Use first substitution if no excellent ones found
                                const firstSub = substitutions[0]
                                setIngredientSubstitutions(prev => ({
                                  ...prev,
                                  [ingredient.ingredient_name]: firstSub.substitute
                                }))
                                console.log(`🔄 Auto-substituted: ${ingredient.ingredient_name} → ${firstSub.substitute}`)
                              }
                            }
                          } catch (err) {
                            console.error('Substitution error:', err)
                          } finally {
                            setLoadingSubstitutions(prev => ({ ...prev, [ingredient.ingredient_name]: false }))
                          }
                        }}
                        color="secondary"
                        disabled={ingredient.availability_status === 'available' || loadingSubstitutions[ingredient.ingredient_name]}
                        startIcon={loadingSubstitutions[ingredient.ingredient_name] ? <CircularProgress size={16} /> : <NatureIcon />}
                      >
                        {loadingSubstitutions[ingredient.ingredient_name] ? 'Finding...' : 'Natural Sub'}
                      </Button>
                    )}

                    {/* Omit Ingredient Button */}
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        if (omittedIngredients.includes(ingredient.ingredient_name)) {
                          setOmittedIngredients(prev => prev.filter(name => name !== ingredient.ingredient_name))
                        } else {
                          setOmittedIngredients(prev => [...prev, ingredient.ingredient_name])
                        }
                      }}
                      color={omittedIngredients.includes(ingredient.ingredient_name) ? 'success' : 'warning'}
                    >
                      {omittedIngredients.includes(ingredient.ingredient_name) ? 'Include' : 'Skip'}
                    </Button>
                  </Box>

                  {/* Status and Match Info */}
                  <Box sx={{ mt: 1 }}>
                    {ingredient.availability_status !== 'available' && ingredient.availability_status !== 'unknown' && !omittedIngredients.includes(ingredient.ingredient_name) && (
                      <Typography variant="caption" color="textSecondary">
                        {ingredient.availability_status === 'partial'
                          ? `Need more - only have ${ingredient.available_quantity || 0} ${ingredient.required_unit || 'units'}`
                          : 'Need to buy'
                        }
                      </Typography>
                    )}
                    {(ingredient as any).matched_product_name && (ingredient as any).match_type !== 'exact' && (
                      <Typography variant="caption" color="primary.main" sx={{ display: 'block', mt: 0.5 }}>
                        🔍 Found: {(ingredient as any).matched_product_name} ({(ingredient as any).match_type} match)
                      </Typography>
                    )}
                    {omittedIngredients.includes(ingredient.ingredient_name) && (
                      <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 0.5 }}>
                        ⚠️ This ingredient will be skipped
                      </Typography>
                    )}
                  </Box>
                </Box>
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
      {(canMakeRecipe() || omittedIngredients.length > 0) && (
        <Card sx={{ mt: 3, backgroundColor: 'success.light' }}>
          <CardContent>
            <Typography variant="h6" sx={{ color: 'success.contrastText', mb: 2 }}>
              🍳 Ready to Cook
            </Typography>
            <Typography variant="body2" sx={{ color: 'success.contrastText', mb: 2, opacity: 0.9 }}>
              {omittedIngredients.length > 0
                ? `Cooking with ${omittedIngredients.length} ingredient(s) skipped`
                : 'You have all ingredients needed'
              }
            </Typography>
            <Box display="flex" gap={1} flexWrap="wrap">
              <Button
                variant="contained"
                size="large"
                onClick={async () => {
                  setMakingRecipe(true)
                  try {
                    // Call make recipe function that consumes ingredients
                    const { error } = await supabase
                      .rpc('make_recipe', {
                        p_recipe_id: recipe!.id,
                        p_household_id: user!.id,
                        p_user_id: user!.id,
                        p_servings_made: recipe!.servings
                      })

                    if (error) throw error

                    // Update recipe usage stats
                    const { error: updateError } = await supabase
                      .from('recipes')
                      .update({
                        times_made: (recipe!.times_made || 0) + 1,
                        last_made_date: new Date().toISOString().split('T')[0]
                      })
                      .eq('id', recipe!.id)

                    if (updateError) console.warn('Failed to update recipe stats:', updateError)

                    setError(`🎉 Recipe completed! Ingredients removed from inventory. Times made: ${(recipe!.times_made || 0) + 1}`)
                    await loadRecipeData(user!.id)

                  } catch (err: any) {
                    setError(`Failed to complete recipe: ${err.message}`)
                  } finally {
                    setMakingRecipe(false)
                  }
                }}
                disabled={makingRecipe}
                sx={{
                  backgroundColor: 'white',
                  color: 'success.main',
                  '&:hover': { backgroundColor: 'grey.100' }
                }}
                startIcon={makingRecipe ? <CircularProgress size={20} /> : <CheckIcon />}
              >
                {makingRecipe ? 'Cooking...' : 'Cook Once'}
              </Button>

              {(Object.keys(ingredientSubstitutions).length > 0 || omittedIngredients.length > 0) && (
                <Button
                  variant="outlined"
                  size="large"
                  onClick={() => {
                    // Create personalized recipe version
                    const versionName = prompt('Name for your version:', `${recipe?.name} - My Version`)
                    if (versionName) {
                      console.log('💾 Creating recipe version with substitutions')
                      // Implementation for recipe versioning
                    }
                  }}
                  sx={{
                    borderColor: 'white',
                    color: 'white',
                    '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' }
                  }}
                >
                  Save My Version
                </Button>
              )}
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Ratings & Reviews Section */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <StarIcon /> Ratings & Reviews
          </Typography>

          {/* Average Rating Display */}
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <Rating
              value={recipe.average_rating || 0}
              readOnly
              precision={0.1}
              size="large"
            />
            <Typography variant="h6" sx={{ ml: 2 }}>
              {(recipe.average_rating || 0).toFixed(1)}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
              ({recipe.total_ratings || 0} {recipe.total_ratings === 1 ? 'rating' : 'ratings'})
            </Typography>
          </Box>

          {/* User's Rating */}
          {currentFamilyMember && (
            <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Your Rating
              </Typography>
              <Rating
                value={currentUserRating}
                onChange={(_, value) => handleRatingChange(value || 0)}
                size="large"
              />
            </Box>
          )}

          {/* Comments Section */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              Comments ({comments.length})
            </Typography>
            <Button
              startIcon={<CommentIcon />}
              onClick={() => setShowCommentDialog(true)}
              variant="outlined"
              disabled={!currentFamilyMember}
            >
              Add Comment
            </Button>
          </Box>

          {/* Comments List */}
          <Box sx={{ maxHeight: 400, overflowY: 'auto' }}>
            {comments.map((comment) => (
              <Paper key={comment.id} sx={{ mb: 2, p: 2 }} elevation={1}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Avatar sx={{ width: 32, height: 32, mr: 1, bgcolor: 'primary.main' }}>
                    {comment.family_members.name.charAt(0)}
                  </Avatar>
                  <Box>
                    <Typography variant="subtitle2">
                      {comment.family_members.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {format(new Date(comment.created_at), 'MMM d, yyyy h:mm a')}
                    </Typography>
                  </Box>
                </Box>
                <Typography variant="body1" sx={{ mb: 1 }}>
                  {comment.comment}
                </Typography>
                {comment.image_url && (
                  <Box sx={{ mt: 2 }}>
                    <img
                      src={comment.image_url}
                      alt="Comment"
                      style={{
                        maxWidth: '100%',
                        maxHeight: '200px',
                        borderRadius: '8px',
                        objectFit: 'cover'
                      }}
                    />
                  </Box>
                )}
              </Paper>
            ))}
            {comments.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                No comments yet. Be the first to share your thoughts about this recipe!
              </Typography>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Comment Dialog */}
      <Dialog open={showCommentDialog} onClose={() => setShowCommentDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Comment</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Your comment"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            sx={{ mb: 2, mt: 1 }}
          />

          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <Button
              variant="outlined"
              startIcon={<CameraIcon />}
              onClick={() => commentImageUploadRef.current?.click()}
              size="small"
            >
              Add Photo
            </Button>
            <input
              type="file"
              accept="image/*"
              hidden
              ref={commentImageUploadRef}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleCommentImageSelect(file)
              }}
            />
          </Box>

          {commentImagePreview && (
            <Box sx={{ mb: 2, textAlign: 'center' }}>
              <img
                src={commentImagePreview}
                alt="Comment preview"
                style={{
                  maxWidth: '100%',
                  maxHeight: '200px',
                  borderRadius: '8px',
                  objectFit: 'cover'
                }}
              />
              <Box sx={{ mt: 1 }}>
                <Button
                  size="small"
                  onClick={() => {
                    setCommentImage(null)
                    setCommentImagePreview('')
                  }}
                >
                  Remove Photo
                </Button>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCommentDialog(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCommentSubmit}
            variant="contained"
            startIcon={<SendIcon />}
            disabled={!newComment.trim()}
          >
            Post Comment
          </Button>
        </DialogActions>
      </Dialog>

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