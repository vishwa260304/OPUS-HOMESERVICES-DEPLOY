// lib/bookings.ts
import { supabase } from './supabase';

export interface ServiceProviderMapping {
  provider_service_id: number; // 🔄 int8 in DB
  company_name: string;
}

export interface BookingItem {
  id: string;
  title: string;
  category: string;
  quantity?: number;
  price: string | number;
  labId?: string | null;
  labName?: string | null;
  // Optional media fields for UI compatibility
  image?: string | null;
  imageUri?: string | null;
}

export interface BookingBreakdown {
  subtotal: number;
  serviceFee: number;
  tax: number;
  discount: number;
  total: number;
}

export interface BookingScheduleEntry {
  serviceId: string;
  date: string;
  time: string;
  endTime?: string;
}

export interface BookingAddress {
  id?: string;
  name?: string;
  phone?: string;
  line1?: string;
  city?: string;
  state?: string;
  pincode?: string;
  type?: string;
}

export interface BookingRow {
  id: string;
  user_id: string | null;
  status: string;
  created_at: string;
  total: number;
  items: BookingItem[] | null;
  address: BookingAddress | null;
  schedule: BookingScheduleEntry[] | null;
  breakdown: BookingBreakdown | null;
  provider_id: number | null;
  provider_name: string | null;
  payment_mode: string | null;
  payment_status: string | null;
  payment_reference?: string | null;
  payment_amount?: number | null;
  currency: string | null;
}

export interface BookingInsert {
  user_id: string | null;
  phone?: string | null; 
  status: string;
  total: number;
  items: BookingItem[] | null;
  address: BookingAddress | null;
  schedule: BookingScheduleEntry[] | null;
  breakdown: BookingBreakdown | null;
  provider_service_id: number | null; // ✅ input field from frontend
  provider_name?: string | null;
  payment_mode: string | null;
  payment_status: string | null;
  payment_reference?: string | null;
  payment_amount?: number | null;
  currency: string | null;
}

// Fetch mapping info
async function fetchProviderMapping(provider_service_id: number) {
  const { data, error } = await supabase
    .from('provider_service_mapping')
    .select('provider_service_id, company_name')
    .eq('provider_service_id', provider_service_id)
    .maybeSingle();

  if (error || !data) return { id: null, name: null };

  return {
    id: Number(data.provider_service_id),
    name: data.company_name,
  };
}

export const BookingsApi = {
  async create(input: BookingInsert): Promise<BookingRow | null> {
    let provider_id: number | null = null;
    let provider_name: string | null = null;

    if (input.provider_service_id != null) {
      const mapping = await fetchProviderMapping(input.provider_service_id);
      provider_id = mapping.id;
      provider_name = mapping.name;
    }

    const insertObj = {
      user_id: input.user_id,
      phone:
        input.address?.phone ??
        null,
      status: input.status?.toLowerCase?.() ?? input.status,
      total: input.total,
      items: input.items,
      address: input.address,
      schedule: input.schedule,
      breakdown: input.breakdown,
      provider_id: provider_id,
      provider_name: provider_name,
      payment_mode: input.payment_mode?.toLowerCase?.() ?? input.payment_mode,
      payment_status: input.payment_status?.toLowerCase?.() ?? input.payment_status,
    payment_reference: input.payment_reference ?? null,
    payment_amount: input.payment_amount ?? null,
      currency: input.currency,
    };

    const { data, error } = await supabase
      .from('bookings')
      .insert(insertObj)
      .select('*')
      .single();

    if (error) {
      console.error("❌ Booking DB Insert Error:", error);
      return null;
    }

    return data as BookingRow;
  },

  async listByUser(userId: string): Promise<BookingRow[]> {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn("⚠ listByUser error:", error);
      return [];
    }
    return data as BookingRow[];
  },

  async getById(id: string): Promise<BookingRow | null> {
    // Defensive: avoid calling Supabase with empty/invalid ids which spams warnings
    if (!id || String(id).trim() === '') return null;

    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        return null;
      }
      return data as BookingRow;
    } catch {
      return null;
    }
  },

  async updateStatus(id: string, status: string): Promise<boolean> {
    const { error } = await supabase
      .from('bookings')
      .update({ status })
      .eq('id', id);

    if (error) {
      console.warn("⚠ updateStatus error:", error);
      return false;
    }

    return true;
  },
};
