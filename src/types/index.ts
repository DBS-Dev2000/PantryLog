import { Database } from './supabase'

export type Household = Database['public']['Tables']['households']['Row']
export type StorageLocation = Database['public']['Tables']['storage_locations']['Row']
export type Product = Database['public']['Tables']['products']['Row']
export type InventoryItem = Database['public']['Tables']['inventory_items']['Row']

export type NewHousehold = Database['public']['Tables']['households']['Insert']
export type NewStorageLocation = Database['public']['Tables']['storage_locations']['Insert']
export type NewProduct = Database['public']['Tables']['products']['Insert']
export type NewInventoryItem = Database['public']['Tables']['inventory_items']['Insert']

export type StorageLocationType = 'Pantry' | 'Freezer' | 'Refrigerator'

export interface InventoryItemWithDetails extends InventoryItem {
  product: Product
  storage_location: StorageLocation
}

export interface ExpirationReport {
  expired: InventoryItemWithDetails[]
  expiring_in_3_days: InventoryItemWithDetails[]
  expiring_in_7_days: InventoryItemWithDetails[]
  expiring_in_30_days: InventoryItemWithDetails[]
}

export interface BarcodeApiResponse {
  code: string
  total: number
  offset: number
  items: BarcodeApiItem[]
}

export interface BarcodeApiItem {
  ean: string
  title: string
  description: string
  upc: string
  brand: string
  model: string
  color: string
  size: string
  dimension: string
  weight: string
  category: string
  currency: string
  lowest_recorded_price: number
  highest_recorded_price: number
  images: string[]
}