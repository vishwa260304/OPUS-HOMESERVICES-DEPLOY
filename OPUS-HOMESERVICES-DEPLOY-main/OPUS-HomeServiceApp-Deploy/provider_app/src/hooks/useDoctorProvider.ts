/**
 * Hook to get doctor's provider ID and service ID
 * 
 * This is needed to:
 * 1. Filter bookings for this specific doctor
 * 2. Set up real-time subscriptions
 * 3. Link appointments from patient app to this doctor
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

export interface DoctorProviderInfo {
  providerId: number | null;
  serviceId: number | null;
  loading: boolean;
  error: string | null;
}

export const useDoctorProvider = (): DoctorProviderInfo => {
  const { user } = useAuth();
  const [providerId, setProviderId] = useState<number | null>(null);
  const [serviceId, setServiceId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setProviderId(null);
      setServiceId(null);
      setLoading(false);
      return;
    }

    const fetchProviderInfo = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get doctor's service from providers_services table
        // The service ID is the provider_id used in bookings table
        const { data: services, error: servicesError } = await supabase
          .from('providers_services')
          .select('id, user_id')
          .eq('user_id', user.id)
          .eq('service_type', 'Doctor Consultation')
          .single();

        if (servicesError) {
          // If no service found, try to get any service for this user
          const { data: anyService, error: anyError } = await supabase
            .from('providers_services')
            .select('id, user_id')
            .eq('user_id', user.id)
            .limit(1)
            .single();

          if (anyError || !anyService) {
            console.log('No provider service found for doctor');
            setProviderId(null);
            setServiceId(null);
            setLoading(false);
            return;
          }

          // Use the service ID as provider_id
          setServiceId(anyService.id);
          setProviderId(anyService.id); // For doctor, provider_id = service_id
        } else if (services) {
          setServiceId(services.id);
          setProviderId(services.id); // For doctor, provider_id = service_id
        }
      } catch (err: any) {
        console.error('Error fetching provider info:', err);
        setError(err.message || 'Failed to fetch provider info');
      } finally {
        setLoading(false);
      }
    };

    fetchProviderInfo();
  }, [user]);

  return {
    providerId,
    serviceId,
    loading,
    error,
  };
};

