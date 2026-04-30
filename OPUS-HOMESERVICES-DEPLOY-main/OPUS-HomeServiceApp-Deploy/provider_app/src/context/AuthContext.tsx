import React, { createContext, useContext, useEffect, useState } from 'react'
import { User, Session, AuthError } from '@supabase/supabase-js'
import { getStoredSupabaseRefreshToken, supabase } from '../lib/supabase'
import { api } from '../lib/api'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signUp: (email: string, password: string, fullName?: string, phone?: string) => Promise<{ data: any; error: AuthError | null }>
  signIn: (email: string, password: string) => Promise<{ data: any; error: AuthError | null }>
  signOut: () => Promise<{ error: AuthError | null }>
  resetPassword: (email: string) => Promise<{ data: any; error: AuthError | null }>
  updateProfile: (updates: { full_name?: string; avatar_url?: string }) => Promise<{ data: any; error: AuthError | null }>
  createProfileManually: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: React.ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      const refreshToken = await getStoredSupabaseRefreshToken()
      if (refreshToken) {
        await supabase.auth.refreshSession({ refresh_token: refreshToken } as any)
      }

      const { data: { session } } = await supabase.auth.getSession()
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    }

    getInitialSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Auth state changed - update UI state immediately
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)

        // IMPORTANT: Only create profile AFTER email verification (on SIGNED_IN)
        // This ensures the user is fully authenticated before creating the profile
        // Do NOT create profile on SIGNED_UP to avoid blocking user creation
        if (event === 'SIGNED_IN' && session?.user) {
          // User has verified their email and is now signed in
          // Create profile in providers_profiles table
          console.log('User signed in, creating profile for:', session.user.email)
          createUserProfile(session.user).catch(err => {
            console.error('Profile creation failed on sign in:', err)
            // This is non-critical - user can still proceed, profile can be created later
          })
        }
        
        // Handle TOKEN_REFRESHED event - ensure profile exists for active sessions
        if (event === 'TOKEN_REFRESHED' && session?.user) {
          // Silently check and create profile if missing (don't log errors)
          createUserProfile(session.user).catch(() => {
            // Silent failure - don't spam logs
          })
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const createUserProfile = async (user: User) => {
    try {
      // Check if profile already exists
      const { data: existingProfile, error: checkError } = await api.profile.getProfile(user.id)
      
      if (existingProfile) {
        console.log('Profile already exists for user:', user.id)
        return
      }
      
      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "not found" error
        console.warn('Error checking profile existence:', checkError)
        // Don't return here - try to create the profile anyway
      }

      // Create the profile
      const { data, error } = await api.profile.createProfile(
        user.id,
        user.email!,
        user.user_metadata?.full_name || user.user_metadata?.fullName,
        user.user_metadata?.phone
      )

      if (error) {
        console.error('Failed to create profile on first attempt:', error)
        // Try again with a delay in case of race condition
        setTimeout(async () => {
          const { data: retryData, error: retryError } = await api.profile.createProfile(
            user.id,
            user.email!,
            user.user_metadata?.full_name || user.user_metadata?.fullName,
            user.user_metadata?.phone
          )
          if (retryError) {
            console.error('Failed to create profile on retry:', retryError)
          } else {
            console.log('Profile created successfully on retry')
          }
        }, 2000)
      } else {
        console.log('Profile created successfully:', data)
      }
    } catch (error) {
      console.error('Exception in createUserProfile:', error)
      // Don't throw - profile creation failure shouldn't block auth
    }
  }

  const signUp = async (email: string, password: string, fullName?: string, phone?: string) => {
    return await api.auth.signUp(email, password, fullName, phone)
  }

  const signIn = async (email: string, password: string) => {
    return await api.auth.signIn(email, password)
  }

  const signOut = async () => {
    const result = await api.auth.signOut()
    // Clear local state immediately
    setUser(null)
    setSession(null)
    return result
  }

  const resetPassword = async (email: string) => {
    return await api.auth.resetPassword(email)
  }

  const updateProfile = async (updates: { full_name?: string; avatar_url?: string }) => {
    if (!user) {
      const error = {
        name: 'AuthApiError',
        message: 'No user logged in',
        status: 401,
        code: 'not_authenticated',
      } as unknown as AuthError
      return { data: null, error }
    }
    try {
      const result = await api.profile.updateProfile(user.id, updates)
      // Convert PostgrestError to AuthError format if needed
      if (result.error) {
        // Create a proper AuthError-like object
        const authError = {
          name: 'AuthApiError',
          message: result.error.message || 'Failed to update profile',
          status: 400,
          code: (result.error as any).code || 'update_failed',
        } as unknown as AuthError
        return { data: result.data, error: authError }
      }
      return { data: result.data, error: null }
    } catch (error) {
      const authError = {
        name: 'AuthApiError',
        message: error instanceof Error ? error.message : 'Unknown error',
        status: 500,
        code: 'update_exception',
      } as unknown as AuthError
      return { data: null, error: authError }
    }
  }

  const createProfileManually = async (): Promise<void> => {
    if (!user) {
      console.error('Cannot create profile: No user logged in')
      return
    }
    await createUserProfile(user)
  }

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    resetPassword,
    updateProfile,
    createProfileManually,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
