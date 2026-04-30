// Helper functions to call the prescription OCR edge function

import { supabase } from './supabase';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;

if (!supabaseUrl) {
  throw new Error('Missing Supabase environment variables. Check your .env file.');
}

export interface OCRResult {
  success: boolean;
  text?: string;
  fullTextAnnotation?: string;
  blocks?: any[];
  error?: string;
  prescriptionId?: string;
  isValidPrescription?: boolean;
  validationScore?: number;
  validationDetails?: {
    hasDoctorInfo: boolean;
    hasMedicineInfo: boolean;
    hasDate: boolean;
    hasPatientInfo: boolean;
    reasons?: string[];
  };
}

/**
 * Extract text from a prescription image using OCR
 * @param imageUri - Local file URI or public URL
 * @param prescriptionId - Optional prescription ID to update with OCR results
 * @returns OCR result with extracted text
 */
export async function extractTextFromPrescription(
  imageUri: string,
  prescriptionId?: string
): Promise<OCRResult> {
  try {
    // Get the current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      throw new Error('User must be authenticated to use OCR');
    }

    // Check if imageUri is a local file or a URL
    let imageBase64: string | undefined;
    let imageUrl: string | undefined;

    if (imageUri.startsWith('http://') || imageUri.startsWith('https://')) {
      // It's a URL
      imageUrl = imageUri;
    } else {
      // It's a local file - convert to base64
      try {
        const response = await fetch(imageUri);
        const blob = await response.blob();
        
        // Convert blob to base64
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onloadend = () => {
            const base64String = reader.result as string;
            resolve(base64String);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        
        imageBase64 = await base64Promise;
      } catch (convertError) {
        console.error('Error converting image to base64:', convertError);
        throw new Error('Failed to process image');
      }
    }

    const functionUrl = `${supabaseUrl}/functions/v1/prescription-ocr`;

    // Call the edge function
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageUrl,
        imageBase64,
        prescriptionId,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `OCR request failed: ${response.statusText}`);
    }

    const result: OCRResult = await response.json();
    return result;

  } catch (error) {
    console.error('OCR extraction error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to extract text from prescription',
    };
  }
}

/**
 * Extract text from a prescription image that's already uploaded to Supabase Storage
 * @param storagePath - Path to the image in Supabase Storage (e.g., "user-id/timestamp.jpg")
 * @param prescriptionId - Optional prescription ID to update with OCR results
 * @returns OCR result with extracted text
 */
export async function extractTextFromStoragePrescription(
  storagePath: string,
  prescriptionId?: string
): Promise<OCRResult> {
  try {
    // Get public URL from storage
    const { data: publicData } = supabase
      .storage
      .from('prescriptions')
      .getPublicUrl(storagePath);

    if (!publicData?.publicUrl) {
      throw new Error('Failed to get public URL for prescription image');
    }

    // Use the public URL for OCR
    return await extractTextFromPrescription(publicData.publicUrl, prescriptionId);

  } catch (error) {
    console.error('Storage OCR extraction error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to extract text from prescription',
    };
  }
}
