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
        setLoading(false)
        return
      }

      // Simplified household loading - just set a default for now
      console.log('Loading households for user:', session.user.id)

      // Set default household based on user ID (legacy mode)
      const defaultHousehold = {
        id: session.user.id,
        name: 'My Household',
        role: 'admin',
        is_default: true,
        joined_at: new Date().toISOString()
      }

      setHouseholds([defaultHousehold])
      setCurrentHousehold(defaultHousehold)

    } catch (err: any) {
      console.error('Error in refreshHouseholds:', err)
      setError(err.message)
      // Still set some defaults so app doesn't hang
      setHouseholds([])
      setCurrentHousehold(null)
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
      console.log('Setting default household:', householdId)
      // For now, just switch to that household
      await switchHousehold(householdId)
    } catch (err: any) {
      console.error('Error setting default household:', err)
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