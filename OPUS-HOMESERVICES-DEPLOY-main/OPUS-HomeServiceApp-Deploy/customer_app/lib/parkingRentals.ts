import { supabase } from './supabase';

export interface ParkingRental {
  id?: string;
  user_id?: string;
  full_name: string;
  address: string;
  phone: string;
  parking_location: string;
  building_name?: string;
  floor_level?: string;
  parking_type: 'Open' | 'Covered' | 'Basement' | 'Multi-level';
  length?: number;
  width?: number;
  vehicle_allowed: 'Car' | 'Bike' | 'Both';
  rent_amount: number;
  rent_period: 'Per Month' | 'Per Day' | 'Per Hour';
  security_deposit?: number;
  start_date?: string;
  end_date?: string;
  payment_mode: 'Cash' | 'UPI' | 'Bank Transfer';
  parking_photos?: string[];
  aadhaar_number?: string;
  pan_number?: string;
  aadhaar_image_url?: string;
  pan_image_url?: string;
  status?: 'pending' | 'approved' | 'rejected' | 'inactive';
  created_at?: string;
  updated_at?: string;
}

export interface ParkingRentalInsert {
  user_id: string;
  full_name: string;
  address: string;
  phone: string;
  parking_location: string;
  building_name?: string;
  floor_level?: string;
  parking_type: 'Open' | 'Covered' | 'Basement' | 'Multi-level';
  length?: number;
  width?: number;
  vehicle_allowed: 'Car' | 'Bike' | 'Both';
  rent_amount: number;
  rent_period: 'Per Month' | 'Per Day' | 'Per Hour';
  security_deposit?: number;
  start_date?: string;
  end_date?: string;
  payment_mode: 'Cash' | 'UPI' | 'Bank Transfer';
  parking_photos?: string[];
  aadhaar_number?: string;
  pan_number?: string;
  aadhaar_image_url?: string;
  pan_image_url?: string;
}

export interface KYCUpdate {
  aadhaar_number: string;
  pan_number: string;
  aadhaar_image_url: string;
  pan_image_url: string;
}

/**
 * Upload a photo to Supabase Storage
 */
export const uploadParkingPhoto = async (
  userId: string,
  photoUri: string,
  index: number
): Promise<string> => {
  try {
    // Fetch the image and convert to array buffer (React Native compatible)
    const response = await fetch(photoUri);
    const arrayBuffer = await response.arrayBuffer();
    
    // Get file extension from URI or default to jpg
    const guessedExt = (photoUri.split('?')[0].split('#')[0].split('.').pop() || 'jpg').toLowerCase();
    const ext = guessedExt === 'jpeg' ? 'jpg' : guessedExt;
    const contentType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
    
    // Generate unique filename
    const fileName = `${userId}/parking-${Date.now()}-${index}.${ext}`;
    
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('parking-photos')
      .upload(fileName, arrayBuffer, {
        contentType: contentType,
        upsert: false,
      });

    if (error) throw error;

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('parking-photos')
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  } catch (error) {
    console.error('Error uploading parking photo:', error);
    throw error;
  }
};

/**
 * Upload multiple parking photos
 */
export const uploadParkingPhotos = async (
  userId: string,
  photoUris: string[]
): Promise<string[]> => {
  try {
    const uploadPromises = photoUris.map((uri, index) =>
      uploadParkingPhoto(userId, uri, index)
    );
    return await Promise.all(uploadPromises);
  } catch (error) {
    console.error('Error uploading parking photos:', error);
    throw error;
  }
};

/**
 * Upload KYC document to Supabase Storage
 */
export const uploadKYCDocument = async (
  userId: string,
  documentUri: string,
  documentType: 'aadhaar' | 'pan'
): Promise<string> => {
  try {
    // Fetch the image and convert to array buffer (React Native compatible)
    const response = await fetch(documentUri);
    const arrayBuffer = await response.arrayBuffer();
    
    // Get file extension from URI or default to jpg
    const guessedExt = (documentUri.split('?')[0].split('#')[0].split('.').pop() || 'jpg').toLowerCase();
    const ext = guessedExt === 'jpeg' ? 'jpg' : guessedExt;
    const contentType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
    
    // Generate unique filename
    const fileName = `${userId}/kyc-${documentType}-${Date.now()}.${ext}`;
    
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('parking-photos')
      .upload(fileName, arrayBuffer, {
        contentType: contentType,
        upsert: false,
      });

    if (error) throw error;

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('parking-photos')
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  } catch (error) {
    console.error('Error uploading KYC document:', error);
    throw error;
  }
};

/**
 * Create a new parking rental listing
 */
export const createParkingRental = async (
  rental: ParkingRentalInsert
): Promise<ParkingRental> => {
  try {
    const { data, error } = await supabase
      .from('parking_rentals')
      .insert(rental)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating parking rental:', error);
    throw error;
  }
};

/**
 * Update parking rental with KYC information
 */
export const updateParkingRentalKYC = async (
  rentalId: string,
  kycData: KYCUpdate
): Promise<ParkingRental> => {
  try {
    const { data, error } = await supabase
      .from('parking_rentals')
      .update(kycData)
      .eq('id', rentalId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating parking rental KYC:', error);
    throw error;
  }
};

/**
 * Get all parking rentals for a user
 */
export const getUserParkingRentals = async (
  userId: string
): Promise<ParkingRental[]> => {
  try {
    const { data, error } = await supabase
      .from('parking_rentals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching user parking rentals:', error);
    throw error;
  }
};

/**
 * Get all approved parking rentals (public view)
 */
export const getApprovedParkingRentals = async (): Promise<ParkingRental[]> => {
  try {
    const { data, error } = await supabase
      .from('parking_rentals')
      .select('*')
      .eq('status', 'approved')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching approved parking rentals:', error);
    throw error;
  }
};

/**
 * Get a single parking rental by ID
 */
export const getParkingRentalById = async (
  id: string
): Promise<ParkingRental | null> => {
  try {
    const { data, error } = await supabase
      .from('parking_rentals')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching parking rental:', error);
    throw error;
  }
};

/**
 * Update parking rental status
 */
export const updateParkingRentalStatus = async (
  rentalId: string,
  status: 'pending' | 'approved' | 'rejected' | 'inactive'
): Promise<ParkingRental> => {
  try {
    const { data, error } = await supabase
      .from('parking_rentals')
      .update({ status })
      .eq('id', rentalId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating parking rental status:', error);
    throw error;
  }
};

/**
 * Delete a parking rental
 */
export const deleteParkingRental = async (rentalId: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('parking_rentals')
      .delete()
      .eq('id', rentalId);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting parking rental:', error);
    throw error;
  }
};

/**
 * Search parking rentals
 */
export const searchParkingRentals = async (
  searchQuery: string
): Promise<ParkingRental[]> => {
  try {
    const { data, error } = await supabase
      .from('parking_rentals')
      .select('*')
      .eq('status', 'approved')
      .or(`parking_location.ilike.%${searchQuery}%,building_name.ilike.%${searchQuery}%`)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error searching parking rentals:', error);
    throw error;
  }
};

export const ParkingRentalsApi = {
  uploadParkingPhoto,
  uploadParkingPhotos,
  uploadKYCDocument,
  createParkingRental,
  updateParkingRentalKYC,
  getUserParkingRentals,
  getApprovedParkingRentals,
  getParkingRentalById,
  updateParkingRentalStatus,
  deleteParkingRental,
  searchParkingRentals,
};

