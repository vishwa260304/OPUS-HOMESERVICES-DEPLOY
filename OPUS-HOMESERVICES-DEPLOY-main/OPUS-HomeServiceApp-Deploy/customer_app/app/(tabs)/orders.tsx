import React, { useEffect, useState, useCallback, memo } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Modal, TextInput, FlatList, StatusBar, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { hapticButtonPress } from '../../utils/haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../context/AuthContext';
import { BookingsApi } from '../../lib/bookings';
import { useUser } from '../../context/UserContext';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { supabase, SUPABASE_STORAGE_URL } from '../../lib/supabase';

const PROFILE_IMAGES_URL = `${SUPABASE_STORAGE_URL}/profile-images`;

// Memoized OrderItem component for better performance
const OrderItem = memo(({ item, colors, onPress }: {
  item: any;
  colors: any;
  onPress: () => void;
}) => {
  const getThumbnail = () => {
    const first = (item.items || [])[0];
    
    // Check for doctor appointment avatar first
    if (first?.category === 'Doctor Appointment' && first?.doctorAvatar) {
      return <Image source={{ uri: first.doctorAvatar }} style={{ width: '100%', height: '100%', borderRadius: 8 }} />;
    }
    
    // Acting Driver: use driverPhoto (may be relative path from Supabase storage)
    if (first?.category === 'Acting Driver' && first?.driverPhoto) {
      const path = first.driverPhoto;
      const uri = path.startsWith('http://') || path.startsWith('https://')
        ? path
        : `${PROFILE_IMAGES_URL}/${path}`;
      return <Image source={{ uri }} style={{ width: '100%', height: '100%', borderRadius: 8 }} />;
    }
    
    const src = first?.image || first?.imageUri;
    if (src && typeof src === 'string') {
      return <Image source={{ uri: src }} style={{ width: '100%', height: '100%' }} />;
    }
    if (src) {
      return <Image source={src} style={{ width: '100%', height: '100%' }} />;
    }
    
    // Show person icon for doctor appointments without avatar
    if (first?.category === 'Doctor Appointment') {
      return <Ionicons name="person" size={24} color="#26A69A" style={{ margin: 10 }} />;
    }
    
    // Show person icon for Acting Driver without photo
    if (first?.category === 'Acting Driver') {
      return <Ionicons name="person" size={24} color="#26A69A" style={{ margin: 10 }} />;
    }
    
    return <Ionicons name="image" size={20} color={colors.textTertiary as any} style={{ margin: 12 }} />;
  };

  const getServiceName = () => {
    const names = (item.items || []).map((it: any) => it?.title).filter(Boolean);
    if (names.length === 0) return 'Service';
    if (names.length === 1) return names[0];
    return `${names[0]} + ${names.length - 1} more`;
  };

  // Map backend status to UI label
  const getDisplayStatus = () => {
    const status = (item.status || '').toLowerCase();
    
    // Map backend status values to display labels
    // For doctor appointments, status comes from doctor_appointments table
    const statusMap: { [key: string]: string } = {
      'pending': 'Requested',
      'requested': 'Requested',
      'confirmed': 'Confirmed',
      'assigned': 'Assigned',
      'in_progress': 'In Progress',
      'inprogress': 'In Progress',
      'completed': 'Completed',
      'cancelled': 'Cancelled',
      'rejected': 'Rejected',
      'new': 'Requested', // Doctor appointment status - 'new' maps to 'Requested'
      'accepted': 'Accepted', // Doctor appointment status
    };
    
    return statusMap[status] || 'Requested';
  };

  const getDoctorAppointments = () => {
    const doctorAppointments = (item.items || []).filter((it: any) => it?.category === 'Doctor Appointment');
    if (doctorAppointments.length > 0) {
      // helper to remove time substrings from an already-formatted bookingDate
      const stripTimeFromDate = (dateStr: string | undefined, timeStr: string | undefined) => {
        if (!dateStr) return '';
        // remove common time patterns like "1:00 PM", "14:00", etc.
        const cleaned = dateStr.replace(/\b\d{1,2}:\d{2}(?:\s?[AaPp][Mm])?\b/g, '').replace(/\s{2,}/g, ' ').trim();
        // also remove trailing separators
        return cleaned.replace(/[,\-–—]\s*$/g, '').trim() || (timeStr || '');
      };

      return doctorAppointments.map((appointment: any, index: number) => (
        <View key={index} style={styles.appointmentDetails}>
          <Text style={[styles.appointmentDate, { color: colors.primary }]}> 
            📅 {stripTimeFromDate(appointment.bookingDate, appointment.bookingTime)} • {appointment.bookingTime}
          </Text>
        </View>
      ));
    }
    return null;
  };

  const getPrescriptionRequests = () => {
    const prescriptionRequests = (item.items || []).filter((it: any) => it?.category === 'Prescription');
    if (prescriptionRequests.length > 0) {
      return prescriptionRequests.map((request: any, index: number) => (
        <View key={index} style={styles.prescriptionDetails}>
          <Text style={[styles.prescriptionStatus, { color: colors.primary }]}>
            💊 Prescription Request • {request.validationResult?.isValid ? 'Validated' : 'Under Review'}
          </Text>
          <Text style={[styles.prescriptionDescription, { color: colors.textSecondary }]}>
            {request.description}
          </Text>
          {request.validationResult && (
            <Text style={[styles.prescriptionScore, { color: colors.textSecondary }]}>
              Validation Score: {request.validationResult.score}%
            </Text>
          )}
        </View>
      ));
    }
    return null;
  };

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={[styles.orderCard, { backgroundColor: colors.card }]}>
      <View style={[styles.orderHeader, { alignItems: 'center' }]}>
        {/* Thumbnail */}
        <View style={{ width: 44, height: 44, borderRadius: 8, overflow: 'hidden', backgroundColor: colors.surface, marginRight: 10 }}>
          {getThumbnail()}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.orderService, { color: colors.text }]}>
            {getServiceName()}
          </Text>
          <Text style={[styles.orderMeta, { color: colors.textSecondary }]}>
            Placed on {new Date(item.createdAt).toLocaleString()}
          </Text>
        </View>
        <Text style={[styles.orderStatus, { color: colors.primary }]}>{getDisplayStatus()}</Text>
      </View>
      {getDoctorAppointments()}
      {getPrescriptionRequests()}
      <View style={styles.orderActions}>
        <TouchableOpacity
          onPress={onPress}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={['#004c8f', '#0c1a5d']}
            style={styles.trackBtn}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Ionicons name="navigate" size={16} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.trackBtnText}>Track Status</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
});

