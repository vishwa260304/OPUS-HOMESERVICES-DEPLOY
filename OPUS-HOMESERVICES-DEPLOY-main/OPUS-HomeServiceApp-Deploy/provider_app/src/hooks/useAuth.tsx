import { useState, useEffect } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase, auth } from '../lib/supabase'

export interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
}

export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
  })

  useEffect(() => {
    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setAuthState({ user: session?.user ?? null, session, loading: false })
    }

    getInitialSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setAuthState({ user: session?.user ?? null, session, loading: false })
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    const { data, error } = await auth.signIn(email, password)
    return { data, error }
  }

  const signUp = async (email: string, password: string) => {
    const { data, error } = await auth.signUp(email, password)
    return { data, error }
  }

  const signOut = async () => {
    const { error } = await auth.signOut()
    return { error }
  }

  return { ...authState, signIn, signUp, signOut }
}
