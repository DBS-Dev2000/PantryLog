import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { supabase } from '@/lib/supabase'

interface AuthState {
  user: any | null
  session: any | null
  loading: boolean
  error: string | null
}

const initialState: AuthState = {
  user: null,
  session: null,
  loading: false,
  error: null,
}

export const signIn = createAsyncThunk(
  'auth/signIn',
  async ({ email, password }: { email: string; password: string }) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error
    return data
  }
)

export const signUp = createAsyncThunk(
  'auth/signUp',
  async ({
    email,
    password,
    householdName
  }: {
    email: string
    password: string
    householdName: string
  }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          household_name: householdName,
        },
      },
    })
    if (error) throw error
    return data
  }
)

export const signOut = createAsyncThunk('auth/signOut', async () => {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
})

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser: (state, action) => {
      state.user = action.payload
    },
    setSession: (state, action) => {
      state.session = action.payload
    },
    clearError: (state) => {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(signIn.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(signIn.fulfilled, (state, action) => {
        state.loading = false
        state.user = action.payload.user
        state.session = action.payload.session
      })
      .addCase(signIn.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || 'Sign in failed'
      })
      .addCase(signUp.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(signUp.fulfilled, (state, action) => {
        state.loading = false
        state.user = action.payload.user
        state.session = action.payload.session
      })
      .addCase(signUp.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || 'Sign up failed'
      })
      .addCase(signOut.fulfilled, (state) => {
        state.user = null
        state.session = null
      })
  },
})

export const { setUser, setSession, clearError } = authSlice.actions
export default authSlice.reducer