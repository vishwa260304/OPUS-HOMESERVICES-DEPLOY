import { createClient } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'

const SUPABASE_REFRESH_TOKEN_KEY = 'supabase_refresh_token'

const ExpoSecureStoreAdapter = {
  getItem: async (key: string) => {
    try {
      if (__DEV__) console.log(`[SupabaseStorage] getItem starting: ${key}`);
      const chunks = await SecureStore.getItemAsync(`${key}_chunks`);
      if (chunks) {
        if (__DEV__) console.log(`[SupabaseStorage] Found ${chunks} chunks for: ${key}`);
        let value = '';
        const numChunks = Number(chunks);
        if (isNaN(numChunks)) {
          console.warn(`[SupabaseStorage] Invalid chunk count for ${key}: ${chunks}`);
          return SecureStore.getItemAsync(key);
        }
        for (let i = 0; i < numChunks; i++) {
          const chunk = await SecureStore.getItemAsync(`${key}_chunk_${i}`);
          if (chunk) value += chunk;
        }
        if (__DEV__) console.log(`[SupabaseStorage] Reconstructed value (${value.length} bytes) for: ${key}`);
        return value;
      }
      const val = await SecureStore.getItemAsync(key);
      if (__DEV__) console.log(`[SupabaseStorage] getItem finished: ${key} (found: ${!!val})`);
      return val;
    } catch (error) {
      console.error(`[SupabaseStorage] getItem error for ${key}:`, error);
      return null;
    }
  },
  setItem: async (key: string, value: string) => {
    try {
      if (__DEV__) console.log(`[SupabaseStorage] setItem starting: ${key} (${value.length} bytes)`);
      
      // Migration/Backup: Store refresh token separately if it's a session object
      try {
        const parsed = JSON.parse(value);
        const refreshToken = parsed?.currentSession?.refresh_token ?? parsed?.refresh_token;
        if (refreshToken) {
          await SecureStore.setItemAsync(SUPABASE_REFRESH_TOKEN_KEY, refreshToken);
        }
      } catch (e) {
        // Not a JSON/session object, ignore
      }

      if (value.length > 2048) {
        const chunks = Math.ceil(value.length / 2048);
        if (__DEV__) console.log(`[SupabaseStorage] Chunking ${value.length} bytes into ${chunks} chunks for: ${key}`);
        await SecureStore.setItemAsync(`${key}_chunks`, String(chunks));
        for (let i = 0; i < chunks; i++) {
          await SecureStore.setItemAsync(`${key}_chunk_${i}`, value.slice(i * 2048, (i + 1) * 2048));
        }
        await SecureStore.deleteItemAsync(key);
      } else {
        await SecureStore.deleteItemAsync(`${key}_chunks`);
        await SecureStore.setItemAsync(key, value);
      }
      if (__DEV__) console.log(`[SupabaseStorage] setItem finished: ${key}`);
    } catch (error) {
      console.error(`[SupabaseStorage] setItem error for ${key}:`, error);
    }
  },
  removeItem: async (key: string) => {
    try {
      if (__DEV__) console.log(`[SupabaseStorage] removeItem starting: ${key}`);
      await SecureStore.deleteItemAsync(SUPABASE_REFRESH_TOKEN_KEY);
      
      const chunks = await SecureStore.getItemAsync(`${key}_chunks`);
      if (chunks) {
        const numChunks = Number(chunks);
        if (!isNaN(numChunks)) {
          for (let i = 0; i < numChunks; i++) {
            await SecureStore.deleteItemAsync(`${key}_chunk_${i}`);
          }
        }
        await SecureStore.deleteItemAsync(`${key}_chunks`);
      }
      await SecureStore.deleteItemAsync(key);
      if (__DEV__) console.log(`[SupabaseStorage] removeItem finished: ${key}`);
    } catch (error) {
      console.error(`[SupabaseStorage] removeItem error for ${key}:`, error);
    }
  },
};

export const getStoredSupabaseRefreshToken = () => {
  return SecureStore.getItemAsync(SUPABASE_REFRESH_TOKEN_KEY)
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check your .env file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter as any,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // We handle deep links manually in AuthContext
  },
})

export const SUPABASE_PROJECT_URL = supabaseUrl;
export const SUPABASE_STORAGE_URL = `${SUPABASE_PROJECT_URL}/storage/v1/object/public`;

