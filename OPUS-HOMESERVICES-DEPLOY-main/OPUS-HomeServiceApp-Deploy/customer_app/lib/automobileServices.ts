import { supabase } from './supabase';

// Utility function to get Supabase storage URL
export const getSupabaseImageUrl = (imagePath: string | null): string | null => {
  if (!imagePath) return null;
  
  const { data: { publicUrl } } = supabase.storage
    .from('assets') // Your actual bucket name
    .getPublicUrl(imagePath);
  
  return publicUrl;
};

export type AutomobileServiceRow = {
  id: string;
  section_key: string;
  section_title: string;
  title: string;
  rating: string | null;
  reviews: number | null;
  price: string | null;
  bullets: string[] | null;
  time: string | null;
  image_path: string | null; // Supabase storage path
  category: string;
  created_at: string;
  updated_at: string;
};

export type CreateAutomobileServiceInput = Omit<AutomobileServiceRow, 'id' | 'created_at' | 'updated_at'>;
export type UpdateAutomobileServiceInput = Partial<CreateAutomobileServiceInput> & { id: string };

export const AutomobileServicesApi = {
  async list(): Promise<AutomobileServiceRow[]> {
    const { data, error } = await supabase
      .from('automobile_services')
      .select('*')
      .order('section_title', { ascending: true })
      .order('title', { ascending: true });
    if (error) throw error;
    return (data ?? []) as AutomobileServiceRow[];
  },

  async create(input: CreateAutomobileServiceInput): Promise<AutomobileServiceRow> {
    const { data, error } = await supabase
      .from('automobile_services')
      .insert([{ ...input }])
      .select('*')
      .single();
    if (error) throw error;
    return data as AutomobileServiceRow;
  },

  async update(input: UpdateAutomobileServiceInput): Promise<AutomobileServiceRow> {
    const { id, ...updates } = input;
    const { data, error } = await supabase
      .from('automobile_services')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data as AutomobileServiceRow;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from('automobile_services')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async search(query: string): Promise<AutomobileServiceRow[]> {
    const { data, error } = await supabase
      .from('automobile_services')
      .select('*')
      .or(`title.ilike.%${query}%,section_title.ilike.%${query}%,category.ilike.%${query}%`)
      .order('section_title', { ascending: true })
      .order('title', { ascending: true });
    if (error) throw error;
    return (data ?? []) as AutomobileServiceRow[];
  },
};


