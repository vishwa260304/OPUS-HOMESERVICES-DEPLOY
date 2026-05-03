import { supabase } from './supabase';

// Utility function to get Supabase storage URL
export const getSupabaseImageUrl = (imagePath: string | null): string | null => {
  if (!imagePath) return null;
  
  const { data: { publicUrl } } = supabase.storage
    .from('assets') // Your actual bucket name
    .getPublicUrl(imagePath);
  
  return publicUrl;
};

// Lab Types
export type LabRow = {
  id: string;
  name: string;
  specialty: string | null;
  rating: number;
  reviews: number;
  address: string | null;
  phone: string | null;
  timings: string | null;
  image_path: string | null;
  features: string[];
  is_active: boolean;
  is_top_lab: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type LabServiceRow = {
  id: string;
  lab_id: string;
  name: string;
  description: string | null;
  price: number;
  original_price: number | null;
  image_path: string | null;
  category: string | null;
  is_available: boolean;
  preparation_instructions: string | null;
  report_delivery_time: string | null;
  home_collection_available: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type LabBookingRow = {
  id: string;
  user_id: string;
  lab_id: string;
  service_id: string;
  booking_date: string;
  booking_time: string;
  patient_name: string;
  patient_age: number | null;
  patient_gender: string | null;
  patient_phone: string | null;
  address: string | null;
  status: string;
  total_amount: number | null;
  payment_status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

// Input Types
export type CreateLabInput = Omit<LabRow, 'id' | 'created_by' | 'created_at' | 'updated_at'>;
export type UpdateLabInput = Partial<CreateLabInput> & { id: string };

export type CreateLabServiceInput = Omit<LabServiceRow, 'id' | 'created_by' | 'created_at' | 'updated_at'>;
export type UpdateLabServiceInput = Partial<CreateLabServiceInput> & { id: string };

export type CreateLabBookingInput = Omit<LabBookingRow, 'id' | 'created_at' | 'updated_at'>;
export type UpdateLabBookingInput = Partial<CreateLabBookingInput> & { id: string };

// Lab API
export const LabApi = {
  async list(): Promise<LabRow[]> {
    const { data, error } = await supabase
      .from('labs')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async getById(id: string): Promise<LabRow | null> {
    const { data, error } = await supabase
      .from('labs')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async getTopLabs(): Promise<LabRow[]> {
    const { data, error } = await supabase
      .from('labs')
      .select('*')
      .eq('is_active', true)
      .eq('is_top_lab', true)
      .order('rating', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async create(input: CreateLabInput): Promise<LabRow> {
    const { data, error } = await supabase
      .from('labs')
      .insert(input)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(input: UpdateLabInput): Promise<LabRow> {
    const { id, ...updateData } = input;
    const { data, error } = await supabase
      .from('labs')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('labs')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};

// Lab Services API
export const LabServicesApi = {
  async list(): Promise<LabServiceRow[]> {
    const { data, error } = await supabase
      .from('lab_services')
      .select('*')
      .eq('is_available', true)
      .order('lab_id', { ascending: true })
      .order('name', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async getByLabId(labId: string): Promise<LabServiceRow[]> {
    const { data, error } = await supabase
      .from('lab_services')
      .select('*')
      .eq('lab_id', labId)
      .eq('is_available', true)
      .order('name', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async getByCategory(category: string): Promise<LabServiceRow[]> {
    const { data, error } = await supabase
      .from('lab_services')
      .select('*')
      .eq('category', category)
      .eq('is_available', true)
      .order('name', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async getById(id: string): Promise<LabServiceRow | null> {
    const { data, error } = await supabase
      .from('lab_services')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async create(input: CreateLabServiceInput): Promise<LabServiceRow> {
    const { data, error } = await supabase
      .from('lab_services')
      .insert(input)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(input: UpdateLabServiceInput): Promise<LabServiceRow> {
    const { id, ...updateData } = input;
    const { data, error } = await supabase
      .from('lab_services')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('lab_services')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async search(query: string): Promise<LabServiceRow[]> {
    const { data, error } = await supabase
      .from('lab_services')
      .select('*')
      .or(`name.ilike.%${query}%,description.ilike.%${query}%,category.ilike.%${query}%`)
      .eq('is_available', true)
      .order('name', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },
};

// Lab Bookings API
export const LabBookingsApi = {
  async listByUserId(userId: string): Promise<LabBookingRow[]> {
    const { data, error } = await supabase
      .from('lab_bookings')
      .select('*')
      .eq('user_id', userId)
      .order('booking_date', { ascending: false })
      .order('booking_time', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async getById(id: string): Promise<LabBookingRow | null> {
    const { data, error } = await supabase
      .from('lab_bookings')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async create(input: CreateLabBookingInput): Promise<LabBookingRow> {
    const { data, error } = await supabase
      .from('lab_bookings')
      .insert(input)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(input: UpdateLabBookingInput): Promise<LabBookingRow> {
    const { id, ...updateData } = input;
    const { data, error } = await supabase
      .from('lab_bookings')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async cancel(id: string): Promise<LabBookingRow> {
    const { data, error } = await supabase
      .from('lab_bookings')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('lab_bookings')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};

// Combined API for getting lab with services
export const LabWithServicesApi = {
  async getLabWithServices(labId: string): Promise<{ lab: LabRow; services: LabServiceRow[] } | null> {
    const [lab, services] = await Promise.all([
      LabApi.getById(labId),
      LabServicesApi.getByLabId(labId)
    ]);
    
    if (!lab) return null;
    
    return { lab, services };
  },

  async getAllLabsWithServices(): Promise<{ lab: LabRow; services: LabServiceRow[] }[]> {
    const labs = await LabApi.list();
    const labsWithServices = await Promise.all(
      labs.map(async (lab) => {
        const services = await LabServicesApi.getByLabId(lab.id);
        return { lab, services };
      })
    );
    
    return labsWithServices;
  },
};
