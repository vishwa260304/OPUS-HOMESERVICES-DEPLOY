import { supabase } from './supabase';

// Utility function to get Supabase storage URL
export const getSupabaseImageUrl = (imagePath: string | null): string | null => {
  if (!imagePath) return null;
  
  const { data: { publicUrl } } = supabase.storage
    .from('assets') // Your actual bucket name
    .getPublicUrl(imagePath);
  
  return publicUrl;
};

export type PharmEasyServiceRow = {
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

export type CreatePharmEasyServiceInput = Omit<PharmEasyServiceRow, 'id' | 'created_by' | 'created_at' | 'updated_at'>;
export type UpdatePharmEasyServiceInput = Partial<CreatePharmEasyServiceInput> & { id: string };

export const PharmEasyServicesApi = {
  async list(): Promise<PharmEasyServiceRow[]> {
    const { data, error } = await supabase
      .from('pharmeasy_services')
      .select('*')
      .order('section_title', { ascending: true })
      .order('title', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async getBySection(sectionKey: string): Promise<PharmEasyServiceRow[]> {
    const { data, error } = await supabase
      .from('pharmeasy_services')
      .select('*')
      .eq('section_key', sectionKey)
      .order('title', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async getByCategory(category: string): Promise<PharmEasyServiceRow[]> {
    const { data, error } = await supabase
      .from('pharmeasy_services')
      .select('*')
      .eq('category', category)
      .order('title', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async search(query: string): Promise<PharmEasyServiceRow[]> {
    const { data, error } = await supabase
      .from('pharmeasy_services')
      .select('*')
      .or(`title.ilike.%${query}%,section_title.ilike.%${query}%,category.ilike.%${query}%`)
      .order('title', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async create(input: CreatePharmEasyServiceInput): Promise<PharmEasyServiceRow> {
    const { data, error } = await supabase
      .from('pharmeasy_services')
      .insert([{ ...input }])
      .select('*')
      .single();
    if (error) throw error;
    return data as PharmEasyServiceRow;
  },

  async update(input: UpdatePharmEasyServiceInput): Promise<PharmEasyServiceRow> {
    const { id, ...updates } = input;
    const { data, error } = await supabase
      .from('pharmeasy_services')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data as PharmEasyServiceRow;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from('pharmeasy_services')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};

