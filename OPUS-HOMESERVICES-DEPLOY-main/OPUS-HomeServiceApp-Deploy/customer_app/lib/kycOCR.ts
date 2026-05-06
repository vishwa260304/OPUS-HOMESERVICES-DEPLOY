// Helper functions to call the KYC OCR edge function for Aadhaar and PAN card verification

import { supabase } from './supabase';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;

if (!supabaseUrl) {
  throw new Error('Missing Supabase environment variables. Check your .env file.');
}

export interface KYCOCRResult {
  success: boolean;
  documentType: 'aadhaar' | 'pan';
  extractedText?: string;
  fullTextAnnotation?: string;
  extractedNumber?: string; // Extracted Aadhaar or PAN number
  isValid?: boolean; // Whether the extracted number matches expected format
  isCorrectDocumentType?: boolean; // Whether the uploaded document matches the expected type
  confidence?: number; // Confidence score (0-100)
  error?: string;
  validationDetails?: {
    hasValidFormat: boolean;
    hasDocumentKeywords: boolean;
    isCorrectDocumentType?: boolean;
    documentTypeScore?: number;
    extractedFields?: {
      number?: string;
      name?: string;
      dob?: string;
      address?: string;
      fatherName?: string; // for PAN
    };
  };
}

/**
 * Extract and validate information from an Aadhaar or PAN card image using OCR
 * @param imageUri - Local file URI or public URL
 * @param documentType - Type of document ('aadhaar' or 'pan')
 * @returns OCR result with extracted text and validation
 */
export async function verifyKYCDocument(
  imageUri: string,
  documentType: 'aadhaar' | 'pan'
): Promise<KYCOCRResult> {
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
        const arrayBuffer = await response.arrayBuffer();
        
        // Convert arrayBuffer to base64 (React Native compatible)
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        imageBase64 = btoa(binary);
      } catch (convertError) {
        console.error('Error converting image to base64:', convertError);
        throw new Error('Failed to process image');
      }
    }

    const functionUrl = `${supabaseUrl}/functions/v1/kyc-ocr`;

    // Call the edge function
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        documentType,
        imageUrl,
        imageBase64,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `OCR request failed: ${response.statusText}`);
    }

    const result: KYCOCRResult = await response.json();
    return result;

  } catch (error) {
    console.error('KYC OCR extraction error:', error);
    return {
      success: false,
      documentType,
      error: error instanceof Error ? error.message : 'Failed to extract text from document',
    };
  }
}

/**
 * Extract and validate information from a document that's already uploaded to Supabase Storage
 * @param storagePath - Path to the image in Supabase Storage (e.g., "user-id/aadhaar-timestamp.jpg")
 * @param documentType - Type of document ('aadhaar' or 'pan')
 * @param bucket - Storage bucket name (default: 'kyc-docs-realestate')
 * @returns OCR result with extracted text and validation
 */
export async function verifyKYCDocumentFromStorage(
  storagePath: string,
  documentType: 'aadhaar' | 'pan',
  bucket: string = 'kyc-docs-realestate'
): Promise<KYCOCRResult> {
  try {
    // Get public URL from storage
    const { data: publicData } = supabase
      .storage
      .from(bucket)
      .getPublicUrl(storagePath);

    if (!publicData?.publicUrl) {
      throw new Error('Failed to get public URL for document image');
    }

    // Use the public URL for OCR
    return await verifyKYCDocument(publicData.publicUrl, documentType);

  } catch (error) {
    console.error('Storage KYC OCR extraction error:', error);
    return {
      success: false,
      documentType,
      error: error instanceof Error ? error.message : 'Failed to extract text from document',
    };
  }
}
