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
  CircularProgress,
  useTheme,
  useMediaQuery
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
  Send as SendIcon,
  Restaurant as CookingIcon,
  RestaurantMenu as CookingOffIcon,
  PhoneAndroid as PhoneIcon
} from '@mui/icons-material'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'
import { findIngredientMatches, checkRecipeAvailability } from '@/utils/ingredientMatcher'

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
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  const [user, setUser] = useState<any>(null)
  const [recipe, setRecipe] = useState<RecipeDetail | null>(null)
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
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
  const [shoppingListDialog, setShoppingListDialog] = useState(false)
  const [ingredientQuantity, setIngredientQuantity] = useState(1)
  const [itemsInShoppingList, setItemsInShoppingList] = useState<string[]>([])

  // Substitution modal state
  const [substitutionDialog, setSubstitutionDialog] = useState(false)
  const [currentSubstitutionIngredient, setCurrentSubstitutionIngredient] = useState<string>('')
  const [availableSubstitutions, setAvailableSubstitutions] = useState<any[]>([])

  // Cooking mode state
  const [cookingMode, setCookingMode] = useState(false)
  const [wakeLock, setWakeLock] = useState<any>(null)

  // Feedback dialog state
  const [feedbackDialog, setFeedbackDialog] = useState(false)
  const [feedbackIngredient, setFeedbackIngredient] = useState('')
  const [feedbackMatch, setFeedbackMatch] = useState('')
  const [feedbackReason, setFeedbackReason] = useState('')
  const [selectedCorrectItem, setSelectedCorrectItem] = useState<string | null>(null)
  const [markAsNotAvailable, setMarkAsNotAvailable] = useState(false)

  // Inventory for feedback dialog
  const [inventoryItems, setInventoryItems] = useState<any[]>([])

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

  // Wake Lock effect for cooking mode
  useEffect(() => {
    const requestWakeLock = async () => {
      if (cookingMode && 'wakeLock' in navigator) {
        try {
          const lock = await (navigator as any).wakeLock.request('screen')
          setWakeLock(lock)
          console.log('🔒 Screen wake lock activated')

          // Re-acquire wake lock if page becomes visible again
          const handleVisibilityChange = async () => {
            if (document.visibilityState === 'visible' && cookingMode) {
              try {
                const newLock = await (navigator as any).wakeLock.request('screen')
                setWakeLock(newLock)
                console.log('🔒 Screen wake lock re-activated')
              } catch (err) {
                console.log('Failed to re-acquire wake lock:', err)
              }
            }
          }

          document.addEventListener('visibilitychange', handleVisibilityChange)

          return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange)
          }
        } catch (err) {
          console.error('Wake Lock error:', err)
        }
      }
    }

    if (cookingMode) {
      requestWakeLock()
    }

    return () => {
      if (wakeLock) {
        wakeLock.release()
        console.log('🔓 Screen wake lock released')
      }
    }
  }, [cookingMode])

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
        // Get inventory items for matching
        const { data: inventoryItems, error: inventoryError } = await supabase
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

        if (inventoryError) {
          console.error('Error loading inventory:', inventoryError)
          // Use ingredients without availability check
          setIngredients(ingredientsData.map(ing => ({
            ...ing,
            availability_status: 'missing'
          })))
        } else {
          console.log('📦 Loaded inventory items:', inventoryItems?.length || 0)

          // Transform inventory items for matching
          // Store inventory items for use in dialogs
          setInventoryItems(inventoryItems || [])

          const inventoryForMatching = inventoryItems?.map(item => ({
            id: item.id,
            name: item.products?.name || '',
            products: item.products,
            quantity: item.quantity,
            unit: item.unit
          })) || []

          // Use our new intelligent matching for each ingredient
          const ingredientsWithAvailability = await Promise.all(ingredientsData.map(async ing => {
            const matches = await findIngredientMatches(ing.ingredient_name, inventoryForMatching, userId)

            let availabilityStatus = 'missing'
            let matchedProduct = null
            let availableQuantity = 0

            if (matches.length > 0) {
              const bestMatch = matches[0]
              matchedProduct = bestMatch.inventoryItem.products?.name || bestMatch.inventoryItem.name
              availableQuantity = bestMatch.inventoryItem.quantity

              // Determine availability status based on quantity
              if (ing.quantity && availableQuantity < ing.quantity) {
                availabilityStatus = 'partial'
              } else {
                availabilityStatus = 'available'
              }

              console.log(`🔍 "${ing.ingredient_name}" → "${matchedProduct}" (${bestMatch.matchType}, ${Math.round(bestMatch.confidence * 100)}% confidence)`)
            }

            return {
              ...ing,
              availability_status: availabilityStatus,
              available_quantity: availableQuantity,
              matched_product_name: matchedProduct,
              match_type: matches[0]?.matchType || null,
              match_strength: matches[0]?.confidence ? `${Math.round(matches[0].confidence * 100)}%` : null
            }
          }))

          console.log('✅ Intelligent ingredient matching complete')
          console.log('🧠 Ingredients matched:', ingredientsWithAvailability.filter(ing => ing.match_type !== null).length, '/', ingredientsData.length)

          setIngredients(ingredientsWithAvailability)
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
      const ingredient = ingredients.find(ing => ing.ingredient_name === selectedIngredients[0])
      if (!ingredient) return

      const shoppingItems = [{
        shopping_list_id: selectedShoppingList,
        item_name: ingredient.ingredient_name,
        quantity: ingredientQuantity,
        unit: ingredient.unit || 'items',
        priority: 3, // Medium priority
        notes: `From recipe: ${recipe?.name || recipe?.title}`,
        added_by: user?.id
      }]

      const { error } = await supabase
        .from('shopping_list_items')
        .insert(shoppingItems)

      if (error) throw error

      setShoppingListDialog(false)
      setSelectedIngredients([])
      setError(null)
      console.log('✅ Added', ingredientQuantity, ingredient.ingredient_name, 'to shopping list')

      // Show success message
      const listName = shoppingLists.find(l => l.id === selectedShoppingList)?.name || 'shopping list'
      setSuccess(`Added ${ingredientQuantity} ${ingredient.ingredient_name} to ${listName}!`)

      // Update the state to show this item as added
      setItemsInShoppingList(prev => [...prev, ingredient.ingredient_name])

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
          onClick={() => router.push('/recipes')}
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
          onClick={() => router.push('/recipes')}
        >
          Back to Recipes
        </Button>
      </Container>
    )
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      {/* Cooking Mode Indicator */}
      {cookingMode && (
        <Alert
          severity="success"
          icon={<PhoneIcon />}
          sx={{
            mb: 2,
            animation: 'pulse 2s infinite',
            '@keyframes pulse': {
              '0%': {
                opacity: 1,
              },
              '50%': {
                opacity: 0.8,
              },
              '100%': {
                opacity: 1,
              },
            },
          }}
        >
          <Typography variant="body2">
            <strong>Cooking Mode Active</strong> - Your screen will stay on while you cook!
            {!('wakeLock' in navigator) && ' (Wake Lock not supported on this device)'}
          </Typography>
        </Alert>
      )}

      {/* Success Message */}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* Error Message */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Mobile-Responsive Header */}
      <Box mb={4}>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <IconButton onClick={() => router.push('/recipes')} sx={{ flexShrink: 0 }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography
            variant={isMobile ? "h5" : "h4"}
            component="h1"
            sx={{
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              wordBreak: 'break-word'
            }}
          >
            {recipe.name || recipe.title}
          </Typography>
        </Box>

        {/* Action Buttons - Responsive Layout */}
        <Box display="flex" gap={1} justifyContent={isMobile ? "center" : "flex-start"} flexWrap="wrap">
          {/* Cooking Mode Toggle */}
          <Button
            variant={cookingMode ? "contained" : "outlined"}
            startIcon={!isMobile && <PhoneIcon />}
            onClick={() => setCookingMode(!cookingMode)}
            sx={{
              backgroundColor: cookingMode ? 'warning.main' : undefined,
              color: cookingMode ? 'warning.contrastText' : undefined,
              '&:hover': {
                backgroundColor: cookingMode ? 'warning.dark' : undefined
              },
              minWidth: isMobile ? 'auto' : undefined
            }}
            title={cookingMode ? "Screen will stay on while cooking" : "Keep screen awake while cooking"}
          >
            {isMobile ? <PhoneIcon /> : 'Screen On'}
          </Button>

          {canEditRecipe && (
            <Button
              variant="outlined"
              startIcon={!isMobile && <EditIcon />}
              onClick={() => router.push(`/recipes/edit/${recipeId}`)}
            >
              {isMobile ? <EditIcon /> : 'Edit'}
            </Button>
          )}

          <Button
            variant="outlined"
            startIcon={!isMobile && <DeleteIcon />}
            onClick={() => setDeleteDialog(true)}
            color="error"
          >
            {isMobile ? <DeleteIcon /> : 'Delete'}
          </Button>
        </Box>
      </Box>

      {/* Recipe Header */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              {!isMobile && (
                <Typography variant="h5" gutterBottom>
                  {recipe.name || recipe.title}
                </Typography>
              )}

              {recipe.description && (
                <Typography variant="body1" color="textSecondary" paragraph>
                  {recipe.description}
                </Typography>
              )}

              <Box display="flex" gap={1} mb={2} flexWrap="wrap">
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
                    src={recipe.image_url.replace('http://', 'https://')}
                    alt={recipe.name || recipe.title}
                    style={{
                      width: '100%',
                      height: 200,
                      objectFit: 'cover',
                      borderRadius: 8,
                      border: '1px solid #ddd'
                    }}
                    onError={(e) => {
                      const target = e.currentTarget
                      const originalSrc = recipe.image_url

                      // If already tried HTTPS, show placeholder
                      if (target.src.startsWith('https://')) {
                        console.log('⚠️ Recipe image failed to load:', originalSrc)
                        target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200"%3E%3Crect width="400" height="200" fill="%23f5f5f5"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="%23999"%3EImage not available%3C/text%3E%3C/svg%3E'
                      }
                    }}
                  />
                  {recipe.source_url && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                      Image from: {new URL(recipe.source_url).hostname}
                    </Typography>
                  )}
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
              <ListItem key={index} sx={{ py: 1, alignItems: 'flex-start' }}>
                <Box sx={{ flexGrow: 1, width: '100%' }}>
                  <Box display="flex" alignItems="center" gap={1} justifyContent="space-between" flexWrap="wrap">
                    {/* Stock indicator dot */}
                    <Box
                      sx={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        backgroundColor:
                          ingredient.availability_status === 'available' ? 'success.main' :
                          ingredient.availability_status === 'partial' ? 'warning.main' :
                          'error.main',
                        flexShrink: 0
                      }}
                    />
                    <Box display="flex" alignItems="center" gap={1} flexGrow={1}>
                      <Typography
                        variant="body1"
                        sx={{
                          textDecoration: omittedIngredients.includes(ingredient.ingredient_name) ? 'line-through' : 'none',
                          color: omittedIngredients.includes(ingredient.ingredient_name) ? 'text.secondary' : 'text.primary',
                          fontWeight: ingredient.availability_status === 'available' ? 500 : 400
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

                    {/* Shopping List Button - Inline */}
                    <Button
                      size="small"
                      variant={itemsInShoppingList.includes(ingredient.ingredient_name) ? 'contained' :
                               ingredient.availability_status === 'available' ? 'outlined' : 'contained'}
                      onClick={() => {
                        if (itemsInShoppingList.includes(ingredient.ingredient_name)) {
                          // Remove from shopping list
                          setItemsInShoppingList(prev => prev.filter(item => item !== ingredient.ingredient_name))
                          // TODO: Actually remove from database
                        } else {
                          // Add this ingredient to the selected list and open dialog
                          setSelectedIngredients([ingredient.ingredient_name])
                          loadShoppingLists()
                          setShoppingListDialog(true)
                        }
                      }}
                      startIcon={itemsInShoppingList.includes(ingredient.ingredient_name) ? <CheckIcon /> : <ShoppingIcon />}
                      color={
                        itemsInShoppingList.includes(ingredient.ingredient_name) ? 'success' :
                        ingredient.availability_status === 'available' ? 'inherit' :
                        ingredient.availability_status === 'partial' ? 'warning' :
                        'primary'
                      }
                      sx={{
                        minWidth: 120,
                        '&.MuiButton-outlinedSuccess': {
                          borderColor: 'success.main',
                          color: 'success.main',
                          '&:hover': {
                            borderColor: 'success.dark',
                            backgroundColor: 'success.light',
                          }
                        },
                        '&.MuiButton-containedWarning': {
                          backgroundColor: 'warning.main',
                          color: 'warning.contrastText',
                          '&:hover': {
                            backgroundColor: 'warning.dark',
                          }
                        },
                        '&.MuiButton-containedPrimary': {
                          backgroundColor: 'primary.main',
                          '&:hover': {
                            backgroundColor: 'primary.dark',
                          }
                        }
                      }}
                    >
                      {itemsInShoppingList.includes(ingredient.ingredient_name) ? 'Added' :
                       ingredient.availability_status === 'available' ? 'In Stock' :
                       ingredient.availability_status === 'partial' ? 'Low Stock' :
                       'Add to List'}
                    </Button>
                  </Box>

                    {/* AI-Powered Substitution Dropdown - Hidden for now */}
                    {false && !omittedIngredients.includes(ingredient.ingredient_name) && (
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={async () => {
                          setLoadingSubstitutions(prev => ({ ...prev, [ingredient.ingredient_name]: true }))
                          try {
                            console.log('🌿 Getting AI substitutions for:', ingredient.ingredient_name)

                            // Get pantry items to consider for substitutions
                            const { data: pantryItems } = await supabase
                              .from('inventory_items')
                              .select('name, quantity, unit, category')
                              .eq('household_id', user?.id)
                              .gt('quantity', 0)
                              .limit(50)

                            console.log('🏠 Found', pantryItems?.length || 0, 'pantry items to consider')

                            const response = await fetch('/api/get-substitutions', {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                              },
                              body: JSON.stringify({
                                ingredient: ingredient.ingredient_name,
                                category: (ingredient as any).category,
                                recipe_context: recipe?.title,
                                user_id: user?.id,
                                pantry_items: pantryItems || []
                              })
                            })

                            if (response.ok) {
                              const data = await response.json()
                              console.log('✅ AI substitutions received:', data.substitutions?.length || 0)

                              // Handle both array and object responses
                              const substitutions = Array.isArray(data.substitutions) ? data.substitutions : []

                              if (substitutions.length > 0) {
                                // Sort to show pantry items first
                                const sortedSubs = substitutions.sort((a: any, b: any) => {
                                  if (a.from_pantry && !b.from_pantry) return -1
                                  if (!a.from_pantry && b.from_pantry) return 1
                                  return 0
                                })

                                // Show modal with all substitution options
                                setCurrentSubstitutionIngredient(ingredient.ingredient_name)
                                setAvailableSubstitutions(sortedSubs)
                                setSubstitutionDialog(true)
                              } else {
                                console.log('⚠️ No substitutions found for:', ingredient.ingredient_name)
                                alert(`Sorry, no substitutions found for ${ingredient.ingredient_name}`)
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

                  {/* Skip button removed - Hidden for now */}

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
                    {(ingredient as any).matched_product_name && (
                      <Box display="flex" alignItems="center" gap={1} sx={{ mt: 0.5 }}>
                        <Typography variant="caption" color="primary.main">
                          🔍 Found: {(ingredient as any).matched_product_name}
                          {(ingredient as any).match_strength && ` (${(ingredient as any).match_strength} confidence)`}
                        </Typography>
                        {/* Feedback buttons for ML training */}
                        <IconButton
                          size="small"
                          onClick={async () => {
                            // Store positive feedback
                            const feedbackData = {
                              household_id: user?.id,
                              user_id: user?.id,
                              recipe_id: recipeId,
                              recipe_ingredient: ingredient.ingredient_name,
                              matched_product: (ingredient as any).matched_product_name,
                              is_correct: true,
                              match_type: (ingredient as any).match_type,
                              match_confidence: (ingredient as any).match_strength ? parseFloat((ingredient as any).match_strength) / 100 : null
                            }

                            const { error } = await supabase
                              .from('ml_ingredient_feedback')
                              .insert(feedbackData)

                            if (!error) {
                              console.log('👍 Positive feedback saved:', ingredient.ingredient_name, '→', (ingredient as any).matched_product_name)
                              setSuccess('Thanks for confirming this match!')
                            }
                          }}
                          sx={{ p: 0.5 }}
                          title="Good match"
                        >
                          <Typography fontSize="small">👍</Typography>
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => {
                            // Store negative feedback and allow correction
                            console.log('👎 Bad match:', ingredient.ingredient_name, '→', (ingredient as any).matched_product_name)
                            setFeedbackIngredient(ingredient.ingredient_name)
                            setFeedbackMatch((ingredient as any).matched_product_name)
                            setFeedbackDialog(true)
                          }}
                          sx={{ p: 0.5 }}
                          title="Wrong match"
                        >
                          <Typography fontSize="small">👎</Typography>
                        </IconButton>
                        <Button
                          size="small"
                          variant="text"
                          onClick={() => {
                            // TODO: Open dialog to manually select correct item
                            console.log('🔧 Correct match for:', ingredient.ingredient_name)
                          }}
                          sx={{ minWidth: 'auto', p: 0.5, fontSize: '0.75rem' }}
                        >
                          Correct
                        </Button>
                      </Box>
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
                  if (!confirm('This will remove ingredients from your inventory. Continue?')) {
                    return
                  }

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

                    setSuccess(`🎉 Recipe completed! Ingredients removed from inventory. Times made: ${(recipe!.times_made || 0) + 1}`)
                    setError(null)

                    // Reload ingredients to show updated availability
                    await loadRecipeData(user!.id)

                    // Clear success message after 5 seconds
                    setTimeout(() => setSuccess(null), 5000)

                  } catch (err: any) {
                    setError(`Failed to complete recipe: ${err.message}`)
                    setSuccess(null)
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
                title="Mark recipe as made and remove ingredients from inventory"
              >
                {makingRecipe ? 'Processing...' : 'I Made This Recipe'}
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

      {/* Shopping List Selection Dialog with Quantity */}
      <Dialog open={shoppingListDialog} onClose={() => {
        setShoppingListDialog(false)
        setIngredientQuantity(1)
      }} maxWidth="sm" fullWidth>
        <DialogTitle>
          🛒 Add to Shopping List
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
            Adding: {selectedIngredients[0]}
          </Typography>

          <TextField
            label="Quantity"
            type="number"
            value={ingredientQuantity}
            onChange={(e) => setIngredientQuantity(Math.max(1, parseInt(e.target.value) || 1))}
            fullWidth
            sx={{ mb: 3 }}
            InputProps={{
              inputProps: { min: 1, max: 99 }
            }}
          />

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
          <Button onClick={() => {
            setShoppingListDialog(false)
            setIngredientQuantity(1)
          }}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              addMissingToShoppingList()
              setIngredientQuantity(1)
            }}
            variant="contained"
            disabled={!selectedShoppingList}
            startIcon={<AddIcon />}
            color="secondary"
          >
            Add {ingredientQuantity} to List
          </Button>
        </DialogActions>
      </Dialog>

      {/* Substitution Selection Dialog */}
      <Dialog
        open={substitutionDialog}
        onClose={() => setSubstitutionDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Choose a Substitution for {currentSubstitutionIngredient}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select the best substitution based on what you have available:
          </Typography>
          <List>
            {availableSubstitutions.map((sub, index) => (
              <ListItem
                key={index}
                button
                onClick={() => {
                  // Apply the selected substitution
                  setIngredientSubstitutions(prev => ({
                    ...prev,
                    [currentSubstitutionIngredient]: sub.substitute
                  }))
                  console.log(`✅ Selected substitution: ${currentSubstitutionIngredient} → ${sub.substitute}`)
                  setSubstitutionDialog(false)
                  setAvailableSubstitutions([])
                }}
                sx={{
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  mb: 1,
                  '&:hover': {
                    backgroundColor: 'action.hover'
                  }
                }}
              >
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="subtitle1" fontWeight="medium">
                        {sub.substitute}
                      </Typography>
                      {sub.from_pantry && (
                        <Chip label="In Pantry!" size="small" color="success" variant="filled" />
                      )}
                      {sub.quality === 'excellent' && !sub.from_pantry && (
                        <Chip label="Best Match" size="small" color="success" />
                      )}
                      {sub.quality === 'good' && !sub.from_pantry && (
                        <Chip label="Good" size="small" color="primary" />
                      )}
                      {sub.quality === 'fair' && !sub.from_pantry && (
                        <Chip label="Fair" size="small" color="warning" />
                      )}
                    </Box>
                  }
                  secondary={
                    <Box>
                      {sub.ratio && (
                        <Typography variant="body2" color="text.secondary">
                          Ratio: {sub.ratio}
                        </Typography>
                      )}
                      {sub.notes && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          {sub.notes}
                        </Typography>
                      )}
                      {sub.impact && (
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                          Impact: {sub.impact}
                        </Typography>
                      )}
                    </Box>
                  }
                />
              </ListItem>
            ))}

            {/* Option to skip substitution */}
            <ListItem
              button
              onClick={() => {
                console.log(`⏭️ Skipped substitution for ${currentSubstitutionIngredient}`)
                setSubstitutionDialog(false)
                setAvailableSubstitutions([])
              }}
              sx={{
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                borderStyle: 'dashed'
              }}
            >
              <ListItemText
                primary="Skip Substitution"
                secondary="Continue without substituting this ingredient"
              />
            </ListItem>
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSubstitutionDialog(false)}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      {/* Feedback Dialog for incorrect matches */}
      <Dialog
        open={feedbackDialog}
        onClose={() => {
          setFeedbackDialog(false)
          setFeedbackReason('')
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Correct Ingredient Match
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            "{feedbackMatch}" is not correct for "{feedbackIngredient}".
          </Typography>

          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>What's the correct item?</Typography>
            <FormControlLabel
              control={
                <Checkbox
                  checked={markAsNotAvailable}
                  onChange={(e) => {
                    setMarkAsNotAvailable(e.target.checked)
                    if (e.target.checked) setSelectedCorrectItem(null)
                  }}
                />
              }
              label="I don't have this ingredient"
            />

            {!markAsNotAvailable && inventoryItems.length > 0 && (
              <FormControl fullWidth sx={{ mt: 2 }}>
                <InputLabel>Select correct item from inventory</InputLabel>
                <Select
                  value={selectedCorrectItem || ''}
                  onChange={(e) => setSelectedCorrectItem(e.target.value)}
                  label="Select correct item from inventory"
                >
                  <MenuItem value="">None</MenuItem>
                  {inventoryItems
                    .filter(item => {
                      const itemName = item.products?.name?.toLowerCase() || item.name?.toLowerCase() || ''
                      const searchTerm = feedbackIngredient.toLowerCase()
                      // Show pepper-related items for pepper
                      if (searchTerm.includes('pepper')) {
                        return itemName.includes('pepper') || itemName.includes('peppercorn')
                      }
                      return itemName.includes(searchTerm) || searchTerm.includes(itemName.split(' ')[0])
                    })
                    .slice(0, 10)
                    .map(item => (
                      <MenuItem key={item.id} value={item.products?.name || item.name}>
                        {item.products?.name || item.name} ({item.quantity} {item.unit})
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>
            )}
          </Box>

          <TextField
            fullWidth
            multiline
            rows={2}
            label="Additional feedback (optional)"
            value={feedbackReason}
            onChange={(e) => setFeedbackReason(e.target.value)}
            placeholder="e.g., 'I meant black pepper, not tomato paste'"
            variant="outlined"
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setFeedbackDialog(false)
            setFeedbackReason('')
            setSelectedCorrectItem(null)
            setMarkAsNotAvailable(false)
          }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={async () => {
              // Store the feedback in database
              const feedbackData = {
                household_id: user?.id,
                user_id: user?.id,
                recipe_id: recipeId,
                recipe_ingredient: feedbackIngredient,
                matched_product: feedbackMatch,
                is_correct: false,
                feedback_reason: feedbackReason || null,
                correct_product_name: selectedCorrectItem,
                match_type: 'user_correction'
              }

              const { error } = await supabase
                .from('ml_ingredient_feedback')
                .insert(feedbackData)

              if (error) {
                console.error('Error saving feedback:', error)
                // Continue anyway to update UI
              } else {
                console.log('📝 Feedback saved:', feedbackData)
              }

              setSuccess('Thank you! Your correction has been applied.')

              // Update the UI to reflect the correction
              if (markAsNotAvailable) {
                // Update ingredient to show as not available
                setIngredients(prev => prev.map(ing =>
                  ing.ingredient_name === feedbackIngredient
                    ? { ...ing, availability_status: 'missing', matched_product_name: null, match_type: null, match_strength: null }
                    : ing
                ))
              } else if (selectedCorrectItem) {
                // Update ingredient to show correct match
                setIngredients(prev => prev.map(ing =>
                  ing.ingredient_name === feedbackIngredient
                    ? { ...ing, availability_status: 'available', matched_product_name: selectedCorrectItem, match_strength: '100%' }
                    : ing
                ))
              }

              // Close dialog and reset
              setFeedbackDialog(false)
              setFeedbackReason('')
              setSelectedCorrectItem(null)
              setMarkAsNotAvailable(false)
            }}
            disabled={!markAsNotAvailable && !selectedCorrectItem}
          >
            Submit Correction
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}