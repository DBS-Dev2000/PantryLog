import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { supabase } from '@/lib/supabase'
import { Household, StorageLocation } from '@/types'

interface HouseholdState {
  household: Household | null
  storageLocations: StorageLocation[]
  loading: boolean
  error: string | null
}

const initialState: HouseholdState = {
  household: null,
  storageLocations: [],
  loading: false,
  error: null,
}

export const createHousehold = createAsyncThunk(
  'household/create',
  async ({ name, userId }: { name: string; userId: string }) => {
    const { data, error } = await supabase
      .from('households')
      .insert([{ name }])
      .select()
      .single()

    if (error) throw error
    return data
  }
)

export const fetchHousehold = createAsyncThunk(
  'household/fetch',
  async (householdId: string) => {
    const { data, error } = await supabase
      .from('households')
      .select('*')
      .eq('id', householdId)
      .single()

    if (error) throw error
    return data
  }
)

export const fetchStorageLocations = createAsyncThunk(
  'household/fetchStorageLocations',
  async (householdId: string) => {
    const { data, error } = await supabase
      .from('storage_locations')
      .select('*')
      .eq('household_id', householdId)
      .eq('is_active', true)
      .order('name')

    if (error) throw error
    return data
  }
)

export const createStorageLocation = createAsyncThunk(
  'household/createStorageLocation',
  async (location: Omit<StorageLocation, 'id' | 'created_at' | 'updated_at'>) => {
    const { data, error } = await supabase
      .from('storage_locations')
      .insert([location])
      .select()
      .single()

    if (error) throw error
    return data
  }
)

const householdSlice = createSlice({
  name: 'household',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(createHousehold.pending, (state) => {
        state.loading = true
      })
      .addCase(createHousehold.fulfilled, (state, action) => {
        state.loading = false
        state.household = action.payload
      })
      .addCase(createHousehold.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || 'Failed to create household'
      })
      .addCase(fetchHousehold.fulfilled, (state, action) => {
        state.household = action.payload
      })
      .addCase(fetchStorageLocations.fulfilled, (state, action) => {
        state.storageLocations = action.payload
      })
      .addCase(createStorageLocation.fulfilled, (state, action) => {
        state.storageLocations.push(action.payload)
      })
  },
})

export const { clearError } = householdSlice.actions
export default householdSlice.reducer