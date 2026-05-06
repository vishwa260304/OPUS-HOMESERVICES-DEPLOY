import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, Platform, FlatList, StatusBar, Modal, ActivityIndicator, Image, BackHandler } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { getCompanyInfo, getBookings, setCurrentAssignBooking, getNotifications } from '../utils/appState';
import BottomTab from '../components/BottomTab';
import GradientHeader from '../components/GradientHeader';
import { LinearGradient } from 'expo-linear-gradient';
import ThemeToggle from '../components/ThemeToggle';
import { moderateScale } from '../utils/responsive';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CustomerBookingsAPI } from '../lib/customerBookings';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Alert } from 'react-native';
import { api } from '../lib/api';
import { useVerification } from '../hooks/useVerification';
import { DoctorAppointmentsService } from '../services/doctorAppointmentsService';

const BookingsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { verification } = useVerification();
  const selected = null;
  const [brandName, setBrandName] = useState('Fixit Partner');
  const [notificationCount, setNotificationCount] = useState<number>(0);
  const [tab, setTab] = useState<'New' | 'Scheduled' | 'Completed'>('New');
  const [bookings, setBookings] = useState<any[]>([]);
  const [showEmployeeModal, setShowEmployeeModal] = useState<boolean>(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState<boolean>(false);
  const [bookingToAssign, setBookingToAssign] = useState<any>(null);
  const [loadingBookings, setLoadingBookings] = useState<boolean>(false);

  // Check if user is doctor consultation or acting driver
  const isDoctorConsultation = verification?.selected_sector === 'Doctor Consultation';
  const isActingDriver = verification?.selected_sector === 'Acting Drivers';

  // Acting driver: back (hardware or header) goes to ActingDriversDashboard
  useEffect(() => {
    if (!isActingDriver) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      (navigation as any).navigate('ActingDriversDashboard');
      return true;
    });
    return () => sub.remove();
  }, [isActingDriver, navigation]);

  // Header gradient colors - blue for all bookings
  const sectorGradient: [string, string] = ['#004c8f', '#0c1a5d'];
  const sectorPrimary = '#3B5BFD';

  // Fetch employees for assignment
  const fetchEmployees = async () => {
    if (!user) return;

    try {
      setLoadingEmployees(true);
      const { data, error } = await api.employees.getEmployees(user.id);

      if (error) {
        console.error('Error fetching employees:', error);
        Alert.alert('Error', 'Failed to load employees');
        return;
      }

      // Filter only active employees
      const activeEmployees = (data || []).filter(emp => emp.status === 'active');
      setEmployees(activeEmployees);

      if (activeEmployees.length === 0) {
        Alert.alert(
          'No Employees',
          'You don\'t have any active employees. Please add employees first.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Add Employee', onPress: () => navigation.navigate('AddNewEmployee') }
          ]
        );
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
      Alert.alert('Error', 'Failed to load employees');
    } finally {
      setLoadingEmployees(false);
    }
  };

  // Handle assign partner button press
  const handleAssignPartner = async (booking: any) => {
    setBookingToAssign(booking);
    await fetchEmployees();
    if (employees.length > 0 || !loadingEmployees) {
      setShowEmployeeModal(true);
    }
  };

  // Handle employee selection
  const handleEmployeeSelect = async (employee: any) => {
    if (!bookingToAssign) return;

    try {
      // Update booking with assigned employee
      const success = await CustomerBookingsAPI.assignEmployee(bookingToAssign.id, employee.id);

      if (success) {
        Alert.alert('Success', `${employee.name} has been assigned to this job!`);
        setShowEmployeeModal(false);
        setBookingToAssign(null);
        // Refresh bookings
        await fetchBookings();
      } else {
        Alert.alert('Error', 'Failed to assign employee. Please try again.');
      }
    } catch (error) {
      console.error('Error assigning employee:', error);
      Alert.alert('Error', 'Failed to assign employee. Please try again.');
    }
  };

  // Fetch real bookings from database
  const fetchBookings = async () => {
    try {
      if (!user) return;

      setLoadingBookings(true);

      // If acting driver, fetch bookings by acting_driver_id
      if (isActingDriver) {
        const actingDriverBookings = await CustomerBookingsAPI.getByActingDriverId(user.id);
        const sorted = (actingDriverBookings || []).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setBookings(sorted);
        setLoadingBookings(false);
        return;
      }

      // If doctor consultation user, fetch doctor appointments
      if (isDoctorConsultation) {
        // Fetch doctor appointments from bookings table
        const { data: bookingsData, error: bookingsError } = await supabase
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
            patient_email,
            consultation_type,
            symptoms,
            created_at,
            notes
          `)
          .eq('doctor_user_id', user.id)
          .order('created_at', { ascending: false });

        if (bookingsError) {
          console.error('Error fetching doctor appointments:', bookingsError);
          setBookings([]);
          setLoadingBookings(false);
          return;
        }

        const bookings = bookingsData || [];

        // Fetch doctor_appointments records to get persisted status
        const appointmentRecords = await DoctorAppointmentsService.getByDoctorId(user.id);
        const statusMap = new Map<string, string>();

        appointmentRecords.forEach(record => {
          statusMap.set(record.booking_id, record.status);
        });

        // Transform bookings to match BookingsScreen format
        const transformedBookings = bookings.map((booking: any) => {
          const persistedStatus = statusMap.get(booking.id);
          const effectiveStatus = persistedStatus || booking.status || 'pending';

          // Parse address if it's a JSON string
          let parsedAddress: any = {};
          if (booking.address) {
            try {
              parsedAddress = typeof booking.address === 'string'
                ? JSON.parse(booking.address)
                : booking.address;
            } catch (e) {
              parsedAddress = {};
            }
          }

          // Format appointment date/time
          const appointmentDate = booking.appointment_date || booking.created_at;
          const appointmentTime = booking.appointment_time || null;

          return {
            id: booking.id,
            customerName: booking.patient_name || 'Unknown Patient',
            serviceName: booking.consultation_type || 'Doctor Consultation',
            location: parsedAddress?.line1 || parsedAddress?.address || 'Not provided',
            amount: booking.amount || booking.total || '0',
            status: effectiveStatus,
            createdAt: booking.created_at,
            appointment_date: appointmentDate,
            appointment_time: appointmentTime,
            consultation_type: booking.consultation_type,
            consultationType: booking.consultation_type,
            symptoms: booking.symptoms,
            notes: booking.notes,
            patient_phone: booking.patient_phone,
            patient_email: booking.patient_email,
            doctor_user_id: booking.doctor_user_id,
            doctorUserId: booking.doctor_user_id,
          };
        });

        // Sort by creation date (newest first)
        transformedBookings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        setBookings(transformedBookings);
      } else {
        // For non-doctor users, fetch regular bookings
        // Fetch all provider services for this user
        const { data: services, error: servicesError } = await supabase
          .from('providers_services')
          .select('id')
          .eq('user_id', user.id);

        if (servicesError || !services || services.length === 0) {
          console.log('No services found for provider');
          setBookings([]);
          setLoadingBookings(false);
          return;
        }

        // Get all provider_service_ids
        const providerServiceIds = services.map(s => s.id);

        // Fetch bookings for all provider service IDs in parallel
        const bookingPromises = providerServiceIds.map(serviceId =>
          CustomerBookingsAPI.getByProviderId(serviceId)
        );

        const bookingResults = await Promise.all(bookingPromises);

        // Flatten all bookings into a single array
        const allBookings = bookingResults.flat();

        // Filter out doctor appointments - they should only appear for doctor users
        // Doctor appointments are identified by having doctor_user_id or consultation_type
        const nonDoctorBookings = allBookings.filter(booking => {
          // Exclude if it has doctor_user_id (doctor appointment)
          if (booking.doctor_user_id || booking.doctorUserId) {
            return false;
          }
          // Exclude if it has consultation_type (doctor appointment)
          if (booking.consultation_type || booking.consultationType) {
            return false;
          }
          // Include all other bookings (regular service bookings)
          return true;
        });

        // Sort by creation date (newest first)
        nonDoctorBookings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        setBookings(nonDoctorBookings);
      }
    } catch (error) {
      console.error('Failed to fetch bookings:', error);
    } finally {
      setLoadingBookings(false);
    }
  };

  // Refresh bookings when screen is focused
  useFocusEffect(
    useCallback(() => {
      setBrandName('Fixit Partner');
      setNotificationCount(getNotifications().length);
      fetchBookings();
    }, [isDoctorConsultation, isActingDriver])
  );

  useEffect(() => {
    // If navigated with a tab param, set it
    const t = (route.params as any)?.tab;
    if (t && (t === 'New' || t === 'Scheduled' || t === 'Completed')) setTab(t);
  }, [route.params]);

  // Set up realtime subscription for booking updates
  useEffect(() => {
    if (!user?.id) return;

    let providerServiceIds: number[] = [];
    let channel: any = null;

    // First, get provider service IDs (not needed for acting drivers or doctors)
    const setupRealtimeSubscription = async () => {
      try {
        // Acting drivers: filter by acting_driver_id in payload; no provider service IDs
        if (isActingDriver) {
          providerServiceIds = [];
        } else if (!isDoctorConsultation) {
          // Fetch all provider services for this user
          const { data: services, error: servicesError } = await supabase
            .from('providers_services')
            .select('id')
            .eq('user_id', user.id);

          if (servicesError || !services || services.length === 0) {
            console.log('No services found for provider, skipping realtime subscription');
            return;
          }

          providerServiceIds = services.map(s => s.id);
        }

        // Create a channel for realtime updates
        channel = supabase
          .channel('bookings-updates-bookings-screen')
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'bookings',
            },
            async (payload) => {
              const updatedBooking = payload.new;

              // For acting drivers, check if booking belongs to this driver
              if (isActingDriver) {
                if (updatedBooking.acting_driver_id !== user.id) {
                  return;
                }
              } else if (isDoctorConsultation) {
                // For doctor users, check if booking belongs to this doctor
                if (updatedBooking.doctor_user_id !== user.id) {
                  return;
                }
              } else {
                // For non-doctor users, check if booking belongs to this provider
                if (!providerServiceIds.includes(updatedBooking.provider_service_id)) {
                  return;
                }
              }

              console.log('📡 Booking update received via realtime:', updatedBooking);

              try {
                if (isActingDriver || isDoctorConsultation) {
                  // For acting drivers and doctors, refresh all to get updated status
                  fetchBookings();
                } else {
                  // For non-doctor users, fetch the updated booking using the API
                  const transformedBookings = await CustomerBookingsAPI.getByProviderId(updatedBooking.provider_service_id);
                  const found = transformedBookings.find(b => b.id === updatedBooking.id);

                  if (found) {
                    // Filter out doctor appointments
                    if (found.doctor_user_id || found.doctorUserId || found.consultation_type || found.consultationType) {
                      // This is a doctor appointment, remove it from the list if it exists
                      setBookings((prevBookings) => {
                        return prevBookings.filter(b => b.id !== found.id);
                      });
                      return;
                    }

                    setBookings((prevBookings) => {
                      // Check if booking already exists
                      const existingIndex = prevBookings.findIndex(b => b.id === found.id);

                      if (existingIndex !== -1) {
                        // Update existing booking
                        const updated = [...prevBookings];
                        updated[existingIndex] = found;
                        // Sort by creation date (newest first)
                        updated.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                        return updated;
                      } else {
                        // Add new booking if it doesn't exist
                        const updated = [found, ...prevBookings];
                        updated.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                        return updated;
                      }
                    });
                  } else {
                    // If booking not found in transformed results, it might have been deleted or status changed significantly
                    // Refresh all bookings to be safe
                    fetchBookings();
                  }
                }
              } catch (error) {
                console.error('Error processing booking update:', error);
                // Fallback: reload all bookings
                fetchBookings();
              }
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'bookings',
            },
            async (payload) => {
              const newBooking = payload.new;

              // For acting drivers, check if booking belongs to this driver
              if (isActingDriver) {
                if (newBooking.acting_driver_id !== user.id) {
                  return;
                }
              } else if (isDoctorConsultation) {
                // For doctor users, check if booking belongs to this doctor
                if (newBooking.doctor_user_id !== user.id) {
                  return;
                }
              } else {
                // For non-doctor users, check if booking belongs to this provider
                if (!providerServiceIds.includes(newBooking.provider_service_id)) {
                  return;
                }
              }

              console.log('📡 New booking received via realtime:', newBooking);

              try {
                if (isActingDriver || isDoctorConsultation) {
                  // For acting drivers and doctors, refresh all to get the new one
                  fetchBookings();
                } else {
                  // For non-doctor users, transform the new booking using the same function
                  const transformedBookings = await CustomerBookingsAPI.getByProviderId(newBooking.provider_service_id);
                  const found = transformedBookings.find(b => b.id === newBooking.id);

                  if (found) {
                    // Filter out doctor appointments - don't add them to the list
                    if (found.doctor_user_id || found.doctorUserId || found.consultation_type || found.consultationType) {
                      // This is a doctor appointment, skip it
                      return;
                    }

                    setBookings((prevBookings) => {
                      // Check if booking already exists to avoid duplicates
                      const exists = prevBookings.some(b => b.id === found.id);
                      if (exists) {
                        return prevBookings;
                      }
                      // Add to beginning and sort by creation date
                      const updated = [found, ...prevBookings];
                      updated.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                      return updated;
                    });
                  }
                }
              } catch (error) {
                console.error('Error processing new booking:', error);
                // Fallback: reload all bookings
                fetchBookings();
              }
            }
          )
          .subscribe((status) => {
            console.log('📡 Realtime subscription status for bookings screen:', status);
          });

      } catch (error) {
        console.error('Error setting up realtime subscription:', error);
      }
    };

    setupRealtimeSubscription();

    // Cleanup subscription on unmount
    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [user?.id, isDoctorConsultation, isActingDriver]);

  // Helper function to normalize status for comparison
  const normalizeStatus = (status: string) => (status || '').toLowerCase();

  // Format appointment date and time for display
  const formatAppointmentDateTime = (booking: any) => {
    // Try to get appointment_date and appointment_time from the booking
    const appointmentDate = booking.appointment_date || booking.appointmentDate || null;
    const appointmentTime = booking.appointment_time || booking.appointmentTime || null;

    if (appointmentDate) {
      // Parse appointment_date (could be ISO string or date string)
      let dateToParse = appointmentDate;
      if (typeof appointmentDate === 'string' && appointmentDate.includes('T')) {
        // ISO format - extract date part only to avoid timezone issues
        dateToParse = appointmentDate.split('T')[0];
      } else if (typeof appointmentDate === 'string' && appointmentDate.includes(' ')) {
        // Format like "2025-12-25 00:00:00+00" - extract date part
        dateToParse = appointmentDate.split(' ')[0];
      }

      const apptDate = new Date(dateToParse + 'T00:00:00');

      // Check if date is valid
      if (!isNaN(apptDate.getTime())) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const isToday = apptDate.toDateString() === today.toDateString();
        const isTomorrow = apptDate.toDateString() === tomorrow.toDateString();

        // Format date
        let dateStr: string;
        if (isToday) {
          dateStr = 'Today';
        } else if (isTomorrow) {
          dateStr = 'Tomorrow';
        } else {
          dateStr = apptDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }

        // Use appointment_time if available, otherwise format from appointment_date
        let timeStr: string;
        if (appointmentTime && appointmentTime.trim() !== '') {
          timeStr = appointmentTime.trim(); // Use as-is (e.g., "4:00 PM")
        } else {
          timeStr = apptDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        }

        return `${dateStr} • ${timeStr}`;
      }
    }

    // Fall back to createdAt if no appointment date
    const date = booking.createdAt ? new Date(booking.createdAt) : new Date();
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const isToday = date.toDateString() === today.toDateString();
    const isTomorrow = date.toDateString() === tomorrow.toDateString();

    const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

    if (isToday) {
      return `Today • ${timeStr}`;
    } else if (isTomorrow) {
      return `Tomorrow • ${timeStr}`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ` • ${timeStr}`;
    }
  };


  // New: Shows new/pending requests that need action
  const newList = useMemo(() => {
    return bookings.filter(b => {
      const status = normalizeStatus(b.status);
      return status === 'new' ||
        status === 'pending' ||
        status === 'requested' ||
        status === 'unassigned';
    });
  }, [bookings]);

  // Scheduled: Shows accepted/assigned/in-progress bookings
  const scheduledList = useMemo(() => {
    return bookings.filter(b => {
      const status = normalizeStatus(b.status);
      return status === 'confirmed' ||
        status === 'assigned' ||
        status === 'accepted' ||
        status === 'inprogress' ||
        status === 'in_progress';
    });
  }, [bookings]);

  // Completed: Shows finished or cancelled bookings
  const completedList = useMemo(() => {
    return bookings.filter(b => {
      const status = normalizeStatus(b.status);
      return status === 'completed' || status === 'cancelled';
    });
  }, [bookings]);

  const renderScheduledItem = ({ item: b }: { item: any }) => {
    const isDoctorAppt = isDoctorConsultation && (b.doctor_user_id || b.doctorUserId || b.consultation_type || b.consultationType);

    return (
      <TouchableOpacity
        key={b.id}
        style={[
          styles.jobCard,
          styles.cardShadow,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderWidth: 1,
          }
        ]}
        activeOpacity={0.7}
        onPress={() => {
          try {
            if (isDoctorAppt) {
              (navigation as any).navigate('DoctorAppointmentDetails', { appointmentId: String(b.id) });
            } else if (isActingDriver) {
              (navigation as any).navigate('ActingDriverBookingDetails', { bookingId: b.id });
            } else {
              (navigation as any).navigate('ActiveJobDetails', { bookingId: b.id });
            }
          } catch (error) {
            console.error('Navigation error:', error);
          }
        }}
      >
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: moderateScale(8) }}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.jobTitle, { color: colors.text, fontSize: moderateScale(18), fontWeight: '800' }]}>{b.customerName}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <View style={{
                backgroundColor: normalizeStatus(b.status) === 'inprogress' || normalizeStatus(b.status) === 'in_progress'
                  ? '#fff4e6'
                  : normalizeStatus(b.status) === 'assigned' || normalizeStatus(b.status) === 'accepted'
                    ? '#e8f5e9'
                    : '#f3f4f6',
                paddingHorizontal: moderateScale(8),
                paddingVertical: moderateScale(4),
                borderRadius: moderateScale(6),
              }}>
                <Text style={{
                  color: normalizeStatus(b.status) === 'inprogress' || normalizeStatus(b.status) === 'in_progress'
                    ? '#FF9500'
                    : normalizeStatus(b.status) === 'assigned' || normalizeStatus(b.status) === 'accepted'
                      ? '#26e07f'
                      : '#6b748f',
                  fontSize: moderateScale(11),
                  fontWeight: '700',
                }}>
                  {normalizeStatus(b.status) === 'inprogress' || normalizeStatus(b.status) === 'in_progress'
                    ? 'In Progress'
                    : (normalizeStatus(b.status) === 'assigned' || normalizeStatus(b.status) === 'accepted')
                      ? (isDoctorAppt ? 'Scheduled' : 'Assigned')
                      : 'Scheduled'}
                </Text>
              </View>
            </View>
          </View>

          <Text style={[styles.jobMeta, { color: colors.text, fontWeight: '600', marginTop: moderateScale(4) }]}>
            {b.consultation_type || b.consultationType || b.serviceName || 'Service'}
          </Text>
          <Text style={[styles.jobMeta, { color: colors.textSecondary, marginTop: moderateScale(2) }]}>
            {formatAppointmentDateTime(b)}
          </Text>

          {/* Show assigned employee if exists */}
          {b.partnerName && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: moderateScale(8) }}>
              <Ionicons name="person" size={moderateScale(14)} color={sectorGradient[0]} />
              <Text style={[styles.assignedPartnerText, { color: sectorGradient[0], fontSize: moderateScale(12) }]}>
                {' '}Assigned to: {b.partnerName}
              </Text>
            </View>
          )}
        </View>
        {normalizeStatus(b.status) === 'assigned' ||
          normalizeStatus(b.status) === 'inprogress' ||
          normalizeStatus(b.status) === 'in_progress' ? (
          <TouchableOpacity
            style={[styles.assignedBtn, { marginLeft: moderateScale(12) }]}
            activeOpacity={0.85}
            onPress={(e) => {
              e.stopPropagation();
              try {
                if (isDoctorAppt) {
                  (navigation as any).navigate('DoctorAppointmentDetails', { appointmentId: String(b.id) });
                } else if (isActingDriver) {
                  (navigation as any).navigate('ActingDriverBookingDetails', { bookingId: b.id });
                } else {
                  (navigation as any).navigate('ActiveJobDetails', { bookingId: b.id });
                }
              } catch (error) {
                console.error('Navigation error:', error);
              }
            }}
          >
            <Text style={[styles.assignedBtnText]}>View Details</Text>
          </TouchableOpacity>
        ) : !isDoctorAppt && !isActingDriver ? (
          <TouchableOpacity
            style={[styles.assignBtnRed, { backgroundColor: sectorPrimary, marginLeft: moderateScale(12) }]}
            activeOpacity={0.85}
            onPress={(e) => {
              e.stopPropagation();
              handleAssignPartner(b);
            }}
          >
            <Text style={[styles.assignBtnRedText, { color: '#ffffff' }]}>Assign</Text>
          </TouchableOpacity>
        ) : null}
      </TouchableOpacity>
    );
  };

  const renderCompletedItem = ({ item: b }: { item: any }) => {
    const isCompleted = normalizeStatus(b.status) === 'completed';
    const isDoctorAppt = isDoctorConsultation && (b.doctor_user_id || b.doctorUserId || b.consultation_type || b.consultationType);

    return (
      <TouchableOpacity
        key={b.id}
        style={[
          styles.jobCard,
          styles.cardShadow,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderWidth: 1,
            opacity: isCompleted ? 1 : 0.7,
          }
        ]}
        activeOpacity={0.7}
        onPress={() => {
          try {
            if (isDoctorAppt) {
              (navigation as any).navigate('DoctorAppointmentDetails', { appointmentId: String(b.id) });
            } else if (isActingDriver) {
              (navigation as any).navigate('ActingDriverBookingDetails', { bookingId: b.id });
            } else {
              (navigation as any).navigate('ActiveJobDetails', { bookingId: b.id });
            }
          } catch (error) {
            console.error('Navigation error:', error);
          }
        }}
      >
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: moderateScale(8) }}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.jobTitle, { color: colors.text, fontSize: moderateScale(18), fontWeight: '800' }]}>{b.customerName}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <View style={{
                backgroundColor: isCompleted ? '#e8f5e9' : '#ffebee',
                paddingHorizontal: moderateScale(8),
                paddingVertical: moderateScale(4),
                borderRadius: moderateScale(6),
              }}>
                <Text style={{
                  color: isCompleted ? '#26e07f' : '#ff3b30',
                  fontSize: moderateScale(11),
                  fontWeight: '700',
                }}>
                  {isCompleted ? 'Completed' : 'Cancelled'}
                </Text>
              </View>
            </View>
          </View>

          <Text style={[styles.jobMeta, { color: colors.text, fontWeight: '600', marginTop: moderateScale(4) }]}>
            {b.consultation_type || b.consultationType || b.serviceName || 'Service'}
          </Text>
          <Text style={[styles.jobMeta, { color: colors.textSecondary, marginTop: moderateScale(2) }]}>
            {formatAppointmentDateTime(b)}
          </Text>
        </View>
        {isCompleted ? (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={(e) => {
              e.stopPropagation();
              try {
                if (isDoctorAppt) {
                  (navigation as any).navigate('DoctorAppointmentDetails', { appointmentId: String(b.id) });
                } else if (isActingDriver) {
                  (navigation as any).navigate('ActingDriverBookingDetails', { bookingId: b.id });
                } else {
                  (navigation as any).navigate('ActiveJobDetails', { bookingId: b.id });
                }
              } catch (error) {
                console.error('Navigation error:', error);
              }
            }}
          >
            <Ionicons name="checkmark-circle" size={moderateScale(24)} color="#26e07f" />
          </TouchableOpacity>
        ) : (
          <Ionicons name="close-circle" size={moderateScale(24)} color="#ff3b30" />
        )}
      </TouchableOpacity>
    );
  };

  const renderNewItem = ({ item: b }: { item: any }) => {
    const isDoctorAppt = isDoctorConsultation && (b.doctor_user_id || b.doctorUserId || b.consultation_type || b.consultationType);

    const handleAcceptBooking = async (bookingId: string) => {
      try {
        // Accept the booking first
        const success = await CustomerBookingsAPI.updateStatus(bookingId, 'confirmed');
        if (success) {
          Alert.alert('Success', 'Booking accepted successfully! You can now assign a partner from Scheduled tab.');
          // Refresh bookings to show updated status
          await fetchBookings();
        } else {
          Alert.alert('Error', 'Failed to accept booking. Please try again.');
        }
      } catch (error) {
        console.error('Error accepting booking:', error);
        Alert.alert('Error', 'Failed to accept booking. Please try again.');
      }
    };

    const handleAcceptDoctorAppointment = async (bookingId: string) => {
      if (!user) return;

      try {
        // Update bookings table status to 'assigned'
        const { error: bookingUpdateError } = await supabase
          .from('bookings')
          .update({ status: 'assigned' })
          .eq('id', bookingId);

        if (bookingUpdateError) {
          console.error('Error updating booking status:', bookingUpdateError);
          Alert.alert('Error', 'Failed to accept appointment. Please try again.');
          return;
        }

        // Check if doctor_appointments record exists
        const existingRecord = await DoctorAppointmentsService.getByBookingAndDoctor(bookingId, user.id);

        // Get patient_id from patients table
        const { PatientsService } = await import('../services/patientsService');
        const patient = await PatientsService.getByBookingId(bookingId);

        // When accepting, use 'accepted' status in doctor_appointments table
        const appointmentStatus = 'accepted';

        if (existingRecord) {
          // Update existing record
          const result = await DoctorAppointmentsService.update(bookingId, user.id, {
            status: appointmentStatus,
            patient_id: patient?.id || existingRecord.patient_id || null,
          });
          if (result) {
            Alert.alert('Success', 'Appointment accepted successfully!');
            await fetchBookings();
          } else {
            Alert.alert('Error', 'Failed to accept appointment. Please try again.');
          }
        } else {
          // Create new record
          const result = await DoctorAppointmentsService.create({
            booking_id: bookingId,
            doctor_user_id: user.id,
            status: appointmentStatus,
            patient_id: patient?.id || null,
          });
          if (result) {
            Alert.alert('Success', 'Appointment accepted successfully!');
            await fetchBookings();
          } else {
            Alert.alert('Error', 'Failed to accept appointment. Please try again.');
          }
        }
      } catch (error) {
        console.error('Error accepting doctor appointment:', error);
        Alert.alert('Error', 'Failed to accept appointment. Please try again.');
      }
    };

    const handleCardPress = () => {
      try {
        if (isDoctorAppt) {
          // For doctor appointments, navigate to details screen
          (navigation as any).navigate('DoctorAppointmentDetails', { appointmentId: String(b.id) });
        } else if (isActingDriver) {
          (navigation as any).navigate('ActingDriverBookingDetails', { bookingId: b.id });
        } else {
          // For regular bookings, navigate to the active job details screen
          (navigation as any).navigate('ActiveJobDetails', { bookingId: b.id });
        }
      } catch (error) {
        console.error('Navigation error:', error);
      }
    };

    return (
      <TouchableOpacity
        key={b.id}
        style={[
          styles.jobCard,
          styles.cardShadow,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderWidth: 1,
          }
        ]}
        activeOpacity={0.7}
        onPress={handleCardPress}
      >
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: moderateScale(8) }}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: moderateScale(4) }}>
                <Text style={[styles.jobTitle, { color: colors.text, fontSize: moderateScale(18), fontWeight: '800' }]}>{b.customerName}</Text>
                <View style={{
                  backgroundColor: '#FF3B30',
                  paddingHorizontal: moderateScale(6),
                  paddingVertical: moderateScale(2),
                  borderRadius: moderateScale(4),
                  marginLeft: moderateScale(8),
                }}>
                  <Text style={{ color: '#ffffff', fontSize: moderateScale(10), fontWeight: '700' }}>NEW</Text>
                </View>
              </View>
            </View>
          </View>

          <Text style={[styles.jobMeta, { color: colors.text, fontWeight: '600', marginTop: moderateScale(4) }]}>
            {b.consultation_type || b.consultationType || b.serviceName || 'Service'}
          </Text>
          <Text style={[styles.jobMeta, { color: colors.textSecondary, marginTop: moderateScale(2) }]}>
            {formatAppointmentDateTime(b)}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.assignBtnRed, { backgroundColor: sectorPrimary, marginLeft: moderateScale(12) }]}
          activeOpacity={0.85}
          onPress={async (e) => {
            e.stopPropagation();
            if (isDoctorAppt) {
              await handleAcceptDoctorAppointment(b.id);
            } else {
              await handleAcceptBooking(b.id);
            }
          }}
        >
          <Text style={[styles.assignBtnRedText, { color: '#ffffff' }]}>Accept</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const EmptyNew = () => (
    <View style={{ paddingVertical: moderateScale(24), alignItems: 'center' }}>
      <Ionicons name="calendar-outline" size={moderateScale(36)} color="#cfe0ff" />
      <Text style={{ color: '#cfe0ff', marginTop: moderateScale(8), fontWeight: '700' }}>No new requests</Text>
      <Text style={{ color: '#9CA3AF', marginTop: moderateScale(4) }}>New booking requests will appear here</Text>
    </View>
  );

  const EmptyScheduled = () => (
    <View style={{ paddingVertical: moderateScale(24), alignItems: 'center' }}>
      <Ionicons name="briefcase-outline" size={moderateScale(36)} color="#cfe0ff" />
      <Text style={{ color: '#cfe0ff', marginTop: moderateScale(8), fontWeight: '700' }}>No scheduled jobs</Text>
      <Text style={{ color: '#9CA3AF', marginTop: moderateScale(4) }}>Accepted and assigned jobs will appear here</Text>
    </View>
  );

  const EmptyCompleted = () => (
    <View style={{ paddingVertical: moderateScale(24), alignItems: 'center' }}>
      <Ionicons name="checkmark-done-circle-outline" size={moderateScale(36)} color="#cfe0ff" />
      <Text style={{ color: '#cfe0ff', marginTop: moderateScale(8), fontWeight: '700' }}>No completed or cancelled jobs yet</Text>
      <Text style={{ color: '#9CA3AF', marginTop: moderateScale(4) }}>Completed and cancelled jobs will appear here</Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={sectorGradient[0]} translucent />

      {/* Custom header without bottom border radius */}
      <LinearGradient
        colors={sectorGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.customHeader}
      >
        <View style={styles.headerTopRow}>
          <View style={[styles.headerLeftContent, { paddingTop: insets.top + 8 }]}>
            <Text style={styles.brandName}>{brandName}</Text>
          </View>
          <View style={[styles.headerRightContent, { paddingTop: insets.top + 8 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity style={styles.bellWrap} onPress={() => navigation.navigate('Notifications')} activeOpacity={0.85}>
                <Ionicons name="notifications" size={moderateScale(18)} color="#ffffff" />
                {notificationCount > 0 ? (
                  <View style={styles.badge}><Text style={styles.badgeText}>{notificationCount > 99 ? '99+' : String(notificationCount)}</Text></View>
                ) : null}
              </TouchableOpacity>
              <View style={{ width: moderateScale(10) }} />
              <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
                <Ionicons name="person-circle" size={moderateScale(32)} color="#cfe0ff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* Content area with padding */}
      <View style={styles.contentArea}>
        {/* Segmented control */}
        <View style={[styles.segment, { backgroundColor: '#004c8f' }]}>
          <TouchableOpacity style={[styles.segmentBtn, tab === 'New' && styles.segmentActive]} onPress={() => setTab('New')} activeOpacity={0.8}>
            <Text style={[styles.segmentItem, tab === 'New' && styles.segmentItemActive]}>New</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.segmentBtn, tab === 'Scheduled' && styles.segmentActive]} onPress={() => setTab('Scheduled')} activeOpacity={0.8}>
            <Text style={[styles.segmentItem, tab === 'Scheduled' && styles.segmentItemActive]}>Scheduled</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.segmentBtn, tab === 'Completed' && styles.segmentActive]} onPress={() => setTab('Completed')} activeOpacity={0.8}>
            <Text style={[styles.segmentItem, tab === 'Completed' && styles.segmentItemActive]}>Completed</Text>
          </TouchableOpacity>
        </View>

        {loadingBookings ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: moderateScale(60) }}>
            <ActivityIndicator size="large" color={sectorPrimary} />
            <Text style={{ color: colors.textSecondary, marginTop: moderateScale(16), fontWeight: '600' }}>Loading bookings...</Text>
          </View>
        ) : (
          <FlatList
            data={tab === 'New' ? newList : tab === 'Scheduled' ? scheduledList : completedList}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => {
              const renderFunction = tab === 'New' ? renderNewItem : tab === 'Scheduled' ? renderScheduledItem : renderCompletedItem;
              const rendered = renderFunction({ item });
              // Add top margin to first card
              if (index === 0) {
                return (
                  <View style={{ marginTop: moderateScale(16) }}>
                    {rendered}
                  </View>
                );
              }
              return rendered;
            }}
            ListEmptyComponent={tab === 'New' ? EmptyNew : tab === 'Scheduled' ? EmptyScheduled : EmptyCompleted}
            contentContainerStyle={styles.content}
            style={{ backgroundColor: colors.background }}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={true}
            initialNumToRender={6}
            windowSize={10}
            maxToRenderPerBatch={8}
            updateCellsBatchingPeriod={50}
            contentInsetAdjustmentBehavior={Platform.OS === 'ios' ? 'automatic' : 'never'}
          />
        )}
      </View>

      {/* Employee Selection Modal */}
      <Modal
        visible={showEmployeeModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowEmployeeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalOverlayTouch}
            activeOpacity={1}
            onPress={() => setShowEmployeeModal(false)}
          />
          <View style={[styles.employeeModalCard, { backgroundColor: colors.card }]}>
            {/* Header with Gradient */}
            <LinearGradient
              colors={sectorGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.employeeModalHeader}
            >
              <View style={styles.employeeModalHeaderContent}>
                <View style={styles.employeeModalIconWrapper}>
                  <Ionicons name="people" size={moderateScale(24)} color="#ffffff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.employeeModalTitle}>Assign Partner</Text>
                  <Text style={styles.employeeModalSubtitle}>Select an employee for this job</Text>
                </View>
                <TouchableOpacity onPress={() => setShowEmployeeModal(false)} style={styles.modalCloseBtn}>
                  <Ionicons name="close" size={moderateScale(24)} color="#ffffff" />
                </TouchableOpacity>
              </View>
            </LinearGradient>

            {loadingEmployees ? (
              <View style={styles.employeeLoadingContainer}>
                <ActivityIndicator size="large" color={sectorPrimary} />
                <Text style={[styles.employeeLoadingText, { color: colors.textSecondary }]}>Loading employees...</Text>
              </View>
            ) : employees.length === 0 ? (
              <View style={styles.employeeEmptyContainer}>
                <Ionicons name="people-outline" size={moderateScale(48)} color={colors.textSecondary} />
                <Text style={[styles.employeeEmptyTitle, { color: colors.text }]}>No Active Employees</Text>
                <Text style={[styles.employeeEmptySubtitle, { color: colors.textSecondary }]}>
                  Add employees to start assigning jobs
                </Text>
                <TouchableOpacity
                  style={[styles.addEmployeeBtn]}
                  onPress={() => {
                    setShowEmployeeModal(false);
                    navigation.navigate('AddNewEmployee');
                  }}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={sectorGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.addEmployeeBtnGradient}
                  >
                    <Ionicons name="add" size={moderateScale(20)} color="#ffffff" />
                    <Text style={styles.addEmployeeBtnText}>Add Employee</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView
                style={styles.employeeModalContent}
                showsVerticalScrollIndicator={false}
              >
                {employees.map((employee) => (
                  <TouchableOpacity
                    key={employee.id}
                    style={[styles.employeeItem, { borderColor: colors.border }]}
                    onPress={() => handleEmployeeSelect(employee)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.employeeItemLeft}>
                      {employee.photo ? (
                        <Image source={{ uri: employee.photo }} style={styles.employeePhoto} />
                      ) : employee.avatar ? (
                        <View style={[styles.employeeAvatarCircle, { backgroundColor: sectorPrimary }]}>
                          <Text style={styles.employeeAvatarText}>{employee.avatar}</Text>
                        </View>
                      ) : (
                        <View style={[styles.employeeAvatarCircle, { backgroundColor: colors.surface }]}>
                          <Ionicons name="person" size={moderateScale(20)} color={colors.textSecondary} />
                        </View>
                      )}
                      <View style={styles.employeeInfo}>
                        <Text style={[styles.employeeName, { color: colors.text }]}>{employee.name}</Text>
                        <Text style={[styles.employeeRole, { color: colors.textSecondary }]}>{employee.role}</Text>
                        {employee.experience_years && (
                          <Text style={[styles.employeeExperience, { color: colors.textSecondary }]}>
                            {employee.experience_years} years exp
                          </Text>
                        )}
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={moderateScale(20)} color={colors.textSecondary} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <BottomTab active={'Bookings'} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b1960' },
  customHeader: {
    paddingTop: 12,
    paddingHorizontal: 24,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
    marginBottom: -15,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  contentArea: { flex: 1, padding: 10 },
  topRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'flex-start', marginBottom: moderateScale(16), marginTop: 30 },
  topRightSection: { flexDirection: 'column', alignItems: 'flex-end', marginRight: moderateScale(12) },
  topRowIcons: { flexDirection: 'row', alignItems: 'center', marginBottom: moderateScale(8) },
  logo: { fontSize: moderateScale(28), color: '#ffffff', fontWeight: '800' },
  logoSub: { fontSize: moderateScale(16), fontWeight: '600' },
  avatarDot: { width: moderateScale(32), height: moderateScale(32), borderRadius: moderateScale(16), backgroundColor: '#e6e8ff' },
  bellWrap: { width: moderateScale(32), height: moderateScale(32), borderRadius: moderateScale(16), backgroundColor: '#13235d', alignItems: 'center', justifyContent: 'center', marginRight: moderateScale(12), position: 'relative' },
  badge: { position: 'absolute', top: -6, right: -6, backgroundColor: '#004c8f', borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 },
  badgeText: { color: '#ffffff', fontSize: 10, fontWeight: '700' },
  brandName: { color: '#ffffff', fontSize: moderateScale(24), fontWeight: '800' },
  headerLeftContent: { paddingTop: 0 },
  headerRightContent: { alignItems: 'flex-end', paddingTop: 0 },

  segment: { flexDirection: 'row', backgroundColor: '#1a2a6b', borderRadius: moderateScale(12), marginTop: moderateScale(16), padding: moderateScale(4) },
  segmentBtn: { flex: 1, borderRadius: moderateScale(8) },
  segmentItem: { color: '#cfe0ff', paddingVertical: moderateScale(10), width: '100%', textAlign: 'center', fontWeight: '600' },
  segmentItemActive: { color: '#0b1960' },
  segmentActive: { backgroundColor: '#e6e8ff' },
  content: { paddingBottom: moderateScale(120) },
  jobCard: {
    backgroundColor: '#ffffff',
    padding: moderateScale(16),
    borderRadius: moderateScale(16),
    marginBottom: moderateScale(12),
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: moderateScale(100),
  },
  jobTitle: { color: '#111827', fontWeight: '700', fontSize: 16 },
  jobMeta: { color: '#6B7280', marginTop: 4 },
  greenTag: { color: '#0ed47a', fontWeight: '700' },
  redTag: { color: '#ff8c8c', fontWeight: '700' },
  primaryBtn: { backgroundColor: '#004c8f', paddingVertical: moderateScale(10), paddingHorizontal: moderateScale(14), borderRadius: moderateScale(12) },
  primaryBtnText: { color: '#ffffff', fontWeight: '700' },
  assignBtnRed: { backgroundColor: '#004c8f', paddingVertical: moderateScale(10), paddingHorizontal: moderateScale(14), borderRadius: moderateScale(12) },
  assignBtnRedText: { color: '#ffffff', fontWeight: '900' },
  assignedBtn: { backgroundColor: '#26e07f', paddingVertical: moderateScale(10), paddingHorizontal: moderateScale(14), borderRadius: moderateScale(12) },
  assignedBtnText: { color: '#0b1960', fontWeight: '900' },
  assignedPartnerText: { fontSize: moderateScale(13), fontWeight: '700' },
  secondaryBtn: { backgroundColor: '#004c8f', paddingVertical: moderateScale(10), paddingHorizontal: moderateScale(14), borderRadius: moderateScale(12) },
  secondaryBtnText: { color: '#ffffff', fontWeight: '700' },
  cardShadow: { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  // Employee Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalOverlayTouch: {
    flex: 1,
  },
  employeeModalCard: {
    width: '100%',
    maxHeight: '70%',
    borderTopLeftRadius: moderateScale(24),
    borderTopRightRadius: moderateScale(24),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
    overflow: 'hidden',
  },
  employeeModalHeader: {
    paddingTop: moderateScale(20),
    paddingBottom: moderateScale(20),
    paddingHorizontal: moderateScale(20),
  },
  employeeModalHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(12),
  },
  employeeModalIconWrapper: {
    width: moderateScale(48),
    height: moderateScale(48),
    borderRadius: moderateScale(12),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  employeeModalTitle: {
    fontSize: moderateScale(20),
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  employeeModalSubtitle: {
    fontSize: moderateScale(13),
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: moderateScale(2),
  },
  modalCloseBtn: {
    width: moderateScale(36),
    height: moderateScale(36),
    borderRadius: moderateScale(18),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  employeeModalContent: {
    padding: moderateScale(20),
    maxHeight: moderateScale(500),
  },
  employeeLoadingContainer: {
    padding: moderateScale(60),
    alignItems: 'center',
    justifyContent: 'center',
  },
  employeeLoadingText: {
    marginTop: moderateScale(16),
    fontSize: moderateScale(14),
    fontWeight: '600',
  },
  employeeEmptyContainer: {
    padding: moderateScale(40),
    alignItems: 'center',
    justifyContent: 'center',
  },
  employeeEmptyTitle: {
    fontSize: moderateScale(18),
    fontWeight: '700',
    marginTop: moderateScale(16),
  },
  employeeEmptySubtitle: {
    fontSize: moderateScale(14),
    marginTop: moderateScale(8),
    textAlign: 'center',
  },
  addEmployeeBtn: {
    marginTop: moderateScale(20),
    borderRadius: moderateScale(12),
    overflow: 'hidden',
  },
  addEmployeeBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: moderateScale(8),
    paddingVertical: moderateScale(14),
    paddingHorizontal: moderateScale(24),
  },
  addEmployeeBtnText: {
    color: '#ffffff',
    fontSize: moderateScale(16),
    fontWeight: '700',
  },
  employeeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: moderateScale(16),
    borderRadius: moderateScale(12),
    borderWidth: 1,
    marginBottom: moderateScale(12),
    backgroundColor: 'transparent',
  },
  employeeItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  employeePhoto: {
    width: moderateScale(48),
    height: moderateScale(48),
    borderRadius: moderateScale(24),
    marginRight: moderateScale(12),
  },
  employeeAvatarCircle: {
    width: moderateScale(48),
    height: moderateScale(48),
    borderRadius: moderateScale(24),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: moderateScale(12),
  },
  employeeAvatarText: {
    color: '#ffffff',
    fontSize: moderateScale(16),
    fontWeight: '700',
  },
  employeeInfo: {
    flex: 1,
  },
  employeeName: {
    fontSize: moderateScale(16),
    fontWeight: '700',
    marginBottom: moderateScale(4),
  },
  employeeRole: {
    fontSize: moderateScale(13),
    marginBottom: moderateScale(2),
  },
  employeeExperience: {
    fontSize: moderateScale(12),
    fontStyle: 'italic',
  },
});

export default BookingsScreen;
