// Provider app: Fetch customer bookings assigned to this provider
import { supabase } from './supabase';

export interface CustomerBookingItem {
  id: string;
  title: string;
  category: string;
  quantity?: number;
  price: string | number;
  labId?: string | null;
  labName?: string | null;
}

export interface CustomerBookingAddress {
  id?: string;
  name?: string;
  phone?: string;
  line1?: string;
  city?: string;
  state?: string;
  pincode?: string;
  type?: string;
}

export interface CustomerBookingSchedule {
  serviceId: string;
  date: string;
  time: string;
}

export interface CustomerBooking {
  id: string;
  user_id: string | null;
  phone: string | null;
  status: string;
  created_at: string;
  total: number;
  items: CustomerBookingItem[] | null;
  address: CustomerBookingAddress | null;
  schedule: CustomerBookingSchedule[] | null;
  breakdown: any;
  provider_id: number | null;
  provider_name: string | null;
  payment_mode: string | null;
  payment_status: string | null;
  currency: string | null;
}

// Map customer booking status to provider dashboard statuses
function mapStatus(customerStatus: string): 'New' | 'confirmed' | 'Assigned' | 'InProgress' | 'Completed' | 'Cancelled' {
  const normalized = (customerStatus || '').toLowerCase();

  if (normalized === 'pending') return 'New';
  if (normalized === 'confirmed') return 'confirmed';
  if (normalized === 'assigned') return 'Assigned';
  if (normalized === 'in_progress' || normalized === 'inprogress') return 'InProgress';
  if (normalized === 'completed') return 'Completed';
  if (normalized === 'cancelled') return 'Cancelled';

  // Default to New for unknown statuses
  return 'New';
}

// Transform customer booking to provider dashboard format
async function transformBooking(booking: any): Promise<any> {
  // Parse items if string
  let items = booking.items;
  if (typeof items === 'string') {
    try {
      items = JSON.parse(items);
    } catch (e) {
      console.warn('Failed to parse items JSON:', e);
      items = [];
    }
  }

  // Parse address if string
  let address = booking.address;
  if (typeof address === 'string') {
    try {
      address = JSON.parse(address);
    } catch (e) {
      console.warn('Failed to parse address JSON:', e);
      address = {};
    }
  }

  // Parse breakdown if string
  let breakdown = booking.breakdown;
  if (typeof breakdown === 'string') {
    try {
      breakdown = JSON.parse(breakdown);
    } catch (e) {
      console.warn('Failed to parse breakdown JSON:', e);
      breakdown = null;
    }
  }

  const firstItem = Array.isArray(items) ? items[0] : null;
  const serviceName = firstItem?.title || 'Service';
  // Use 'address' key if present (from user JSON), fallback to construction from parts
  const addressLine = address?.address || address?.line1 || address?.city || 'Unknown location';

  // Construct a more descriptive location than just the city
  const locationParts = [];
  if (address?.address) locationParts.push(address.address);
  else if (address?.line1) locationParts.push(address.line1);
  if (address?.line2) locationParts.push(address.line2);
  if (address?.city) locationParts.push(address.city);

  const location = locationParts.length > 0 ? locationParts.join(', ') : addressLine;

  const mappedStatus = mapStatus(booking.status);

  // Fetch assigned employee details if assigned_employee_id exists
  let assignedEmployee = null;
  if (booking.assigned_employee_id) {
    try {
      const { data: empData, error: empError } = await supabase
        .from('providers_employees')
        .select('id, name, role, phone, photo, avatar')
        .eq('id', booking.assigned_employee_id)
        .single();

      if (!empError && empData) {
        assignedEmployee = {
          id: empData.id,
          name: empData.name,
          role: empData.role,
          phone: empData.phone,
          photo: empData.photo,
          avatar: empData.avatar,
        };
      }
    } catch (error) {
      console.error('Error fetching assigned employee:', error);
    }
  }

  return {
    id: booking.id,
    customerName: address?.name || 'Customer',
    location: location,
    serviceName: serviceName,
    amount: `₹${booking.total || 0}`,
    paymentMode: booking.payment_mode === 'online' ? 'Online' : 'Cash on Service',
    status: mappedStatus,
    /** Raw DB status (e.g. pending, confirmed, in_progress) for saving as previous_status when cancelling */
    statusRaw: (booking.status || '').toString().toLowerCase(),
    partnerId: assignedEmployee?.id || null,
    partnerName: assignedEmployee?.name || null,
    partnerRole: assignedEmployee?.role || null,
    partnerPhone: assignedEmployee?.phone || null,
    partnerPhoto: assignedEmployee?.photo || null,
    partnerAvatar: assignedEmployee?.avatar || null,
    createdAt: booking.created_at,
    // Additional fields for detail view
    customerPhone: address?.phone || booking.phone || '',
    customerAddress: address,
    items: items,
    schedule: booking.schedule,
    breakdown: breakdown,
    payment_status: booking.payment_status,
    assigned_employee_id: booking.assigned_employee_id,
    // Preserve appointment date and time fields
    appointment_date: booking.appointment_date || null,
    appointment_time: booking.appointment_time || null,
    appointmentDate: booking.appointment_date || null,
    appointmentTime: booking.appointment_time || null,
    // Preserve consultation type and symptoms for doctor appointments
    consultation_type: booking.consultation_type || null,
    consultationType: booking.consultation_type || null,
    symptoms: booking.symptoms || null,
    pharmacy_provider_id: booking.pharmacy_provider_id || null,
  };
}

