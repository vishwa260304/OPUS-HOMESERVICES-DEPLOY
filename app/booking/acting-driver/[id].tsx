import React, { useEffect, useLayoutEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  StatusBar,
  ActivityIndicator,
  Platform,
  Linking,
  TextInput,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BookingsApi } from '../../../lib/bookings';
import { ReviewsApi } from '../../../lib/reviews';
import { supabase, SUPABASE_STORAGE_URL } from '../../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';

const PROFILE_IMAGES_STORAGE_URL = `${SUPABASE_STORAGE_URL}/profile-images`;

type Booking = {
  id: string;
  status: string;
  created_at?: string;
  total: number;
  items?: any[];
  address?: any;
  schedule?: { date: string; time: string }[];
  breakdown?: { subtotal?: number; serviceFee?: number; tax?: number; discount?: number; total: number };
  payment_mode?: string | null;
  payment_status?: string | null;
  payment_amount?: number | null;
  currency?: string | null;
  acting_driver_id?: string | null;
  rating?: { rating?: number; review?: string; date?: string } | null;
  /** When status is cancelled, last status before cancellation (e.g. requested, confirmed, in_progress). */
  previous_status?: string | null;
};

type Driver = {
  id: string;
  user_id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  driving_experience_years: number | null;
  profile_photo: string | null;
  fare_per_hour: number | null;
  about: string | null;
};

