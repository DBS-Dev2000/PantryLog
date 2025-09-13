import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { supabase } from '@/lib/supabase'
import { InventoryItem, InventoryItemWithDetails } from '@/types'

interface InventoryState {
  items: InventoryItemWithDetails[]
  loading: boolean
  error: string | null
}

const initialState: InventoryState = {
  items: [],
  loading: false,
  error: null,
}

export const fetchInventoryItems = createAsyncThunk(
  'inventory/fetchItems',
  async (householdId: string) => {
    const { data, error } = await supabase
      .from('inventory_items')
      .select(`
        *,
        product:products(*),
        storage_location:storage_locations(*)
      `)
      .eq('household_id', householdId)
      .eq('is_consumed', false)
      .order('expiration_date', { ascending: true })

    if (error) throw error
    return data as InventoryItemWithDetails[]
  }
)

export const addInventoryItem = createAsyncThunk(
  'inventory/addItem',
  async (item: Omit<InventoryItem, 'id' | 'created_at' | 'updated_at'>) => {
    const { data, error } = await supabase
      .from('inventory_items')
      .insert([item])
      .select(`
        *,
        product:products(*),
        storage_location:storage_locations(*)
      `)
      .single()

    if (error) throw error
    return data as InventoryItemWithDetails
  }
)

export const consumeItem = createAsyncThunk(
  'inventory/consumeItem',
  async ({ id, quantity }: { id: string; quantity?: number }) => {
    const { data, error } = await supabase
      .from('inventory_items')
      .update({
        is_consumed: quantity === undefined ? true : false,
        consumed_date: new Date().toISOString(),
        quantity: quantity || 0,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  }
)

const inventorySlice = createSlice({
  name: 'inventory',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchInventoryItems.pending, (state) => {
        state.loading = true
      })
      .addCase(fetchInventoryItems.fulfilled, (state, action) => {
        state.loading = false
        state.items = action.payload
      })
      .addCase(fetchInventoryItems.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || 'Failed to fetch items'
      })
      .addCase(addInventoryItem.fulfilled, (state, action) => {
        state.items.push(action.payload)
      })
      .addCase(consumeItem.fulfilled, (state, action) => {
        const index = state.items.findIndex((item) => item.id === action.payload.id)
        if (index !== -1) {
          if (action.payload.is_consumed) {
            state.items.splice(index, 1)
          } else {
            state.items[index] = { ...state.items[index], ...action.payload }
          }
        }
      })
  },
})

export const { clearError } = inventorySlice.actions
export default inventorySlice.reducer