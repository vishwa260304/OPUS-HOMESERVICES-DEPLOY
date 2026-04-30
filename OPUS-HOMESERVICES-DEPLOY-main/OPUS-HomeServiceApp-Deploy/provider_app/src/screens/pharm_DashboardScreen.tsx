import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, Dimensions, Modal, Animated, Easing, Image, Platform, StatusBar, Alert, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import BottomTab from '../components/BottomTab';
import { moderateScale } from '../utils/responsive';
import { Ionicons } from '@expo/vector-icons';
import OpusAgentLogo from '../components/OpusAgentLogo';
import { getCompanyInfo, getOnlineStatus, setOnlineStatus, recordJobAccepted, recordJobRequest, getStats, getSelectedSector, getBookings, getEarningsSummary, pushNotification, getNotifications, loadOnlineStatus } from '../utils/appState';
import { setBookings } from '../utils/appState';
import GradientHeader from '../components/GradientHeader';
// Theme toggle removed from header; theme selection moved to Profile
import { useTheme } from '../context/ThemeContext';
import { CustomerBookingsAPI } from '../lib/customerBookings';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

const pharmacyCategories = ['Wellness', 'Diabetes', 'Vitamins', 'Ayurveda', 'Personal Care'];

// Map various customer-side booking statuses to provider dashboard statuses
const mapStatus = (customerStatus: string): 'New' | 'confirmed' | 'Assigned' | 'InProgress' | 'Completed' | 'Cancelled' => {
  const normalized = (customerStatus || '').toString().trim().toLowerCase();

  let result: 'New' | 'confirmed' | 'Assigned' | 'InProgress' | 'Completed' | 'Cancelled' = 'New';

  if (!normalized) {
    result = 'New';
  } else if (['new', 'pending', 'requested', 'open', 'waiting'].includes(normalized)) {
    result = 'New';
  } else if (['accepted', 'accepted_by_provider', 'confirmed', 'confirm', 'booked'].includes(normalized)) {
    result = 'confirmed';
  } else if (['assigned', 'assigned_to_partner', 'assigned_to_employee'].includes(normalized)) {
    result = 'Assigned';
  } else if (['inprogress', 'in_progress', 'ongoing', 'started', 'on_the_way', 'enroute', 'in progress'].includes(normalized)) {
    result = 'InProgress';
  } else if (['completed', 'done'].includes(normalized)) {
    result = 'Completed';
  } else if (['cancelled', 'canceled', 'rejected'].includes(normalized)) {
    result = 'Cancelled';
  } else if (['false', '0', 'no'].includes(normalized)) {
    result = 'Cancelled';
  } else {
    result = 'New';
  }

  console.log('[mapStatus] input=', customerStatus, 'normalized=', normalized, '->', result);
  return result;
};

