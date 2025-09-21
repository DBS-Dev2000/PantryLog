'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  TextField,
  Chip,
  Avatar,
  AvatarGroup,
  Tooltip,
  CircularProgress,
  Alert,
  Divider,
  Paper
} from '@mui/material'
import {
  ShoppingCart,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Person as PersonIcon,
  Group as GroupIcon,
  Lock as LockIcon,
  LockOpen as UnlockIcon,
  Share as ShareIcon,
  Check as CheckIcon
} from '@mui/icons-material'
import { supabase } from '@/lib/supabase'

interface ShoppingList {
  id: string
  name: string
  description?: string
  status: string
  is_shared: boolean
  is_primary: boolean
  created_by: string
  household_id: string
  item_count?: number
  access_type?: string
}

interface ShoppingListSelectorProps {
  open: boolean
  onClose: () => void
  onSelect: (listId: string, listName: string) => void
  selectedListId?: string | null
  userId: string
  canCreateMultiple?: boolean
  mealPlanIngredients?: any[]
}

export default function ShoppingListSelector({
  open,
  onClose,
  onSelect,
  selectedListId,
  userId,
  canCreateMultiple = false,
  mealPlanIngredients = []
}: ShoppingListSelectorProps) {
  const [lists, setLists] = useState<ShoppingList[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedList, setSelectedList] = useState<string>(selectedListId || '')
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [newListShared, setNewListShared] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      loadShoppingLists()
    }
  }, [open, userId])

  const loadShoppingLists = async () => {
    setLoading(true)
    setError(null)

    try {
      // Get all accessible shopping lists
      const { data: listsData, error: listsError } = await supabase
        .rpc('get_user_shopping_lists', { p_user_id: userId })

      if (listsError) throw listsError

      setLists(listsData || [])

      // Auto-select if only one list or if there's a primary list
      if (listsData && listsData.length === 1) {
        setSelectedList(listsData[0].id)
      } else if (listsData) {
        const primaryList = listsData.find(l => l.is_primary)
        if (primaryList) {
          setSelectedList(primaryList.id)
        }
      }
    } catch (err: any) {
      console.error('Error loading shopping lists:', err)
      setError('Failed to load shopping lists')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateList = async () => {
    if (!newListName.trim()) {
      setError('Please enter a list name')
      return
    }

    setSaving(true)
    setError(null)

    try {
      // Create new shopping list
      const { data: newList, error: createError } = await supabase
        .from('shopping_lists')
        .insert([{
          household_id: userId,
          name: newListName,
          description: `Created for meal planning`,
          is_shared: newListShared,
          shared_with_household: newListShared,
          is_primary: lists.length === 0, // First list is primary
          created_by: userId,
          status: 'active'
        }])
        .select()
        .single()

      if (createError) throw createError

      // Reload lists
      await loadShoppingLists()

      // Select the new list
      setSelectedList(newList.id)
      setCreateDialogOpen(false)
      setNewListName('')

    } catch (err: any) {
      console.error('Error creating shopping list:', err)
      setError('Failed to create shopping list')
    } finally {
      setSaving(false)
    }
  }

  const handleConfirmSelection = () => {
    const list = lists.find(l => l.id === selectedList)
    if (list) {
      onSelect(list.id, list.name)
      onClose()
    }
  }

  const getAccessIcon = (accessType?: string) => {
    switch (accessType) {
      case 'owner':
        return <LockIcon fontSize="small" color="primary" />
      case 'household':
        return <GroupIcon fontSize="small" color="action" />
      case 'shared':
        return <ShareIcon fontSize="small" color="secondary" />
      default:
        return null
    }
  }

  const getAccessLabel = (accessType?: string) => {
    switch (accessType) {
      case 'owner':
        return 'Your List'
      case 'household':
        return 'Household'
      case 'shared':
        return 'Shared'
      default:
        return ''
    }
  }

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <ShoppingCart color="primary" />
            <Typography variant="h6">Select Shopping List</Typography>
          </Box>
        </DialogTitle>

        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {mealPlanIngredients.length > 0 && (
            <Alert severity="info" sx={{ mb: 2 }}>
              {mealPlanIngredients.length} ingredients from your meal plan will be added to the selected list
            </Alert>
          )}

          {loading ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          ) : lists.length === 0 ? (
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body1" gutterBottom>
                No shopping lists found
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setCreateDialogOpen(true)}
                sx={{ mt: 2 }}
              >
                Create Your First List
              </Button>
            </Paper>
          ) : (
            <>
              <RadioGroup
                value={selectedList}
                onChange={(e) => setSelectedList(e.target.value)}
              >
                <List>
                  {lists.map((list) => (
                    <ListItem
                      key={list.id}
                      sx={{
                        border: '1px solid',
                        borderColor: selectedList === list.id ? 'primary.main' : 'divider',
                        borderRadius: 1,
                        mb: 1,
                        transition: 'all 0.2s'
                      }}
                    >
                      <FormControlLabel
                        value={list.id}
                        control={<Radio />}
                        label={
                          <Box>
                            <Box display="flex" alignItems="center" gap={1}>
                              <Typography variant="subtitle1" fontWeight="medium">
                                {list.name}
                              </Typography>
                              {list.is_primary && (
                                <Chip label="Primary" size="small" color="primary" />
                              )}
                              {getAccessIcon(list.access_type)}
                            </Box>
                            <Typography variant="body2" color="text.secondary">
                              {list.item_count || 0} items • {getAccessLabel(list.access_type)}
                            </Typography>
                            {list.description && (
                              <Typography variant="caption" color="text.secondary">
                                {list.description}
                              </Typography>
                            )}
                          </Box>
                        }
                        sx={{ flex: 1 }}
                      />
                      <ListItemSecondaryAction>
                        {list.is_shared && (
                          <Tooltip title="Shared with household">
                            <GroupIcon color="action" />
                          </Tooltip>
                        )}
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              </RadioGroup>

              {canCreateMultiple && (
                <Box mt={2}>
                  <Divider sx={{ mb: 2 }} />
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<AddIcon />}
                    onClick={() => setCreateDialogOpen(true)}
                  >
                    Create New Shopping List
                  </Button>
                </Box>
              )}
            </>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleConfirmSelection}
            variant="contained"
            disabled={!selectedList}
            startIcon={<CheckIcon />}
          >
            Use This List
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create New List Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Create New Shopping List</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label="List Name"
            fullWidth
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            placeholder="e.g., Weekly Groceries, Party Supplies"
            sx={{ mb: 3, mt: 1 }}
          />

          <FormControl component="fieldset">
            <Typography variant="subtitle2" gutterBottom>
              Sharing Options
            </Typography>
            <RadioGroup
              value={newListShared ? 'shared' : 'private'}
              onChange={(e) => setNewListShared(e.target.value === 'shared')}
            >
              <FormControlLabel
                value="shared"
                control={<Radio />}
                label={
                  <Box>
                    <Typography variant="body2">Share with Household</Typography>
                    <Typography variant="caption" color="text.secondary">
                      All household members can view and add items
                    </Typography>
                  </Box>
                }
              />
              <FormControlLabel
                value="private"
                control={<Radio />}
                label={
                  <Box>
                    <Typography variant="body2">Private List</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Only you can access this list
                    </Typography>
                  </Box>
                }
              />
            </RadioGroup>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleCreateList}
            variant="contained"
            disabled={saving || !newListName.trim()}
            startIcon={saving ? <CircularProgress size={20} /> : <AddIcon />}
          >
            {saving ? 'Creating...' : 'Create List'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}