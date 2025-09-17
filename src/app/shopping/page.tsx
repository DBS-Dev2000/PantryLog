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
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Checkbox,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Paper,
  Fab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  CircularProgress
} from '@mui/material'
import {
  ShoppingCart as ShoppingIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  AutoAwesome as AutoIcon,
  Store as StoreIcon,
  AttachMoney as MoneyIcon,
  Check as CheckIcon,
  List as ListIcon,
  SmartToy as AIIcon
} from '@mui/icons-material'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import FeatureGuard from '@/components/FeatureGuard'

interface ShoppingListItem {
  id: string
  item_name: string
  brand?: string
  category?: string
  quantity: number
  unit: string
  estimated_price?: number
  is_purchased: boolean
  priority: number
  auto_added: boolean
  notes?: string
}

interface ShoppingList {
  id: string
  name: string
  status: string
  total_estimated_cost: number
  created_at: string
  items: ShoppingListItem[]
}

const priorities = [
  { value: 1, label: 'Low', color: 'default' },
  { value: 2, label: 'Normal', color: 'primary' },
  { value: 3, label: 'Medium', color: 'warning' },
  { value: 4, label: 'High', color: 'error' },
  { value: 5, label: 'Urgent', color: 'error' }
]

export default function ShoppingPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [shoppingList, setShoppingList] = useState<ShoppingList | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [predictiveItems, setPredictiveItems] = useState<any[]>([])
  const [loadingPredictions, setLoadingPredictions] = useState(false)
  const [hasFeatureAccess, setHasFeatureAccess] = useState<{[key: string]: boolean}>({})

  const [addItemDialog, setAddItemDialog] = useState(false)
  const [newItem, setNewItem] = useState({
    item_name: '',
    brand: '',
    category: '',
    quantity: 1,
    unit: 'pieces',
    estimated_price: 0,
    priority: 2,
    notes: ''
  })

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUser(session.user)
        await loadShoppingList(session.user.id)
        await checkFeatureAccess(session.user.id)
      } else {
        router.push('/auth')
      }
    }

    getUser()
  }, [router])

  const checkFeatureAccess = async (userId: string) => {
    try {
      const { data: features, error } = await supabase
        .rpc('get_household_features', { p_household_id: userId })

      if (error) {
        console.warn('Feature access check failed:', error)
        // Default to free tier features
        setHasFeatureAccess({
          predictive_shopping: false,
          household_sharing: false,
          ai_recognition: false
        })
      } else {
        const featureMap = {}
        features?.forEach((feature: any) => {
          featureMap[feature.feature_name] = feature.is_available
        })
        setHasFeatureAccess(featureMap)
        console.log('✅ Feature access loaded:', Object.keys(featureMap).length, 'features')
      }
    } catch (err: any) {
      console.error('Error checking feature access:', err)
    }
  }

  const generatePredictiveList = async () => {
    if (!hasFeatureAccess.predictive_shopping) {
      setError('Predictive shopping lists require Basic Plan or higher. Upgrade in Settings → Subscription.')
      return
    }

    setLoadingPredictions(true)
    try {
      const response = await fetch('/api/generate-predictive-list', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: user?.id,
          prediction_days: 14
        })
      })

      if (!response.ok) {
        throw new Error('Failed to generate predictions')
      }

      const data = await response.json()
      setPredictiveItems(data.predicted_items || [])

      if (data.predicted_items?.length > 0) {
        setSuccess(`🔮 AI predicted ${data.predicted_items.length} items you'll need based on your consumption patterns!`)
      } else {
        setError('No predictions available yet. Use PantryIQ for a few weeks to build consumption patterns.')
      }

    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoadingPredictions(false)
    }
  }

  const loadShoppingList = async (userId: string) => {
    setLoading(true)
    try {
      // Find or create active shopping list
      let { data: existingList, error: listError } = await supabase
        .from('shopping_lists')
        .select('*')
        .eq('household_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (listError && listError.code !== 'PGRST116') throw listError

      // Create shopping list if none exists
      if (!existingList) {
        const { data: newList, error: createError } = await supabase
          .from('shopping_lists')
          .insert([{
            household_id: userId,
            name: 'Shopping List',
            created_by: userId
          }])
          .select()
          .single()

        if (createError) throw createError
        existingList = newList
      }

      // Load shopping list items
      const { data: items, error: itemsError } = await supabase
        .from('shopping_list_items')
        .select('*')
        .eq('shopping_list_id', existingList.id)
        .order('priority', { ascending: false })
        .order('created_at')

      if (itemsError) throw itemsError

      setShoppingList({
        ...existingList,
        items: items || []
      })

      console.log('🛒 Shopping list loaded:', items?.length || 0, 'items')

    } catch (err: any) {
      console.error('Error loading shopping list:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const generateLowInventoryList = async () => {
    if (!user || !shoppingList) return

    setSaving(true)
    try {
      // Call function to add low inventory items
      const { data: itemsAdded, error } = await supabase
        .rpc('add_low_inventory_to_shopping_list', {
          p_household_id: user.id,
          p_user_id: user.id,
          p_min_quantity: 2 // Items with 2 or less
        })

      if (error) throw error

      setSuccess(`Added ${itemsAdded} low inventory items to shopping list!`)
      await loadShoppingList(user.id)

    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const addManualItem = async () => {
    if (!user || !shoppingList || !newItem.item_name) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('shopping_list_items')
        .insert([{
          shopping_list_id: shoppingList.id,
          item_name: newItem.item_name,
          brand: newItem.brand || null,
          category: newItem.category || null,
          quantity: newItem.quantity,
          unit: newItem.unit,
          estimated_price: newItem.estimated_price || null,
          priority: newItem.priority,
          notes: newItem.notes || null,
          added_by: user.id
        }])

      if (error) throw error

      setSuccess('Item added to shopping list!')
      setAddItemDialog(false)
      setNewItem({
        item_name: '',
        brand: '',
        category: '',
        quantity: 1,
        unit: 'pieces',
        estimated_price: 0,
        priority: 2,
        notes: ''
      })
      await loadShoppingList(user.id)

    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const toggleItemPurchased = async (itemId: string, purchased: boolean) => {
    try {
      const { error } = await supabase
        .from('shopping_list_items')
        .update({
          is_purchased: purchased,
          purchased_at: purchased ? new Date().toISOString() : null
        })
        .eq('id', itemId)

      if (error) throw error

      await loadShoppingList(user.id)
    } catch (err: any) {
      setError(err.message)
    }
  }

  const deleteItem = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from('shopping_list_items')
        .delete()
        .eq('id', itemId)

      if (error) throw error

      await loadShoppingList(user.id)
    } catch (err: any) {
      setError(err.message)
    }
  }

  const getPriorityColor = (priority: number) => {
    const priorityConfig = priorities.find(p => p.value === priority)
    return priorityConfig?.color || 'default'
  }

  const getTotalCost = () => {
    return shoppingList?.items
      .filter(item => !item.is_purchased)
      .reduce((sum, item) => sum + (item.estimated_price || 0), 0) || 0
  }

  const getCompletedCount = () => {
    return shoppingList?.items.filter(item => item.is_purchased).length || 0
  }

  if (!user || loading) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Typography>Loading shopping list...</Typography>
      </Container>
    )
  }

  return (
    <FeatureGuard feature="shopping_list_sharing">
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Box display="flex" alignItems="center" mb={4}>
        <ShoppingIcon sx={{ mr: 2, fontSize: 32, color: 'primary.main' }} />
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Shopping List
          </Typography>
          <Typography variant="body1" color="textSecondary">
            Smart shopping list with inventory integration
          </Typography>
        </Box>
        <Box display="flex" gap={1} flexWrap="wrap">
          <Button
            variant="outlined"
            startIcon={<AutoIcon />}
            onClick={generateLowInventoryList}
            disabled={saving}
            color="secondary"
          >
            Add Low Items
          </Button>
          {hasFeatureAccess.predictive_shopping && (
            <Button
              variant="outlined"
              startIcon={loadingPredictions ? <CircularProgress size={20} /> : <AIIcon />}
              onClick={generatePredictiveList}
              disabled={loadingPredictions}
              color="primary"
            >
              🔮 AI Predictions
            </Button>
          )}
        </Box>
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

      {/* Shopping List Summary */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={4}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h6" color="primary.main">
              {shoppingList?.items.length || 0}
            </Typography>
            <Typography variant="caption" color="textSecondary">
              Total Items
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={4}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h6" color="secondary.main">
              {getCompletedCount()}
            </Typography>
            <Typography variant="caption" color="textSecondary">
              Completed
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={4}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h6" color="success.main">
              ${getTotalCost().toFixed(2)}
            </Typography>
            <Typography variant="caption" color="textSecondary">
              Estimated Cost
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Shopping List Items */}
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">
              Items ({shoppingList?.items.filter(i => !i.is_purchased).length || 0} remaining)
            </Typography>
          </Box>

          {!shoppingList?.items.length ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <ShoppingIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="textSecondary" gutterBottom>
                Your shopping list is empty
              </Typography>
              <Typography variant="body2" color="textSecondary" paragraph>
                Add items manually or automatically from low inventory
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setAddItemDialog(true)}
                color="primary"
              >
                Add First Item
              </Button>
            </Box>
          ) : (
            <List>
              {shoppingList.items.map((item) => (
                <ListItem
                  key={item.id}
                  sx={{
                    border: '1px solid #eee',
                    borderRadius: 1,
                    mb: 1,
                    backgroundColor: item.is_purchased ? 'grey.50' : 'white',
                    opacity: item.is_purchased ? 0.7 : 1
                  }}
                >
                  <Checkbox
                    checked={item.is_purchased}
                    onChange={(e) => toggleItemPurchased(item.id, e.target.checked)}
                    sx={{ mr: 1 }}
                  />
                  <ListItemText
                    primary={
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography
                          variant="body1"
                          sx={{
                            textDecoration: item.is_purchased ? 'line-through' : 'none',
                            fontWeight: item.is_purchased ? 'normal' : 'medium'
                          }}
                        >
                          {item.item_name}
                        </Typography>
                        {item.brand && (
                          <Typography variant="caption" color="textSecondary">
                            ({item.brand})
                          </Typography>
                        )}
                        <Chip
                          size="small"
                          label={priorities.find(p => p.value === item.priority)?.label || 'Normal'}
                          color={getPriorityColor(item.priority) as any}
                          variant="outlined"
                        />
                        {item.auto_added && (
                          <Chip size="small" label="Auto" color="info" variant="outlined" />
                        )}
                      </Box>
                    }
                    secondary={
                      <Box display="flex" alignItems="center" gap={2} sx={{ mt: 0.5 }}>
                        <Typography variant="body2">
                          {item.quantity} {item.unit}
                        </Typography>
                        {item.estimated_price && (
                          <Typography variant="body2" color="success.main">
                            ~${item.estimated_price.toFixed(2)}
                          </Typography>
                        )}
                        {item.category && (
                          <Chip size="small" label={item.category} variant="outlined" />
                        )}
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      size="small"
                      onClick={() => deleteItem(item.id)}
                      color="error"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      {/* Future Store Integration Card */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            🚀 Coming Soon: Store Integration
          </Typography>
          <Typography variant="body2" color="textSecondary" paragraph>
            Future versions will support automatic ordering through store APIs
          </Typography>
          <Box display="flex" gap={1} flexWrap="wrap">
            <Chip label="Walmart API" variant="outlined" size="small" />
            <Chip label="Target API" variant="outlined" size="small" />
            <Chip label="Kroger API" variant="outlined" size="small" />
            <Chip label="Instacart API" variant="outlined" size="small" />
          </Box>
        </CardContent>
      </Card>

      {/* Add Item Dialog */}
      <Dialog open={addItemDialog} onClose={() => setAddItemDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Item to Shopping List</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                label="Item Name"
                fullWidth
                value={newItem.item_name}
                onChange={(e) => setNewItem({ ...newItem, item_name: e.target.value })}
                placeholder="e.g., Milk, Bananas, Bread"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Brand"
                fullWidth
                value={newItem.brand}
                onChange={(e) => setNewItem({ ...newItem, brand: e.target.value })}
                placeholder="Optional"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Category"
                fullWidth
                value={newItem.category}
                onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                placeholder="e.g., Dairy, Produce"
              />
            </Grid>
            <Grid item xs={4}>
              <TextField
                label="Quantity"
                type="number"
                fullWidth
                value={newItem.quantity}
                onChange={(e) => setNewItem({ ...newItem, quantity: parseFloat(e.target.value) || 1 })}
                inputProps={{ min: 0.1, step: 0.1 }}
              />
            </Grid>
            <Grid item xs={4}>
              <FormControl fullWidth>
                <InputLabel>Unit</InputLabel>
                <Select
                  value={newItem.unit}
                  label="Unit"
                  onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                >
                  <MenuItem value="pieces">pieces</MenuItem>
                  <MenuItem value="lbs">lbs</MenuItem>
                  <MenuItem value="oz">oz</MenuItem>
                  <MenuItem value="gallons">gallons</MenuItem>
                  <MenuItem value="cans">cans</MenuItem>
                  <MenuItem value="boxes">boxes</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={4}>
              <TextField
                label="Est. Price"
                type="number"
                fullWidth
                value={newItem.estimated_price}
                onChange={(e) => setNewItem({ ...newItem, estimated_price: parseFloat(e.target.value) || 0 })}
                inputProps={{ min: 0, step: 0.01 }}
                placeholder="0.00"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Priority</InputLabel>
                <Select
                  value={newItem.priority}
                  label="Priority"
                  onChange={(e) => setNewItem({ ...newItem, priority: Number(e.target.value) })}
                >
                  {priorities.map((p) => (
                    <MenuItem key={p.value} value={p.value}>
                      {p.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddItemDialog(false)}>Cancel</Button>
          <Button
            onClick={addManualItem}
            variant="contained"
            disabled={!newItem.item_name || saving}
            color="primary"
          >
            Add Item
          </Button>
        </DialogActions>
      </Dialog>

      {/* Floating Action Button */}
      <Fab
        color="primary"
        aria-label="add item"
        sx={{
          position: 'fixed',
          bottom: 16,
          right: 16
        }}
        onClick={() => setAddItemDialog(true)}
      >
        <AddIcon />
      </Fab>
      </Container>
    </FeatureGuard>
  )
}