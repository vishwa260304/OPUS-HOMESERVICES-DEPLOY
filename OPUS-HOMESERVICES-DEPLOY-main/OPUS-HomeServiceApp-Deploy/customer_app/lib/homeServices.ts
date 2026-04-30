import { supabase } from './supabase';

// Utility function to get Supabase storage URL
export const getSupabaseImageUrl = (imagePath: string | null): string | null => {
  if (!imagePath) return null;
  
  const { data: { publicUrl } } = supabase.storage
    .from('assets') // Your actual bucket name
    .getPublicUrl(imagePath);
  
  return publicUrl;
};

export type HomeServiceRow = {
  id: string;
  section_key: string;
  section_title: string;
  title: string;
  rating: string | null;
  reviews: number | null;
  price: string | null;
  bullets: string[];
  time: string | null;
  image_path: string | null; // Supabase storage path
  category: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateHomeServiceInput = Omit<HomeServiceRow, 'id' | 'created_by' | 'created_at' | 'updated_at'>;
export type UpdateHomeServiceInput = Partial<CreateHomeServiceInput> & { id: string };

export const HomeServicesApi = {
  async list(): Promise<HomeServiceRow[]> {
    const { data, error } = await supabase
      .from('home_services')
      .select('*')
      .order('section_title', { ascending: true })
      .order('title', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async create(input: CreateHomeServiceInput): Promise<HomeServiceRow> {
    const { data, error } = await supabase
      .from('home_services')
      .insert([{ ...input }])
      .select('*')
      .single();
    if (error) throw error;
    return data as HomeServiceRow;
  },

  async update(input: UpdateHomeServiceInput): Promise<HomeServiceRow> {
    const { id, ...updates } = input;
    const { data, error } = await supabase
      .from('home_services')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data as HomeServiceRow;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from('home_services')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async search(query: string): Promise<HomeServiceRow[]> {
    const { data, error } = await supabase
      .from('home_services')
      .select('*')
      .or(`title.ilike.%${query}%,section_title.ilike.%${query}%,category.ilike.%${query}%`)
      .order('section_title', { ascending: true })
      .order('title', { ascending: true });
    if (error) throw error;
    return (data ?? []) as HomeServiceRow[];
  },
};


