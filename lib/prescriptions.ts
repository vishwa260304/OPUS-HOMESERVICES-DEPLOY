import { supabase } from './supabase';

export type PrescriptionRow = {
  id: string;
  user_id: string;
  image_path: string; // path in Supabase storage bucket
  
  created_at: string;
  // Optional extended fields (require DB columns to exist)
  customer_name?: string | null;
  customer_phone?: string | null;
  address?: any | null; // jsonb
  booking_id?: string | null;
  prescription_url?: string | null;
  validation_result?: any | null; // jsonb
};

const BUCKET = 'prescriptions';

/**
 * Uploads a local image URI to Supabase Storage and records a DB row.
 * Returns the created row and a public URL for immediate preview.
 */
export async function uploadPrescriptionForUser(params: {
  localUri: string;
  userId: string;
}): Promise<{ row: PrescriptionRow; publicUrl: string | null }>
{
  const { localUri, userId } = params;

  // Convert the local file into ArrayBuffer (works reliably in React Native)
  const response = await fetch(localUri);
  const arrayBuffer = await response.arrayBuffer();

  // Derive file extension and content type
  const guessedExt = (localUri.split('?')[0].split('#')[0].split('.').pop() || 'jpg').toLowerCase();
  const ext = guessedExt === 'jpeg' ? 'jpg' : guessedExt;
  const contentType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;

  // Build a user-scoped path for easier management
  const objectPath = `${userId}/${Date.now()}.${ext}`;

  // Upload to storage (upsert to avoid collisions)
  const { error: uploadError } = await supabase
    .storage
    .from(BUCKET)
    .upload(objectPath, arrayBuffer, { contentType, upsert: true });
  if (uploadError) throw uploadError;

  // Insert DB row
  const { data: row, error: insertError } = await supabase
    .from('prescriptions')
    .insert([{ user_id: userId, image_path: objectPath }])
    .select('*')
    .single();
  if (insertError) throw insertError;

  // Get public URL (bucket should be public; otherwise use signed URLs)
  const { data: publicData } = supabase
    .storage
    .from(BUCKET)
    .getPublicUrl(objectPath);

  return { row: row as PrescriptionRow, publicUrl: publicData?.publicUrl ?? null };
}

/**
 * Update an existing prescription row (e.g., after booking is created) with
 * customer and address details.
 */
export async function updatePrescriptionById(id: string, payload: Partial<{
  customer_name: string | null;
  customer_phone: string | null;
  address: any | null;
  booking_id: string | null;
  prescription_url: string | null;
  validation_result: any | null;
}>) {
  const { data, error } = await supabase
    .from('prescriptions')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as PrescriptionRow;
}


/**
 * Inserts an extended prescription record with customer and address details.
 * Note: This assumes the following columns exist in public.prescriptions:
 *   customer_name text, customer_phone text, address jsonb,
 *   booking_id uuid, prescription_url text, validation_result jsonb
 */
export async function insertPrescriptionDetails(params: {
  userId: string;
  imagePath?: string | null; // storage object path if available
  prescriptionUrl?: string | null; // public URL if available
  customerName?: string | null;
  customerPhone?: string | null;
  address?: any | null; // jsonb
  bookingId?: string | null;
  validationResult?: any | null;
}) {
  let { userId, imagePath = null, prescriptionUrl = null, customerName = null, customerPhone = null, address = null, bookingId = null, validationResult = null } = params;

  // If bookingId is provided and any of the fields are missing, hydrate from bookings table
  if (bookingId && (!customerName || !customerPhone || !address)) {
    const { data: bookingRow } = await supabase
      .from('bookings')
      .select('address, phone')
      .eq('id', bookingId)
      .single();

    if (bookingRow) {
      const bAddr = bookingRow.address || null;
      customerName = customerName ?? (bAddr?.name ?? null);
      customerPhone = customerPhone ?? (bAddr?.phone ?? bookingRow.phone ?? null);
      if (!address) address = bAddr;
    }
  }

  const payload: any = {
    user_id: userId,
    image_path: imagePath,
    prescription_url: prescriptionUrl,
    customer_name: customerName,
    customer_phone: customerPhone,
    address: address,
    booking_id: bookingId,
    validation_result: validationResult,
  };

  // Remove undefined keys to avoid column errors if some fields are missing
  Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

  const { data, error } = await supabase
    .from('prescriptions')
    .insert([payload])
    .select('*')
    .single();
  if (error) throw error;
  return data as PrescriptionRow;
}


