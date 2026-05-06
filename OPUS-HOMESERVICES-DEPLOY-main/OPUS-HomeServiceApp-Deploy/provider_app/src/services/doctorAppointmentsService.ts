import { supabase } from '../lib/supabase';

export interface DoctorAppointmentRecord {
  id: string;
  booking_id: string;
  doctor_user_id: string;
  status: 'new' | 'assigned' | 'in_progress' | 'completed' | 'cancelled' | 'rejected' | 'accepted';
  accepted_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  doctor_notes: string | null;
  patient_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DoctorAppointmentInsert {
  booking_id: string;
  doctor_user_id: string;
  status?: 'new' | 'assigned' | 'in_progress' | 'completed' | 'cancelled' | 'rejected' | 'accepted';
  doctor_notes?: string | null;
  patient_id?: string | null;
}

export interface DoctorAppointmentUpdate {
  status?: 'new' | 'assigned' | 'in_progress' | 'completed' | 'cancelled' | 'rejected' | 'accepted';
  doctor_notes?: string | null;
  patient_id?: string | null;
}

/**
 * Service for managing doctor appointments in the dedicated table
 */
export const DoctorAppointmentsService = {
  /**
   * Get all appointments for a specific doctor
   */
  async getByDoctorId(doctorUserId: string): Promise<DoctorAppointmentRecord[]> {
    try {
      const { data, error } = await supabase
        .from('doctor_appointments')
        .select('*')
        .eq('doctor_user_id', doctorUserId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching doctor appointments:', error);
        return [];
      }

      return data || [];
    } catch (err) {
      console.error('Exception fetching doctor appointments:', err);
      return [];
    }
  },

  /**
   * Get appointment by booking ID and doctor ID
   */
  async getByBookingAndDoctor(
    bookingId: string,
    doctorUserId: string
  ): Promise<DoctorAppointmentRecord | null> {
    try {
      const { data, error } = await supabase
        .from('doctor_appointments')
        .select('*')
        .eq('booking_id', bookingId)
        .eq('doctor_user_id', doctorUserId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No record found
          return null;
        }
        console.error('Error fetching doctor appointment:', error);
        return null;
      }

      return data;
    } catch (err) {
      console.error('Exception fetching doctor appointment:', err);
      return null;
    }
  },

