export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      households: {
        Row: {
          id: string
          name: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      storage_locations: {
        Row: {
          id: string
          household_id: string
          name: string
          type: string
          description: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          household_id: string
          name: string
          type: string
          description?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          household_id?: string
          name?: string
          type?: string
          description?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "storage_locations_household_id_fkey"
            columns: ["household_id"]
            referencedRelation: "households"
            referencedColumns: ["id"]
          }
        ]
      }
      products: {
        Row: {
          id: string
          upc: string | null
          name: string
          brand: string | null
          category: string | null
          default_shelf_life_days: number | null
          image_url: string | null
          nutritional_info: Json | null
          is_custom: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          upc?: string | null
          name: string
          brand?: string | null
          category?: string | null
          default_shelf_life_days?: number | null
          image_url?: string | null
          nutritional_info?: Json | null
          is_custom?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          upc?: string | null
          name?: string
          brand?: string | null
          category?: string | null
          default_shelf_life_days?: number | null
          image_url?: string | null
          nutritional_info?: Json | null
          is_custom?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      inventory_items: {
        Row: {
          id: string
          product_id: string
          storage_location_id: string
          household_id: string
          quantity: number
          unit: string | null
          purchase_date: string
          expiration_date: string | null
          cost: number | null
          notes: string | null
          custom_label: string | null
          is_consumed: boolean
          consumed_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          product_id: string
          storage_location_id: string
          household_id: string
          quantity: number
          unit?: string | null
          purchase_date: string
          expiration_date?: string | null
          cost?: number | null
          notes?: string | null
          custom_label?: string | null
          is_consumed?: boolean
          consumed_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          storage_location_id?: string
          household_id?: string
          quantity?: number
          unit?: string | null
          purchase_date?: string
          expiration_date?: string | null
          cost?: number | null
          notes?: string | null
          custom_label?: string | null
          is_consumed?: boolean
          consumed_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_household_id_fkey"
            columns: ["household_id"]
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_product_id_fkey"
            columns: ["product_id"]
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_storage_location_id_fkey"
            columns: ["storage_location_id"]
            referencedRelation: "storage_locations"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}