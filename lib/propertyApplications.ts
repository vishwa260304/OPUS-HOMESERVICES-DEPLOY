import { supabase } from './supabase';

export type PropertyApplication = {
  id: string;
  user_id: string;
  full_name: string | null;
  address: string | null;
  phone: string | null;
  house_type: string | null;
  house_address: string | null;
  created_at: string;
  updated_at: string;
};

export type CreatePropertyApplicationInput = {
  // user_id is set by a database trigger; do not send from client
  full_name?: string | null;
  address?: string | null;
  phone?: string | null;
  house_type?: string | null;
  house_address?: string | null;
};

export const PropertyApplicationsApi = {
  async create(input: CreatePropertyApplicationInput): Promise<PropertyApplication> {
    const { data, error } = await supabase
      .from('property_applications')
      .insert([input])
      .select('*')
      .single();
    if (error) throw error;
    return data as PropertyApplication;
  },
};


