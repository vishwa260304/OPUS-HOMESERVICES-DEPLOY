// lib/appointmentService.ts
import { supabase } from './supabase';
import { checkDoctorOnlineStatus, fetchDoctorById, verifyDoctorSpecialization } from './doctorsService';
import { PatientsService } from './patientsService';

export interface AppointmentData {
  patientName: string;
  patientPhone: string;
  patientEmail?: string;
  appointmentDate: string; // ISO timestamp
  appointmentTime: string; // e.g., "10:00 AM"
  consultationType: 'In-Person' | 'Video Call' | 'Phone Call';
  symptoms: string;
  notes?: string;
  address?: {
    line1?: string;
    city?: string;
    state?: string;
    pincode?: string;
    name?: string;
    phone?: string;
  };
  amount: number;
  paymentMode: 'Online' | 'Cash' | 'post_service';
  specialization?: string; // Optional: to verify doctor matches the expected specialization
}

export interface BookingResult {
  success: boolean;
  bookingId?: string;
  error?: string;
}

/**
 * Validate appointment data and prepare for booking
 * NOTE: This does NOT create the booking - booking is created only after payment success
 * 
 * @param doctorId - The provider_id from providers_services table (can be string UUID or number)
 * @param appointmentData - Appointment details
 * @returns Validation result with doctor info or error
 */
export async function validateAppointmentBooking(
  doctorId: string | number,
  appointmentData: AppointmentData
): Promise<{ success: boolean; doctor?: any; error?: string }> {
  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return {
        success: false,
        error: 'User must be logged in to book an appointment',
      };
    }

    // Check if doctor is online before allowing booking
    const isOnline = await checkDoctorOnlineStatus(doctorId);
    if (!isOnline) {
      return {
        success: false,
        error: 'Doctor is currently offline. Please try again when the doctor is online.',
      };
    }

    // Fetch doctor details from providers_doctor_details
    const doctor = await fetchDoctorById(doctorId);
    if (!doctor) {
      return {
        success: false,
        error: 'Doctor not found. Please try again.',
      };
    }

    // CRITICAL: Verify doctor specialization matches (if provided)
    if (appointmentData.specialization) {
      const specializations = doctor.specialization || [];
      const matchesSpecialization = specializations.some((spec: string) => 
        spec.toLowerCase().includes(appointmentData.specialization!.toLowerCase()) ||
        appointmentData.specialization!.toLowerCase().includes(spec.toLowerCase())
      );

      if (!matchesSpecialization) {
        console.error('❌ Specialization mismatch:', {
          expected: appointmentData.specialization,
          doctorSpecializations: specializations,
          doctorId: doctorId
        });
        return {
          success: false,
          error: `This doctor does not match the selected specialization. Please select a ${appointmentData.specialization} doctor.`,
        };
      }
    }

    return {
      success: true,
      doctor: doctor,
    };
  } catch (error: any) {
    console.error('Exception validating appointment:', error);
    return {
      success: false,
      error: error.message || 'An unexpected error occurred',
    };
  }
}

/**
 * Create booking in database (called only after payment success)
 * 
 * @param doctorId - The doctor ID
 * @param appointmentData - Appointment details
 * @param paymentMode - Payment mode ('online' or 'post_service')
 * @param paymentStatus - Payment status ('paid', 'pending', 'failed')
 * @param paymentReference - Payment reference (Razorpay payment ID)
 * @param paymentAmount - Payment amount
 * @param createNewPatient - If true, always create a new patient row instead of updating existing
 * @returns Booking result with booking ID or error
 */
