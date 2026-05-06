// lib/doctorsService.ts
import { supabase } from './supabase';

/**
 * Full doctor details matching providers_doctor_details table schema exactly
 */
export interface ProvidersDoctorDetails {
  id: string;                          // uuid
  user_id: string;                     // uuid
  doctor_name: string;                 // text
  medical_registration_number: string; // text
  address: string;                     // text
  created_at: string;                  // timestamp
  updated_at: string;                  // timestamp
  doctor_bio: string | null;           // text
  medical_council_name: string | null; // text
  qualification: string | null;        // text
  years_of_experience: number | null;  // integer
  email: string | null;                // text
  phone_number: string | null;         // text
  doctor_speciality: string | null;    // text (CSV format)
  hospital: string | null;             // text
  languages: string[] | null;          // text[]
  consultation_fee: number | null;     // integer
  is_online: boolean;                  // boolean
  avatar_url: string | null;           // text
}

export interface Doctor {
  id: string; // Changed to string to match uuid
  userId: string;
  doctorName: string;
  specialization: string[];
  experience: number;
  rating: number;
  consultationFee: number;
  availableSlots: string[];
  avatar?: string;
  bio?: string;
  isOnline: boolean;
  hospital?: string;
  location?: string;
  qualifications?: string;
  languages?: string[];
  medicalRegistrationNumber?: string;
  medicalCouncilName?: string;
  email?: string | null;
  phone?: string | null;
}

// Lightweight view of providers_doctor_details
export interface DoctorDetailsLite {
  id: string;
  userId: string;
  doctorName: string;
  specialization: string[];
  experience: number;
  rating: number;
  address: string;
  bio?: string;
  qualification?: string;
  email?: string | null;
  phone?: string | null;
  isOnline?: boolean;
  hospital?: string;
  consultationFee: number;
  languages?: string[];
}

/**
 * Fetch ALL doctors from providers_doctor_details table
 * Returns raw data matching exact database schema
 */
export async function fetchAllDoctorDetails(): Promise<ProvidersDoctorDetails[]> {
  try {
    const { data, error } = await supabase
      .from('providers_doctor_details')
      .select(`
        id,
        user_id,
        doctor_name,
        medical_registration_number,
        address,
        created_at,
        updated_at,
        doctor_bio,
        medical_council_name,
        qualification,
        years_of_experience,
        email,
        phone_number,
        doctor_speciality,
        hospital,
        languages,
        consultation_fee,
        is_online
      `)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching all doctor details:', error);
      return [];
    }

    return (data || []) as ProvidersDoctorDetails[];
  } catch (e) {
    console.error('Exception fetching all doctor details:', e);
    return [];
  }
}

/**
 * Fetch doctors from providers_doctor_details by specialization (doctor_speciality)
 */
export async function fetchDoctorsFromDetailsBySpecialization(
  specialization: string
): Promise<DoctorDetailsLite[]> {
  try {
    const spec = (specialization || '').trim();
    let query = supabase
      .from('providers_doctor_details')
      .select(`
        id,
        user_id,
        doctor_name,
        doctor_bio,
        qualification,
        years_of_experience,
        doctor_speciality,
        address,
        email,
        phone_number,
        is_online,
        hospital,
        consultation_fee,
        languages
      `)
      .order('updated_at', { ascending: false });

    if (spec.length > 0) {
      // Case-insensitive contains match
      query = query.ilike('doctor_speciality', `%${spec}%`);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching doctor details:', error);
      return [];
    }

    return (data || []).map((d: any) => ({
      id: d.id as string,
      userId: d.user_id as string,
      doctorName: d.doctor_name as string,
      specialization: d.doctor_speciality
        ? String(d.doctor_speciality)
            .split(',')
            .map((s: string) => s.trim())
            .filter((s: string) => s.length > 0)
        : [],
      experience: d.years_of_experience ?? 0,
      rating: 4.7, // placeholder until ratings implemented
      address: d.address || 'Location not specified',
      bio: d.doctor_bio || undefined,
      qualification: d.qualification || undefined,
      email: d.email ?? null,
      phone: d.phone_number ?? null,
      isOnline: d.is_online ?? false,
      hospital: d.hospital || undefined,
      consultationFee: d.consultation_fee ?? 0,
      languages: Array.isArray(d.languages) ? d.languages : [],
    }));
  } catch (e) {
    console.error('Exception fetching doctor details by specialization:', e);
    return [];
  }
}

