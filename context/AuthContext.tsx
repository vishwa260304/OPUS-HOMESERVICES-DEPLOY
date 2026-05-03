import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import { Alert } from 'react-native';
import { UserProfile, UserProfileService } from '../lib/userProfile';
import * as SecureStore from 'expo-secure-store';

const AUTH_LOGGED_IN_KEY = 'fixit_auth_logged_in';
const AUTH_PROFILE_KEY = 'fixit_user_profile';
const OTP_LAST_SENT_KEY = 'otp_last_sent';
const OTP_COOLDOWN_MS = 60000;

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signInWithPhone: (phone: string) => Promise<{ success: boolean; message: string }>;
  verifyOTP: (phone: string, otp: string) => Promise<{ success: boolean; message: string }>;
  signOut: () => Promise<void>;
  resendOTP: (phone: string) => Promise<{ success: boolean; message: string }>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<boolean>;
  refreshProfile: () => Promise<void>;
  clearCorruptedSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session with better error handling
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          await handleAuthError(error, 'session initialization');
          setSession(null);
          setUser(null);
          setProfile(null);
        } else {
          setSession(session);
          setUser(session?.user ?? null);
          if (session?.user) {
            loadProfile(session.user.id); // Load profile in background
          }
        }
      } catch (error) {
        await handleAuthError(error, 'auth initialization');
        setSession(null);
        setUser(null);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    // Listen for auth changes with improved error handling
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (__DEV__) console.log('Auth state change:', event, session ? 'Session exists' : 'No session');
      
      try {
        // Handle token refresh errors
        if (event === 'TOKEN_REFRESHED' && !session) {
          if (__DEV__) console.log('Token refresh failed, clearing session');
          await clearCorruptedSession();
          return;
        }

        // Handle other auth errors
        if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          setProfile(null);
        } else if (session) {
          setSession(session);
          setUser(session.user);
          if (session.user) {
            loadProfile(session.user.id);
          }
        } else {
          setSession(null);
          setUser(null);
          setProfile(null);
        }
      } catch (error) {
        await handleAuthError(error, 'auth state change');
      } finally {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = async (userId: string) => {
    try {
      const userProfile = await UserProfileService.getProfile(userId);
      setProfile(userProfile);
      return userProfile;
    } catch (error) {
      console.error('Error loading profile:', error);
      return null;
    }
  };

  // Helper function to handle auth errors
  const handleAuthError = async (error: any, context: string) => {
    console.error(`Auth error in ${context}:`, error);
    
    // Check if it's a refresh token error
    if (error?.message?.includes('Invalid Refresh Token') || 
        error?.message?.includes('Refresh Token Not Found') ||
        error?.message?.includes('refresh_token_not_found')) {
      if (__DEV__) console.log('Refresh token error detected, clearing session');
      await clearCorruptedSession();
    }
  };

  const signInWithPhone = async (phone: string): Promise<{ success: boolean; message: string }> => {
    try {
      setLoading(true);
      const lastSentRaw = await SecureStore.getItemAsync(OTP_LAST_SENT_KEY);
      const lastSent = lastSentRaw ? parseInt(lastSentRaw, 10) : 0;
      const elapsed = Date.now() - lastSent;

      if (elapsed < OTP_COOLDOWN_MS) {
        const waitSeconds = Math.ceil((OTP_COOLDOWN_MS - elapsed) / 1000);
        return { success: false, message: `Wait ${waitSeconds}s before resending.` };
      }

      if (__DEV__) console.log(`[Auth] Attempting signInWithOtp for: ${phone}`);
      const { error } = await supabase.auth.signInWithOtp({
        phone,
        options: {
          shouldCreateUser: true,
        },
      });

      if (error) {
        console.error('[Auth] Sign in error:', error);
        return { success: false, message: error.message };
      }

      if (__DEV__) console.log('[Auth] OTP sent successfully');
      await SecureStore.setItemAsync(OTP_LAST_SENT_KEY, String(Date.now()));
      return { success: true, message: 'OTP sent successfully' };
    } catch (error) {
      console.error('Sign in error:', error);
      return { success: false, message: 'Failed to send OTP' };
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = async (phone: string, otp: string): Promise<{ success: boolean; message: string }> => {
    try {
      setLoading(true);
      if (__DEV__) console.log(`[Auth] Attempting verifyOtp for: ${phone}`);
      const { data, error } = await supabase.auth.verifyOtp({
        phone,
        token: otp,
        type: 'sms',
      });

      if (error) {
        console.error('[Auth] OTP verification error:', error);
        return { success: false, message: error.message };
      }

      if (data.session) {
        if (__DEV__) console.log('[Auth] OTP verified, session established');
        setSession(data.session);
        setUser(data.session.user);
        
        // Create user profile with phone number if it doesn't exist
        try {
          if (__DEV__) console.log('[Auth] Loading profile for user:', data.session.user.id);
          const existingProfile = await UserProfileService.getProfile(data.session.user.id);
          if (!existingProfile) {
            if (__DEV__) console.log('[Auth] New user, creating profile');
            // This is a new user, create profile with phone number
            await UserProfileService.createProfile(data.session.user.id, phone);
          }
          await loadProfile(data.session.user.id);
        } catch (profileError) {
          console.error('[Auth] Error creating/loading profile:', profileError);
        }
        
        // Persist login state and phone for ProfileScreen
        try {
          if (__DEV__) console.log('[Auth] Persisting auth metadata to SecureStore');
          await SecureStore.setItemAsync(AUTH_LOGGED_IN_KEY, 'true');
          await SecureStore.setItemAsync(AUTH_PROFILE_KEY, JSON.stringify({ userId: data.session.user.id, phone }));
        } catch (storeError) {
          console.error('[Auth] Error persisting auth metadata:', storeError);
        }
        if (__DEV__) console.log('[Auth] Login flow completed successfully');
        return { success: true, message: 'OTP verified successfully' };
      }

      return { success: false, message: 'Invalid OTP' };
    } catch (error) {
      console.error('OTP verification error:', error);
      return { success: false, message: 'Verification failed' };
    } finally {
      setLoading(false);
    }
  };

  const resendOTP = async (phone: string): Promise<{ success: boolean; message: string }> => {
    try {
      setLoading(true);
      const lastSentRaw = await SecureStore.getItemAsync(OTP_LAST_SENT_KEY);
      const lastSent = lastSentRaw ? parseInt(lastSentRaw, 10) : 0;
      const elapsed = Date.now() - lastSent;

      if (elapsed < OTP_COOLDOWN_MS) {
        const waitSeconds = Math.ceil((OTP_COOLDOWN_MS - elapsed) / 1000);
        return { success: false, message: `Wait ${waitSeconds}s before resending.` };
      }

      const { error } = await supabase.auth.resend({
        type: 'sms',
        phone,
      });

      if (error) {
        console.error('Resend OTP error:', error);
        return { success: false, message: error.message };
      }

      await SecureStore.setItemAsync(OTP_LAST_SENT_KEY, String(Date.now()));
      return { success: true, message: 'OTP resent successfully' };
    } catch (error) {
      console.error('Resend OTP error:', error);
      return { success: false, message: 'Failed to resend OTP' };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Sign out error:', error);
        Alert.alert('Error', 'Failed to sign out');
      }
      // Clear any stored auth data
      await SecureStore.deleteItemAsync(AUTH_LOGGED_IN_KEY);
      await SecureStore.deleteItemAsync(AUTH_PROFILE_KEY);
      await SecureStore.deleteItemAsync(OTP_LAST_SENT_KEY);
    } catch (error) {
      console.error('Sign out error:', error);
      Alert.alert('Error', 'Failed to sign out');
    } finally {
      setLoading(false);
    }
  };

  const clearCorruptedSession = async (): Promise<void> => {
    try {
      // Clear Supabase session and tokens
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch {}

      // Clear local state
      setSession(null);
      setUser(null);
      setProfile(null);
      
      // Clear all auth-related storage
      await Promise.all([
        SecureStore.deleteItemAsync(AUTH_LOGGED_IN_KEY),
        SecureStore.deleteItemAsync(AUTH_PROFILE_KEY),
        SecureStore.deleteItemAsync(OTP_LAST_SENT_KEY),
      ]);
      
      if (__DEV__) console.log('Corrupted session cleared successfully');
    } catch (error) {
      console.error('Error clearing session:', error);
      // Even if clearing fails, reset local state
      setSession(null);
      setUser(null);
      setProfile(null);
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>): Promise<boolean> => {
    if (!user) return false;
    
    try {
      const success = await UserProfileService.updateProfile(user.id, updates);
      if (success) {
        await refreshProfile();
      }
      return success;
    } catch (error) {
      console.error('Error updating profile:', error);
      return false;
    }
  };

  const refreshProfile = async (): Promise<void> => {
    if (!user) return;
    
    try {
      const userProfile = await UserProfileService.getProfile(user.id);
      setProfile(userProfile);
    } catch (error) {
      console.error('Error refreshing profile:', error);
    }
  };

  const value: AuthContextType = {
    session,
    user,
    profile,
    loading,
    signInWithPhone,
    verifyOTP,
    signOut,
    resendOTP,
    updateProfile,
    refreshProfile,
    clearCorruptedSession,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
