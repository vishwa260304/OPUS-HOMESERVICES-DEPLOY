import { supabase } from './supabase';

export type UserProfileDetails = {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
};

export const UserProfileDetailsApi = {
  async get(userId: string): Promise<UserProfileDetails | null> {
    const { data, error } = await supabase
      .from('user_profile_details')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return data as any;
  },

  async upsert(userId: string, details: { full_name?: string; phone?: string; email?: string; address?: string }): Promise<UserProfileDetails> {
    const payload = {
      user_id: userId,
      full_name: details.full_name ?? null,
      phone: details.phone ?? null,
      email: details.email ?? null,
      
    };
    const { data, error } = await supabase
      .from('user_profile_details')
      .upsert(payload, { onConflict: 'user_id' })
      .select('*')
      .single();
    if (error) throw error;
    return data as any;
  },
};