OrderItem.displayName = 'OrderItem';

export default function OrdersScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const { refresh } = useLocalSearchParams();

  const [orders, setOrders] = useState<any[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<any[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Robustly parse a variety of timestamp shapes to a Date
  const getOrderDateSafe = useCallback((order: any) => {
    const candidates = [
      order?.createdAt,
      order?.created_at,
      order?.timestamp,
      order?.created_at_time,
    ];
    for (const value of candidates) {
      if (value == null) continue;
      // Numeric epoch (seconds or milliseconds)
      if (typeof value === 'number') {
        const ms = value < 10_000_000_000 ? value * 1000 : value;
        const d = new Date(ms);
        if (!isNaN(d.getTime())) return d;
      }
      // ISO string or other date-like string
      if (typeof value === 'string') {
        const parsed = Date.parse(value);
        if (!isNaN(parsed)) return new Date(parsed);
      }
      // Date instance
      if (value instanceof Date && !isNaN(value.getTime())) return value;
    }
    return new Date(0); // fallback to epoch if unknown
  }, []);

  // Fetch doctor appointment statuses from doctor_appointments table
  const fetchDoctorAppointmentStatuses = useCallback(async (bookingIds: string[]): Promise<Record<string, string>> => {
    if (bookingIds.length === 0) return {};
    
    try {
      const { data, error } = await supabase
        .from('doctor_appointments')
        .select('booking_id, status')
        .in('booking_id', bookingIds);
      
      if (error) {
        console.error('Error fetching doctor appointment statuses:', error);
        return {};
      }
      
      // Create a map of booking_id -> status
      const statusMap: Record<string, string> = {};
      (data || []).forEach((record: any) => {
        statusMap[record.booking_id] = record.status;
      });
      
      return statusMap;
    } catch (err) {
      console.error('Exception fetching doctor appointment statuses:', err);
      return {};
    }
  }, []);

  const load = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      }
      
      let mappedOrders: any[] = [];
      
      if (user?.id) {
        const rows = await BookingsApi.listByUser(user.id);
        
        // Identify doctor appointment bookings
        const doctorAppointmentBookingIds: string[] = [];
        rows.forEach(r => {
          const hasDoctorAppointment = (r.items || []).some((item: any) => item?.category === 'Doctor Appointment');
          if (hasDoctorAppointment) {
            doctorAppointmentBookingIds.push(r.id);
          }
        });
        
        // Fetch doctor appointment statuses
        const doctorStatusMap = await fetchDoctorAppointmentStatuses(doctorAppointmentBookingIds);
        
        mappedOrders = rows.map(r => {
          const hasDoctorAppointment = (r.items || []).some((item: any) => item?.category === 'Doctor Appointment');
          // For doctor appointments, use status from doctor_appointments table, otherwise use booking status
          const status = hasDoctorAppointment && doctorStatusMap[r.id] 
            ? doctorStatusMap[r.id] 
            : r.status;
          
          return {
            id: r.id,
            status: status,
            createdAt: r.created_at,
            total: r.total,
            items: r.items || [],
            isDoctorAppointment: hasDoctorAppointment, // Flag to identify doctor appointments
          };
        });
      } else {
        const profileRaw = await AsyncStorage.getItem('user_profile');
        const profile = profileRaw ? JSON.parse(profileRaw) : {};
        const phone = (profile?.phone || '').trim();
        const ordersKey = phone ? `user_orders:${phone}` : null;
        const raw = ordersKey ? await AsyncStorage.getItem(ordersKey) : null;
        mappedOrders = raw ? JSON.parse(raw) : [];
      }
      
      setOrders(mappedOrders);
      
      // Reapply filter after loading
      if (selectedFilter === 'all') {
        setFilteredOrders(mappedOrders);
      } else {
        // Apply filter logic directly here
        const now = new Date();
        const filtered = mappedOrders.filter(order => {
          const orderDate = getOrderDateSafe(order);
          
          switch (selectedFilter) {
            case 'last_week':
              const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
              return orderDate >= weekAgo;
            case 'last_month':
              const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
              return orderDate >= monthAgo;
            case 'last_3_months':
              const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
              return orderDate >= threeMonthsAgo;
            case 'last_6_months':
              const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
              return orderDate >= sixMonthsAgo;
            case 'last_year':
              const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
              return orderDate >= yearAgo;
            case 'this_year':
              const startOfYear = new Date(now.getFullYear(), 0, 1);
              return orderDate >= startOfYear;
            case 'last_year_only':
              const startOfLastYear = new Date(now.getFullYear() - 1, 0, 1);
              const endOfLastYear = new Date(now.getFullYear() - 1, 11, 31);
              return orderDate >= startOfLastYear && orderDate <= endOfLastYear;
            default:
              return true;
          }
        });
        
        const sorted = [...filtered].sort((a, b) => getOrderDateSafe(b).getTime() - getOrderDateSafe(a).getTime());
        setFilteredOrders(sorted);
      }
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      }
    }
  }, [user?.id, selectedFilter, getOrderDateSafe, fetchDoctorAppointmentStatuses]);

  // Filter orders based on selected time period using created date
  const filterOrders = useCallback((filter: string) => {
    if (filter === 'all') {
      setFilteredOrders(orders);
      return;
    }

    const now = new Date();
    const filtered = orders.filter(order => {
      const orderDate = getOrderDateSafe(order);
      
      switch (filter) {
        case 'last_week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          return orderDate >= weekAgo;
        
        case 'last_month':
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          return orderDate >= monthAgo;
        
        case 'last_3_months':
          const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          return orderDate >= threeMonthsAgo;
        
        case 'last_6_months':
          const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
          return orderDate >= sixMonthsAgo;
        
        case 'last_year':
          const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          return orderDate >= yearAgo;
        
        case 'this_year':
          const startOfYear = new Date(now.getFullYear(), 0, 1);
          return orderDate >= startOfYear;
        
        case 'last_year_only':
          const startOfLastYear = new Date(now.getFullYear() - 1, 0, 1);
          const endOfLastYear = new Date(now.getFullYear() - 1, 11, 31);
          return orderDate >= startOfLastYear && orderDate <= endOfLastYear;
        
        default:
          return true;
      }
    });
    
    // Show most recent first
    const sorted = [...filtered].sort((a, b) => getOrderDateSafe(b).getTime() - getOrderDateSafe(a).getTime());
    setFilteredOrders(sorted);
  }, [orders, getOrderDateSafe]);

  // Helper function to get filter label
  const getFilterLabel = (filter: string) => {
    const filterMap: { [key: string]: string } = {
      'all': 'All Bookings',
      'last_week': 'Last Week',
      'last_month': 'Last Month',
      'last_3_months': 'Last 3 Months',
      'last_6_months': 'Last 6 Months',
      'last_year': 'Last Year',
      'this_year': 'This Year',
      'last_year_only': 'Last Year Only',
    };
    return filterMap[filter] || 'Filter';
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Handle refresh parameter from prescription upload
  useEffect(() => {
    if (refresh === 'true') {
      load();
    }
  }, [refresh, load]);

  // Set up realtime subscription for booking status updates and doctor appointment status updates
  // Falls back to polling if realtime fails
  useEffect(() => {
    if (!user?.id) return;

    let pollingInterval: ReturnType<typeof setInterval> | null = null;
    let isRealtimeActive = false;

    // Polling fallback function
    const startPolling = () => {
      pollingInterval = setInterval(async () => {
        try {
          await load(true); // Refresh orders
        } catch (error) {
          // Silent error handling
        }
      }, 15000) as any; // Poll every 15 seconds
    };

    // Create a channel for realtime updates
    const channel = supabase
      .channel('bookings-updates-orders')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bookings',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          // Update the order in the local state
          setOrders((prevOrders) => {
            const updatedOrders = prevOrders.map((order) => {
              if (order.id === payload.new.id) {
                // Check if this is a doctor appointment
                const hasDoctorAppointment = (order.items || []).some((item: any) => item?.category === 'Doctor Appointment');
                
                // For doctor appointments, we'll fetch the status from doctor_appointments table
                // For now, update other fields but keep status update logic below
                return {
                  ...order,
                  id: payload.new.id,
                  status: hasDoctorAppointment ? order.status : payload.new.status, // Don't update status for doctor appointments from bookings table
                  createdAt: payload.new.created_at || order.createdAt,
                  total: payload.new.total || order.total,
                  items: payload.new.items || order.items || [],
                  // Preserve other fields that might not be in payload
                };
              }
              return order;
            });

            // If order not found in current list, it might be a new booking
            // In that case, reload to get it
            const orderExists = updatedOrders.some(o => o.id === payload.new.id);
            if (!orderExists) {
              // Order not in current list, reload to get it
              setTimeout(() => load(), 100);
              return prevOrders;
            }

            return updatedOrders;
          });
        }
      )
      // Subscribe to doctor_appointments table updates for doctor appointment status changes
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'doctor_appointments',
        },
        async (payload) => {
          // Fetch the booking_id from the payload
          const bookingId = (payload.new as any)?.booking_id || (payload.old as any)?.booking_id;
          if (!bookingId) return;
          
          // Check if this booking belongs to the current user
          const booking = await BookingsApi.getById(bookingId);
          if (!booking || booking.user_id !== user.id) return;
          
          // Check if this is a doctor appointment by looking at items
          const hasDoctorAppointment = (booking.items || []).some((item: any) => item?.category === 'Doctor Appointment');
          if (!hasDoctorAppointment) return;
          
          // Get the new status from the payload
          const newStatus = (payload.new as any)?.status;
          if (!newStatus && payload.eventType !== 'DELETE') return;
          
          // Update the order status in local state
          setOrders((prevOrders) => {
            const updatedOrders = prevOrders.map((order) => {
              if (order.id === bookingId) {
                // Check if this order has doctor appointment items (dynamic check)
                const orderHasDoctorAppointment = (order.items || []).some((item: any) => item?.category === 'Doctor Appointment');
                if (orderHasDoctorAppointment) {
                  // Update status from doctor_appointments table
                  return {
                    ...order,
                    status: newStatus || order.status,
                    isDoctorAppointment: true, // Ensure flag is set
                  };
                }
              }
              return order;
            });
            
            // If order not found, reload to get it
            const orderExists = updatedOrders.some(o => o.id === bookingId);
            if (!orderExists) {
              setTimeout(() => load(), 100);
              return prevOrders;
            }
            
            return updatedOrders;
          });
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
  }, [user?.id, load]);

  // Apply filter when selectedFilter or orders change
  useEffect(() => {
    filterOrders(selectedFilter);
  }, [selectedFilter, orders, filterOrders]);

  return (
    <>
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} translucent />

      {/* Content */}
      <View style={[styles.content, { backgroundColor: colors.background }]}>
        <View style={styles.headerContainer}>
          <Text style={[styles.title, { color: colors.text }]}>Your Bookings</Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity
              style={[styles.filterButton, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => setShowFilterModal(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="filter" size={20} color={colors.text} />
              <Text style={[styles.filterButtonText, { color: colors.text }]}>
                {selectedFilter === 'all' ? 'Filter' : getFilterLabel(selectedFilter)}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {filteredOrders.length === 0 ? (
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {orders.length === 0 ? 'No bookings found' : 'No bookings found for selected period'}
          </Text>
        ) : (
          <FlatList
            data={filteredOrders}
            keyExtractor={(it) => it.id}
            contentContainerStyle={{ paddingBottom: 20, width: '100%' }}
            renderItem={({ item }) => {
              // Route to the correct booking detail screen by type
              const hasDoctorAppointment = (item.items || []).some((it: any) => it?.category === 'Doctor Appointment');
              const isActingDriverBooking = !!(item as any).acting_driver_id || (item.items || []).some((it: any) => it?.category === 'Acting Driver');
              const bookingPath = hasDoctorAppointment
                ? `/booking/doctor/${item.id}`
                : isActingDriverBooking
                  ? `/booking/acting-driver/${item.id}`
                  : `/booking/${item.id}`;
              
              return (
                <OrderItem
                  item={item}
                  colors={colors}
                  onPress={() => router.push(bookingPath as any)}
                />
              );
            }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => load(true)}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
            getItemLayout={(data, index) => ({
              length: 120, // Approximate height of each item
              offset: 120 * index,
              index,
            })}
            removeClippedSubviews={true}
            maxToRenderPerBatch={10}
            updateCellsBatchingPeriod={50}
            initialNumToRender={10}
            windowSize={10}
          />
        )}
      </View>
    </SafeAreaView>

    {/* Filter Modal */}
    <Modal
      visible={showFilterModal}
      animationType="slide"
      transparent
      onRequestClose={() => setShowFilterModal(false)}
    >
      <View style={styles.filterOverlay}>
        <View style={[styles.filterCard, { backgroundColor: colors.card }]}>
          <View style={styles.filterHeader}>
            <Text style={[styles.filterTitle, { color: colors.text }]}>Filter Bookings</Text>
            <TouchableOpacity onPress={() => setShowFilterModal(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.filterOptions}>
            {[
              { key: 'all', label: 'All Bookings' },
              { key: 'last_week', label: 'Last 7 Days' },
              { key: 'last_month', label: 'Last 30 Days' },
              { key: 'last_3_months', label: 'Last 90 Days' },
              { key: 'last_6_months', label: 'Last 180 Days' },
              { key: 'last_year', label: 'Last 365 Days' },
              { key: 'this_year', label: 'This Calendar Year' },
              { key: 'last_year_only', label: 'Previous Calendar Year' },
            ].map((option) => (
              <TouchableOpacity
                key={option.key}
                style={[
                  styles.filterOption,
                  {
                    backgroundColor: selectedFilter === option.key ? colors.primary + '20' : 'transparent',
                    borderColor: selectedFilter === option.key ? colors.primary : colors.border,
                  }
                ]}
                onPress={() => {
                  setSelectedFilter(option.key);
                  setShowFilterModal(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.filterOptionText,
                  {
                    color: selectedFilter === option.key ? colors.primary : colors.text,
                    fontWeight: selectedFilter === option.key ? '600' : '400'
                  }
                ]}>
                  {option.label}
                </Text>
                {selectedFilter === option.key && (
                  <Ionicons name="checkmark" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    marginTop: 10,
    paddingVertical: 40,
    alignItems: 'center',
    alignContent: 'center',
  },
  greeting: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  location: { color: '#fff', fontWeight: '700' },
  topRightIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  themeToggleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  profileCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileImage: {
    width: '80%',
    height: '80%',
  },
  content: {
    flex: 1,
    paddingTop: (StatusBar.currentHeight || 12),
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 10,
    textAlign: 'center',
    alignSelf: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#ccc',
    textAlign: 'center',
    alignSelf: 'center',
    paddingVertical: 300,
  },
  orderCard: {
    width: '100%',
    backgroundColor: 'transparent',
    borderRadius: 14,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  orderId: { color: '#111827', fontWeight: '800' },
  orderStatus: { color: '#10B981', fontWeight: '800' },
  orderMeta: { color: '#6B7280', marginTop: 2 },
  orderService: { color: '#374151', marginTop: 4, fontWeight: '700' },
  orderTotal: { color: '#111827', marginTop: 8, fontWeight: '900' },
  orderActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 },
  appointmentDetails: { marginTop: 8, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#F0F9FF', borderRadius: 8, borderLeftWidth: 3, borderLeftColor: '#26A69A' },
  appointmentHeader: { flexDirection: 'row', alignItems: 'center' },
  doctorAvatarContainer: { marginRight: 10 },
  doctorAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E0F2F1' },
  doctorAvatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  appointmentInfo: { flex: 1 },
  appointmentDate: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  appointmentDescription: { fontSize: 12, lineHeight: 16 },
  prescriptionDetails: { marginTop: 8, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#F0FDF4', borderRadius: 8, borderLeftWidth: 3, borderLeftColor: '#10B981' },
  prescriptionStatus: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  prescriptionDescription: { fontSize: 12, lineHeight: 16, marginBottom: 2 },
  prescriptionScore: { fontSize: 11, fontStyle: 'italic' },
  trackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  trackBtnText: { color: '#fff', fontWeight: '800' },
  trackOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  trackCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
  },
  trackTitle: { fontSize: 18, fontWeight: '900', color: '#111827' },
  trackOrderId: { marginTop: 6, fontWeight: '800', color: '#374151' },
  trackMeta: { marginTop: 2, color: '#6B7280' },
  timeline: { marginTop: 16 },
  timelineRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  bullet: { width: 10, height: 10, borderRadius: 5, marginRight: 10, backgroundColor: '#E5E7EB' },
  bulletActive: { backgroundColor: '#10B981' },
  bulletIdle: { backgroundColor: '#E5E7EB' },
  timelineText: { color: '#6B7280', fontWeight: '700' },
  timelineTextActive: { color: '#111827' },
  // Location modal styles
  locOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  locCard: {
    width: '86%',
    backgroundColor: 'transparent',
    borderRadius: 16,
    padding: 16,
  },
  locTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  locInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'transparent',
  },
  locInput: {
    flex: 1,
    color: '#111827',
    fontSize: 14,
  },
  locActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 14,
  },
  locBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginLeft: 8,
  },
  locBtnText: {
    fontWeight: '700',
  },
  locCancel: { backgroundColor: 'transparent' },
  locCancelText: { color: '#111827' },
  locSave: { backgroundColor: 'transparent' },
  locSaveText: { color: '#fff' },
  
  // Filter styles
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  // removed refreshButton and testButton styles
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  filterButtonText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '600',
  },
  filterOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterCard: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: 16,
    padding: 20,
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  filterTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  filterOptions: {
    gap: 8,
  },
  filterOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  filterOptionText: {
    fontSize: 16,
  },
});
