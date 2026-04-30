import { supabase } from '../lib/supabase'
import type { Database } from '../lib/supabase'

type Profile = Database['public']['Tables']['providers_profiles']['Row']
type ProfileUpdate = Database['public']['Tables']['providers_profiles']['Update']

type Service = Database['public']['Tables']['providers_services']['Row']
type ServiceInsert = Database['public']['Tables']['providers_services']['Insert']
type ServiceUpdate = Database['public']['Tables']['providers_services']['Update']

type Document = Database['public']['Tables']['providers_documents']['Row']
type DocumentInsert = Database['public']['Tables']['providers_documents']['Insert']

export class AppServices {
  // Profile operations
  static async getCurrentProfile(): Promise<Profile | null> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
      .from('providers_profiles')
      .select('*')
      .eq('id', user.id)
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

  // Service operations
  static async createService(serviceData: Omit<ServiceInsert, 'user_id'>): Promise<Service | null> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
      .from('providers_services')
      .insert([{ ...serviceData, user_id: user.id }])
      .select()
      .single()

    if (error) {
      console.error('Error creating service:', error)
      return null
    }

    return data
  }

  static async getUserServices(): Promise<Service[]> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await supabase
      .from('providers_services')
      .select('*')
      .eq('user_id', user.id)
      .order('submitted_at', { ascending: false })

    if (error) {
      console.error('Error fetching services:', error)
      return []
    }

    return data || []
  }

  static async updateService(serviceId: number, updates: ServiceUpdate): Promise<Service | null> {
    const { data, error } = await supabase
      .from('providers_services')
      .update(updates)
      .eq('id', serviceId)
      .select()
      .single()

    if (error) {
      console.error('Error updating service:', error)
      return null
    }

    return data
  }

  static async deleteService(serviceId: number): Promise<boolean> {
    const { error } = await supabase
      .from('providers_services')
      .delete()
      .eq('id', serviceId)

    if (error) {
      console.error('Error deleting service:', error)
      return false
    }

    return true
  }

  // Document operations
  static async uploadDocument(
    documentData: Omit<DocumentInsert, 'user_id'>,
    file: File | Blob
  ): Promise<Document | null> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const fileName = `${user.id}/${Date.now()}_${documentData.file_name}`
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(fileName, file)

    if (uploadError) {
      console.error('Error uploading file:', uploadError)
      return null
    }

    const { data: urlData } = supabase.storage
      .from('documents')
      .getPublicUrl(fileName)

    const { data, error } = await supabase
      .from('providers_documents')
      .insert([{ ...documentData, user_id: user.id, file_url: urlData.publicUrl, file_name: fileName }])
      .select()
      .single()

    if (error) {
      console.error('Error creating document record:', error)
      return null
    }

    return data
  }

  static async getUserDocuments(): Promise<Document[]> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await supabase
      .from('providers_documents')
      .select('*')
      .eq('user_id', user.id)
      .order('uploaded_at', { ascending: false })

    if (error) {
      console.error('Error fetching documents:', error)
      return []
    }

    return data || []
  }

  static async deleteDocument(documentId: number): Promise<boolean> {
    const { data: document, error: fetchError } = await supabase
      .from('providers_documents')
      .select('file_name')
      .eq('id', documentId)
      .single()

    if (fetchError) {
      console.error('Error fetching document:', fetchError)
      return false
    }

    const { error: storageError } = await supabase.storage
      .from('documents')
      .remove([document.file_name])

    if (storageError) {
      console.error('Error deleting file from storage:', storageError)
    }

    const { error: dbError } = await supabase
      .from('providers_documents')
      .delete()
      .eq('id', documentId)

    if (dbError) {
      console.error('Error deleting document record:', dbError)
      return false
    }

    return true
  }

  static async createStorageBucket(): Promise<boolean> {
    const { data, error } = await supabase.storage.createBucket('documents', {
      public: false,
      allowedMimeTypes: ['image/*', 'application/pdf', 'text/*'],
      fileSizeLimit: 52428800
    })

    if (error) {
      console.error('Error creating storage bucket:', error)
      return false
    }

    return true
  }
}
