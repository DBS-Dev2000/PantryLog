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
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  InputAdornment,
  Autocomplete,
  CircularProgress,
  Rating,
  Avatar,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Badge
} from '@mui/material'
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Image as ImageIcon,
  Category as CategoryIcon,
  Timer as TimerIcon,
  Group as ServingsIcon,
  CloudUpload as UploadIcon,
  PhotoCamera as CameraIcon,
  Star as StarIcon,
  Comment as CommentIcon,
  Send as SendIcon
} from '@mui/icons-material'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'

interface RecipeCategory {
  id: string
  name: string
  display_name: string
  meal_type?: string
  cuisine_type?: string
}

interface Ingredient {
  id?: string
  ingredient_name: string
  quantity: number
  unit: string
  preparation?: string
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

const DIFFICULTY_LEVELS = ['easy', 'medium', 'hard']
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack', 'dessert']
const CUISINE_TYPES = [
  'American', 'Italian', 'Mexican', 'Chinese', 'Japanese', 'Thai',
  'Indian', 'Mediterranean', 'French', 'Greek', 'Korean', 'Vietnamese',
  'BBQ', 'Comfort Food', 'Healthy', 'Soul Food'
]

const COMMON_UNITS = [
  'cup', 'cups', 'tablespoon', 'tablespoons', 'teaspoon', 'teaspoons',
  'ounce', 'ounces', 'pound', 'pounds', 'gram', 'grams',
  'liter', 'liters', 'milliliter', 'milliliters',
  'piece', 'pieces', 'clove', 'cloves', 'can', 'cans',
  'package', 'packages', 'bunch', 'bunches'
]

export default function RecipeEditPage() {
  const router = useRouter()
  const params = useParams()
  const recipeId = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Recipe data
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [instructions, setInstructions] = useState('')
  const [prepTime, setPrepTime] = useState<number>(0)
  const [cookTime, setCookTime] = useState<number>(0)
  const [servings, setServings] = useState<number>(4)
  const [difficulty, setDifficulty] = useState('medium')
  const [imageUrl, setImageUrl] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [cuisine, setCuisine] = useState('')
  const [category, setCategory] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])

  // Available categories
  const [categories, setCategories] = useState<RecipeCategory[]>([])
  const [newTag, setNewTag] = useState('')

  // Rating and comments
  const [currentUserRating, setCurrentUserRating] = useState<number>(0)
  const [averageRating, setAverageRating] = useState<number>(0)
  const [totalRatings, setTotalRatings] = useState<number>(0)
  const [ratings, setRatings] = useState<RecipeRating[]>([])
  const [comments, setComments] = useState<RecipeComment[]>([])
  const [newComment, setNewComment] = useState('')
  const [commentImage, setCommentImage] = useState<File | null>(null)
  const [commentImagePreview, setCommentImagePreview] = useState<string>('')
  const [currentFamilyMember, setCurrentFamilyMember] = useState<any>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [showCommentDialog, setShowCommentDialog] = useState(false)

  // File upload refs
  const imageUploadRef = useRef<HTMLInputElement>(null)
  const commentImageUploadRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadRecipe()
    loadCategories()
    loadCurrentFamilyMember()
    loadRatingsAndComments()
  }, [recipeId])

  const loadRecipe = async () => {
    try {
      // Load recipe details
      const { data: recipeData, error: recipeError } = await supabase
        .from('recipes')
        .select('*')
        .eq('id', recipeId)
        .single()

      if (recipeError) throw recipeError

      if (recipeData) {
        setName(recipeData.name || '')
        setDescription(recipeData.description || '')
        setInstructions(recipeData.instructions || '')
        setPrepTime(recipeData.prep_time_minutes || 0)
        setCookTime(recipeData.cook_time_minutes || 0)
        setServings(recipeData.servings || 4)
        setDifficulty(recipeData.difficulty || 'medium')
        setImageUrl(recipeData.image_url || '')
        setSourceUrl(recipeData.source_url || '')
        setCuisine(recipeData.cuisine || '')
        setCategory(recipeData.category || '')
        setTags(recipeData.tags || [])
      }

      // Load recipe ingredients
      const { data: ingredientsData, error: ingredientsError } = await supabase
        .from('recipe_ingredients')
        .select('*')
        .eq('recipe_id', recipeId)

      if (ingredientsError) throw ingredientsError

      if (ingredientsData) {
        setIngredients(ingredientsData.map(ing => ({
          id: ing.id,
          ingredient_name: ing.ingredient_name,
          quantity: ing.quantity,
          unit: ing.unit,
          preparation: ing.preparation
        })))
      }

      setLoading(false)
    } catch (err: any) {
      console.error('Error loading recipe:', err)
      setError(err.message || 'Failed to load recipe')
      setLoading(false)
    }
  }

  const loadCategories = async () => {
    try {
      // Load categories from recipe_categories table
      const { data, error } = await supabase
        .from('recipe_categories')
        .select('*')
        .order('display_name')

      if (error) {
        console.log('Could not load categories:', error)
        // Fallback to hardcoded categories if table doesn't exist
        setCategories(MEAL_TYPES.map(mt => ({
          id: mt,
          name: mt,
          display_name: mt.charAt(0).toUpperCase() + mt.slice(1)
        })))
      } else {
        setCategories(data || [])
      }
    } catch (err) {
      console.error('Error loading categories:', err)
    }
  }

  const loadCurrentFamilyMember = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Get household from households table
      const { data: householdData } = await supabase
        .from('households')
        .select('id')
        .eq('created_by', user.id)
        .single()

      const householdId = householdData?.id || user.id

      // Get the primary family member for this user (assume first member they created)
      const { data: memberData, error } = await supabase
        .from('family_members')
        .select('id, name, household_id')
        .eq('household_id', householdId)
        .order('created_at', { ascending: true })
        .limit(1)
        .single()

      if (error) {
        console.log('Could not load family member:', error)
        return
      }

      setCurrentFamilyMember(memberData)
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

      if (ratingsError) throw ratingsError

      setRatings(ratingsData || [])

      // Calculate average rating
      if (ratingsData && ratingsData.length > 0) {
        const avg = ratingsData.reduce((sum, r) => sum + r.rating, 0) / ratingsData.length
        setAverageRating(avg)
        setTotalRatings(ratingsData.length)
      }

      // Find current user's rating
      if (currentFamilyMember && ratingsData) {
        const userRating = ratingsData.find(r => r.family_member_id === currentFamilyMember.id)
        setCurrentUserRating(userRating?.rating || 0)
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

      if (commentsError) throw commentsError
      setComments(commentsData || [])
    } catch (err) {
      console.error('Error loading ratings and comments:', err)
    }
  }

  const handleImageUpload = async (file: File) => {
    if (!file) return

    setUploadingImage(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `recipe-${recipeId}-${Date.now()}.${fileExt}`
      const filePath = `recipe-images/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('recipe-images')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('recipe-images')
        .getPublicUrl(filePath)

      setImageUrl(publicUrl)
    } catch (err: any) {
      console.error('Error uploading image:', err)
      setError('Failed to upload image')
    } finally {
      setUploadingImage(false)
    }
  }

  const handleRatingChange = async (newRating: number) => {
    if (!currentFamilyMember) return

    try {
      const { error } = await supabase
        .from('recipe_ratings')
        .upsert({
          recipe_id: recipeId,
          family_member_id: currentFamilyMember.id,
          household_id: currentFamilyMember.household_id,
          rating: newRating
        })

      if (error) throw error

      setCurrentUserRating(newRating)
      loadRatingsAndComments() // Reload to update average
    } catch (err: any) {
      console.error('Error saving rating:', err)
      setError('Failed to save rating')
    }
  }

  const handleCommentSubmit = async () => {
    if (!newComment.trim() || !currentFamilyMember) return

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
          household_id: currentFamilyMember.household_id,
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

  const handleAddIngredient = () => {
    setIngredients([
      ...ingredients,
      {
        ingredient_name: '',
        quantity: 1,
        unit: 'cup',
        preparation: ''
      }
    ])
  }

  const handleUpdateIngredient = (index: number, field: string, value: any) => {
    const updated = [...ingredients]
    updated[index] = { ...updated[index], [field]: value }
    setIngredients(updated)
  }

  const handleRemoveIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index))
  }

  const handleAddTag = () => {
    if (newTag && !tags.includes(newTag)) {
      setTags([...tags, newTag])
      setNewTag('')
    }
  }

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag))
  }

  const handleImageUrlChange = async (url: string) => {
    setImageUrl(url)

    // If it's a YouTube URL, try to extract thumbnail
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const videoIdMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)
      if (videoIdMatch) {
        const videoId = videoIdMatch[1]
        const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
        setImageUrl(thumbnailUrl)
      }
    }
  }

  const handleSave = async () => {
    if (!name) {
      setError('Recipe name is required')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Update recipe
      const { error: recipeError } = await supabase
        .from('recipes')
        .update({
          name,
          description,
          instructions,
          prep_time_minutes: prepTime,
          cook_time_minutes: cookTime,
          servings,
          difficulty,
          image_url: imageUrl,
          source_url: sourceUrl,
          cuisine,
          category,
          tags,
          updated_at: new Date().toISOString()
        })
        .eq('id', recipeId)

      if (recipeError) throw recipeError

      // Delete existing ingredients
      const { error: deleteError } = await supabase
        .from('recipe_ingredients')
        .delete()
        .eq('recipe_id', recipeId)

      if (deleteError) throw deleteError

      // Insert updated ingredients
      const validIngredients = ingredients.filter(ing => ing.ingredient_name)
      if (validIngredients.length > 0) {
        const { error: ingredientsError } = await supabase
          .from('recipe_ingredients')
          .insert(
            validIngredients.map(ing => ({
              recipe_id: recipeId,
              ingredient_name: ing.ingredient_name,
              quantity: ing.quantity,
              unit: ing.unit,
              preparation: ing.preparation
            }))
          )

        if (ingredientsError) throw ingredientsError
      }

      setSuccess('Recipe updated successfully!')
      setTimeout(() => {
        router.push(`/recipes/${recipeId}`)
      }, 1500)
    } catch (err: any) {
      console.error('Error saving recipe:', err)
      setError(err.message || 'Failed to save recipe')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Container>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      </Container>
    )
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Edit Recipe</Typography>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push(`/recipes/${recipeId}`)}
        >
          Back to Recipe
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Basic Information */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Basic Information
              </Typography>

              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Recipe Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    multiline
                    rows={2}
                  />
                </Grid>

                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'end' }}>
                    <TextField
                      fullWidth
                      label="Image URL"
                      value={imageUrl}
                      onChange={(e) => handleImageUrlChange(e.target.value)}
                      placeholder="https://example.com/image.jpg"
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <ImageIcon />
                          </InputAdornment>
                        )
                      }}
                    />
                    <Button
                      variant="outlined"
                      startIcon={<UploadIcon />}
                      onClick={() => imageUploadRef.current?.click()}
                      disabled={uploadingImage}
                    >
                      {uploadingImage ? 'Uploading...' : 'Upload'}
                    </Button>
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      ref={imageUploadRef}
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleImageUpload(file)
                      }}
                    />
                  </Box>
                </Grid>

                {imageUrl && (
                  <Grid item xs={12}>
                    <Box sx={{ mt: 1, textAlign: 'center' }}>
                      <img
                        src={imageUrl}
                        alt={name}
                        style={{
                          maxWidth: '100%',
                          maxHeight: '300px',
                          borderRadius: '8px'
                        }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none'
                        }}
                      />
                    </Box>
                  </Grid>
                )}

                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Category</InputLabel>
                    <Select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      label="Category"
                    >
                      <MenuItem value="">None</MenuItem>
                      {categories.map((cat) => (
                        <MenuItem key={cat.id} value={cat.name}>
                          {cat.display_name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Cuisine</InputLabel>
                    <Select
                      value={cuisine}
                      onChange={(e) => setCuisine(e.target.value)}
                      label="Cuisine"
                    >
                      <MenuItem value="">None</MenuItem>
                      {CUISINE_TYPES.map((c) => (
                        <MenuItem key={c} value={c}>
                          {c}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={6} sm={3}>
                  <TextField
                    fullWidth
                    label="Prep Time (min)"
                    type="number"
                    value={prepTime}
                    onChange={(e) => setPrepTime(Number(e.target.value))}
                    InputProps={{
                      startAdornment: <TimerIcon sx={{ mr: 1, color: 'text.secondary' }} />
                    }}
                  />
                </Grid>

                <Grid item xs={6} sm={3}>
                  <TextField
                    fullWidth
                    label="Cook Time (min)"
                    type="number"
                    value={cookTime}
                    onChange={(e) => setCookTime(Number(e.target.value))}
                    InputProps={{
                      startAdornment: <TimerIcon sx={{ mr: 1, color: 'text.secondary' }} />
                    }}
                  />
                </Grid>

                <Grid item xs={6} sm={3}>
                  <TextField
                    fullWidth
                    label="Servings"
                    type="number"
                    value={servings}
                    onChange={(e) => setServings(Number(e.target.value))}
                    InputProps={{
                      startAdornment: <ServingsIcon sx={{ mr: 1, color: 'text.secondary' }} />
                    }}
                  />
                </Grid>

                <Grid item xs={6} sm={3}>
                  <FormControl fullWidth>
                    <InputLabel>Difficulty</InputLabel>
                    <Select
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value)}
                      label="Difficulty"
                    >
                      {DIFFICULTY_LEVELS.map((level) => (
                        <MenuItem key={level} value={level}>
                          {level.charAt(0).toUpperCase() + level.slice(1)}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Source URL"
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    placeholder="https://example.com/recipe"
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Instructions */}
          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Instructions
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={8}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Enter step-by-step instructions..."
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Side Panel */}
        <Grid item xs={12} md={4}>
          {/* Rating System */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Rating & Reviews
              </Typography>

              {/* Average Rating Display */}
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Rating value={averageRating} readOnly precision={0.1} />
                <Typography variant="body2" sx={{ ml: 1 }}>
                  {averageRating.toFixed(1)} ({totalRatings} {totalRatings === 1 ? 'rating' : 'ratings'})
                </Typography>
              </Box>

              {/* User's Rating */}
              {currentFamilyMember && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" gutterBottom>
                    Your Rating:
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
                <Typography variant="subtitle1">
                  Comments ({comments.length})
                </Typography>
                <Button
                  size="small"
                  startIcon={<CommentIcon />}
                  onClick={() => setShowCommentDialog(true)}
                  disabled={!currentFamilyMember}
                >
                  Add Comment
                </Button>
              </Box>

              {/* Comments List */}
              <Box sx={{ maxHeight: 300, overflowY: 'auto' }}>
                {comments.map((comment) => (
                  <Box key={comment.id} sx={{ mb: 2, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <Avatar sx={{ width: 24, height: 24, mr: 1, fontSize: '0.75rem' }}>
                        {comment.family_members.name.charAt(0)}
                      </Avatar>
                      <Typography variant="caption" color="text.secondary">
                        {comment.family_members.name} • {format(new Date(comment.created_at), 'MMM d, yyyy')}
                      </Typography>
                    </Box>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      {comment.comment}
                    </Typography>
                    {comment.image_url && (
                      <Box sx={{ mt: 1 }}>
                        <img
                          src={comment.image_url}
                          alt="Comment"
                          style={{
                            maxWidth: '100%',
                            maxHeight: '150px',
                            borderRadius: '4px',
                            objectFit: 'cover'
                          }}
                        />
                      </Box>
                    )}
                  </Box>
                ))}
                {comments.length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                    No comments yet. Be the first to share your thoughts!
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>

          {/* Tags */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Tags
              </Typography>

              <Box sx={{ mb: 2 }}>
                <TextField
                  fullWidth
                  size="small"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="Add a tag"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddTag()
                    }
                  }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={handleAddTag}>
                          <AddIcon />
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                />
              </Box>

              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {tags.map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    onDelete={() => handleRemoveTag(tag)}
                    size="small"
                  />
                ))}
              </Box>
            </CardContent>
          </Card>

          {/* Ingredients */}
          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">Ingredients</Typography>
                <IconButton onClick={handleAddIngredient} color="primary">
                  <AddIcon />
                </IconButton>
              </Box>

              <List>
                {ingredients.map((ingredient, index) => (
                  <ListItem key={index} sx={{ px: 0 }}>
                    <Grid container spacing={1} alignItems="center">
                      <Grid item xs={3}>
                        <TextField
                          size="small"
                          type="number"
                          value={ingredient.quantity}
                          onChange={(e) => handleUpdateIngredient(index, 'quantity', Number(e.target.value))}
                          placeholder="Qty"
                        />
                      </Grid>
                      <Grid item xs={3}>
                        <Autocomplete
                          size="small"
                          value={ingredient.unit}
                          onChange={(e, value) => handleUpdateIngredient(index, 'unit', value || '')}
                          options={COMMON_UNITS}
                          freeSolo
                          renderInput={(params) => (
                            <TextField {...params} placeholder="Unit" />
                          )}
                        />
                      </Grid>
                      <Grid item xs={5}>
                        <TextField
                          size="small"
                          fullWidth
                          value={ingredient.ingredient_name}
                          onChange={(e) => handleUpdateIngredient(index, 'ingredient_name', e.target.value)}
                          placeholder="Ingredient"
                        />
                      </Grid>
                      <Grid item xs={1}>
                        <IconButton
                          size="small"
                          onClick={() => handleRemoveIngredient(index)}
                          color="error"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Grid>
                    </Grid>
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Action Buttons */}
      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
        <Button
          variant="outlined"
          onClick={() => router.push(`/recipes/${recipeId}`)}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </Box>

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
            sx={{ mb: 2 }}
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
    </Container>
  )
}