/** Fetch a single doctor from providers_doctor_details by id */
export async function fetchDoctorDetailsById(id: string): Promise<DoctorDetailsLite | null> {
  try {
    const { data, error } = await supabase
      .from('providers_doctor_details')
      .select(`
        id,
        user_id,
        doctor_name,
        doctor_bio,
        qualification,
        years_of_experience,
        doctor_speciality,
        address,
        email,
        phone_number,
        is_online,
        hospital,
        consultation_fee,
        languages
      `)
      .eq('id', id)
      .single();

    if (error || !data) {
      console.error('Error fetching doctor by id:', error);
      return null;
    }

    return {
      id: data.id as string,
      userId: data.user_id as string,
      doctorName: data.doctor_name as string,
      specialization: data.doctor_speciality
        ? String(data.doctor_speciality)
            .split(',')
            .map((s: string) => s.trim())
            .filter((s: string) => s.length > 0)
        : [],
      experience: data.years_of_experience ?? 0,
      rating: 4.7,
      address: data.address || 'Location not specified',
      bio: data.doctor_bio || undefined,
      qualification: data.qualification || undefined,
      email: data.email ?? null,
      phone: data.phone_number ?? null,
      isOnline: data.is_online ?? false,
      hospital: data.hospital || undefined,
      consultationFee: data.consultation_fee ?? 0,
      languages: Array.isArray(data.languages) ? data.languages : [],
    };
  } catch (e) {
    console.error('Exception fetching doctor by id:', e);
    return null;
  }
}

/**
 * Fetch all available doctors (only online doctors can be booked)
 */
export async function fetchAvailableDoctors(): Promise<Doctor[]> {
  try {
    // Fetch doctors from providers_services where service_type is 'Doctor Consultation'
    // Only show approved and online doctors
    const { data: services, error } = await supabase
      .from('providers_services')
      .select(`
        id,
        user_id,
        service_name,
        description,
        status,
        is_online,
        providers_profiles (
          full_name,
          avatar_url,
          phone
        ),
        doctor_details (
          specialization,
          experience_years,
          consultation_fee,
          bio,
          hospital,
          location,
          qualifications,
          languages
        )
      `)
      .eq('service_type', 'Doctor Consultation')
      .eq('status', 'approved');

    if (error) {
      console.error('Error fetching doctors:', error);
      return [];
    }

    if (!services || services.length === 0) {
      return [];
    }

    // Transform data to Doctor format
    const doctors: Doctor[] = services.map((service: any) => ({
      id: service.id, // This is the provider_id to use in bookings
      userId: service.user_id,
      doctorName: service.providers_profiles?.full_name || service.service_name,
      specialization: service.doctor_details?.specialization || [],
      experience: service.doctor_details?.experience_years || 0,
      rating: 4.7, // You can calculate this from reviews
      consultationFee: service.doctor_details?.consultation_fee || 500,
      availableSlots: [], // Fetch from availability table if needed
      avatar: service.providers_profiles?.avatar_url,
      bio: service.doctor_details?.bio,
      isOnline: service.is_online === true, // Check online status
      hospital: service.doctor_details?.hospital,
      location: service.doctor_details?.location,
      qualifications: service.doctor_details?.qualifications,
      languages: service.doctor_details?.languages || [],
    }));

    return doctors;
  } catch (error) {
    console.error('Exception fetching doctors:', error);
    return [];
  }
}

/**
 * Fetch only online doctors (for booking)
 */
export async function fetchOnlineDoctors(): Promise<Doctor[]> {
  try {
    const { data: services, error } = await supabase
      .from('providers_services')
      .select(`
        id,
        user_id,
        service_name,
        description,
        status,
        is_online,
        providers_profiles (
          full_name,
          avatar_url,
          phone
        ),
        doctor_details (
          specialization,
          experience_years,
          consultation_fee,
          bio,
          hospital,
          location,
          qualifications,
          languages
        )
      `)
      .eq('service_type', 'Doctor Consultation')
      .eq('status', 'approved')
      .eq('is_online', true); // Only online doctors

    if (error) {
      console.error('Error fetching online doctors:', error);
      return [];
    }

    if (!services || services.length === 0) {
      return [];
    }

    // Transform data to Doctor format
    const doctors: Doctor[] = services.map((service: any) => ({
      id: service.id,
      userId: service.user_id,
      doctorName: service.providers_profiles?.full_name || service.service_name,
      specialization: service.doctor_details?.specialization || [],
      experience: service.doctor_details?.experience_years || 0,
      rating: 4.7,
      consultationFee: service.doctor_details?.consultation_fee || 500,
      availableSlots: [],
      avatar: service.providers_profiles?.avatar_url,
      bio: service.doctor_details?.bio,
      isOnline: true, // All returned doctors are online
      hospital: service.doctor_details?.hospital,
      location: service.doctor_details?.location,
      qualifications: service.doctor_details?.qualifications,
      languages: service.doctor_details?.languages || [],
    }));

    return doctors;
  } catch (error) {
    console.error('Exception fetching online doctors:', error);
    return [];
  }
}

/**
 * Fetch single doctor from providers_doctor_details by id
 */
