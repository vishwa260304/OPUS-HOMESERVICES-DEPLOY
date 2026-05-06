import { supabase } from './supabase';

export type UserAddressRow = {
  id: string;
  user_id: string;
  label: 'Home' | 'Work' | 'Other' | string;
  recipient_name: string | null;
  phone: string | null;
  line1: string;
  city: string;
  state: string;
  pincode: string;
  created_at: string;
  updated_at: string;
};

export type CreateUserAddressInput = {
  user_id: string;
  label: 'Home' | 'Work' | 'Other' | string;
  recipient_name?: string;
  phone?: string;
  line1: string;
  city: string;
  state: string;
  pincode: string;
};

export const UserAddressesApi = {
  async listByUser(userId: string): Promise<UserAddressRow[]> {
    const { data, error } = await supabase
      .from('user_addresses')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async create(input: CreateUserAddressInput): Promise<UserAddressRow> {
    const { data, error } = await supabase
      .from('user_addresses')
      .insert([input])
      .select('*')
      .single();
    if (error) throw error;
    return data as UserAddressRow;
  },

  async update(userId: string, id: string, updates: Partial<Omit<CreateUserAddressInput, 'user_id'>>): Promise<UserAddressRow> {
    const { data, error } = await supabase
      .from('user_addresses')
      .update({
        label: updates.label,
        recipient_name: updates.recipient_name,
        phone: updates.phone,
        line1: updates.line1,
        city: updates.city,
        state: updates.state,
        pincode: updates.pincode,
      })
      .eq('user_id', userId)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data as UserAddressRow;
  },

  async remove(userId: string, id: string): Promise<void> {
    const { error } = await supabase
      .from('user_addresses')
      .delete()
      .eq('user_id', userId)
      .eq('id', id);
    if (error) throw error;
  },
};


