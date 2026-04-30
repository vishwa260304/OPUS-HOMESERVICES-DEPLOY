import { supabase } from './supabase';

// Helper to build a public URL for an object in the `assets` bucket.
// Pass a path relative to the bucket root, e.g. `wellcare_service/physio-ortho.jpg`
// or `pharmeasy_service/aspirin.jpg`.
export const getSupabaseImageUrl = (bucketRelativePath: string): string => {
  const { data } = supabase.storage.from('assets').getPublicUrl(bucketRelativePath);
  return data.publicUrl;
};

export interface WellCareServiceRow {
  id: string;
  section_key: string;
  section_title: string;
  title: string;
  rating?: string;
  reviews?: number;
  price?: string;
  bullets?: string[];
  time?: string;
  image_path?: string;
  created_at: string;
  updated_at: string;
}

export interface WellCareServiceSection {
  title: string;
  items: WellCareServiceRow[];
}

export class WellCareServicesApi {
  static async list(): Promise<WellCareServiceRow[]> {
    try {
      const { data, error } = await supabase
        .from('wellcare_services')
        .select('*')
        .order('section_title', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching wellcare services:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error in WellCareServicesApi.list:', error);
      throw error;
    }
  }

  static async getBySection(sectionKey: string): Promise<WellCareServiceRow[]> {
    try {
      const { data, error } = await supabase
        .from('wellcare_services')
        .select('*')
        .eq('section_key', sectionKey)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching wellcare services by section:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error in WellCareServicesApi.getBySection:', error);
      throw error;
    }
  }

  static async getById(id: string): Promise<WellCareServiceRow | null> {
    try {
      const { data, error } = await supabase
        .from('wellcare_services')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching wellcare service by id:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error in WellCareServicesApi.getById:', error);
      throw error;
    }
  }

  static async create(service: Omit<WellCareServiceRow, 'id' | 'created_at' | 'updated_at'>): Promise<WellCareServiceRow> {
    try {
      const { data, error } = await supabase
        .from('wellcare_services')
        .insert([service])
        .select()
        .single();

      if (error) {
        console.error('Error creating wellcare service:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error in WellCareServicesApi.create:', error);
      throw error;
    }
  }

  static async update(id: string, updates: Partial<Omit<WellCareServiceRow, 'id' | 'created_at' | 'updated_at'>>): Promise<WellCareServiceRow> {
    try {
      const { data, error } = await supabase
        .from('wellcare_services')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating wellcare service:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error in WellCareServicesApi.update:', error);
      throw error;
    }
  }

  static async delete(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('wellcare_services')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting wellcare service:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error in WellCareServicesApi.delete:', error);
      throw error;
    }
  }

  static async getSections(): Promise<WellCareServiceSection[]> {
    try {
      const services = await this.list();
      
      // Group services by section
      const sectionMap = new Map<string, WellCareServiceRow[]>();
      
      services.forEach(service => {
        const sectionTitle = service.section_title;
        if (!sectionMap.has(sectionTitle)) {
          sectionMap.set(sectionTitle, []);
        }
        sectionMap.get(sectionTitle)!.push(service);
      });

      // Convert to array format
      const sections: WellCareServiceSection[] = Array.from(sectionMap.entries()).map(([title, items]) => ({
        title,
        items
      }));

      return sections;
    } catch (error) {
      console.error('Error in WellCareServicesApi.getSections:', error);
      throw error;
    }
  }
}

// Note: single source of truth for image URL builder is the function above.
