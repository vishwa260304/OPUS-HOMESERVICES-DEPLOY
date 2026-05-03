import { Ionicons } from '@expo/vector-icons';
import React, { useLayoutEffect } from 'react';
import {
  Alert,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter, useNavigation, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { BookingsApi } from '../lib/bookings';
import { hapticButtonPress } from '../utils/haptics';
import { useCart } from '../context/CartContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { updateBookingPayment, createDoctorAppointmentBooking, AppointmentData } from '../lib/appointmentService';
import { useAnalytics } from '../context/AnalyticsContext';
import RazorpayCheckout from 'react-native-razorpay';
import Constants from 'expo-constants';

const RAZORPAY_KEY_ID =
  Constants.expoConfig?.extra?.EXPO_PUBLIC_RAZORPAY_KEY_ID ??
  process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID;

const PaymentScreen = () => {
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams();
  const { getTotalPrice, cartItems, clearCart } = useCart();
  const { user } = useAuth();
  const { trackCustomEvent } = useAnalytics();
  const [isProcessing, setIsProcessing] = React.useState(false);

  // Check if this is a doctor appointment booking
  const bookingId = params.bookingId as string | undefined;
  const isDoctorAppointment = params.isDoctorAppointment === 'true';
  const appointmentAmount = params.amount ? parseFloat(params.amount as string) : undefined;
  const doctorId = params.doctorId as string | undefined;
  const appointmentDataJson = params.appointmentData as string | undefined;
  const createNewPatient = params.createNewPatient === 'true';

  // For existing bookings or doctor appointments, use the passed amount; otherwise use cart total
  const isExistingBooking = !!bookingId;
  const itemTotal = (isExistingBooking || isDoctorAppointment) && appointmentAmount ? appointmentAmount : getTotalPrice();
  const visitationFee = (isExistingBooking || isDoctorAppointment) ? 0 : 60; // No visitation fee for existing bookings/doctor appointments
  const tax = (isExistingBooking || isDoctorAppointment) ? 0 : Math.round(itemTotal * 0.18); // No tax for existing bookings/doctor appointments
  const totalToPay = itemTotal + visitationFee + tax;

  React.useEffect(() => {
    trackCustomEvent('checkout_started', {
      existing_booking: isExistingBooking,
      doctor_appointment: isDoctorAppointment,
      amount: totalToPay,
    });
  }, [isExistingBooking, isDoctorAppointment, totalToPay, trackCustomEvent]);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false } as any);
  }, [navigation]);

  const finalizeBooking = async (opts: { mode: 'post_service' | 'online'; status: 'Pending' | 'Paid' | 'Failed'; reference?: string | null; amount?: number | null; }) => {
    if (isProcessing) {
      return;
    }

    setIsProcessing(true);

    try {
      hapticButtonPress();

      if (!isExistingBooking && !isDoctorAppointment && getTotalPrice() <= 0) {
        Alert.alert('Empty cart', 'Please add a service before checkout.');
        return;
      }

      // Handle doctor appointment bookings - CREATE booking only after payment success
      if (isDoctorAppointment && doctorId && appointmentDataJson) {
        try {
          // Parse appointment data
          const appointmentData: AppointmentData = JSON.parse(appointmentDataJson);

          // Create booking in database only after payment is confirmed
          const paymentStatus = opts.status === 'Paid' ? 'paid' : opts.status === 'Pending' ? 'pending' : 'failed';
          const paymentMode = opts.mode === 'online' ? 'online' : 'post_service';

          const result = await createDoctorAppointmentBooking(
            doctorId,
            appointmentData,
            paymentMode,
            paymentStatus,
            opts.reference ?? null,
            opts.amount ?? null,
            createNewPatient
          );

          if (result.success && result.bookingId) {
            if (__DEV__) console.log('Booking created successfully after payment:', result.bookingId);
            trackCustomEvent('booking_confirmed', { booking_id: result.bookingId, payment_mode: opts.mode });
            router.replace('/booking/confirmed');
          } else {
            trackCustomEvent('booking_failed', { reason: result.error || 'create_booking_failed' });
            Alert.alert('Error', result.error || 'Failed to create booking. Please try again.');
          }
        } catch (error: any) {
          console.error('Error creating doctor appointment booking:', error);
          Alert.alert('Error', 'Failed to create booking. Please try again.');
        }
        return;
      }

      // Handle existing bookings (if bookingId exists, update it)
      if (bookingId) {
        if (opts.mode === 'online') {
          // Update existing booking to online payment
          const success = await updateBookingPayment(
            bookingId,
            'online',
            opts.status.toLowerCase() as 'paid' | 'pending' | 'failed',
            opts.reference ?? null,
            opts.amount ?? null
          );

          if (success) {
            // For doctor appointments, we might want a different confirmation or just back
            if (isDoctorAppointment) {
              router.replace('/booking/confirmed');
            } else {
              Alert.alert('Success', 'Payment completed successfully!');
              router.back();
            }
          } else {
            Alert.alert('Error', 'Failed to update payment. Please try again.');
          }
        } else {
          // Pay after service logic for existing booking
          if (isDoctorAppointment) {
            router.replace('/booking/confirmed');
          } else {
            router.back();
          }
        }
        return;
      }

      // Handle regular cart bookings (existing logic)
      const profileRaw = await AsyncStorage.getItem('user_profile');
      const profile = profileRaw ? JSON.parse(profileRaw) : {};
      const phone = (profile?.phone || '').trim();
      const ordersKey = phone ? `user_orders:${phone}` : null;
      // Enrich with address and schedule for details view
      const scheduleRaw = await AsyncStorage.getItem('service_slots');
      const addressRaw = await AsyncStorage.getItem('selected_checkout_address');
      const schedule = scheduleRaw ? JSON.parse(scheduleRaw) : [];
      const selectedAddress = addressRaw ? JSON.parse(addressRaw) : null;

      const existingRaw = ordersKey ? await AsyncStorage.getItem(ordersKey) : null;
      const existing = existingRaw ? JSON.parse(existingRaw) : [];
      const orderId = `ORD-${Date.now()}`;
      const newOrder = {
        id: orderId,
        status: 'Confirmed',
        createdAt: new Date().toISOString(),
        total: totalToPay,
        breakdown: { subtotal: itemTotal, serviceFee: visitationFee, tax, discount: 0, total: totalToPay },
        items: cartItems,
        phone: phone || undefined,
        address: selectedAddress,
        schedule,
        payment: {
          mode: opts.mode,
          status: opts.status,
          reference: opts.reference ?? null,
          amount: opts.amount ?? null,
        }
      } as any;

      // Try to persist to Supabase - Create individual bookings per cart item
      try {
        const selectedProvidersRaw = await AsyncStorage.getItem('selected_providers');
        const selectedProviders = selectedProvidersRaw ? JSON.parse(selectedProvidersRaw) : {};

        // Import serviceProvidersAPI at the top if not already imported
        const { serviceProvidersAPI } = await import('../lib/serviceProviders');

        // Identify pharmacy items
        const pharmEasyCategories = ['Wellness', 'Diabetes', 'Vitamins', 'Ayurveda', 'Personal Care'];
        const pharmacyItems = cartItems.filter(item => item.category && pharmEasyCategories.includes(item.category));
        const otherItems = cartItems.filter(item => !item.category || !pharmEasyCategories.includes(item.category));

        // Distribute visitation fee: typically applied once per "visit". 
        // We will assign the entire visitation fee to the first non-pharmacy service booking, 
        // to ensure the sum of all bookings equals the cart total.
        let feeRemaining = visitationFee;

        // 1. Create a SINGLE booking for all pharmacy items
        if (pharmacyItems.length > 0) {
          let pharmacySubtotal = 0;

          const preparedPharmacyItems = pharmacyItems.map(item => {
            // Calculate item total cost
            const raw = typeof item.price === 'string' ? item.price : String(item.price ?? '');
            const numeric = parseFloat(String(raw).replace(/[^\d.]/g, ''));
            const price = Number.isFinite(numeric) ? numeric : 0;
            const qty = Number.isFinite(item.quantity) ? item.quantity : 1;
            pharmacySubtotal += price * qty;

            // Normalize image
            const itemImage =
              (typeof item.image === 'object' && item.image !== null && 'uri' in item.image && typeof (item.image as any).uri === 'string'
                ? (item.image as any).uri
                : typeof item.image === 'string'
                  ? item.image
                  : null) ||
              (item as any).imageUri ||
              null;

            return {
              ...item,
              image: itemImage,
            };
          });

          // Pharmacy specific breakdown
          // Assuming NO visitation fee for pharmacy delivery, or if desired, change logic here.
          // Tax at 18% standard
          const pharmacyTax = Math.round(pharmacySubtotal * 0.18);
          const pharmacyFee = 0; // Pharmacy usually separate from "visitation"
          const pharmacyTotal = pharmacySubtotal + pharmacyTax + pharmacyFee;

          await BookingsApi.create({
            user_id: user?.id ?? null,
            phone,
            status: 'pending',
            total: pharmacyTotal,
            items: preparedPharmacyItems,
            address: selectedAddress,
            schedule: null, // Pharmacy items don't have service slots
            breakdown: {
              subtotal: pharmacySubtotal,
              serviceFee: pharmacyFee,
              tax: pharmacyTax,
              discount: 0,
              total: pharmacyTotal
            },
            provider_service_id: null,
            provider_name: null,
            payment_mode: opts.mode === 'online' ? 'online' : 'post_service',
            payment_status: (opts.status || 'Pending').toLowerCase(),
            payment_reference: opts.reference ?? null,
            payment_amount: opts.amount ?? null,
            currency: 'INR',
          });
        }

        // 2. Create SEPARATE bookings for other items (Services, Labs, etc.)
        for (const item of otherItems) {
          const providerId = selectedProviders[item.id] || null;
          let providerServiceId: number | null = null;
          let companyName: string | null = null;

          // Get provider info if selected
          if (providerId) {
            try {
              // Extract the numeric ID from provider_XX format
              const numericId = parseInt(providerId.replace('provider_', ''));
              if (!isNaN(numericId)) {
                const { data: mapping } = await serviceProvidersAPI.getMappingByProviderServiceId(numericId);
                if (mapping) {
                  providerServiceId = mapping.provider_service_id;
                  companyName = mapping.company_name || null;
                }
              }
            } catch (err) {
              console.warn('Failed to fetch provider mapping:', err);
            }
          }

          // Normalize image format for booking storage
          const itemImage =
            (typeof item.image === 'object' && item.image !== null && 'uri' in item.image && typeof (item.image as any).uri === 'string'
              ? (item.image as any).uri
              : typeof item.image === 'string'
                ? item.image
                : null) ||
            (item as any).imageUri ||
            null;

          // Calculate individual item total
          const raw = typeof item.price === 'string' ? item.price : String(item.price ?? '');
          const numeric = parseFloat(String(raw).replace(/[^\d.]/g, ''));
          const price = Number.isFinite(numeric) ? numeric : 0;
          // Use quantity if present, though likely 1 for services
          const qty = Number.isFinite(item.quantity) ? item.quantity : 1;
          const itemSubtotal = price * qty;

          const itemTax = Math.round(itemSubtotal * 0.18);

          // Apply remaining fee to the first non-pharmacy item
          const itemFee = feeRemaining;
          feeRemaining = 0; // Consume fee so next items don't get it

          const itemTotalCalculated = itemSubtotal + itemTax + itemFee;

          await BookingsApi.create({
            user_id: user?.id ?? null,
            phone,
            status: 'pending',
            total: itemTotalCalculated,
            items: [{
              ...item,
              image: itemImage,  // Override with normalized string/null value
            }],
            address: selectedAddress,
            schedule: schedule ? schedule.filter((s: any) => s.serviceId === item.id) : null,
            breakdown: {
              subtotal: itemSubtotal,
              serviceFee: itemFee,
              tax: itemTax,
              discount: 0,
              total: itemTotalCalculated
            },
            provider_service_id: providerServiceId,
            provider_name: companyName,
            payment_mode: opts.mode === 'online' ? 'online' : 'post_service',
            payment_status: (opts.status || 'Pending').toLowerCase(),
            payment_reference: opts.reference ?? null,
            payment_amount: opts.amount ?? null,
            currency: 'INR',
          });
        }
      } catch (err) {
        console.error('Failed to create bookings:', err);
      }

      if (ordersKey) {
        await AsyncStorage.setItem(ordersKey, JSON.stringify([newOrder, ...existing]));
      }
      await clearCart();
      trackCustomEvent('booking_confirmed', { order_id: orderId, payment_mode: opts.mode, amount: totalToPay });
      router.replace('/booking/confirmed');
    } catch {
      trackCustomEvent('booking_failed', { reason: 'finalize_booking_exception' });
      Alert.alert('Error', 'Failed to confirm booking. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const confirmBooking = async () => finalizeBooking({ mode: 'post_service', status: 'Pending', reference: null, amount: null });

  const payOnline = async () => {
    if (!isExistingBooking && !isDoctorAppointment && getTotalPrice() <= 0) {
      Alert.alert('Empty cart', 'Please add a service before checkout.');
      return;
    }

    const razorpayKey = RAZORPAY_KEY_ID;

    if (!razorpayKey) {
      Alert.alert('Online payment unavailable', 'Please choose pay after service for this booking.');
      return;
    }

    try {
      const data = await RazorpayCheckout.open({
        description: 'FIXIT Service Payment',
        currency: 'INR',
        key: razorpayKey,
        amount: String(Math.round(totalToPay * 100)),
        name: 'FIXIT',
        prefill: { contact: user?.phone || undefined, email: user?.email || undefined },
        theme: { color: '#004c8f' },
      });

      await finalizeBooking({
        mode: 'online',
        status: 'Paid',
        reference: data?.razorpay_payment_id ?? null,
        amount: totalToPay,
      });
    } catch (error: any) {
      trackCustomEvent('booking_failed', { reason: error?.description || 'razorpay_cancelled' });
      Alert.alert('Payment not completed', error?.description || 'Please try again or choose pay after service.');
    }
  };

  const Row = ({
    icon,
    title,
    subtitle,
    onPress,
    disabled = false,
    loading = false,
  }: {
    icon: React.ReactNode;
    title: string;
    subtitle?: string;
    onPress?: () => void;
    disabled?: boolean;
    loading?: boolean;
  }) => (
    <TouchableOpacity
      style={[styles.row, disabled && styles.rowDisabled]}
      onPress={onPress || hapticButtonPress}
      disabled={disabled}
    >
      <View style={styles.rowLeft}>
        <View style={styles.rowIcon}>{icon}</View>
        <View>
          <Text style={styles.rowTitle}>{title}</Text>
          {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      {loading ? <ActivityIndicator color="#004c8f" /> : <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* White Header */}
      <View style={styles.whiteHeader}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <View style={styles.whiteHeaderCenter}>
          <Text style={styles.whiteHeaderTitle}>Select payment method</Text>
          <Text style={styles.whiteHeaderSub}>Amount to pay: ₹{totalToPay}</Text>
        </View>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <Text style={styles.sectionHeaderText}>Pay now</Text>
        <View style={styles.cardList}>
          <Row
            icon={<Ionicons name="card-outline" size={18} color="#6B7280" />}
            title="Pay online"
            subtitle={isProcessing ? 'Processing your payment...' : 'Cards, UPI and wallets via Razorpay'}
            onPress={payOnline}
            disabled={isProcessing || totalToPay <= 0}
            loading={isProcessing}
          />
        </View>

        {/* Pay after service */}
        <Text style={styles.sectionHeaderText}>Pay after service</Text>
        <View style={styles.cardList}>
          <Row
            icon={<Ionicons name="time-outline" size={18} color="#6B7280" />}
            title="Pay online after service"
            subtitle={isProcessing ? 'Confirming your booking...' : 'Your booking will be confirmed now'}
            onPress={confirmBooking}
            disabled={isProcessing}
            loading={isProcessing}
          />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F7' },
  whiteHeader: {
    backgroundColor: '#FFFFFF',
    paddingTop: 45,
    paddingBottom: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  whiteHeaderCenter: { alignItems: 'center', justifyContent: 'center' },
  whiteHeaderTitle: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
  whiteHeaderSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  sectionHeaderText: { color: '#111827', fontWeight: 'bold', fontSize: 14, paddingHorizontal: 16, marginTop: 14, marginBottom: 8 },
  comingSoonCard: {
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 8,
    paddingVertical: 20,
    paddingHorizontal: 18,
    backgroundColor: '#EEF4FC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D0E0F7',
    alignItems: 'center',
  },
  comingSoonIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  comingSoonTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#004c8f',
    marginBottom: 6,
    textAlign: 'center',
  },
  comingSoonText: {
    fontSize: 13,
    color: '#5B6B7D',
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 8,
  },
  cardList: { backgroundColor: '#FFFFFF' },
  sectionSpacer: { height: 10, backgroundColor: '#F5F6F7' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 16 },
  rowDisabled: { opacity: 0.7 },
  rowLeft: { flexDirection: 'row', alignItems: 'center' },
  rowIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  rowTitle: { color: '#111827', fontSize: 15, fontWeight: '500' },
  rowSubtitle: { color: '#6B7280', fontSize: 12, marginTop: 4, width: 260, lineHeight: 16 },
});

export default PaymentScreen;
