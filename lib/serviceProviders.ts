import { supabase } from './supabase';

export interface ServiceProvider {
  id: string;
  name: string;
  rating: number;
  reviews: number;
  experience: string;
  image: string;
  price: number;
  available: boolean;
  companyName: string;
  serviceName: string;
  serviceType: string;
  providerServiceId: number;
}

export interface ProviderServiceMapping {
  id: string;
  provider_service_id: number;
  service_name: string;
  service_type: string;
  total_linked_services: number;
  linked_subservices: string[];
  linked_at: string;
}

export const serviceProvidersAPI = {
  // Get service providers for a specific service name
  // This fetches ALL providers from the mapping table that match the service (either by service_name or linked_subservices)
  getProvidersByServiceName: async (serviceName: string, serviceType?: string): Promise<{ data: ServiceProvider[] | null; error: any }> => {
    try {
      // Normalize service name for matching (case-insensitive, trim)
      const normalizedServiceName = (serviceName || '').trim();
      const serviceNameLower = normalizedServiceName.toLowerCase();

      if (!normalizedServiceName) {
        if (__DEV__) console.log(`[getProvidersByServiceName] No service name provided.`);
        return { data: [], error: null };
      }

      if (__DEV__) console.log(`[getProvidersByServiceName] Fetching ALL providers for: "${normalizedServiceName}" with type: "${serviceType}"`);

      // Fetch ALL providers from the mapping table for the given service type
      let query = supabase
        .from('provider_service_mapping')
        .select('*');

      if (serviceType) {
        query = query.eq('service_type', serviceType);
      }

      const { data: allMappings, error: mappingError } = await query;

      if (mappingError) {
        console.error('Error fetching provider service mappings:', mappingError);
        return { data: null, error: mappingError };
      }

      if (!allMappings || allMappings.length === 0) {
        if (__DEV__) console.log(`[getProvidersByServiceName] No providers found for service type: "${serviceType}"`);
        return { data: [], error: null };
      }

      // Filter mappings to find providers that offer this service
      // Match by: service_name OR linked_subservices containing the service name
      const filteredMappings = allMappings.filter(mapping => {
        const mappingServiceName = mapping.service_name?.toLowerCase() || '';

        // Check if service_name matches (partial or exact)
        if (mappingServiceName.includes(serviceNameLower) ||
          serviceNameLower.includes(mappingServiceName)) {
          return true;
        }

        // Check if any linked_subservice matches
        if (mapping.linked_subservices && Array.isArray(mapping.linked_subservices)) {
          return mapping.linked_subservices.some((sub: string) => {
            const subLower = sub.toLowerCase();
            // Exact match or search term is contained in the subservice
            return subLower === serviceNameLower ||
              subLower.includes(serviceNameLower) ||
              serviceNameLower.includes(subLower);
          });
        }

        return false;
      });

      if (__DEV__) console.log(`[getProvidersByServiceName] Found ${filteredMappings.length} provider(s) out of ${allMappings.length} total for "${normalizedServiceName}"`);

      if (filteredMappings.length === 0) {
        return { data: [], error: null };
      }

      // Get unique provider_service_ids to fetch avatars and ratings
      const providerServiceIds = [...new Set(filteredMappings.map(m => m.provider_service_id))];
      
      if (__DEV__) console.log('[RATING] Step 1: Provider service IDs to fetch ratings for:', providerServiceIds);
      
      // Fetch provider avatars and ratings
      const avatarMap: { [key: number]: string | null } = {};
      const ratingMap: { [key: number]: { rating: number; reviews: number } } = {};
      
      try {
        // FETCH PROVIDER'S OVERALL RATING ACROSS ALL SERVICES
        // Step 1: Get user_id for each provider_service_id from providers_services
        if (__DEV__) console.log('[RATING] Step 2: Fetching user_ids from providers_services...');
        const { data: servicesData, error: servicesError } = await supabase
          .from('providers_services')
          .select('id, user_id')
          .in('id', providerServiceIds);

        if (__DEV__) console.log('[RATING] Step 3: Services data:', servicesData);

        if (servicesError) {
          if (__DEV__) console.log('[RATING] ❌ RLS Error - Cannot access providers_services table');
          if (__DEV__) console.log('[RATING] Please add this RLS policy in Supabase:');
          if (__DEV__) console.log('[RATING] CREATE POLICY "Allow public read" ON providers_services FOR SELECT TO public USING (true);');
        }

        if (!servicesError && servicesData && servicesData.length > 0) {
          // Step 2: For each provider, get ALL their service IDs
          for (const service of servicesData) {
            if (!service.user_id) continue;
            
            if (__DEV__) console.log(`[RATING] Step 4: Fetching all services for provider ${service.user_id}...`);
            
            // Get ALL service IDs belonging to this provider
            const { data: allUserServices, error: allServicesError } = await supabase
              .from('providers_services')
              .select('id')
              .eq('user_id', service.user_id);

            if (!allServicesError && allUserServices && allUserServices.length > 0) {
              const allServiceIds = allUserServices.map((s: any) => String(s.id));
              if (__DEV__) console.log(`[RATING] Step 5: Provider has ${allServiceIds.length} services: [${allServiceIds.join(', ')}]`);
              
              // Step 3: Fetch ALL reviews for ANY of this provider's services
              const { data: reviewsData, error: reviewsError } = await supabase
                .from('reviews')
                .select('provider_id, rating')
                .in('provider_id', allServiceIds);

              if (__DEV__) console.log(`[RATING] Step 6: Found ${reviewsData?.length || 0} reviews across all services`);
              
              if (!reviewsError && reviewsData && reviewsData.length > 0) {
                // Calculate average rating across ALL the provider's services
                const ratings: number[] = [];
                reviewsData.forEach((review: any) => {
                  const ratingValue = typeof review.rating === 'string' 
                    ? parseFloat(review.rating) 
                    : Number(review.rating);
                  if (!isNaN(ratingValue)) {
                    ratings.push(ratingValue);
                  }
                });

                if (ratings.length > 0) {
                  const sum = ratings.reduce((acc, r) => acc + r, 0);
                  const avg = sum / ratings.length;
                  
                  // Apply this overall rating to the service being displayed
                  ratingMap[service.id] = {
                    rating: Math.round(avg * 10) / 10,
                    reviews: ratings.length
                  };
                  
                  if (__DEV__) console.log(`[RATING] ✅ Service ${service.id}: ${avg.toFixed(1)} stars (${ratings.length} reviews across services: ${allServiceIds.join(', ')})`);
                }
              }
            }
          }

          // Step 4: Fetch avatars from providers_profiles
          if (__DEV__) console.log('[RATING] Step 7: Fetching avatars...');
          const userIds = [...new Set(servicesData.map((s: any) => s.user_id).filter(Boolean))];
          
          if (userIds.length > 0) {
            const { data: profilesData, error: profilesError } = await supabase
              .from('providers_profiles')
              .select('id, avatar_url')
              .in('id', userIds);

            if (!profilesError && profilesData) {
              const userIdToAvatar: { [key: string]: string | null } = {};
              profilesData.forEach((profile: any) => {
                userIdToAvatar[profile.id] = profile.avatar_url || null;
              });

              servicesData.forEach((service: any) => {
                if (service.id && service.user_id) {
                  avatarMap[service.id] = userIdToAvatar[service.user_id] || null;
                }
              });
              
              if (__DEV__) console.log('[RATING] Step 8: Avatars fetched successfully');
            }
          }
        }
      } catch (error) {
        console.error('[RATING] Error fetching ratings:', error);
      }

      // Transform the data to match the ServiceProvider interface
      const providers: ServiceProvider[] = filteredMappings
        .map(mapping => {
          // Use company name directly from mapping table (company_name column)
          const companyName = mapping.company_name ||
            mapping.company?.company_name ||
            `Provider ${mapping.provider_service_id}` ||
            'Unknown Provider';

          // Get avatar from the map, fallback to null if not found
          const avatarUrl = avatarMap[mapping.provider_service_id] || null;

          // Get actual ratings and reviews from the map, fallback to defaults
          const ratingData = ratingMap[mapping.provider_service_id];
          const actualRating = ratingData?.rating ?? 0;
          const actualReviews = ratingData?.reviews ?? 0;

          return {
            id: `provider_${mapping.provider_service_id}`,
            name: companyName,
            rating: actualRating, // Use actual rating from reviews
            reviews: actualReviews, // Use actual review count
            experience: `3+ years`, // Default experience
            image: avatarUrl || '', // Use avatar from database, empty string if null
            price: 0, // Price not stored in current schema
            available: mapping.company?.verification_status === 'approved' || true, // Available if company is approved
            companyName: companyName,
            serviceName: mapping.service_name,
            serviceType: mapping.service_type,
            providerServiceId: mapping.provider_service_id
          };
        })
        .filter(provider => provider.providerServiceId); // Only include providers with valid IDs

      // Debug logging removed

      return { data: providers, error: null };
    } catch (error) {
      console.error('Error in getProvidersByServiceName:', error);
      return { data: null, error };
    }
  },

  // Fetch mapping row by provider_service_id to get canonical IDs/names
  getMappingByProviderServiceId: async (providerServiceId: number): Promise<{ data: { provider_service_id: number; company_name: string | null } | null; error: any }> => {
    try {
      const { data, error } = await supabase
        .from('provider_service_mapping')
        .select('provider_service_id, company_name')
        .eq('provider_service_id', providerServiceId)
        .maybeSingle();
      if (error) {
        return { data: null, error };
      }
      return { data: data as { provider_service_id: number; company_name: string | null }, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Get all available service names for a specific service type
  getServiceNamesByType: async (serviceType: string): Promise<{ data: string[] | null; error: any }> => {
    try {
      const { data, error } = await supabase
        .from('provider_service_mapping')
        .select('service_name')
        .eq('service_type', serviceType)
        .order('service_name');

      if (error) {
        console.error('Error fetching service names:', error);
        return { data: null, error };
      }

      const serviceNames = data ? data.map(item => item.service_name) : [];
      return { data: serviceNames, error: null };
    } catch (error) {
      console.error('Error in getServiceNamesByType:', error);
      return { data: null, error };
    }
  },

  // Get service providers for multiple service names
  getProvidersForServices: async (serviceNames: string[], serviceType?: string): Promise<{ data: { [serviceName: string]: ServiceProvider[] } | null; error: any }> => {
    try {
      const results: { [serviceName: string]: ServiceProvider[] } = {};

      // Fetch providers for each service name
      for (const serviceName of serviceNames) {
        const { data: providers, error } = await serviceProvidersAPI.getProvidersByServiceName(serviceName, serviceType);
        if (error) {
          console.error(`Error fetching providers for ${serviceName}:`, error);
          results[serviceName] = [];
        } else {
          results[serviceName] = providers || [];
        }
      }

      return { data: results, error: null };
    } catch (error) {
      console.error('Error in getProvidersForServices:', error);
      return { data: null, error };
    }
  },

  // Get provider details by provider service ID
  getProviderDetails: async (providerServiceId: number): Promise<{ data: ServiceProvider | null; error: any }> => {
    try {
      const { data, error } = await supabase
        .from('providers_services')
        .select(`
          *,
          company_verification:providers_company_verification (
            company_name,
            verification_status
          ),
          provider_profile:providers_profiles (
            full_name,
            email,
            phone,
            avatar_url
          )
        `)
        .eq('id', providerServiceId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching provider details:', error);
        return { data: null, error };
      }

      if (!data || !data.company_verification) {
        return { data: null, error: 'Provider not found' };
      }

      // Fetch actual ratings and reviews using the same logic as DashboardScreen
      let actualRating = 0;
      let actualReviews = 0;

      try {
        const userId = data.user_id;

        // 1. Try RPC first (same as dashboard)
        try {
          const { data: rpcData, error: rpcErr } = await supabase.rpc('get_provider_review_stats', { p_user: userId });
          if (!rpcErr && rpcData) {
            const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
            const rpcAvg = row?.avg_rating ? Number(row.avg_rating) : 0;
            const rpcCount = row?.review_count ? Number(row.review_count) : 0;
            
            if (rpcCount > 0) {
              actualRating = rpcAvg;
              actualReviews = rpcCount;
              // Return early if RPC succeeded
              const provider: ServiceProvider = {
                id: `provider_${data.id}`,
                name: data.company_verification.company_name || data.provider_profile?.full_name || 'Unknown Provider',
                rating: actualRating,
                reviews: actualReviews,
                experience: `${data.experience_years || 0}+ years`,
                image: data.provider_profile?.avatar_url || '',
                price: 0,
                available: data.status === 'active',
                companyName: data.company_verification.company_name || 'Unknown Provider',
                serviceName: data.service_name,
                serviceType: data.service_type,
                providerServiceId: data.id
              };
              return { data: provider, error: null };
            }
          }
        } catch {
        }

        // 2. Fall back to client-side filtering (same as dashboard)
        const numericServiceId = Number(providerServiceId);
        const serviceIdString = String(providerServiceId);

        // Gather IDs for matching
        const numericServiceIds = [numericServiceId];
        const serviceIdStrings = [serviceIdString];
        const profileIds = userId ? [String(userId)] : [];

        // Fetch all reviews
        const { data: allReviews, error: allErr } = await supabase
          .from('reviews')
          .select('rating, provider_id, doctor_id')
          .limit(1000);

        if (!allErr && allReviews) {
          const matched: any[] = [];

          // Match reviews using the same comprehensive logic as dashboard
          for (const review of allReviews) {
            // 1. Check doctor_id first (for doctor providers)
            if (review.doctor_id && String(review.doctor_id) === String(userId)) {
              matched.push(review);
              continue;
            }

            const pid = review.provider_id;
            if (pid == null) continue;

            // 2. Match by numeric service ID
            if (typeof pid === 'number') {
              if (numericServiceIds.includes(pid)) {
                matched.push(review);
              }
              continue;
            }

            // 3. Match by string
            if (typeof pid === 'string') {
              // Direct match to user id
              if (String(pid) === String(userId)) {
                matched.push(review);
                continue;
              }

              // Direct match to service id string
              if (serviceIdStrings.includes(pid)) {
                matched.push(review);
                continue;
              }

              // If string looks numeric, treat as number
              const asNum = Number(pid);
              if (Number.isFinite(asNum) && numericServiceIds.includes(asNum)) {
                matched.push(review);
              } else if (profileIds.includes(pid)) {
                matched.push(review);
              }
            }
          }

          // Calculate average rating
          if (matched.length > 0) {
            const sum = matched.reduce((acc, r) => acc + (r.rating || 0), 0);
            actualRating = Math.round((sum / matched.length) * 10) / 10;
            actualReviews = matched.length;
          }
        }
      } catch (ratingError) {
        console.error('Error fetching provider ratings:', ratingError);
        // Use defaults (0, 0) if rating fetch fails
      }

      const provider: ServiceProvider = {
        id: `provider_${data.id}`,
        name: data.company_verification.company_name || data.provider_profile?.full_name || 'Unknown Provider',
        rating: actualRating, // Use actual rating from reviews
        reviews: actualReviews, // Use actual review count
        experience: `${data.experience_years || 0}+ years`,
        image: data.provider_profile?.avatar_url || '',
        price: 0, // Price not stored in current schema
        available: data.status === 'active',
        companyName: data.company_verification.company_name || 'Unknown Provider',
        serviceName: data.service_name,
        serviceType: data.service_type,
        providerServiceId: data.id
      };

      return { data: provider, error: null };
    } catch (error) {
      console.error('Error in getProviderDetails:', error);
      return { data: null, error };
    }
  }
};
