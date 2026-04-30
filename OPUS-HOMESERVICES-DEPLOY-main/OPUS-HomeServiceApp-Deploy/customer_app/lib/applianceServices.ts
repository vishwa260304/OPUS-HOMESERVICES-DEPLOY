import { supabase } from './supabase';

// Utility function to get Supabase storage URL
export const getSupabaseImageUrl = (imagePath: string | null): string | null => {
  if (!imagePath) return null;
  
  // Your database already contains the full path including the folder
  const { data: { publicUrl } } = supabase.storage
    .from('assets')
    .getPublicUrl(imagePath);
  
  return publicUrl;
};

export type ApplianceServiceRow = {
  id: string;
  section_key: string;
  section_title: string;
  title: string;
  description?: string; // Made optional since your table doesn't have this column
  rating: string | null;
  reviews: number | null;
  price: string | null;
  bullets: string[]; // Added bullets array
  time: string | null;
  image_path: string | null; // Supabase storage path
  category: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateApplianceServiceInput = Omit<ApplianceServiceRow, 'id' | 'created_by' | 'created_at' | 'updated_at'>;
export type UpdateApplianceServiceInput = Partial<CreateApplianceServiceInput> & { id: string };

export const ApplianceServicesApi = {
  async list(): Promise<ApplianceServiceRow[]> {
    const { data, error } = await supabase
      .from('appliance_services')
      .select('*')
      .order('section_title', { ascending: true })
      .order('title', { ascending: true });
    
    if (error) throw error;
    return data ?? [];
  },

  async create(input: CreateApplianceServiceInput): Promise<ApplianceServiceRow> {
    const { data, error } = await supabase
      .from('appliance_services')
      .insert([{ ...input }])
      .select('*')
      .single();
    if (error) throw error;
    return data as ApplianceServiceRow;
  },

  async update(input: UpdateApplianceServiceInput): Promise<ApplianceServiceRow> {
    const { id, ...updates } = input;
    const { data, error } = await supabase
      .from('appliance_services')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data as ApplianceServiceRow;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from('appliance_services')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async search(query: string): Promise<ApplianceServiceRow[]> {
    const { data, error } = await supabase
      .from('appliance_services')
      .select('*')
      .or(`title.ilike.%${query}%,section_title.ilike.%${query}%,category.ilike.%${query}%`)
      .order('section_title', { ascending: true })
      .order('title', { ascending: true });
    if (error) throw error;
    return (data ?? []) as ApplianceServiceRow[];
  },
};
