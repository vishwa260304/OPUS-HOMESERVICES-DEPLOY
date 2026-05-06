// lib/patientsService.ts
import { supabase } from './supabase';

export interface Patient {
  id: string;
  doctor_user_id: string;
  customer_user_id: string | null;
  booking_id: string | null;
  patient_name: string;
  patient_phone: string | null;
  patient_email: string | null;
  patient_address: any | null;
  consultation_date: string;
  consultation_time: string | null;
  consultation_type: string | null;
  symptoms: string | null;
  notes: string | null; // Customer notes
  diagnosis: string | null; // Doctor-provided
  prescription: string | null; // Doctor-provided
  doctor_notes: string | null; // Doctor-provided
  status: string;
  amount: number | null;
  payment_status: string | null;
  created_at: string;
  updated_at: string;
}

export interface PatientInsert {
  doctor_user_id: string;
  customer_user_id?: string | null;
  booking_id?: string | null;
  patient_name: string;
  patient_phone?: string | null;
  patient_email?: string | null;
  patient_address?: any | null;
  consultation_date: string;
  consultation_time?: string | null;
  consultation_type?: string | null;
  symptoms?: string | null;
  notes?: string | null;
  status?: string;
  amount?: number | null;
  payment_status?: string | null;
}

/**
 * Service for managing patient data from customer app
 */
export const PatientsService = {
  /**
   * Get patient by booking_id
   */
  async getByBookingId(bookingId: string): Promise<Patient | null> {
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('booking_id', bookingId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        console.error('Error fetching patient by booking_id:', error);
        return null;
      }

      return data;
    } catch (err) {
      console.error('Exception fetching patient by booking_id:', err);
      return null;
    }
  },

  /**
   * Get all patients for a customer (across all doctors)
   */
  async getByCustomerId(customerUserId: string): Promise<Patient[]> {
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('customer_user_id', customerUserId)
        .order('consultation_date', { ascending: false });

      if (error) {
        console.error('Error fetching patients:', error);
        return [];
      }

      return data || [];
    } catch (err) {
      console.error('Exception fetching patients:', err);
      return [];
    }
  },

  /**
   * Get all patients for a customer for a specific doctor
   */
  async getByCustomerAndDoctorAll(
    customerUserId: string,
    doctorUserId: string
  ): Promise<Patient[]> {
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('customer_user_id', customerUserId)
        .eq('doctor_user_id', doctorUserId)
        .order('consultation_date', { ascending: false });

      if (error) {
        console.error('Error fetching patients:', error);
        return [];
      }

      return data || [];
    } catch (err) {
      console.error('Exception fetching patients:', err);
      return [];
    }
  },

  /**
   * Create patient record from booking (saves all customer-provided data)
   */
  async createFromBooking(patientData: PatientInsert): Promise<Patient | null> {
    try {
      const { data, error } = await supabase
        .from('patients')
        .insert({
          doctor_user_id: patientData.doctor_user_id,
          customer_user_id: patientData.customer_user_id || null,
          booking_id: patientData.booking_id || null,
          patient_name: patientData.patient_name,
          patient_phone: patientData.patient_phone || null,
          patient_email: patientData.patient_email || null,
          patient_address: patientData.patient_address || null,
          consultation_date: patientData.consultation_date,
          consultation_time: patientData.consultation_time || null,
          consultation_type: patientData.consultation_type || null,
          symptoms: patientData.symptoms || null,
          notes: patientData.notes || null,
          status: patientData.status || 'pending',
          amount: patientData.amount || null,
          payment_status: patientData.payment_status || null,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating patient from booking:', error);
        return null;
      }

      return data;
    } catch (err) {
      console.error('Exception creating patient from booking:', err);
      return null;
    }
  },

  /**
   * Sync patient from booking data
   * This should be called after a booking is created
   * Saves ALL customer-provided data from the booking
   */
  async syncFromBooking(
    booking: any,
    doctorUserId: string,
    customerUserId: string,
    createNew: boolean = false
  ): Promise<Patient | null> {
    try {
      // Check if patient record already exists for this booking
      const existing = await this.getByBookingId(booking.id);
      if (existing) {
        // Update existing record with latest booking data
        const { data, error } = await supabase
          .from('patients')
          .update({
            patient_name: booking.patient_name || '',
            patient_phone: booking.patient_phone || null,
            patient_email: booking.patient_email || null,
            patient_address: booking.address || null,
            consultation_date: booking.appointment_date || booking.created_at || new Date().toISOString(),
            consultation_time: booking.appointment_time || null,
            consultation_type: booking.consultation_type || null,
            symptoms: booking.symptoms || null,
            notes: booking.notes || null,
            status: booking.status || 'pending',
            amount: booking.amount ? parseFloat(String(booking.amount)) : null,
            payment_status: booking.payment_status || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) {
          console.error('Error updating patient from booking:', error);
          return null;
        }

        return data;
      }

      // Create new patient record with all customer-provided data
      const patient = await this.createFromBooking({
        doctor_user_id: doctorUserId,
        customer_user_id: customerUserId,
        booking_id: booking.id,
        patient_name: booking.patient_name || '',
        patient_phone: booking.patient_phone || null,
        patient_email: booking.patient_email || null,
        patient_address: booking.address || null,
        consultation_date: booking.appointment_date || booking.created_at || new Date().toISOString(),
        consultation_time: booking.appointment_time || null,
        consultation_type: booking.consultation_type || null,
        symptoms: booking.symptoms || null,
        notes: booking.notes || null,
        status: booking.status || 'pending',
        amount: booking.amount ? parseFloat(String(booking.amount)) : null,
        payment_status: booking.payment_status || null,
      });

      return patient;
    } catch (err) {
      console.error('Exception syncing patient from booking:', err);
      return null;
    }
  },
};