export const CustomerBookingsAPI = {
  // Fetch all bookings assigned to a specific provider_id
  async getByProviderId(providerId: number): Promise<any[]> {
    try {
      // IMPORTANT: provider_id is bigint in DB, which Supabase returns as string
      // Convert number to string for comparison
      const providerIdStr = String(providerId);

      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .or(`provider_id.eq.${providerIdStr},provider_service_id.eq.${providerIdStr}`)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching provider bookings:', error);
        return [];
      }

      if (!data || data.length === 0) {
        return [];
      }

      // Transform to provider dashboard format (async)
      const transformed = await Promise.all(data.map(transformBooking));
      return transformed;
    } catch (error) {
      console.error('❌ Exception in getByProviderId:', error);
      return [];
    }
  },

  // Fetch all bookings for an acting driver (bookings where acting_driver_id = driver's user_id)
  async getByActingDriverId(actingDriverUserId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('acting_driver_id', actingDriverUserId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching acting driver bookings:', error);
        return [];
      }

      if (!data || data.length === 0) {
        return [];
      }

      const transformed = await Promise.all(data.map(transformBooking));
      return transformed;
    } catch (error) {
      console.error('❌ Exception in getByActingDriverId:', error);
      return [];
    }
  },

  // Fetch unassigned bookings (Marketplace/Open Jobs)
  async getOpenMarketplaceBookings(): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .is('provider_id', null)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching open bookings:', error);
        return [];
      }

      if (!data || data.length === 0) {
        return [];
      }

      // Transform
      const transformed = await Promise.all(data.map(transformBooking));
      return transformed;
    } catch (error) {
      console.error('❌ Exception in getOpenMarketplaceBookings:', error);
      return [];
    }
  },

  async getById(bookingId: string): Promise<any | null> {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', bookingId)
        .single();

      if (error || !data) {
        console.error('❌ Error fetching booking:', error);
        return null;
      }

      return await transformBooking(data);
    } catch (error) {
      console.error('❌ Exception in getById:', error);
      return null;
    }
  },

  // Fetch bookings assigned to a pharmacy provider (auth.users.id)
  async getByPharmacyProviderId(pharmacyUserId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('pharmacy_provider_id', pharmacyUserId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching pharmacy provider bookings:', error);
        return [];
      }

      if (!data || data.length === 0) return [];

      const transformed = await Promise.all(data.map(transformBooking));
      console.log('[CustomerBookingsAPI.getByPharmacyProviderId] transformed count=', transformed.length);
      return transformed;
    } catch (error) {
      console.error('❌ Exception in getByPharmacyProviderId:', error);
      return [];
    }
  },

  // Accept booking and assign to provider.
  // For marketplace providers (with provider_service ids) pass `providerId` (bigint id).
  // For pharmacy providers (no provider_service entries) pass `pharmacyProviderId` (auth.users.uuid).
  async acceptBooking(bookingId: string, providerId?: number | null, pharmacyProviderId?: string | null): Promise<boolean> {
    try {
      const updates: any = { status: 'confirmed' };

      if (providerId !== undefined && providerId !== null) {
        updates.provider_id = String(providerId);
        updates.provider_service_id = String(providerId); // Keep both in sync for consistency
      }

      if (pharmacyProviderId) {
        updates.pharmacy_provider_id = pharmacyProviderId;
      }

      console.log('[CustomerBookingsAPI.acceptBooking] bookingId=', bookingId, 'updates=', updates);
      const { data, error } = await supabase
        .from('bookings')
        .update(updates)
        .eq('id', bookingId)
        .select();

      console.log('[CustomerBookingsAPI.acceptBooking] result data=', data, 'error=', error);

      if (error) {
        console.error('❌ Error accepting booking:', error);
        return false;
      }

      if (!data || (Array.isArray(data) && data.length === 0)) {
        console.warn('[CustomerBookingsAPI.acceptBooking] no rows updated for', bookingId);
        return false;
      }

      return true;
    } catch (error) {
      console.error('❌ Exception in acceptBooking:', error);
      return false;
    }
  },

  // Update booking status (provider accepting/completing job). When cancelling, pass current status as previousStatus so customer app can show correct timeline.
  async updateStatus(
    bookingId: string,
    status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled',
    previousStatus?: string
  ): Promise<boolean> {
    try {
      const payload: { status: string; previous_status?: string } = { status: status.toLowerCase() };
      if (status === 'cancelled') {
        const prev = (previousStatus && String(previousStatus).trim()) ? String(previousStatus).toLowerCase() : 'pending';
        payload.previous_status = prev;
      }
      console.log('[CustomerBookingsAPI.updateStatus] bookingId=', bookingId, 'payload=', payload);
      const { data, error } = await supabase
        .from('bookings')
        .update(payload)
        .eq('id', bookingId)
        .select('id, status, previous_status');

      if (error) {
        console.error('❌ Error updating booking status:', error, 'code=', error.code, 'message=', error.message);
        return false;
      }
      console.log('[CustomerBookingsAPI.updateStatus] result data=', data);

      if (!data || (Array.isArray(data) && data.length === 0)) {
        console.warn('[CustomerBookingsAPI.updateStatus] no rows updated for', bookingId);
        return false;
      }

      return true;
    } catch (error) {
      console.error('❌ Exception in updateStatus:', error);
      return false;
    }
  },

  // Assign employee to a booking
  async assignEmployee(bookingId: string, employeeId: string | number): Promise<boolean> {
    try {
      // trimmed verbose assign log
      console.log('[CustomerBookingsAPI.assignEmployee] bookingId=', bookingId, 'employeeId=', employeeId);
      const { data, error } = await supabase
        .from('bookings')
        .update({
          assigned_employee_id: employeeId,
          status: 'Assigned'
        })
        .eq('id', bookingId)
        .select();

      console.log('[CustomerBookingsAPI.assignEmployee] result data=', data, 'error=', error);

      if (error) {
        console.error('❌ Error assigning employee:', error);
        return false;
      }

      if (!data || (Array.isArray(data) && data.length === 0)) {
        console.warn('[CustomerBookingsAPI.assignEmployee] no rows updated for', bookingId);
        return false;
      }

      return true;
    } catch (error) {
      console.error('❌ Exception in assignEmployee:', error);
      return false;
    }
  },

  // Update payment status (e.g., mark as paid for cash on service)
  async updatePaymentStatus(bookingId: string, paymentStatus: 'paid' | 'pending' | 'failed'): Promise<boolean> {
    try {
      console.log('[CustomerBookingsAPI.updatePaymentStatus] bookingId=', bookingId, 'status=', paymentStatus);
      const { data, error } = await supabase
        .from('bookings')
        .update({ payment_status: paymentStatus })
        .eq('id', bookingId)
        .select();

      if (error) {
        console.error('❌ Error updating payment status:', error);
        return false;
      }

      return !!(data && data.length > 0);
    } catch (error) {
      console.error('❌ Exception in updatePaymentStatus:', error);
      return false;
    }
  },

  // Helper to fetch all bookings (for debugging)
  async getAllBookings(): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('id, provider_id, provider_name, status, created_at')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('❌ Error fetching all bookings:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('❌ Exception in getAllBookings:', error);
      return [];
    }
  },

  // Subscribe to real-time changes for a provider's bookings
  subscribeToProviderBookings(providerId: number, callback: (bookings: any[]) => void) {
    const channel = supabase
      .channel(`provider_bookings_${providerId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `provider_id=eq.${providerId}`,
        },
        async () => {
          // Refetch all bookings when any change occurs
          const bookings = await this.getByProviderId(providerId);
          callback(bookings);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  // Subscribe to unassigned/open bookings
  subscribeToOpenBookings(callback: () => void) {
    const channel = supabase
      .channel('open_bookings_subscription')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: 'provider_id=is.null',
        },
        () => {
          callback();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
};