export async function fetchDoctorById(doctorId: string | number): Promise<Doctor | null> {
  try {
    const { data, error } = await supabase
      .from('providers_doctor_details')
      .select(`
        id,
        user_id,
        doctor_name,
        medical_registration_number,
        address,
        doctor_bio,
        medical_council_name,
        qualification,
        years_of_experience,
        email,
        phone_number,
        doctor_speciality,
        hospital,
        languages,
        consultation_fee,
        is_online
      `)
      .eq('id', String(doctorId))
      .single();

    if (error || !data) {
      console.error('Error fetching doctor:', error);
      return null;
    }

    const row: any = data;
    const specialities = (row.doctor_speciality || '')
      .split(',')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);

    return {
      id: row.id,
      userId: row.user_id,
      doctorName: row.doctor_name,
      specialization: specialities,
      experience: row.years_of_experience || 0,
      rating: 4.7,
      consultationFee: row.consultation_fee || 0,
      availableSlots: [],
      avatar: undefined,
      bio: row.doctor_bio || undefined,
      isOnline: row.is_online === true,
      hospital: row.hospital || undefined,
      location: row.address || undefined,
      qualifications: row.qualification || undefined,
      languages: Array.isArray(row.languages) ? row.languages : [],
      medicalRegistrationNumber: row.medical_registration_number || undefined,
      medicalCouncilName: row.medical_council_name || undefined,
      email: row.email ?? null,
      phone: row.phone_number ?? null,
    };
  } catch (error) {
    console.error('Exception fetching doctor:', error);
    return null;
  }
}

/**
 * Fetch doctors by specialization (e.g., 'Dermatology', 'Cardiology', etc.)
 * Queries providers_doctor_details table with exact column names
 */
export async function fetchDoctorsBySpecialization(specialization: string): Promise<Doctor[]> {
  try {
    console.log(`🔍 [fetchDoctorsBySpecialization] Searching providers_doctor_details for: "${specialization}"`);

    // Query providers_doctor_details directly, filter by doctor_speciality
    let query = supabase
      .from('providers_doctor_details')
      .select(`
        id,
        user_id,
        doctor_name,
        medical_registration_number,
        address,
        doctor_bio,
        medical_council_name,
        qualification,
        years_of_experience,
        email,
        phone_number,
        doctor_speciality,
        hospital,
        languages,
        consultation_fee,
        is_online
      `)
      .order('updated_at', { ascending: false });

    if (specialization && specialization.trim().length > 0) {
      query = query.ilike('doctor_speciality', `%${specialization}%`);
    }

    const { data, error } = await query;
    if (error) {
      console.error('❌ [fetchDoctorsBySpecialization] Supabase Error:', error);
      return [];
    }

    if (!data || data.length === 0) {
      console.warn(`⚠️ [fetchDoctorsBySpecialization] No doctors found in providers_doctor_details`);
      return [];
    }

    // Transform providers_doctor_details rows to Doctor format expected by UI
    const doctors: Doctor[] = (data as any[]).map((row: any) => ({
      id: row.id, // uuid as string
      userId: row.user_id,
      doctorName: row.doctor_name,
      specialization: row.doctor_speciality
        ? String(row.doctor_speciality)
            .split(',')
            .map((s: string) => s.trim())
            .filter((s: string) => s.length > 0)
        : [],
      experience: row.years_of_experience ?? 0,
      rating: 4.7,
      consultationFee: row.consultation_fee ?? 0,
      availableSlots: [],
      avatar: undefined, // No avatar in providers_doctor_details table
      bio: row.doctor_bio ?? undefined,
      isOnline: row.is_online === true,
      hospital: row.hospital ?? undefined,
      location: row.address ?? undefined,
      qualifications: row.qualification ?? undefined,
      languages: Array.isArray(row.languages) ? row.languages : [],
      medicalRegistrationNumber: row.medical_registration_number ?? undefined,
      medicalCouncilName: row.medical_council_name ?? undefined,
      email: row.email ?? null,
      phone: row.phone_number ?? null,
    }));

    console.log(`✅ [fetchDoctorsBySpecialization] Found ${doctors.length} doctors`);
    return doctors;
  } catch (error) {
    console.error('Exception fetching doctors by specialization:', error);
    return [];
  }
}

/**
 * Verify that a doctor belongs to a specific specialization
 * This is a safety check before booking
 */
export async function verifyDoctorSpecialization(
  providerId: number, 
  expectedSpecialization: string
): Promise<boolean> {
  try {
    const doctor = await fetchDoctorById(providerId);
    
    if (!doctor) {
      return false;
    }

    // Check if the doctor's specialization matches
    const specializations = doctor.specialization || [];
    
    return specializations.some((spec: string) => 
      spec.toLowerCase().includes(expectedSpecialization.toLowerCase()) ||
      expectedSpecialization.toLowerCase().includes(spec.toLowerCase())
    );
  } catch (error) {
    console.error('Exception verifying doctor specialization:', error);
    return false;
  }
}

/**
 * Check if a doctor is online
 */
export async function checkDoctorOnlineStatus(doctorId: string | number): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('providers_doctor_details')
      .select('is_online')
      .eq('id', String(doctorId))
      .single();

    if (error || !data) {
      console.error('Error checking doctor online status:', error);
      return false;
    }

    return data.is_online === true;
  } catch (error) {
    console.error('Exception checking doctor online status:', error);
    return false;
  }
}
