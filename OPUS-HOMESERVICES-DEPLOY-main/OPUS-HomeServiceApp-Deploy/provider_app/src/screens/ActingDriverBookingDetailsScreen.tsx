import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { moderateScale } from '../utils/responsive';
import { useTheme } from '../context/ThemeContext';
import { CustomerBookingsAPI } from '../lib/customerBookings';
import { supabase } from '../lib/supabase';
import { useVerification } from '../hooks/useVerification';
import BottomTab from '../components/BottomTab';

const sectorGradient: [string, string] = ['#004c8f', '#0c1a5d'];
const sectorPrimary = '#3B5BFD';

const ActingDriverBookingDetailsScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors } = useTheme();
  const { verification } = useVerification();
  const bookingId = (route.params as any)?.bookingId;

  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hasFetched, setHasFetched] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const fetchBookingDetails = useCallback(async () => {
    let willRedirect = false;
    if (!bookingId) {
      willRedirect = true;
      (navigation as any).navigate('ActingDriversDashboard');
      return;
    }
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        willRedirect = true;
        (navigation as any).navigate('ActingDriversDashboard');
        return;
      }
      // If verification not loaded yet, keep showing loading so we never flash "Booking not found"
      if (verification?.selected_sector !== 'Acting Drivers') {
        return;
      }
      const { data: rawBooking } = await supabase
        .from('bookings')
        .select('id, acting_driver_id')
        .eq('id', bookingId)
        .single();

      if (!rawBooking || rawBooking.acting_driver_id !== user.id) {
        willRedirect = true;
        Alert.alert('Error', 'Booking not found or access denied', [
          { text: 'OK', onPress: () => (navigation as any).navigate('ActingDriversDashboard') },
        ]);
        return;
      }
      const data = await CustomerBookingsAPI.getById(bookingId);
      if (!data) {
        willRedirect = true;
        Alert.alert('Error', 'Booking not found', [
          { text: 'OK', onPress: () => (navigation as any).navigate('ActingDriversDashboard') },
        ]);
        return;
      }
      setBooking(data);
    } catch (error) {
      console.error('Error fetching booking:', error);
      Alert.alert('Error', 'Failed to load booking details', [
        { text: 'OK', onPress: () => (navigation as any).navigate('ActingDriversDashboard') },
      ]);
      willRedirect = true;
    } finally {
      if (!willRedirect) {
        setLoading(false);
        setHasFetched(true);
      }
    }
  }, [bookingId, navigation, verification?.selected_sector]);

  useFocusEffect(
    useCallback(() => {
      fetchBookingDetails();
    }, [fetchBookingDetails])
  );

  const updateStatus = async (newStatus: 'confirmed' | 'in_progress' | 'completed' | 'cancelled') => {
    if (!booking) return;
    try {
      setUpdatingStatus(true);
      const currentStatus = booking.statusRaw ?? (booking.status || '').toString().toLowerCase();
      const success = await CustomerBookingsAPI.updateStatus(
        booking.id,
        newStatus,
        newStatus === 'cancelled' ? currentStatus : undefined
      );
      if (success) {
        const messages: Record<string, string> = {
          confirmed: 'Booking accepted!',
          in_progress: 'Trip started.',
          completed: 'Booking completed!',
          cancelled: 'Booking cancelled.',
        };
        Alert.alert('Success', messages[newStatus] || 'Updated.', [
          { text: 'OK', onPress: () => fetchBookingDetails() },
        ]);
      } else {
        Alert.alert('Error', 'Failed to update status. Please try again.');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      Alert.alert('Error', 'Failed to update status.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancel Booking',
      'Are you sure you want to cancel this booking?',
      [
        { text: 'No', style: 'cancel' },
        { text: 'Yes, Cancel', style: 'destructive', onPress: () => updateStatus('cancelled') },
      ]
    );
  };

  const handleReject = () => {
    Alert.alert(
      'Reject Booking',
      'Are you sure you want to reject this booking request?',
      [
        { text: 'No', style: 'cancel' },
        { text: 'Yes, Reject', style: 'destructive', onPress: () => updateStatus('cancelled') },
      ]
    );
  };

  const handleMarkAsPaid = async () => {
    if (!booking) return;
    try {
      setUpdatingStatus(true);
      const success = await CustomerBookingsAPI.updatePaymentStatus(booking.id, 'paid');
      if (success) {
        Alert.alert('Success', 'Payment marked as received!', [
          { text: 'OK', onPress: () => fetchBookingDetails() },
        ]);
      } else {
        Alert.alert('Error', 'Failed to update payment status. Please try again.');
      }
    } catch (error) {
      console.error('Error marking as paid:', error);
      Alert.alert('Error', 'Failed to update payment status.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const getStatusDisplay = (status: string) => {
    const m: Record<string, string> = {
      pending: 'Requested',
      requested: 'Requested',
      new: 'Requested',
      confirmed: 'Confirmed',
      in_progress: 'In Progress',
      inprogress: 'In Progress',
      completed: 'Completed',
      cancelled: 'Cancelled',
    };
    return m[(status || '').toLowerCase()] || status;
  };

  const getStatusColor = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'completed') return '#10B981';
    if (s === 'in_progress' || s === 'inprogress') return '#F59E0B';
    if (s === 'confirmed') return '#3B5BFD';
    if (s === 'cancelled') return '#EF4444';
    return '#6B7280';
  };

  // Show loading until first fetch has completed (avoids brief "Booking not found" flash)
  if (!hasFetched || loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={sectorPrimary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading booking...</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // Never show "Booking not found" inline — keep showing loading until we have booking or have redirected
  if (!booking) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={sectorPrimary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading booking...</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const firstItem = Array.isArray(booking.items) ? booking.items[0] : null;
  const bookingDate = firstItem?.bookingDate || booking.schedule?.[0]?.date || '—';
  const bookingTime = firstItem?.bookingTime || booking.schedule?.[0]?.time || '—';
  const bookingEndTime = firstItem?.bookingEndTime;
  const estimatedHours = firstItem?.estimatedHours;
  const address = booking.customerAddress || booking.address;
  const addressLine = address?.line1
    ? [address.line1, address.city, address.state, address.pincode].filter(Boolean).join(', ')
    : booking.location || '—';
  const statusLower = (booking.status || '').toLowerCase();
  // API returns "New" for pending/requested; treat as pending so Accept/Reject bar shows
  const isPending = statusLower === 'pending' || statusLower === 'requested' || statusLower === 'new';
  const isConfirmed = statusLower === 'confirmed';
  const isInProgress = statusLower === 'in_progress' || statusLower === 'inprogress';
  const isCompleted = statusLower === 'completed';
  const isCancelled = statusLower === 'cancelled';

  const steps = ['Requested', 'Confirmed', 'In Progress', 'Completed'];
  const stepIndex = isCancelled ? -1 : isCompleted ? 3 : isInProgress ? 2 : isConfirmed ? 1 : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={sectorGradient[0]} translucent />
      <LinearGradient colors={sectorGradient} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.header}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={() => (navigation as any).navigate('ActingDriversDashboard')}
              style={styles.headerBack}
            >
              <Ionicons name="arrow-back" size={moderateScale(24)} color="#ffffff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Booking Details</Text>
            <View style={{ width: moderateScale(40) }} />
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Status badge */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Status</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(booking.status) + '20' }]}>
              <Text style={[styles.statusBadgeText, { color: getStatusColor(booking.status) }]}>
                {getStatusDisplay(booking.status)}
              </Text>
            </View>
          </View>
          {!isCancelled && stepIndex >= 0 && (
            <View style={styles.timeline}>
              {steps.map((step, idx) => (
                <View key={step} style={styles.timelineRow}>
                  <View style={styles.timelineDotLine}>
                    <View
                      style={[
                        styles.timelineDot,
                        idx <= stepIndex ? { backgroundColor: sectorPrimary } : { backgroundColor: colors.border },
                      ]}
                    />
                    {idx < steps.length - 1 && (
                      <View
                        style={[
                          styles.timelineLine,
                          { backgroundColor: idx < stepIndex ? sectorPrimary : colors.border },
                        ]}
                      />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.timelineLabel,
                      idx <= stepIndex ? { color: colors.text, fontWeight: '600' } : { color: colors.textSecondary },
                    ]}
                  >
                    {step}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Customer & Pickup */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.text }]}>Customer & Pickup</Text>
          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={moderateScale(20)} color={sectorPrimary} />
            <Text style={[styles.infoText, { color: colors.text }]}>{booking.customerName || 'Customer'}</Text>
          </View>
          {booking.customerPhone ? (
            <TouchableOpacity
              style={styles.infoRow}
              onPress={() => Linking.openURL(`tel:${booking.customerPhone}`)}
            >
              <Ionicons name="call-outline" size={moderateScale(20)} color={sectorPrimary} />
              <Text style={[styles.infoText, { color: colors.primary }]}>{booking.customerPhone}</Text>
            </TouchableOpacity>
          ) : null}
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={moderateScale(20)} color={sectorPrimary} />
            <Text style={[styles.infoText, { color: colors.textSecondary }]} numberOfLines={3}>
              {addressLine}
            </Text>
          </View>
        </View>

        {/* Date & Time */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.text }]}>Date & Time</Text>
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={moderateScale(20)} color={sectorPrimary} />
            <Text style={[styles.infoText, { color: colors.text }]}>{bookingDate}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={moderateScale(20)} color={sectorPrimary} />
            <Text style={[styles.infoText, { color: colors.text }]}>
              {bookingTime}
              {bookingEndTime ? ` – ${bookingEndTime}` : ''}
            </Text>
          </View>
          {estimatedHours != null && (
            <View style={styles.infoRow}>
              <Ionicons name="hourglass-outline" size={moderateScale(20)} color={sectorPrimary} />
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>~{estimatedHours} hours</Text>
            </View>
          )}
        </View>

        {/* Fare & Payment */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.text }]}>Fare & Payment</Text>
          {booking.breakdown && (
            <>
              {booking.breakdown.subtotal != null && (
                <View style={styles.fareRow}>
                  <Text style={[styles.fareLabel, { color: colors.textSecondary }]}>Subtotal</Text>
                  <Text style={[styles.fareValue, { color: colors.text }]}>₹{booking.breakdown.subtotal}</Text>
                </View>
              )}
              {booking.breakdown.serviceFee != null && (
                <View style={styles.fareRow}>
                  <Text style={[styles.fareLabel, { color: colors.textSecondary }]}>Service fee</Text>
                  <Text style={[styles.fareValue, { color: colors.text }]}>₹{booking.breakdown.serviceFee}</Text>
                </View>
              )}
              {booking.breakdown.tax != null && (
                <View style={styles.fareRow}>
                  <Text style={[styles.fareLabel, { color: colors.textSecondary }]}>Tax</Text>
                  <Text style={[styles.fareValue, { color: colors.text }]}>₹{booking.breakdown.tax}</Text>
                </View>
              )}
            </>
          )}
          <View style={[styles.fareRow, styles.fareTotal]}>
            <Text style={[styles.fareLabel, { color: colors.text }]}>Total</Text>
            <Text style={[styles.fareValue, { color: sectorPrimary, fontWeight: '700' }]}>{booking.amount}</Text>
          </View>
          <View style={[styles.paymentTag, { borderColor: colors.border }]}>
            <Ionicons name="cash-outline" size={moderateScale(18)} color={colors.textSecondary} />
            <Text style={[styles.paymentTagText, { color: colors.textSecondary }]}>{booking.paymentMode}</Text>
            {(booking.payment_status || '').toLowerCase() === 'paid' && (
              <View style={[styles.paidBadge, { backgroundColor: '#10B98120' }]}>
                <Text style={[styles.paidBadgeText, { color: '#10B981' }]}>Paid</Text>
              </View>
            )}
          </View>
        </View>

        {/* Accept / Reject (scrollable when new booking is requested) */}
        {isPending && !isCancelled && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.text }]}>Actions</Text>
            <View style={styles.acceptRejectRow}>
              <TouchableOpacity
                style={[styles.acceptRejectButton, { backgroundColor: '#EF4444', borderWidth: 1, borderColor: '#EF4444' }]}
                onPress={handleReject}
                disabled={updatingStatus}
              >
                <Text style={styles.primaryButtonText}>Reject</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.acceptRejectButton, { backgroundColor: sectorPrimary }]}
                onPress={() => updateStatus('confirmed')}
                disabled={updatingStatus}
              >
                {updatingStatus ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.primaryButtonText}>Accept</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Actions (for confirmed / in progress) */}
        {!isCancelled && !isCompleted && !isPending && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.text }]}>Actions</Text>
            {isConfirmed && (
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: sectorPrimary }]}
                onPress={() => updateStatus('in_progress')}
                disabled={updatingStatus}
              >
                {updatingStatus ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Start Trip</Text>
                )}
              </TouchableOpacity>
            )}
            {isInProgress && booking.paymentMode === 'Cash on Service' && (booking.payment_status || '').toLowerCase() !== 'paid' && (
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: '#F59E0B', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: moderateScale(8) }]}
                onPress={handleMarkAsPaid}
                disabled={updatingStatus}
              >
                {updatingStatus ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="cash-outline" size={moderateScale(20)} color="#ffffff" />
                    <Text style={styles.primaryButtonText}>Cash Received</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            {isInProgress && (booking.paymentMode !== 'Cash on Service' || (booking.payment_status || '').toLowerCase() === 'paid') && (
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: '#10B981' }]}
                onPress={() => updateStatus('completed')}
                disabled={updatingStatus}
              >
                {updatingStatus ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Complete Trip</Text>
                )}
              </TouchableOpacity>
            )}
            {!isCompleted && !isInProgress && (
              <TouchableOpacity
                style={[styles.secondaryButton, { borderColor: '#EF4444' }]}
                onPress={handleCancel}
                disabled={updatingStatus}
              >
                <Text style={[styles.secondaryButtonText, { color: '#EF4444' }]}>Cancel Booking</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

      </ScrollView>

      <BottomTab active="Home" />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: moderateScale(12), fontSize: moderateScale(14) },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: moderateScale(24) },
  errorText: { marginTop: moderateScale(16), fontSize: moderateScale(16), fontWeight: '600' },
  header: { paddingHorizontal: moderateScale(12), paddingBottom: moderateScale(12) },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerBack: { padding: moderateScale(8) },
  headerTitle: { fontSize: moderateScale(18), fontWeight: '700', color: '#ffffff' },
  scrollView: { flex: 1 },
  scrollContent: {
    padding: moderateScale(16),
    paddingTop: moderateScale(16),
    paddingBottom: moderateScale(100),
  },
  card: {
    borderRadius: moderateScale(12),
    borderWidth: 1,
    padding: moderateScale(16),
    marginBottom: moderateScale(16),
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: moderateScale(12) },
  cardTitle: { fontSize: moderateScale(16), fontWeight: '700' },
  statusBadge: { paddingHorizontal: moderateScale(10), paddingVertical: moderateScale(4), borderRadius: moderateScale(20) },
  statusBadgeText: { fontSize: moderateScale(13), fontWeight: '600' },
  timeline: { marginTop: moderateScale(8) },
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: moderateScale(4) },
  timelineDotLine: { alignItems: 'center', marginRight: moderateScale(10) },
  timelineDot: { width: moderateScale(10), height: moderateScale(10), borderRadius: 5 },
  timelineLine: { width: 2, height: moderateScale(18) },
  timelineLabel: { fontSize: moderateScale(14), flex: 1, paddingTop: moderateScale(2) },
  sectionLabel: { fontSize: moderateScale(15), fontWeight: '700', marginBottom: moderateScale(12) },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: moderateScale(10), gap: moderateScale(10) },
  infoText: { flex: 1, fontSize: moderateScale(14) },
  fareRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: moderateScale(8) },
  fareTotal: { marginTop: moderateScale(8), paddingTop: moderateScale(8), borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  fareLabel: { fontSize: moderateScale(14) },
  fareValue: { fontSize: moderateScale(14) },
  paymentTag: { flexDirection: 'row', alignItems: 'center', gap: moderateScale(8), marginTop: moderateScale(12), paddingTop: moderateScale(12), borderTopWidth: 1, borderTopColor: '#E5E7EB', flexWrap: 'wrap' },
  paymentTagText: { fontSize: moderateScale(13) },
  paidBadge: { paddingHorizontal: moderateScale(8), paddingVertical: moderateScale(4), borderRadius: moderateScale(6), marginLeft: moderateScale(8) },
  paidBadgeText: { fontSize: moderateScale(12), fontWeight: '700' },
  primaryButton: { paddingVertical: moderateScale(14), borderRadius: moderateScale(12), alignItems: 'center', marginBottom: moderateScale(10) },
  primaryButtonText: { color: '#ffffff', fontSize: moderateScale(16), fontWeight: '700' },
  secondaryButton: { paddingVertical: moderateScale(14), borderRadius: moderateScale(12), alignItems: 'center', borderWidth: 1.5 },
  secondaryButtonText: { fontSize: moderateScale(16), fontWeight: '600' },
  acceptRejectRow: { flexDirection: 'row', gap: moderateScale(12), marginTop: moderateScale(4) },
  acceptRejectButton: { flex: 1, paddingVertical: moderateScale(14), borderRadius: moderateScale(12), alignItems: 'center' },
});

export default ActingDriverBookingDetailsScreen;