const DashboardScreen: React.FC = () => {
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const { user } = useAuth();
  const [brandName, setBrandName] = useState<string>('Fixit Partner');
  const [isOnline, setIsOnline] = useState<boolean>(getOnlineStatus());
  const toggleAnim = useRef(new Animated.Value(isOnline ? 1 : 0)).current;
  const [showGoOnlinePrompt, setShowGoOnlinePrompt] = useState<boolean>(false);
  const [hasActiveBooking, setHasActiveBooking] = useState<boolean>(false);
  const [todayEarnings, setTodayEarnings] = useState<number>(0);
  const [todayCompletedCount, setTodayCompletedCount] = useState<number>(0);
  const [weeklyAmount, setWeeklyAmount] = useState<number>(0);
  const [acceptancePct, setAcceptancePct] = useState<number>(0);
  const [notificationCount, setNotificationCount] = useState<number>(getNotifications().length);

  // Subscription cleanup ref
  const subscriptions = useRef<(() => void)[]>([]);
  const [currentProviderId, setCurrentProviderId] = useState<number | null>(null);

  // Setup realtime subscriptions
  const setupRealtimeSubscriptions = async () => {
    // Clear existing subs
    subscriptions.current.forEach(unsub => unsub());
    subscriptions.current = [];

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: services } = await supabase
        .from('providers_services')
        .select('id')
        .eq('user_id', user.id);

      if (services) {
        services.forEach(service => {
          const unsub = CustomerBookingsAPI.subscribeToProviderBookings(service.id, () => {
            console.log('🔔 Realtime update received!');
            fetchProviderBookings();
          });
          subscriptions.current.push(unsub);
        });

        // Also subscribe to Open/Unassigned bookings
        const unsubOpen = CustomerBookingsAPI.subscribeToOpenBookings(() => {
          console.log('🔔 Realtime OPEN update received!');
          fetchProviderBookings();
        });
        subscriptions.current.push(unsubOpen);
      }
    } catch (e) {
      console.error('Error setting up subscriptions:', e);
    }
  };

  useEffect(() => {
    setupRealtimeSubscriptions();

    return () => {
      subscriptions.current.forEach(unsub => unsub());
    };
  }, []);

  const [refreshing, setRefreshing] = useState<boolean>(false);
  const offlineNoticeY = useRef(new Animated.Value(-140)).current;
  const [offlineNoticeVisible, setOfflineNoticeVisible] = useState<boolean>(false);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [showBookingModal, setShowBookingModal] = useState<boolean>(false);
  const [bookings, setBookingsState] = useState<any[]>([]);
  const [showEmployeeModal, setShowEmployeeModal] = useState<boolean>(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState<boolean>(false);
  const [bookingToAssign, setBookingToAssign] = useState<any>(null);
  const sliderX = useRef(new Animated.Value(0)).current;
  const { width } = Dimensions.get('window');
  const [headerHeight, setHeaderHeight] = useState<number>(140);
  const horizontalPadding = moderateScale(16);
  const gap = moderateScale(12);
  const tileWidth = Math.floor((width - horizontalPadding * 2 - gap * 2));
  const singleTileWidth = Math.floor(tileWidth / 3);
  const quickThirdWidth = Math.floor((width - horizontalPadding * 2 - gap * 2) / 3);
  const quickHalfWidth = Math.floor((width - horizontalPadding * 2 - gap) / 2);

  // Header is now static (no animations)


  // Replaced segmented period control with a persistent search-style bar and filter chips
  const [jobFilter, setJobFilter] = useState<'All' | 'New' | 'Assigned' | 'InProgress' | 'Completed'>('All');

  // Fetch real bookings from customer bookings table
  const fetchProviderBookings = async () => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch all provider services for this user
      const { data: services, error: servicesError } = await supabase
        .from('providers_services')
        .select('id')
        .eq('user_id', user.id);

      console.log('[fetchProviderBookings] provider user id=', user.id, 'servicesError=', servicesError, 'services=', services);

      // If no services, just log and continue (we might still want Open Bookings)
      if (servicesError || !services || services.length === 0) {
        console.log('No services found for provider (checking open bookings only)');
      }

      // Get all provider_service_ids
      const providerServiceIds = services?.map(s => s.id) || [];

      console.log('[fetchProviderBookings] providerServiceIds=', providerServiceIds);

      if (providerServiceIds.length > 0) {
        setCurrentProviderId(providerServiceIds[0]);
        console.log('[fetchProviderBookings] setCurrentProviderId=', providerServiceIds[0]);
      }

      // Fetch bookings for all provider service IDs
      const allBookings: any[] = [];

      // 1. Fetch Assigned Bookings
      if (providerServiceIds.length > 0) {
        for (const serviceId of providerServiceIds) {
          const bookings = await CustomerBookingsAPI.getByProviderId(serviceId);
          allBookings.push(...bookings);
        }
      }

      // 1b. If this provider is a pharmacy (no provider_service entries), also include bookings
      // where pharmacy_provider_id equals current auth user id
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user && user.id) {
          const pharmBookings = await CustomerBookingsAPI.getByPharmacyProviderId(user.id);
          if (pharmBookings && pharmBookings.length > 0) {
            console.log('[fetchProviderBookings] fetched pharmacy provider bookings count=', pharmBookings.length);
            allBookings.push(...pharmBookings);
          }
        }
      } catch (e) {
        console.warn('[fetchProviderBookings] could not fetch pharmacy provider bookings', e);
      }

      // 2. Fetch Open/Unassigned Bookings (Marketplace)
      const openBookings = await CustomerBookingsAPI.getOpenMarketplaceBookings();
      allBookings.push(...openBookings);

      // Deduplicate by ID just in case
      const uniqueBookings = Array.from(new Map(allBookings.map(item => [item.id, item])).values());

      console.log('✅ Total bookings fetched:', uniqueBookings.length);

      // Sort by creation date (newest first)
      uniqueBookings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      console.log('[fetchProviderBookings] raw uniqueBookings count=', uniqueBookings.length);
      console.log('[fetchProviderBookings] raw statuses:', uniqueBookings.map(b => ({ id: b.id, status: b.status })));

      // Normalize statuses so provider dashboard shows consistent states
      const mappedBookings = uniqueBookings.map(b => ({ ...b, status: mapStatus(b.status) }));

      console.log('[fetchProviderBookings] mapped statuses:', mappedBookings.map(b => ({ id: b.id, status: b.status })));

      // Update app state with normalized bookings
      setBookings(mappedBookings);
      setBookingsState(mappedBookings);
      console.log('[fetchProviderBookings] setBookings called with', mappedBookings.length, 'items');

      // any confirmed/assigned/in-progress bookings indicate active work
      const active = mappedBookings.some(b => {
        const s = String(b.status || '').toLowerCase();
        return s === 'confirmed' || s === 'assigned' || s === 'inprogress';
      });
      setHasActiveBooking(active);
    } catch (error) {
      console.error('Failed to fetch provider bookings:', error);
    }
  };

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
          'You don\'t have any active employees.',
          [
            { text: 'OK', style: 'default' }
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
        await fetchProviderBookings();
      } else {
        Alert.alert('Error', 'Failed to assign employee. Please try again.');
      }
    } catch (error) {
      console.error('Error assigning employee:', error);
      Alert.alert('Error', 'Failed to assign employee. Please try again.');
    }
  };

  // Load online status and bookings from storage on first mount
  useEffect(() => {
    const initOnlineStatus = async () => {
      const status = await loadOnlineStatus();
      setIsOnline(status);
    };
    initOnlineStatus();
    // Initialize bookings from app state
    setBookingsState(getBookings());
    // Fetch fresh bookings from database
    fetchProviderBookings();
  }, []);

  useEffect(() => {
    if (isFocused) {
      setBrandName(getCompanyInfo().companyName || 'Fixit Partner');
      // Sync online status whenever this screen regains focus
      setIsOnline(getOnlineStatus());
      // Fetch real bookings from database
      fetchProviderBookings();
      // Simulate a new incoming job request for the banner card
      recordJobRequest();
      const es = getEarningsSummary();
      setTodayEarnings(es.todayAmount);
      setTodayCompletedCount(es.todayCompletedCount);
      setWeeklyAmount(es.weeklyAmount);
      setAcceptancePct(es.acceptancePct);
      setNotificationCount(getNotifications().length);
    }
  }, [isFocused]);
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      setBrandName(getCompanyInfo().companyName || 'Fixit Partner');
      setIsOnline(getOnlineStatus());
      // Refresh bookings from database
      await fetchProviderBookings();
      const es = getEarningsSummary();
      setTodayEarnings(es.todayAmount);
      setTodayCompletedCount(es.todayCompletedCount);
      setWeeklyAmount(es.weeklyAmount);
      setAcceptancePct(es.acceptancePct);
      setNotificationCount(getNotifications().length);
    } finally {
      setTimeout(() => setRefreshing(false), 400);
    }
  };

  const showOfflineNotice = () => {
    setOfflineNoticeVisible(true);
    Animated.timing(offlineNoticeY, { toValue: 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    // Auto-hide after 3 seconds
    setTimeout(() => {
      Animated.timing(offlineNoticeY, { toValue: -80, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => setOfflineNoticeVisible(false));
    }, 3000);
  };

  const handleAcceptJob = () => {
    if (isOnline) {
      recordJobAccepted();
      navigation.navigate('Bookings');
    } else {
      // brief notification and a modal for clear action
      showOfflineNotice();
      setShowGoOnlinePrompt(true);
    }
  };


  const { colors } = useTheme();
  const insets = useSafeAreaInsets();


  // Default pharmacy accent colors to match customer header gradient (healthcare theme)
  const selected = (getSelectedSector?.() as 'home' | 'healthcare' | 'automobile' | 'appliance') || 'healthcare';
  const sectorPrimary = '#26A69A';
  const sectorPrimarySoft = 'rgba(38,166,154,0.35)';
  // Use the same gradient used in customer index header
  const sectorGradient: readonly [string, string, ...string[]] = ['#26A69A', '#00897B', '#00796B'] as const;
  // For components requiring exactly 2 colors, use endpoints of the gradient
  const sectorGradientForHeader: [string, string] = ['#26A69A', '#00796B'];

  return (
    <View style={[styles.root, { backgroundColor: '#ffffff' }]}>
      <StatusBar barStyle="light-content" backgroundColor={sectorGradient[0]} translucent={true} />

      {/* Fixed Header (match DashboardScreen layout/positions) */}
      <View style={styles.fixedHeader}>
        <LinearGradient
          colors={sectorGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={[styles.simpleHeaderGradient, { paddingTop: insets.top + moderateScale(20) }]}
        >
          {/* Top row with brand name and right icons */}
          <View style={styles.headerTopRow}>
            <View style={styles.headerLeftSection}>
              <Text style={styles.brandName}>{brandName}</Text>
            </View>

            {/* Right side buttons - positioned at top right */}
            <View style={styles.simpleRightButtons}>
              <TouchableOpacity
                onPress={() => navigation.navigate('Notifications')}
                style={styles.simpleBellButton}
              >
                <Ionicons name="notifications" size={moderateScale(20)} color="#ffffff" />
                {notificationCount > 0 && (
                  <View style={styles.simpleBadge}>
                    <Text style={styles.simpleBadgeText}>{Math.min(99, notificationCount)}</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => navigation.navigate('Profile')}
                style={styles.simpleProfileButton}
              >
                <Ionicons name="person-circle" size={moderateScale(32)} color="#cfe0ff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Animated Toggle Switch (match DashboardScreen positions) */}
          <View style={styles.toggleContainer}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={async () => {
                const next = !isOnline;
                // Animate toggle knob
                Animated.spring(toggleAnim, {
                  toValue: next ? 1 : 0,
                  useNativeDriver: true,
                  tension: 100,
                  friction: 8,
                }).start();
                // Persist online status
                await setOnlineStatus(next);
                setIsOnline(next);
              }}
              style={[
                styles.toggleSwitch,
                isOnline ? styles.toggleSwitchOnline : styles.toggleSwitchOffline,
              ]}
            >
              <Animated.View
                style={[
                  styles.toggleKnob,
                  {
                    transform: [{
                      translateX: toggleAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [moderateScale(4), moderateScale(57)],
                      }),
                    }],
                  },
                ]}
              />
              <Animated.View
                style={[
                  styles.toggleLabelRight,
                  {
                    opacity: toggleAnim.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [1, 0.3, 0],
                    }),
                  },
                ]}
              >
                <Text style={styles.toggleLabelText}>Offline</Text>
              </Animated.View>
              <Animated.View
                style={[
                  styles.toggleLabelLeft,
                  {
                    opacity: toggleAnim.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [0, 0.3, 1],
                    }),
                  },
                ]}
              >
                <Text style={styles.toggleLabelText}>Online</Text>
              </Animated.View>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>

      {/* Hidden header for height calculation */}
      <View
        pointerEvents="none"
        style={[styles.collapsibleHeader, { opacity: 0, paddingTop: Math.max(0, insets.top - 10) }]}
        onLayout={(e) => setHeaderHeight(Math.max(120, Math.round(e.nativeEvent.layout.height)))}
      >
        <GradientHeader
          gradientColors={sectorGradientForHeader}
          left={<View style={{ height: 120 }} />}
          right={<View style={{ height: 120 }} />}
          bottom={<View style={{ height: 120 }} />}
        />
      </View>

      {/* Static Content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.staticContent, {
          paddingTop: headerHeight + moderateScale(-100),
          paddingHorizontal: moderateScale(15),
          paddingBottom: moderateScale(100),
          backgroundColor: '#ffffff'
        }]}
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        {/* Removed Add medicines button */}

        {/* Recent Requests section - moved here from Active Jobs */}
        <Text style={[styles.sectionHeader, { color: '#000000', marginTop: moderateScale(4) }]}>Recent Requests</Text>
        {(() => {
          // Ensure bookings array exists and is valid
          if (!bookings || !Array.isArray(bookings)) {
            return (
              <View style={[styles.emptyCard, styles.cardShadow, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
                <View style={styles.emptyIconWrap}>
                  <Ionicons name="document-text-outline" size={moderateScale(26)} color="#3B5BFD" />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No requests yet</Text>
                <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
                  New booking requests will appear here.
                </Text>
              </View>
            );
          }

          // Filter for new/pending bookings - handle both 'New' status and 'pending' (case-insensitive)
          const recentBookings = bookings.filter(b => {
            if (!b || !b.status) return false;
            const status = String(b.status).toLowerCase();
            const isPending = status === 'new' || status === 'pending';

            // Filter for pharmacy items (drugs) only
            const hasDrugs = b.items && b.items.some((item: any) =>
              pharmacyCategories.includes(item.category || '')
            );

            return isPending && hasDrugs;
          }).slice(0, 5);

          // Show empty state if no new requests
          if (recentBookings.length === 0) {
            return (
              <View style={[styles.emptyCard, styles.cardShadow, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
                <View style={styles.emptyIconWrap}>
                  <Ionicons name="document-text-outline" size={moderateScale(26)} color="#3B5BFD" />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No requests yet</Text>
                <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
                  New booking requests will appear here.
                </Text>
              </View>
            );
          }

          // Show requests when they exist
          return recentBookings.map(b => (
            <TouchableOpacity
              key={b.id}
              style={[styles.jobCardWhite, styles.cardShadow, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
              activeOpacity={0.7}
              onPress={() => {
                console.log('[openBookingModal] id=', b.id, 'status=', b.status);
                setSelectedBooking(b);
                setShowBookingModal(true);
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.jobTitleDark, { color: colors.text }]}>{b.customerName}</Text>
                {/* item/service name removed for pharmacy cards */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: moderateScale(6) }}>
                  <Ionicons name="location-outline" size={moderateScale(14)} color="#6B7280" />
                  <Text style={[styles.jobMetaDark, { color: colors.textSecondary }]}> {b.location}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: moderateScale(8) }}>
                  <Text style={[styles.jobMetaDark, { color: colors.textSecondary }]}>{b.amount}</Text>
                  <Text style={styles.dotSep}>  ·  </Text>
                  <View style={styles.greenTag}><Text style={styles.greenTagText}>{b.paymentMode}</Text></View>
                </View>
              </View>
              {(() => {
                const st = String(b.status || '').toLowerCase();
                if (st === 'assigned' || st === 'inprogress') {
                  return (
                    <View style={[styles.assignedBtn, { paddingHorizontal: moderateScale(12) }]}>
                      <Text style={styles.assignedBtnText}>Assigned</Text>
                    </View>
                  );
                }
                return <Ionicons name="chevron-forward" size={moderateScale(24)} color={colors.textSecondary} />;
              })()}
            </TouchableOpacity>
          ));
        })()}

        <Text style={[styles.sectionHeader, { color: '#000000', marginTop: moderateScale(4) }]}>Performance Insights</Text>
        <View style={[styles.insightsRow, { columnGap: gap }]}>
          <TouchableOpacity style={[styles.tile, styles.cardShadow, { width: singleTileWidth, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]} activeOpacity={0.85} onPress={() => navigation.navigate('WeeklyChart', { mode: 'weekly', weeklyData: [weeklyAmount], weeklyLabels: ['This Week'], maxYWeekly: Math.max(1000, weeklyAmount), titleWeekly: 'Weekly Earnings', monthlyData: [weeklyAmount], monthlyLabels: ['This Month'], maxYMonthly: Math.max(1000, weeklyAmount), titleMonthly: 'Monthly Breakdown' })}>
            <Ionicons name="pulse-outline" size={moderateScale(22)} color="#3B5BFD" />
            <Text style={[styles.tileValue, { color: colors.text }]}>₹{weeklyAmount}</Text>
            <Text style={[styles.tileLabel, { color: colors.textSecondary }]}>Weekly</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tile, styles.cardShadow, { width: singleTileWidth, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]} activeOpacity={0.85} onPress={() => {
            // Build acceptance rate data for last 7 days and weekly (month)
            const list = bookings;
            const now = new Date();
            const weeklyLabels: string[] = [];
            const weeklyData: number[] = [];
            const isSameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
            for (let i = 6; i >= 0; i -= 1) {
              const d = new Date(now);
              d.setDate(now.getDate() - i);
              weeklyLabels.push(d.toLocaleDateString(undefined, { weekday: 'short' }));
              const dayList = list.filter(b => b.createdAt && isSameDay(new Date(b.createdAt), d));
              const total = dayList.length;
              const accepted = dayList.filter(b => {
                const s = String(b.status || '').toLowerCase();
                return s === 'assigned' || s === 'inprogress' || s === 'completed';
              }).length;
              weeklyData.push(total ? Math.round((accepted / total) * 100) : 0);
            }

            // Monthly: acceptance per week in current month (4-5 buckets)
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            const monthlyData: number[] = [];
            const monthlyLabels: string[] = [];
            let cursor = new Date(startOfMonth);
            let w = 1;
            while (cursor <= endOfMonth) {
              const weekStart = new Date(cursor);
              const weekEnd = new Date(cursor);
              weekEnd.setDate(weekEnd.getDate() + 6);
              if (weekEnd > endOfMonth) weekEnd.setTime(endOfMonth.getTime());
              const inWeek = list.filter(b => {
                const ts = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return ts >= weekStart.getTime() && ts <= weekEnd.getTime();
              });
              const totalW = inWeek.length;
              const acceptedW = inWeek.filter(b => {
                const s = String(b.status || '').toLowerCase();
                return s === 'assigned' || s === 'inprogress' || s === 'completed';
              }).length;
              monthlyData.push(totalW ? Math.round((acceptedW / totalW) * 100) : 0);
              monthlyLabels.push(`Week ${w}`);
              cursor.setDate(cursor.getDate() + 7);
              w += 1;
            }

            navigation.navigate('WeeklyChart', {
              mode: 'weekly',
              weeklyData,
              weeklyLabels,
              monthlyData,
              monthlyLabels,
              maxYWeekly: 100,
              titleWeekly: 'Acceptance Rate (%)',
              titleMonthly: 'Monthly Acceptance Rate',
            });
          }}>
            <Ionicons name="checkmark-done-outline" size={moderateScale(22)} color="#3B5BFD" />
            <Text style={[styles.tileValue, { color: colors.text }]}>
              {acceptancePct}%
            </Text>
            <Text style={[styles.tileLabel, { color: colors.textSecondary }]}>Acceptance</Text>
          </TouchableOpacity>
          <View style={[styles.tile, styles.cardShadow, { width: singleTileWidth, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
            <Ionicons name="star" size={moderateScale(22)} color="#F5B700" />
            <Text style={[styles.tileValue, { color: colors.text }]}>4.7/5</Text>
            <Text style={[styles.tileLabel, { color: colors.textSecondary }]}>Rating</Text>
          </View>
        </View>

        <View style={[styles.earningsCardWhite, styles.cardShadow, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, marginTop: moderateScale(4) }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitleDark, { color: colors.text }]}>Today's Earnings</Text>
            <Text style={[styles.cardAmountBlue, { color: '#3B5BFD' }]}>₹{todayEarnings}</Text>
            <Text style={[styles.cardMetaDark, { color: colors.textSecondary }]}>{todayCompletedCount} Jobs Completed</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: moderateScale(8) }}>
            <TouchableOpacity onPress={() => navigation.navigate('Earnings')} activeOpacity={0.85}>
              <LinearGradient colors={sectorGradient} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={[styles.walletCircle, { alignItems: 'center', justifyContent: 'center' }]}>
                <Ionicons name="wallet-outline" size={moderateScale(22)} color="#ffffff" />
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('Earnings')} activeOpacity={0.85}>
              <Text style={[styles.viewDetailsDark, { color: '#3B5BFD' }]}>View details  →</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={[styles.sectionHeader, { color: '#000000' }]}>Active jobs</Text>

        {(() => {
          const activeBookings = bookings.filter(b => {
            const s = String(b.status || '').toLowerCase();
            return ['confirmed', 'assigned', 'inprogress', 'completed'].includes(s);
          });
          console.log('✅ Active bookings count:', activeBookings.length);

          if (activeBookings.length === 0) {
            return (
              <View style={[styles.emptyCard, styles.cardShadow, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
                {!isOnline ? (
                  <View style={styles.emptyIconWrap}><Ionicons name={'cloud-offline'} size={moderateScale(26)} color="#3B5BFD" /></View>
                ) : null}
                <Text style={[styles.emptyTitle, { color: colors.text }]}>{isOnline ? 'No active jobs right now' : 'You are offline'}</Text>
                <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
                  {isOnline ? 'Keep your app open to receive new requests.' : 'Go Online to start receiving new requests.'}
                </Text>
                {!isOnline ? (
                  <View style={{ flexDirection: 'row', columnGap: moderateScale(10), marginTop: moderateScale(10) }}>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={async () => { await setOnlineStatus(true); setIsOnline(true); }}
                    >
                      <LinearGradient colors={sectorGradient} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={[styles.primaryBtnFill]}>
                        <Text style={styles.primaryBtnFillText}>Go Online</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            );
          }

          return activeBookings.map(b => (
            <TouchableOpacity
              key={b.id}
              activeOpacity={0.85}
              onPress={() => {
                const rootNav = (navigation as any)?.getParent ? (navigation as any).getParent() : navigation;
                try {
                  rootNav.navigate('PharmOrderDetails', { bookingId: b.id, booking: b });
                } catch (e) {
                  // Fallback to local navigation if parent isn't available
                  (navigation as any).navigate('PharmOrderDetails', { bookingId: b.id, booking: b });
                }
              }}
              style={[styles.jobCardWhite, styles.cardShadow, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.jobTitleDark, { color: colors.text }]}>{b.customerName}</Text>
                {/* item/service name removed for Active Jobs card */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: moderateScale(6) }}>
                  <Ionicons name="location-outline" size={moderateScale(14)} color="#6B7280" />
                  <Text style={[styles.jobMetaDark, { color: colors.textSecondary }]}> {b.location}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: moderateScale(8) }}>
                  <Text style={[styles.jobMetaDark, { color: colors.textSecondary }]}>{b.amount}</Text>
                  <Text style={styles.dotSep}>  ·  </Text>
                  <View style={styles.greenTag}><Text style={styles.greenTagText}>{b.paymentMode}</Text></View>
                </View>
                {/* Show assigned employee if exists */}
                {b.partnerName && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: moderateScale(8) }}>
                    <Ionicons name="person" size={moderateScale(14)} color={sectorGradient[0]} />
                    <Text style={[styles.assignedPartnerText, { color: sectorGradient[0] }]}>
                      {' '}Assigned to: {b.partnerName}
                    </Text>
                  </View>
                )}
              </View>
              {(() => {
                const s = String(b.status || '').toLowerCase();
                if (s === 'completed') {
                  return (
                    <View style={[styles.greenTag, { paddingHorizontal: moderateScale(12), paddingVertical: moderateScale(8) }]}>
                      <Text style={styles.greenTagText}>Completed</Text>
                    </View>
                  );
                }

                if (b.partnerName) {
                  return (
                    <View style={[styles.assignedBtn]}>
                      <Text style={styles.assignedBtnText}>Assigned</Text>
                    </View>
                  );
                }

                return (
                  <Ionicons name="chevron-forward" size={moderateScale(24)} color={colors.textSecondary} />
                );
              })()}
            </TouchableOpacity>
          ));
        })()}
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
              <TouchableOpacity style={styles.noticeBtnFill} onPress={async () => { await setOnlineStatus(true); setIsOnline(true); }}>
                <Text style={styles.noticeBtnFillText}>Go Online</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        ) : null}

      </ScrollView>

      {/* Booking Details Modal */}
      <Modal
        visible={showBookingModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowBookingModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalOverlayTouch}
            activeOpacity={1}
            onPress={() => setShowBookingModal(false)}
          />
          <View style={[styles.bookingModalCard, { backgroundColor: colors.card }]}>
            {/* Header with Gradient */}
            <LinearGradient
              colors={sectorGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.bookingModalHeader}
            >
              <View style={styles.bookingModalHeaderContent}>
                <View style={styles.bookingModalIconWrapper}>
                  <Ionicons name="document-text" size={moderateScale(24)} color="#ffffff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bookingModalTitle}>Booking Request</Text>
                  <Text style={styles.bookingModalSubtitle}>Review details carefully</Text>
                </View>
                <TouchableOpacity onPress={() => setShowBookingModal(false)} style={styles.modalCloseBtn}>
                  <Ionicons name="close" size={moderateScale(24)} color="#ffffff" />
                </TouchableOpacity>
              </View>
            </LinearGradient>

            {selectedBooking && (
              <ScrollView
                style={styles.bookingModalContent}
                showsVerticalScrollIndicator={false}
              >
                {/* Customer Info */}
                <View style={styles.bookingDetailSection}>
                  <Text style={styles.bookingDetailLabel}>Customer</Text>
                  <Text style={styles.bookingDetailValue}>{selectedBooking.customerName}</Text>
                </View>

                {/* Items List */}
                <View style={styles.bookingDetailSection}>
                  <Text style={styles.bookingDetailLabel}>Items List</Text>
                  {selectedBooking.items && Array.isArray(selectedBooking.items) && selectedBooking.items.length > 0 ? (
                    selectedBooking.items.map((item: any, index: number) => (
                      <View key={index} style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        marginBottom: 8,
                        borderBottomWidth: index === selectedBooking.items.length - 1 ? 0 : 1,
                        borderBottomColor: '#F3F4F6',
                        paddingBottom: 8
                      }}>
                        {/* Image or Placeholder */}
                        <View style={{ width: 40, height: 40, borderRadius: 6, marginRight: 12, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                          {(() => {
                            if (item.image) console.log(`Rendering image for ${item.title}:`, item.image);
                            else console.log(`No image for ${item.title}`);
                            return null;
                          })()}
                          {item.image ? (
                            <Image
                              source={{ uri: item.image.trim() }}
                              style={{ width: '100%', height: '100%' }}
                              resizeMode="cover"
                              resizeMethod="resize"
                              onError={(e) => console.log(`Failed to load: ${item.image}`, e.nativeEvent.error)}
                            />
                          ) : (
                            <Ionicons name="image-outline" size={20} color="#9CA3AF" />
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827' }}>{item.title || item.name || 'Unnamed Item'}</Text>
                          <Text style={{ fontSize: 12, color: '#6B7280' }}>
                            {item.quantity ? `Qty: ${item.quantity}` : ''}
                            {item.quantity && item.category ? ' • ' : ''}
                            {item.category || ''}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827' }}>{item.price ? (typeof item.price === 'string' && item.price.includes('₹') ? item.price : `₹${item.price}`) : ''}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.bookingDetailValue}>No items listed</Text>
                  )}
                </View>

                {/* Location Info */}
                <View style={styles.bookingDetailSection}>
                  <Text style={styles.bookingDetailLabel}>Location</Text>
                  <Text style={styles.bookingDetailValue}>{selectedBooking.location}</Text>
                </View>

                {/* Full Address */}
                {selectedBooking.customerAddress && (
                  <View style={styles.bookingDetailSection}>
                    <Text style={styles.bookingDetailLabel}>Full Address</Text>
                    <Text style={styles.bookingDetailValue}>
                      {selectedBooking.customerAddress.address || selectedBooking.customerAddress.line1}
                      {'\n'}
                      {[
                        selectedBooking.customerAddress.city,
                        selectedBooking.customerAddress.state,
                        selectedBooking.customerAddress.pincode
                      ].filter(Boolean).join(', ')}
                    </Text>
                  </View>
                )}

                {/* Customer Phone */}
                {selectedBooking.customerPhone && (
                  <View style={styles.bookingDetailSection}>
                    <Text style={styles.bookingDetailLabel}>Contact Number</Text>
                    <Text style={styles.bookingDetailValue}>
                      {selectedBooking.customerPhone}
                    </Text>
                  </View>
                )}

                {/* Amount & Payment */}
                <View style={styles.bookingDetailSection}>
                  <Text style={styles.bookingDetailLabel}>Payment</Text>
                  <Text style={styles.bookingDetailValue}>{selectedBooking.amount} • {selectedBooking.paymentMode}</Text>
                </View>

                {/* Time Info */}
                <View style={styles.bookingDetailSection}>
                  <Text style={styles.bookingDetailLabel}>Requested</Text>
                  <Text style={styles.bookingDetailValue}>
                    {new Date(selectedBooking.createdAt).toLocaleString()}
                  </Text>
                </View>

                {/* Action Buttons */}
                {String(selectedBooking.status || '').toLowerCase() === 'new' && (
                  <View style={styles.actionButtonsContainer}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.rejectButton]}
                      onPress={async () => {
                        if (selectedBooking) {
                          try {
                            // removed verbose log
                            // Update booking status to cancelled
                            const currentStatus = (selectedBooking.status || '').toString();
                            const success = await CustomerBookingsAPI.updateStatus(selectedBooking.id, 'cancelled', currentStatus);
                            console.log('[rejectBooking] bookingId=', selectedBooking.id, 'apiResult=', success);
                            if (success) {
                              // Refresh bookings to show updated status
                              await fetchProviderBookings();
                              setShowBookingModal(false);
                              Alert.alert('Success', 'Booking rejected successfully.');
                            } else {
                              console.error('❌ Failed to reject booking');
                              Alert.alert('Error', 'Failed to reject booking. Please try again.');
                            }
                          } catch (error) {
                            console.error('❌ Error rejecting booking:', error);
                            Alert.alert('Error', 'Error rejecting booking. Please try again.');
                          }
                        }
                      }}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="close-circle-outline" size={moderateScale(22)} color="#ffffff" />
                      <Text style={styles.actionButtonText}>Reject</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionButton, styles.acceptButton]}
                      onPress={async () => {
                        if (selectedBooking) {
                          try {
                            // Accept booking: for pharmacies we may not have provider_service entries.
                            // Pass `currentProviderId` if available, otherwise pass current auth user id as `pharmacyProviderId`.
                            const pharmacyProviderId = (user && (user as any).id) ? (user as any).id : null;
                            const success = await CustomerBookingsAPI.acceptBooking(selectedBooking.id, currentProviderId ?? null, pharmacyProviderId);

                            console.log('[acceptBooking] bookingId=', selectedBooking.id, 'providerId=', currentProviderId, 'apiResult=', success);
                            if (success) {
                              // Optimistically update local state so booking appears under Active Jobs immediately
                              try {
                                const updated = bookings.map(b => b.id === selectedBooking.id ? { ...b, status: 'confirmed' } : b);
                                console.log('[acceptBooking] performing optimistic update for', selectedBooking.id);
                                setBookings(updated);
                                setBookingsState(updated);
                                setHasActiveBooking(true);
                              } catch (e) {
                                console.warn('Could not perform local optimistic update', e);
                              }

                              // Refresh from server in background to ensure canonical state
                              fetchProviderBookings().catch(err => console.warn('Refresh failed', err));

                              setShowBookingModal(false);
                            } else {
                              console.error('❌ Failed to update booking status');
                              // Fetch raw booking row and log for debugging (RLS or mismatch may be blocking update)
                              try {
                                const { data: rawRow, error: rawError } = await supabase
                                  .from('bookings')
                                  .select('*')
                                  .eq('id', selectedBooking.id)
                                  .single();
                                console.log('[acceptBooking][debug] raw booking row=', rawRow, 'rawError=', rawError);
                              } catch (e) {
                                console.warn('[acceptBooking][debug] failed to fetch raw booking row', e);
                              }
                              Alert.alert('Error', 'Failed to accept booking. Please try again.');
                            }
                          } catch (error) {
                            console.error('❌ Error accepting booking:', error);
                            Alert.alert('Error', 'Error accepting booking. Please try again.');
                          }
                        }
                      }}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="checkmark-circle-outline" size={moderateScale(22)} color="#ffffff" />
                      <Text style={styles.actionButtonText}>Accept</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Status Badge for non-new bookings */}
                {String(selectedBooking.status || '').toLowerCase() !== 'new' && (
                  <View style={styles.statusBadgeContainer}>
                    {(() => {
                      const s = String(selectedBooking.status || '').toLowerCase();
                      const styleArr: any[] = [styles.statusBadge];
                      const textStyleArr: any[] = [styles.statusBadgeText];
                      if (s === 'completed') {
                        styleArr.push({ backgroundColor: '#D7F5E7' });
                        textStyleArr.push({ color: '#118B50' });
                      } else if (s === 'assigned') {
                        styleArr.push({ backgroundColor: '#DBEAFE' });
                        textStyleArr.push({ color: '#1E40AF' });
                      } else if (s === 'inprogress') {
                        styleArr.push({ backgroundColor: '#FEF3C7' });
                        textStyleArr.push({ color: '#B45309' });
                      }

                      return (
                        <View style={styles.statusBadgeContainer}>
                          <View style={styleArr}>
                            <Text style={textStyleArr}>{selectedBooking.status}</Text>
                          </View>
                        </View>
                      );
                    })()}
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

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

      {/* Fixed bottom navigation */}
      <BottomTab active={'Home'} floating={true} />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  gradientBg: { flex: 1 },
  container: { flex: 1, padding: moderateScale(14) },
  staticContent: { paddingBottom: moderateScale(10), paddingTop: moderateScale(2), backgroundColor: '#ffffff' },
  fixedHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    elevation: 10, // Android elevation for proper layering
  },
  headerGradient: {
    flex: 1,
    paddingHorizontal: moderateScale(20),
    paddingBottom: moderateScale(6),
    borderBottomLeftRadius: moderateScale(20),
    borderBottomRightRadius: moderateScale(20),
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  headerTopRowOld: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: moderateScale(10),
  },
  headerLeft: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Simplified header styles
  simpleHeader: {

    marginTop: -60,
    left: 0,
    right: 0,
    zIndex: 9999,
    elevation: 9999,
    paddingTop: 0,
    marginBottom: 20,
  },
  simpleHeaderGradient: {
    paddingHorizontal: moderateScale(20),
    paddingBottom: moderateScale(20),
    borderBottomLeftRadius: moderateScale(20),
    borderBottomRightRadius: moderateScale(20),
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    minHeight: moderateScale(110),
    marginBottom: moderateScale(20),
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: moderateScale(-20),
    marginBottom: moderateScale(8),
  },
  headerLeftSection: {
    flex: 1,
  },
  simpleToggle: {
    backgroundColor: '#ff3b30',
    borderRadius: moderateScale(16),
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(8),
    minWidth: moderateScale(80),
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    marginTop: moderateScale(8),
    marginBottom: moderateScale(4),
  },
  simpleToggleText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: moderateScale(12),
  },
  // Toggle Switch (match DashboardScreen)
  toggleContainer: {
    marginTop: moderateScale(-5),
    marginBottom: moderateScale(10),
    alignSelf: 'flex-start',
  },
  toggleSwitch: {
    width: moderateScale(87),
    height: moderateScale(32),
    borderRadius: moderateScale(16),
    backgroundColor: '#ff3b30',
    position: 'relative',
    justifyContent: 'center',
    paddingHorizontal: moderateScale(4),
  },
  toggleSwitchOnline: {
    backgroundColor: '#26e07f',
  },
  toggleSwitchOffline: {
    backgroundColor: '#ff3b30',
  },
  toggleKnob: {
    position: 'absolute',
    width: moderateScale(24),
    height: moderateScale(24),
    borderRadius: moderateScale(12),
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 10,
  },
  toggleLabelLeft: {
    position: 'absolute',
    left: moderateScale(8),
    zIndex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleLabelRight: {
    position: 'absolute',
    right: moderateScale(8),
    zIndex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleLabelText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: moderateScale(11),
    textTransform: 'uppercase',
  },
  simpleRightButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(12),
  },
  simpleBellButton: {
    width: moderateScale(33),
    height: moderateScale(33),
    borderRadius: moderateScale(25),
    backgroundColor: '#13235d',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  simpleProfileButton: {
    width: moderateScale(50),
    height: moderateScale(50),
    alignItems: 'center',
    justifyContent: 'center',
  },
  simpleBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#3B5BFD',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 16,
    alignItems: 'center',
  },
  simpleBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  collapsibleHeader: {
    position: 'absolute',
    top: 10,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: moderateScale(10) },
  topRightSection: { flexDirection: 'column', alignItems: 'flex-end', marginRight: moderateScale(12) },
  topRowIcons: { flexDirection: 'row', alignItems: 'center', marginBottom: moderateScale(8) },
  headerLeftOld: { flexDirection: 'row', alignItems: 'center' },
  timeText: { color: '#ffffff', fontSize: moderateScale(16), fontWeight: '600', marginRight: moderateScale(8) },
  personIcon: { width: moderateScale(24), height: moderateScale(24), borderRadius: moderateScale(12), backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  logo: { fontSize: moderateScale(24), color: '#ffffff', fontWeight: '800' },
  logoSub: { fontSize: moderateScale(14), fontWeight: '600' },
  locationChip: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: moderateScale(16), paddingVertical: moderateScale(6), paddingHorizontal: moderateScale(10), flexDirection: 'row', alignItems: 'center', marginTop: moderateScale(6) },
  locationText: { color: '#cfe0ff', fontWeight: '700', marginLeft: moderateScale(6) },
  brandName: { color: '#ffffff', fontSize: moderateScale(22), fontWeight: '800' },
  bellWrap: { width: moderateScale(44), height: moderateScale(44), borderRadius: moderateScale(22), backgroundColor: '#13235d', alignItems: 'center', justifyContent: 'center', marginRight: moderateScale(12), position: 'relative', minWidth: moderateScale(44), minHeight: moderateScale(44) }, // Increased size for better touch
  badge: { position: 'absolute', top: -6, right: -6, backgroundColor: '#3B5BFD', borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 },
  badgeText: { color: '#ffffff', fontSize: 10, fontWeight: '700' },
  onlineToggle: {},
  onlineTogglePill: { paddingVertical: moderateScale(6), paddingHorizontal: moderateScale(12), borderRadius: moderateScale(16) },
  onlineTogglePillOnline: { backgroundColor: '#26e07f' },
  onlineTogglePillOffline: { backgroundColor: '#ff3b30' },
  onlineToggleText: { color: '#ffffff', fontSize: moderateScale(12), fontWeight: '700' },
  onlineTogglePill2: { flexDirection: 'row', alignItems: 'center', paddingVertical: moderateScale(6), paddingHorizontal: moderateScale(12), borderRadius: moderateScale(16), backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1 },
  online: { borderColor: '#26e07f' },
  offline: { borderColor: '#ff3b30' },
  dot: { width: moderateScale(8), height: moderateScale(8), borderRadius: moderateScale(4), marginRight: moderateScale(8) },
  dotOnline: { backgroundColor: '#26e07f' },
  dotOffline: { backgroundColor: '#ff3b30' },
  onlineText: { color: '#ffffff', fontWeight: '800' },
  // New knob-style toggle like the reference image
  knobToggle: { marginTop: moderateScale(8), backgroundColor: '#ff3b30', borderRadius: moderateScale(16), height: moderateScale(28), paddingHorizontal: moderateScale(6), minWidth: moderateScale(60), alignItems: 'center', justifyContent: 'center', minHeight: moderateScale(30) }, // Increased min height for better touch
  knobToggleOnline: { backgroundColor: '#26e07f' },
  knobToggleOffline: { backgroundColor: '#ff3b30' },
  knobToggleLabel: { color: '#ffffff', fontWeight: '900', fontSize: moderateScale(12), paddingLeft: moderateScale(12), paddingRight: moderateScale(20), lineHeight: moderateScale(16) },
  knob: { position: 'absolute', top: moderateScale(4), width: moderateScale(20), height: moderateScale(20), borderRadius: moderateScale(10), backgroundColor: '#ffffff' },
  knobLeft: { left: moderateScale(8) },
  knobRight: { right: moderateScale(8) },
  switchWrap: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: moderateScale(16), overflow: 'hidden' },
  switchHalf: { paddingVertical: moderateScale(6), paddingHorizontal: moderateScale(14) },
  switchHalfActive: { backgroundColor: '#ffffff' },
  switchText: { color: '#cfe0ff', fontWeight: '800' },
  switchTextActive: { color: '#001973' },
  disabledBtn: { backgroundColor: '#E5E7EB', opacity: 0.6 },
  disabledBtnText: { color: '#9CA3AF' },
  avatarDot: { width: moderateScale(32), height: moderateScale(32), borderRadius: moderateScale(16), backgroundColor: '#e6e8ff', alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: moderateScale(32), height: moderateScale(32), borderRadius: moderateScale(16) },
  earningsCardWhite: { backgroundColor: '#ffffff', borderRadius: moderateScale(14), padding: moderateScale(12), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: moderateScale(16), marginTop: moderateScale(12) },
  cardTitleDark: { color: '#111827', fontWeight: '600' },
  cardAmountBlue: { color: '#3B5BFD', fontSize: moderateScale(32), fontWeight: '800', marginTop: moderateScale(8) },
  cardMetaDark: { color: '#374151', marginTop: moderateScale(6) },
  walletCircle: { width: moderateScale(44), height: moderateScale(44), borderRadius: moderateScale(22), backgroundColor: '#3B5BFD', alignItems: 'center', justifyContent: 'center' },
  viewDetailsInside: { position: 'absolute', right: moderateScale(16), bottom: moderateScale(12) },
  viewDetailsDark: { color: '#3B5BFD', fontWeight: '700' },
  sectionHeader: { color: '#ffffff', fontWeight: '700', marginTop: moderateScale(24), marginBottom: moderateScale(12), fontSize: moderateScale(17) },
  acceptedPill: { color: '#26e07f', fontWeight: '800' },
  devRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: moderateScale(8) },
  devBtn: { borderWidth: 1, borderColor: '#3B5BFD', paddingVertical: moderateScale(6), paddingHorizontal: moderateScale(10), borderRadius: moderateScale(10), backgroundColor: '#0b1f66' },
  devBtnText: { color: '#baccff', fontWeight: '700', fontSize: moderateScale(12) },
  insightsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: moderateScale(16) },
  tile: { backgroundColor: '#ffffff', borderRadius: moderateScale(14), padding: moderateScale(10), width: '31%', alignItems: 'flex-start' },
  tileValue: { color: '#111827', fontWeight: '700', marginTop: moderateScale(8) },
  tileLabel: { color: '#6B7280', marginTop: moderateScale(4) },
  quickRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: moderateScale(2) },
  quickBoxWhite: { backgroundColor: '#ffffff', borderRadius: moderateScale(12), padding: moderateScale(10) },
  quickBoxRow: { flexDirection: 'row', alignItems: 'center' },
  quickBoxCol: { alignItems: 'center' },
  quickIcon: { width: moderateScale(36), height: moderateScale(36), borderRadius: moderateScale(18), backgroundColor: '#3B5BFD', alignItems: 'center', justifyContent: 'center', marginBottom: moderateScale(6) },
  quickIconSmall: { width: moderateScale(28), height: moderateScale(28), borderRadius: moderateScale(14), backgroundColor: '#3B5BFD', alignItems: 'center', justifyContent: 'center', marginBottom: moderateScale(4) },
  quickIconLarge: { width: moderateScale(36), height: moderateScale(36), borderRadius: moderateScale(18), backgroundColor: '#3B5BFD', alignItems: 'center', justifyContent: 'center', marginBottom: moderateScale(6) },
  quickIconXl: { width: moderateScale(56), height: moderateScale(56), borderRadius: moderateScale(28), backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', marginBottom: moderateScale(4) },
  quickTextDark: { color: '#111827', fontWeight: '600', marginLeft: moderateScale(6), maxWidth: moderateScale(90), fontSize: moderateScale(12) },
  quickTextLarge: { color: '#111827', fontWeight: '700', marginLeft: moderateScale(8), maxWidth: moderateScale(110), fontSize: moderateScale(13) },
  quickTextXl: { color: '#111827', fontWeight: '800', textAlign: 'center', maxWidth: moderateScale(120), fontSize: moderateScale(13) },
  jobCardWhite: { backgroundColor: '#ffffff', borderRadius: moderateScale(16), padding: moderateScale(12), marginTop: moderateScale(8), marginBottom: moderateScale(8), flexDirection: 'row', alignItems: 'center' },
  jobTitleDark: { color: '#111827', fontWeight: '700', fontSize: moderateScale(16) },
  jobMetaDark: { color: '#374151', fontSize: moderateScale(14) },
  dotSep: { color: '#9CA3AF' },
  linkBlue: { color: '#3B5BFD', fontWeight: '700' },
  greenTag: { backgroundColor: '#D7F5E7', borderRadius: moderateScale(14), paddingHorizontal: moderateScale(10), paddingVertical: moderateScale(4) },
  greenTagText: { color: '#118B50', fontWeight: '700', fontSize: moderateScale(12) },
  primaryBtnFill: { backgroundColor: '#3b5bfd', paddingVertical: moderateScale(12), paddingHorizontal: moderateScale(16), borderRadius: moderateScale(12) },
  primaryBtnFillOffline: { backgroundColor: '#ff3b30' },
  primaryBtnFillText: { color: '#ffffff', fontWeight: '700' },
  assignBtnRed: { backgroundColor: '#3b5bfd', paddingVertical: moderateScale(12), paddingHorizontal: moderateScale(16), borderRadius: moderateScale(12) },
  assignBtnRedText: { color: '#ffffff', fontWeight: '900' },
  assignedBtn: { backgroundColor: '#26e07f', paddingVertical: moderateScale(12), paddingHorizontal: moderateScale(16), borderRadius: moderateScale(12) },
  assignedBtnText: { color: '#0b1960', fontWeight: '900' },
  assignedPartnerText: { fontSize: moderateScale(13), fontWeight: '700' },
  cardShadow: { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 },

  // Modal styles
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  modalCard: { backgroundColor: '#0a1a4a', borderRadius: 16, padding: 20, width: '86%', borderWidth: 1, borderColor: '#24357a' },
  modalTitle: { color: '#ffffff', fontWeight: '800', fontSize: moderateScale(18) },
  modalSub: { color: '#cfe0ff', marginTop: 8 },
  modalRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 },
  modalBtnOutline: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: '#3b5bfd', marginRight: 10 },
  modalBtnOutlineText: { color: '#cfe0ff', fontWeight: '700' },
  modalBtnFill: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, backgroundColor: '#3b5bfd' },
  modalBtnFillText: { color: '#ffffff', fontWeight: '700' },

  // Notice banner
  noticeBanner: { position: 'absolute', left: 16, right: 16, top: '35%', backgroundColor: '#0b1f66', borderColor: '#2a3e85', borderWidth: 1.4, borderRadius: 22, paddingVertical: 24, paddingHorizontal: 20 },
  noticeHeaderRow: { flexDirection: 'row', alignItems: 'center' },
  noticeTitle: { color: '#ffffff', fontWeight: '900', marginLeft: 12, fontSize: moderateScale(20) },
  noticeSub: { color: '#cfe0ff', marginTop: 12, fontSize: moderateScale(14) },
  noticeActionsRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 },
  noticeBtnOutline: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1, borderColor: '#3b5bfd', marginRight: 12 },
  noticeBtnOutlineText: { color: '#cfe0ff', fontWeight: '800' },
  noticeBtnFill: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 14, backgroundColor: '#3b5bfd' },
  noticeBtnFillText: { color: '#ffffff', fontWeight: '800' },

  // Segmented control & chips
  segmentWrap: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: moderateScale(14), padding: moderateScale(4), marginTop: moderateScale(12) },
  segmentBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: moderateScale(8), borderRadius: moderateScale(10), borderWidth: 1, borderColor: 'transparent' },
  segmentBtnActive: { backgroundColor: 'rgba(255,255,255,0.18)' },
  segmentText: { fontWeight: '800' },
  chip: { paddingVertical: moderateScale(6), paddingHorizontal: moderateScale(12), borderRadius: moderateScale(16), borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  chipActive: { backgroundColor: 'rgba(255,255,255,0.18)' },
  chipText: { fontWeight: '700', fontSize: moderateScale(12) },

  // Search bar
  searchBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: moderateScale(14), paddingVertical: moderateScale(10), paddingHorizontal: moderateScale(12), borderWidth: 1 },
  searchBarLeft: { flexDirection: 'row', alignItems: 'center' },
  searchBarText: { color: '#e7ecff', marginLeft: moderateScale(8), fontWeight: '700' },
  searchBarRight: { backgroundColor: 'rgba(255,255,255,0.18)', width: moderateScale(30), height: moderateScale(30), borderRadius: moderateScale(10), alignItems: 'center', justifyContent: 'center' },

  // Banner carousel
  bannerCard: { width: 260, height: 84, borderRadius: 16, padding: 15, justifyContent: 'center' },
  bannerTitle: { color: '#ffffff', fontWeight: '900' },
  bannerSub: { color: '#e8eeff', marginTop: 6 },
  tipBannerCard: { borderRadius: moderateScale(16), padding: moderateScale(16), height: moderateScale(120), justifyContent: 'center' },
  tipBannerTitle: { color: '#ffffff', fontWeight: '900', fontSize: moderateScale(14) },
  tipBannerSub: { color: '#e8eeff', marginTop: moderateScale(4), fontWeight: '700' },
  tipBannerBody: { color: '#ffffff', marginTop: moderateScale(12), fontWeight: '900', fontSize: moderateScale(18) },
  tipBannerChevron: { position: 'absolute', right: moderateScale(14), bottom: moderateScale(14), backgroundColor: 'rgba(255,255,255,0.18)', width: moderateScale(34), height: moderateScale(34), borderRadius: moderateScale(12), alignItems: 'center', justifyContent: 'center' },

  // Empty state
  emptyCard: { backgroundColor: '#ffffff', borderRadius: moderateScale(16), padding: moderateScale(16), alignItems: 'flex-start', marginTop: moderateScale(8), marginBottom: moderateScale(8) },
  emptyIconWrap: { width: moderateScale(36), height: moderateScale(36), borderRadius: moderateScale(18), backgroundColor: 'rgba(59,91,253,0.12)', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontWeight: '800', marginTop: moderateScale(8), fontSize: moderateScale(15) },
  emptySub: { marginTop: moderateScale(4) },

  // Header quick actions
  headerQuickGrid: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  quickTile: { alignItems: 'center', minHeight: moderateScale(60), minWidth: moderateScale(60), paddingVertical: moderateScale(8) }, // Increased touch area
  quickTileIconWrap: { width: moderateScale(34), height: moderateScale(34), borderRadius: moderateScale(12), backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  quickTileLabel: { color: '#ffffff', fontWeight: '800', fontSize: moderateScale(9), marginTop: moderateScale(6) },

  // Booking Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalOverlayTouch: {
    flex: 1,
  },
  bookingModalCard: {
    width: '100%',
    maxHeight: '75%',
    borderTopLeftRadius: moderateScale(24),
    borderTopRightRadius: moderateScale(24),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
    overflow: 'hidden',
  },
  bookingModalHeader: {
    paddingTop: moderateScale(20),
    paddingBottom: moderateScale(20),
    paddingHorizontal: moderateScale(20),
  },
  bookingModalHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(12),
  },
  bookingModalIconWrapper: {
    width: moderateScale(48),
    height: moderateScale(48),
    borderRadius: moderateScale(12),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookingModalTitle: {
    fontSize: moderateScale(20),
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  bookingModalSubtitle: {
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
  bookingModalContent: {
    padding: moderateScale(24),
    paddingTop: moderateScale(20),
    paddingBottom: moderateScale(40),
  },
  bookingDetailSection: {
    backgroundColor: '#F9FAFB',
    borderRadius: moderateScale(12),
    padding: moderateScale(16),
    marginBottom: moderateScale(12),
  },
  bookingDetailLabel: {
    fontSize: moderateScale(12),
    fontWeight: '700',
    marginBottom: moderateScale(6),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#666666',
  },
  bookingDetailValue: {
    fontSize: moderateScale(14),
    fontWeight: '600',
    lineHeight: moderateScale(20),
    color: '#000000',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: moderateScale(12),
    marginTop: moderateScale(28),
    marginBottom: moderateScale(24),
    paddingTop: moderateScale(24),
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: moderateScale(8),
    paddingVertical: moderateScale(16),
    borderRadius: moderateScale(14),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  rejectButton: {
    backgroundColor: '#EF4444',
  },
  acceptButton: {
    backgroundColor: '#22C55E',
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: moderateScale(16),
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statusBadgeContainer: {
    marginTop: moderateScale(20),
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: moderateScale(20),
    paddingVertical: moderateScale(10),
    borderRadius: moderateScale(20),
  },
  statusBadgeText: {
    fontSize: moderateScale(15),
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  // Employee Modal styles
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

export default DashboardScreen;