function getProfilePhotoUrl(path: string | null): string | null {
  if (!path || path.trim() === '') return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${PROFILE_IMAGES_STORAGE_URL}/${path}`;
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 4) return '****';
  return '*'.repeat(digits.length - 4) + digits.slice(-4);
}

export default function ActingDriverBookingScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ id: string }>();
  const bookingId = String(params.id || '');

  const [booking, setBooking] = useState<Booking | null>(null);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [existingReview, setExistingReview] = useState<{ rating: number; review: string; date: string } | null>(null);
  const [showFullReviewText, setShowFullReviewText] = useState(false);

  useLayoutEffect(() => {
    try {
      (navigation as any)?.setOptions?.({ headerShown: false });
    } catch (_) {}
  }, [navigation]);

  const loadBookingAndDriver = useCallback(async () => {
    if (!bookingId) {
      setLoading(false);
      setError('Invalid booking');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const cloud = await BookingsApi.getById(bookingId);
      if (!cloud) {
        setError('Booking not found');
        setBooking(null);
        setDriver(null);
        setLoading(false);
        return;
      }

      const actingDriverUserId = (cloud as any).acting_driver_id;
      if (!actingDriverUserId) {
        router.replace(`/booking/${bookingId}` as any);
        return;
      }

      setBooking({
        id: cloud.id,
        status: cloud.status,
        created_at: cloud.created_at,
        total: cloud.total,
        items: cloud.items || [],
        address: cloud.address,
        schedule: cloud.schedule || [],
        breakdown: cloud.breakdown ?? undefined,
        payment_mode: (cloud as any).payment_mode ?? null,
        payment_status: (cloud as any).payment_status ?? null,
        payment_amount: (cloud as any).payment_amount ?? null,
        currency: (cloud as any).currency ?? 'INR',
        acting_driver_id: actingDriverUserId,
        previous_status: (cloud as any).previous_status ?? null,
      });

      const { data: driverData, error: driverError } = await supabase
        .from('providers_acting_drivers')
        .select('id, user_id, name, phone, email, address, driving_experience_years, profile_photo, fare_per_hour')
        .eq('user_id', actingDriverUserId)
        .single();

      if (driverError || !driverData) {
        setDriver(null);
      } else {
        setDriver(driverData as Driver);
      }
    } catch (e) {
      setError('Failed to load booking');
      setBooking(null);
      setDriver(null);
    } finally {
      setLoading(false);
    }
  }, [bookingId, router]);

  useEffect(() => {
    loadBookingAndDriver();
  }, [loadBookingAndDriver]);

  // Realtime subscription for booking status updates
  useEffect(() => {
    if (!bookingId || !booking) return;

    const channel = supabase
      .channel(`acting-driver-booking-realtime-${bookingId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bookings',
          filter: `id=eq.${bookingId}`,
        },
        (payload) => {
          const updated = payload.new as Record<string, any>;
          if (!updated) return;

          setBooking((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              status: updated.status ?? prev.status,
              payment_status: updated.payment_status ?? prev.payment_status,
              payment_mode: updated.payment_mode ?? prev.payment_mode,
              payment_amount: updated.payment_amount ?? prev.payment_amount,
              breakdown: updated.breakdown ?? prev.breakdown,
              previous_status: updated.previous_status ?? prev.previous_status,
            };
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [bookingId, booking?.id]);

  const loadExistingReview = useCallback(async () => {
    if (!bookingId || !booking) return;
    try {
      if (booking.rating) {
        const r = booking.rating as any;
        setExistingReview({ rating: r.rating ?? 0, review: r.review ?? '', date: r.date ?? '' });
        setRating(r.rating ?? 0);
        setReview(r.review ?? '');
        return;
      }
      const { data: dbReviews, error: err } = await ReviewsApi.getByBookingId(bookingId);
      if (!err && dbReviews?.length) {
        const r = dbReviews[0];
        const data = { rating: r.rating, review: r.review_text ?? '', date: r.review_date ?? '' };
        setExistingReview(data);
        setRating(r.rating);
        setReview(r.review_text ?? '');
        return;
      }
      const raw = await AsyncStorage.getItem('user_reviews');
      if (raw) {
        const list = JSON.parse(raw);
        const existing = list.find((r: any) => r.bookingId === bookingId);
        if (existing) {
          setExistingReview({ rating: existing.rating, review: existing.review ?? '', date: existing.date ?? '' });
          setRating(existing.rating);
          setReview(existing.review ?? '');
        }
      }
    } catch (_) {}
  }, [bookingId, booking]);

  useEffect(() => {
    loadExistingReview();
  }, [loadExistingReview]);

  const firstSchedule = useMemo(() => {
    if (!booking?.schedule?.length) {
      const item = booking?.items?.find((it: any) => it?.bookingDate && it?.bookingTime);
      if (item) return { date: item.bookingDate, time: item.bookingTime, endTime: (item as any).bookingEndTime };
      return null;
    }
    const s = booking.schedule[0];
    return { date: s.date, time: s.time, endTime: (s as any).endTime };
  }, [booking]);

  // Timeline: Requested → Confirmed → In Progress → Completed, or when cancelled only show up to last progressed then Cancelled
  const backendStatus = (booking?.status || 'pending').toLowerCase();
  const isCancelled = backendStatus === 'cancelled';
  const allProgressSteps = ['Requested', 'Confirmed', 'In Progress'] as const;

  // When cancelled: last progressed step index (0=Requested, 1=Confirmed, 2=In Progress). Default 0 so we show Requested → Cancelled.
  const previousStatus = (booking?.previous_status || '').toLowerCase();
  const cancelledFromIndex =
    isCancelled
      ? previousStatus === 'in_progress' || previousStatus === 'inprogress'
        ? 2
        : previousStatus === 'confirmed' || previousStatus === 'assigned'
          ? 1
          : 0
      : 0;

  const steps: string[] = isCancelled
    ? [...allProgressSteps.slice(0, cancelledFromIndex + 1), 'Cancelled']
    : ['Requested', 'Confirmed', 'In Progress', 'Completed'];

  const backendToDisplay: Record<string, string> = {
    pending: 'Requested',
    requested: 'Requested',
    new: 'Requested',
    confirmed: 'Confirmed',
    assigned: 'Confirmed',
    in_progress: 'In Progress',
    inprogress: 'In Progress',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };
  const statusMap: Record<string, number> = {
    Requested: 0,
    Confirmed: 1,
    'In Progress': 2,
    Completed: 3,
    Cancelled: steps.length - 1, // last step when cancelled
  };
  const currentLabel = backendToDisplay[backendStatus] || 'Requested';
  const activeIdx = isCancelled ? steps.length - 1 : (statusMap[currentLabel] ?? 0);

  const profilePhotoUrl = driver ? getProfilePhotoUrl(driver.profile_photo) : null;

  if (loading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading booking…</Text>
        </View>
      </View>
    );
  }

  if (error || !booking) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <StatusBar barStyle="dark-content" />
        <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBack}>
            <Ionicons name="arrow-back" size={22} color={colors.text as any} />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingWrap}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.textSecondary} />
          <Text style={[styles.errorText, { color: colors.text }]}>{error || 'Booking not found'}</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={[styles.backBtnText, { color: colors.primary }]}>Go back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBack}>
          <Ionicons name="arrow-back" size={22} color={colors.text as any} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Booking details</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Driver profile card */}
        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Your driver</Text>
          <View style={styles.driverRow}>
            {profilePhotoUrl ? (
              <Image source={{ uri: profilePhotoUrl }} style={styles.driverAvatar} />
            ) : (
              <View style={[styles.driverAvatar, styles.driverAvatarPlaceholder, { backgroundColor: colors.surface }]}>
                <Ionicons name="person" size={36} color={colors.textSecondary as any} />
              </View>
            )}
            <View style={styles.driverInfo}>
              <Text style={[styles.driverName, { color: colors.text }]}>{driver?.name || 'Driver'}</Text>
              {driver?.phone ? (
                (() => {
                  const isConfirmedOrLater = ['confirmed', 'in_progress', 'inprogress', 'completed'].includes(backendStatus);
                  const displayPhone = isConfirmedOrLater ? driver.phone : maskPhone(driver.phone);
                  if (isConfirmedOrLater) {
                    return (
                      <TouchableOpacity
                        style={styles.phoneRow}
                        onPress={() => Linking.openURL(Platform.OS === 'ios' ? `telprompt:${driver.phone}` : `tel:${driver.phone}`)}
                      >
                        <Ionicons name="call-outline" size={16} color={colors.primary} />
                        <Text style={[styles.phoneText, { color: colors.primary }]}>{displayPhone}</Text>
                      </TouchableOpacity>
                    );
                  }
                  return (
                    <View style={styles.phoneRow}>
                      <Ionicons name="call-outline" size={16} color={colors.textSecondary as any} />
                      <Text style={[styles.phoneText, { color: colors.textSecondary }]}>{displayPhone}</Text>
                    </View>
                  );
                })()
              ) : null}
              {driver?.driving_experience_years != null && (
                <Text style={[styles.driverMeta, { color: colors.textSecondary }]}>
                  {driver.driving_experience_years} years experience
                </Text>
              )}
              {driver?.fare_per_hour != null && driver.fare_per_hour > 0 && (
                <Text style={[styles.driverMeta, { color: colors.textSecondary }]}>
                  ₹{driver.fare_per_hour}/hr
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Status – 4 steps, no Assigned */}
        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Status</Text>
          <View style={styles.statusList}>
            <View style={styles.statusTrack} />
            <View style={[styles.statusProgress, { height: activeIdx * 44 }]} />
            {steps.map((label, idx) => {
              const active = idx <= activeIdx;
              const isLast = idx === steps.length - 1;
              const isCancelledStep = label === 'Cancelled';
              return (
                <View key={label} style={[styles.statusRow, { minHeight: 44 }]}>
                  <View style={styles.statusDotContainer}>
                    {isLast && active && isCancelledStep ? (
                      <View style={styles.statusCancelled}>
                        <Ionicons name="close" size={12} color="#fff" />
                      </View>
                    ) : isLast && active ? (
                      <View style={styles.statusCheckmark}>
                        <Ionicons name="checkmark" size={12} color="#fff" />
                      </View>
                    ) : (
                      <View style={[styles.statusDot, active ? (isCancelledStep ? styles.statusDotCancelled : styles.statusDotActive) : styles.statusDotIdle]} />
                    )}
                  </View>
                  <Text style={[styles.statusText, { color: colors.text, fontWeight: active ? '800' : '700' }]}>{label}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Booking details */}
        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Booking details</Text>
          <View style={styles.rowItem}>
            <Ionicons name="pricetag-outline" size={18} color={colors.textSecondary as any} />
            <Text style={[styles.rowText, { color: colors.text }]}>#{booking.id}</Text>
          </View>
          <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
          <View style={styles.rowItem}>
            <Ionicons name="headset-outline" size={18} color={colors.textSecondary as any} />
            <Text style={[styles.rowText, { color: colors.text }]}>{currentLabel}</Text>
          </View>
          {booking.address && (
            <>
              <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
              <View style={[styles.rowItem, { alignItems: 'flex-start' }]}>
                <Ionicons name="location-outline" size={18} color={colors.textSecondary as any} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowText, { color: colors.text }]}>
                    {[booking.address.line1, booking.address.city, booking.address.state, booking.address.pincode].filter(Boolean).join(', ')}
                  </Text>
                </View>
              </View>
            </>
          )}
          {firstSchedule && (
            <>
              <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
              <View style={styles.rowItem}>
                <Ionicons name="calendar-outline" size={18} color={colors.textSecondary as any} />
                <Text style={[styles.rowText, { color: colors.text }]}>
                  {firstSchedule.date} • {firstSchedule.time}
                  {firstSchedule.endTime && firstSchedule.endTime !== firstSchedule.time ? ` – ${firstSchedule.endTime}` : ''}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Payment */}
        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Payment</Text>
          <View style={styles.rowItem}>
            <Ionicons name="card-outline" size={18} color={colors.textSecondary as any} />
            <Text style={[styles.rowText, { color: colors.text }]}>
              {(booking.payment_mode || '').toLowerCase() === 'online' ? 'Online' : 'Pay after service'}
            </Text>
          </View>
          <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
          <View style={styles.rowItem}>
            <Ionicons name="checkmark-done-outline" size={18} color={colors.textSecondary as any} />
            <Text style={[styles.rowText, { color: colors.text }]}>{booking.payment_status || '—'}</Text>
          </View>
          <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
          <View style={styles.rowItem}>
            <Ionicons name="cash-outline" size={18} color={colors.textSecondary as any} />
            <Text style={[styles.rowText, { color: colors.text }]}>
              {booking.currency || 'INR'} {(booking.payment_amount ?? booking.total ?? 0).toLocaleString('en-IN')}
            </Text>
          </View>
        </View>

        {/* Payment summary */}
        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Payment summary</Text>
          {booking.breakdown ? (
            <>
              <View style={styles.payRow}>
                <Text style={[styles.payLabel, { color: colors.textSecondary }]}>Subtotal</Text>
                <Text style={[styles.payValue, { color: colors.text }]}>₹{(booking.breakdown.subtotal ?? 0).toLocaleString('en-IN')}</Text>
              </View>
              <View style={styles.payRow}>
                <Text style={[styles.payLabel, { color: colors.textSecondary }]}>Service fee</Text>
                <Text style={[styles.payValue, { color: colors.text }]}>₹{(booking.breakdown.serviceFee ?? 0).toLocaleString('en-IN')}</Text>
              </View>
              <View style={styles.payRow}>
                <Text style={[styles.payLabel, { color: colors.textSecondary }]}>Tax</Text>
                <Text style={[styles.payValue, { color: colors.text }]}>₹{(booking.breakdown.tax ?? 0).toLocaleString('en-IN')}</Text>
              </View>
              {(booking.breakdown.discount ?? 0) > 0 && (
                <View style={styles.payRow}>
                  <Text style={[styles.payLabel, { color: colors.textSecondary }]}>Discount</Text>
                  <Text style={[styles.payValue, { color: colors.text }]}>-₹{(booking.breakdown.discount ?? 0).toLocaleString('en-IN')}</Text>
                </View>
              )}
              <View style={[styles.payDivider, { backgroundColor: colors.border }]} />
              <View style={styles.payRow}>
                <Text style={[styles.payTotalLabel, { color: colors.text }]}>Total</Text>
                <Text style={[styles.payTotalValue, { color: colors.text }]}>₹{(booking.breakdown.total ?? booking.total ?? 0).toLocaleString('en-IN')}</Text>
              </View>
            </>
          ) : (
            <View style={styles.payRow}>
              <Text style={[styles.payTotalLabel, { color: colors.text }]}>Total</Text>
              <Text style={[styles.payTotalValue, { color: colors.text }]}>₹{(booking.payment_amount ?? booking.total ?? 0).toLocaleString('en-IN')}</Text>
            </View>
          )}
        </View>

        {/* Rate this service – only when status is completed */}
        {backendStatus === 'completed' && (
          <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Rate this service</Text>
            {(existingReview || (booking as any).rating) ? (
              <View style={[styles.reviewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.reviewHeader}>
                  <Text style={[styles.reviewHeaderText, { color: colors.text }]}>Your Review</Text>
                  <Text style={[styles.reviewDate, { color: colors.textSecondary }]}>
                    {(existingReview?.date ?? (booking as any).rating?.date) || ''}
                  </Text>
                </View>
                <View style={styles.reviewStarsRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {[1, 2, 3, 4, 5].map(n => (
                      <Ionicons
                        key={n}
                        name={n <= (existingReview?.rating ?? (booking as any).rating?.rating ?? 0) ? 'star' : 'star-outline'}
                        size={20}
                        color="#F59E0B"
                        style={{ marginRight: 4 }}
                      />
                    ))}
                  </View>
                  <Text style={[styles.reviewScore, { color: colors.text }]}>
                    {existingReview?.rating ?? (booking as any).rating?.rating ?? 0}.0
                  </Text>
                </View>
                {(() => {
                  const reviewText = (existingReview?.review ?? (booking as any).rating?.review) || '';
                  if (!reviewText) return null;
                  const short = reviewText.length > 220 ? `${reviewText.slice(0, 220).trim()}…` : reviewText;
                  return (
                    <View style={{ marginTop: 8 }}>
                      <Text style={[styles.reviewText, { color: colors.text }]} numberOfLines={showFullReviewText ? undefined : 5}>
                        {showFullReviewText ? reviewText : short}
                      </Text>
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
                      if (!booking?.id) {
                        Alert.alert('Error', 'Booking ID not found');
                        return;
                      }
                      const ratingData = {
                        rating,
                        review: review.trim(),
                        date: new Date().toISOString().slice(0, 10),
                        timestamp: new Date().toISOString(),
                      };
                      await ReviewsApi.upsertForBooking(booking.id, {
                        booking_id: booking.id,
                        service_name: booking?.items?.[0]?.title || 'Acting Driver',
                        provider_id: null,
                        acting_driver_id: booking.acting_driver_id ?? null,
                        provider_name: driver?.name ?? 'Driver',
                        category: 'Acting Driver',
                        rating,
                        review_text: review.trim(),
                      });
                      const payload = {
                        id: Date.now(),
                        service: booking?.items?.[0]?.title || 'Acting Driver',
                        provider: driver?.name ?? 'Driver',
                        ...ratingData,
                        bookingId: booking.id,
                        category: 'Acting Driver',
                      };
                      const raw = await AsyncStorage.getItem('user_reviews');
                      const list = raw ? JSON.parse(raw) : [];
                      const idx = list.findIndex((r: any) => r.bookingId === booking.id);
                      if (idx >= 0) list[idx] = payload;
                      else list.unshift(payload);
                      await AsyncStorage.setItem('user_reviews', JSON.stringify(list));
                      setBooking(prev => prev ? { ...prev, rating: ratingData } as Booking : null);
                      setExistingReview({ rating: ratingData.rating, review: ratingData.review, date: ratingData.date });
                      setRating(0);
                      setReview('');
                      Alert.alert('Thank you!', `Your review has been ${existingReview ? 'updated' : 'submitted'}.`);
                    } catch (_) {
                      Alert.alert('Error', 'Failed to submit review');
                    }
                  }}
                >
                  <Text style={styles.submitText}>{existingReview ? 'Update Rating' : 'Submit Rating'}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  headerBack: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 24 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 12, fontSize: 16 },
  errorText: { marginTop: 12, fontSize: 16, textAlign: 'center' },
  backBtn: { marginTop: 16, paddingVertical: 10, paddingHorizontal: 20 },
  backBtnText: { fontSize: 16, fontWeight: '700' },
  sectionCard: { marginTop: 12, borderRadius: 16, padding: 16, borderWidth: 1 },
  sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 12 },
  driverRow: { flexDirection: 'row', alignItems: 'center' },
  driverAvatar: { width: 72, height: 72, borderRadius: 36 },
  driverAvatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  driverInfo: { flex: 1, marginLeft: 16 },
  driverName: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  phoneText: { fontSize: 14, fontWeight: '600', marginLeft: 6 },
  driverMeta: { fontSize: 13, marginTop: 2 },
  statusList: { position: 'relative', paddingLeft: 20 },
  statusTrack: { position: 'absolute', left: 29, width: 2, top: 22, bottom: 22, backgroundColor: '#E5E7EB' },
  statusProgress: { position: 'absolute', left: 29, width: 2, top: 22, backgroundColor: '#10B981' },
  statusRow: { flexDirection: 'row', alignItems: 'center' },
  statusDotContainer: { width: 20, height: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  statusDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#E5E7EB', borderWidth: 2, borderColor: '#E5E7EB' },
  statusDotActive: { backgroundColor: '#10B981', borderColor: '#10B981' },
  statusDotCancelled: { backgroundColor: '#DC2626', borderColor: '#DC2626' },
  statusDotIdle: { backgroundColor: '#fff', borderColor: '#E5E7EB' },
  statusCheckmark: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center' },
  statusCancelled: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#DC2626', justifyContent: 'center', alignItems: 'center' },
  statusText: { fontSize: 16 },
  rowItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  rowText: { marginLeft: 10, fontSize: 14, fontWeight: '600', flex: 1 },
  rowDivider: { height: 1, marginVertical: 6 },
  payRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  payLabel: { fontSize: 14 },
  payValue: { fontSize: 14, fontWeight: '600' },
  payDivider: { height: 1, marginVertical: 8 },
  payTotalLabel: { fontSize: 16, fontWeight: '800' },
  payTotalValue: { fontSize: 18, fontWeight: '900' },
  reviewCard: { borderRadius: 12, padding: 12, borderWidth: 1 },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reviewHeaderText: { fontSize: 14, fontWeight: '800' },
  reviewDate: { fontSize: 12 },
  reviewStarsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  reviewScore: { marginLeft: 8, fontSize: 14, fontWeight: '800' },
  reviewText: { fontSize: 14, lineHeight: 20 },
  reviewToggle: { marginTop: 6 },
  reviewInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, minHeight: 80, textAlignVertical: 'top', marginTop: 8 },
  submitBtn: { marginTop: 10, backgroundColor: '#111', borderRadius: 10, height: 44, alignItems: 'center', justifyContent: 'center' },
  submitText: { color: '#fff', fontWeight: '800' },
});
