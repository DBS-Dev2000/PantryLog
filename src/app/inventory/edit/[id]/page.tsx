'use client'

import { useState, useEffect } from 'react'
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Button,
  TextField,
  Grid,
  Alert,
  CircularProgress,
  Avatar,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material'
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Edit as EditIcon,
  History as HistoryIcon
} from '@mui/icons-material'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface InventoryItemDetail {
  id: string
  quantity: number
  unit: string
  purchase_date: string
  expiration_date?: string
  cost?: number
  notes?: string
  created_by?: string
  created_at: string
  last_modified_by?: string
  last_modified_at?: string
  products: {
    id: string
    name: string
    brand?: string
    image_url?: string
    upc?: string
  }
  storage_locations: {
    id: string
    name: string
    type: string
  }
}

const units = [
  'pieces', 'lbs', 'oz', 'kg', 'g', 'cups', 'tbsp', 'tsp', 'cans', 'bottles', 'boxes', 'bags'
]

export default function EditInventoryItemPage() {
  const router = useRouter()
  const params = useParams()
  const itemId = params.id as string

  const [user, setUser] = useState<any>(null)
  const [item, setItem] = useState<InventoryItemDetail | null>(null)
  const [originalItem, setOriginalItem] = useState<InventoryItemDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUser(session.user)
        await loadItemData(session.user.id)
      } else {
        router.push('/auth')
      }
    }

    getUser()
  }, [router, itemId])

  const loadItemData = async (userId: string) => {
    setLoading(true)
    try {
      const { data: itemData, error } = await supabase
        .from('inventory_items')
        .select(`
          *,
          products (*),
          storage_locations (*)
        `)
        .eq('id', itemId)
        .eq('household_id', userId)
        .single()

      if (error) throw error

      setItem(itemData as InventoryItemDetail)
      setOriginalItem(itemData as InventoryItemDetail) // Keep original for comparison
      console.log('📦 Loaded item for editing:', itemData.products?.name)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!user || !item || !originalItem) return

    setSaving(true)
    setError(null)

    try {
      // Calculate what changed for audit logging
      const changes: string[] = []
      let hasChanges = false

      if (item.quantity !== originalItem.quantity) {
        changes.push(`Quantity: ${originalItem.quantity} → ${item.quantity}`)
        hasChanges = true
      }
      if (item.unit !== originalItem.unit) {
        changes.push(`Unit: ${originalItem.unit} → ${item.unit}`)
        hasChanges = true
      }
      if (item.purchase_date !== originalItem.purchase_date) {
        changes.push(`Purchase Date: ${originalItem.purchase_date} → ${item.purchase_date}`)
        hasChanges = true
      }
      if (item.expiration_date !== originalItem.expiration_date) {
        changes.push(`Expiration: ${originalItem.expiration_date || 'None'} → ${item.expiration_date || 'None'}`)
        hasChanges = true
      }
      if (item.cost !== originalItem.cost) {
        changes.push(`Cost: $${originalItem.cost || 0} → $${item.cost || 0}`)
        hasChanges = true
      }
      if (item.notes !== originalItem.notes) {
        changes.push(`Notes: ${originalItem.notes || 'None'} → ${item.notes || 'None'}`)
        hasChanges = true
      }

      if (!hasChanges) {
        setError('No changes detected')
        setSaving(false)
        return
      }

      // Update inventory item
      const { error: updateError } = await supabase
        .from('inventory_items')
        .update({
          quantity: item.quantity,
          unit: item.unit,
          purchase_date: item.purchase_date,
          expiration_date: item.expiration_date || null,
          cost: item.cost || null,
          notes: item.notes || null,
          last_modified_by: user.id,
          last_modified_at: new Date().toISOString()
        })
        .eq('id', itemId)

      if (updateError) throw updateError

      // Log the edit in audit trail
      const { error: auditError } = await supabase
        .from('inventory_audit_log')
        .insert([{
          inventory_item_id: itemId,
          household_id: user.id,
          user_id: user.id,
          action_type: 'edit',
          quantity_before: originalItem.quantity,
          quantity_after: item.quantity,
          quantity_delta: item.quantity - originalItem.quantity,
          unit_cost: item.cost ? item.cost / item.quantity : 0,
          total_value: Math.abs(item.quantity - originalItem.quantity) * (item.cost ? item.cost / item.quantity : 0),
          notes: `Manual Edit: ${changes.join('; ')}`,
          source_action: 'manual_edit'
        }])

      if (auditError) {
        console.warn('Failed to log audit trail:', auditError)
      } else {
        console.log('✅ Audit logged: Manual edit with changes:', changes.length)
      }

      setSuccess(true)
      setOriginalItem(item) // Update original for future comparisons

      // Navigate back after success
      setTimeout(() => {
        router.back()
      }, 2000)

    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!user || loading) {
    return (
      <Container maxWidth="md" sx={{ mt: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>Loading item details...</Typography>
      </Container>
    )
  }

  if (error && !item) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.back()}
        >
          Back to Inventory
        </Button>
      </Container>
    )
  }

  if (!item) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Typography>Item not found</Typography>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.back()}
        >
          Back to Inventory
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
          Back
        </Button>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Edit Inventory Item
          </Typography>
          <Typography variant="body1" color="textSecondary">
            Adjust purchase date, price, and other details
          </Typography>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Item updated successfully! Returning to inventory...
        </Alert>
      )}

      {/* Product Information Header */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" alignItems="center" gap={2}>
            {item.products?.image_url && (
              <Avatar
                src={item.products.image_url}
                sx={{ width: 60, height: 60 }}
                variant="rounded"
              />
            )}
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h6">{item.products?.name}</Typography>
              {item.products?.brand && (
                <Typography variant="body2" color="textSecondary">
                  by {item.products.brand}
                </Typography>
              )}
              <Box display="flex" gap={1} mt={1}>
                <Chip size="small" label={item.storage_locations?.name} />
                <Chip size="small" label={item.products?.upc} variant="outlined" />
              </Box>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Edit Form */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            <EditIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Item Details
          </Typography>

          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Quantity"
                type="number"
                fullWidth
                value={item.quantity}
                onChange={(e) => setItem({ ...item, quantity: parseFloat(e.target.value) || 0 })}
                inputProps={{ step: 0.01, min: 0 }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Unit</InputLabel>
                <Select
                  value={item.unit}
                  label="Unit"
                  onChange={(e) => setItem({ ...item, unit: e.target.value })}
                >
                  {units.map((unit) => (
                    <MenuItem key={unit} value={unit}>
                      {unit}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label="Purchase Date"
                type="date"
                fullWidth
                value={item.purchase_date}
                onChange={(e) => setItem({ ...item, purchase_date: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label="Expiration Date"
                type="date"
                fullWidth
                value={item.expiration_date || ''}
                onChange={(e) => setItem({ ...item, expiration_date: e.target.value || undefined })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label="Total Cost"
                type="number"
                fullWidth
                value={item.cost || ''}
                onChange={(e) => setItem({ ...item, cost: parseFloat(e.target.value) || undefined })}
                inputProps={{ step: 0.01, min: 0 }}
                helperText="Total cost for this quantity"
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <Box>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Cost per unit:
                </Typography>
                <Typography variant="h6" color="primary.main">
                  ${item.cost && item.quantity ? (item.cost / item.quantity).toFixed(2) : '0.00'}
                </Typography>
              </Box>
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="Notes"
                multiline
                rows={3}
                fullWidth
                value={item.notes || ''}
                onChange={(e) => setItem({ ...item, notes: e.target.value })}
                placeholder="Add any notes about this item..."
              />
            </Grid>

            <Grid item xs={12}>
              <Box display="flex" gap={2} justifyContent="flex-end">
                <Button
                  variant="outlined"
                  onClick={() => router.back()}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  onClick={handleSave}
                  disabled={saving}
                  startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Audit Trail Preview */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            <HistoryIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Item History
          </Typography>
          <Box sx={{ backgroundColor: 'grey.50', p: 2, borderRadius: 1 }}>
            <Typography variant="body2" color="textSecondary">
              <strong>Created:</strong> {new Date(item.created_at).toLocaleString()}
            </Typography>
            {item.last_modified_at && item.last_modified_at !== item.created_at && (
              <Typography variant="body2" color="textSecondary">
                <strong>Last Modified:</strong> {new Date(item.last_modified_at).toLocaleString()}
              </Typography>
            )}
            <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
              Full audit trail available in inventory management system
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Container>
  )
}