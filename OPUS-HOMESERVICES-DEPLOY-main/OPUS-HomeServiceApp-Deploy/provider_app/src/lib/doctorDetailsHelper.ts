import { supabase } from './supabase';

export type DoctorDetailsInput = {
  doctor_name?: string;
  medical_registration_number?: string;
  address?: string;
  doctor_bio?: string | null;
  medical_council_name?: string | null;
  qualification?: string | null;
  years_of_experience?: number | null;
  email?: string | null;
  phone_number?: string | null;
  hospital?: string | null;
  languages?: string[] | string | null;
  consultation_fee?: number | null;
  is_online?: boolean | null;
  aadhar_number?: string | null;
  pan_number?: string | null;
} & Record<string, any>;

function normalizeString(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed.length === 0 ? null : trimmed;
}

function normalizeNumber(value: number | string | null | undefined): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = typeof value === 'number' ? value : parseInt(String(value), 10);
  if (Number.isNaN(n)) return null;
  return n < 0 ? 0 : n; // DB has non-negative check; clamp to 0 if negative
}

function normalizeEmail(value: string | null | undefined): string | null {
  const email = normalizeString(value);
  return email;
}

/**
 * Upsert full doctor details row keyed by `user_id` into `providers_doctor_details`.
 * Only provided fields are sent; missing fields remain unchanged.
 */
export async function upsertDoctorDetails(userId: string, details: DoctorDetailsInput) {
  const payload: Record<string, any> = { user_id: userId };
  if (details.doctor_name !== undefined) payload.doctor_name = normalizeString(details.doctor_name);
  if (details.medical_registration_number !== undefined) payload.medical_registration_number = normalizeString(details.medical_registration_number);
  if (details.address !== undefined) payload.address = normalizeString(details.address);
  if (details.doctor_bio !== undefined) payload.doctor_bio = normalizeString(details.doctor_bio ?? null);
  if (details.medical_council_name !== undefined) payload.medical_council_name = normalizeString(details.medical_council_name);
  if (details.qualification !== undefined) payload.qualification = normalizeString(details.qualification);
  if (details.years_of_experience !== undefined) payload.years_of_experience = normalizeNumber(details.years_of_experience);
  if (details.email !== undefined) payload.email = normalizeEmail(details.email);
  if (details.phone_number !== undefined) payload.phone_number = normalizeString(details.phone_number);
  if (details.hospital !== undefined) payload.hospital = normalizeString(details.hospital ?? null);
  if (details.languages !== undefined) {
    if (Array.isArray(details.languages)) {
      payload.languages = details.languages.map((s) => normalizeString(s) ?? '').filter(Boolean);
    } else if (typeof details.languages === 'string') {
      payload.languages = details.languages
        .split(',')
        .map((s) => normalizeString(s) ?? '')
        .filter(Boolean);
    } else {
      payload.languages = null;
    }
  }
  if (details.consultation_fee !== undefined) payload.consultation_fee = normalizeNumber(details.consultation_fee);
  if (details.is_online !== undefined && details.is_online !== null) payload.is_online = !!details.is_online;
  if (details.aadhar_number !== undefined) payload.aadhar_number = normalizeString(details.aadhar_number);
  if (details.pan_number !== undefined) payload.pan_number = normalizeString(details.pan_number);

  const { data, error } = await supabase
    .from('providers_doctor_details')
    .upsert(payload, { onConflict: 'user_id' })
    .select();

  return { data, error };
}

/** Update only the bio field (convenience). */
export async function updateDoctorBio(userId: string, bio: string | null) {
  const { data, error } = await supabase
    .from('providers_doctor_details')
    .update({ doctor_bio: normalizeString(bio ?? null) })
    .eq('user_id', userId)
    .select();
  return { data, error };
}

/** Fetch doctor details for a user. */
export async function getDoctorDetails(userId: string) {
  const { data, error } = await supabase
    .from('providers_doctor_details')
    .select('*')
    .eq('user_id', userId)
    .single();
  return { data, error };
}
