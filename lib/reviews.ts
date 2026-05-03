import { supabase } from './supabase';

export type Review = {
  id: string;
  booking_id: string;
  customer_user_id: string | null;
  provider_id: string | null;
  doctor_id: string | null;
  acting_driver_id: string | null;
  service_name: string;
  provider_name: string | null;
  doctor_name: string | null;
  category: string | null;
  rating: number;
  review_text: string | null;
  review_date: string;
  created_at: string;
  updated_at: string;
};

export type AppReview = {
  id: string;
  serviceId: string;
  serviceTitle: string;
  rating: number;
  comment: string;
  userName: string;
  date: string;
  images?: string[];
  helpful: number;
  verified: boolean;
};

export type CreateReviewData = {
  booking_id: string;
  service_name: string;
  provider_id?: string | null;
  doctor_id?: string | null;
  acting_driver_id?: string | null;
  provider_name?: string;
  doctor_name?: string;
  category?: string;
  rating: number;
  review_text?: string;
  review_date?: string;
};

export type UpdateReviewData = {
  rating?: number;
  review_text?: string;
  provider_id?: string | null;
  doctor_id?: string | null;
  acting_driver_id?: string | null;
  provider_name?: string | null;
  doctor_name?: string | null;
};

export const ReviewsApi = {
  // Create a new review
  async create(data: CreateReviewData): Promise<{ data: Review | null; error: any }> {
    try {
      const { data: user } = await supabase.auth.getUser();
      
      const reviewData = {
        booking_id: data.booking_id,
        customer_user_id: user?.user?.id || null,
        provider_id: data.provider_id || null,
        doctor_id: data.doctor_id || null,
        acting_driver_id: data.acting_driver_id ?? null,
        service_name: data.service_name,
        provider_name: data.provider_name || null,
        doctor_name: data.doctor_name || null,
        category: data.category || null,
        rating: data.rating,
        review_text: data.review_text || null,
        review_date: data.review_date || new Date().toISOString().split('T')[0],
      };

      const { data: review, error } = await supabase
        .from('reviews')
        .insert([reviewData])
        .select()
        .single();

      return { data: review, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Get reviews by booking ID
  async getByBookingId(bookingId: string): Promise<{ data: Review[]; error: any }> {
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: false });

      return { data: data || [], error };
    } catch (error) {
      return { data: [], error };
    }
  },

  // Get reviews by user ID (customer_user_id)
  async getByUserId(userId: string): Promise<{ data: Review[]; error: any }> {
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('customer_user_id', userId)
        .order('created_at', { ascending: false });

      return { data: data || [], error };
    } catch (error) {
      return { data: [], error };
    }
  },

  // Get all reviews (for admin purposes)
  async getAll(): Promise<{ data: Review[]; error: any }> {
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .order('created_at', { ascending: false });

      return { data: data || [], error };
    } catch (error) {
      return { data: [], error };
    }
  },

  // Update a review
  async update(reviewId: string, data: UpdateReviewData): Promise<{ data: Review | null; error: any }> {
    try {
      const { data: review, error } = await supabase
        .from('reviews')
        .update(data)
        .eq('id', reviewId)
        .select()
        .single();

      return { data: review, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Delete a review
  async delete(reviewId: string): Promise<{ error: any }> {
    try {
      const { error } = await supabase
        .from('reviews')
        .delete()
        .eq('id', reviewId);

      return { error };
    } catch (error) {
      return { error };
    }
  },

  // Get or create review for a booking (upsert functionality)
  async upsertForBooking(bookingId: string, data: CreateReviewData): Promise<{ data: Review | null; error: any }> {
    try {
      const { data: user } = await supabase.auth.getUser();
      const userId = user?.user?.id;

      if (!userId) {
        // For anonymous users, just create a new review
        return await this.create(data);
      }

      // If provider_id is not provided by the client, attempt to resolve it
      // from the booking -> providers_services -> providers_profiles mapping.
      if (data.provider_id === undefined || data.provider_id === null) {
        try {
          const { data: bookingRow } = await supabase
            .from('bookings')
            .select('provider_id')
            .eq('id', bookingId)
            .maybeSingle();

          const bookingProvider = (bookingRow as any)?.provider_id;
          if (bookingProvider) {
            const asNumber = Number(bookingProvider);
            const isNumeric = !isNaN(asNumber);

            if (isNumeric) {
              // Try to fetch provider_profile.id from providers_services
              const { data: svc } = await supabase
                .from('providers_services')
                .select('provider_profile(id), user_id')
                .eq('id', asNumber)
                .maybeSingle();

              // provider_profile may come as object or array depending on join; handle both
              let providerProfileId: string | undefined;
              if (svc) {
                const profileAny = (svc as any).provider_profile;
                if (Array.isArray(profileAny)) {
                  providerProfileId = profileAny[0]?.id;
                } else {
                  providerProfileId = profileAny?.id;
                }
              }

              if (providerProfileId) {
                data.provider_id = providerProfileId;
              } else if (svc && (svc as any).user_id) {
                // Fallback: try to find providers_profiles by user_id
                const { data: pp } = await supabase
                  .from('providers_profiles')
                  .select('id')
                  .eq('user_id', (svc as any).user_id)
                  .maybeSingle();
                if (pp?.id) data.provider_id = pp.id;
              }
            } else {
              // If booking.provider_id is a string, assume it's providers_profiles.id
              data.provider_id = String(bookingProvider);
            }
          }
        } catch (e) {
          // ignore resolution errors — we'll still create/update without provider_id
          console.warn('Failed to auto-resolve provider_id for review upsert:', e);
        }
      }

      // Check if review already exists for this booking and user
      const { data: existingReview } = await supabase
        .from('reviews')
        .select('*')
        .eq('booking_id', bookingId)
        .eq('customer_user_id', userId)
        .single();

      if (existingReview) {
        // Update existing review (including provider_id and doctor_id if provided)
        const updateData: any = {
          rating: data.rating,
          review_text: data.review_text,
        };
        
        // Update provider/doctor/acting_driver IDs if provided
        if (data.provider_id !== undefined) updateData.provider_id = data.provider_id;
        if (data.doctor_id !== undefined) updateData.doctor_id = data.doctor_id;
        if (data.acting_driver_id !== undefined) updateData.acting_driver_id = data.acting_driver_id;
        if (data.provider_name !== undefined) updateData.provider_name = data.provider_name;
        if (data.doctor_name !== undefined) updateData.doctor_name = data.doctor_name;

        return await this.update(existingReview.id, updateData);
      } else {
        // Create new review
        return await this.create(data);
      }
    } catch (error) {
      return { data: null, error };
    }
  },

  // Get average rating for a service/provider
  async getAverageRating(serviceName?: string, providerName?: string): Promise<{ data: { average: number; count: number } | null; error: any }> {
    try {
      let query = supabase
        .from('reviews')
        .select('rating');

      if (serviceName) {
        query = query.eq('service_name', serviceName);
      }
      if (providerName) {
        query = query.eq('provider_name', providerName);
      }

      const { data, error } = await query;

      if (error) {
        return { data: null, error };
      }

      if (!data || data.length === 0) {
        return { data: { average: 0, count: 0 }, error: null };
      }

      const total = data.reduce((sum, review) => sum + review.rating, 0);
      const average = total / data.length;

      return { 
        data: { 
          average: Math.round(average * 10) / 10, // Round to 1 decimal place
          count: data.length 
        }, 
        error: null 
      };
    } catch (error) {
      return { data: null, error };
    }
  }
};

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const mapReviewToAppReview = (review: Review, serviceIdOverride?: string): AppReview => ({
  id: review.id,
  serviceId: serviceIdOverride ?? review.booking_id,
  serviceTitle: review.service_name,
  rating: review.rating,
  comment: review.review_text ?? '',
  userName: review.provider_name ?? review.doctor_name ?? 'Customer',
  date: review.review_date,
  helpful: 0,
  verified: true,
});

export const getReviewsByServiceId = async (serviceId: string): Promise<AppReview[]> => {
  try {
    let query = supabase
      .from('reviews')
      .select('*')
      .order('created_at', { ascending: false });

    query = isUuid(serviceId)
      ? query.eq('booking_id', serviceId)
      : query.eq('service_name', serviceId);

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching reviews by service:', error);
      return [];
    }

    return (data || []).map(review => mapReviewToAppReview(review, serviceId));
  } catch (error) {
    console.error('Error fetching reviews by service:', error);
    return [];
  }
};

export const submitReview = async (
  reviewData: Omit<AppReview, 'id' | 'date' | 'helpful' | 'verified'>
): Promise<AppReview | null> => {
  try {
    if (!isUuid(reviewData.serviceId)) {
      console.warn('Skipping review submission without a valid booking ID:', reviewData.serviceId);
      return null;
    }

    const { data, error } = await ReviewsApi.create({
      booking_id: reviewData.serviceId,
      service_name: reviewData.serviceTitle,
      provider_name: reviewData.userName,
      rating: reviewData.rating,
      review_text: reviewData.comment,
    });

    if (error) {
      console.error('Error submitting review:', error);
      return null;
    }

    return data ? mapReviewToAppReview(data, reviewData.serviceId) : null;
  } catch (error) {
    console.error('Error submitting review:', error);
    return null;
  }
};
