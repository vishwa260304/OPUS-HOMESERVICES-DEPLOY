import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import { getKyc } from '../utils/appState';

export interface FreshVerificationResult {
  isVerified: boolean;
  verification: any | null;
}

export interface VerificationStatus {
  isVerified: boolean;
  status: 'not_started' | 'pending' | 'under_review' | 'approved' | 'rejected';
  loading: boolean;
  error: string | null;
  verification: any | null;
  refreshVerification: () => Promise<FreshVerificationResult | undefined>;
}

export const useVerification = (): VerificationStatus => {
  const { user } = useAuth();
  const [verification, setVerification] = useState<any>(null);
  const [isVerifiedState, setIsVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastFetchTime = useRef<number>(0);
  const CACHE_DURATION = 30000; // 30 seconds cache

  const normalizeVerificationStatus = (record: any): VerificationStatus['status'] => {
    if (!record) return 'not_started';

    const rawStatus = record.verification_status ?? record.status;
    if (rawStatus === 'approved' || rawStatus === 'verified') return 'approved';
    if (rawStatus === 'under_review') return 'under_review';
    if (rawStatus === 'rejected') return 'rejected';
    if (rawStatus === 'pending') return 'pending';
    if (record.is_verified === true || record.isVerified === true || record.verified === true) return 'approved';

    return 'pending';
  };

  const applyVerification = (record: any | null): FreshVerificationResult => {
    console.log('[useVerification] Applying verification record:', record ? 'Record Found' : 'null');
    setVerification(record);
    const nextIsVerified = normalizeVerificationStatus(record) === 'approved';
    console.log('[useVerification] Calculated isVerified:', nextIsVerified);
    setIsVerified(nextIsVerified);
    return { isVerified: nextIsVerified, verification: record };
  };

  const loadVerification = useCallback(async (forceRefresh = false): Promise<FreshVerificationResult | undefined> => {
    if (!user) return undefined;

    const now = Date.now();
    // Use cache if not forcing refresh and data is recent
    if (!forceRefresh && lastFetchTime.current && (now - lastFetchTime.current) < CACHE_DURATION) {
      return undefined;
    }

    try {
      setLoading(true);
      setError(null);

      // Check company verification, doctor details and acting driver details
      console.log('[useVerification] Starting loadVerification for user:', user.id);

      const companyVerificationResult = await api.companyVerification.getCompanyVerification(user.id);
      const doctorDetailsResult = await api.doctorDetails.getDoctorDetails(user.id);
      let actingDriverResult = await api.actingDrivers.getActingDriverDetails(user.id);

      if (!actingDriverResult.data && user.email) {
        const fallbackResult = await supabase
          .from('providers_acting_drivers')
          .select('*')
          .eq('email', user.email)
          .maybeSingle();

        if (fallbackResult.data) {
          actingDriverResult = fallbackResult;
        }
      }

      // Log a warning if user_id is mismatched — fix must be done via backend/admin, not client-side
      if (actingDriverResult.data && actingDriverResult.data.user_id !== user.id) {
        console.warn('[useVerification] Acting driver user_id mismatch — fix via backend admin for record id:', actingDriverResult.data.id);
      }

      console.log('[useVerification] API Results:', {
        company: {
          hasData: !!companyVerificationResult.data,
          status: companyVerificationResult.data?.verification_status,
          error: companyVerificationResult.error?.message
        },
        doctor: {
          hasData: !!doctorDetailsResult.data,
          error: doctorDetailsResult.error?.message
        },
        actingDriver: {
          hasData: !!actingDriverResult.data,
          status: actingDriverResult.data?.verification_status,
          error: actingDriverResult.error?.message
        }
      });

      let result: FreshVerificationResult;

      // If doctor details exist, treat as verified doctor consultation user
      if (doctorDetailsResult.data && !doctorDetailsResult.error) {
        const doctorData = Array.isArray(doctorDetailsResult.data)
          ? doctorDetailsResult.data[0]
          : doctorDetailsResult.data;

        result = applyVerification({
          ...doctorData,
          id: doctorData.id,
          user_id: user.id,
          selected_sector: 'Doctor Consultation',
          verification_status: 'approved',
          company_name: doctorData.doctor_name,
        });
      } else if (actingDriverResult.data && !actingDriverResult.error) {
        const driverData = Array.isArray(actingDriverResult.data)
          ? actingDriverResult.data[0]
          : actingDriverResult.data;

        result = applyVerification({
          ...driverData,
          id: driverData.id,
          user_id: user.id,
          selected_sector: driverData.selected_sector || 'Acting Drivers',
          verification_status: driverData.verification_status || 'approved',
          company_name: driverData.name,
        });
      } else if (companyVerificationResult.data && !companyVerificationResult.error) {
        result = applyVerification(companyVerificationResult.data);
      } else {
        if (companyVerificationResult.error) {
          setError(companyVerificationResult.error.message);
        }
        result = applyVerification(null);
      }

      lastFetchTime.current = now;
      return result;
    } catch (err) {
      setError('Failed to load verification status');
      console.error('Error loading verification:', err);
      return undefined;
    } finally {
      setLoading(false);
    }
  }, [user]);

  const refreshVerification = useCallback((): Promise<FreshVerificationResult | undefined> => {
    return loadVerification(true);
  }, [loadVerification]);

  useEffect(() => {
    if (user) {
      loadVerification();
    } else {
      setVerification(null);
      setIsVerified(false);
      setLoading(false);
      setError(null);
    }
  }, [user, loadVerification]);

  const getStatus = (): VerificationStatus['status'] => {
    // If local KYC flow has been completed (covers doctor flow), treat as approved
    const localKyc = getKyc();
    if (localKyc?.uploaded) return 'approved';
    if (!verification) return 'not_started';
    
    // If verification has selected_sector as 'Doctor Consultation', it means doctor details exist
    // and KYC is complete, so treat as approved
    if (verification.selected_sector === 'Doctor Consultation') {
      return 'approved';
    }
    
    return normalizeVerificationStatus(verification);
  };

  const isVerified = isVerifiedState || getStatus() === 'approved';

  return {
    isVerified,
    status: getStatus(),
    loading,
    error,
    verification,
    refreshVerification,
  };
};

export default useVerification;
