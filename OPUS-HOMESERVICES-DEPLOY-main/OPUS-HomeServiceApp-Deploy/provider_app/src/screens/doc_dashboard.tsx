import React, { useEffect, useRef, useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, Dimensions, Modal, Animated, Easing, StatusBar, RefreshControl, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useIsFocused, useRoute } from '@react-navigation/native';
import BottomTab from '../components/BottomTab';
import { moderateScale } from '../utils/responsive';
import { Ionicons } from '@expo/vector-icons';
import { getCompanyInfo, getOnlineStatus, setOnlineStatus, getBookings, addBooking, getEarningsSummary, pushNotification, getNotifications, updateBookingStatus, setBookings, Booking } from '../utils/appState';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import GradientHeader from '../components/GradientHeader';
import { useTheme } from '../context/ThemeContext';
import { useScreenTracking } from '../hooks/useScreenTracking';
import { trackEvent } from '../services/analytics';
import { useDoctorProvider } from '../hooks/useDoctorProvider';
import { subscribeToDoctorAppointments, fetchDoctorAppointments, fetchNewDoctorAppointments } from '../services/doctorAppointments';
import { DoctorAppointmentsService } from '../services/doctorAppointmentsService';
import { PatientsService } from '../services/patientsService';

const DoctorDashboardScreen: React.FC = () => {
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const route = useRoute();
  const [brandName, setBrandName] = useState<string>('Fixit Partner');
  const [isOnline, setIsOnline] = useState<boolean>(getOnlineStatus());
  const { user } = useAuth();

  // Track screen view
  useScreenTracking('Doctor Dashboard', {
    is_online: isOnline,
  });

  // Get doctor's provider ID for real-time subscriptions
  const { providerId, loading: providerLoading } = useDoctorProvider();
  const [todayEarnings, setTodayEarnings] = useState<number>(0);
  const [todayCompletedCount, setTodayCompletedCount] = useState<number>(0);
  const [weeklyAmount, setWeeklyAmount] = useState<number>(0);
  const [acceptancePct, setAcceptancePct] = useState<number>(0);
  const [notificationCount, setNotificationCount] = useState<number>(getNotifications().length);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Doctor-specific stats
  const [todayAppointmentsCount, setTodayAppointmentsCount] = useState<number>(0);
  const [upcomingAppointments, setUpcomingAppointments] = useState<ReturnType<typeof getBookings>>([]);
  const [activeAppointments, setActiveAppointments] = useState<ReturnType<typeof getBookings>>([]);
  const [totalPatientsCount, setTotalPatientsCount] = useState<number>(0);
  const [nextAppointmentTime, setNextAppointmentTime] = useState<string>('');
  const [newAppointments, setNewAppointments] = useState<ReturnType<typeof getBookings>>([]);
  const [newAppointmentsCount, setNewAppointmentsCount] = useState<number>(0);
  const [bookingsRefreshKey, setBookingsRefreshKey] = useState<number>(0);
  const [averageRating, setAverageRating] = useState<number>(0);

  const offlineNoticeY = useRef(new Animated.Value(-140)).current;
  const [offlineNoticeVisible, setOfflineNoticeVisible] = useState<boolean>(false);
  const [selectedAppointment, setSelectedAppointment] = useState<ReturnType<typeof getBookings>[0] | null>(null);
  const [appointmentModalVisible, setAppointmentModalVisible] = useState<boolean>(false);

  const scrollY = useRef(new Animated.Value(0)).current;
  const { width } = Dimensions.get('window');
  const [headerHeight, setHeaderHeight] = useState<number>(160);

  const horizontalPadding = moderateScale(16);
  const gap = moderateScale(12);
  const tileWidth = Math.floor((width - horizontalPadding * 2 - gap * 2));
  const singleTileWidth = Math.floor(tileWidth / 3);

  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  // Healthcare sector colors (use the requested 3-color gradient)
  const sectorGradient = ['#26A69A', '#00897B', '#00796B'] as const;
  const doctorSpecialty = route.params && (route.params as any).specialty;

  // Fetch bookings where this doctor is the assigned doctor (doctor_user_id)
  // Also fetches status from doctor_appointments table for persistence
  const fetchDoctorBookings = async (doctorUserId: string) => {
    try {
      // First, get all bookings for this doctor
      const res = await supabase
        .from('bookings')
        .select(`
          id,
          user_id,
          items,
          address,
          schedule,
          appointment_date,
          appointment_time,
          status,
          total,
          amount,
          payment_status,
          payment_amount,
          currency,
          provider_id,
          provider_service_id,
          provider_name,
          doctor_user_id,
          patient_name,
          patient_phone,
          consultation_type,
          symptoms,
          created_at,
          notes
        `)
        .eq('doctor_user_id', doctorUserId)
        .order('created_at', { ascending: false });

      // Log raw Supabase response for debugging RLS/auth issues

      if (res.error) {
        console.error('Error fetching bookings for doctor:', res.error);
        return [] as any[];
      }

      const bookings = res.data || [];

      // Now fetch doctor_appointments records to get persisted status
      const appointmentRecords = await DoctorAppointmentsService.getByDoctorId(doctorUserId);
      const statusMap = new Map<string, string>();

      appointmentRecords.forEach(record => {
        statusMap.set(record.booking_id, record.status);
      });

      // Merge status from doctor_appointments table (takes precedence)
      // Also ensure appointment_date, appointment_time, symptoms, and consultation_type are preserved
      const bookingsWithPersistedStatus = bookings.map((booking: any) => {
        const persistedStatus = statusMap.get(booking.id);
        const result: any = {
          ...booking,
          // Explicitly preserve appointment_date and appointment_time from database
          appointment_date: booking.appointment_date || null,
          appointment_time: booking.appointment_time || null,
          // Also set camelCase versions for consistency (these are what the UI uses)
          appointmentDate: booking.appointment_date || booking.appointmentDate || null,
          appointmentTime: booking.appointment_time || booking.appointmentTime || null,
          // Explicitly preserve symptoms from database
          symptoms: booking.symptoms || null,
          // Explicitly preserve consultation_type from database
          consultation_type: booking.consultation_type || null,
          consultationType: booking.consultation_type || booking.consultationType || null,
        };
        if (persistedStatus) {
          // Use status from doctor_appointments table
          // Map 'accepted' to 'Assigned' for UI consistency, but preserve 'accepted' for filtering
          const statusLower = persistedStatus.toLowerCase();
          if (statusLower === 'accepted') {
            result.status = 'Assigned'; // Map to Assigned for UI display
            result.originalStatus = 'accepted'; // Preserve original for filtering
          } else {
            result.status = persistedStatus;
          }
        }
        return result;
      });

      return bookingsWithPersistedStatus;
    } catch (err) {
      console.error('Exception fetching doctor bookings:', err);
      return [] as any[];
    }
  };

  // Update booking status remotely in Supabase (bookings table uses uuid ids)
  // Also saves to doctor_appointments table for persistence
  const updateBookingStatusRemote = async (id: string, status: string) => {
    try {
      // Normalize status to lowercase for database consistency
      const normalizedStatus = status.toLowerCase();

      // Map status to database format for bookings table
      // Rejected maps to 'cancelled' in bookings table, Accepted maps to 'assigned' in bookings table
      // But we preserve 'rejected' and 'accepted' for doctor_appointments table
      let dbStatus = normalizedStatus;
      if (normalizedStatus === 'rejected' || normalizedStatus === 'reject') {
        dbStatus = 'cancelled'; // bookings table uses 'cancelled'
      } else if (normalizedStatus === 'accepted' || normalizedStatus === 'accept') {
        dbStatus = 'assigned'; // bookings table uses 'assigned'
      } else if (normalizedStatus === 'inprogress' || normalizedStatus === 'in_progress') {
        dbStatus = 'in_progress';
      } else if (normalizedStatus === 'completed' || normalizedStatus === 'complete') {
        dbStatus = 'completed'; // Explicitly set completed status
      }

      // Update the main bookings table
      console.log(`🔄 Updating booking ${id} status to: ${dbStatus} (from: ${status})`);
      const res = await supabase
        .from('bookings')
        .update({ status: dbStatus })
        .eq('id', id)
        .select();
      if (res.error) {
        console.error('❌ Failed to update booking status remotely:', res.error);
        return { success: false, error: res.error };
      }
      if (res.data && res.data.length > 0) {
        console.log('✅ Remote booking status updated successfully:', id, 'to', dbStatus, 'Updated record:', res.data[0]);
      } else {
        console.warn('⚠️ Update query succeeded but no data returned for booking:', id);
      }

      // Also save to doctor_appointments table if user is a doctor
      if (user?.id) {
        // Map to doctor_appointments status format
        // Reject should be saved as 'rejected', Accept should be saved as 'accepted'
        let appointmentStatus: 'new' | 'assigned' | 'in_progress' | 'completed' | 'cancelled' | 'rejected' | 'accepted';

        // Check the original status parameter to preserve 'rejected' and 'accepted'
        const originalStatusLower = status.toLowerCase();
        if (originalStatusLower === 'rejected' || originalStatusLower === 'reject') {
          appointmentStatus = 'rejected';
        } else if (originalStatusLower === 'accepted' || originalStatusLower === 'accept') {
          appointmentStatus = 'accepted';
        } else if (dbStatus === 'assigned') {
          appointmentStatus = 'assigned';
        } else if (dbStatus === 'in_progress' || dbStatus === 'inprogress') {
          appointmentStatus = 'in_progress';
        } else if (dbStatus === 'completed') {
          appointmentStatus = 'completed';
        } else if (dbStatus === 'cancelled') {
          appointmentStatus = 'cancelled';
        } else {
          appointmentStatus = 'new';
        }

        // Check if record exists first
        const existingRecord = await DoctorAppointmentsService.getByBookingAndDoctor(id, user.id);

        if (existingRecord) {
          // Record exists, use updateStatus which properly sets timestamps
          const appointmentRecord = await DoctorAppointmentsService.updateStatus(
            id,
            user.id,
            appointmentStatus
          );

          if (appointmentRecord) {
            console.log('✅ Doctor appointment record updated in doctor_appointments table:', appointmentRecord.id, 'status:', appointmentStatus);
          } else {
            console.warn('⚠️ Failed to update doctor appointment record, but booking status was updated');
          }
        } else {
          // Record doesn't exist, use upsert to create it
          // Get patient_id from patients table
          const patient = await PatientsService.getByBookingId(id);

          const upsertRecord = await DoctorAppointmentsService.upsert({
            booking_id: id,
            doctor_user_id: user.id,
            status: appointmentStatus,
            patient_id: patient?.id || null,
          });

          if (upsertRecord) {
            console.log('✅ Doctor appointment record created in doctor_appointments table:', upsertRecord.id, 'status:', appointmentStatus);

            // After creating, update timestamps if needed using updateStatus
            if (appointmentStatus !== 'new') {
              await DoctorAppointmentsService.updateStatus(id, user.id, appointmentStatus);
            }
          } else {
            console.warn('⚠️ Failed to create doctor appointment record, but booking status was updated');
          }
        }

        // Sync patient data to patients table when appointment is accepted or completed
        if (user?.id && res.data && res.data.length > 0) {
          const bookingData = res.data[0];
          // Sync patient when accepting or completing appointment
          if (appointmentStatus === 'accepted' || appointmentStatus === 'assigned' || appointmentStatus === 'completed') {
            try {
              const patient = await PatientsService.syncFromBooking(bookingData, user.id);
              console.log('✅ Patient data synced to patients table');

              // Update doctor_appointments record with patient_id
              if (patient && patient.id) {
                const existingRecord = await DoctorAppointmentsService.getByBookingAndDoctor(id, user.id);
                if (existingRecord) {
                  await DoctorAppointmentsService.update(id, user.id, { patient_id: patient.id });
                  console.log('✅ Updated doctor_appointments with patient_id:', patient.id);
                } else {
                  // If record doesn't exist, create it with patient_id
                  await DoctorAppointmentsService.create({
                    booking_id: id,
                    doctor_user_id: user.id,
                    status: appointmentStatus,
                    patient_id: patient.id,
                  });
                  console.log('✅ Created doctor_appointments with patient_id:', patient.id);
                }

                // If appointment is completed, explicitly update patients table status to 'completed'
                if (appointmentStatus === 'completed' && patient) {
                  try {
                    const patientUpdateData: {
                      status?: string;
                      payment_status?: string | null;
                    } = {
                      status: 'completed',
                    };

                    // Get payment_status from booking data
                    if (bookingData.payment_status) {
                      patientUpdateData.payment_status = bookingData.payment_status;
                    } else if (bookingData.payment_amount !== null && bookingData.payment_amount !== undefined) {
                      // If payment_amount exists, assume paid
                      patientUpdateData.payment_status = 'paid';
                    }

                    const updatedPatient = await PatientsService.updateByDoctor(patient.id, user.id, patientUpdateData);
                    if (updatedPatient) {
                      console.log('✅ Updated patients table status to completed for patient:', patient.id);
                    }
                  } catch (patientUpdateError) {
                    console.warn('⚠️ Failed to update patients table status (non-critical):', patientUpdateError);
                    // Don't fail the whole operation if patient update fails
                  }
                }
              }
            } catch (patientSyncError) {
              console.warn('⚠️ Failed to sync patient data (non-critical):', patientSyncError);
              // Don't fail the whole operation if patient sync fails
            }
          }
        }
      }

      return { success: true, data: res.data };
    } catch (err) {
      console.error('Exception updating booking status remotely:', err);
      return { success: false, error: err };
    }
  };

  // Helper function to refresh appointment lists from current bookings state
  const refreshAppointmentLists = () => {
    const bookings = getBookings();
    const todayDate = new Date();
    const todayStr = todayDate.toDateString();

    // Filter new appointments (status 'New' or 'Unassigned')
    // IMPORTANT: Use spread operator to preserve all fields including appointmentDate/appointmentTime
    const newAppts = bookings.filter(b => {
      const status = (b.status || '').toString().toLowerCase();
      return status === 'new' || status === 'unassigned' || status === 'pending';
    }).map(b => {
      return {
        ...b,
        // Explicitly preserve appointment date/time fields - check all possible property names
        appointmentDate: (b as any).appointmentDate || (b as any).appointment_date || (b as any)['appointment_date'] || null,
        appointmentTime: (b as any).appointmentTime || (b as any).appointment_time || (b as any)['appointment_time'] || null,
        appointment_date: (b as any).appointment_date || (b as any).appointmentDate || (b as any)['appointment_date'] || null,
        appointment_time: (b as any).appointment_time || (b as any).appointmentTime || (b as any)['appointment_time'] || null,
      };
    }).sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });

    setNewAppointments(newAppts);
    setNewAppointmentsCount(newAppts.length);

    // Filter today's appointments
    const todayAppts = bookings.filter(b => {
      if (!b.createdAt) return false;
      const bookingDate = new Date(b.createdAt);
      const status = (b.status || '').toString().toLowerCase();
      return bookingDate.toDateString() === todayStr && (status === 'assigned' || status === 'inprogress' || status === 'in_progress');
    });
    setTodayAppointmentsCount(todayAppts.length);

    // Filter upcoming appointments (status 'Accepted', 'Assigned', or 'InProgress')
    const upcoming = bookings.filter(b => {
      if (!b.createdAt) return false;
      // Use appointment_date if available, otherwise use createdAt
      const appointmentDate = (b as any).appointmentDate || (b as any).appointment_date;
      const bookingDate = appointmentDate ? new Date(appointmentDate) : new Date(b.createdAt);
      const status = (b.status || '').toString().toLowerCase();
      const originalStatus = ((b as any).originalStatus || '').toString().toLowerCase();
      // Include accepted, assigned, and in_progress appointments that are in the future
      const isActiveStatus = status === 'assigned' ||
        status === 'inprogress' ||
        status === 'in_progress' ||
        originalStatus === 'accepted' ||
        status === 'accepted';
      return bookingDate > todayDate && isActiveStatus;
    }).sort((a, b) => {
      // Sort by appointment_date if available, otherwise by createdAt
      const dateA = (a as any).appointmentDate
        ? new Date((a as any).appointmentDate).getTime()
        : new Date(a.createdAt || '').getTime();
      const dateB = (b as any).appointmentDate
        ? new Date((b as any).appointmentDate).getTime()
        : new Date(b.createdAt || '').getTime();
      return dateA - dateB;
    }).slice(0, 5);
    setUpcomingAppointments(upcoming);

    // Filter active appointments (all appointments with status 'Accepted', 'Assigned', or 'InProgress')
    // These should persist even after app reload since they're saved in doctor_appointments table
    const active = bookings.filter(b => {
      if (!b.createdAt) return false;
      const status = (b.status || '').toString().toLowerCase();
      const originalStatus = ((b as any).originalStatus || '').toString().toLowerCase();
      // Include accepted, assigned, and in_progress appointments
      return status === 'assigned' ||
        status === 'inprogress' ||
        status === 'in_progress' ||
        originalStatus === 'accepted' ||
        status === 'accepted';
    }).sort((a, b) => {
      // Sort by appointment_date if available, otherwise by createdAt
      const dateA = (a as any).appointmentDate
        ? new Date((a as any).appointmentDate).getTime()
        : new Date(a.createdAt || '').getTime();
      const dateB = (b as any).appointmentDate
        ? new Date((b as any).appointmentDate).getTime()
        : new Date(b.createdAt || '').getTime();
      return dateA - dateB;
    });
    setActiveAppointments(active);

    // Calculate next appointment time
    const allUpcoming = bookings.filter(b => {
      if (!b.createdAt) return false;
      const status = (b.status || '').toString().toLowerCase();
      return status === 'assigned' || status === 'inprogress' || status === 'in_progress';
    }).sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeA - timeB;
    });
    const nextAppt = allUpcoming[0];
    if (nextAppt && nextAppt.createdAt) {
      const nextTime = new Date(nextAppt.createdAt);
      const now = new Date();
      if (nextTime > now) {
        const hours = nextTime.getHours();
        const minutes = nextTime.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        setNextAppointmentTime(`${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`);
      } else {
        setNextAppointmentTime('');
      }
    } else {
      setNextAppointmentTime('');
    }

    // Calculate unique patients - count all patients (completed, active, and upcoming)
    // This matches the "All Patients" count in MyPatientsScreen
    const nowForPatients = new Date();
    const todayForPatients = new Date(nowForPatients.getFullYear(), nowForPatients.getMonth(), nowForPatients.getDate());
    const uniquePatients = new Set<string>();

    bookings.forEach((booking) => {
      const patientName = booking.customerName;
      if (!patientName || patientName.trim() === '') return;

      // Get appointment_date from booking
      const appointmentDate = (booking as any).appointment_date || (booking as any).appointmentDate || null;

      // Parse appointment_date properly
      let bookingDateOnly: Date | null = null;
      if (appointmentDate) {
        let dateToParse = appointmentDate;
        if (typeof appointmentDate === 'string' && appointmentDate.includes('T')) {
          dateToParse = appointmentDate.split('T')[0];
        } else if (typeof appointmentDate === 'string' && appointmentDate.includes(' ')) {
          dateToParse = appointmentDate.split(' ')[0];
        }
        const bookingDate = new Date(dateToParse + 'T00:00:00');
        if (!isNaN(bookingDate.getTime())) {
          bookingDateOnly = new Date(bookingDate.getFullYear(), bookingDate.getMonth(), bookingDate.getDate());
        }
      }

      // Fallback to createdAt if no appointment_date
      if (!bookingDateOnly && booking.createdAt) {
        const bookingDate = new Date(booking.createdAt);
        if (!isNaN(bookingDate.getTime())) {
          bookingDateOnly = new Date(bookingDate.getFullYear(), bookingDate.getMonth(), bookingDate.getDate());
        }
      }

      // If still no date, skip this booking
      if (!bookingDateOnly) return;

      // Check status - be more inclusive
      const normalizedStatus = (booking.status || '').toString().toLowerCase();
      const originalStatus = ((booking as any).originalStatus || '').toString().toLowerCase();

      // Determine if appointment is accepted/assigned/in progress
      const isAccepted = booking.status === 'Assigned' ||
        booking.status === 'InProgress' ||
        normalizedStatus === 'confirmed' ||
        normalizedStatus === 'accepted' ||
        normalizedStatus === 'assigned' ||
        normalizedStatus === 'inprogress' ||
        normalizedStatus === 'in_progress' ||
        originalStatus === 'accepted';

      // Determine if appointment is completed
      const isCompleted = booking.status === 'Completed' || normalizedStatus === 'completed';

      // Determine if appointment is new/pending (not yet accepted)
      const isNew = normalizedStatus === 'new' ||
        normalizedStatus === 'unassigned' ||
        normalizedStatus === 'pending';

      // Check if booking is today, past, or future
      const isToday = bookingDateOnly.getTime() === todayForPatients.getTime();
      const isPast = bookingDateOnly.getTime() < todayForPatients.getTime();
      const isFuture = bookingDateOnly.getTime() > todayForPatients.getTime();

      // Include patient if:
      // 1. Completed appointments (any date)
      // 2. Active appointments (today, accepted/assigned/in progress)
      // 3. Upcoming appointments (future, accepted/assigned/in progress)
      // 4. Today's new appointments (not yet accepted but scheduled for today)
      if (isCompleted) {
        // All completed appointments count
        uniquePatients.add(patientName);
      } else if (isToday && isAccepted) {
        // Today's accepted/assigned/in progress appointments
        uniquePatients.add(patientName);
      } else if (isToday && isNew) {
        // Today's new appointments (not yet accepted)
        uniquePatients.add(patientName);
      } else if (isFuture && isAccepted) {
        // Future accepted/assigned/in progress appointments
        uniquePatients.add(patientName);
      } else if (isPast && isAccepted) {
        // Past accepted appointments (might be in progress from previous days)
        uniquePatients.add(patientName);
      }
    });

    setTotalPatientsCount(uniquePatients.size);
  };

  // Set up real-time subscription for appointments from patient app
  useEffect(() => {
    if (!providerId || providerLoading) return;

    console.log('🔔 Setting up real-time subscription for doctor appointments, provider_id:', providerId, 'doctor_user_id:', user?.id);

    // Declare directChannel at useEffect level so it's accessible in cleanup
    let directChannel: any = null;

    // Use the subscription service
    const unsubscribe = subscribeToDoctorAppointments(
      providerId,
      // onNewAppointment - when patient app creates new appointment
      async (newAppointment) => {
        console.log('📥 New appointment received from patient app:', newAppointment);

        // Immediately fetch the full booking details from database to ensure we have complete data
        if (user?.id) {
          try {
            // Fetch just this specific booking to get complete details immediately
            const { data: bookingData, error: bookingError } = await supabase
              .from('bookings')
              .select(`
                id,
                user_id,
                items,
                address,
                schedule,
                appointment_date,
                appointment_time,
                status,
                total,
                amount,
                payment_mode,
                payment_status,
                payment_amount,
                currency,
                provider_id,
                provider_service_id,
                provider_name,
                doctor_user_id,
                patient_name,
                patient_phone,
                consultation_type,
                symptoms,
                created_at,
                notes
              `)
              .eq('id', newAppointment.id)
              .single();

            if (bookingData) {
              // Process and add the booking immediately
              const dbStatus = (bookingData.status || '').toString().toLowerCase();
              let normalizedStatus: string;

              if (dbStatus === 'pending' || dbStatus === 'new' || dbStatus === 'unassigned') {
                normalizedStatus = 'New';
              } else if (dbStatus === 'confirmed' || dbStatus === 'assigned') {
                normalizedStatus = 'Assigned';
              } else if (dbStatus === 'in_progress' || dbStatus === 'inprogress') {
                normalizedStatus = 'InProgress';
              } else if (dbStatus === 'completed') {
                normalizedStatus = 'Completed';
              } else if (dbStatus === 'cancelled') {
                normalizedStatus = 'Cancelled';
              } else {
                normalizedStatus = 'New';
              }

              // Determine location based on consultation type
              const consultationType = bookingData.consultation_type || 'In-Person';
              const location = consultationType === 'In-Person'
                ? (bookingData.address && bookingData.address.label) || 'In-Person Consultation'
                : consultationType; // 'Video Call' or 'Phone Call'

              const transformedBooking = {
                id: bookingData.id,
                customerName: bookingData.patient_name || bookingData.user_id,
                location: location,
                serviceName: bookingData.provider_name || '',
                amount: bookingData.amount ?? bookingData.total ?? 0,
                paymentMode: (bookingData as any).payment_mode || '',
                paymentStatus: bookingData.payment_status || null,
                status: normalizedStatus as Booking['status'],
                createdAt: bookingData.created_at,
                consultationType: consultationType,
                symptoms: bookingData.symptoms || null,
                appointmentDate: bookingData.appointment_date || null,
                appointmentTime: bookingData.appointment_time || null,
              };

              // Add to local state immediately
              addBooking(transformedBooking);

              // Get updated bookings and update React state immediately
              const updatedBookings = getBookings();
              const sortedBookings = [...updatedBookings].sort((a, b) => {
                const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return timeB - timeA; // Newest first
              });

              // Update global state
              setBookings(sortedBookings as any);

              // IMMEDIATELY update local React state variables to trigger instant UI update
              // This ensures the UI updates without waiting for refreshAppointmentLists
              const status = (transformedBooking.status || '').toString().toLowerCase();

              // Update new appointments list immediately if it's a new appointment
              if (status === 'new' || status === 'unassigned' || status === 'pending') {
                setNewAppointments((prev) => {
                  // Check if already exists to avoid duplicates
                  if (prev.some(b => b.id === transformedBooking.id)) {
                    return prev;
                  }
                  // Add to beginning (newest first) and sort
                  const updated = [transformedBooking, ...prev];
                  updated.sort((a, b) => {
                    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                    return timeB - timeA;
                  });
                  return updated;
                });
                setNewAppointmentsCount((prev) => prev + 1);
              }

              // Update upcoming appointments if it's assigned/in progress
              if (status === 'assigned' || status === 'inprogress' || status === 'in_progress') {
                setUpcomingAppointments((prev) => {
                  if (prev.some(b => b.id === transformedBooking.id)) {
                    return prev;
                  }
                  const updated = [transformedBooking, ...prev];
                  updated.sort((a, b) => {
                    const dateA = new Date(a.createdAt || '').getTime();
                    const dateB = new Date(b.createdAt || '').getTime();
                    return dateA - dateB;
                  });
                  return updated.slice(0, 5);
                });

                setActiveAppointments((prev) => {
                  if (prev.some(b => b.id === transformedBooking.id)) {
                    return prev;
                  }
                  const updated = [transformedBooking, ...prev];
                  updated.sort((a, b) => {
                    const dateA = new Date(a.createdAt || '').getTime();
                    const dateB = new Date(b.createdAt || '').getTime();
                    return dateA - dateB;
                  });
                  return updated;
                });
              }

              // Update React component state to trigger immediate re-render
              setBookingsRefreshKey(prev => prev + 1);

              // Also call refreshAppointmentLists to ensure all lists are in sync
              refreshAppointmentLists();

              // Send notification
              pushNotification({
                type: 'booking',
                title: 'New Appointment Request',
                sub: `${transformedBooking.customerName} - Consultation`,
                time: 'Just now',
              });

              console.log('✅ New appointment added and UI updated immediately via service subscription:', transformedBooking);
            } else {
              // Fallback: use the appointment data from the service
              const transformedBooking = {
                id: newAppointment.id,
                customerName: newAppointment.patientName,
                location: newAppointment.location,
                serviceName: newAppointment.serviceName,
                amount: newAppointment.amount,
                paymentMode: newAppointment.paymentMode,
                paymentStatus: newAppointment.paymentStatus || null,
                status: newAppointment.status,
                createdAt: newAppointment.createdAt,
              };

              addBooking(transformedBooking);
              const updatedBookings = getBookings();
              setBookings([...updatedBookings] as any);
              setBookingsRefreshKey(prev => prev + 1);
              refreshAppointmentLists();
            }
          } catch (err) {
            console.error('Error processing new appointment from service subscription:', err);
            // Fallback: use basic appointment data
            const transformedBooking = {
              id: newAppointment.id,
              customerName: newAppointment.patientName,
              location: newAppointment.location,
              serviceName: newAppointment.serviceName,
              amount: newAppointment.amount,
              paymentMode: newAppointment.paymentMode,
              paymentStatus: newAppointment.paymentStatus || null,
              status: newAppointment.status,
              createdAt: newAppointment.createdAt,
            };

            addBooking(transformedBooking);
            const updatedBookings = getBookings();
            setBookings([...updatedBookings] as any);
            setBookingsRefreshKey(prev => prev + 1);
            refreshAppointmentLists();
          }
        }

        // Track analytics
        trackEvent('Doctor Appointment Received from Patient App', {
          appointment_id: newAppointment.id,
          patient_name: newAppointment.patientName,
          symptoms: newAppointment.symptoms,
          consultation_type: newAppointment.consultationType,
        });
      },
      // onUpdateAppointment - when appointment status changes
      (updatedAppointment) => {
        console.log('📝 Appointment updated:', updatedAppointment);
        // Refresh dashboard data
        refreshAppointmentLists();
      },
      // Pass doctor's user ID to subscription
      user?.id
    );

    // Helper function to process and add new booking (defined outside to be accessible)
    // This function immediately updates both global and local React state for instant UI updates
    const processNewBooking = (foundBooking: any) => {
      const dbStatus = (foundBooking.status || '').toString().toLowerCase();
      let normalizedStatus: Booking['status'];

      if (dbStatus === 'pending' || dbStatus === 'new' || dbStatus === 'unassigned') {
        normalizedStatus = 'New';
      } else if (dbStatus === 'confirmed' || dbStatus === 'assigned') {
        normalizedStatus = 'Assigned';
      } else if (dbStatus === 'in_progress' || dbStatus === 'inprogress') {
        normalizedStatus = 'InProgress';
      } else if (dbStatus === 'completed') {
        normalizedStatus = 'Completed';
      } else if (dbStatus === 'cancelled') {
        normalizedStatus = 'Cancelled';
      } else {
        normalizedStatus = 'New';
      }

      // Determine location based on consultation type
      const consultationType = foundBooking.consultation_type || 'In-Person';
      const location = consultationType === 'In-Person'
        ? (foundBooking.address && foundBooking.address.label) || 'In-Person Consultation'
        : consultationType; // 'Video Call' or 'Phone Call'

      const transformedBooking = {
        id: foundBooking.id,
        customerName: foundBooking.patient_name || foundBooking.user_id,
        location: location,
        serviceName: foundBooking.provider_name || '',
        amount: foundBooking.amount ?? foundBooking.total ?? 0,
        paymentMode: foundBooking.payment_mode || '',
        paymentStatus: foundBooking.payment_status || null,
        status: normalizedStatus,
        createdAt: foundBooking.created_at,
        consultationType: consultationType,
        symptoms: foundBooking.symptoms || null,
        appointmentDate: foundBooking.appointment_date || null,
        appointmentTime: foundBooking.appointment_time || null,
      };

      // Add to local state immediately
      addBooking(transformedBooking);

      // Get updated bookings and update React state immediately
      const updatedBookings = getBookings();
      const sortedBookings = [...updatedBookings].sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA; // Newest first
      });

      // Update global state
      setBookings(sortedBookings as any);

      // IMMEDIATELY update local React state variables to trigger instant UI update
      // This ensures the UI updates without waiting for refreshAppointmentLists
      const status = (transformedBooking.status || '').toString().toLowerCase();

      // Update new appointments list immediately if it's a new appointment
      if (status === 'new' || status === 'unassigned' || status === 'pending') {
        setNewAppointments((prev) => {
          // Check if already exists to avoid duplicates
          if (prev.some(b => b.id === transformedBooking.id)) {
            return prev;
          }
          // Add to beginning (newest first) and sort
          const updated = [transformedBooking, ...prev];
          updated.sort((a, b) => {
            const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return timeB - timeA;
          });
          return updated;
        });
        setNewAppointmentsCount((prev) => prev + 1);
      }

      // Update upcoming appointments if it's assigned/in progress
      if (status === 'assigned' || status === 'inprogress' || status === 'in_progress') {
        setUpcomingAppointments((prev) => {
          if (prev.some(b => b.id === transformedBooking.id)) {
            return prev;
          }
          const updated = [transformedBooking, ...prev];
          updated.sort((a, b) => {
            const dateA = new Date(a.createdAt || '').getTime();
            const dateB = new Date(b.createdAt || '').getTime();
            return dateA - dateB;
          });
          return updated.slice(0, 5);
        });

        setActiveAppointments((prev) => {
          if (prev.some(b => b.id === transformedBooking.id)) {
            return prev;
          }
          const updated = [transformedBooking, ...prev];
          updated.sort((a, b) => {
            const dateA = new Date(a.createdAt || '').getTime();
            const dateB = new Date(b.createdAt || '').getTime();
            return dateA - dateB;
          });
          return updated;
        });
      }

      // Update React component state to trigger immediate re-render
      setBookingsRefreshKey(prev => prev + 1);

      // Also call refreshAppointmentLists to ensure all lists are in sync
      refreshAppointmentLists();

      // Send notification
      pushNotification({
        type: 'booking',
        title: 'New Appointment Request',
        sub: `${transformedBooking.customerName} - Consultation`,
        time: 'Just now',
      });

      console.log('✅ New appointment added and UI updated immediately:', transformedBooking);
    };

    // Also set up a direct realtime subscription for better reliability
    // This ensures we catch all new appointments even if the service subscription misses any
    const setupDirectSubscription = async () => {
      try {
        const providerIdStr = String(providerId);

        // Create a direct channel for realtime updates
        directChannel = supabase
          .channel(`doctor_dashboard_direct_${providerId}_${user?.id || 'none'}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'bookings',
              filter: user?.id ? `doctor_user_id=eq.${user.id}` : `provider_id=eq.${providerIdStr}`,
            },
            async (payload) => {
              const newBooking = payload.new;

              console.log('📡 New appointment received via direct realtime subscription:', newBooking);

              // Check if booking already exists to prevent duplicate processing
              const existingBookings = getBookings();
              if (existingBookings.some(b => b.id === newBooking.id)) {
                console.log('⏭️ Booking already processed, skipping duplicate');
                return;
              }

              // Only process if this booking is assigned to this doctor (if doctorUserId is provided)
              if (user?.id && newBooking.doctor_user_id && newBooking.doctor_user_id !== user.id) {
                console.log('⏭️ Skipping appointment - not assigned to this doctor');
                return;
              }

              // Only process if booking belongs to this provider
              if (newBooking.provider_id && String(newBooking.provider_id) !== providerIdStr) {
                console.log('⏭️ Skipping appointment - not for this provider');
                return;
              }

              // Fetch the full booking details immediately
              if (user?.id) {
                try {
                  // Fetch just this specific booking to get complete details
                  const { data: bookingData, error: bookingError } = await supabase
                    .from('bookings')
                    .select(`
                      id,
                      user_id,
                      items,
                      address,
                      schedule,
                      appointment_date,
                      appointment_time,
                      status,
                      total,
                      amount,
                      payment_status,
                      payment_amount,
                      currency,
                      provider_id,
                      provider_service_id,
                      provider_name,
                      doctor_user_id,
                      patient_name,
                      patient_phone,
                      consultation_type,
                      symptoms,
                      created_at,
                      notes
                    `)
                    .eq('id', newBooking.id)
                    .single();

                  if (bookingError || !bookingData) {
                    console.error('Error fetching new booking details:', bookingError);
                    // Fallback: fetch all bookings
                    const doctorBookings = await fetchDoctorBookings(user.id);
                    const foundBooking = doctorBookings.find((b: any) => b.id === newBooking.id);
                    if (foundBooking) {
                      processNewBooking(foundBooking);
                    }
                    return;
                  }

                  // Process the booking immediately
                  processNewBooking(bookingData);

                } catch (err) {
                  console.error('Error processing new booking from direct subscription:', err);
                  // Fallback: try to fetch all bookings
                  try {
                    const doctorBookings = await fetchDoctorBookings(user.id);
                    const foundBooking = doctorBookings.find((b: any) => b.id === newBooking.id);
                    if (foundBooking) {
                      processNewBooking(foundBooking);
                    }
                  } catch (fallbackErr) {
                    console.error('Fallback fetch also failed:', fallbackErr);
                  }
                }
              }
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'bookings',
              filter: user?.id ? `doctor_user_id=eq.${user.id}` : `provider_id=eq.${providerIdStr}`,
            },
            async (payload) => {
              const updatedBooking = payload.new;

              console.log('📡 Appointment update received via direct realtime subscription:', updatedBooking);

              // Only process if this booking is assigned to this doctor (if doctorUserId is provided)
              if (user?.id && updatedBooking.doctor_user_id && updatedBooking.doctor_user_id !== user.id) {
                console.log('⏭️ Skipping appointment update - not assigned to this doctor');
                return;
              }

              // Only process if booking belongs to this provider
              if (updatedBooking.provider_id && String(updatedBooking.provider_id) !== providerIdStr) {
                console.log('⏭️ Skipping appointment update - not for this provider');
                return;
              }

              // Update local state
              const bookings = getBookings();
              const updatedBookings = bookings.map(b => {
                if (b.id === updatedBooking.id) {
                  const dbStatus = (updatedBooking.status || '').toString().toLowerCase();
                  let normalizedStatus: string;

                  if (dbStatus === 'pending' || dbStatus === 'new' || dbStatus === 'unassigned') {
                    normalizedStatus = 'New';
                  } else if (dbStatus === 'confirmed' || dbStatus === 'assigned') {
                    normalizedStatus = 'Assigned';
                  } else if (dbStatus === 'in_progress' || dbStatus === 'inprogress') {
                    normalizedStatus = 'InProgress';
                  } else if (dbStatus === 'completed') {
                    normalizedStatus = 'Completed';
                  } else if (dbStatus === 'cancelled') {
                    normalizedStatus = 'Cancelled';
                  } else {
                    normalizedStatus = b.status || 'New';
                  }

                  // Determine location based on consultation type
                  const consultationType = updatedBooking.consultation_type || b.consultationType || 'In-Person';
                  const location = consultationType === 'In-Person'
                    ? (updatedBooking.address && updatedBooking.address.label) || updatedBooking.location || b.location
                    : consultationType; // 'Video Call' or 'Phone Call'

                  return {
                    ...b,
                    status: normalizedStatus,
                    customerName: updatedBooking.patient_name || updatedBooking.patientName || b.customerName,
                    location: location,
                    serviceName: updatedBooking.provider_name || updatedBooking.serviceName || b.serviceName,
                    amount: updatedBooking.amount ?? updatedBooking.total ?? b.amount,
                    paymentStatus: updatedBooking.payment_status || updatedBooking.paymentStatus || b.paymentStatus || null,
                    consultationType: consultationType,
                    symptoms: updatedBooking.symptoms !== undefined ? updatedBooking.symptoms : b.symptoms,
                    appointmentDate: updatedBooking.appointment_date !== undefined ? updatedBooking.appointment_date : b.appointmentDate,
                    appointmentTime: updatedBooking.appointment_time !== undefined ? updatedBooking.appointment_time : b.appointmentTime,
                  };
                }
                return b;
              });

              setBookings(updatedBookings as any);
              setBookingsRefreshKey(prev => prev + 1);
              refreshAppointmentLists();

              console.log('✅ Appointment updated via direct subscription');
            }
          )
          .subscribe((status) => {
            console.log('📡 Direct realtime subscription status for doctor dashboard:', status);
          });
      } catch (error) {
        console.error('Error setting up direct realtime subscription:', error);
      }
    };

    setupDirectSubscription();

    return () => {
      unsubscribe();
      if (directChannel) {
        supabase.removeChannel(directChannel);
      }
    };
  }, [providerId, providerLoading, user?.id]);

  // Fetch appointments from Supabase on mount and when focused
  // Note: loadAllAppointments is the primary loader that fetches all appointments
  // This useEffect is kept as a fallback for provider-based fetching
  useEffect(() => {
    if (providerLoading) return;

    const loadAppointments = async () => {
      try {
        // Only use this as fallback if we don't have user.id (for doctor-specific fetching)
        if (!providerId || user?.id) return;

        const appointments = await fetchDoctorAppointments(providerId);
        console.log('📋 Loaded appointments from Supabase (fallback):', appointments.length);

        // Update local state
        const transformedAppointments = appointments.map(appt => ({
          id: appt.id,
          customerName: appt.patientName,
          location: appt.location,
          serviceName: appt.serviceName,
          amount: appt.amount,
          paymentMode: appt.paymentMode,
          status: appt.status,
          createdAt: appt.createdAt,
          consultationType: appt.consultationType || 'In-Person',
          symptoms: appt.symptoms || null,
          appointmentDate: appt.appointmentDate || null,
          appointmentTime: appt.appointmentTime || null,
        }));
        setBookings(transformedAppointments);
        setBookingsRefreshKey(prev => prev + 1);

        // Refresh dashboard stats using helper function
        refreshAppointmentLists();
      } catch (error) {
        console.error('Error loading appointments:', error);
      }
    };

    if (isFocused && providerId && !user?.id) {
      loadAppointments();
    }

    // Fetch all appointments (not just new ones) to preserve accepted bookings
    const loadAllAppointments = async () => {
      // Prefer bookings where this doctor is the assigned doctor (doctor_user_id)
      try {
        let allBookings: any[] = [];

        if (user?.id) {
          const doctorBookings = await fetchDoctorBookings(user.id);

          // Map ALL bookings (not just new ones) to preserve accepted bookings
          allBookings = (doctorBookings || []).map((a: any) => {
            // Normalize status from database
            const dbStatus = (a.status || '').toString().toLowerCase();
            let normalizedStatus: string;

            // Map database statuses to app statuses (case-insensitive)
            if (dbStatus === 'pending' || dbStatus === 'new' || dbStatus === 'unassigned') {
              normalizedStatus = 'New';
            } else if (dbStatus === 'confirmed' || dbStatus === 'assigned') {
              normalizedStatus = 'Assigned';
            } else if (dbStatus === 'in_progress' || dbStatus === 'inprogress') {
              normalizedStatus = 'InProgress';
            } else if (dbStatus === 'completed') {
              normalizedStatus = 'Completed';
            } else if (dbStatus === 'cancelled') {
              normalizedStatus = 'Cancelled';
            } else {
              // Default to New for unknown statuses, but preserve original if it looks valid
              const originalStatus = (a.status || '').toString();
              if (['New', 'Assigned', 'InProgress', 'Completed', 'Cancelled'].includes(originalStatus)) {
                normalizedStatus = originalStatus;
              } else {
                normalizedStatus = 'New';
              }
            }

            // Determine location based on consultation type
            const consultationType = a.consultation_type || 'In-Person';
            const location = consultationType === 'In-Person'
              ? (a.address && a.address.label) || a.location || 'In-Person Consultation'
              : consultationType; // 'Video Call' or 'Phone Call'

            // Ensure we preserve appointment_date and appointment_time from the raw data
            const appointmentDate = a.appointment_date || a.appointmentDate || null;
            const appointmentTime = a.appointment_time || a.appointmentTime || null;

            // Check if status is 'accepted' from doctor_appointments table
            const isAccepted = normalizedStatus === 'accepted' || (a as any).originalStatus === 'accepted';

            return {
              id: a.id,
              customerName: a.patient_name || a.patientName || a.user_id,
              location: location,
              serviceName: a.provider_name || a.serviceName || '',
              amount: a.amount ?? a.total ?? 0,
              paymentMode: a.payment_mode || a.paymentMode || '',
              paymentStatus: a.payment_status || a.paymentStatus || null,
              status: isAccepted ? 'Assigned' : normalizedStatus, // Map 'accepted' to 'Assigned' for UI
              originalStatus: isAccepted ? 'accepted' : undefined, // Preserve 'accepted' for filtering
              createdAt: a.created_at || a.createdAt,
              consultationType: consultationType,
              symptoms: a.symptoms || null,
              // Explicitly set both snake_case and camelCase versions
              appointment_date: appointmentDate,
              appointment_time: appointmentTime,
              appointmentDate: appointmentDate,
              appointmentTime: appointmentTime,
            };
          });
        }

        // If no doctor-specific bookings found, fall back to provider_service based fetch
        if (!allBookings.length && providerId) {
          const appointments = await fetchDoctorAppointments(providerId);
          allBookings = (appointments || []).map((a: any) => ({
            id: a.id,
            customerName: a.patientName,
            location: a.location,
            serviceName: a.serviceName,
            amount: a.amount,
            paymentMode: a.paymentMode,
            paymentStatus: a.paymentStatus || a.payment_status || null,
            status: a.status,
            createdAt: a.createdAt,
            consultationType: a.consultationType || 'In-Person',
            symptoms: a.symptoms || null,
            appointmentDate: a.appointmentDate || null,
            appointmentTime: a.appointmentTime || null,
          }));
        }

        // Update all bookings in global state (this preserves accepted bookings)
        if (allBookings.length > 0) {
          const transformedBookings = allBookings.map(b => ({
            ...b, // Spread all fields first to preserve everything including appointment_date/appointment_time
            id: b.id,
            customerName: b.customerName || 'Patient',
            location: b.location || 'In-Person Consultation',
            serviceName: b.serviceName || '',
            amount: b.amount ?? 0,
            paymentMode: b.paymentMode || 'online',
            paymentStatus: b.paymentStatus || b.payment_status || null,
            status: b.status || 'New', // Preserve the status from database
            createdAt: b.createdAt || new Date().toISOString(),
            // Explicitly preserve appointment date/time fields - check all possible property names
            appointmentDate: (b as any).appointmentDate || (b as any).appointment_date || null,
            appointmentTime: (b as any).appointmentTime || (b as any).appointment_time || null,
            appointment_date: (b as any).appointment_date || (b as any).appointmentDate || null,
            appointment_time: (b as any).appointment_time || (b as any).appointmentTime || null,
            consultationType: (b as any).consultationType || (b as any).consultation_type || null,
            symptoms: (b as any).symptoms || null,
          }));

          // Replace all bookings with fresh data from database to ensure status is correct
          setBookings(transformedBookings as any);

          // Sync existing bookings to doctor_appointments table if they don't exist
          // This ensures all bookings assigned to this doctor have records
          if (user?.id) {
            try {
              for (const booking of allBookings) {
                const existingRecord = await DoctorAppointmentsService.getByBookingAndDoctor(
                  booking.id,
                  user.id
                );

                if (!existingRecord) {
                  // Get patient_id from patients table
                  const patient = await PatientsService.getByBookingId(booking.id);
                  // Create record with current status from bookings table
                  const status = (booking.status || 'new').toLowerCase();
                  await DoctorAppointmentsService.create({
                    booking_id: booking.id,
                    doctor_user_id: user.id,
                    status: (status === 'assigned' ? 'assigned' :
                      status === 'in_progress' || status === 'inprogress' ? 'in_progress' :
                        status === 'completed' ? 'completed' :
                          status === 'cancelled' ? 'cancelled' : 'new') as any,
                    patient_id: patient?.id || null,
                  });
                  console.log('✅ Created doctor_appointments record for booking:', booking.id, 'with patient_id:', patient?.id);
                } else if (!existingRecord.patient_id) {
                  // Update existing record if patient_id is missing
                  const patient = await PatientsService.getByBookingId(booking.id);
                  if (patient?.id) {
                    await DoctorAppointmentsService.update(booking.id, user.id, { patient_id: patient.id });
                    console.log('✅ Updated doctor_appointments with patient_id:', patient.id);
                  }
                }
              }
            } catch (syncErr) {
              console.warn('⚠️ Error syncing bookings to doctor_appointments:', syncErr);
              // Don't fail the whole operation if sync fails
            }
          }

          // Trigger refresh of appointment lists after bookings are set
          // This ensures active appointments and patient count are updated immediately
          setBookingsRefreshKey(prev => prev + 1);
        }

        // Filter new appointments separately for the new appointments section
        const newAppts = allBookings.filter(b => {
          const s = (b.status || '').toString().toLowerCase();
          return s === 'new' || s === 'unassigned' || s === 'pending';
        }).map(b => ({
          ...b,
          // Explicitly preserve appointment date/time fields
          appointmentDate: (b as any).appointmentDate || (b as any).appointment_date || null,
          appointmentTime: (b as any).appointmentTime || (b as any).appointment_time || null,
          appointment_date: (b as any).appointment_date || (b as any).appointmentDate || null,
          appointment_time: (b as any).appointment_time || (b as any).appointmentTime || null,
        }));

        setNewAppointments(newAppts);
        setNewAppointmentsCount(newAppts.length);

        // Call refreshAppointmentLists to update active appointments and patient count
        // This reads from getBookings() which now has the fresh data, so it's safe
        refreshAppointmentLists();
      } catch (err) {
        console.error('Error loading all appointments (doctor-based):', err);
        // Fallback to provider-based fetch if anything fails
        try {
          const appointments = providerId ? await fetchDoctorAppointments(providerId) : [];
          const allBookings = (appointments || []).map((a: any) => ({
            id: a.id,
            customerName: a.patientName,
            location: a.location,
            serviceName: a.serviceName,
            amount: a.amount,
            paymentMode: a.paymentMode,
            status: a.status,
            createdAt: a.createdAt,
            consultationType: a.consultationType || 'In-Person',
            symptoms: a.symptoms || null,
            appointmentDate: a.appointmentDate || null,
            appointmentTime: a.appointmentTime || null,
          }));

          if (allBookings.length > 0) {
            setBookings(allBookings as any);
            // Trigger refresh of appointment lists after bookings are set
            setBookingsRefreshKey(prev => prev + 1);
          }

          // Filter new appointments and preserve all fields including appointmentDate/appointmentTime
          const newAppts = allBookings.filter(b => {
            const s = (b.status || '').toString().toLowerCase();
            return s === 'new' || s === 'unassigned' || s === 'pending';
          }).map(b => ({
            ...b,
            // Explicitly preserve appointment date/time fields
            appointmentDate: (b as any).appointmentDate || (b as any).appointment_date || null,
            appointmentTime: (b as any).appointmentTime || (b as any).appointment_time || null,
            appointment_date: (b as any).appointment_date || (b as any).appointmentDate || null,
            appointment_time: (b as any).appointment_time || (b as any).appointmentTime || null,
          }));
          setNewAppointments(newAppts);
          setNewAppointmentsCount(newAppts.length);

          refreshAppointmentLists();
        } catch (e) {
          console.error('Fallback fetchDoctorAppointments failed:', e);
          refreshAppointmentLists();
        }
      }
    };

    // Always load appointments on mount and when dependencies change
    // This ensures data is loaded even on initial mount
    loadAllAppointments();
  }, [isFocused, providerId, providerLoading, user?.id]);

  // Watch for bookings changes and refresh appointment lists
  // This ensures that when new bookings are added via subscription, the UI updates immediately
  useEffect(() => {
    refreshAppointmentLists();
  }, [bookingsRefreshKey]);

  // Fetch doctor reviews and calculate average rating
  const fetchDoctorReviews = async (doctorUserId: string) => {
    try {
      console.log('🔍 Fetching reviews for doctor_id:', doctorUserId);

      // First, verify the user is authenticated
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      if (authError || !authUser) {
        console.error('❌ Authentication error:', authError);
        return 0;
      }
      console.log('✅ Authenticated user:', authUser.id);

      // Query reviews table - try with explicit RLS bypass check
      const { data, error } = await supabase
        .from('reviews')
        .select('rating, doctor_id, id')
        .eq('doctor_id', doctorUserId);

      if (error) {
        console.error('❌ Error fetching doctor reviews:', error);
        console.error('❌ Error details:', JSON.stringify(error, null, 2));

        // Try a different approach - query all reviews and filter client-side
        console.log('🔄 Trying alternative approach: fetching all reviews...');
        const { data: allReviews, error: allError } = await supabase
          .from('reviews')
          .select('rating, doctor_id, id');

        if (allError) {
          console.error('❌ Error fetching all reviews:', allError);
        } else {
          console.log('📋 All reviews fetched:', allReviews?.length || 0);
          if (allReviews && allReviews.length > 0) {
            console.log('📝 Sample reviews:', allReviews.slice(0, 3));
            // Filter client-side
            const doctorReviews = allReviews.filter(r => r.doctor_id === doctorUserId);
            console.log('🔍 Filtered doctor reviews:', doctorReviews.length);

            if (doctorReviews.length > 0) {
              const sum = doctorReviews.reduce((acc, review) => acc + (review.rating || 0), 0);
              const average = sum / doctorReviews.length;
              const roundedAverage = Math.round(average * 10) / 10;
              console.log('✅ Average rating calculated (client-side filter):', roundedAverage);
              return roundedAverage;
            }
          }
        }
        return 0;
      }

      console.log('📊 Reviews fetched:', data?.length || 0, 'reviews found');
      if (data && data.length > 0) {
        console.log('📝 Review data:', data);
      } else {
        console.log('⚠️ No reviews found directly. Trying via bookings table...');

        // Fallback: Get reviews via bookings table (doctor can access their bookings)
        try {
          const { data: bookings, error: bookingsError } = await supabase
            .from('bookings')
            .select('id')
            .eq('doctor_user_id', doctorUserId);

          if (!bookingsError && bookings && bookings.length > 0) {
            const bookingIds = bookings.map(b => b.id);
            console.log('📋 Found', bookingIds.length, 'bookings for this doctor');

            // Get reviews by booking_id
            const { data: reviewsByBooking, error: reviewsError } = await supabase
              .from('reviews')
              .select('rating, doctor_id, booking_id')
              .in('booking_id', bookingIds);

            if (!reviewsError && reviewsByBooking && reviewsByBooking.length > 0) {
              console.log('✅ Found reviews via bookings:', reviewsByBooking.length);
              console.log('📝 Reviews data:', reviewsByBooking);

              // Filter to only this doctor's reviews (in case of multiple doctors)
              const doctorReviews = reviewsByBooking.filter(r =>
                r.doctor_id === doctorUserId || !r.doctor_id
              );

              if (doctorReviews.length > 0) {
                const sum = doctorReviews.reduce((acc, review) => acc + (review.rating || 0), 0);
                const average = sum / doctorReviews.length;
                const roundedAverage = Math.round(average * 10) / 10;
                console.log('✅ Average rating (via bookings):', roundedAverage, 'from', doctorReviews.length, 'reviews');
                return roundedAverage;
              }
            } else if (reviewsError) {
              console.error('❌ Error fetching reviews via bookings:', reviewsError);
            } else {
              console.log('⚠️ No reviews found via bookings either');
            }
          } else if (bookingsError) {
            console.error('❌ Error fetching bookings:', bookingsError);
          }
        } catch (fallbackErr) {
          console.error('❌ Exception in fallback query:', fallbackErr);
        }
      }

      if (!data || data.length === 0) {
        return 0;
      }

      // Calculate average rating
      const sum = data.reduce((acc, review) => acc + (review.rating || 0), 0);
      const average = sum / data.length;
      const roundedAverage = Math.round(average * 10) / 10;

      console.log('✅ Average rating calculated:', roundedAverage, 'from', data.length, 'reviews');

      // Round to 1 decimal place
      return roundedAverage;
    } catch (err) {
      console.error('❌ Exception fetching doctor reviews:', err);
      return 0;
    }
  };

  // Load online status from database on mount and when screen is focused
  useEffect(() => {
    const loadOnlineStatusFromDatabase = async () => {
      if (!user?.id) return;

      try {
        const { data, error } = await supabase
          .from('providers_doctor_details')
          .select('is_online')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!error && data !== null) {
          const dbOnlineStatus = data.is_online === true;
          // Update both state and AsyncStorage with database value
          setIsOnline(dbOnlineStatus);
          await setOnlineStatus(dbOnlineStatus);
          console.log('✅ Loaded online status from database:', dbOnlineStatus);
        } else if (error) {
          console.warn('⚠️ Could not load online status from database, using local storage:', error);
          // Fallback to local storage if database query fails
          setIsOnline(getOnlineStatus());
        } else {
          // No record found, use local storage value
          setIsOnline(getOnlineStatus());
        }
      } catch (err) {
        console.error('❌ Exception loading online status from database:', err);
        // Fallback to local storage on error
        setIsOnline(getOnlineStatus());
      }
    };

    const loadDoctorRating = async () => {
      if (user?.id) {
        console.log('👤 Current user.id:', user.id);
        const rating = await fetchDoctorReviews(user.id);
        console.log('⭐ Setting average rating to:', rating);
        setAverageRating(rating);
      } else {
        console.warn('⚠️ No user.id available for fetching reviews');
      }
    };

    if (isFocused) {
      setBrandName(getCompanyInfo().companyName || 'Fixit Partner');
      loadOnlineStatusFromDatabase();
      loadDoctorRating();
      const es = getEarningsSummary();
      setTodayEarnings(es.todayAmount);
      setTodayCompletedCount(es.todayCompletedCount);
      setWeeklyAmount(es.weeklyAmount);
      setAcceptancePct(es.acceptancePct);
      setNotificationCount(getNotifications().length);

      // Use the helper function to refresh appointment lists
      refreshAppointmentLists();
    }
  }, [isFocused, user?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      setBrandName(getCompanyInfo().companyName || 'Fixit Partner');

      // Load online status from database during refresh
      if (user?.id) {
        try {
          const { data, error } = await supabase
            .from('providers_doctor_details')
            .select('is_online')
            .eq('user_id', user.id)
            .maybeSingle();

          if (!error && data !== null) {
            const dbOnlineStatus = data.is_online === true;
            setIsOnline(dbOnlineStatus);
            await setOnlineStatus(dbOnlineStatus);
          } else {
            setIsOnline(getOnlineStatus());
          }

          // Refresh doctor rating
          const rating = await fetchDoctorReviews(user.id);
          setAverageRating(rating);
        } catch (err) {
          console.error('❌ Exception loading online status during refresh:', err);
          setIsOnline(getOnlineStatus());
        }
      } else {
        setIsOnline(getOnlineStatus());
      }

      const es = getEarningsSummary();
      setTodayEarnings(es.todayAmount);
      setTodayCompletedCount(es.todayCompletedCount);
      setWeeklyAmount(es.weeklyAmount);
      setAcceptancePct(es.acceptancePct);
      setNotificationCount(getNotifications().length);

      refreshAppointmentLists();
    } finally {
      setTimeout(() => setRefreshing(false), 400);
    }
  };

  const showOfflineNotice = () => {
    setOfflineNoticeVisible(true);
    Animated.timing(offlineNoticeY, { toValue: 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    setTimeout(() => {
      Animated.timing(offlineNoticeY, { toValue: -80, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => setOfflineNoticeVisible(false));
    }, 3000);
  };

  const styles = useMemo(() => StyleSheet.create({
    root: { flex: 1 },
    scrollContent: { paddingBottom: moderateScale(72), paddingTop: moderateScale(8) },
    collapsibleHeader: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 1000,
      minHeight: moderateScale(160),
    },
    brandName: { color: '#ffffff', fontSize: moderateScale(22), fontWeight: '800' },
    bellWrap: { width: moderateScale(32), height: moderateScale(32), borderRadius: moderateScale(16), backgroundColor: '#13235d', alignItems: 'center', justifyContent: 'center', marginRight: moderateScale(12), position: 'relative' },
    badge: { position: 'absolute', top: -6, right: -6, backgroundColor: '#3B5BFD', borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 },
    badgeText: { color: '#ffffff', fontSize: 10, fontWeight: '700' },
    knobToggle: { marginTop: moderateScale(8), backgroundColor: '#ff3b30', borderRadius: moderateScale(16), height: moderateScale(28), width: moderateScale(100), alignItems: 'center', justifyContent: 'center', position: 'relative' },
    knobToggleOnline: { backgroundColor: '#26e07f' },
    knobToggleOffline: { backgroundColor: '#ff3b30' },
    knobToggleLabel: { color: '#ffffff', fontWeight: '900', fontSize: moderateScale(10), lineHeight: moderateScale(16) },
    knob: { position: 'absolute', top: moderateScale(4), width: moderateScale(20), height: moderateScale(20), borderRadius: moderateScale(10), backgroundColor: '#ffffff' },
    knobLeft: { left: moderateScale(4) },
    knobRight: { right: moderateScale(4) },
    earningsCardWhite: { backgroundColor: '#ffffff', borderRadius: moderateScale(14), padding: moderateScale(14), flexDirection: 'row', alignItems: 'center', marginBottom: moderateScale(12) },
    cardTitleDark: { color: '#111827', fontWeight: '600' },
    cardAmountBlue: { color: '#3B5BFD', fontSize: moderateScale(28), fontWeight: '800', marginTop: moderateScale(8) },
    cardMetaDark: { color: '#374151', marginTop: moderateScale(6) },
    walletCircle: { width: moderateScale(44), height: moderateScale(44), borderRadius: moderateScale(22), backgroundColor: '#3B5BFD', alignItems: 'center', justifyContent: 'center' },
    viewDetailsInside: { position: 'absolute', right: moderateScale(16), bottom: moderateScale(12) },
    viewDetailsDark: { color: '#3B5BFD', fontWeight: '700' },
    sectionHeader: { color: '#ffffff', fontWeight: '700', marginTop: moderateScale(6), marginBottom: moderateScale(12), fontSize: moderateScale(17) },
    insightsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: moderateScale(14) },
    tile: { backgroundColor: '#ffffff', borderRadius: moderateScale(14), padding: moderateScale(12), width: '31%', alignItems: 'flex-start' },
    tileValue: { color: '#111827', fontWeight: '700', marginTop: moderateScale(12) },
    tileLabel: { color: '#6B7280', marginTop: moderateScale(8) },
    cardShadow: { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
    noticeBanner: { position: 'absolute', left: 16, right: 16, top: '35%', backgroundColor: '#0b1f66', borderColor: '#2a3e85', borderWidth: 1.4, borderRadius: 22, paddingVertical: 24, paddingHorizontal: 20 },
    noticeHeaderRow: { flexDirection: 'row', alignItems: 'center' },
    noticeTitle: { color: '#ffffff', fontWeight: '900', marginLeft: 12, fontSize: moderateScale(20) },
    noticeSub: { color: '#cfe0ff', marginTop: 12, fontSize: moderateScale(14) },
    noticeActionsRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 },
    noticeBtnOutline: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1, borderColor: '#3b5bfd', marginRight: 12 },
    noticeBtnOutlineText: { color: '#cfe0ff', fontWeight: '800' },
    noticeBtnFill: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 14, backgroundColor: '#3b5bfd' },
    noticeBtnFillText: { color: '#ffffff', fontWeight: '800' },

  }), []);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={sectorGradient[0]} translucent />
      <SafeAreaView style={{ backgroundColor: sectorGradient[0], height: insets.top }} />
      {doctorSpecialty && (
        <View style={{ padding: 16, alignItems: 'center' }}>
          <Text style={{ fontWeight: 'bold', color: '#1c326e', fontSize: 18 }}>Specialty: {doctorSpecialty.charAt(0).toUpperCase() + doctorSpecialty.slice(1)}</Text>
        </View>
      )}

      {/* Fixed Header */}
      <Animated.View
        style={[styles.collapsibleHeader, { paddingTop: 0, paddingBottom: moderateScale(12) }]}
      >
        <GradientHeader
          gradientColors={sectorGradient}
          minHeight={headerHeight}
          left={
            <View>
              <Text style={styles.brandName}>{brandName}</Text>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={async () => {
                  const next = !isOnline;

                  // Update local state immediately for responsive UI
                  setIsOnline(next);
                  await setOnlineStatus(next);

                  // Save to database - this is the source of truth
                  try {
                    if (user?.id) {
                      const { error } = await supabase
                        .from('providers_doctor_details')
                        .update({ is_online: next })
                        .eq('user_id', user.id);

                      if (error) {
                        console.error('❌ Failed to update online status in database:', error);
                        // Revert local state if database update fails
                        setIsOnline(!next);
                        await setOnlineStatus(!next);
                        Alert.alert('Error', 'Failed to update online status. Please try again.');
                      } else {
                        console.log('✅ Online status saved to database:', next);
                      }
                    }
                  } catch (e) {
                    console.error('❌ Exception updating online status in database:', e);
                    // Revert local state if database update fails
                    setIsOnline(!next);
                    await setOnlineStatus(!next);
                    Alert.alert('Error', 'Failed to update online status. Please try again.');
                  }
                }}
                style={[
                  styles.knobToggle,
                  isOnline ? styles.knobToggleOnline : styles.knobToggleOffline,
                ]}
              >
                <Text style={styles.knobToggleLabel}>
                  {isOnline ? 'Online' : 'Offline'}
                </Text>
                <View style={[styles.knob, isOnline ? styles.knobRight : styles.knobLeft]} />
              </TouchableOpacity>
            </View>
          }
          right={
            <View style={{ alignItems: 'flex-end' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TouchableOpacity onPress={() => navigation.navigate('Notifications')} style={[styles.bellWrap, { backgroundColor: '#13235d' }]} activeOpacity={0.85}>
                  <Ionicons name="notifications" size={moderateScale(18)} color="#ffffff" />
                  {notificationCount > 0 ? (
                    <View style={styles.badge}><Text style={styles.badgeText}>{Math.min(99, notificationCount)}</Text></View>
                  ) : null}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
                  <Ionicons name="person-circle" size={moderateScale(34)} color="#cfe0ff" />
                </TouchableOpacity>
              </View>
            </View>
          }
          title={undefined as any}
        />
      </Animated.View>

      {/* Scrollable Content */}
      <Animated.ScrollView
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.scrollContent, {
          paddingTop: headerHeight + moderateScale(2),
          paddingHorizontal: moderateScale(16),
          paddingBottom: Math.max(moderateScale(120), (insets.bottom || 0) + moderateScale(24)),
        }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#2B49C3"
            colors={['#2B49C3']}
            progressBackgroundColor="#ffffff"
          />
        }
      >
        {/* New Appointments Section */}
        <View style={{ marginTop: moderateScale(-24), marginBottom: moderateScale(16) }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: moderateScale(12) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>

              <Text style={{ fontWeight: '900', fontSize: moderateScale(18), color: '#1e2a54' }}>
                New Appointments ({newAppointmentsCount})
              </Text>
            </View>
            {newAppointmentsCount > 0 && (
              <TouchableOpacity onPress={() => (navigation as any).navigate('Bookings', { tab: 'New' })} activeOpacity={0.7}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ color: '#2B49C3', fontWeight: '800', fontSize: moderateScale(13), marginRight: moderateScale(4) }}>
                    View All
                  </Text>
                  <Ionicons name={'chevron-forward'} size={moderateScale(16)} color={'#2B49C3'} />
                </View>
              </TouchableOpacity>
            )}
          </View>

          {newAppointmentsCount > 0 ? (
            <>
              {/* Always show up to 3 cards */}
              {newAppointments.slice(0, 3).map((appt, idx) => {
                // Get appointment date and time from the booking - check both camelCase and snake_case (same as modal)
                const appointmentDate = (appt as any).appointmentDate
                  || (appt as any).appointment_date
                  || (appt as any)['appointment_date']
                  || null;
                const appointmentTime = (appt as any).appointmentTime
                  || (appt as any).appointment_time
                  || (appt as any)['appointment_time']
                  || null;

                // Use appointment_date/appointment_time if available, otherwise fall back to createdAt (same logic as modal)
                let apptDate: Date;
                let timeStr: string;
                let dateStr: string;

                if (appointmentDate) {
                  // Parse appointment_date (could be ISO string or date string)
                  // Handle timezone issues by extracting just the date part
                  let dateToParse = appointmentDate;
                  if (typeof appointmentDate === 'string' && appointmentDate.includes('T')) {
                    // ISO format - extract date part only to avoid timezone issues
                    dateToParse = appointmentDate.split('T')[0];
                  } else if (typeof appointmentDate === 'string' && appointmentDate.includes(' ')) {
                    // Format like "2025-12-25 00:00:00+00" - extract date part
                    dateToParse = appointmentDate.split(' ')[0];
                  }

                  apptDate = new Date(dateToParse + 'T00:00:00'); // Set to midnight to avoid timezone issues

                  // Check if date is valid
                  if (isNaN(apptDate.getTime())) {
                    console.warn('⚠️ Invalid appointment date, falling back to createdAt:', appointmentDate);
                    apptDate = appt.createdAt ? new Date(appt.createdAt) : new Date();
                  }

                  const isToday = apptDate.toDateString() === new Date().toDateString();
                  const tomorrow = new Date();
                  tomorrow.setDate(tomorrow.getDate() + 1);
                  const isTomorrow = apptDate.toDateString() === tomorrow.toDateString();

                  // Format date
                  if (isToday) {
                    dateStr = 'Today';
                  } else if (isTomorrow) {
                    dateStr = 'Tomorrow';
                  } else {
                    dateStr = apptDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  }

                  // Use appointment_time if available, otherwise format from appointment_date
                  if (appointmentTime && appointmentTime.trim() !== '') {
                    timeStr = appointmentTime.trim(); // Use as-is (e.g., "4:00 PM")
                  } else {
                    timeStr = apptDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                  }
                } else {
                  // Fall back to createdAt
                  console.warn('⚠️ No appointment date found, using createdAt for:', appt.id);
                  apptDate = appt.createdAt ? new Date(appt.createdAt) : new Date();
                  const isToday = apptDate.toDateString() === new Date().toDateString();
                  timeStr = apptDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                  dateStr = isToday ? 'Today' : apptDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                }

                const amount = typeof appt.amount === 'number' ? appt.amount : (typeof appt.amount === 'string' ? parseFloat(appt.amount) || 0 : 0);

                // Get consultation type - prefer consultationType field, otherwise use location
                const consultationType = (appt as any).consultationType || (appt.location === 'Video Call' ? 'Video Call' : appt.location === 'Phone Call' ? 'Phone Call' : 'In-Person');

                return (
                  <TouchableOpacity
                    key={appt.id || idx}
                    style={{
                      backgroundColor: '#ffffff',
                      borderRadius: moderateScale(16),
                      padding: moderateScale(14),
                      marginBottom: moderateScale(12),
                      shadowColor: '#000',
                      shadowOpacity: 0.08,
                      shadowRadius: 16,
                      shadowOffset: { width: 0, height: 4 },
                      elevation: 4,
                      borderWidth: 1,
                      borderColor: '#f0f4ff',
                    }}
                    onPress={() => {
                      try {
                        (navigation as any).navigate('DoctorAppointmentDetails', { appointmentId: appt.id });
                      } catch (error) {
                        console.error('Navigation error:', error);
                      }
                    }}
                    activeOpacity={0.9}
                  >
                    {/* Header with Status Badge */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: moderateScale(10) }}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: moderateScale(4) }}>
                          <View style={{
                            backgroundColor: '#fff5f5',
                            paddingHorizontal: moderateScale(8),
                            paddingVertical: moderateScale(3),
                            borderRadius: moderateScale(6),
                            marginRight: moderateScale(6),
                          }}>
                            <Text style={{ color: '#FF3B30', fontWeight: '800', fontSize: moderateScale(9), letterSpacing: 0.5 }}>
                              NEW
                            </Text>
                          </View>
                          <Text style={{ fontWeight: '900', fontSize: moderateScale(17), color: '#1e2a54', letterSpacing: -0.3 }}>
                            {appt.customerName || 'Unknown'}
                          </Text>
                        </View>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <View style={{
                          backgroundColor: '#f0f9ff',
                          paddingHorizontal: moderateScale(10),
                          paddingVertical: moderateScale(6),
                          borderRadius: moderateScale(10),
                          borderWidth: 1,
                          borderColor: '#e0f2fe',
                          marginBottom: moderateScale(4),
                        }}>
                          <Text style={{ fontWeight: '900', fontSize: moderateScale(16), color: '#0b1960' }}>
                            ₹{amount.toFixed(0)}
                          </Text>
                        </View>
                        {appt.paymentStatus && (
                          <View style={{
                            backgroundColor: appt.paymentStatus === 'paid' ? '#e8f5e9' :
                              appt.paymentStatus === 'pending' ? '#fff4e6' :
                                appt.paymentStatus === 'failed' ? '#ffebee' : '#f3f4f6',
                            paddingHorizontal: moderateScale(8),
                            paddingVertical: moderateScale(3),
                            borderRadius: moderateScale(6),
                          }}>
                            <Text style={{
                              color: appt.paymentStatus === 'paid' ? '#26e07f' :
                                appt.paymentStatus === 'pending' ? '#FF9500' :
                                  appt.paymentStatus === 'failed' ? '#FF3B30' : '#6b748f',
                              fontSize: moderateScale(10),
                              fontWeight: '700',
                              textTransform: 'capitalize',
                            }}>
                              {appt.paymentStatus}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Details Section */}
                    <View style={{
                      backgroundColor: '#fafbfc',
                      borderRadius: moderateScale(12),
                      padding: moderateScale(10),
                      marginBottom: moderateScale(10),
                    }}>
                      {/* Appointment Time Section */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: moderateScale(8) }}>
                        <View style={{
                          width: moderateScale(32),
                          height: moderateScale(32),
                          borderRadius: moderateScale(16),
                          backgroundColor: '#fff',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: moderateScale(10),
                          shadowColor: '#000',
                          shadowOpacity: 0.05,
                          shadowRadius: 3,
                          shadowOffset: { width: 0, height: 2 },
                          elevation: 2,
                        }}>
                          <Ionicons name="calendar" size={moderateScale(16)} color="#2B49C3" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: '#6b748f', fontSize: moderateScale(10), fontWeight: '600', marginBottom: moderateScale(1), textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            Appointment Time
                          </Text>
                          <Text style={{ color: '#1e2a54', fontSize: moderateScale(13), fontWeight: '700' }}>
                            {dateStr} • {timeStr}
                          </Text>
                        </View>
                      </View>

                      <View style={{
                        height: 1,
                        backgroundColor: '#e5e7eb',
                        marginVertical: moderateScale(6),
                        marginLeft: moderateScale(42),
                      }} />

                      {/* Consultation Type Section */}
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{
                          width: moderateScale(32),
                          height: moderateScale(32),
                          borderRadius: moderateScale(16),
                          backgroundColor: '#fff',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: moderateScale(10),
                          shadowColor: '#000',
                          shadowOpacity: 0.05,
                          shadowRadius: 3,
                          shadowOffset: { width: 0, height: 2 },
                          elevation: 2,
                        }}>
                          <Ionicons name="location" size={moderateScale(16)} color="#26A69A" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: '#6b748f', fontSize: moderateScale(10), fontWeight: '600', marginBottom: moderateScale(1), textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            Consultation Type
                          </Text>
                          <Text style={{ color: '#1e2a54', fontSize: moderateScale(13), fontWeight: '700' }}>
                            {consultationType}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Action Buttons */}
                    <View style={{ flexDirection: 'row', gap: moderateScale(10) }}>
                      <TouchableOpacity
                        style={{
                          flex: 1,
                          backgroundColor: '#ffffff',
                          borderRadius: moderateScale(12),
                          paddingVertical: moderateScale(11),
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderWidth: 2,
                          borderColor: '#fee2e2',
                          flexDirection: 'row',
                          shadowColor: '#FF3B30',
                          shadowOpacity: 0.1,
                          shadowRadius: 6,
                          shadowOffset: { width: 0, height: 3 },
                          elevation: 2,
                        }}
                        onPress={async (e) => {
                          e.stopPropagation();
                          const res = await updateBookingStatusRemote(appt.id, 'Rejected');
                          if (res.success) {
                            updateBookingStatus(appt.id, 'Cancelled');
                            trackEvent('Doctor Appointment Rejected', {
                              appointment_id: appt.id,
                              patient_name: appt.customerName,
                              appointment_amount: appt.amount,
                              appointment_location: appt.location,
                            });
                            // Immediately update local state to remove from new appointments
                            refreshAppointmentLists();
                          } else {
                            Alert.alert('Error', 'Failed to reject booking. Please try again.');
                          }
                        }}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="close-circle" size={moderateScale(16)} color="#FF3B30" style={{ marginRight: moderateScale(5) }} />
                        <Text style={{ color: '#FF3B30', fontWeight: '800', fontSize: moderateScale(13) }}>Reject</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{
                          flex: 1,
                          backgroundColor: '#26A69A',
                          borderRadius: moderateScale(12),
                          paddingVertical: moderateScale(11),
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexDirection: 'row',
                          shadowColor: '#26A69A',
                          shadowOpacity: 0.3,
                          shadowRadius: 10,
                          shadowOffset: { width: 0, height: 4 },
                          elevation: 3,
                        }}
                        onPress={async (e) => {
                          e.stopPropagation();
                          const res = await updateBookingStatusRemote(appt.id, 'Accepted');
                          if (res.success) {
                            // Update local booking status to 'Assigned' for UI, but preserve 'accepted' in doctor_appointments
                            updateBookingStatus(appt.id, 'Assigned');

                            // Update the booking object to include originalStatus for filtering
                            const updatedBookings = getBookings().map(b => {
                              if (b.id === appt.id) {
                                return {
                                  ...b,
                                  status: 'Assigned' as any,
                                  originalStatus: 'accepted',
                                };
                              }
                              return b;
                            });
                            setBookings(updatedBookings);

                            trackEvent('Doctor Appointment Accepted', {
                              appointment_id: appt.id,
                              patient_name: appt.customerName,
                              appointment_amount: appt.amount,
                              appointment_location: appt.location,
                              service_name: appt.serviceName,
                            });
                            // Immediately update local state to move from new to active appointments
                            refreshAppointmentLists();
                          } else {
                            Alert.alert('Error', 'Failed to accept booking. Please try again.');
                          }
                        }}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="checkmark-circle" size={moderateScale(16)} color="#ffffff" style={{ marginRight: moderateScale(5) }} />
                        <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: moderateScale(13) }}>Accept</Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })}

              {newAppointmentsCount > 3 && (
                <TouchableOpacity
                  style={{
                    marginTop: moderateScale(8),
                    paddingVertical: moderateScale(12),
                    alignItems: 'center',
                    backgroundColor: '#f7faff',
                    borderRadius: moderateScale(12),
                  }}
                  onPress={() => (navigation as any).navigate('Bookings', { tab: 'New' })}
                  activeOpacity={0.8}
                >
                  <Text style={{ color: '#2B49C3', fontSize: moderateScale(13), fontWeight: '800' }}>
                    View {newAppointmentsCount - 3} more appointment{newAppointmentsCount - 3 > 1 ? 's' : ''} →
                  </Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <View style={{
              backgroundColor: '#ffffff',
              borderRadius: moderateScale(18),
              padding: moderateScale(40),
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: '#f0f4ff',
              shadowColor: '#00197322',
              shadowOpacity: 0.08,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 4 },
              elevation: 2
            }}>
              <View style={{
                width: moderateScale(64),
                height: moderateScale(64),
                borderRadius: moderateScale(32),
                backgroundColor: '#f8f9ff',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: moderateScale(16)
              }}>
                <Ionicons name="calendar-outline" size={moderateScale(32)} color="#9aa3bd" />
              </View>
              <Text style={{
                fontWeight: '800',
                fontSize: moderateScale(16),
                color: '#1e2a54',
                marginBottom: moderateScale(8)
              }}>
                No New Appointments
              </Text>
              <Text style={{
                color: '#6b748f',
                fontSize: moderateScale(13),
                fontWeight: '600',
                textAlign: 'center'
              }}>
                New appointment requests will appear here
              </Text>
            </View>
          )}
        </View>

        {/* My Patients Card */}
        <View style={{ marginBottom: moderateScale(16) }}>
          <TouchableOpacity
            style={{
              backgroundColor: '#ffffff',
              borderRadius: moderateScale(18),
              paddingVertical: moderateScale(20),
              paddingHorizontal: moderateScale(20),
              flexDirection: 'row',
              alignItems: 'center',
              shadowColor: '#00197322',
              shadowOpacity: 0.1,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 4 },
              elevation: 3,
              borderWidth: 1,
              borderColor: '#f0f4ff',
            }}
            onPress={() => (navigation as any).navigate('MyPatients')}
            activeOpacity={0.8}
          >
            <View style={{
              width: moderateScale(64),
              height: moderateScale(64),
              borderRadius: moderateScale(32),
              backgroundColor: '#fff8f0',
              justifyContent: 'center',
              alignItems: 'center',
              marginRight: moderateScale(16),
              borderWidth: 2,
              borderColor: '#ffe8cc',
            }}>
              <Ionicons name="people" size={moderateScale(32)} color="#FF9500" />
            </View>
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <Text style={{
                color: '#1e2a54',
                fontSize: moderateScale(18),
                fontWeight: '900',
                marginBottom: moderateScale(6)
              }}>
                My Patients
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                <View style={{
                  backgroundColor: '#fff3e0',
                  borderRadius: moderateScale(12),
                  paddingHorizontal: moderateScale(10),
                  paddingVertical: moderateScale(4),
                  marginRight: moderateScale(8),
                  marginBottom: moderateScale(4),
                }}>
                  <Text style={{
                    color: '#FF9500',
                    fontSize: moderateScale(14),
                    fontWeight: '800'
                  }}>
                    {totalPatientsCount} {totalPatientsCount === 1 ? 'Patient' : 'Patients'}
                  </Text>
                </View>
                <Text style={{
                  color: '#6b748f',
                  fontSize: moderateScale(12),
                  fontWeight: '600',
                  marginBottom: moderateScale(4),
                }}>
                  View all patients →
                </Text>
              </View>
            </View>
            <View style={{
              width: moderateScale(40),
              height: moderateScale(40),
              borderRadius: moderateScale(20),
              backgroundColor: '#fff8f0',
              justifyContent: 'center',
              alignItems: 'center',
              marginLeft: moderateScale(8),
            }}>
              <Ionicons name="chevron-forward" size={moderateScale(20)} color="#FF9500" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Performance Insights and Today's Earnings */}
        <Text style={[styles.sectionHeader, { color: colors.text, marginTop: moderateScale(8) }]}>Performance Insights</Text>
        <View style={[styles.insightsRow, { columnGap: gap, marginBottom: moderateScale(14) }]}>
          <TouchableOpacity
            style={[styles.tile, styles.cardShadow, { width: singleTileWidth, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
            onPress={() => (navigation as any).navigate('DoctorWeeklyPerformance')}
            activeOpacity={0.7}
          >
            <Ionicons name="pulse-outline" size={moderateScale(22)} color="#3B5BFD" />
            <Text style={[styles.tileValue, { color: colors.text }]}>₹{weeklyAmount}</Text>
            <Text style={[styles.tileLabel, { color: colors.textSecondary }]}>Weekly</Text>
          </TouchableOpacity>
          <View style={[styles.tile, styles.cardShadow, { width: singleTileWidth, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
            <Ionicons name="checkmark-done-outline" size={moderateScale(22)} color="#3B5BFD" />
            <Text style={[styles.tileValue, { color: colors.text }]}>{acceptancePct}%</Text>
            <Text style={[styles.tileLabel, { color: colors.textSecondary }]}>Acceptance</Text>
          </View>
          <TouchableOpacity
            style={[styles.tile, styles.cardShadow, { width: singleTileWidth, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
            onPress={() => (navigation as any).navigate('DoctorReviews')}
            activeOpacity={0.7}
          >
            <Ionicons name="star" size={moderateScale(22)} color="#F5B700" />
            <Text style={[styles.tileValue, { color: colors.text }]}>
              {averageRating > 0 ? `${averageRating.toFixed(1)}/5` : '0/5'}
            </Text>
            <Text style={[styles.tileLabel, { color: colors.textSecondary }]}>Rating</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.earningsCardWhite, styles.cardShadow, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, marginBottom: moderateScale(16) }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitleDark, { color: colors.text }]}>Today's Earnings</Text>
            <Text style={[styles.cardAmountBlue, { color: '#0b1960' }]}>₹{todayEarnings}</Text>
            <Text style={[styles.cardMetaDark, { color: colors.textSecondary }]}>{todayCompletedCount} Consultations Completed</Text>
          </View>
          <LinearGradient colors={sectorGradient} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={[styles.walletCircle, { alignItems: 'center', justifyContent: 'center' }]}>
            <TouchableOpacity onPress={() => navigation.navigate('Earnings')} activeOpacity={0.85}>
              <Ionicons name="wallet-outline" size={moderateScale(22)} color="#ffffff" />
            </TouchableOpacity>
          </LinearGradient>
          <TouchableOpacity onPress={() => navigation.navigate('Earnings')} style={styles.viewDetailsInside}><Text style={[styles.viewDetailsDark, { color: '#0b1960' }]}>View details  →</Text></TouchableOpacity>
        </View>

        {/* Active Appointments Section */}
        <View style={{ marginBottom: moderateScale(16) }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: moderateScale(12) }}>
            <Text style={{ fontWeight: '900', fontSize: moderateScale(18), color: '#1e2a54' }}>
              Active Appointments ({activeAppointments.length})
            </Text>
            {activeAppointments.length > 0 && (
              <TouchableOpacity onPress={() => (navigation as any).navigate('Bookings', { tab: 'Scheduled' })} activeOpacity={0.7}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ color: '#2B49C3', fontWeight: '800', fontSize: moderateScale(13), marginRight: moderateScale(4) }}>
                    View All
                  </Text>
                  <Ionicons name={'chevron-forward'} size={moderateScale(16)} color={'#2B49C3'} />
                </View>
              </TouchableOpacity>
            )}
          </View>

          {activeAppointments.length > 0 ? (
            <>
              {/* Show up to 3 active appointments */}
              {activeAppointments.slice(0, 3).map((appt, idx) => {
                // Use scheduled appointment date and time if available (same logic as new appointment cards and modal)
                const appointmentDate = (appt as any).appointmentDate || (appt as any).appointment_date || null;
                const appointmentTime = (appt as any).appointmentTime || (appt as any).appointment_time || null;

                let apptDate: Date;
                let timeStr: string = '';
                let dateStr: string = '';

                if (appointmentDate) {
                  // Parse appointment_date (could be ISO string or date string)
                  // Handle timezone issues by extracting just the date part
                  let dateToParse = appointmentDate;
                  if (typeof appointmentDate === 'string' && appointmentDate.includes('T')) {
                    // ISO format - extract date part only to avoid timezone issues
                    dateToParse = appointmentDate.split('T')[0];
                  } else if (typeof appointmentDate === 'string' && appointmentDate.includes(' ')) {
                    // Format like "2025-12-25 00:00:00+00" - extract date part
                    dateToParse = appointmentDate.split(' ')[0];
                  }

                  apptDate = new Date(dateToParse + 'T00:00:00'); // Set to midnight to avoid timezone issues

                  // Check if date is valid
                  if (isNaN(apptDate.getTime())) {
                    console.warn('⚠️ Invalid appointment date, using createdAt for:', appt.id);
                    apptDate = appt.createdAt ? new Date(appt.createdAt) : new Date();
                    const isToday = apptDate.toDateString() === new Date().toDateString();
                    timeStr = apptDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                    dateStr = isToday ? 'Today' : apptDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  } else {
                    // Date is valid, check if it's today or tomorrow
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const tomorrow = new Date(today);
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    const isToday = apptDate.toDateString() === today.toDateString();
                    const isTomorrow = apptDate.toDateString() === tomorrow.toDateString();

                    // Format date
                    if (isToday) {
                      dateStr = 'Today';
                    } else if (isTomorrow) {
                      dateStr = 'Tomorrow';
                    } else {
                      dateStr = apptDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    }

                    // Use appointment_time if available, otherwise format from appointment_date
                    if (appointmentTime && appointmentTime.trim() !== '') {
                      timeStr = appointmentTime.trim(); // Use as-is (e.g., "4:00 PM")
                    } else {
                      timeStr = apptDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                    }
                  }
                } else {
                  // Fall back to createdAt
                  console.warn('⚠️ No appointment date found, using createdAt for:', appt.id);
                  apptDate = appt.createdAt ? new Date(appt.createdAt) : new Date();
                  const isToday = apptDate.toDateString() === new Date().toDateString();
                  timeStr = apptDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                  dateStr = isToday ? 'Today' : apptDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                }
                const amount = typeof appt.amount === 'number' ? appt.amount : (typeof appt.amount === 'string' ? parseFloat(appt.amount) || 0 : 0);
                const status = (appt.status || '').toString().toLowerCase();
                const statusColor = status === 'inprogress' || status === 'in_progress' ? '#FF9500' : '#26e07f';
                const statusText = status === 'inprogress' || status === 'in_progress' ? 'In Progress' : 'Assigned';

                return (
                  <TouchableOpacity
                    key={appt.id || idx}
                    style={{
                      backgroundColor: '#ffffff',
                      borderRadius: moderateScale(16),
                      padding: moderateScale(16),
                      marginBottom: moderateScale(12),
                      borderLeftWidth: 4,
                      borderLeftColor: statusColor,
                      shadowColor: '#00197322',
                      shadowOpacity: 0.1,
                      shadowRadius: 10,
                      shadowOffset: { width: 0, height: 4 },
                      elevation: 3,
                    }}
                    onPress={() => {
                      try {
                        (navigation as any).navigate('DoctorAppointmentDetails', { appointmentId: appt.id });
                      } catch (error) {
                        console.error('Navigation error:', error);
                      }
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: moderateScale(8) }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: '900', fontSize: moderateScale(18), color: '#1e2a54', marginBottom: moderateScale(6) }}>
                          {appt.customerName || 'Unknown'}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: moderateScale(4) }}>
                          <Ionicons name="calendar-outline" size={14} color="#6b748f" style={{ marginRight: 6 }} />
                          <Text style={{ color: '#6b748f', fontSize: moderateScale(13), fontWeight: '600' }}>
                            {dateStr} • {timeStr}
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Ionicons name="location-outline" size={14} color="#2B49C3" style={{ marginRight: 6 }} />
                          <Text style={{ color: '#2B49C3', fontSize: moderateScale(12), fontWeight: '700' }}>
                            {appt.location || 'In-Person Consultation'}
                          </Text>
                        </View>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ fontWeight: '900', fontSize: moderateScale(16), color: '#1e2a54', marginBottom: moderateScale(4) }}>
                          ₹{amount.toFixed(2)}
                        </Text>
                        {appt.paymentStatus && (
                          <View style={{
                            backgroundColor: appt.paymentStatus === 'paid' ? '#e8f5e9' :
                              appt.paymentStatus === 'pending' ? '#fff4e6' :
                                appt.paymentStatus === 'failed' ? '#ffebee' : '#f3f4f6',
                            paddingHorizontal: moderateScale(8),
                            paddingVertical: moderateScale(3),
                            borderRadius: moderateScale(6),
                          }}>
                            <Text style={{
                              color: appt.paymentStatus === 'paid' ? '#26e07f' :
                                appt.paymentStatus === 'pending' ? '#FF9500' :
                                  appt.paymentStatus === 'failed' ? '#FF3B30' : '#6b748f',
                              fontSize: moderateScale(10),
                              fontWeight: '700',
                              textTransform: 'capitalize',
                            }}>
                              {appt.paymentStatus}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}

              {activeAppointments.length > 3 && (
                <TouchableOpacity
                  style={{
                    marginTop: moderateScale(8),
                    paddingVertical: moderateScale(12),
                    alignItems: 'center',
                    backgroundColor: '#f7faff',
                    borderRadius: moderateScale(12),
                  }}
                  onPress={() => (navigation as any).navigate('Bookings', { tab: 'Scheduled' })}
                  activeOpacity={0.8}
                >
                  <Text style={{ color: '#2B49C3', fontSize: moderateScale(13), fontWeight: '800' }}>
                    View {activeAppointments.length - 3} more appointment{activeAppointments.length - 3 > 1 ? 's' : ''} →
                  </Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <View style={{
              backgroundColor: '#ffffff',
              borderRadius: moderateScale(18),
              padding: moderateScale(40),
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: '#f0f4ff',
              shadowColor: '#00197322',
              shadowOpacity: 0.08,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 4 },
              elevation: 2
            }}>
              <View style={{
                width: moderateScale(64),
                height: moderateScale(64),
                borderRadius: moderateScale(32),
                backgroundColor: '#f8f9ff',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: moderateScale(16)
              }}>
                <Ionicons name="calendar-outline" size={moderateScale(32)} color="#9aa3bd" />
              </View>
              <Text style={{
                fontWeight: '800',
                fontSize: moderateScale(16),
                color: '#1e2a54',
                marginBottom: moderateScale(8)
              }}>
                No Active Appointments
              </Text>
              <Text style={{
                color: '#6b748f',
                fontSize: moderateScale(13),
                fontWeight: '600',
                textAlign: 'center'
              }}>
                Accepted appointments will appear here
              </Text>
            </View>
          )}
        </View>

        {/* Offline notice banner */}
        {offlineNoticeVisible ? (
          <Animated.View style={[styles.noticeBanner, { transform: [{ translateY: offlineNoticeY }] }]}>
            <View style={styles.noticeHeaderRow}>
              <Ionicons name="cloud-offline" size={moderateScale(26)} color="#ffffff" />
              <Text style={styles.noticeTitle}>You are offline</Text>
            </View>
            <Text style={styles.noticeSub}>Switch to Online to accept jobs and continue receiving new requests.</Text>
            <View style={styles.noticeActionsRow}>
              <TouchableOpacity style={styles.noticeBtnOutline} onPress={() => setOfflineNoticeVisible(false)}>
                <Text style={styles.noticeBtnOutlineText}>Not now</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.noticeBtnFill}
                onPress={async () => {
                  setIsOnline(true);
                  await setOnlineStatus(true);
                  // Save to database
                  try {
                    if (user?.id) {
                      const { error } = await supabase
                        .from('providers_doctor_details')
                        .update({ is_online: true })
                        .eq('user_id', user.id);

                      if (error) {
                        console.error('❌ Failed to update online status in database:', error);
                        setIsOnline(false);
                        await setOnlineStatus(false);
                        Alert.alert('Error', 'Failed to go online. Please try again.');
                      } else {
                        console.log('✅ Online status saved to database: true');
                      }
                    }
                  } catch (e) {
                    console.error('❌ Exception updating online status in database:', e);
                    setIsOnline(false);
                    await setOnlineStatus(false);
                    Alert.alert('Error', 'Failed to go online. Please try again.');
                  }
                }}
              >
                <Text style={styles.noticeBtnFillText}>Go Online</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        ) : null}

        {/* Dummy appointment generation removed */}

      </Animated.ScrollView>

      {/* Appointment Details Modal */}
      <Modal
        visible={appointmentModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setAppointmentModalVisible(false)}
      >
        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: moderateScale(20),
          }}
          activeOpacity={1}
          onPress={() => setAppointmentModalVisible(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: moderateScale(24),
              width: '100%',
              maxWidth: moderateScale(400),
              padding: moderateScale(24),
              shadowColor: '#000',
              shadowOpacity: 0.3,
              shadowRadius: 20,
              shadowOffset: { width: 0, height: 10 },
              elevation: 10,
            }}
          >
            {selectedAppointment && (() => {
              // Get appointment date and time from booking data - prefer appointment_date/appointment_time over createdAt
              const appointmentDate = selectedAppointment.appointmentDate
                || (selectedAppointment as any).appointment_date
                || (selectedAppointment as any)['appointment_date']
                || null;
              const appointmentTime = selectedAppointment.appointmentTime
                || (selectedAppointment as any).appointment_time
                || (selectedAppointment as any)['appointment_time']
                || null;

              // Use appointment_date/appointment_time if available, otherwise fall back to createdAt
              let apptDate: Date;
              let timeStr: string;
              let dateStr: string;

              if (appointmentDate) {
                // Parse appointment_date (could be ISO string or date string)
                apptDate = new Date(appointmentDate);
                const isToday = apptDate.toDateString() === new Date().toDateString();

                // Format date
                if (isToday) {
                  dateStr = 'Today';
                } else {
                  dateStr = apptDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
                }

                // Use appointment_time if available, otherwise format from appointment_date
                if (appointmentTime) {
                  timeStr = appointmentTime; // Use as-is (e.g., "4:00 PM")
                } else {
                  timeStr = apptDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                }
              } else {
                // Fall back to createdAt
                apptDate = selectedAppointment.createdAt ? new Date(selectedAppointment.createdAt) : new Date();
                const isToday = apptDate.toDateString() === new Date().toDateString();
                timeStr = apptDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                dateStr = isToday ? 'Today' : apptDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
              }

              const amount = typeof selectedAppointment.amount === 'number' ? selectedAppointment.amount : (typeof selectedAppointment.amount === 'string' ? parseFloat(selectedAppointment.amount) || 0 : 0);

              // Get symptoms and consultation type from booking data - check both camelCase and snake_case
              // Also check all possible property names
              const symptoms = selectedAppointment.symptoms
                || (selectedAppointment as any).symptoms
                || (selectedAppointment as any)['symptoms']
                || '';

              // Get consultation type - check multiple sources (same logic as appointment card)
              let consultationType = selectedAppointment.consultationType
                || (selectedAppointment as any).consultation_type
                || (selectedAppointment as any)['consultation_type']
                || (selectedAppointment as any)['consultationType']
                || '';

              // If consultationType is not found, try to infer from location field (same as appointment card)
              if (!consultationType || consultationType.trim() === '') {
                const location = selectedAppointment.location || '';
                if (location === 'Video Call') {
                  consultationType = 'Video Call';
                } else if (location === 'Phone Call') {
                  consultationType = 'Phone Call';
                } else if (location && location !== 'In-Person Consultation' && !location.includes('Address')) {
                  // If location is set to something other than default, use it
                  consultationType = location;
                }
              }

              // Format consultation type for display
              const formatConsultationType = (type: string) => {
                if (!type || type.trim() === '') return 'Not Specified';
                const typeLower = type.toLowerCase().trim();
                if (typeLower === 'in-person' || typeLower === 'in person') {
                  return 'In-Person Consultation';
                } else if (typeLower === 'video' || typeLower === 'video call') {
                  return 'Video Call';
                } else if (typeLower === 'phone' || typeLower === 'phone call') {
                  return 'Phone Call';
                }
                // Return formatted version (capitalize first letter of each word)
                return type.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
              };

              return (
                <View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: moderateScale(20) }}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: moderateScale(8) }}>
                        {selectedAppointment.status === 'New' && (
                          <View style={{ backgroundColor: '#FF3B30', borderRadius: 20, paddingHorizontal: moderateScale(10), paddingVertical: moderateScale(6), marginRight: moderateScale(10) }}>
                            <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: moderateScale(11) }}>NEW</Text>
                          </View>
                        )}
                        <Text style={{ fontWeight: '900', fontSize: moderateScale(20), color: '#1e2a54' }}>
                          {selectedAppointment.customerName}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: moderateScale(8) }}>
                        <Ionicons name="calendar-outline" size={16} color="#6b748f" style={{ marginRight: 8 }} />
                        <Text style={{ color: '#6b748f', fontSize: moderateScale(14), fontWeight: '600' }}>
                          {dateStr} • {timeStr}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => setAppointmentModalVisible(false)}
                      style={{
                        width: moderateScale(32),
                        height: moderateScale(32),
                        borderRadius: moderateScale(16),
                        backgroundColor: '#f0f4ff',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="close" size={20} color="#6b748f" />
                    </TouchableOpacity>
                  </View>

                  <View style={{ height: 1, backgroundColor: '#f0f4ff', marginBottom: moderateScale(20) }} />

                  <View style={{ marginBottom: moderateScale(20) }}>
                    {/* Symptoms Section - Always show */}
                    <View style={{ marginBottom: moderateScale(16) }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: moderateScale(8) }}>
                        <Ionicons name="medical-outline" size={18} color="#FF3B30" style={{ marginRight: 10 }} />
                        <Text style={{ color: '#1e2a54', fontSize: moderateScale(14), fontWeight: '800' }}>Symptoms</Text>
                      </View>
                      <Text style={{ color: '#4A5577', fontSize: moderateScale(14), fontWeight: '600', marginLeft: moderateScale(28) }}>
                        {symptoms && symptoms.trim() !== '' ? symptoms : 'No symptoms provided'}
                      </Text>
                    </View>

                    {/* Consultation Type Section - Always show */}
                    <View style={{ marginBottom: moderateScale(16) }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: moderateScale(8) }}>
                        <Ionicons name="location-outline" size={18} color="#2B49C3" style={{ marginRight: 10 }} />
                        <Text style={{ color: '#1e2a54', fontSize: moderateScale(14), fontWeight: '800' }}>Consultation Type</Text>
                      </View>
                      <Text style={{ color: '#2B49C3', fontSize: moderateScale(14), fontWeight: '700', marginLeft: moderateScale(28) }}>
                        {formatConsultationType(consultationType)}
                      </Text>
                    </View>

                    {amount > 0 && (
                      <View style={{ marginBottom: moderateScale(16) }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: moderateScale(8) }}>
                          <Ionicons name="cash-outline" size={18} color="#26e07f" style={{ marginRight: 10 }} />
                          <Text style={{ color: '#1e2a54', fontSize: moderateScale(14), fontWeight: '800' }}>Amount</Text>
                        </View>
                        <Text style={{ color: '#26e07f', fontSize: moderateScale(16), fontWeight: '800', marginLeft: moderateScale(28) }}>
                          ₹{amount.toFixed(2)}
                        </Text>
                      </View>
                    )}

                    {selectedAppointment.paymentStatus && (
                      <View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: moderateScale(8) }}>
                          <Ionicons name="card-outline" size={18} color="#6b748f" style={{ marginRight: 10 }} />
                          <Text style={{ color: '#1e2a54', fontSize: moderateScale(14), fontWeight: '800' }}>Payment Status</Text>
                        </View>
                        <View style={{
                          backgroundColor: selectedAppointment.paymentStatus === 'paid' ? '#e8f5e9' :
                            selectedAppointment.paymentStatus === 'pending' ? '#fff4e6' :
                              selectedAppointment.paymentStatus === 'failed' ? '#ffebee' : '#f3f4f6',
                          borderRadius: moderateScale(8),
                          paddingHorizontal: moderateScale(12),
                          paddingVertical: moderateScale(6),
                          alignSelf: 'flex-start',
                          marginLeft: moderateScale(28),
                        }}>
                          <Text style={{
                            color: selectedAppointment.paymentStatus === 'paid' ? '#26e07f' :
                              selectedAppointment.paymentStatus === 'pending' ? '#FF9500' :
                                selectedAppointment.paymentStatus === 'failed' ? '#FF3B30' : '#6b748f',
                            fontSize: moderateScale(12),
                            fontWeight: '700',
                            textTransform: 'capitalize',
                          }}>
                            {selectedAppointment.paymentStatus}
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>

                  <View style={{ height: 1, backgroundColor: '#f0f4ff', marginBottom: moderateScale(20) }} />

                  <View style={{ flexDirection: 'row', gap: moderateScale(12) }}>
                    {selectedAppointment.status === 'New' ? (
                      <>
                        <TouchableOpacity
                          style={{
                            flex: 1,
                            backgroundColor: '#ffebee',
                            borderRadius: moderateScale(14),
                            paddingVertical: moderateScale(14),
                            alignItems: 'center',
                            borderWidth: 1,
                            borderColor: '#FF3B30',
                          }}
                          onPress={async () => {
                            if (selectedAppointment?.id) {
                              const res = await updateBookingStatusRemote(selectedAppointment.id, 'Rejected');
                              if (res.success) {
                                updateBookingStatus(selectedAppointment.id, 'Cancelled');
                                trackEvent('Doctor Appointment Rejected', {
                                  appointment_id: selectedAppointment.id,
                                  patient_name: selectedAppointment.customerName,
                                  appointment_amount: selectedAppointment.amount,
                                  appointment_location: selectedAppointment.location,
                                  source: 'modal',
                                });
                                // Immediately update local state
                                refreshAppointmentLists();
                              } else {
                                Alert.alert('Error', 'Failed to reject booking. Please try again.');
                              }
                            }
                            setAppointmentModalVisible(false);
                          }}
                          activeOpacity={0.8}
                        >
                          <Text style={{ color: '#FF3B30', fontWeight: '800', fontSize: moderateScale(15) }}>Reject</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={{
                            flex: 1,
                            backgroundColor: '#26e07f',
                            borderRadius: moderateScale(14),
                            paddingVertical: moderateScale(14),
                            alignItems: 'center',
                          }}
                          onPress={async () => {
                            if (selectedAppointment?.id) {
                              const res = await updateBookingStatusRemote(selectedAppointment.id, 'Accepted');
                              if (res.success) {
                                // Update local booking status to 'Assigned' for UI, but preserve 'accepted' in doctor_appointments
                                updateBookingStatus(selectedAppointment.id, 'Assigned');

                                // Update the booking object to include originalStatus for filtering
                                const updatedBookings = getBookings().map(b => {
                                  if (b.id === selectedAppointment.id) {
                                    return {
                                      ...b,
                                      status: 'Assigned' as any,
                                      originalStatus: 'accepted',
                                    };
                                  }
                                  return b;
                                });
                                setBookings(updatedBookings);

                                trackEvent('Doctor Appointment Accepted', {
                                  appointment_id: selectedAppointment.id,
                                  patient_name: selectedAppointment.customerName,
                                  appointment_amount: selectedAppointment.amount,
                                  appointment_location: selectedAppointment.location,
                                  service_name: selectedAppointment.serviceName,
                                  source: 'modal',
                                });
                                // Immediately update local state to move from new to active appointments
                                refreshAppointmentLists();
                              } else {
                                Alert.alert('Error', 'Failed to accept booking. Please try again.');
                              }
                            }
                            setAppointmentModalVisible(false);
                          }}
                          activeOpacity={0.8}
                        >
                          <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: moderateScale(15) }}>Accept</Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <>
                        <TouchableOpacity
                          style={{
                            flex: 1,
                            backgroundColor: '#ffebee',
                            borderRadius: moderateScale(14),
                            paddingVertical: moderateScale(14),
                            alignItems: 'center',
                            borderWidth: 1,
                            borderColor: '#FF3B30',
                          }}
                          onPress={async () => {
                            if (selectedAppointment?.id) {
                              const res = await updateBookingStatusRemote(selectedAppointment.id, 'Cancelled');
                              if (res.success) {
                                updateBookingStatus(selectedAppointment.id, 'Cancelled');
                                trackEvent('Doctor Appointment Cancelled', {
                                  appointment_id: selectedAppointment.id,
                                  patient_name: selectedAppointment.customerName,
                                  appointment_amount: selectedAppointment.amount,
                                  appointment_location: selectedAppointment.location,
                                  source: 'modal',
                                });
                                // Immediately update local state
                                refreshAppointmentLists();
                              } else {
                                Alert.alert('Error', 'Failed to cancel booking. Please try again.');
                              }
                            }
                            setAppointmentModalVisible(false);
                          }}
                          activeOpacity={0.8}
                        >
                          <Text style={{ color: '#FF3B30', fontWeight: '800', fontSize: moderateScale(15) }}>Cancelled</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={{
                            flex: 1,
                            backgroundColor: (selectedAppointment?.paymentStatus || '').toLowerCase() === 'paid' ? '#26e07f' : '#d1d5db',
                            borderRadius: moderateScale(14),
                            paddingVertical: moderateScale(14),
                            alignItems: 'center',
                            opacity: (selectedAppointment?.paymentStatus || '').toLowerCase() === 'paid' ? 1 : 0.6,
                          }}
                          onPress={async () => {
                            // Only allow completion if payment status is 'paid'
                            const paymentStatus = (selectedAppointment?.paymentStatus || '').toLowerCase();
                            if (paymentStatus !== 'paid') {
                              Alert.alert('Payment Required', 'Please wait for payment to be completed before marking this appointment as completed.');
                              return;
                            }

                            if (selectedAppointment?.id) {
                              const res = await updateBookingStatusRemote(selectedAppointment.id, 'Completed');
                              if (res.success) {
                                updateBookingStatus(selectedAppointment.id, 'Completed');
                                trackEvent('Doctor Appointment Completed', {
                                  appointment_id: selectedAppointment.id,
                                  patient_name: selectedAppointment.customerName,
                                  appointment_amount: selectedAppointment.amount,
                                  appointment_location: selectedAppointment.location,
                                  service_name: selectedAppointment.serviceName,
                                  source: 'modal',
                                });
                                // Immediately update local state
                                refreshAppointmentLists();
                              } else {
                                Alert.alert('Error', 'Failed to complete booking. Please try again.');
                              }
                            }
                            setAppointmentModalVisible(false);
                          }}
                          disabled={(selectedAppointment?.paymentStatus || '').toLowerCase() !== 'paid'}
                          activeOpacity={0.8}
                        >
                          <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: moderateScale(15) }}>Completed</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                </View>
              );
            })()}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Fixed bottom navigation */}
      <BottomTab active={'Home'} floating={true} />
    </View>
  );
};

export default DoctorDashboardScreen;
