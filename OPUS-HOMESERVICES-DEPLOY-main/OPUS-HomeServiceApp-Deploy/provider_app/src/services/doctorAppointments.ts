/**
 * Doctor Appointments Service
 * 
 * Handles real-time synchronization of appointments from patient app
 * to doctor's provider app
 */

import { supabase } from '../lib/supabase';
import { addBooking, getBookings, setBookings } from '../utils/appState';
import { pushNotification } from '../utils/appState';
import type { Booking } from '../utils/appState';

export interface DoctorAppointment {
  id: string;
  patientName: string;
  patientPhone: string;
  patientEmail?: string;
  appointmentDate: string;
  appointmentTime: string;
  consultationType: 'In-Person' | 'Video Call' | 'Phone Call';
  symptoms: string;
  notes?: string;
  location: string;
  amount: number;
  paymentMode: 'Online' | 'Cash';
  status: 'New' | 'Assigned' | 'InProgress' | 'Completed' | 'Cancelled';
  createdAt: string;
  address?: any;
  [key: string]: any;
}

/**
 * Transform Supabase booking to doctor appointment format
 */
function transformToDoctorAppointment(booking: any): DoctorAppointment {
  const address = booking.address || {};
  const location = address.city 
    ? `${address.line1 || ''}, ${address.city}`.trim()
    : booking.consultation_type === 'In-Person' 
      ? 'In-Person Consultation'
      : booking.consultation_type || 'Consultation';

  const serviceName = booking.symptoms 
    ? `In-Person Consultation - ${booking.symptoms}`
    : 'In-Person Consultation';

  return {
    id: booking.id,
    patientName: booking.patient_name || booking.address?.name || 'Patient',
    patientPhone: booking.patient_phone || booking.address?.phone || '',
    patientEmail: booking.patient_email,
    appointmentDate: booking.appointment_date || booking.created_at,
    appointmentTime: booking.appointment_time || '',
    consultationType: booking.consultation_type || 'In-Person',
    symptoms: booking.symptoms || '',
    notes: booking.notes,
    location: location,
    amount: booking.amount || 0,
    paymentMode: booking.payment_mode === 'online' ? 'Online' : 'Cash',
    paymentStatus: booking.payment_status || null,
    status: mapBookingStatus(booking.status),
    createdAt: booking.created_at,
    address: booking.address,
    serviceName: serviceName,
  };
}

function transformToBooking(appointment: DoctorAppointment): Booking {
  return {
    id: appointment.id,
    customerName: appointment.patientName,
    location: appointment.location,
    serviceName: appointment.serviceName || 'Consultation',
    amount: appointment.amount,
    paymentMode: appointment.paymentMode,
    paymentStatus: appointment.paymentStatus || null,
    status: appointment.status,
    createdAt: appointment.createdAt,
  };
}

/**
 * Map booking status from database to doctor app format
 */
function mapBookingStatus(status: string): 'New' | 'Assigned' | 'InProgress' | 'Completed' | 'Cancelled' {
  const normalized = (status || '').toLowerCase();
  
  if (normalized === 'pending' || normalized === 'new') return 'New';
  if (normalized === 'confirmed' || normalized === 'assigned') return 'Assigned';
  if (normalized === 'in_progress' || normalized === 'inprogress') return 'InProgress';
  if (normalized === 'completed') return 'Completed';
  if (normalized === 'cancelled') return 'Cancelled';
  
  return 'New';
}

/**
 * Fetch doctor appointments from Supabase
 */
export async function fetchDoctorAppointments(providerId: number): Promise<DoctorAppointment[]> {
  try {
    // Convert providerId to string for comparison (Supabase returns bigint as string)
    const providerIdStr = String(providerId);

    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('provider_id', providerIdStr)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching doctor appointments:', error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Transform to doctor appointment format
    const appointments = data.map(transformToDoctorAppointment);
    
    // Update local state
    const existingBookings = getBookings();
    const mergedBookings = [...appointments.map(transformToBooking), ...existingBookings.filter(b => 
      !appointments.some(a => a.id === b.id)
    )];
    setBookings(mergedBookings);

    return appointments;
  } catch (error) {
    console.error('Exception fetching doctor appointments:', error);
    return [];
  }
}

/**
 * Fetch only new/unassigned appointments for a doctor
 */
