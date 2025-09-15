'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface Household {
  id: string
  name: string
  role: string
  is_default: boolean
  joined_at: string
}

interface HouseholdContextType {
  currentHousehold: Household | null
  households: Household[]
  loading: boolean
  error: string | null
  switchHousehold: (householdId: string) => Promise<void>
  setDefaultHousehold: (householdId: string) => Promise<void>
  refreshHouseholds: () => Promise<void>
}

const HouseholdContext = createContext<HouseholdContextType | undefined>(undefined)

export function HouseholdProvider({ children }: { children: React.ReactNode }) {
  const [currentHousehold, setCurrentHousehold] = useState<Household | null>(null)
  const [households, setHouseholds] = useState<Household[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refreshHouseholds = async () => {
    try {
      setError(null)
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.user) {
        setCurrentHousehold(null)
        setHouseholds([])
        return
      }

      // Get all user's households - fallback to simple query if RPC doesn't exist
      let householdsList = []

      try {
        const { data: householdsData, error: householdsError } = await supabase
          .rpc('get_user_households', { user_uuid: session.user.id })

        if (householdsError) {
          // If RPC function doesn't exist, fall back to basic query
          console.log('RPC function not found, using fallback query')
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('household_members')
            .select(`
              household_id,
              role,
              joined_at,
              households!inner(name)
            `)
            .eq('user_id', session.user.id)

          if (fallbackError) throw fallbackError

          householdsList = (fallbackData || []).map(item => ({
            household_id: item.household_id,
            household_name: item.households.name,
            role: item.role,
            is_default: false, // Default logic will be added later
            joined_at: item.joined_at
          }))
        } else {
          householdsList = householdsData || []
        }
      } catch (err) {
        console.log('Household query failed, user may not have any households yet')
        householdsList = []
      }

      setHouseholds(householdsList)

      // Set current household (default one or first one)
      const defaultHousehold = householdsList.find(h => h.is_default)
      const currentHouseholdChoice = defaultHousehold || householdsList[0] || null
      setCurrentHousehold(currentHouseholdChoice)

    } catch (err: any) {
      console.error('Error loading households:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const switchHousehold = async (householdId: string) => {
    try {
      setError(null)
      const household = households.find(h => h.household_id === householdId)
      if (household) {
        setCurrentHousehold({
          id: household.household_id,
          name: household.household_name,
          role: household.role,
          is_default: household.is_default,
          joined_at: household.joined_at
        })
      }
    } catch (err: any) {
      setError(err.message)
    }
  }

  const setDefaultHousehold = async (householdId: string) => {
    try {
      setError(null)
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.user) return

      try {
        const { error } = await supabase
          .rpc('set_user_default_household', {
            user_uuid: session.user.id,
            household_uuid: householdId
          })

        if (error) throw error
      } catch (rpcError) {
        console.log('RPC function not available, skipping default household setting')
        // For now, just switch to that household
        await switchHousehold(householdId)
        return
      }

      // Refresh households to update default status
      await refreshHouseholds()
    } catch (err: any) {
      setError(err.message)
    }
  }

  useEffect(() => {
    // Initial load
    refreshHouseholds()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        await refreshHouseholds()
      } else if (event === 'SIGNED_OUT') {
        setCurrentHousehold(null)
        setHouseholds([])
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const value = {
    currentHousehold,
    households,
    loading,
    error,
    switchHousehold,
    setDefaultHousehold,
    refreshHouseholds
  }

  return (
    <HouseholdContext.Provider value={value}>
      {children}
    </HouseholdContext.Provider>
  )
}

export function useHousehold() {
  const context = useContext(HouseholdContext)
  if (context === undefined) {
    throw new Error('useHousehold must be used within a HouseholdProvider')
  }
  return context
}