import { supabase } from './supabase';

export interface PropertyListing {
  id?: string;
  user_id?: string;
  apartment_type: string;
  bhk_type: string;
  property_size?: string;
  facing?: string;
  property_age?: string;
  floor?: string;
  total_floor?: string;
  title?: string;
  location?: string;
  property_for: 'rent' | 'lease' | 'sale';
  
  // Rent fields
  rent_amount?: string;
  rent_negotiable?: boolean;
  deposit_amount?: string;
  monthly_maintenance?: string;
  
  // Lease fields
  lease_amount?: string;
  security_deposit?: string;
  lease_start?: string;
  lease_end?: string;
  lease_status?: string;
  renewal_option?: boolean;
  
  // Sale fields
  sale_price?: string;
  price_negotiable?: boolean;
  price_per_sqft?: string;
  booking_amount?: string;
  
  // Common fields
  available_from?: string;
  furnishing?: string;
  parking?: string;
  preferred_tenants?: Record<string, boolean>;
  
  // Amenities
  bathrooms?: number;
  balconies?: number;
  non_veg_allowed?: boolean;
  gated_security?: boolean;
  gym?: boolean;
  pet_allowed?: boolean;
  directions_tip?: string;
  current_situation?: string;
  water_supply?: string;
  secondary_number?: string;
  other_amenities?: Record<string, boolean>;
  description?: string;
  
  // Images and contact
  images?: string[];
  contact_number: string;
  
  // Metadata
  category?: string;
  subcategory?: string;
  is_verified?: boolean;
  is_featured?: boolean;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Upload property images to Supabase storage
 * @param imageUris - Array of local image URIs
 * @param propertyId - Unique identifier for the property (used for folder organization)
 * @returns Array of public URLs for the uploaded images
 */
export async function uploadPropertyImages(imageUris: string[], propertyId: string): Promise<string[]> {
  const uploadedUrls: string[] = [];
  
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    for (let i = 0; i < imageUris.length; i++) {
      const imageUri = imageUris[i];
      
      try {
        // Fetch the image and convert to array buffer (same as KYC upload)
        const response = await fetch(imageUri);
        const arrayBuffer = await response.arrayBuffer();
        
        // Get file extension from URI or default to jpg
        const guessedExt = (imageUri.split('?')[0].split('#')[0].split('.').pop() || 'jpg').toLowerCase();
        const ext = guessedExt === 'jpeg' ? 'jpg' : guessedExt;
        const contentType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
        
        // Create a unique filename
        const fileName = `${user.id}/${propertyId}/image_${Date.now()}_${i}.${ext}`;

        // Upload to Supabase storage
        const { error } = await supabase.storage
          .from('realestate-properties')
          .upload(fileName, arrayBuffer, {
            contentType: contentType,
            upsert: false,
          });

        if (error) {
          console.error(`Error uploading image ${i}:`, error);
          // Check if bucket doesn't exist
          if (error.message?.includes('not found') || error.message?.includes('does not exist')) {
            throw new Error('Storage bucket "realestate-properties" not found. Please create it in Supabase Storage with public access.');
          }
          continue;
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('realestate-properties')
          .getPublicUrl(fileName);

        uploadedUrls.push(publicUrl);
      } catch (imageError) {
        console.error(`Error processing image ${i}:`, imageError);
        // Continue with other images even if one fails
      }
    }

    return uploadedUrls;
  } catch (error) {
    console.error('Error in uploadPropertyImages:', error);
    throw error;
  }
}

/**
 * Create a new property listing in the database
 */
export async function createPropertyListing(listing: PropertyListing) {
  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    // Add user_id to the listing
    const listingData = {
      ...listing,
      user_id: user.id,
      status: listing.status || 'active',
      is_verified: listing.is_verified ?? false,
      is_featured: listing.is_featured ?? false,
    };

    // Insert into database
    const { data, error } = await supabase
      .from('property_listings')
      .insert([listingData])
      .select()
      .single();

    if (error) {
      console.error('Error creating property listing:', error);
      throw error;
    }

    return { data, error: null };
  } catch (error) {
    console.error('Error in createPropertyListing:', error);
    return { data: null, error };
  }
}

/**
 * Get property listings for the current user
 */
export async function getUserPropertyListings() {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('property_listings')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching property listings:', error);
      throw error;
    }

    return { data, error: null };
  } catch (error) {
    console.error('Error in getUserPropertyListings:', error);
    return { data: null, error };
  }
}

/**
 * Get all active property listings by category and subcategory
 */
