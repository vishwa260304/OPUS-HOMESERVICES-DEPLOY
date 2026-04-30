import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { getKyc } from '../utils/appState';

export interface VerificationStatus {
  isVerified: boolean;
  status: 'not_started' | 'pending' | 'under_review' | 'approved' | 'rejected';
  loading: boolean;
  error: string | null;
  verification: any | null;
  refreshVerification: () => Promise<void>;
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

  const applyVerification = (record: any | null) => {
    setVerification(record);
    const nextIsVerified = normalizeVerificationStatus(record) === 'approved';
    setIsVerified(nextIsVerified);
  };

  const loadVerification = useCallback(async (forceRefresh = false) => {
    if (!user) return;

    const now = Date.now();
    // Use cache if not forcing refresh and data is recent
    if (!forceRefresh && lastFetchTime.current && (now - lastFetchTime.current) < CACHE_DURATION) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Check company verification, doctor details and acting driver details
      const [
        companyVerificationResult,
        doctorDetailsResult,
        actingDriverResult,
      ] = await Promise.all([
        api.companyVerification.getCompanyVerification(user.id),
        api.doctorDetails.getDoctorDetails(user.id),
        api.actingDrivers.getActingDriverDetails(user.id),
      ]);

      console.log('// FIXED: Issue 4 - raw verification responses', {
        companyVerificationResult,
        doctorDetailsResult,
        actingDriverResult,
      });
      
      // If doctor details exist, treat as verified doctor consultation user
      if (doctorDetailsResult.data && !doctorDetailsResult.error) {
        const doctorData = Array.isArray(doctorDetailsResult.data) 
          ? doctorDetailsResult.data[0] 
          : doctorDetailsResult.data;
        
        // Create a verification-like object for doctor users
        applyVerification({
          // Map doctor fields to verification structure for compatibility
          ...doctorData,
          id: doctorData.id,
          user_id: user.id,
          selected_sector: 'Doctor Consultation',
          verification_status: 'approved', // Doctor details exist means KYC is complete
          company_name: doctorData.doctor_name,
        });
      } else if (actingDriverResult.data && !actingDriverResult.error) {
        // Treat acting drivers as a verified sector user when record exists
        const driverData = Array.isArray(actingDriverResult.data)
          ? actingDriverResult.data[0]
          : actingDriverResult.data;

        applyVerification({
          // Spread original data for compatibility with existing usages
          ...driverData,
          id: driverData.id,
          user_id: user.id,
          selected_sector: driverData.selected_sector || 'Acting Drivers',
          verification_status: driverData.verification_status || 'approved',
          company_name: driverData.name,
        });
      } else if (companyVerificationResult.data && !companyVerificationResult.error) {
        // Use company verification data
        applyVerification(companyVerificationResult.data);
      } else {
        // No verification found
        if (companyVerificationResult.error && companyVerificationResult.error.code === 'PGRST116') {
          applyVerification(null);
        } else if (companyVerificationResult.error) {
          setError(companyVerificationResult.error.message);
          applyVerification(null);
        } else {
          applyVerification(null);
        }
      }
      lastFetchTime.current = now;
    } catch (err) {
      setError('Failed to load verification status');
      console.error('Error loading verification:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const refreshVerification = useCallback(async () => {
    await loadVerification(true);
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
