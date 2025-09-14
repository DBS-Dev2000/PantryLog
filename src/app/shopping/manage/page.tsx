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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  FormControlLabel,
  Menu,
  Paper,
  Fab
} from '@mui/material'
import {
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
  Share as ShareIcon,
  MoreVert as MoreIcon,
  Check as CheckIcon,
  Archive as ArchiveIcon,
  Delete as DeleteIcon,
  Group as GroupIcon,
  Person as PersonIcon,
  Lock as PrivateIcon,
  ShoppingCart as ShoppingIcon,
  Edit as EditIcon
} from '@mui/icons-material'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface ShoppingListData {
  list_id: string
  list_name: string
  list_status: string
  sharing_type: string
  total_items: number
  completed_items: number
  estimated_cost: number
  created_by: string
  created_at: string
  is_owner: boolean
  permission_level: string
}

interface HouseholdMember {
  user_id: string
  user_email?: string
  role: string
}

export default function ManageShoppingListsPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [shoppingLists, setShoppingLists] = useState<ShoppingListData[]>([])
  const [householdMembers, setHouseholdMembers] = useState<HouseholdMember[]>([])
  const [tabValue, setTabValue] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Dialog states
  const [createDialog, setCreateDialog] = useState(false)
  const [shareDialog, setShareDialog] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState(false)
  const [selectedList, setSelectedList] = useState<ShoppingListData | null>(null)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)

  // Form states
  const [newListName, setNewListName] = useState('')
  const [newListDescription, setNewListDescription] = useState('')
  const [sharingType, setSharingType] = useState<string>('private')
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  const [deleteConfirmation, setDeleteConfirmation] = useState('')

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUser(session.user)
        await loadShoppingListData(session.user.id)
        await loadHouseholdMembers(session.user.id)
      } else {
        router.push('/auth')
      }
    }

    getUser()
  }, [router])

  const loadShoppingListData = async (userId: string) => {
    setLoading(true)
    try {
      const { data: listsData, error } = await supabase
        .rpc('get_user_shopping_lists', { p_user_id: userId })

      if (error && error.code !== 'PGRST116') {
        console.warn('Shopping list function not available, loading basic lists')
        // Fallback to basic query
        const { data: basicLists } = await supabase
          .from('shopping_lists')
          .select('*')
          .eq('created_by', userId)
          .order('created_at', { ascending: false })

        setShoppingLists((basicLists || []).map(list => ({
          list_id: list.id,
          list_name: list.name,
          list_status: list.status,
          sharing_type: list.sharing_type || 'private',
          total_items: 0,
          completed_items: 0,
          estimated_cost: list.total_estimated_cost || 0,
          created_by: list.created_by,
          created_at: list.created_at,
          is_owner: true,
          permission_level: 'admin'
        })))
      } else {
        setShoppingLists(listsData || [])
      }

      console.log('🛒 Loaded shopping lists:', listsData?.length || 0)

    } catch (err: any) {
      console.error('Error loading shopping lists:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadHouseholdMembers = async (userId: string) => {
    try {
      const { data: members, error } = await supabase
        .from('household_members')
        .select('user_id, role')
        .eq('household_id', userId)
        .neq('user_id', userId) // Exclude current user

      if (error && error.code !== 'PGRST116') {
        console.warn('Household members not available:', error)
      } else {
        setHouseholdMembers(members || [])
      }
    } catch (err: any) {
      console.warn('Error loading household members:', err)
    }
  }

  const createShoppingList = async () => {
    if (!user || !newListName.trim()) return

    try {
      const { data: newList, error } = await supabase
        .from('shopping_lists')
        .insert([{
          household_id: user.id,
          name: newListName,
          description: newListDescription,
          sharing_type: sharingType,
          created_by: user.id
        }])
        .select()
        .single()

      if (error) throw error

      // Share with selected members if needed
      if (sharingType !== 'private' && newList) {
        await shareWithMembers(newList.id)
      }

      setSuccess(`Shopping list "${newListName}" created successfully!`)
      setCreateDialog(false)
      setNewListName('')
      setNewListDescription('')
      setSharingType('private')
      setSelectedMembers([])
      await loadShoppingListData(user.id)

    } catch (err: any) {
      setError(err.message)
    }
  }

  const shareWithMembers = async (listId: string) => {
    if (sharingType === 'shared_all') {
      // Share with all household members
      const { error } = await supabase
        .rpc('share_shopping_list', {
          p_list_id: listId,
          p_shared_by: user.id,
          p_sharing_type: 'shared_all'
        })

      if (error) console.warn('Failed to share with all members:', error)
    } else if (sharingType === 'shared_select' && selectedMembers.length > 0) {
      // Share with selected members
      const { error } = await supabase
        .rpc('share_shopping_list', {
          p_list_id: listId,
          p_shared_by: user.id,
          p_sharing_type: 'shared_select',
          p_selected_users: selectedMembers
        })

      if (error) console.warn('Failed to share with selected members:', error)
    }
  }

  const completeShoppingList = async (listId: string) => {
    try {
      const { error } = await supabase
        .rpc('complete_shopping_list', {
          p_list_id: listId,
          p_user_id: user.id
        })

      if (error) throw error

      setSuccess('Shopping list completed!')
      await loadShoppingListData(user.id)
    } catch (err: any) {
      setError(err.message)
    }
  }

  const archiveShoppingList = async (listId: string) => {
    try {
      const { error } = await supabase
        .rpc('archive_shopping_list', {
          p_list_id: listId,
          p_user_id: user.id
        })

      if (error) throw error

      setSuccess('Shopping list archived!')
      await loadShoppingListData(user.id)
    } catch (err: any) {
      setError(err.message)
    }
  }

  const deleteShoppingList = async () => {
    if (!selectedList || deleteConfirmation.toLowerCase() !== 'delete') {
      setError('Please type "DELETE" to confirm')
      return
    }

    try {
      const { error } = await supabase
        .from('shopping_lists')
        .update({ status: 'deleted' })
        .eq('id', selectedList.list_id)

      if (error) throw error

      setSuccess(`Shopping list "${selectedList.list_name}" deleted!`)
      setDeleteDialog(false)
      setDeleteConfirmation('')
      setSelectedList(null)
      await loadShoppingListData(user.id)
    } catch (err: any) {
      setError(err.message)
    }
  }

  const getFilteredLists = () => {
    const activeTab = tabValue
    switch (activeTab) {
      case 0: // My Lists
        return shoppingLists.filter(list => list.is_owner && list.list_status !== 'deleted')
      case 1: // Shared with Me
        return shoppingLists.filter(list => !list.is_owner && list.list_status !== 'deleted')
      case 2: // Completed
        return shoppingLists.filter(list => list.list_status === 'completed')
      case 3: // Archived
        return shoppingLists.filter(list => list.list_status === 'archived')
      default:
        return shoppingLists
    }
  }

  const getSharingIcon = (sharingType: string) => {
    switch (sharingType) {
      case 'shared_all': return <GroupIcon />
      case 'shared_select': return <PersonIcon />
      default: return <PrivateIcon />
    }
  }

  const getSharingLabel = (sharingType: string) => {
    switch (sharingType) {
      case 'shared_all': return 'All Members'
      case 'shared_select': return 'Select Members'
      default: return 'Private'
    }
  }

  if (!user || loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Typography>Loading shopping lists...</Typography>
      </Container>
    )
  }

  const filteredLists = getFilteredLists()

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Box display="flex" alignItems="center" mb={4}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push('/shopping')}
          sx={{ mr: 2 }}
        >
          Back to Shopping
        </Button>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Manage Shopping Lists
          </Typography>
          <Typography variant="body1" color="textSecondary">
            Create, share, and organize your household shopping lists
          </Typography>
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

      {/* Tabs for List Organization */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={tabValue}
          onChange={(e, newValue) => setTabValue(newValue)}
          variant="fullWidth"
        >
          <Tab label={`My Lists (${shoppingLists.filter(l => l.is_owner && l.list_status !== 'deleted').length})`} />
          <Tab label={`Shared with Me (${shoppingLists.filter(l => !l.is_owner && l.list_status !== 'deleted').length})`} />
          <Tab label={`Completed (${shoppingLists.filter(l => l.list_status === 'completed').length})`} />
          <Tab label={`Archived (${shoppingLists.filter(l => l.list_status === 'archived').length})`} />
        </Tabs>
      </Paper>

      {/* Shopping Lists Grid */}
      {filteredLists.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <ShoppingIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="textSecondary" gutterBottom>
              No shopping lists found
            </Typography>
            <Typography variant="body2" color="textSecondary" paragraph>
              {tabValue === 0 ? 'Create your first shopping list to get started' : 'No lists in this category'}
            </Typography>
            {tabValue === 0 && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setCreateDialog(true)}
                color="primary"
              >
                Create Shopping List
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {filteredLists.map((list) => (
            <Grid item xs={12} sm={6} lg={4} key={list.list_id}>
              <Card>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                    <Typography variant="h6" component="h2">
                      {list.list_name}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        setAnchorEl(e.currentTarget)
                        setSelectedList(list)
                      }}
                    >
                      <MoreIcon />
                    </IconButton>
                  </Box>

                  <Box display="flex" gap={1} mb={2} flexWrap="wrap">
                    <Chip
                      size="small"
                      icon={getSharingIcon(list.sharing_type)}
                      label={getSharingLabel(list.sharing_type)}
                      color={list.sharing_type === 'private' ? 'default' : 'primary'}
                      variant="outlined"
                    />
                    <Chip
                      size="small"
                      label={list.list_status}
                      color={
                        list.list_status === 'active' ? 'success' :
                        list.list_status === 'completed' ? 'primary' : 'default'
                      }
                    />
                    {!list.is_owner && (
                      <Chip
                        size="small"
                        label={`Shared by ${list.created_by.substring(0, 8)}...`}
                        variant="outlined"
                      />
                    )}
                  </Box>

                  <Grid container spacing={2} sx={{ mb: 2 }}>
                    <Grid item xs={4}>
                      <Typography variant="h6" color="primary.main">
                        {list.total_items}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        Items
                      </Typography>
                    </Grid>
                    <Grid item xs={4}>
                      <Typography variant="h6" color="secondary.main">
                        {list.completed_items}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        Done
                      </Typography>
                    </Grid>
                    <Grid item xs={4}>
                      <Typography variant="h6" color="success.main">
                        ${list.estimated_cost.toFixed(2)}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        Est. Cost
                      </Typography>
                    </Grid>
                  </Grid>

                  <Button
                    variant="outlined"
                    fullWidth
                    onClick={() => router.push(`/shopping/list/${list.list_id}`)}
                  >
                    View List
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem onClick={() => {
          setAnchorEl(null)
          router.push(`/shopping/list/${selectedList?.list_id}`)
        }}>
          <EditIcon sx={{ mr: 1 }} />
          Edit List
        </MenuItem>

        {selectedList?.is_owner && (
          <MenuItem onClick={() => {
            setAnchorEl(null)
            setShareDialog(true)
          }}>
            <ShareIcon sx={{ mr: 1 }} />
            Share List
          </MenuItem>
        )}

        {selectedList?.list_status === 'active' && (
          <MenuItem onClick={() => {
            setAnchorEl(null)
            completeShoppingList(selectedList.list_id)
          }}>
            <CheckIcon sx={{ mr: 1 }} />
            Mark Complete
          </MenuItem>
        )}

        {selectedList?.list_status === 'completed' && (
          <MenuItem onClick={() => {
            setAnchorEl(null)
            archiveShoppingList(selectedList.list_id)
          }}>
            <ArchiveIcon sx={{ mr: 1 }} />
            Archive List
          </MenuItem>
        )}

        {selectedList?.is_owner && (
          <MenuItem onClick={() => {
            setAnchorEl(null)
            setDeleteDialog(true)
          }}>
            <DeleteIcon sx={{ mr: 1, color: 'error.main' }} />
            Delete List
          </MenuItem>
        )}
      </Menu>

      {/* Create List Dialog */}
      <Dialog open={createDialog} onClose={() => setCreateDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Shopping List</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                label="List Name"
                fullWidth
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="e.g., Weekly Groceries, Costco Run"
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Description"
                fullWidth
                value={newListDescription}
                onChange={(e) => setNewListDescription(e.target.value)}
                placeholder="Optional description"
                multiline
                rows={2}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Sharing</InputLabel>
                <Select
                  value={sharingType}
                  label="Sharing"
                  onChange={(e) => setSharingType(e.target.value)}
                >
                  <MenuItem value="private">Private (Only Me)</MenuItem>
                  <MenuItem value="shared_all">Shared with All Household Members</MenuItem>
                  <MenuItem value="shared_select">Shared with Selected Members</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {sharingType === 'shared_select' && (
              <Grid item xs={12}>
                <Typography variant="body2" gutterBottom>
                  Select household members:
                </Typography>
                {householdMembers.map((member) => (
                  <FormControlLabel
                    key={member.user_id}
                    control={
                      <Checkbox
                        checked={selectedMembers.includes(member.user_id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedMembers(prev => [...prev, member.user_id])
                          } else {
                            setSelectedMembers(prev => prev.filter(id => id !== member.user_id))
                          }
                        }}
                      />
                    }
                    label={member.user_email || `Member ${member.user_id.substring(0, 8)}`}
                  />
                ))}
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialog(false)}>Cancel</Button>
          <Button
            onClick={createShoppingList}
            variant="contained"
            disabled={!newListName.trim()}
            color="primary"
          >
            Create List
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog} onClose={() => setDeleteDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ color: 'error.main' }}>
          🗑️ Delete Shopping List
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            Are you sure you want to delete "{selectedList?.list_name}"?
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
            This action cannot be undone. All items and sharing will be permanently removed.
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
            onClick={deleteShoppingList}
            variant="contained"
            color="error"
            disabled={deleteConfirmation.toLowerCase() !== 'delete'}
          >
            Delete List
          </Button>
        </DialogActions>
      </Dialog>

      {/* Floating Action Button */}
      <Fab
        color="primary"
        aria-label="create list"
        sx={{
          position: 'fixed',
          bottom: 16,
          right: 16
        }}
        onClick={() => setCreateDialog(true)}
      >
        <AddIcon />
      </Fab>
    </Container>
  )
}