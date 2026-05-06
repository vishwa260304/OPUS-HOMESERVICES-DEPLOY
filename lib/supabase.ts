import 'react-native-url-polyfill/auto';
import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';

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

import Constants from 'expo-constants';

const getEnvVar = (name: string) => {
  const value = process.env[name] || Constants.expoConfig?.extra?.[name];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return (trimmed === 'undefined' || trimmed === 'null' || trimmed === '') ? undefined : trimmed;
};

const supabaseUrl = getEnvVar('EXPO_PUBLIC_SUPABASE_URL');
const supabaseAnonKey = getEnvVar('EXPO_PUBLIC_SUPABASE_ANON_KEY');

const isPlaceholderConfig = (value?: string) => {
  if (!value) {
    return true;
  }
  return /replace_with|your_|changeme|example/i.test(value);
};

// Create a dummy client that throws helpful errors if used before configuration
const createDummyClient = (errorMsg: string) => {
  if (__DEV__) console.warn(`Supabase warning: ${errorMsg}`);
  return new Proxy({}, {
    get: (_, prop) => {
      if (prop === 'auth') {
        return new Proxy({}, {
          get: () => () => { throw new Error(errorMsg); }
        });
      }
      return () => { throw new Error(errorMsg); };
    }
  }) as any;
};

let supabaseClient;

if (!supabaseUrl || !supabaseAnonKey) {
  const msg = 'Supabase credentials missing. Check EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env file.';
  supabaseClient = createDummyClient(msg);
} else if (isPlaceholderConfig(supabaseUrl) || isPlaceholderConfig(supabaseAnonKey)) {
  const msg = 'Supabase placeholder detected. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to real values.';
  supabaseClient = createDummyClient(msg);
} else {
  try {
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: ExpoSecureStoreAdapter as any,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  } catch (error: any) {
    console.error('CRITICAL: Supabase initialization failed:', error);
    supabaseClient = createDummyClient(`Supabase initialization error: ${error?.message || 'Unknown error'}`);
  }
}

export const supabase = supabaseClient;
export const SUPABASE_PROJECT_URL = supabaseUrl || '';
export const SUPABASE_STORAGE_URL = supabaseUrl ? `${supabaseUrl}/storage/v1/object/public` : '';
export const SUPABASE_FUNCTIONS_URL = supabaseUrl ? `${supabaseUrl}/functions/v1` : '';

