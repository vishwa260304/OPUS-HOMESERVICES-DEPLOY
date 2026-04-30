import { supabase } from './supabase';
import { verifyKYCDocument, KYCOCRResult } from './kycOCR';

export type KycVerification = {
  id: string;
  user_id: string;
  aadhaar_number: string | null;
  aadhaar_image_path: string | null;
  pan_number: string | null;
  pan_image_path: string | null;
  created_at: string;
  updated_at: string;
};

const BUCKET = 'kyc-docs-realestate';

async function uploadImageToBucket(userId: string, localUri: string, prefix: string): Promise<string> {
  const response = await fetch(localUri);
  const arrayBuffer = await response.arrayBuffer();
  const guessedExt = (localUri.split('?')[0].split('#')[0].split('.').pop() || 'jpg').toLowerCase();
  const ext = guessedExt === 'jpeg' ? 'jpg' : guessedExt;
  const contentType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
  const objectPath = `${userId}/${prefix}-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase
    .storage
    .from(BUCKET)
    .upload(objectPath, arrayBuffer, { contentType, upsert: true });
  if (uploadError) throw uploadError;
  return objectPath;
}

/**
 * Verify KYC document using OCR
 * @param imageUri - Local file URI
 * @param documentType - Type of document ('aadhaar' or 'pan')
 * @returns OCR result with extracted number and validation
 */
export async function verifyKycDocumentWithOCR(
  imageUri: string,
  documentType: 'aadhaar' | 'pan'
): Promise<KYCOCRResult> {
  return await verifyKYCDocument(imageUri, documentType);
}

export async function createKycVerification(params: {
  userId: string;
  aadhaarNumber: string;
  panNumber: string;
  aadhaarLocalUri: string;
  panLocalUri: string;
}): Promise<KycVerification> {
  const { userId, aadhaarNumber, panNumber, aadhaarLocalUri, panLocalUri } = params;

  // Upload images
  const [aadhaarPath, panPath] = await Promise.all([
    uploadImageToBucket(userId, aadhaarLocalUri, 'aadhaar'),
    uploadImageToBucket(userId, panLocalUri, 'pan'),
  ]);

  // Insert DB row (user_id is set by trigger/RLS)
  const { data, error } = await supabase
    .from('property_kyc')
    .insert([
      {
        aadhaar_number: aadhaarNumber,
        aadhaar_image_path: aadhaarPath,
        pan_number: panNumber,
        pan_image_path: panPath,
      },
    ])
    .select('*')
    .single();
  if (error) throw error;
  return data as KycVerification;
}


