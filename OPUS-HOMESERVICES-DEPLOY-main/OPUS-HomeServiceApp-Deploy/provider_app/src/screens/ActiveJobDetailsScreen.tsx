import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Alert, ActivityIndicator, Image, Linking, Modal, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useIsFocused, useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { moderateScale } from '../utils/responsive';
import { useTheme } from '../context/ThemeContext';
import { CustomerBookingsAPI } from '../lib/customerBookings';
import { supabase } from '../lib/supabase';
import { getSelectedSector } from '../utils/appState';
import { api } from '../lib/api';
import { useVerification } from '../hooks/useVerification';

interface Booking {
  id: string;
  customerName: string;
  location: string;
  serviceName: string;
  amount: string;
  paymentMode: string;
  status: string;
  customerPhone?: string;
  customerAddress?: any;
  createdAt: string;
  partnerId?: string | null;
  partnerName?: string | null;
  partnerPhone?: string | null;
  partnerPhoto?: string | null;
  items?: any[];
  schedule?: any[];
  breakdown?: {
    subtotal: number;
    tax: number;
    serviceFee: number;
    discount: number;
  };
  pharmacy_provider_id?: string;
  payment_status?: string;
}

const ActiveJobDetailsScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const isFocused = useIsFocused();
  const { colors } = useTheme();
  const { verification } = useVerification();
  const bookingId = (route.params as any)?.bookingId;

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [updatingStatus, setUpdatingStatus] = useState<boolean>(false);
  const [assignedEmployee, setAssignedEmployee] = useState<any>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [showEmployeeModal, setShowEmployeeModal] = useState<boolean>(false);
  const [loadingEmployees, setLoadingEmployees] = useState<boolean>(false);
  const [showFullId, setShowFullId] = useState<boolean>(false);

  // Sector-aware colors
  const selected = (getSelectedSector?.() as 'home' | 'healthcare' | 'automobile' | 'appliance') || 'home';
  const sectorGradient: [string, string] = selected === 'healthcare' ? ['#0BB48F', '#0A8F6A'] : ['#004c8f', '#0c1a5d'];
  const sectorPrimary = selected === 'healthcare' ? '#0AAE8A' : '#3B5BFD';

  // Fetch booking details
  const fetchBookingDetails = useCallback(async () => {
    if (!bookingId) return;

    try {
      setLoading(true);

      // Get current user to find provider services
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const isActingDriver = verification?.selected_sector === 'Acting Drivers';

      // Acting drivers: bookings are linked via acting_driver_id, not providers_services
      if (isActingDriver) {
        const { data: rawBooking } = await supabase
          .from('bookings')
          .select('id, acting_driver_id')
          .eq('id', bookingId)
          .single();

        if (!rawBooking) {
          Alert.alert('Error', 'Booking not found');
          navigation.goBack();
          setLoading(false);
          return;
        }
        if (rawBooking.acting_driver_id !== user.id) {
          Alert.alert('Error', 'You do not have access to this booking');
          if (navigation.canGoBack()) navigation.goBack();
          else navigation.navigate('Dashboard' as never);
          setLoading(false);
          return;
        }
        const bookingData = await CustomerBookingsAPI.getById(bookingId);
        if (bookingData) {
          setBooking(bookingData as any);
        }
        setLoading(false);
        return;
      }

      // Other providers: require provider_services
      const { data: services } = await supabase
        .from('providers_services')
        .select('id')
        .eq('user_id', user.id);

      if (!services || services.length === 0) {
        // If no services found in providers_services, maybe it's a pharmacy provider
        const bookingDataRaw = await CustomerBookingsAPI.getById(bookingId);
        if (bookingDataRaw && bookingDataRaw.pharmacy_provider_id === user.id) {
          setBooking(bookingDataRaw);
          setLoading(false);
          return;
        }

        Alert.alert('Error', 'No provider services found for your account');
        if (navigation.canGoBack()) {
          navigation.goBack();
        } else {
          navigation.navigate('Dashboard' as never);
        }
        setLoading(false);
        return;
      }

      const providerServiceIds = services.map((s: any) => s.id);

      const bookingData = await CustomerBookingsAPI.getById(bookingId);

      if (!bookingData) {
        Alert.alert('Error', 'Booking not found');
        navigation.goBack();
        setLoading(false);
        return;
      }

      // Verify booking belongs to this provider by checking raw booking data
      const { data: rawBooking } = await supabase
        .from('bookings')
        .select('provider_service_id, provider_id')
        .eq('id', bookingId)
        .single();

      if (rawBooking) {
        const myServiceIdsStrings = providerServiceIds.map((id: number) => String(id));
        const bookingProviderId = rawBooking.provider_id ? String(rawBooking.provider_id) : null;
        const bookingProviderServiceId = rawBooking.provider_service_id ? String(rawBooking.provider_service_id) : null;

        const isAssignedToMe = (bookingProviderId && myServiceIdsStrings.includes(bookingProviderId)) ||
          (bookingProviderServiceId && myServiceIdsStrings.includes(bookingProviderServiceId));
        const isUnassigned = !bookingProviderId && !bookingProviderServiceId;

        if (!isAssignedToMe && !isUnassigned) {
          Alert.alert('Error', 'You do not have access to this booking');
          if (navigation.canGoBack()) navigation.goBack();
          else navigation.navigate('Dashboard' as never);
          setLoading(false);
          return;
        }
      }

      setBooking(bookingData as any);

      // Fetch assigned employee details if exists
      if (bookingData.partnerId || bookingData.assigned_employee_id) {
        const employeeId = bookingData.partnerId || bookingData.assigned_employee_id;
        try {
          const { data: empData } = await supabase
            .from('providers_employees')
            .select('id, name, role, phone, photo, avatar')
            .eq('id', employeeId)
            .single();

          if (empData) {
            setAssignedEmployee(empData);
          }
        } catch (error) {
          console.error('Error fetching employee:', error);
        }
      }
    } catch (error) {
      console.error('Error fetching booking details:', error);
      Alert.alert('Error', 'Failed to load booking details');
    } finally {
      setLoading(false);
    }
  }, [bookingId, navigation, verification?.selected_sector]);

  useFocusEffect(
    useCallback(() => {
      fetchBookingDetails();
    }, [fetchBookingDetails])
  );

  const fetchEmployees = async () => {
    try {
      setLoadingEmployees(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await api.employees.getEmployees(user.id);
      if (error) throw error;

      setEmployees(data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setLoadingEmployees(false);
    }
  };

  const handleAssignEmployee = async (employeeId: string) => {
    if (!booking) return;

    try {
      setUpdatingStatus(true);
      setShowEmployeeModal(false);

      const success = await CustomerBookingsAPI.assignEmployee(booking.id, employeeId);

      if (success) {
        Alert.alert('Success', 'Employee assigned successfully!');
        await fetchBookingDetails();
      } else {
        Alert.alert('Error', 'Failed to assign employee');
      }
    } catch (error) {
      console.error('Error assigning employee:', error);
      Alert.alert('Error', 'Failed to assign employee');
    } finally {
      setUpdatingStatus(false);
    }
  };



  // Update booking status (pattern aligned with ActingDriverBookingDetailsScreen)
  const updateStatus = async (newStatus: 'in_progress' | 'completed' | 'confirmed' | 'cancelled') => {
    if (!booking) return;

    try {
      setUpdatingStatus(true);
      const currentStatus = (booking.status || '').toString().toLowerCase();
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

  const handleMarkAsPaid = async () => {
    if (!booking) return;

    try {
      setUpdatingStatus(true);
      const success = await CustomerBookingsAPI.updatePaymentStatus(booking.id, 'paid');

      if (success) {
        Alert.alert('Success', 'Payment marked as received!');
        await fetchBookingDetails();
      } else {
        Alert.alert('Error', 'Failed to update payment status. Please try again.');
      }
    } catch (error) {
      console.error('Error marking as paid:', error);
      Alert.alert('Error', 'An unexpected error occurred.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Get payment badge properties
  const getPaymentBadge = () => {
    const isPaid = booking?.payment_status?.toLowerCase() === 'paid';
    const isCash = booking?.paymentMode === 'Cash on Service';

    if (isPaid) {
      return { label: 'PAID', color: '#10B981', icon: 'checkmark-circle' as const };
    }
    if (isCash) {
      return { label: 'UNPAID', color: '#F59E0B', icon: 'cash-outline' as const };
    }
    return null;
  };

  // Get status display
  const getStatusDisplay = (status: string) => {
    const statusMap: { [key: string]: string } = {
      'pending': 'Pending',
      'requested': 'Requested',
      'confirmed': 'Confirmed',
      'assigned': 'Assigned',
      'in_progress': 'In Progress',
      'inprogress': 'In Progress',
      'completed': 'Completed',
      'cancelled': 'Cancelled'
    };
    return statusMap[status?.toLowerCase()] || status;
  };

  // Get status color
  const getStatusColor = (status: string) => {
    const statusLower = status?.toLowerCase();
    if (statusLower === 'completed') return '#10B981';
    if (statusLower === 'in_progress' || statusLower === 'inprogress') return '#F59E0B';
    if (statusLower === 'assigned') return '#3B5BFD';
    if (statusLower === 'confirmed') return '#10B981';
    if (statusLower === 'cancelled') return '#EF4444';
    return '#6B7280';
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={sectorPrimary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading booking details...</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={moderateScale(48)} color="#EF4444" />
            <Text style={[styles.errorText, { color: colors.text }]}>Booking not found</Text>
            <TouchableOpacity
              style={[styles.backButton, { backgroundColor: sectorPrimary }]}
              onPress={() => {
                if (navigation.canGoBack()) {
                  navigation.goBack();
                } else {
                  navigation.navigate('Dashboard' as never);
                }
              }}
            >
              <Text style={styles.backButtonText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // Determine which status update buttons to show
  const statusLower = booking.status?.toLowerCase() || '';
  const isNew = statusLower === 'new' || statusLower === 'pending' || statusLower === 'requested';
  const canUpdateToInProgress = statusLower === 'assigned' || statusLower === 'confirmed';
  const canUpdateToCompleted = statusLower === 'inprogress' || statusLower === 'in_progress';
  const hasAssignedPartner = Boolean(
    booking.partnerId ||
    (booking as any).assigned_employee_id ||
    assignedEmployee?.id
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={sectorGradient[0]} translucent={true} />

      {/* Header */}
      <LinearGradient
        colors={sectorGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.header}
      >
        <SafeAreaView edges={['top']}>
          <View style={styles.headerContent}>
            <TouchableOpacity
              onPress={() => {
                if (navigation.canGoBack()) {
                  navigation.goBack();
                } else {
                  navigation.navigate('Dashboard' as never);
                }
              }}
              style={styles.backButtonHeader}
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
        {/* Service Brief Info Card */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, padding: moderateScale(16) }]}>
          <View style={styles.serviceBriefContainer}>
            {booking.items && booking.items[0]?.image ? (
              <Image
                source={{ uri: booking.items[0].image }}
                style={styles.serviceImage}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.serviceImagePlaceholder, { backgroundColor: colors.surface }]}>
                <Ionicons name="construct-outline" size={moderateScale(32)} color={colors.textSecondary} />
              </View>
            )}
            <View style={styles.serviceBriefInfo}>
              <Text style={[styles.serviceBriefName, { color: colors.text }]}>
                {booking.serviceName}
              </Text>
              <Text style={[styles.serviceBriefCategory, { color: colors.textSecondary }]}>
                {booking.items && booking.items[0]?.category || 'Home Service'}
              </Text>
              <View style={styles.serviceBriefPriceRow}>
                {booking.items && (booking.items[0]?.quantity > 1 || (booking as any).items[0]?.qty > 1) && (
                  <Text style={[styles.serviceBriefQty, { color: colors.textSecondary }]}>
                    Qty: {booking.items[0].quantity || (booking as any).items[0].qty}
                  </Text>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Status Progress Timeline */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="time" size={moderateScale(20)} color={sectorPrimary} />
            <Text style={[styles.cardTitle, { color: colors.text }]}>Booking Status</Text>
          </View>
          {(() => {
            const backendStatus = (booking.status || 'pending').toLowerCase();

            if (backendStatus === 'cancelled') {
              return (
                <View style={[styles.noActionCard, { backgroundColor: '#FEE2E2', marginTop: 10 }]}>
                  <Ionicons name="close-circle" size={moderateScale(24)} color="#EF4444" />
                  <Text style={{ color: '#EF4444', fontWeight: '700', marginLeft: 10 }}>This booking was cancelled</Text>
                </View>
              );
            }

            const steps = ['Requested', 'Confirmed', 'Assigned', 'In Progress', 'Completed'];

            const backendToDisplay: { [key: string]: string } = {
              'pending': 'Requested',
              'requested': 'Requested',
              'confirmed': 'Confirmed',
              'assigned': 'Assigned',
              'in_progress': 'In Progress',
              'inprogress': 'In Progress',
              'completed': 'Completed'
            };

            const current = backendToDisplay[backendStatus] || 'Requested';

            const statusMap: { [key: string]: number } = {
              'Requested': 0,
              'Confirmed': 1,
              'Assigned': 2,
              'In Progress': 3,
              'Completed': 4
            };

            const activeIdx = statusMap[current] ?? 0;
            const ROW_HEIGHT = moderateScale(40);

            return (
              <View style={styles.timelineContainer}>
                <View style={styles.timelineWrapper}>
                  {/* Progress line */}
                  <View
                    style={[
                      styles.statusProgress,
                      {
                        height: activeIdx * ROW_HEIGHT + (activeIdx === steps.length - 1 ? 8 : 0),
                        backgroundColor: sectorPrimary
                      }
                    ]}
                  />

                  {/* Timeline steps */}
                  {steps.map((step, idx) => {
                    const isActive = idx <= activeIdx;
                    const isCurrent = idx === activeIdx;

                    return (
                      <View key={step} style={styles.timelineRow}>
                        <View style={[
                          styles.timelineBullet,
                          isActive ? { backgroundColor: sectorPrimary } : { backgroundColor: colors.border }
                        ]}>
                          {isActive && (
                            <View style={[styles.timelineBulletInner, { backgroundColor: '#ffffff' }]} />
                          )}
                        </View>
                        <Text style={[
                          styles.timelineText,
                          isActive ? { color: colors.text, fontWeight: '700' } : { color: colors.textSecondary }
                        ]}>
                          {step}
                        </Text>
                        {isCurrent && (
                          <View style={[styles.currentBadge, { backgroundColor: sectorPrimary + '20' }]}>
                            <Text style={[styles.currentBadgeText, { color: sectorPrimary }]}>Current</Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })()}
        </View>

        {/* Customer Info */}
        <View style={[styles.card, styles.compactCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.cardHeader, styles.compactCardHeader]}>
            <Ionicons name="person" size={moderateScale(18)} color={sectorPrimary} />
            <Text style={[styles.cardTitle, styles.compactCardTitle, { color: colors.text }]}>Customer Information</Text>
          </View>
          <View style={[styles.customerInfoRow, styles.compactInfoRow]}>
            <Text style={[styles.customerInfoLabel, styles.compactInfoLabel, { color: colors.textSecondary }]}>Name</Text>
            <View style={styles.customerInfoValueWrap}>
              <Text
                style={[styles.customerInfoValue, styles.compactInfoValue, { color: colors.text }]}
                numberOfLines={1}
              >
                {booking.customerName}
              </Text>
            </View>
          </View>
          {booking.customerPhone && (
            <TouchableOpacity
              style={[styles.customerInfoRow, styles.compactInfoRow, styles.compactInfoRowLast]}
              onPress={() => Linking.openURL(`tel:${booking.customerPhone}`)}
            >
              <Text style={[styles.customerInfoLabel, styles.compactInfoLabel, { color: colors.textSecondary }]}>Phone</Text>
              <View style={[styles.customerInfoValueWrap, styles.customerInfoValueWrapInline]}>
                <Ionicons name="call" size={moderateScale(14)} color={sectorPrimary} />
                <Text style={[styles.customerInfoValue, styles.compactInfoValue, { color: colors.text }]}>
                  {booking.customerPhone}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Location Info */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="location" size={moderateScale(20)} color={sectorPrimary} />
            <Text style={[styles.cardTitle, { color: colors.text }]}>Address</Text>
          </View>
          {booking.customerAddress ? (
            <View style={styles.addressContainer}>
              <Text style={[styles.addressText, { color: colors.textSecondary }]}>
                {booking.customerAddress.address || booking.customerAddress.line1}
                {booking.customerAddress.line2 ? `\n${booking.customerAddress.line2}` : ''}
                {`\n${(booking.customerAddress.city || '').trim()}, ${(booking.customerAddress.state || '').trim()} - ${booking.customerAddress.pincode}`}
                {booking.customerAddress.landmark && `\nLandmark: ${booking.customerAddress.landmark}`}
              </Text>
            </View>
          ) : (
            <Text style={[styles.infoValue, { color: colors.text, textAlign: 'left', flex: 1 }]}>{booking.location}</Text>
          )}
        </View>

        {/* Service Info */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="briefcase" size={moderateScale(20)} color={sectorPrimary} />
            <Text style={[styles.cardTitle, { color: colors.text }]}>Service Information</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Service</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>{booking.serviceName}</Text>
          </View>

          <View style={styles.breakdownContainer}>
            <Text style={[styles.breakdownTitle, { color: colors.textSecondary }]}>Order Breakup</Text>

            <View style={styles.breakdownRow}>
              <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>Subtotal</Text>
              <Text style={[styles.breakdownValue, { color: colors.text }]}>₹{booking.breakdown?.subtotal ?? 0}</Text>
            </View>

            <View style={styles.breakdownRow}>
              <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>Service Fee</Text>
              <Text style={[styles.breakdownValue, { color: colors.text }]}>₹{booking.breakdown?.serviceFee ?? 0}</Text>
            </View>

            <View style={styles.breakdownRow}>
              <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>Tax</Text>
              <Text style={[styles.breakdownValue, { color: colors.text }]}>₹{booking.breakdown?.tax ?? 0}</Text>
            </View>

            {booking.breakdown && booking.breakdown.discount > 0 && (
              <View style={styles.breakdownRow}>
                <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>Discount</Text>
                <Text style={[styles.breakdownValue, { color: '#10B981' }]}>-₹{booking.breakdown.discount}</Text>
              </View>
            )}

            <View style={[styles.breakdownTotalRow, { borderTopColor: colors.border }]}>
              <Text style={[styles.breakdownTotalLabel, { color: colors.text }]}>Total Amount</Text>
              <Text style={[styles.breakdownTotalValue, { color: colors.text }]}>{booking.amount}</Text>
            </View>
          </View>

          <View style={[styles.infoRow, { marginTop: moderateScale(6), marginBottom: 0, alignItems: 'center' }]}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Payment Mode</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: moderateScale(8) }}>
              <Text style={[styles.infoValue, { color: colors.text }]}>{booking.paymentMode}</Text>
              {(() => {
                const badge = getPaymentBadge();
                if (!badge) return null;
                return (
                  <View style={[styles.paymentBadge, { backgroundColor: badge.color }]}>
                    <Ionicons name={badge.icon} size={moderateScale(12)} color="#ffffff" />
                    <Text style={styles.paymentBadgeText}>{badge.label}</Text>
                  </View>
                );
              })()}
            </View>
          </View>
        </View>

        {/* Schedule Info */}
        {booking.schedule && booking.schedule.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="calendar-outline" size={moderateScale(20)} color={sectorPrimary} />
              <Text style={[styles.cardTitle, { color: colors.text }]}>Schedule</Text>
            </View>
            {booking.schedule.map((s: any, idx: number) => (
              <View key={idx} style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{s.date}</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>{s.time}</Text>
              </View>
            ))}
          </View>
        )}


        {/* Assigned Employee */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="person-circle" size={moderateScale(20)} color={sectorPrimary} />
            <Text style={[styles.cardTitle, { color: colors.text }]}>Assigned Employee</Text>
          </View>
          {assignedEmployee ? (
            <View style={styles.employeeContainer}>
              {assignedEmployee.photo ? (
                <Image
                  source={{ uri: assignedEmployee.photo }}
                  style={styles.employeeAvatar}
                  resizeMode="cover"
                />
              ) : assignedEmployee.avatar ? (
                <View style={[styles.employeeAvatar, { backgroundColor: sectorPrimary }]}>
                  <Text style={styles.employeeAvatarText}>{assignedEmployee.avatar}</Text>
                </View>
              ) : (
                <View style={[styles.employeeAvatar, { backgroundColor: colors.surface }]}>
                  <Ionicons name="person" size={moderateScale(24)} color={colors.textSecondary} />
                </View>
              )}
              <View style={styles.employeeInfo}>
                <Text style={[styles.employeeName, { color: colors.text }]}>{assignedEmployee.name}</Text>
                {assignedEmployee.role && (
                  <Text style={[styles.employeeRole, { color: colors.textSecondary }]}>{assignedEmployee.role}</Text>
                )}
                {assignedEmployee.phone && (
                  <Text style={[styles.employeePhone, { color: colors.textSecondary }]}>{assignedEmployee.phone}</Text>
                )}
              </View>
              {statusLower === 'confirmed' && (
                <TouchableOpacity
                  onPress={() => {
                    fetchEmployees();
                    setShowEmployeeModal(true);
                  }}
                  style={{ padding: moderateScale(8) }}
                >
                  <Ionicons name="create-outline" size={moderateScale(20)} color={sectorPrimary} />
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.unassignedContainer}>
              <Text style={[styles.noActionText, { color: colors.textSecondary, textAlign: 'left' }]}>
                No employee assigned to this job.
              </Text>
              {statusLower === 'confirmed' && (
                <TouchableOpacity
                  style={[styles.assignButton, { backgroundColor: sectorPrimary }]}
                  onPress={() => {
                    fetchEmployees();
                    setShowEmployeeModal(true);
                  }}
                >
                  <Text style={styles.assignButtonText}>Assign Partner</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Booking Details */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="calendar" size={moderateScale(20)} color={sectorPrimary} />
            <Text style={[styles.cardTitle, { color: colors.text }]}>Booking Details</Text>
          </View>
          <TouchableOpacity
            style={styles.infoRow}
            onPress={() => setShowFullId(!showFullId)}
            activeOpacity={0.7}
          >
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Booking ID</Text>
            <Text
              style={[
                styles.infoValue,
                { color: colors.text, flex: 1, marginLeft: moderateScale(12) },
                showFullId && { textAlign: 'right' }
              ]}
              numberOfLines={showFullId ? undefined : 1}
              ellipsizeMode="tail"
            >
              #{booking.id}
            </Text>
          </TouchableOpacity>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Requested On</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {new Date(booking.createdAt).toLocaleString()}
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          {isNew && (
            <View style={styles.newActionButtons}>
              <TouchableOpacity
                style={[styles.actionButton, styles.rejectButton, { flex: 1 }]}
                onPress={handleReject}
                disabled={updatingStatus}
                activeOpacity={0.85}
              >
                {updatingStatus ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="close-circle" size={moderateScale(20)} color="#ffffff" />
                    <Text style={styles.actionButtonText}>Reject</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.acceptButton, { flex: 2 }]}
                onPress={() => updateStatus('confirmed')}
                disabled={updatingStatus}
                activeOpacity={0.85}
              >
                {updatingStatus ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={moderateScale(20)} color="#ffffff" />
                    <Text style={styles.actionButtonText}>Accept Booking</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {canUpdateToInProgress && (
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.inProgressButton,
                (!hasAssignedPartner || updatingStatus) && { opacity: 0.5 }
              ]}
              onPress={() => {
                if (!hasAssignedPartner) {
                  Alert.alert('Assign Partner Required', 'Please assign a partner before starting the job.');
                  return;
                }
                updateStatus('in_progress');
              }}
              disabled={updatingStatus || !hasAssignedPartner}
              activeOpacity={0.85}
            >
              {updatingStatus ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="play-circle" size={moderateScale(20)} color="#ffffff" />
                  <Text style={styles.actionButtonText}>Start Job (In Progress)</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {canUpdateToCompleted && (
            <>
              {booking.paymentMode === 'Cash on Service' && booking.payment_status?.toLowerCase() !== 'paid' ? (
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: '#F59E0B' }]}
                  onPress={handleMarkAsPaid}
                  disabled={updatingStatus}
                  activeOpacity={0.85}
                >
                  {updatingStatus ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <Ionicons name="cash-outline" size={moderateScale(20)} color="#ffffff" />
                      <Text style={styles.actionButtonText}>Cash Received</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.actionButton, styles.completedButton]}
                  onPress={() => updateStatus('completed')}
                  disabled={updatingStatus}
                  activeOpacity={0.85}
                >
                  {updatingStatus ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={moderateScale(20)} color="#ffffff" />
                      <Text style={styles.actionButtonText}>Mark Completed</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </>
          )}

          {!isNew && !canUpdateToInProgress && !canUpdateToCompleted && (
            <View style={[styles.noActionCard, { backgroundColor: colors.surface }]}>
              <Ionicons name="information-circle" size={moderateScale(24)} color={colors.textSecondary} />
              <Text style={[styles.noActionText, { color: colors.textSecondary }]}>
                {statusLower === 'completed'
                  ? 'This booking has been completed'
                  : statusLower === 'cancelled'
                    ? 'This booking has been cancelled'
                    : 'No status updates available at this time'}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Employee Modal */}
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
                    navigation.navigate('AddNewEmployee' as never);
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
              <FlatList
                data={employees}
                keyExtractor={(item) => item.id}
                style={styles.employeeModalContent}
                showsVerticalScrollIndicator={false}
                renderItem={({ item: employee }) => (
                  <TouchableOpacity
                    style={[styles.employeeItem, { borderColor: colors.border }]}
                    onPress={() => handleAssignEmployee(employee.id)}
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
                      <View style={styles.employeeInfoStyle}>
                        <Text style={[styles.employeeNameItem, { color: colors.text }]}>{employee.name}</Text>
                        <Text style={[styles.employeeRoleItem, { color: colors.textSecondary }]}>{employee.role}</Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={moderateScale(20)} color={colors.textSecondary} />
                  </TouchableOpacity>
                )}
              />
            )}
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
  safeArea: {
    flex: 1,
  },
  header: {
    paddingTop: moderateScale(0),
    paddingBottom: moderateScale(16),
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: moderateScale(20),
    paddingTop: moderateScale(10),
  },
  backButtonHeader: {
    width: moderateScale(40),
    height: moderateScale(40),
    borderRadius: moderateScale(20),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: moderateScale(20),
    fontWeight: '800',
    color: '#ffffff',
    flex: 1,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: moderateScale(16),
    paddingBottom: moderateScale(40),
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: moderateScale(40),
  },
  loadingText: {
    marginTop: moderateScale(16),
    fontSize: moderateScale(14),
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: moderateScale(40),
  },
  errorText: {
    marginTop: moderateScale(16),
    fontSize: moderateScale(16),
    fontWeight: '700',
    marginBottom: moderateScale(24),
  },
  backButton: {
    paddingVertical: moderateScale(12),
    paddingHorizontal: moderateScale(24),
    borderRadius: moderateScale(12),
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: moderateScale(16),
    fontWeight: '700',
  },
  timelineContainer: {
    marginTop: moderateScale(8),
  },
  timelineWrapper: {
    position: 'relative',
    paddingLeft: moderateScale(24),
  },
  statusProgress: {
    position: 'absolute',
    left: moderateScale(30.75),
    top: moderateScale(10),
    width: moderateScale(3),
    borderRadius: moderateScale(2),
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: moderateScale(24),
    position: 'relative',
  },
  timelineBullet: {
    width: moderateScale(16),
    height: moderateScale(16),
    borderRadius: moderateScale(8),
    marginRight: moderateScale(10),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
    zIndex: 1,
  },
  timelineBulletInner: {
    width: moderateScale(8),
    height: moderateScale(8),
    borderRadius: moderateScale(4),
  },
  timelineText: {
    fontSize: moderateScale(14),
    flex: 1,
  },
  currentBadge: {
    paddingHorizontal: moderateScale(8),
    paddingVertical: moderateScale(4),
    borderRadius: moderateScale(12),
    marginLeft: moderateScale(8),
  },
  currentBadgeText: {
    fontSize: moderateScale(11),
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  card: {
    borderRadius: moderateScale(16),
    padding: moderateScale(12),
    marginBottom: moderateScale(12),
    borderWidth: 1,
  },
  compactCard: {
    paddingVertical: moderateScale(12),
    paddingHorizontal: moderateScale(14),
    marginBottom: moderateScale(12),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: moderateScale(10),
    gap: moderateScale(8),
  },
  compactCardHeader: {
    marginBottom: moderateScale(20),
  },
  compactCardTitle: {
    fontSize: moderateScale(16),
  },
  cardTitle: {
    fontSize: moderateScale(17),
    fontWeight: '700',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: moderateScale(10),
  },
  compactInfoRow: {
    marginBottom: moderateScale(10),
    alignItems: 'center',
  },
  compactInfoRowLast: {
    marginBottom: 0,
  },
  customerInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customerInfoLabel: {
    width: moderateScale(80),
    fontSize: moderateScale(14),
    fontWeight: '500',
  },
  customerInfoValueWrap: {
    flex: 1,
    alignItems: 'flex-end',
  },
  customerInfoValueWrapInline: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: moderateScale(6),
  },
  customerInfoValue: {
    textAlign: 'right',
    fontSize: moderateScale(14),
    fontWeight: '600',
    flexShrink: 1,
  },
  infoLabel: {
    fontSize: moderateScale(14),
    fontWeight: '500',
  },
  compactInfoLabel: {
    fontSize: moderateScale(14),
    fontWeight: '500',
  },
  infoValue: {
    fontSize: moderateScale(14),
    fontWeight: '600',
    textAlign: 'right',
  },
  compactInfoValue: {
    fontSize: moderateScale(14),
    fontWeight: '600',
  },
  addressContainer: {
    marginTop: moderateScale(8),
    padding: moderateScale(12),
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    borderRadius: moderateScale(8),
  },
  addressText: {
    fontSize: moderateScale(14),
    lineHeight: moderateScale(20),
    fontWeight: '500',
  },
  employeeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: moderateScale(8),
  },
  employeeAvatar: {
    width: moderateScale(56),
    height: moderateScale(56),
    borderRadius: moderateScale(28),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: moderateScale(12),
    overflow: 'hidden',
  },
  employeeAvatarText: {
    color: '#ffffff',
    fontSize: moderateScale(20),
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
    fontSize: moderateScale(14),
    marginBottom: moderateScale(2),
  },
  employeePhone: {
    fontSize: moderateScale(13),
  },
  actionsContainer: {
    marginTop: moderateScale(8),
    gap: moderateScale(12),
  },
  noActionCard: {
    padding: moderateScale(20),
    borderRadius: moderateScale(12),
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: moderateScale(12),
  },
  noActionText: {
    fontSize: moderateScale(14),
    fontWeight: '600',
    textAlign: 'center',
    flex: 1,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: moderateScale(16),
    borderRadius: moderateScale(12),
    gap: moderateScale(8),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  inProgressButton: {
    backgroundColor: '#F59E0B',
  },
  completedButton: {
    backgroundColor: '#10B981',
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: moderateScale(15),
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  newActionButtons: {
    flexDirection: 'row',
    gap: moderateScale(12),
  },
  rejectButton: {
    backgroundColor: '#EF4444',
  },
  acceptButton: {
    backgroundColor: '#10B981',
  },
  breakdownContainer: {
    marginTop: moderateScale(12),
    paddingTop: moderateScale(8),
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  breakdownTitle: {
    fontSize: moderateScale(12),
    fontWeight: '700',
    marginBottom: moderateScale(8),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: moderateScale(2),
  },
  breakdownLabel: {
    fontSize: moderateScale(14),
    fontWeight: '500',
  },
  breakdownValue: {
    fontSize: moderateScale(14),
    fontWeight: '600',
  },
  breakdownTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: moderateScale(8),
    paddingTop: moderateScale(8),
    borderTopWidth: 1,
  },
  breakdownTotalLabel: {
    fontSize: moderateScale(16),
    fontWeight: '600',
  },
  breakdownTotalValue: {
    fontSize: moderateScale(17),
    fontWeight: '700',
  },
  unassignedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: moderateScale(8),
  },
  assignButton: {
    paddingVertical: moderateScale(8),
    paddingHorizontal: moderateScale(16),
    borderRadius: moderateScale(8),
  },
  assignButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: moderateScale(14),
  },
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
    maxHeight: '75%',
    borderTopLeftRadius: moderateScale(24),
    borderTopRightRadius: moderateScale(24),
    overflow: 'hidden',
  },
  employeeModalHeader: {
    padding: moderateScale(20),
  },
  employeeModalHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(12),
  },
  employeeModalIconWrapper: {
    width: moderateScale(48),
    height: moderateScale(48),
    borderRadius: moderateScale(14),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  employeeModalTitle: {
    color: '#ffffff',
    fontSize: moderateScale(18),
    fontWeight: '800',
  },
  employeeModalSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: moderateScale(13),
  },
  modalCloseBtn: {
    padding: moderateScale(4),
  },
  employeeModalContent: {
    padding: moderateScale(20),
  },
  employeeLoadingContainer: {
    padding: moderateScale(40),
    alignItems: 'center',
  },
  employeeLoadingText: {
    marginTop: moderateScale(12),
    fontSize: moderateScale(14),
    fontWeight: '600',
  },
  employeeEmptyContainer: {
    padding: moderateScale(40),
    alignItems: 'center',
  },
  employeeEmptyTitle: {
    fontSize: moderateScale(18),
    fontWeight: '800',
    marginTop: moderateScale(16),
  },
  employeeEmptySubtitle: {
    fontSize: moderateScale(14),
    textAlign: 'center',
    marginTop: moderateScale(8),
    marginBottom: moderateScale(24),
  },
  addEmployeeBtn: {
    borderRadius: moderateScale(14),
    overflow: 'hidden',
  },
  addEmployeeBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: moderateScale(14),
    paddingHorizontal: moderateScale(24),
    gap: moderateScale(8),
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
    paddingVertical: moderateScale(12),
    borderBottomWidth: 1,
  },
  employeeItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(12),
    flex: 1,
  },
  employeePhoto: {
    width: moderateScale(48),
    height: moderateScale(48),
    borderRadius: moderateScale(24),
  },
  employeeAvatarCircle: {
    width: moderateScale(48),
    height: moderateScale(48),
    borderRadius: moderateScale(24),
    alignItems: 'center',
    justifyContent: 'center',
  },
  employeeInfoStyle: {
    flex: 1,
  },
  employeeNameItem: {
    fontSize: moderateScale(16),
    fontWeight: '700',
  },
  employeeRoleItem: {
    fontSize: moderateScale(13),
  },
  paymentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: moderateScale(8),
    paddingVertical: moderateScale(4),
    borderRadius: moderateScale(6),
    gap: moderateScale(4),
  },
  paymentBadgeText: {
    color: '#ffffff',
    fontSize: moderateScale(10),
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  serviceBriefContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(16),
  },
  serviceImage: {
    width: moderateScale(85),
    height: moderateScale(85),
    borderRadius: moderateScale(12),
  },
  serviceImagePlaceholder: {
    width: moderateScale(85),
    height: moderateScale(85),
    borderRadius: moderateScale(12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceBriefInfo: {
    flex: 1,
  },
  serviceBriefName: {
    fontSize: moderateScale(17),
    fontWeight: '700',
    marginBottom: moderateScale(2),
  },
  serviceBriefCategory: {
    fontSize: moderateScale(14),
    fontWeight: '500',
    marginBottom: moderateScale(6),
  },
  serviceBriefPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(8),
  },
  serviceBriefPrice: {
    fontSize: moderateScale(16),
    fontWeight: '700',
  },
  serviceBriefQty: {
    fontSize: moderateScale(14),
    fontWeight: '600',
  },
});

export default ActiveJobDetailsScreen;