export async function createDoctorAppointmentBooking(
  doctorId: string | number,
  appointmentData: AppointmentData,
  paymentMode: 'online' | 'post_service',
  paymentStatus: 'paid' | 'pending' | 'failed',
  paymentReference?: string | null,
  paymentAmount?: number | null,
  createNewPatient: boolean = false
): Promise<BookingResult> {
  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return {
        success: false,
        error: 'User must be logged in to book an appointment',
      };
    }

    // Fetch doctor details
    const doctor = await fetchDoctorById(doctorId);
    if (!doctor) {
      return {
        success: false,
        error: 'Doctor not found. Please try again.',
      };
    }

    // Fetch doctor's avatar from providers_profiles
    let doctorAvatarUrl: string | null = null;
    if (doctor.userId) {
      const { data: profileData } = await supabase
        .from('providers_profiles')
        .select('avatar_url')
        .eq('id', doctor.userId)
        .single();
      
      if (profileData?.avatar_url) {
        doctorAvatarUrl = profileData.avatar_url;
      }
    }

    // Create booking in Supabase (only after payment success)
    const bookingData: any = {
      user_id: user.id,
      doctor_user_id: doctor.userId,
      status: 'pending', // Will appear as "New" in doctor app
      patient_name: appointmentData.patientName,
      patient_phone: appointmentData.patientPhone,
      patient_email: appointmentData.patientEmail || null,
      appointment_date: appointmentData.appointmentDate,
      appointment_time: appointmentData.appointmentTime,
      consultation_type: appointmentData.consultationType,
      symptoms: appointmentData.symptoms,
      notes: appointmentData.notes || null,
      address: appointmentData.address || null,
      amount: appointmentData.amount,
      total: appointmentData.amount,
      payment_mode: paymentMode,
      payment_status: paymentStatus,
      payment_reference: paymentReference || null,
      payment_amount: paymentAmount || null,
      items: [{
        title: `Doctor Consultation - ${doctor.doctorName}`,
        category: 'Doctor Appointment',
        price: appointmentData.amount,
        doctorName: doctor.doctorName,
        doctorUuid: String(doctorId),
        doctorUserId: doctor.userId,
        doctorAvatar: doctorAvatarUrl,
        specialization: doctor.specialization?.join(', ') || '',
        bookingDate: appointmentData.appointmentDate,
        bookingTime: appointmentData.appointmentTime,
        description: `Consultation with ${doctor.doctorName} for ${appointmentData.symptoms}`,
      }],
      schedule: [{
        serviceId: String(doctorId),
        date: appointmentData.appointmentDate,
        time: appointmentData.appointmentTime,
      }],
    };

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert(bookingData)
      .select()
      .single();

    if (bookingError) {
      console.error('Error creating appointment booking:', bookingError);
      return {
        success: false,
        error: bookingError.message || 'Failed to create appointment. Please try again.',
      };
    }

    if (__DEV__) console.log('✅ Appointment booking created successfully:', booking.id);
    
    // Save patient details to patients table after booking is created
    if (doctor.userId) {
      try {
        // Create a booking object with all necessary fields for patient sync
        const bookingForSync = {
          ...booking,
          patient_name: appointmentData.patientName,
          patient_phone: appointmentData.patientPhone,
          patient_email: appointmentData.patientEmail || null,
          appointment_date: appointmentData.appointmentDate,
          appointment_time: appointmentData.appointmentTime,
          consultation_type: appointmentData.consultationType,
          symptoms: appointmentData.symptoms,
          address: appointmentData.address || null,
        };
        
        await PatientsService.syncFromBooking(bookingForSync, doctor.userId, user.id, createNewPatient);
        if (__DEV__) console.log('✅ Patient details saved to patients table');
      } catch (patientSyncError) {
        console.warn('⚠️ Failed to save patient details (non-critical):', patientSyncError);
        // Don't fail the whole operation if patient sync fails
      }
    }
    
    return {
      success: true,
      bookingId: booking.id,
    };
  } catch (error: any) {
    console.error('Exception creating appointment booking:', error);
    return {
      success: false,
      error: error.message || 'An unexpected error occurred',
    };
  }
}

/**
 * Subscribe to booking status updates
 * 
 * @param bookingId - The booking ID to monitor
 * @param onStatusUpdate - Callback when status changes
 * @returns Unsubscribe function
 */
export function subscribeToBookingStatus(
  bookingId: string,
  onStatusUpdate: (status: string) => void
): () => void {
  const channel = supabase
    .channel(`patient_booking_${bookingId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'bookings',
        filter: `id=eq.${bookingId}`,
      },
      (payload) => {
        const updatedBooking = payload.new;
        if (__DEV__) console.log('📝 Booking status updated:', updatedBooking.status);
        onStatusUpdate(updatedBooking.status);
      }
    )
    .subscribe((status) => {
      if (__DEV__) console.log('📡 Booking status subscription:', status);
    });

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Get booking by ID
 */
export async function getBookingById(bookingId: string) {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (error || !data) {
      console.error('Error fetching booking:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Exception fetching booking:', error);
    return null;
  }
}

/**
 * Update booking payment mode and status
 */
export async function updateBookingPayment(
  bookingId: string,
  paymentMode: 'online' | 'post_service',
  paymentStatus: 'paid' | 'pending' | 'failed',
  paymentReference?: string | null,
  paymentAmount?: number | null
): Promise<boolean> {
  try {
    const updateData: any = {
      payment_mode: paymentMode,
      payment_status: paymentStatus,
    };

    if (paymentReference !== undefined && paymentReference !== null) {
      updateData.payment_reference = paymentReference;
    }

    if (paymentAmount !== undefined && paymentAmount !== null) {
      updateData.payment_amount = paymentAmount;
    }

    const { error } = await supabase
      .from('bookings')
      .update(updateData)
      .eq('id', bookingId);

    if (error) {
      console.error('Error updating booking payment:', error);
      return false;
    }

    if (__DEV__) console.log('✅ Booking payment updated successfully:', bookingId);
    return true;
  } catch (error) {
    console.error('Exception updating booking payment:', error);
    return false;
  }
}

/**
 * Cancel a booking
 */
export async function cancelBooking(bookingId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('bookings')
      .update({ 
        status: 'cancelled',
      })
      .eq('id', bookingId);

    if (error) {
      console.error('Error cancelling booking:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Exception cancelling booking:', error);
    return false;
  }
}