export async function fetchNewDoctorAppointments(providerId: number): Promise<DoctorAppointment[]> {
  try {
    const providerIdStr = String(providerId);
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('provider_id', providerIdStr)
      .in('status', ['pending', 'new', 'unassigned'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching new doctor appointments:', error);
      return [];
    }

    if (!data || data.length === 0) return [];

    const appointments = data.map(transformToDoctorAppointment);

    return appointments;
  } catch (err) {
    console.error('Exception fetching new doctor appointments:', err);
    return [];
  }
}

/**
 * Subscribe to real-time appointment updates
 * This will automatically update when patient app creates new appointments
 */
export function subscribeToDoctorAppointments(
  providerId: number,
  onNewAppointment: (appointment: DoctorAppointment) => void,
  onUpdateAppointment: (appointment: DoctorAppointment) => void,
  doctorUserId?: string
): () => void {
  const providerIdStr = String(providerId);
  
  console.log('🔔 Setting up real-time subscription for doctor appointments, provider_id:', providerIdStr, 'doctor_user_id:', doctorUserId);

  const channel = supabase
    .channel(`doctor_appointments_${providerId}_${doctorUserId || 'none'}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'bookings',
        filter: `provider_id=eq.${providerIdStr}`,
      },
      async (payload) => {
        console.log('📥 New appointment received from patient app (provider_id):', payload.new);
        
        // Check if booking already exists to prevent duplicate processing
        const existingBookings = getBookings();
        if (existingBookings.some(b => b.id === payload.new.id)) {
          console.log('⏭️ Booking already processed, skipping duplicate');
          return;
        }
        
        // Only process if this booking is assigned to this doctor (if doctorUserId is provided)
        if (doctorUserId && payload.new.doctor_user_id && payload.new.doctor_user_id !== doctorUserId) {
          console.log('⏭️ Skipping appointment - not assigned to this doctor');
          return;
        }
        
        const newAppointment = transformToDoctorAppointment(payload.new);
        
        // Add to local state
        addBooking({
          id: newAppointment.id,
          customerName: newAppointment.patientName,
          location: newAppointment.location,
          serviceName: newAppointment.serviceName,
          amount: newAppointment.amount,
          paymentMode: newAppointment.paymentMode,
          paymentStatus: newAppointment.paymentStatus || null,
          status: 'New',
          createdAt: newAppointment.createdAt,
        });

        // Send notification
        pushNotification({
          type: 'booking',
          title: 'New Appointment Request',
          sub: `${newAppointment.patientName} - ${newAppointment.symptoms || 'Consultation'}`,
          time: 'Just now',
        });

        // Callback
        onNewAppointment(newAppointment);
      }
    );

  // If doctorUserId is provided, also listen for bookings directly assigned to this doctor
  if (doctorUserId) {
    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'bookings',
        filter: `doctor_user_id=eq.${doctorUserId}`,
      },
      async (payload) => {
        console.log('📥 New appointment received from patient app (doctor_user_id):', payload.new);
        
        // Check if booking already exists to prevent duplicate processing
        // (in case both provider_id and doctor_user_id filters match)
        const existingBookings = getBookings();
        if (existingBookings.some(b => b.id === payload.new.id)) {
          console.log('⏭️ Booking already processed, skipping duplicate');
          return;
        }
        
        const newAppointment = transformToDoctorAppointment(payload.new);
        
        // Add to local state
        addBooking({
          id: newAppointment.id,
          customerName: newAppointment.patientName,
          location: newAppointment.location,
          serviceName: newAppointment.serviceName,
          amount: newAppointment.amount,
          paymentMode: newAppointment.paymentMode,
          paymentStatus: newAppointment.paymentStatus || null,
          status: 'New',
          createdAt: newAppointment.createdAt,
        });

        // Send notification
        pushNotification({
          type: 'booking',
          title: 'New Appointment Request',
          sub: `${newAppointment.patientName} - ${newAppointment.symptoms || 'Consultation'}`,
          time: 'Just now',
        });

        // Callback
        onNewAppointment(newAppointment);
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'bookings',
        filter: `doctor_user_id=eq.${doctorUserId}`,
      },
      async (payload) => {
        console.log('📝 Appointment updated (doctor_user_id):', payload.new);
        
        const updatedAppointment = transformToDoctorAppointment(payload.new);
        
        // Update local state
        const bookings = getBookings();
        const updatedBookings = bookings.map(b => 
          b.id === updatedAppointment.id ? {
            ...b,
            status: updatedAppointment.status,
            customerName: updatedAppointment.patientName,
            location: updatedAppointment.location,
            serviceName: updatedAppointment.serviceName,
            amount: updatedAppointment.amount,
          } : b
        );
        setBookings(updatedBookings);

        // Callback
        onUpdateAppointment(updatedAppointment);
      }
    );
  }

  // Also listen for updates by provider_id
  channel.on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'bookings',
      filter: `provider_id=eq.${providerIdStr}`,
    },
    async (payload) => {
      console.log('📝 Appointment updated (provider_id):', payload.new);
      
      // Only process if this booking is assigned to this doctor (if doctorUserId is provided)
      if (doctorUserId && payload.new.doctor_user_id && payload.new.doctor_user_id !== doctorUserId) {
        console.log('⏭️ Skipping appointment update - not assigned to this doctor');
        return;
      }
      
      const updatedAppointment = transformToDoctorAppointment(payload.new);
      
      // Update local state
      const bookings = getBookings();
      const updatedBookings = bookings.map(b => 
        b.id === updatedAppointment.id ? {
          ...b,
          status: updatedAppointment.status,
          customerName: updatedAppointment.patientName,
          location: updatedAppointment.location,
          serviceName: updatedAppointment.serviceName,
          amount: updatedAppointment.amount,
          paymentStatus: updatedAppointment.paymentStatus || b.paymentStatus || null,
        } : b
      );
      setBookings(updatedBookings);

      // Callback
      onUpdateAppointment(updatedAppointment);
    }
  )
  .subscribe((status) => {
    console.log('📡 Doctor appointments subscription status:', status);
  });

  // Return unsubscribe function
  return () => {
    console.log('🔕 Unsubscribing from doctor appointments');
    supabase.removeChannel(channel);
  };
}

/**
 * Update appointment status (when doctor accepts/rejects/completes)
 */
export async function updateAppointmentStatus(
  appointmentId: string,
  status: 'confirmed' | 'in_progress' | 'completed' | 'cancelled'
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('bookings')
      .update({ 
        status: status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', appointmentId);

    if (error) {
      console.error('Error updating appointment status:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Exception updating appointment status:', error);
    return false;
  }
}