export async function getPropertyListingsByCategory(category?: string, subcategory?: string) {
  try {
    let query = supabase
      .from('property_listings')
      .select('*')
      .eq('status', 'active');

    if (category) {
      query = query.eq('category', category);
    }

    if (subcategory) {
      query = query.eq('subcategory', subcategory);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching property listings by category:', error);
      throw error;
    }

    return { data, error: null };
  } catch (error) {
    console.error('Error in getPropertyListingsByCategory:', error);
    return { data: null, error };
  }
}

/**
 * Update a property listing
 */
export async function updatePropertyListing(id: string, updates: Partial<PropertyListing>) {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('property_listings')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating property listing:', error);
      throw error;
    }

    return { data, error: null };
  } catch (error) {
    console.error('Error in updatePropertyListing:', error);
    return { data: null, error };
  }
}

/**
 * Delete a property listing
 */
export async function deletePropertyListing(id: string) {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    const { error } = await supabase
      .from('property_listings')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting property listing:', error);
      throw error;
    }

    return { error: null };
  } catch (error) {
    console.error('Error in deletePropertyListing:', error);
    return { error };
  }
}

/**
 * Get all active property listings
 */
export async function getAllPropertyListings() {
  try {
    const { data, error } = await supabase
      .from('property_listings')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching all property listings:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in getAllPropertyListings:', error);
    throw error;
  }
}

/**
 * Search property listings by location, title, or description
 */
export async function searchPropertyListings(searchTerm: string) {
  try {
    const { data, error } = await supabase
      .from('property_listings')
      .select('*')
      .eq('status', 'active')
      .or(`title.ilike.%${searchTerm}%,location.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error searching property listings:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in searchPropertyListings:', error);
    throw error;
  }
}

/**
 * Transform PropertyListing from database format to UI Property format
 */
export function transformPropertyListing(listing: PropertyListing): any {
  // Calculate days since posting
  const postedDays = listing.created_at 
    ? Math.floor((Date.now() - new Date(listing.created_at).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  // Format price based on property_for type
  let price = 'Contact for Price';
  let deposit = '';
  
  // Ensure we only use valid numeric values, not contact numbers
  const isValidAmount = (value: any): boolean => {
    if (!value) return false;
    const str = String(value);
    // Check if it's a valid number and not a phone number (phone numbers typically have 10+ digits)
    return /^\d+(\.\d+)?$/.test(str) && str.length < 10;
  };
  
  if (listing.property_for === 'rent') {
    price = isValidAmount(listing.rent_amount) ? `₹${listing.rent_amount}/month` : 'Contact for Price';
    deposit = isValidAmount(listing.deposit_amount) ? `Deposit: ₹${listing.deposit_amount}` : 'Deposit Negotiable';
  } else if (listing.property_for === 'lease') {
    price = isValidAmount(listing.lease_amount) ? `₹${listing.lease_amount}` : 'Contact for Price';
    deposit = isValidAmount(listing.security_deposit) ? `Security: ₹${listing.security_deposit}` : 'Security Negotiable';
  } else if (listing.property_for === 'sale') {
    price = isValidAmount(listing.sale_price) ? `₹${listing.sale_price}` : 'Contact for Price';
    deposit = isValidAmount(listing.booking_amount) ? `Booking: ₹${listing.booking_amount}` : 'Negotiable';
  }

  // Format area - only show property_size if it's valid (not a phone number)
  const area = `${listing.bhk_type} ${listing.apartment_type}`;
  const areaType = (listing.property_size && !/^\+?\d{10,}/.test(listing.property_size)) 
    ? `${listing.property_size}` 
    : 'Contact for details';

  // Prepare images array (limit to 5 images for carousel)
  const imagesArray = listing.images && listing.images.length > 0
    ? listing.images.slice(0, 5).map(url => ({ uri: url }))
    : [require('../assets/images/Aframe.webp')];

  return {
    id: listing.id || String(Date.now()),
    title: listing.title || `${listing.bhk_type} ${listing.apartment_type}`,
    location: listing.location || 'Location not specified',
    price,
    deposit,
    area,
    areaType,
    postedDays,
    dealerName: 'Property Owner',
    isVerified: listing.is_verified ?? false,
    isFeatured: listing.is_featured ?? false,
    imageCount: listing.images?.length || 0,
    category: listing.category || 'Residential',
    subcategory: listing.subcategory || 'Properties for Rent',
    image: imagesArray[0], // First image as fallback
    images: imagesArray, // Array of all images for carousel
  };
}

/**
 * API object for property listings operations
 */
export const PropertyListingsApi = {
  /**
   * List all active property listings
   */
  list: getAllPropertyListings,
  
  /**
   * Search property listings
   */
  search: searchPropertyListings,
};