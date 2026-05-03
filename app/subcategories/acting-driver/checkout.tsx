import React, { useLayoutEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { WebView } from 'react-native-webview';
import Constants from 'expo-constants';

import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { supabase, SUPABASE_FUNCTIONS_URL, SUPABASE_STORAGE_URL as SUPABASE_PUBLIC_STORAGE_URL } from '../../../lib/supabase';
import { hapticButtonPress } from '../../../utils/haptics';

const SUPABASE_STORAGE_URL = `${SUPABASE_PUBLIC_STORAGE_URL}/profile-images`;
const CREATE_ORDER_URL = `${SUPABASE_FUNCTIONS_URL}/create-order`;
const VERIFY_URL = `${SUPABASE_FUNCTIONS_URL}/Verify-payment`;

const { EXPO_PUBLIC_RAZORPAY_KEY_ID } = Constants.expoConfig?.extra || {};
const RAZORPAY_KEY_ID = EXPO_PUBLIC_RAZORPAY_KEY_ID as string | undefined;

const ActingDriverCheckoutScreen: React.FC = () => {
  const navigation = useNavigation();
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();

  // Get driver details from params
  const driverId = params.driverId as string;
  const driverName = params.driverName as string;
  const driverPhoto = params.driverPhoto as string | undefined;
  const farePerHour = params.farePerHour ? parseFloat(params.farePerHour as string) : 0;
  const experience = params.experience as string | undefined;
  const address = params.address as string | undefined;
  const bookingDate = params.bookingDate as string;
  const bookingTime = params.bookingTime as string;
  const bookingEndTime = params.bookingEndTime as string | undefined;

  const [selectedPaymentMode, setSelectedPaymentMode] = useState<'online' | 'post_service'>('post_service');
  const [loading, setLoading] = useState(false);
  const [showWebView, setShowWebView] = useState(false);
  const [razorpayOrderId, setRazorpayOrderId] = useState('');
  const [driverDetails, setDriverDetails] = useState<{
    user_id: string;
    name: string;
    phone: string;
  } | null>(null);
  const [customerAddress, setCustomerAddress] = useState<any>(null);
  const [customerPhone, setCustomerPhone] = useState<string | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [showAddNewAddressModal, setShowAddNewAddressModal] = useState(false);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  
  // New address form state
  const [newAddress, setNewAddress] = useState({
    fullName: '',
    phone: '',
    pincode: '',
    city: '',
    state: '',
    locality: '',
    flatNo: '',
    landmark: '',
    label: 'Home' as 'Home' | 'Work' | 'Other',
  });

  // Fetch driver details from providers_acting_drivers table
  React.useEffect(() => {
    const fetchDriverDetails = async () => {
      if (!driverId) return;
      
      try {
        const { data, error } = await supabase
          .from('providers_acting_drivers')
          .select('user_id, name, phone')
          .eq('id', driverId)
          .single();
        
        if (!error && data) {
          setDriverDetails(data);
        }
      } catch (err) {
        console.error('Error fetching driver details:', err);
      }
    };
    
    fetchDriverDetails();
  }, [driverId]);

  // Fetch customer's phone and all saved addresses
  React.useEffect(() => {
    const fetchCustomerDetails = async () => {
      if (!user?.id) return;
      
      setLoadingAddresses(true);
      try {
        // Fetch user profile for phone
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('phone')
          .eq('id', user.id)
          .single();
        
        if (profile?.phone) {
          setCustomerPhone(profile.phone);
        } else if (user.phone) {
          setCustomerPhone(user.phone);
        }

        // Fetch all saved addresses
        const { data: addresses } = await supabase
          .from('user_addresses')
          .select('id, user_id, label, recipient_name, phone, line1, city, state, pincode, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        
        if (addresses && addresses.length > 0) {
          setSavedAddresses(addresses);
          // Set first address as selected (most recent)
          setCustomerAddress(addresses[0]);
        }
      } catch (err) {
        console.error('Error fetching customer details:', err);
      } finally {
        setLoadingAddresses(false);
      }
    };
    
    fetchCustomerDetails();
  }, [user?.id]);

  // Calculate hours from time range
  const calculateHours = () => {
    if (!bookingEndTime) return 2; // Default 2 hours if no end time
    
    const parseTime = (timeStr: string) => {
      const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (!match) return null;
      let hours = parseInt(match[1]);
      const minutes = parseInt(match[2]);
      const period = match[3].toUpperCase();
      
      if (period === 'PM' && hours !== 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;
      
      return hours + minutes / 60;
    };
    
    const startHours = parseTime(bookingTime);
    const endHours = parseTime(bookingEndTime);
    
    if (startHours === null || endHours === null) return 2;
    
    let diff = endHours - startHours;
    if (diff <= 0) diff += 24; // Handle overnight bookings
    
    return Math.max(1, Math.round(diff * 2) / 2); // Round to nearest 0.5 hour, minimum 1 hour
  };

  const estimatedHours = calculateHours();
  const itemTotal = farePerHour * estimatedHours;
  const serviceFee = 50;
  const tax = Math.round(itemTotal * 0.05);
  const totalToPay = itemTotal + serviceFee + tax;

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const getProfilePhotoUrl = (path: string | null | undefined) => {
    if (!path || path.trim() === '') return null;
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    return `${SUPABASE_STORAGE_URL}/${path}`;
  };

  const profilePhotoUrl = getProfilePhotoUrl(driverPhoto);

  // Reset new address form
  const resetNewAddressForm = () => {
    setNewAddress({
      fullName: '',
      phone: '',
      pincode: '',
      city: '',
      state: '',
      locality: '',
      flatNo: '',
      landmark: '',
      label: 'Home',
    });
  };

  // Save new address to database
  const handleSaveNewAddress = async () => {
    // Validate required fields
    if (!newAddress.fullName.trim()) {
      Alert.alert('Error', 'Please enter full name');
      return;
    }
    if (!newAddress.phone.trim()) {
      Alert.alert('Error', 'Please enter phone number');
      return;
    }
    if (!newAddress.pincode.trim()) {
      Alert.alert('Error', 'Please enter pincode');
      return;
    }
    if (!newAddress.city.trim()) {
      Alert.alert('Error', 'Please enter city');
      return;
    }
    if (!newAddress.state.trim()) {
      Alert.alert('Error', 'Please enter state');
      return;
    }
    if (!newAddress.locality.trim()) {
      Alert.alert('Error', 'Please enter locality/area/street');
      return;
    }
    if (!newAddress.flatNo.trim()) {
      Alert.alert('Error', 'Please enter flat no/building name');
      return;
    }

    if (!user?.id) {
      Alert.alert('Error', 'Please login to save address');
      return;
    }

    setSavingAddress(true);

    try {
      // Combine address parts into line1
      const addressLine1 = [
        newAddress.flatNo,
        newAddress.locality,
        newAddress.landmark ? `Near ${newAddress.landmark}` : '',
      ].filter(Boolean).join(', ');

      const { data, error } = await supabase
        .from('user_addresses')
        .insert({
          user_id: user.id,
          label: newAddress.label,
          recipient_name: newAddress.fullName,
          phone: newAddress.phone,
          line1: addressLine1,
          city: newAddress.city,
          state: newAddress.state,
          pincode: newAddress.pincode,
        })
        .select()
        .single();

      if (error) {
        console.error('Error saving address:', error);
        Alert.alert('Error', 'Failed to save address. Please try again.');
        return;
      }

      // Add to saved addresses list and select it
      setSavedAddresses(prev => [data, ...prev]);
      setCustomerAddress(data);
      
      // Close modals and reset form
      setShowAddNewAddressModal(false);
      setShowAddressModal(false);
      resetNewAddressForm();
      
      Alert.alert('Success', 'Address saved successfully!');
    } catch (err) {
      console.error('Error saving address:', err);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setSavingAddress(false);
    }
  };

  const createBooking = async (paymentStatus: 'pending' | 'paid', paymentReference?: string) => {
    if (!user) {
      Alert.alert('Error', 'Please login to continue');
      return null;
    }

    try {
      // Use driver details from state, fallback to params
      const providerName = driverDetails?.name || driverName;
      const actingDriverId = driverDetails?.user_id || null;

      // Create booking item with driver details
      const bookingItem = {
        id: driverId,
        title: `Acting Driver - ${providerName}`,
        category: 'Acting Driver',
        quantity: 1,
        price: totalToPay,
        // Additional driver metadata
        driverId: driverId,
        driverName: providerName,
        driverPhoto: driverPhoto,
        farePerHour: farePerHour,
        experience: experience,
        address: address,
        estimatedHours: estimatedHours,
        bookingDate: bookingDate,
        bookingTime: bookingTime,
        bookingEndTime: bookingEndTime,
      };

      // Create schedule entry (from and to time range for database)
      const scheduleEntry = {
        serviceId: driverId,
        date: bookingDate,
        time: bookingTime,
        endTime: bookingEndTime ?? bookingTime,
      };

      // Create breakdown
      const breakdown = {
        subtotal: itemTotal,
        serviceFee: serviceFee,
        tax: tax,
        discount: 0,
        total: totalToPay,
      };

      // Format customer address for booking (using user_addresses schema)
      const formattedAddress = customerAddress ? {
        id: customerAddress.id,
        name: customerAddress.recipient_name || customerAddress.label,
        phone: customerAddress.phone || customerPhone,
        line1: customerAddress.line1,
        city: customerAddress.city,
        state: customerAddress.state,
        pincode: customerAddress.pincode,
        type: customerAddress.label?.toLowerCase() || 'home',
      } : null;

      // Insert booking directly to include acting_driver_id column
      const { data: booking, error } = await supabase
        .from('bookings')
        .insert({
          user_id: user.id,
          phone: customerPhone || user.phone || null,
          status: 'pending',
          total: totalToPay,
          items: [bookingItem],
          address: formattedAddress,
          schedule: [scheduleEntry],
          breakdown: breakdown,
          provider_name: providerName,
          payment_mode: selectedPaymentMode,
          payment_status: paymentStatus,
          payment_reference: paymentReference || null,
          payment_amount: totalToPay,
          currency: 'INR',
          acting_driver_id: actingDriverId, // Driver's user_id stored here
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating booking:', error);
        return null;
      }

      return booking;
    } catch (error) {
      console.error('Error creating booking:', error);
      return null;
    }
  };

  const handlePayLater = async () => {
    hapticButtonPress();
    
    // Validate address is selected
    if (!customerAddress) {
      Alert.alert('Address Required', 'Please select a pickup address to continue.');
      return;
    }
    
    setLoading(true);

    try {
      const booking = await createBooking('pending');
      
      if (booking) {
        router.replace('/booking/confirmed');
      } else {
        Alert.alert('Error', 'Failed to create booking. Please try again.');
      }
    } catch (error) {
      console.error('Error:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePayNow = async () => {
    hapticButtonPress();
    
    // Validate address is selected
    if (!customerAddress) {
      Alert.alert('Address Required', 'Please select a pickup address to continue.');
      return;
    }
    
    if (!RAZORPAY_KEY_ID) {
      Alert.alert('Configuration Error', 'Payment gateway is not configured. Please try pay later option.');
      return;
    }

    setLoading(true);

    try {
      // Create Razorpay order
      const response = await fetch(CREATE_ORDER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: totalToPay * 100, // Razorpay expects amount in paise
          currency: 'INR',
          receipt: `driver_booking_${Date.now()}`,
        }),
      });

      const orderData = await response.json();

      if (orderData.id) {
        setRazorpayOrderId(orderData.id);
        setShowWebView(true);
      } else {
        Alert.alert('Error', 'Failed to create payment order. Please try again.');
      }
    } catch (error) {
      console.error('Error creating order:', error);
      Alert.alert('Error', 'Failed to initiate payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleWebViewMessage = async (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      if (data.type === 'payment_success') {
        setShowWebView(false);
        setLoading(true);

        // Verify payment
        const verifyResponse = await fetch(VERIFY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            razorpay_order_id: data.razorpay_order_id,
            razorpay_payment_id: data.razorpay_payment_id,
            razorpay_signature: data.razorpay_signature,
          }),
        });

        const verifyData = await verifyResponse.json();

        if (verifyData.verified) {
          const booking = await createBooking('paid', data.razorpay_payment_id);
          
          if (booking) {
            router.replace('/booking/confirmed');
          } else {
            Alert.alert('Error', 'Payment successful but booking failed. Please contact support.');
          }
        } else {
          Alert.alert('Payment Failed', 'Payment verification failed. Please try again.');
        }
        
        setLoading(false);
      } else if (data.type === 'payment_failed' || data.type === 'payment_cancelled') {
        setShowWebView(false);
        Alert.alert('Payment Cancelled', 'Payment was cancelled. You can try again or choose pay later option.');
      }
    } catch (error) {
      console.error('WebView message error:', error);
    }
  };

  const razorpayHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
    </head>
    <body>
      <script>
        var options = {
          key: '${RAZORPAY_KEY_ID}',
          amount: ${totalToPay * 100},
          currency: 'INR',
          name: 'Fixit',
          description: 'Acting Driver Booking',
          order_id: '${razorpayOrderId}',
          handler: function(response) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'payment_success',
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature
            }));
          },
          modal: {
            ondismiss: function() {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'payment_cancelled' }));
            }
          },
          prefill: {
            name: '${user?.user_metadata?.full_name || ''}',
            email: '${user?.email || ''}',
          },
          theme: { color: '#004c8f' }
        };
        var rzp = new Razorpay(options);
        rzp.on('payment.failed', function(response) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'payment_failed', error: response.error }));
        });
        rzp.open();
      </script>
    </body>
    </html>
  `;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Checkout</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Driver Card */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Booking Details</Text>
          
          <View style={styles.driverInfo}>
            {profilePhotoUrl ? (
              <Image source={{ uri: profilePhotoUrl }} style={styles.driverPhoto} />
            ) : (
              <View style={[styles.placeholderPhoto, { backgroundColor: '#E5E7EB' }]}>
                <Ionicons name="person" size={30} color="#6B7280" />
              </View>
            )}
            <View style={styles.driverDetails}>
              <Text style={[styles.driverName, { color: colors.text }]}>{driverName}</Text>
              {experience && (
                <Text style={[styles.driverExp, { color: colors.textSecondary }]}>
                  {experience} years experience
                </Text>
              )}
              {address && (
                <Text style={[styles.driverAddress, { color: colors.textSecondary }]} numberOfLines={1}>
                  {address}
                </Text>
              )}
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.bookingDetails}>
            <View style={styles.bookingRow}>
              <Ionicons name="calendar-outline" size={18} color={colors.secondary} />
              <Text style={[styles.bookingLabel, { color: colors.textSecondary }]}>Date</Text>
              <Text style={[styles.bookingValue, { color: colors.text }]}>{bookingDate}</Text>
            </View>
            <View style={styles.bookingRow}>
              <Ionicons name="time-outline" size={18} color={colors.secondary} />
              <Text style={[styles.bookingLabel, { color: colors.textSecondary }]}>Time</Text>
              <Text style={[styles.bookingValue, { color: colors.text }]}>
                {bookingTime}{bookingEndTime ? ` - ${bookingEndTime}` : ''}
              </Text>
            </View>
            {bookingEndTime && (
              <View style={styles.bookingRow}>
                <Ionicons name="hourglass-outline" size={18} color={colors.secondary} />
                <Text style={[styles.bookingLabel, { color: colors.textSecondary }]}>Duration</Text>
                <Text style={[styles.bookingValue, { color: colors.text }]}>{estimatedHours} hours</Text>
              </View>
            )}
          </View>
        </View>

        {/* Pickup Address */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.addressHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 0 }]}>Pickup Address</Text>
            <TouchableOpacity onPress={() => setShowAddressModal(true)}>
              <Text style={[styles.changeText, { color: colors.secondary }]}>
                {customerAddress ? 'Change' : 'Add'}
              </Text>
            </TouchableOpacity>
          </View>

          {loadingAddresses ? (
            <ActivityIndicator size="small" color={colors.secondary} style={{ marginTop: 16 }} />
          ) : customerAddress ? (
            <View style={styles.selectedAddress}>
              <View style={[styles.addressIconContainer, { backgroundColor: `${colors.secondary}15` }]}>
                <Ionicons 
                  name={customerAddress.label === 'Work' ? 'briefcase' : customerAddress.label === 'Other' ? 'location' : 'home'} 
                  size={20} 
                  color={colors.secondary} 
                />
              </View>
              <View style={styles.addressDetails}>
                <Text style={[styles.addressLabel, { color: colors.text }]}>
                  {customerAddress.label || 'Home'}
                  {customerAddress.recipient_name ? ` - ${customerAddress.recipient_name}` : ''}
                </Text>
                <Text style={[styles.addressText, { color: colors.textSecondary }]} numberOfLines={2}>
                  {customerAddress.line1}
                  {customerAddress.city ? `, ${customerAddress.city}` : ''}
                  {customerAddress.state ? `, ${customerAddress.state}` : ''}
                  {customerAddress.pincode ? ` - ${customerAddress.pincode}` : ''}
                </Text>
                {(customerAddress.phone || customerPhone) && (
                  <Text style={[styles.addressPhone, { color: colors.textSecondary }]}>
                    📞 {customerAddress.phone || customerPhone}
                  </Text>
                )}
              </View>
            </View>
          ) : (
            <TouchableOpacity 
              style={[styles.addAddressBtn, { borderColor: colors.border }]}
              onPress={() => setShowAddressModal(true)}
            >
              <Ionicons name="add-circle-outline" size={24} color={colors.secondary} />
              <Text style={[styles.addAddressText, { color: colors.secondary }]}>Add pickup address</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Price Breakdown */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Price Breakdown</Text>
          
          <View style={styles.priceRow}>
            <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>
              Driver Fare (₹{farePerHour}/hr × {estimatedHours} hrs est.)
            </Text>
            <Text style={[styles.priceValue, { color: colors.text }]}>₹{itemTotal}</Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>Service Fee</Text>
            <Text style={[styles.priceValue, { color: colors.text }]}>₹{serviceFee}</Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>Tax (5%)</Text>
            <Text style={[styles.priceValue, { color: colors.text }]}>₹{tax}</Text>
          </View>
          
          <View style={[styles.divider, { marginVertical: 12 }]} />
          
          <View style={styles.priceRow}>
            <Text style={[styles.totalLabel, { color: colors.text }]}>Total</Text>
            <Text style={[styles.totalValue, { color: colors.secondary }]}>₹{totalToPay}</Text>
          </View>
        </View>

        {/* Payment Mode */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Payment Mode</Text>
          
          <View
            style={[
              styles.paymentOption,
              { borderColor: colors.secondary, backgroundColor: `${colors.secondary}10` }
            ]}
          >
            <View style={styles.paymentOptionLeft}>
              <Ionicons name="cash-outline" size={24} color={colors.secondary} />
              <View style={styles.paymentOptionText}>
                <Text style={[styles.paymentOptionTitle, { color: colors.text }]}>Pay After Service</Text>
                <Text style={[styles.paymentOptionDesc, { color: colors.textSecondary }]}>Pay cash after the trip</Text>
              </View>
            </View>
            <View style={[styles.radioOuter, { borderColor: colors.secondary }]}>
              <View style={[styles.radioInner, { backgroundColor: colors.secondary }]} />
            </View>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom Button */}
      <View style={[styles.bottomBar, { backgroundColor: colors.background }]}>
        <View style={styles.totalInfo}>
          <Text style={[styles.totalInfoLabel, { color: colors.textSecondary }]}>Total</Text>
          <Text style={[styles.totalInfoValue, { color: colors.text }]}>₹{totalToPay}</Text>
        </View>
        <TouchableOpacity
          onPress={handlePayLater}
          disabled={loading}
          activeOpacity={0.8}
          style={{ flex: 1 }}
        >
          <LinearGradient
            colors={['#004c8f', '#0c1a5d']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.confirmButton}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.confirmButtonText}>Book Now</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Razorpay WebView Modal */}
      <Modal visible={showWebView} animationType="slide" onRequestClose={() => setShowWebView(false)}>
        <View style={styles.webViewContainer}>
          <View style={styles.webViewHeader}>
            <TouchableOpacity onPress={() => setShowWebView(false)} style={styles.webViewClose}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.webViewTitle}>Complete Payment</Text>
            <View style={{ width: 40 }} />
          </View>
          <WebView
            source={{ html: razorpayHTML }}
            onMessage={handleWebViewMessage}
            originWhitelist={['https://checkout.razorpay.com', 'https://*.razorpay.com']}
            style={{ flex: 1 }}
          />
        </View>
      </Modal>

      {/* Address Selection Modal */}
      <Modal 
        visible={showAddressModal} 
        animationType="slide" 
        transparent 
        onRequestClose={() => setShowAddressModal(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <View style={[styles.addressModalSheet, { backgroundColor: colors.surface }]}>
            {/* Modal Handle */}
            <View style={styles.modalHandle} />
            
            {/* Modal Header */}
            <View style={styles.addressModalHeader}>
              <Text style={[styles.addressModalTitle, { color: colors.text }]}>Select Pickup Address</Text>
              <TouchableOpacity 
                style={[styles.modalCloseBtn, { backgroundColor: colors.background }]}
                onPress={() => setShowAddressModal(false)}
              >
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Saved Addresses List */}
            <ScrollView style={styles.addressList} showsVerticalScrollIndicator={false}>
              {savedAddresses.length > 0 ? (
                savedAddresses.map((addr, index) => (
                  <TouchableOpacity
                    key={addr.id || index}
                    style={[
                      styles.addressOption,
                      { 
                        borderColor: customerAddress?.id === addr.id ? colors.secondary : colors.border,
                        backgroundColor: customerAddress?.id === addr.id ? `${colors.secondary}08` : 'transparent'
                      }
                    ]}
                    onPress={() => {
                      setCustomerAddress(addr);
                      setShowAddressModal(false);
                    }}
                  >
                    <View style={[styles.addressOptionIcon, { backgroundColor: `${colors.secondary}15` }]}>
                      <Ionicons 
                        name={addr.label === 'Work' ? 'briefcase' : addr.label === 'Other' ? 'location' : 'home'} 
                        size={20} 
                        color={colors.secondary} 
                      />
                    </View>
                    <View style={styles.addressOptionContent}>
                      <View style={styles.addressOptionHeader}>
                        <Text style={[styles.addressOptionLabel, { color: colors.text }]}>
                          {addr.label || 'Home'}
                        </Text>
                        {addr.recipient_name && (
                          <Text style={[styles.recipientName, { color: colors.textSecondary }]}>
                            ({addr.recipient_name})
                          </Text>
                        )}
                      </View>
                      <Text style={[styles.addressOptionText, { color: colors.textSecondary }]} numberOfLines={2}>
                        {addr.line1}
                        {addr.city ? `, ${addr.city}` : ''}
                        {addr.state ? `, ${addr.state}` : ''}
                        {addr.pincode ? ` - ${addr.pincode}` : ''}
                      </Text>
                      {addr.phone && (
                        <Text style={[styles.addressOptionPhone, { color: colors.textTertiary }]}>
                          📞 {addr.phone}
                        </Text>
                      )}
                    </View>
                    {customerAddress?.id === addr.id && (
                      <View style={[styles.checkCircle, { backgroundColor: colors.secondary }]}>
                        <Ionicons name="checkmark" size={14} color="#fff" />
                      </View>
                    )}
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.noAddressContainer}>
                  <Ionicons name="location-outline" size={48} color={colors.textTertiary} />
                  <Text style={[styles.noAddressText, { color: colors.textSecondary }]}>
                    No saved addresses found
                  </Text>
                  <Text style={[styles.noAddressSubtext, { color: colors.textTertiary }]}>
                    Add an address from your profile settings
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* Add New Address Button */}
            <TouchableOpacity
              style={[styles.addNewAddressBtn, { borderColor: colors.secondary }]}
              onPress={() => {
                setShowAddressModal(false);
                setShowAddNewAddressModal(true);
              }}
            >
              <Ionicons name="add" size={20} color={colors.secondary} />
              <Text style={[styles.addNewAddressText, { color: colors.secondary }]}>Add New Address</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add New Address Modal */}
      <Modal
        visible={showAddNewAddressModal}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setShowAddNewAddressModal(false);
          resetNewAddressForm();
        }}
      >
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <View style={[styles.addAddressModalSheet, { backgroundColor: colors.surface }]}>
            {/* Modal Handle */}
            <View style={styles.modalHandle} />
            
            {/* Modal Header */}
            <View style={styles.addAddressModalHeader}>
              <Text style={[styles.addAddressModalTitle, { color: colors.text }]}>Add New Address</Text>
              <TouchableOpacity 
                style={[styles.modalCloseBtn, { backgroundColor: colors.background }]}
                onPress={() => {
                  setShowAddNewAddressModal(false);
                  resetNewAddressForm();
                }}
              >
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.addAddressForm}>
              {/* Contact Info Section */}
              <Text style={[styles.formSectionTitle, { color: colors.text }]}>Contact Info</Text>
              
              <TextInput
                style={[styles.formInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                placeholder="Full Name"
                placeholderTextColor={colors.textTertiary}
                value={newAddress.fullName}
                onChangeText={(text) => setNewAddress(prev => ({ ...prev, fullName: text }))}
              />
              
              <TextInput
                style={[styles.formInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                placeholder="Phone"
                placeholderTextColor={colors.textTertiary}
                value={newAddress.phone}
                onChangeText={(text) => setNewAddress(prev => ({ ...prev, phone: text }))}
                keyboardType="phone-pad"
              />

              {/* Divider */}
              <View style={[styles.formDivider, { backgroundColor: colors.border }]} />

              {/* Address Info Section */}
              <Text style={[styles.formSectionTitle, { color: colors.text }]}>Address Info</Text>
              
              <View style={styles.formRow}>
                <TextInput
                  style={[styles.formInput, styles.formInputHalf, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                  placeholder="Pincode"
                  placeholderTextColor={colors.textTertiary}
                  value={newAddress.pincode}
                  onChangeText={(text) => setNewAddress(prev => ({ ...prev, pincode: text }))}
                  keyboardType="number-pad"
                  maxLength={6}
                />
                <TextInput
                  style={[styles.formInput, styles.formInputHalf, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                  placeholder="City"
                  placeholderTextColor={colors.textTertiary}
                  value={newAddress.city}
                  onChangeText={(text) => setNewAddress(prev => ({ ...prev, city: text }))}
                />
              </View>

              <TextInput
                style={[styles.formInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                placeholder="State"
                placeholderTextColor={colors.textTertiary}
                value={newAddress.state}
                onChangeText={(text) => setNewAddress(prev => ({ ...prev, state: text }))}
              />

              <TextInput
                style={[styles.formInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                placeholder="Locality / Area / Street"
                placeholderTextColor={colors.textTertiary}
                value={newAddress.locality}
                onChangeText={(text) => setNewAddress(prev => ({ ...prev, locality: text }))}
              />

              <TextInput
                style={[styles.formInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                placeholder="Flat no / Building Name"
                placeholderTextColor={colors.textTertiary}
                value={newAddress.flatNo}
                onChangeText={(text) => setNewAddress(prev => ({ ...prev, flatNo: text }))}
              />

              <TextInput
                style={[styles.formInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                placeholder="Landmark (optional)"
                placeholderTextColor={colors.textTertiary}
                value={newAddress.landmark}
                onChangeText={(text) => setNewAddress(prev => ({ ...prev, landmark: text }))}
              />

              {/* Address Type */}
              <Text style={[styles.formSectionTitle, { color: colors.text, marginTop: 8 }]}>Address Type</Text>
              
              <View style={styles.addressTypeRow}>
                {(['Home', 'Work', 'Other'] as const).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.addressTypeBtn,
                      { 
                        backgroundColor: newAddress.label === type ? colors.secondary : colors.background,
                        borderColor: newAddress.label === type ? colors.secondary : colors.border,
                      }
                    ]}
                    onPress={() => setNewAddress(prev => ({ ...prev, label: type }))}
                  >
                    <Text style={[
                      styles.addressTypeBtnText,
                      { color: newAddress.label === type ? '#fff' : colors.text }
                    ]}>
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={{ height: 20 }} />
            </ScrollView>

            {/* Save Button */}
            <TouchableOpacity
              style={[styles.saveAddressBtn, { opacity: savingAddress ? 0.7 : 1 }]}
              onPress={handleSaveNewAddress}
              disabled={savingAddress}
            >
              <LinearGradient
                colors={['#004c8f', '#0c1a5d']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.saveAddressBtnGradient}
              >
                {savingAddress ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveAddressBtnText}>Save Address</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverPhoto: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E5E7EB',
  },
  placeholderPhoto: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverDetails: {
    marginLeft: 14,
    flex: 1,
  },
  driverName: {
    fontSize: 18,
    fontWeight: '600',
  },
  driverExp: {
    fontSize: 13,
    marginTop: 2,
  },
  driverAddress: {
    fontSize: 13,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 16,
  },
  bookingDetails: {
    gap: 12,
  },
  bookingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bookingLabel: {
    fontSize: 14,
    flex: 1,
  },
  bookingValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  priceLabel: {
    fontSize: 14,
  },
  priceValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 12,
  },
  paymentOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  paymentOptionText: {
    gap: 2,
  },
  paymentOptionTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  paymentOptionDesc: {
    fontSize: 12,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 30,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 16,
  },
  totalInfo: {
    flex: 0.4,
  },
  totalInfoLabel: {
    fontSize: 12,
  },
  totalInfoValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  confirmButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  webViewContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  webViewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  webViewClose: {
    padding: 8,
  },
  webViewTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  // Address Section Styles
  addressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  changeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  selectedAddress: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  addressIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressDetails: {
    flex: 1,
    marginLeft: 12,
  },
  addressLabel: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  addressText: {
    fontSize: 13,
    lineHeight: 18,
  },
  addressPhone: {
    fontSize: 13,
    marginTop: 4,
  },
  addAddressBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    gap: 8,
  },
  addAddressText: {
    fontSize: 15,
    fontWeight: '600',
  },
  // Address Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  addressModalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 30,
    maxHeight: '80%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  addressModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  addressModalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressList: {
    maxHeight: 350,
  },
  addressOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 12,
  },
  addressOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressOptionContent: {
    flex: 1,
    marginLeft: 12,
  },
  addressOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  addressOptionLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  recipientName: {
    fontSize: 13,
    marginLeft: 4,
  },
  addressOptionText: {
    fontSize: 13,
    lineHeight: 18,
  },
  addressOptionPhone: {
    fontSize: 12,
    marginTop: 4,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  noAddressContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  noAddressText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  noAddressSubtext: {
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
  addNewAddressBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    marginTop: 8,
    gap: 8,
  },
  addNewAddressText: {
    fontSize: 15,
    fontWeight: '600',
  },
  // Add New Address Modal Styles
  addAddressModalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 30,
    maxHeight: '90%',
  },
  addAddressModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  addAddressModalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  addAddressForm: {
    maxHeight: 450,
  },
  formSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  formInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    marginBottom: 12,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },
  formInputHalf: {
    flex: 1,
  },
  formDivider: {
    height: 1,
    marginVertical: 16,
  },
  addressTypeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  addressTypeBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  addressTypeBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  saveAddressBtn: {
    marginTop: 16,
  },
  saveAddressBtnGradient: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveAddressBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});

export default ActingDriverCheckoutScreen;