  /**
   * Create a new doctor appointment record
   */
  async create(
    appointment: DoctorAppointmentInsert
  ): Promise<DoctorAppointmentRecord | null> {
    try {
      // If patient_id is not provided, try to get it from patients table using booking_id
      let patientId = appointment.patient_id;
      if (!patientId) {
        const { data: patientData } = await supabase
          .from('patients')
          .select('id')
          .eq('booking_id', appointment.booking_id)
          .single();
        
        if (patientData) {
          patientId = patientData.id;
        }
      }

      const { data, error } = await supabase
        .from('doctor_appointments')
        .insert({
          booking_id: appointment.booking_id,
          doctor_user_id: appointment.doctor_user_id,
          status: appointment.status || 'new',
          doctor_notes: appointment.doctor_notes || null,
          patient_id: patientId || null,
          accepted_at: (appointment.status === 'assigned' || appointment.status === 'accepted') ? new Date().toISOString() : null,
          cancelled_at: (appointment.status === 'cancelled' || appointment.status === 'rejected') ? new Date().toISOString() : null,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating doctor appointment:', error);
        return null;
      }

      return data;
    } catch (err) {
      console.error('Exception creating doctor appointment:', err);
      return null;
    }
  },

  /**
   * Update appointment status
   */
  async updateStatus(
    bookingId: string,
    doctorUserId: string,
    status: 'new' | 'assigned' | 'in_progress' | 'completed' | 'cancelled' | 'rejected' | 'accepted'
  ): Promise<DoctorAppointmentRecord | null> {
    try {
      const updateData: any = {
        status: status.toLowerCase(),
        updated_at: new Date().toISOString(),
      };

      // Set timestamp fields based on status
      if (status === 'assigned' || status === 'in_progress' || status === 'accepted') {
        updateData.accepted_at = new Date().toISOString();
      }
      if (status === 'completed') {
        updateData.completed_at = new Date().toISOString();
      }
      if (status === 'cancelled' || status === 'rejected') {
        updateData.cancelled_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('doctor_appointments')
        .update(updateData)
        .eq('booking_id', bookingId)
        .eq('doctor_user_id', doctorUserId)
        .select()
        .single();

      if (error) {
        console.error('Error updating doctor appointment status:', error);
        return null;
      }

      return data;
    } catch (err) {
      console.error('Exception updating doctor appointment status:', err);
      return null;
    }
  },

  /**
   * Update appointment (general update)
   */
  async update(
    bookingId: string,
    doctorUserId: string,
    updateData: DoctorAppointmentUpdate
  ): Promise<DoctorAppointmentRecord | null> {
    try {
      // If patient_id is not provided in updateData, try to get it from patients table
      let patientId = updateData.patient_id;
      if (patientId === undefined) {
        const { data: patientData } = await supabase
          .from('patients')
          .select('id')
          .eq('booking_id', bookingId)
          .single();
        
        if (patientData) {
          patientId = patientData.id;
        }
      }

      const updatePayload: any = {
        ...updateData,
        updated_at: new Date().toISOString(),
      };

      // Only set patient_id if we have a value
      if (patientId !== undefined) {
        updatePayload.patient_id = patientId;
      }

      const { data, error } = await supabase
        .from('doctor_appointments')
        .update(updatePayload)
        .eq('booking_id', bookingId)
        .eq('doctor_user_id', doctorUserId)
        .select()
        .single();

      if (error) {
        console.error('Error updating doctor appointment:', error);
        return null;
      }

      return data;
    } catch (err) {
      console.error('Exception updating doctor appointment:', err);
      return null;
    }
  },

  /**
   * Get appointments with booking details joined
   */
  async getWithBookingDetails(
    doctorUserId: string
  ): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('doctor_appointments')
        .select(`
          *,
          booking:bookings (
            id,
            user_id,
            items,
            address,
            schedule,
            appointment_date,
            appointment_time,
            status,
            total,
            amount,
            payment_status,
            payment_amount,
            currency,
            provider_id,
            provider_service_id,
            provider_name,
            patient_name,
            patient_phone,
            created_at,
            notes
          )
        `)
        .eq('doctor_user_id', doctorUserId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching doctor appointments with booking details:', error);
        return [];
      }

      return data || [];
    } catch (err) {
      console.error('Exception fetching doctor appointments with booking details:', err);
      return [];
    }
  },

  /**
   * Create or update appointment (upsert)
   * Useful when accepting a booking - creates record if doesn't exist, updates if it does
   */
  async upsert(
    appointment: DoctorAppointmentInsert
  ): Promise<DoctorAppointmentRecord | null> {
    try {
      // If patient_id is not provided, try to get it from patients table using booking_id
      let patientId = appointment.patient_id;
      if (!patientId) {
        const { data: patientData } = await supabase
          .from('patients')
          .select('id')
          .eq('booking_id', appointment.booking_id)
          .single();
        
        if (patientData) {
          patientId = patientData.id;
        }
      }

      const { data, error } = await supabase
        .from('doctor_appointments')
        .upsert(
          {
            booking_id: appointment.booking_id,
            doctor_user_id: appointment.doctor_user_id,
            status: appointment.status || 'assigned',
            doctor_notes: appointment.doctor_notes || null,
            patient_id: patientId || null,
            accepted_at: (appointment.status === 'assigned' || appointment.status === 'accepted') ? new Date().toISOString() : null,
          },
          {
            onConflict: 'booking_id,doctor_user_id',
          }
        )
        .select()
        .single();

      if (error) {
        console.error('Error upserting doctor appointment:', error);
        return null;
      }

      return data;
    } catch (err) {
      console.error('Exception upserting doctor appointment:', err);
      return null;
    }
  },
};

