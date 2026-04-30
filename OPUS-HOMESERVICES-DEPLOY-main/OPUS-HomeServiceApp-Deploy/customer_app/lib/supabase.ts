import 'react-native-url-polyfill/auto';
import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';

const ExpoSecureStoreAdapter = {
  getItem: async (key: string) => {
    try {
      console.log(`[SupabaseStorage] getItem starting: ${key}`);
      const chunks = await SecureStore.getItemAsync(`${key}_chunks`);
      if (chunks) {
        console.log(`[SupabaseStorage] Found ${chunks} chunks for: ${key}`);
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
        console.log(`[SupabaseStorage] Reconstructed value (${value.length} bytes) for: ${key}`);
        return value;
      }
      const val = await SecureStore.getItemAsync(key);
      console.log(`[SupabaseStorage] getItem finished: ${key} (found: ${!!val})`);
      return val;
    } catch (error) {
      console.error(`[SupabaseStorage] getItem error for ${key}:`, error);
      return null;
    }
  },
  setItem: async (key: string, value: string) => {
    try {
      console.log(`[SupabaseStorage] setItem starting: ${key} (${value.length} bytes)`);
      if (value.length > 2048) {
        const chunks = Math.ceil(value.length / 2048);
        console.log(`[SupabaseStorage] Chunking ${value.length} bytes into ${chunks} chunks for: ${key}`);
        await SecureStore.setItemAsync(`${key}_chunks`, String(chunks));
        for (let i = 0; i < chunks; i++) {
          await SecureStore.setItemAsync(`${key}_chunk_${i}`, value.slice(i * 2048, (i + 1) * 2048));
        }
        await SecureStore.deleteItemAsync(key);
      } else {
        await SecureStore.deleteItemAsync(`${key}_chunks`);
        await SecureStore.setItemAsync(key, value);
      }
      console.log(`[SupabaseStorage] setItem finished: ${key}`);
    } catch (error) {
      console.error(`[SupabaseStorage] setItem error for ${key}:`, error);
    }
  },
  removeItem: async (key: string) => {
    try {
      console.log(`[SupabaseStorage] removeItem starting: ${key}`);
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
      console.log(`[SupabaseStorage] removeItem finished: ${key}`);
    } catch (error) {
      console.error(`[SupabaseStorage] removeItem error for ${key}:`, error);
    }
  },
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const isPlaceholderConfig = (value?: string) => {
  if (!value) {
    return true;
  }

  return /replace_with|your_|changeme|example/i.test(value);
};

if (isPlaceholderConfig(supabaseUrl) || isPlaceholderConfig(supabaseAnonKey)) {
  throw new Error(
    'Supabase is not configured correctly. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to real project values.'
  );
}

export const supabase = createClient(supabaseUrl!, supabaseAnonKey!, {
  auth: {
    storage: ExpoSecureStoreAdapter as any,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export const SUPABASE_PROJECT_URL = supabaseUrl!;
export const SUPABASE_STORAGE_URL = `${SUPABASE_PROJECT_URL}/storage/v1/object/public`;
export const SUPABASE_FUNCTIONS_URL = `${SUPABASE_PROJECT_URL}/functions/v1`;
