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

      // Get all user's households
      const { data: householdsData, error: householdsError } = await supabase
        .rpc('get_user_households', { user_uuid: session.user.id })

      if (householdsError) {
        throw householdsError
      }

      const householdsList = householdsData || []
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

      const { error } = await supabase
        .rpc('set_user_default_household', {
          user_uuid: session.user.id,
          household_uuid: householdId
        })

      if (error) throw error

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