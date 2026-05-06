import { supabase } from '../lib/supabase'
import type { Database } from '../lib/supabase'

type Profile = Database['public']['Tables']['providers_profiles']['Row']
type ProfileInsert = Database['public']['Tables']['providers_profiles']['Insert']
type ProfileUpdate = Database['public']['Tables']['providers_profiles']['Update']

export class DatabaseService {
  // Profile operations
  static async getProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('providers_profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      // PGRST116 means no rows found - this is expected for new users
      if (error.code === 'PGRST116') {
        return null
      }
      console.error('Error fetching profile:', error)
      return null
    }

    return data
  }

  static async updateProfile(userId: string, updates: ProfileUpdate): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('providers_profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single()

    if (error) {
      console.error('Error updating profile:', error)
      return null
    }

    return data
  }

  static async createProfile(profile: ProfileInsert): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('providers_profiles')
      .insert(profile)
      .select()
      .single()

    if (error) {
      console.error('Error creating profile:', error)
      return null
    }

    return data
  }

  // Generic table operations
  static async getRows<T>(
    table: string,
    select: string = '*',
    filters?: Record<string, any>
  ): Promise<T[] | null> {
    let query = supabase.from(table).select(select)

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value)
      })
    }

    const { data, error } = await query

    if (error) {
      console.error(`Error fetching from ${table}:`, error)
      return null
    }

    return data as T[] | null
  }

  static async insertRow<T>(
    table: string,
    data: any
  ): Promise<T | null> {
    const { data: result, error } = await supabase
      .from(table)
      .insert(data)
      .select()
      .single()

    if (error) {
      console.error(`Error inserting into ${table}:`, error)
      return null
    }

    return result
  }

  static async updateRow<T>(
    table: string,
    id: string | number,
    updates: any
  ): Promise<T | null> {
    const { data, error } = await supabase
      .from(table)
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error(`Error updating ${table}:`, error)
      return null
    }

    return data
  }

  static async deleteRow(
    table: string,
    id: string | number
  ): Promise<boolean> {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq('id', id)

    if (error) {
      console.error(`Error deleting from ${table}:`, error)
      return false
    }

    return true
  }

  // File storage operations
  static async uploadFile(
    bucket: string,
    path: string,
    file: File | Blob
  ): Promise<string | null> {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file)

    if (error) {
      console.error('Error uploading file:', error)
      return null
    }

    return data.path
  }

  static async getFileUrl(
    bucket: string,
    path: string
  ): Promise<string | null> {
    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(path)

    return data.publicUrl
  }

  static async deleteFile(
    bucket: string,
    path: string
  ): Promise<boolean> {
    const { error } = await supabase.storage
      .from(bucket)
      .remove([path])

    if (error) {
      console.error('Error deleting file:', error)
      return false
    }

    return true
  }
}
