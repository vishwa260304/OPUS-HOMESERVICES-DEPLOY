import React, { useEffect, useLayoutEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, StatusBar, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BookingsApi } from '../../lib/bookings';
import { ReviewsApi } from '../../lib/reviews';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

type Order = {
  id: string;
  status: string;
  createdAt: string;
  total: number;
  items?: any[];
  phone?: string;
  address?: any | null;
  breakdown?: { subtotal: number; serviceFee: number; tax: number; discount: number; total: number };
  schedule?: { serviceId: string; date: string; time: string }[];
  payment_mode?: string | null;
  payment_status?: string | null;
  payment_reference?: string | null;
  payment_amount?: number | null;
  currency?: string | null;
  payment?: { mode?: string; status?: string; reference?: string | null; amount?: number | null } | null;
  rating?: { rating: number; review: string; date: string; timestamp: string };
  [key: string]: any; // Allow additional properties
};

export default function BookingDetailsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams();
  const orderId = String(params.id || '');

  const [order, setOrder] = useState<Order | null>(null);
  const [initializing, setInitializing] = useState<boolean>(true);
  const [profile, setProfile] = useState<any>({});
  const [rating, setRating] = useState<number>(0);
  const [review, setReview] = useState<string>('');
  const [showFullAddress, setShowFullAddress] = useState<boolean>(true);
  const [existingReview, setExistingReview] = useState<any>(null);
  const [assignedEmployee, setAssignedEmployee] = useState<{ name: string; role?: string; photo?: string; avatar?: string } | null>(null);
  const [showFullReviewText, setShowFullReviewText] = useState<boolean>(false);


  useEffect(() => {
    // Hide the default header (page title) provided by the router/navigation
    try {
      (navigation as any)?.setOptions?.({ headerShown: false });
    } catch (e) {
      // ignore
    }
  }, [navigation]);

  // Simple goBack helper for header/back buttons
  const goBack = () => {
    try {
      router.back();
    } catch (e) {
      (navigation as any)?.goBack?.();
    }
  };

  const loadBooking = useCallback(async () => {
    // Guard against missing/empty route param id to avoid spamming getById
    if (!orderId) {
      setInitializing(false);
      return;
    }

    try {
      // Try fetching from Supabase first
      const cloud = await BookingsApi.getById(orderId);
      if (cloud) {
        // Check if this is a doctor appointment - redirect immediately
        const hasDoctorAppointment = (cloud.items || []).some((item: any) => item?.category === 'Doctor Appointment');
        if (hasDoctorAppointment) {
          router.replace(`/booking/doctor/${orderId}` as any);
          return; // keep initializing true so we don't render while redirecting
        }

        // If this is a pharmacy/medicine order, redirect to pharmacy-specific details
        const pharmCats = ['wellness', 'diabetes', 'vitamins', 'ayurveda', 'personal care', 'prescription', 'medicine', 'pharmacy'];
        const isPharmacyOrder = (cloud.items || []).some((item: any) => {
          const cat = (item?.category || '').toString().trim().toLowerCase();
          return pharmCats.includes(cat);
        });
        if (isPharmacyOrder) {
          router.replace(`/booking/pharm/${orderId}` as any);
          return; // keep initializing true so we don't render while redirecting
        }

        // If this is an acting driver booking, use dedicated screen (driver profile, no "Assigned" status)
        const actingDriverId = (cloud as any).acting_driver_id;
        if (actingDriverId) {
          router.replace(`/booking/acting-driver/${orderId}` as any);
          return;
        }

        setOrder({
          id: cloud.id,
          status: cloud.status,
          createdAt: cloud.created_at,
          total: cloud.total,
          items: cloud.items || [],
          phone: (cloud.address as any)?.phone || undefined,
          address: cloud.address || undefined,
          schedule: cloud.schedule || undefined,
          breakdown: cloud.breakdown || undefined,
          payment_mode: (cloud as any).payment_mode || null,
          payment_status: (cloud as any).payment_status || null,
          payment_reference: (cloud as any).payment_reference || null,
          payment_amount: (cloud as any).payment_amount || null,
          currency: (cloud as any).currency || 'INR',
          provider_id: (cloud as any).provider_id || null,
          provider_name: (cloud as any).provider_name || null,
        });

        // Fetch assigned employee details if assigned_employee_id exists
        const assignedEmployeeId = (cloud as any).assigned_employee_id;
        if (assignedEmployeeId) {
          try {
            const { data: empData, error: empError } = await supabase
              .from('providers_employees')
              .select('id, name, role, phone, photo, avatar')
              .eq('id', assignedEmployeeId)
              .single();

            if (!empError && empData) {
              setAssignedEmployee({
                name: empData.name,
                role: empData.role,
                photo: empData.photo,
                avatar: empData.avatar,
              });
            } else {
              setAssignedEmployee(null);
            }
          } catch (error) {
            setAssignedEmployee(null);
          }
        } else {
          setAssignedEmployee(null);
        }
        // finished initialization when we have set order
        setInitializing(false);
      } else {
        const profileRaw = await AsyncStorage.getItem('user_profile');
        const prof = profileRaw ? JSON.parse(profileRaw) : {};
        setProfile(prof || {});
        const phone = (prof?.phone || '').trim();
        const key = phone ? `user_orders:${phone}` : null;
        const raw = key ? await AsyncStorage.getItem(key) : null;
        const list: Order[] = raw ? JSON.parse(raw) : [];
        const found = list.find(o => String(o.id) === orderId) || null;
        // If we found an offline/local booking and it's a pharmacy order, redirect to pharmacy page
        if (found) {
          const pharmCats = ['wellness', 'diabetes', 'vitamins', 'ayurveda', 'personal care', 'prescription', 'medicine', 'pharmacy'];
          const isLocalPharm = (found.items || []).some((item: any) => {
            const cat = (item?.category || '').toString().trim().toLowerCase();
            return pharmCats.includes(cat);
          });
          if (isLocalPharm) {
            router.replace(`/booking/pharm/${orderId}` as any);
            return; // keep initializing true to avoid render flash
          }
        }

        setOrder(found);
        setAssignedEmployee(null);
        setInitializing(false);
      }
    } catch (error) {
      // Silent error handling
      setInitializing(false);
    }
  }, [orderId]);

  // Load booking when component mounts
  useEffect(() => {
    loadBooking();
  }, [loadBooking]);

  // Refresh booking when screen is focused (user navigates back)
  useFocusEffect(
    useCallback(() => {
      loadBooking();
    }, [loadBooking])
  );

  // Set up realtime subscription for booking status updates (for non-doctor appointments)
  // Falls back to polling if realtime fails
  useEffect(() => {
    if (!orderId) return;

    let pollingInterval: ReturnType<typeof setInterval> | null = null;
    let isRealtimeActive = false;

    // Polling fallback function
    const startPolling = () => {
      pollingInterval = setInterval(async () => {
        try {
          await loadBooking();
        } catch (error) {
          // Silent error handling
        }
      }, 10000) as ReturnType<typeof setInterval>; // Poll every 10 seconds
    };

    // Create a channel for realtime updates
    const channel = supabase
      .channel(`booking-details-realtime-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bookings',
          filter: `id=eq.${orderId}`,
        },
        async (payload) => {
          // Check if this is a doctor appointment - if so, don't update from bookings table
          // Doctor appointments should use doctor_appointments table status
          const isDoctorAppointment = (order?.items || []).some((item: any) => item?.category === 'Doctor Appointment');
          if (isDoctorAppointment) {
            return;
          }

          // Update the order state with new data (for non-doctor appointments)
          if (payload.new) {
            const updatedBooking = payload.new;

            setOrder((prevOrder) => {
              if (!prevOrder) {
                // If order is not loaded yet, try to load it
                loadBooking();
                return prevOrder;
              }

              return {
                ...prevOrder,
                status: updatedBooking.status,
                // Update any other fields that might have changed
                payment_status: updatedBooking.payment_status || prevOrder.payment_status,
                payment_mode: updatedBooking.payment_mode || prevOrder.payment_mode,
                payment_reference: updatedBooking.payment_reference || prevOrder.payment_reference,
                payment_amount: updatedBooking.payment_amount || prevOrder.payment_amount,
              };
            });

            // If assigned_employee_id changed, fetch updated employee details
            const newAssignedEmployeeId = updatedBooking.assigned_employee_id;
            if (newAssignedEmployeeId) {
              try {
                const { data: empData, error: empError } = await supabase
                  .from('providers_employees')
                  .select('id, name, role, phone, photo, avatar')
                  .eq('id', newAssignedEmployeeId)
                  .single();

                if (!empError && empData) {
                  setAssignedEmployee({
                    name: empData.name,
                    role: empData.role,
                    photo: empData.photo,
                    avatar: empData.avatar,
                  });
                } else {
                  setAssignedEmployee(null);
                }
              } catch (error) {
                setAssignedEmployee(null);
              }
            } else {
              setAssignedEmployee(null);
            }
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          isRealtimeActive = true;
          // Clear polling if realtime is working
          if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          isRealtimeActive = false;
          // Start polling if not already started
          if (!pollingInterval) {
            startPolling();
          }
        }
      });

    // Cleanup subscription and polling on unmount
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
      supabase.removeChannel(channel);
    };
  }, [orderId, order, loadBooking]);

  const loadExistingReview = async () => {
    try {
      // First try to load from the booking data itself
      if (order?.rating) {
        setExistingReview(order.rating);
        setRating(order.rating.rating);
        setReview(order.rating.review);
        return;
      }

      // Try to load from database
      if (orderId) {
        const { data: dbReviews, error } = await ReviewsApi.getByBookingId(orderId);
        if (!error && dbReviews && dbReviews.length > 0) {
          const dbReview = dbReviews[0]; // Get the most recent review
          const reviewData = {
            rating: dbReview.rating,
            review: dbReview.review_text || '',
            date: dbReview.review_date,
            timestamp: dbReview.created_at,
          };
          setExistingReview(reviewData);
          setRating(dbReview.rating);
          setReview(dbReview.review_text || '');
          return;
        }
      }

      // Fallback to global reviews
      const raw = await AsyncStorage.getItem('user_reviews');
      if (raw) {
        const reviews = JSON.parse(raw);
        const existing = reviews.find((r: any) => r.bookingId === orderId);
        if (existing) {
          setExistingReview(existing);
          setRating(existing.rating);
          setReview(existing.review);
        }
      }
    } catch (error) {
      // Silent error handling
    }
  };

  useEffect(() => {
    loadExistingReview();
  }, [orderId, order]);


  const firstSchedule = useMemo(() => {
    if (!order?.schedule || order.schedule.length === 0) {
      // Try to infer from items
      const apptItem = order?.items?.find((it: any) => it?.bookingDate && it?.bookingTime);
      if (apptItem) return { date: apptItem.bookingDate, time: apptItem.bookingTime };
      return null;
    }
    const s = order.schedule[0];
    return { date: s.date, time: s.time };
  }, [order]);

  if (initializing) {
    return null;
  }

  // No toggle state (removed per request)

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <StatusBar barStyle="dark-content" />
      {/* Header (title removed) */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={goBack} style={styles.headerBack}>
          <Ionicons name="arrow-back" size={22} color={colors.text as any} />
        </TouchableOpacity>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Service Brief Info Card */}
        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border, padding: 16 }]}>
          <View style={styles.serviceBriefContainer}>
            {order?.items?.[0]?.image ? (
              <Image
                source={{ uri: order.items[0].image }}
                style={styles.serviceImage}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.serviceImagePlaceholder, { backgroundColor: colors.surface }]}>
                <Ionicons name="construct-outline" size={32} color={colors.textSecondary as any} />
              </View>
            )}
            <View style={styles.serviceBriefInfo}>
              <Text style={[styles.serviceBriefName, { color: colors.text }]}>
                {order?.items?.[0]?.title || 'Service'}
              </Text>
              <Text style={[styles.serviceBriefCategory, { color: colors.textSecondary }]}>
                {order?.items?.[0]?.category || 'Home Service'}
              </Text>
              <View style={styles.providerInfoRow}>
                <Ionicons name="business-outline" size={14} color={colors.primary as any} />
                <Text style={[styles.providerNameText, { color: colors.primary }]}>
                  {order?.provider_name || order?.items?.[0]?.providerName || 'Professional'}
                </Text>
              </View>
            </View>
          </View>
        </View>
        {/* Status Timeline */}
        {(() => {
          // Regular bookings: 5-step timeline (Requested, Confirmed, Assigned, In Progress, Completed)
          const steps = ['Requested', 'Confirmed', 'Assigned', 'In Progress', 'Completed'];

          const backendStatus = (order?.status || 'pending').toLowerCase();

          // Map backend status to display status for regular bookings
          const backendToDisplay: { [key: string]: string } = {
            'pending': 'Requested',
            'requested': 'Requested',
            'confirmed': 'Confirmed',
            'assigned': 'Assigned',
            'in_progress': 'In Progress',
            'inprogress': 'In Progress',
            'completed': 'Completed',
            'cancelled': 'Cancelled',
          };

          const current = backendToDisplay[backendStatus] || 'Requested';

          // Map display status to timeline index for regular bookings
          const statusMap: { [key: string]: number } = {
            'Requested': 0,
            'Confirmed': 1,
            'Assigned': 2,
            'In Progress': 3,
            'Completed': 4,
            'Cancelled': -1, // Cancelled status doesn't show in timeline
          };

          // If status is cancelled, show the last completed step or Requested
          let activeIdx = statusMap[current] ?? 0;
          if (activeIdx === -1) {
            // For cancelled, show Requested as the last visible state
            activeIdx = 0;
          }
          const ROW_HEIGHT = 44;
          return (
            <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Status</Text>
              <View style={styles.statusList}>
                {/* Track (gray) */}
                <View style={styles.statusTrack} />
                {/* Progress (green) - extends to include current step */}
                <View style={[
                  styles.statusProgress,
                  { height: activeIdx * ROW_HEIGHT + (activeIdx === steps.length - 1 ? 8 : 0) }
                ]} />
                {steps.map((label, idx) => {
                  // Mark completed steps and current step as active
                  const active = idx <= activeIdx;
                  const isCurrent = idx === activeIdx;
                  const isLast = idx === steps.length - 1;
                  return (
                    <View key={label} style={[styles.statusRow, { minHeight: ROW_HEIGHT }]}>
                      <View style={styles.statusDotContainer}>
                        {isLast && active ? (
                          <View style={styles.statusCheckmark}>
                            <Ionicons name="checkmark" size={12} color="#ffffff" />
                          </View>
                        ) : (
                          <View style={[styles.statusDot, active ? styles.statusDotActive : styles.statusDotIdle]} />
                        )}
                      </View>
                      <Text style={[styles.statusText, { color: colors.text, fontWeight: active ? '800' : '700' }]}>{label}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })()}

        {/* Prescription Image - Show only for prescription requests */}
        {(() => {
          const prescriptionItem = order?.items?.find((item: any) => item?.category === 'Prescription');
          if (!prescriptionItem) return null;

          return (
            <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {/* Pharmacist selections */}
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Your assigned pharmacist will make the following selections:</Text>
              <View style={styles.selectionList}>
                <View style={styles.selectionRow}>
                  <View style={styles.selectionBar} />
                  <Text style={[styles.selectionText, { color: colors.text }]}>Add medicines</Text>
                </View>
                <View style={styles.selectionRow}>
                  <View style={styles.selectionBar} />
                  <Text style={[styles.selectionText, { color: colors.text }]}>Apply best coupon</Text>
                </View>
                <View style={styles.selectionRow}>
                  <View style={styles.selectionBar} />
                  <Text style={[styles.selectionText, { color: colors.text }]}>Choose earliest delivery date</Text>
                </View>
              </View>

              {/* Attached prescriptions - text removed per request */}

              <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 8 }]}>Prescription Image</Text>
              <View style={styles.prescriptionImageContainer}>
                <Image
                  source={{ uri: prescriptionItem.image || prescriptionItem.prescriptionUrl }}
                  style={styles.prescriptionImage}
                  resizeMode="contain"
                />
              </View>
              {/* Validation display removed */}
            </View>
          );
        })()}

        {/* Professional Assigned */}
        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Professional assigned</Text>
          <View style={styles.proRow}>
            {assignedEmployee?.photo ? (
              <Image source={{ uri: assignedEmployee.photo }} style={styles.proAvatar} />
            ) : assignedEmployee?.avatar ? (
              <View style={[styles.proAvatar, { backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 18 }}>{assignedEmployee.avatar}</Text>
              </View>
            ) : (
              <Image source={require('../../assets/images/profile.png')} style={styles.proAvatar} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={[styles.proName, { color: colors.text }]}>
                {assignedEmployee?.name || order?.items?.[0]?.providerName || 'To be assigned'}
              </Text>
              {assignedEmployee && (
                <>
                  {assignedEmployee.role && (
                    <Text style={[styles.proMeta, { color: colors.textSecondary, marginTop: 2 }]}>{assignedEmployee.role}</Text>
                  )}

                </>
              )}
            </View>
          </View>
        </View>



        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.infoRow}>
            <Ionicons name="checkmark-circle" size={18} color="#10B981" />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>Charges may be subject to change based on the final scope of work. Any adjustments to the scope may result in a modification of the total cost.</Text>
          </View>
        </View>

        {/* Booking Details */}
        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitleLarge, { color: colors.text }]}>Booking Details</Text>
          <View style={styles.rowItem}>
            <Ionicons name="pricetag-outline" size={18} color={colors.textSecondary as any} />
            <Text style={[styles.rowText, { color: colors.text }]}>#{order?.id || '—'}</Text>
          </View>
          <View style={styles.rowDivider} />
          <View style={styles.rowItem}>
            <Ionicons name="headset-outline" size={18} color={colors.textSecondary as any} />
            <Text style={[styles.rowText, { color: colors.text }]}>{order?.status || '—'}</Text>
          </View>
          <View style={styles.rowDivider} />
          <View style={styles.rowItem}>
            <Ionicons name="call-outline" size={18} color={colors.textSecondary as any} />
            <Text style={[styles.rowText, { color: colors.text }]}>
              {(order?.address?.name || profile?.name || 'Customer')}  •  {(order?.address?.phone || order?.phone || profile?.phone || '—')}
            </Text>
          </View>
          <View style={styles.rowDivider} />
          <View style={[styles.rowItem, { alignItems: 'flex-start' }]}>
            <Ionicons name="location-outline" size={18} color={colors.textSecondary as any} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowText, { color: colors.text }]} numberOfLines={0}>
                {order?.address ? `${order.address.line1 || order.address.address || ''}, ${order.address.city || ''}, ${order.address.state || ''} - ${order?.address?.pincode || ''}` : 'Address not available'}
              </Text>
            </View>
          </View>
          <View style={styles.rowDivider} />
          <View style={styles.rowItem}>
            <Ionicons name="calendar-outline" size={18} color={colors.textSecondary as any} />
            <Text style={[styles.rowText, { color: colors.text }]}>
              {(() => {
                if (!firstSchedule) return 'Schedule not set';
                let d = String(firstSchedule.date || '');
                // strip day prefix like "Wed, " if present
                d = d.replace(/^[^,]+,\s*/, '');
                return `Scheduled on ${d}, ${firstSchedule.time}`;
              })()}
            </Text>
          </View>
        </View>

        {/* Payment Method */}
        {(() => {
          const mode = order?.payment_mode || order?.payment?.mode;
          const reference = order?.payment_reference || order?.payment?.reference;
          const amount = order?.payment_amount ?? order?.payment?.amount ?? null;
          const currency = order?.currency || 'INR';
          const modeLabel = mode === 'online' ? 'Razorpay' : 'Pay after service';

          return (
            <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Payment Method</Text>
              <View style={styles.rowItem}>
                <Ionicons name="card-outline" size={18} color={colors.textSecondary as any} />
                <Text style={[styles.rowText, { color: colors.text }]}>{modeLabel}</Text>
              </View>
              {reference ? (
                <>
                  <View style={styles.rowDivider} />
                  <View style={styles.rowItem}>
                    <Ionicons name="receipt-outline" size={18} color={colors.textSecondary as any} />
                    <Text style={[styles.rowText, { color: colors.text }]}>{reference}</Text>
                  </View>
                </>
              ) : null}
              {amount !== null ? (
                <>
                  <View style={styles.rowDivider} />
                  <View style={styles.rowItem}>
                    <Ionicons name="cash-outline" size={18} color={colors.textSecondary as any} />
                    <Text style={[styles.rowText, { color: colors.text }]}>Paid: {currency === 'INR' ? '₹' : ''}{amount}</Text>
                  </View>
                </>
              ) : null}

            </View>
          );
        })()}

        {/* Payment Summary */}
        {(() => {
          const isPrescription = (order?.items || []).some((it: any) => it?.category === 'Prescription');
          if (isPrescription) {
            return (
              <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Payment Summary</Text>
                <View style={[styles.payRow, { justifyContent: 'center' }]}>
                  <Text style={[styles.payTotalLabel, { color: colors.text }]}>Under Progress</Text>
                </View>
              </View>
            );
          }
          return (
            <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Payment Summary</Text>
              <View style={styles.payRow}>
                <Text style={[styles.payLabel, { color: colors.textSecondary }]}>Subtotal</Text>
                <Text style={[styles.payValue, { color: colors.text }]}>₹{order?.breakdown?.subtotal ?? 0}</Text>
              </View>
              <View style={styles.payRow}>
                <Text style={[styles.payLabel, { color: colors.textSecondary }]}>Service Fee</Text>
                <Text style={[styles.payValue, { color: colors.text }]}>₹{order?.breakdown?.serviceFee ?? 0}</Text>
              </View>
              <View style={styles.payRow}>
                <Text style={[styles.payLabel, { color: colors.textSecondary }]}>Tax</Text>
                <Text style={[styles.payValue, { color: colors.text }]}>₹{order?.breakdown?.tax ?? 0}</Text>
              </View>
              <View style={styles.payRow}>
                <Text style={[styles.payLabel, { color: colors.textSecondary }]}>Discount</Text>
                <Text style={[styles.payValue, { color: colors.text }]}>-₹{order?.breakdown?.discount ?? 0}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.payRow}>
                <Text style={[styles.payTotalLabel, { color: colors.text }]}>Total</Text>
                <Text style={[styles.payTotalValue, { color: colors.text }]}>₹{order?.breakdown?.total ?? order?.total ?? 0}</Text>
              </View>
            </View>
          );
        })()}
        {/* Rate this service - Only show when status is completed */}
        {(() => {
          const currentStatus = (order?.status || '').toLowerCase();
          const isCompleted = currentStatus === 'completed';

          if (!isCompleted) return null;

          return (
            <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Rate this service</Text>

              {(existingReview || order?.rating) ? (
                <View style={[styles.reviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}> 
                  <View style={styles.reviewHeader}>
                    <Text style={[styles.reviewHeaderText, { color: colors.text }]}>Your Review</Text>
                    <Text style={[styles.reviewDate, { color: colors.textSecondary }]}>{(existingReview?.date ?? order?.rating?.date) || ''}</Text>
                  </View>

                  <View style={styles.reviewStarsRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      {[1, 2, 3, 4, 5].map(n => (
                        <Ionicons
                          key={n}
                          name={n <= (existingReview?.rating ?? order?.rating?.rating ?? 0) ? 'star' : 'star-outline'}
                          size={20}
                          color="#F59E0B"
                          style={{ marginRight: 4 }}
                        />
                      ))}
                    </View>
                    <Text style={[styles.reviewScore, { color: colors.text }]}>{existingReview?.rating ?? order?.rating?.rating ?? 0}.0</Text>
                  </View>

                  {(() => {
                    const reviewText = (existingReview?.review ?? order?.rating?.review) || '';
                    if (!reviewText) return null;
                    const short = reviewText.length > 220 ? `${reviewText.slice(0, 220).trim()}…` : reviewText;
                    return (
                      <View style={{ marginTop: 8 }}>
                        <Text style={[styles.reviewText, { color: colors.text }]} numberOfLines={showFullReviewText ? undefined : 5}>{showFullReviewText ? reviewText : short}</Text>
                        {reviewText.length > 220 && (
                          <TouchableOpacity onPress={() => setShowFullReviewText(s => !s)} style={styles.reviewToggle}>
                            <Text style={{ color: colors.primary, fontWeight: '700' }}>{showFullReviewText ? 'Show less' : 'Read more'}</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })()}
                </View>
              ) : (
                <>
                  <View style={{ flexDirection: 'row', marginBottom: 8 }}>
                    {[1, 2, 3, 4, 5].map(n => (
                      <TouchableOpacity key={n} onPress={() => setRating(prev => (prev === n ? n - 1 : n))} style={{ marginRight: 6 }}>
                        <Ionicons name={n <= rating ? 'star' : 'star-outline'} size={24} color="#F59E0B" />
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TextInput
                    style={[styles.reviewInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.card }]}
                    placeholder="Write your feedback (optional)"
                    placeholderTextColor={colors.textSecondary as any}
                    value={review}
                    onChangeText={setReview}
                    multiline
                  />
                  <TouchableOpacity
                    style={[styles.submitBtn, rating === 0 && { opacity: 0.6 }]}
                    disabled={rating === 0}
                    onPress={async () => {
                      try {
                        if (!order?.id) {
                          Alert.alert('Error', 'Booking ID not found');
                          return;
                        }

                        // Extract provider_id (should be providers_services.id - bigint) and doctor_id
                        let finalProviderId: number | null = null;
                        let finalDoctorId: string | null = null;

                        const bookingProviderId = (order as any).provider_id;
                        const orderId = order.id;

                        // Resolve booking.provider_id to a numeric providers_services.id when possible
                        if (bookingProviderId) {
                          const asNumber = Number(bookingProviderId);
                          const isNumeric = !isNaN(asNumber);
                          try {
                            if (isNumeric) {
                              // booking.provider_id already references providers_services.id
                              finalProviderId = asNumber;
                            } else {
                              // booking.provider_id might be a providers_profiles.id (UUID).
                              // Find a providers_services row for that profile and use its id.
                              const { data: svcForProfile } = await supabase
                                .from('providers_services')
                                .select('id')
                                .eq('provider_profile', String(bookingProviderId))
                                .limit(1)
                                .maybeSingle();

                              if (svcForProfile && (svcForProfile as any).id) {
                                finalProviderId = Number((svcForProfile as any).id);
                              } else {
                                // Fallback: try to find any providers_services by user_id (if bookingProviderId was a user id)
                                const { data: svcByUser } = await supabase
                                  .from('providers_services')
                                  .select('id')
                                  .eq('user_id', String(bookingProviderId))
                                  .limit(1)
                                  .maybeSingle();
                                if (svcByUser && (svcByUser as any).id) {
                                  finalProviderId = Number((svcByUser as any).id);
                                }
                              }
                            }
                          } catch (e) {
                            console.warn('Error resolving booking provider id for review:', e);
                          }
                        }

                        // 2. Try to get Doctor UUID for doctor appointments
                        const isDoctorOrder = (order?.items || []).some((it: any) => it?.category === 'Doctor Appointment');
                        if (isDoctorOrder) {
                          try {
                            const { data: apptData } = await supabase
                              .from('doctor_appointments')
                              .select('doctor_user_id')
                              .eq('booking_id', orderId)
                              .maybeSingle();

                            if (apptData?.doctor_user_id) {
                              finalDoctorId = apptData.doctor_user_id;
                            } else {
                              console.warn('Could not find doctor UUID for booking:', orderId);
                            }
                          } catch (e) {
                            console.warn('Failed to fetch doctor ID:', e);
                          }
                        }

                        const ratingData = {
                          rating,
                          review: review.trim(),
                          date: new Date().toISOString().slice(0, 10),
                          timestamp: new Date().toISOString(),
                        };

                        // Save to database
                        const { data: dbReview, error: dbError } = await ReviewsApi.upsertForBooking(order.id, {
                          booking_id: order.id,
                          service_name: order?.items?.[0]?.title || 'Service',
                          provider_id: finalProviderId != null ? String(finalProviderId) : null,
                          doctor_id: finalDoctorId,
                          provider_name: (order as any).provider_name || order?.items?.[0]?.providerName || order?.items?.[0]?.provider?.name || 'Provider',
                          category: order?.items?.[0]?.category || 'General',
                          rating,
                          review_text: review.trim(),
                        });

                        if (dbError) {
                          console.error('Database review submission error:', dbError);
                          Alert.alert('Notice', 'Review saved locally. Database sync failed.');
                        }

                        // Also save to global reviews (for profile/ratings page) as backup
                        const payload = {
                          id: Date.now(),
                          service: (order?.items?.[0]?.title || 'Service'),
                          provider: (order?.items?.[0]?.providerName || order?.items?.[0]?.provider?.name || 'Provider'),
                          ...ratingData,
                          bookingId: order?.id,
                          category: order?.items?.[0]?.category || 'General',
                        };

                        const raw = await AsyncStorage.getItem('user_reviews');
                        const list = raw ? JSON.parse(raw) : [];

                        // Check if review already exists for this booking
                        const existingIndex = list.findIndex((r: any) => r.bookingId === order?.id);
                        if (existingIndex !== -1) {
                          // Update existing review
                          list[existingIndex] = payload;
                        } else {
                          // Add new review
                          list.unshift(payload);
                        }

                        await AsyncStorage.setItem('user_reviews', JSON.stringify(list));

                        // Update the order state with rating data
                        setOrder(prev => prev ? { ...prev, rating: ratingData } : null);

                        // Save to AsyncStorage for this specific booking
                        const bookingKey = `booking_${order.id}`;
                        const existingBooking = await AsyncStorage.getItem(bookingKey);
                        const bookingData = existingBooking ? JSON.parse(existingBooking) : order;
                        bookingData.rating = ratingData;
                        await AsyncStorage.setItem(bookingKey, JSON.stringify(bookingData));

                        // Also update in the orders list
                        const profileRaw = await AsyncStorage.getItem('user_profile');
                        const profile = profileRaw ? JSON.parse(profileRaw) : {};
                        const phone = (profile?.phone || '').trim();
                        if (phone) {
                          const ordersKey = `user_orders:${phone}`;
                          const ordersRaw = await AsyncStorage.getItem(ordersKey);
                          if (ordersRaw) {
                            const orders = JSON.parse(ordersRaw);
                            const orderIndex = orders.findIndex((o: any) => o.id === order.id);
                            if (orderIndex !== -1) {
                              orders[orderIndex].rating = ratingData;
                              await AsyncStorage.setItem(ordersKey, JSON.stringify(orders));
                            }
                          }
                        }

                        setRating(0);
                        setReview('');
                        Alert.alert('Thank you!', `Your review has been ${existingReview ? 'updated' : 'submitted'} and saved to this booking.`);
                      } catch (error) {
                        Alert.alert('Error', 'Failed to submit review');
                      }
                    }}
                  >
                    <Text style={styles.submitText}>
                      {existingReview ? 'Update Rating' : 'Submit Rating'}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          );
        })()}
      </ScrollView>

      {/* Razorpay WebView logic moved to /payment screen */}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingTop: 50, paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1 },
  headerBack: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  sectionCard: { marginHorizontal: 16, marginTop: 12, borderRadius: 16, padding: 16, borderWidth: 1 },
  sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 10 },
  sectionTitleLarge: { fontSize: 26, fontWeight: '900', marginBottom: 10 },
  proRow: { flexDirection: 'row', alignItems: 'center' },
  proAvatar: { width: 56, height: 56, borderRadius: 12, marginRight: 12 },
  proName: { fontSize: 16, fontWeight: '700' },
  proMeta: { fontSize: 12, marginLeft: 6 },
  noteCard: { marginHorizontal: 16, marginTop: 12, borderRadius: 16, padding: 16, borderWidth: 1 },
  noteText: { fontSize: 14, lineHeight: 20 },
  infoCard: { marginHorizontal: 16, marginTop: 12, borderRadius: 16, padding: 14, borderWidth: 1 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start' },
  infoText: { flex: 1, marginLeft: 10, lineHeight: 18 },
  rowItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  rowText: { marginLeft: 10, fontSize: 14, fontWeight: '600' },
  rowDivider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 6, opacity: 0.7 },
  viewMoreLink: { marginTop: 4, fontSize: 14, fontWeight: '700' },
  payRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  payLabel: { fontSize: 14 },
  payValue: { fontSize: 14, fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#e5e7eb', marginVertical: 8 },
  payTotalLabel: { fontSize: 16, fontWeight: '800' },
  payTotalValue: { fontSize: 18, fontWeight: '900' },
  statusRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  statusDotContainer: { width: 20, height: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  statusDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#E5E7EB', borderWidth: 2, borderColor: '#E5E7EB' },
  statusDotActive: { backgroundColor: '#10B981', borderColor: '#10B981' },
  statusDotIdle: { backgroundColor: '#ffffff', borderColor: '#E5E7EB' },
  statusCheckmark: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center' },
  statusText: { fontSize: 18 },
  statusList: { position: 'relative', paddingLeft: 20 },
  statusTrack: { position: 'absolute', left: 29, right: undefined, width: 2, top: 22, bottom: 22, backgroundColor: '#E5E7EB' },
  statusProgress: { position: 'absolute', left: 29, width: 2, top: 22, backgroundColor: '#10B981' },
  reviewInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, minHeight: 80, textAlignVertical: 'top', marginTop: 8 },
  submitBtn: { marginTop: 10, backgroundColor: '#111', borderRadius: 10, height: 44, alignItems: 'center', justifyContent: 'center' },
  submitText: { color: '#fff', fontWeight: '800' },
  currentRatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8
  },
  currentRatingLabel: { fontSize: 14, marginRight: 8 },
  currentRatingStars: { flexDirection: 'row', marginRight: 8 },
  currentRatingDate: { fontSize: 12 },
  prescriptionImageContainer: {
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200
  },
  prescriptionImage: {
    width: '100%',
    height: 300,
    maxHeight: 400
  },
  // validation UI removed
  selectionList: { marginTop: 6 },
  selectionRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 4 },
  selectionBar: { width: 3, height: 18, backgroundColor: '#10B981', borderRadius: 2, marginRight: 8 },
  selectionText: { fontSize: 14, fontWeight: '600' },
  // removed toggle and attached title styles
  serviceBriefContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  serviceImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    marginRight: 16,
  },
  serviceImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  serviceBriefInfo: {
    flex: 1,
  },
  serviceBriefName: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  serviceBriefCategory: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  providerInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  providerNameText: {
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 6,
  },
  reviewCard: { borderRadius: 12, padding: 12, borderWidth: 1 },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reviewHeaderText: { fontSize: 14, fontWeight: '800' },
  reviewDate: { fontSize: 12 },
  reviewStarsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  reviewScore: { marginLeft: 8, fontSize: 14, fontWeight: '800' },
  reviewText: { fontSize: 14, lineHeight: 20 },
  reviewToggle: { marginTop: 6 },
});


