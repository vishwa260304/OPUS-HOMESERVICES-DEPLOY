import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { moderateScale } from '../utils/responsive';
import { useTheme } from '../context/ThemeContext';
import { CustomerBookingsAPI } from '../lib/customerBookings';

type RouteParams = {
  bookingId?: string;
  booking?: any;
};

const PharmOrderDetails: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const params = (route as any).params as RouteParams;
  const { colors } = useTheme();

  const [booking, setBooking] = useState<any>(params?.booking || null);
  const [loading, setLoading] = useState<boolean>(!params?.booking);

  useEffect(() => {
    const fetch = async () => {
      if (!booking && params?.bookingId) {
        setLoading(true);
        try {
          const b = await CustomerBookingsAPI.getById(params.bookingId);
          setBooking(b);
        } catch (e) {
          console.error('Failed to load booking', e);
          Alert.alert('Error', 'Failed to load booking details');
        } finally {
          setLoading(false);
        }
      }
    };
    fetch();
  }, [params?.bookingId]);

  if (loading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: colors.text }}>No booking found</Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.navigate('PharmDashboard' as never);
            }
          }}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order Details</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ padding: moderateScale(16) }}>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Customer</Text>
          <Text style={[styles.value, { color: colors.text }]}>{booking.customerName}</Text>

          <Text style={[styles.label, { color: colors.textSecondary, marginTop: 12 }]}>Requested</Text>
          <Text style={[styles.value, { color: colors.text }]}>{new Date(booking.createdAt).toLocaleString()}</Text>

          <Text style={[styles.label, { color: colors.textSecondary, marginTop: 12 }]}>Status</Text>
          <Text style={[styles.value, { color: colors.text }]}>{booking.status}</Text>

          <Text style={[styles.label, { color: colors.textSecondary, marginTop: 12 }]}>Amount</Text>
          <Text style={[styles.value, { color: colors.text }]}>{booking.amount}</Text>

          <Text style={[styles.label, { color: colors.textSecondary, marginTop: 12 }]}>Payment</Text>
          <Text style={[styles.value, { color: colors.text }]}>{booking.paymentMode} • {booking.payment_status}</Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, marginTop: moderateScale(12) }]}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Items</Text>
          {booking.items && Array.isArray(booking.items) && booking.items.length > 0 ? (
            booking.items.map((item: any, idx: number) => (
              <View key={idx} style={styles.itemRow}>
                <View style={styles.itemImageWrap}>
                  {item.image ? (
                    <Image source={{ uri: String(item.image).trim() }} style={styles.itemImage} />
                  ) : (
                    <Ionicons name="image-outline" size={20} color="#9CA3AF" />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemTitle, { color: colors.text }]}>{item.title || item.name}</Text>
                  <Text style={[styles.itemMeta, { color: colors.textSecondary }]}>Qty: <Text style={{ fontWeight: '700', color: colors.text }}>{item.quantity || 1}</Text></Text>
                </View>
                <Text style={[styles.itemPrice, { color: colors.text }]}>{item.price}</Text>
              </View>
            ))
          ) : (
            <Text style={{ color: colors.textSecondary }}>No items</Text>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, marginTop: moderateScale(12) }]}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Delivery Address</Text>
          {booking.customerAddress ? (
            <Text style={[styles.value, { color: colors.text }]}>{booking.customerAddress.address || booking.customerAddress.line1}{'\n'}{[booking.customerAddress.city, booking.customerAddress.state, booking.customerAddress.pincode].filter(Boolean).join(', ')}</Text>
          ) : (
            <Text style={{ color: colors.textSecondary }}>No address</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { height: 110, backgroundColor: '#26A69A', paddingTop: 44, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  backBtn: { padding: 8, marginRight: 8 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  content: { flex: 1 },
  card: { padding: moderateScale(12), borderRadius: 12, borderWidth: 1 },
  label: { fontSize: 12, fontWeight: '600' },
  value: { fontSize: 15, marginTop: 6 },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomColor: '#F3F4F6', borderBottomWidth: 1 },
  itemImageWrap: { width: 48, height: 48, borderRadius: 8, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginRight: 12 },
  itemImage: { width: '100%', height: '100%' },
  itemTitle: { fontSize: 14, fontWeight: '700' },
  itemMeta: { fontSize: 12, marginTop: 4 },
  itemPrice: { fontSize: 14, fontWeight: '700' },
});

export default PharmOrderDetails;
