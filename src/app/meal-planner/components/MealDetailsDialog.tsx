'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Chip,
  IconButton,
  Divider,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Grid
} from '@mui/material'
import {
  Close,
  Restaurant,
  Schedule,
  OpenInNew,
  LocalDining,
  Edit,
  AutoAwesome,
  Search,
  Star,
  StarBorder,
  ImageNotSupported,
  BookmarkAdd,
  Bookmark
} from '@mui/icons-material'

interface PlannedMeal {
  id?: string
  date: string
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  recipeId?: string
  customMealName?: string
  recipeName?: string
  recipeUrl?: string
  recipeLink?: string
  recipeImage?: string
  recipeSummary?: string
  recipeRating?: number
  recipeReviewCount?: number
  dietaryTags?: string[]
  dietaryNeeds?: string[]
  servings: number
  prepTime?: number
  cookTime?: number
  notes?: string
  accepted?: boolean
}

interface MealDetailsDialogProps {
  open: boolean
  onClose: () => void
  meal: PlannedMeal | null
  date: string
  mealType: string
  onReplaceMeal?: (newMeal: PlannedMeal) => void
  onEditMeal?: () => void
  onAddToRecipes?: (meal: PlannedMeal) => void
}

export default function MealDetailsDialog({
  open,
  onClose,
  meal,
  date,
  mealType,
  onReplaceMeal,
  onEditMeal,
  onAddToRecipes
}: MealDetailsDialogProps) {
  const [suggestionMode, setSuggestionMode] = useState(false)
  const [suggestionType, setSuggestionType] = useState<'protein' | 'cuisine' | 'dietary' | 'custom'>('protein')
  const [suggestionValue, setSuggestionValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<PlannedMeal[]>([])
  const [addingToRecipes, setAddingToRecipes] = useState(false)
  const [isRecipeSaved, setIsRecipeSaved] = useState(false)

  if (!meal) return null

  // Check if this is an external recipe (has URL but no local recipeId)
  const isExternalRecipe = (meal.recipeUrl || meal.recipeLink) && !meal.recipeId

  // Extract recipe source from URL
  const getRecipeSource = (url: string | undefined) => {
    if (!url) return null
    try {
      const domain = new URL(url).hostname
      const sourceName = domain
        .replace('www.', '')
        .replace('.com', '')
        .replace('.co.uk', '')
        .split('.')[0]
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
      return sourceName
    } catch {
      return null
    }
  }

  const handleAddToRecipes = async () => {
    if (!meal || !onAddToRecipes) return

    setAddingToRecipes(true)
    try {
      await onAddToRecipes(meal)
      setIsRecipeSaved(true)
    } catch (error) {
      console.error('Error adding recipe:', error)
    } finally {
      setAddingToRecipes(false)
    }
  }

  const renderStarRating = (rating: number, reviewCount?: number) => {
    const stars = []
    const fullStars = Math.floor(rating)
    const hasHalfStar = rating % 1 !== 0

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(<Star key={i} fontSize="small" sx={{ color: '#ffc107' }} />)
      } else if (i === fullStars && hasHalfStar) {
        stars.push(<Star key={i} fontSize="small" sx={{ color: '#ffc107', opacity: 0.5 }} />)
      } else {
        stars.push(<StarBorder key={i} fontSize="small" sx={{ color: '#e0e0e0' }} />)
      }
    }

    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        {stars}
        <Typography variant="body2" sx={{ ml: 0.5, fontWeight: 'bold' }}>
          {rating.toFixed(1)}
        </Typography>
        {reviewCount && (
          <Typography variant="caption" color="text.secondary">
            ({reviewCount.toLocaleString()} reviews)
          </Typography>
        )}
      </Box>
    )
  }

  const handleRequestSuggestions = async () => {
    setLoading(true)
    try {
      // Mock API call for suggestions
      await new Promise(resolve => setTimeout(resolve, 1500)) // Simulate API delay

      const mockSuggestions = [
        {
          id: `suggestion-1`,
          date,
          mealType: mealType as any,
          customMealName: suggestionType === 'protein' && suggestionValue.toLowerCase().includes('chicken')
            ? 'Grilled Chicken & Vegetables'
            : suggestionType === 'cuisine' && suggestionValue.toLowerCase().includes('italian')
            ? 'Chicken Parmigiana'
            : 'Pan-Seared Salmon',
          recipeSummary: suggestionType === 'protein' && suggestionValue.toLowerCase().includes('chicken')
            ? 'Herb-marinated chicken breast with seasonal roasted vegetables'
            : suggestionType === 'cuisine' && suggestionValue.toLowerCase().includes('italian')
            ? 'Breaded chicken breast topped with marinara and melted mozzarella'
            : 'Fresh salmon fillet with lemon butter sauce and herbs',
          recipeImage: suggestionType === 'protein' && suggestionValue.toLowerCase().includes('chicken')
            ? 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=400'
            : suggestionType === 'cuisine' && suggestionValue.toLowerCase().includes('italian')
            ? 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400'
            : 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400',
          recipeRating: 4.6,
          recipeReviewCount: 1250,
          servings: 4,
          prepTime: 25,
          dietaryTags: ['gluten-free']
        },
        {
          id: `suggestion-2`,
          date,
          mealType: mealType as any,
          customMealName: suggestionType === 'protein' && suggestionValue.toLowerCase().includes('chicken')
            ? 'Chicken Stir Fry'
            : suggestionType === 'cuisine' && suggestionValue.toLowerCase().includes('italian')
            ? 'Spaghetti Carbonara'
            : 'Quinoa Buddha Bowl',
          recipeSummary: suggestionType === 'protein' && suggestionValue.toLowerCase().includes('chicken')
            ? 'Tender chicken with colorful vegetables in a savory sauce'
            : suggestionType === 'cuisine' && suggestionValue.toLowerCase().includes('italian')
            ? 'Classic Roman pasta with eggs, cheese, and pancetta'
            : 'Nutritious bowl with quinoa, fresh vegetables, and tahini dressing',
          recipeImage: suggestionType === 'protein' && suggestionValue.toLowerCase().includes('chicken')
            ? 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=400'
            : suggestionType === 'cuisine' && suggestionValue.toLowerCase().includes('italian')
            ? 'https://images.unsplash.com/photo-1551892374-ecf8845cc2b5?w=400'
            : 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400',
          recipeRating: 4.4,
          recipeReviewCount: 890,
          servings: 4,
          prepTime: 30,
          dietaryTags: ['vegetarian']
        },
        {
          id: `suggestion-3`,
          date,
          mealType: mealType as any,
          customMealName: suggestionType === 'protein' && suggestionValue.toLowerCase().includes('chicken')
            ? 'Chicken Caesar Salad'
            : 'Mediterranean Pasta Salad',
          recipeSummary: suggestionType === 'protein' && suggestionValue.toLowerCase().includes('chicken')
            ? 'Crisp romaine with grilled chicken and classic Caesar dressing'
            : 'Fresh pasta salad with olives, tomatoes, and feta cheese',
          recipeImage: suggestionType === 'protein' && suggestionValue.toLowerCase().includes('chicken')
            ? 'https://images.unsplash.com/photo-1546793665-c74683f339c1?w=400'
            : 'https://images.unsplash.com/photo-1621510456681-2330135e5871?w=400',
          recipeRating: 4.7,
          recipeReviewCount: 2100,
          servings: 4,
          prepTime: 15,
          dietaryTags: ['quick-prep']
        }
      ]

      setSuggestions(mockSuggestions)
    } catch (error) {
      console.error('Error getting suggestions:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectSuggestion = (suggestion: PlannedMeal) => {
    onReplaceMeal?.(suggestion)
    setSuggestionMode(false)
    setSuggestions([])
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">
            {suggestionMode ? 'Find New Suggestions' : 'Meal Details'}
          </Typography>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {!suggestionMode ? (
          // Meal Details View
          <Box>
            {/* Recipe Image and Title */}
            <Grid container spacing={2} sx={{ mb: 2 }}>
              {meal.recipeImage && (
                <Grid item xs={12} sm={4}>
                  <Box
                    component="img"
                    src={meal.recipeImage}
                    alt={meal.recipeName || meal.customMealName}
                    sx={{
                      width: '100%',
                      height: 200,
                      objectFit: 'cover',
                      borderRadius: 2,
                      bgcolor: 'grey.100'
                    }}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                      e.currentTarget.nextElementSibling.style.display = 'flex'
                    }}
                  />
                  <Box
                    sx={{
                      width: '100%',
                      height: 200,
                      display: 'none',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: 'grey.100',
                      borderRadius: 2,
                      flexDirection: 'column',
                      gap: 1
                    }}
                  >
                    <ImageNotSupported sx={{ fontSize: 48, color: 'grey.400' }} />
                    <Typography variant="caption" color="text.secondary">
                      No image available
                    </Typography>
                  </Box>
                </Grid>
              )}
              <Grid item xs={12} sm={meal.recipeImage ? 8 : 12}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Typography variant="h5">
                    {meal.recipeName || meal.customMealName}
                  </Typography>

                  {/* Recipe Source */}
                  {(meal.recipeUrl || meal.recipeLink) && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <OpenInNew fontSize="small" color="action" />
                      <Typography variant="body2" color="text.secondary">
                        From {getRecipeSource(meal.recipeUrl || meal.recipeLink)}
                      </Typography>
                    </Box>
                  )}

                  {/* Rating */}
                  {meal.recipeRating && (
                    <Box sx={{ mb: 1 }}>
                      {renderStarRating(meal.recipeRating, meal.recipeReviewCount)}
                    </Box>
                  )}

                  {/* Recipe Summary */}
                  {meal.recipeSummary && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {meal.recipeSummary}
                    </Typography>
                  )}

                  {/* Recipe Action Buttons */}
                  {(meal.recipeId || meal.recipeUrl || meal.recipeLink) && (
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Button
                        variant="outlined"
                        startIcon={(meal.recipeUrl || meal.recipeLink) ? <OpenInNew /> : <LocalDining />}
                        onClick={() => {
                          const url = meal.recipeUrl || meal.recipeLink
                          if (url) {
                            window.open(url, '_blank', 'noopener,noreferrer')
                          } else if (meal.recipeId) {
                            window.open(`/recipes/${meal.recipeId}`, '_blank', 'noopener,noreferrer')
                          }
                        }}
                      >
                        View Full Recipe
                      </Button>

                      {/* Add to Recipes button for external recipes */}
                      {isExternalRecipe && !isRecipeSaved && (
                        <Button
                          variant="contained"
                          startIcon={addingToRecipes ? <CircularProgress size={16} /> : <BookmarkAdd />}
                          onClick={handleAddToRecipes}
                          disabled={addingToRecipes}
                          color="success"
                        >
                          {addingToRecipes ? 'Adding...' : 'Add to My Recipes'}
                        </Button>
                      )}

                      {/* Recipe saved indicator */}
                      {isExternalRecipe && isRecipeSaved && (
                        <Button
                          variant="outlined"
                          startIcon={<Bookmark />}
                          disabled
                          color="success"
                        >
                          Added to Recipes ✓
                        </Button>
                      )}
                    </Box>
                  )}
                </Box>
              </Grid>
            </Grid>

            {/* Dietary Tags */}
            {meal.dietaryTags && meal.dietaryTags.length > 0 && (
              <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                {meal.dietaryTags.map(tag => (
                  <Chip
                    key={tag}
                    label={tag}
                    size="small"
                    color={
                      tag.includes('vegetarian') || tag.includes('vegan') ? 'success' :
                      tag.includes('gluten') || tag.includes('dairy') ? 'warning' :
                      'default'
                    }
                  />
                ))}
              </Box>
            )}

            {/* Meal Info */}
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Schedule fontSize="small" />
                  <Typography variant="body2">
                    {meal.prepTime} min prep
                    {meal.cookTime && ` + ${meal.cookTime} min cook`}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Restaurant fontSize="small" />
                  <Typography variant="body2">
                    {meal.servings} servings
                  </Typography>
                </Box>
              </Grid>
            </Grid>

            {meal.notes && (
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="body2">{meal.notes}</Typography>
              </Alert>
            )}

            <Divider sx={{ my: 2 }} />

            {/* Action Buttons */}
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Button
                variant="outlined"
                startIcon={<Edit />}
                onClick={onEditMeal}
              >
                Edit Manually
              </Button>
              <Button
                variant="outlined"
                startIcon={<AutoAwesome />}
                onClick={() => setSuggestionMode(true)}
              >
                Get New Suggestions
              </Button>
            </Box>
          </Box>
        ) : (
          // Suggestion Mode View
          <Box>
            <Typography variant="h6" gutterBottom>
              What type of meal are you looking for?
            </Typography>

            <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>Suggestion Type</InputLabel>
                <Select
                  value={suggestionType}
                  onChange={(e) => setSuggestionType(e.target.value as any)}
                  label="Suggestion Type"
                >
                  <MenuItem value="protein">By Protein</MenuItem>
                  <MenuItem value="cuisine">By Cuisine</MenuItem>
                  <MenuItem value="dietary">By Diet</MenuItem>
                  <MenuItem value="custom">Custom Request</MenuItem>
                </Select>
              </FormControl>

              <TextField
                size="small"
                label={
                  suggestionType === 'protein' ? 'Enter protein (e.g., chicken, salmon)' :
                  suggestionType === 'cuisine' ? 'Enter cuisine (e.g., Italian, Asian)' :
                  suggestionType === 'dietary' ? 'Enter diet type (e.g., vegetarian, keto)' :
                  'Describe what you want'
                }
                value={suggestionValue}
                onChange={(e) => setSuggestionValue(e.target.value)}
                sx={{ flexGrow: 1, minWidth: 200 }}
                placeholder={
                  suggestionType === 'protein' ? 'chicken' :
                  suggestionType === 'cuisine' ? 'Italian' :
                  suggestionType === 'dietary' ? 'vegetarian' :
                  'I want a salad tonight'
                }
              />

              <Button
                variant="contained"
                startIcon={loading ? <CircularProgress size={16} /> : <Search />}
                onClick={handleRequestSuggestions}
                disabled={!suggestionValue.trim() || loading}
              >
                Find Options
              </Button>
            </Box>

            {/* Suggestions Results */}
            {suggestions.length > 0 && (
              <Box>
                <Typography variant="subtitle1" gutterBottom>
                  Here are some suggestions:
                </Typography>
                <Grid container spacing={2}>
                  {suggestions.map((suggestion) => (
                    <Grid item xs={12} md={4} key={suggestion.id}>
                      <Card variant="outlined" sx={{ cursor: 'pointer', '&:hover': { boxShadow: 3 } }} onClick={() => handleSelectSuggestion(suggestion)}>
                        {suggestion.recipeImage && (
                          <Box
                            component="img"
                            src={suggestion.recipeImage}
                            alt={suggestion.customMealName}
                            sx={{
                              width: '100%',
                              height: 150,
                              objectFit: 'cover'
                            }}
                          />
                        )}
                        <CardContent>
                          <Typography variant="subtitle2" gutterBottom>
                            {suggestion.customMealName}
                          </Typography>

                          {suggestion.recipeSummary && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                              {suggestion.recipeSummary}
                            </Typography>
                          )}

                          {suggestion.recipeRating && (
                            <Box sx={{ mb: 1 }}>
                              {renderStarRating(suggestion.recipeRating, suggestion.recipeReviewCount)}
                            </Box>
                          )}

                          {suggestion.dietaryTags && suggestion.dietaryTags.length > 0 && (
                            <Box sx={{ display: 'flex', gap: 0.5, mb: 1, flexWrap: 'wrap' }}>
                              {suggestion.dietaryTags.map(tag => (
                                <Chip
                                  key={tag}
                                  label={tag}
                                  size="small"
                                  variant="outlined"
                                  sx={{ fontSize: '0.7rem', height: 18 }}
                                />
                              ))}
                            </Box>
                          )}

                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="caption" color="text.secondary">
                              <Schedule fontSize="small" sx={{ fontSize: 12, mr: 0.5, verticalAlign: 'middle' }} />
                              {suggestion.prepTime} min • {suggestion.servings} servings
                            </Typography>
                            <Button size="small" variant="outlined">
                              Select
                            </Button>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            )}

            {loading && (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
                <CircularProgress />
                <Typography variant="body2" sx={{ ml: 2 }}>
                  Finding suggestions for you...
                </Typography>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>
          {suggestionMode ? 'Back' : 'Close'}
        </Button>
        {suggestionMode && (
          <Button onClick={() => setSuggestionMode(false)} variant="outlined">
            Back to Details
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}