export interface Database {
  public: {
    Tables: {
      providers_profiles: {
        Row: { id: string; email: string; full_name: string | null; avatar_url: string | null; phone: string | null; push_token: string | null; created_at: string; updated_at: string }
        Insert: { id: string; email: string; full_name?: string | null; avatar_url?: string | null; phone?: string | null; push_token?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: string; email?: string; full_name?: string | null; avatar_url?: string | null; phone?: string | null; push_token?: string | null; created_at?: string; updated_at?: string }
      }
      providers_services: {
        Row: { id: number; user_id: string; service_name: string; service_type: string; description: string | null; status: string; submitted_at: string; updated_at: string }
        Insert: { user_id: string; service_name: string; service_type: string; description?: string | null; status?: string; submitted_at?: string; updated_at?: string }
        Update: { service_name?: string; service_type?: string; description?: string | null; status?: string; updated_at?: string }
      }
      providers_documents: {
        Row: { id: number; user_id: string; service_id: number | null; document_type: string; file_url: string; file_name: string; uploaded_at: string }
        Insert: { user_id: string; service_id?: number | null; document_type: string; file_url: string; file_name: string; uploaded_at?: string }
        Update: { document_type?: string; file_url?: string; file_name?: string }
      }
      providers_bookings: {
        Row: { id: number; provider_id: string; customer_id: string; service_id: number; booking_date: string; status: string; customer_address: string | null; customer_phone: string | null; notes: string | null; created_at: string; updated_at: string }
        Insert: { provider_id: string; customer_id: string; service_id: number; booking_date: string; status?: string; customer_address?: string | null; customer_phone?: string | null; notes?: string | null; created_at?: string; updated_at?: string }
        Update: { status?: string; customer_address?: string | null; customer_phone?: string | null; notes?: string | null; updated_at?: string }
      }
      providers_earnings: {
        Row: { id: number; provider_id: string; booking_id: number; amount: number; commission_rate: number; net_amount: number; status: string; paid_at: string | null; created_at: string }
        Insert: { provider_id: string; booking_id: number; amount: number; commission_rate?: number; net_amount: number; status?: string; paid_at?: string | null; created_at?: string }
        Update: { amount?: number; commission_rate?: number; net_amount?: number; status?: string; paid_at?: string | null }
      }
      providers_company_verification: {
        Row: { 
          id: string; 
          user_id: string; 
          company_name: string; 
          gst_number: string | null; 
          official_email: string; 
          contact_number: string; 
          business_type: string | null; 
          business_address: string | null; 
          verification_status: 'pending' | 'under_review' | 'approved' | 'rejected'; 
          verification_notes: string | null; 
          verified_at: string | null; 
          verified_by: string | null; 
          documents_required: any; 
          documents_submitted: any; 
          created_at: string; 
          updated_at: string 
        }
        Insert: { 
          user_id: string; 
          company_name: string; 
          gst_number?: string | null; 
          official_email: string; 
          contact_number: string; 
          business_type?: string | null; 
          business_address?: string | null; 
          verification_status?: 'pending' | 'under_review' | 'approved' | 'rejected'; 
          verification_notes?: string | null; 
          verified_at?: string | null; 
          verified_by?: string | null; 
          documents_required?: any; 
          documents_submitted?: any; 
          created_at?: string; 
          updated_at?: string 
        }
        Update: { 
          company_name?: string; 
          gst_number?: string | null; 
          official_email?: string; 
          contact_number?: string; 
          business_type?: string | null; 
          business_address?: string | null; 
          verification_status?: 'pending' | 'under_review' | 'approved' | 'rejected'; 
          verification_notes?: string | null; 
          verified_at?: string | null; 
          verified_by?: string | null; 
          documents_required?: any; 
          documents_submitted?: any; 
          updated_at?: string 
        }
      }
      providers_verification_documents: {
        Row: { 
          id: string; 
          verification_id: string; 
          user_id: string; 
          document_type: string; 
          document_name: string; 
          file_url: string; 
          file_size: number | null; 
          mime_type: string | null; 
          document_status: 'pending' | 'approved' | 'rejected'; 
          rejection_reason: string | null; 
          verified_at: string | null; 
          verified_by: string | null; 
          uploaded_at: string; 
          updated_at: string 
        }
        Insert: { 
          verification_id: string; 
          user_id: string; 
          document_type: string; 
          document_name: string; 
          file_url: string; 
          file_size?: number | null; 
          mime_type?: string | null; 
          document_status?: 'pending' | 'approved' | 'rejected'; 
          rejection_reason?: string | null; 
          verified_at?: string | null; 
          verified_by?: string | null; 
          uploaded_at?: string; 
          updated_at?: string 
        }
        Update: { 
          document_type?: string; 
          document_name?: string; 
          file_url?: string; 
          file_size?: number | null; 
          mime_type?: string | null; 
          document_status?: 'pending' | 'approved' | 'rejected'; 
          rejection_reason?: string | null; 
          verified_at?: string | null; 
          verified_by?: string | null; 
          updated_at?: string 
        }
      }
      // providers_verification_workflow table removed - documents auto-verified
    }
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: { [_ in never]: never }
  }
}

export const auth = {
  signUp: async (email: string, password: string, fullName?: string) => {
    const { data, error } = await supabase.auth.signUp({ 
      email, 
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    })
    return { data, error }
  },
  signIn: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    return { data, error }
  },
  signOut: async () => {
    const { error } = await supabase.auth.signOut()
    return { error }
  },
  getCurrentUser: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    return user
  },
  onAuthStateChange: (callback: (event: string, session: any) => void) => {
    return supabase.auth.onAuthStateChange(callback)
  },
  resetPassword: async (email: string) => {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email)
    return { data, error }
  },
  deleteUserAccount: async () => {
    const { data, error } = await supabase.functions.invoke('delete-account', {
      method: 'POST'
    })
    return { data, error }
  }
}

// User profile management functions
export const userProfile = {
  getProfile: async (userId: string) => {
    const { data, error } = await supabase
      .from('providers_profiles')
      .select('*')
      .eq('id', userId)
      .single()
    return { data, error }
  },
  updateProfile: async (userId: string, updates: { full_name?: string; avatar_url?: string; phone?: string }) => {
    const { data, error } = await supabase
      .from('providers_profiles')
      .update(updates)
      .eq('id', userId)
      .select()
    return { data, error }
  },
  createProfile: async (userId: string, email: string, fullName?: string, phone?: string) => {
    try {
      const { data, error } = await supabase
        .from('providers_profiles')
        .insert({
          id: userId,
          email,
          full_name: fullName || null,
          phone: phone || null,
        })
        .select()
      
      if (error) {
        console.error('Profile creation error:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          userId,
          email,
        })
      }
      
      return { data, error }
    } catch (error) {
      console.error('Profile creation exception:', error)
      return { data: null, error: error as any }
    }
  }
}

export default supabase
