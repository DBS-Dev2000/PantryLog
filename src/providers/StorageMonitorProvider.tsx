'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { startStorageMonitoring, checkStorageQuota, cleanupStorage } from '@/utils/storageMonitor'

interface StorageStats {
  usage: number
  quota: number
  percentUsed: number
  shouldCleanup: boolean
}

interface StorageMonitorContextType {
  stats: StorageStats | null
  forceCleanup: () => void
  refreshStats: () => Promise<void>
}

const StorageMonitorContext = createContext<StorageMonitorContextType>({
  stats: null,
  forceCleanup: () => {},
  refreshStats: async () => {}
})

export const useStorageMonitor = () => useContext(StorageMonitorContext)

export function StorageMonitorProvider({ children }: { children: React.ReactNode }) {
  const [stats, setStats] = useState<StorageStats | null>(null)

  useEffect(() => {
    // Start monitoring storage with checks every 30 seconds
    const interval = startStorageMonitoring(30000)

    // Get initial stats
    refreshStats()

    // Update stats every minute for UI display
    const statsInterval = setInterval(refreshStats, 60000)

    return () => {
      if (interval) clearInterval(interval)
      clearInterval(statsInterval)
    }
  }, [])

  const refreshStats = async () => {
    try {
      const quota = await checkStorageQuota()
      setStats(quota)

      // Log warning if storage is getting full
      if (quota.percentUsed > 70) {
        console.warn(`Storage usage is at ${quota.percentUsed.toFixed(1)}%`)
      }
    } catch (error) {
      console.error('Error checking storage stats:', error)
    }
  }

  const forceCleanup = () => {
    console.log('Manual storage cleanup triggered')
    const cleaned = cleanupStorage({
      maxAgeMs: 30 * 60 * 1000, // Clean items older than 30 minutes
      keepKeys: ['user', 'household_id', 'session', 'supabase'],
      targetSizeBytes: 2 * 1024 * 1024 // Try to free 2MB
    })
    console.log(`Cleaned ${(cleaned / 1024).toFixed(1)}KB`)
    refreshStats()
  }

  return (
    <StorageMonitorContext.Provider value={{ stats, forceCleanup, refreshStats }}>
      {children}
    </StorageMonitorContext.Provider>
  )
}