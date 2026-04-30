import { supabase } from '../lib/supabase';

export interface Patient {
  id: string;
  doctor_user_id: string;
  customer_user_id: string | null;
  booking_id: string | null;
  
  // Patient Information (from customer during booking)
  patient_name: string;
  patient_phone: string | null;
  patient_email: string | null;
  patient_address: any | null;
  
  // Consultation Details (from customer during booking)
  consultation_date: string;
  consultation_time: string | null;
  consultation_type: string | null;
  symptoms: string | null;
  notes: string | null; // Customer notes from booking
  
  // Doctor-provided Information (updated by doctor)
  diagnosis: string | null;
  prescription: string | null;
  doctor_notes: string | null; // Doctor's notes (separate from customer notes)
  status: string; // pending, accepted, in_progress, completed, cancelled
  
  // Financial Information
  amount: number | null;
  payment_status: string | null;
  
  // Metadata
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
  notes?: string | null; // Customer notes
  diagnosis?: string | null; // Doctor-provided
  prescription?: string | null; // Doctor-provided
  doctor_notes?: string | null; // Doctor-provided
  status?: string;
  amount?: number | null;
  payment_status?: string | null;
}

/**
 * Service for managing patients and their consultation history
 */
export const PatientsService = {
  /**
   * Get all patients for a specific doctor
   */
  async getByDoctorId(doctorUserId: string): Promise<Patient[]> {
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
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
   * Get patient by customer user_id
   */
  async getByCustomerUserId(
    doctorUserId: string,
    customerUserId: string
  ): Promise<Patient | null> {
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('doctor_user_id', doctorUserId)
        .eq('customer_user_id', customerUserId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No record found
          return null;
        }
        console.error('Error fetching patient by customer user_id:', error);
        return null;
      }

      return data;
    } catch (err) {
      console.error('Exception fetching patient by customer user_id:', err);
      return null;
    }
  },

  /**
   * Get patient by booking_id (one patient record per booking)
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
   * Get all consultations for a patient (by name and phone)
   */
  async getByPatientNameAndPhone(
    doctorUserId: string,
    patientName: string,
    patientPhone?: string | null
  ): Promise<Patient[]> {
    try {
      let query = supabase
        .from('patients')
        .select('*')
        .eq('doctor_user_id', doctorUserId)
        .eq('patient_name', patientName)
        .order('consultation_date', { ascending: false });

      if (patientPhone) {
        query = query.eq('patient_phone', patientPhone);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching patient consultations:', error);
        return [];
      }

      return data || [];
    } catch (err) {
      console.error('Exception fetching patient consultations:', err);
      return [];
    }
  },

  /**
   * Create patient record from booking (customer data)
   * Each booking creates a new patient record
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
          notes: patientData.notes || null, // Customer notes
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
   * Update patient record with doctor-provided data
   */
  async updateByDoctor(
    patientId: string,
    doctorUserId: string,
    updateData: {
      diagnosis?: string | null;
      prescription?: string | null;
      doctor_notes?: string | null;
      status?: string;
      payment_status?: string | null;
    }
  ): Promise<Patient | null> {
    try {
      const updatePayload: any = {};
      
      if (updateData.diagnosis !== undefined) {
        updatePayload.diagnosis = updateData.diagnosis;
      }
      if (updateData.prescription !== undefined) {
        updatePayload.prescription = updateData.prescription;
      }
      if (updateData.doctor_notes !== undefined) {
        updatePayload.doctor_notes = updateData.doctor_notes;
      }
      if (updateData.status !== undefined) {
        updatePayload.status = updateData.status;
      }
      if (updateData.payment_status !== undefined) {
        updatePayload.payment_status = updateData.payment_status;
      }
      
      updatePayload.updated_at = new Date().toISOString();
      
      const { data, error } = await supabase
        .from('patients')
        .update(updatePayload)
        .eq('id', patientId)
        .eq('doctor_user_id', doctorUserId)
        .select()
        .single();

      if (error) {
        console.error('Error updating patient by doctor:', error);
        return null;
      }

      return data;
    } catch (err) {
      console.error('Exception updating patient by doctor:', err);
      return null;
    }
  },

  /**
   * Get all consultations for a patient (by patient name and phone)
   */
  async getPatientHistory(
    doctorUserId: string,
    patientName: string,
    patientPhone?: string | null
  ): Promise<Patient[]> {
    return this.getByPatientNameAndPhone(doctorUserId, patientName, patientPhone);
  },

  /**
   * Sync patient from booking data (called when booking is created)
   * Creates a new patient record with all customer-provided data
   */
  async syncFromBooking(booking: any, doctorUserId: string): Promise<Patient | null> {
    try {
      const patientName = booking.patient_name || booking.customerName || '';
      const patientPhone = booking.patient_phone || (booking.address as any)?.phone || null;
      const patientEmail = booking.patient_email || null;
      const customerUserId = booking.user_id || null;
      const appointmentDate = booking.appointment_date || booking.appointmentDate || booking.created_at || new Date().toISOString();
      const appointmentTime = booking.appointment_time || booking.appointmentTime || null;
      const consultationType = booking.consultation_type || booking.consultationType || null;
      const symptoms = booking.symptoms || null;
      const amount = booking.amount || booking.total || null;
      const paymentStatus = booking.payment_status || booking.paymentStatus || null;
      const status = booking.status || 'pending';

      // Check if patient record already exists for this booking
      const existing = await this.getByBookingId(booking.id);
      if (existing) {
        // Update existing record with latest booking data
        const { data, error } = await supabase
          .from('patients')
          .update({
            patient_name: patientName,
            patient_phone: patientPhone,
            patient_email: patientEmail,
            patient_address: booking.address || null,
            consultation_date: appointmentDate,
            consultation_time: appointmentTime,
            consultation_type: consultationType,
            symptoms: symptoms,
            notes: booking.notes || null,
            status: status,
            amount: amount ? parseFloat(String(amount)) : null,
            payment_status: paymentStatus,
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
        patient_name: patientName,
        patient_phone: patientPhone,
        patient_email: patientEmail,
        patient_address: booking.address || null,
        consultation_date: appointmentDate,
        consultation_time: appointmentTime,
        consultation_type: consultationType,
        symptoms: symptoms,
        notes: booking.notes || null, // Customer notes
        status: status,
        amount: amount ? parseFloat(String(amount)) : null,
        payment_status: paymentStatus,
      });

      return patient;
    } catch (err) {
      console.error('Exception syncing patient from booking:', err);
      return null;
    }
  },
};
