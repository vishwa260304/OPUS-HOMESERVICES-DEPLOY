import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, Dimensions, Modal, Animated, Easing, Image, Platform, StatusBar, RefreshControl, Alert, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import BottomTab from '../components/BottomTab';
import { moderateScale } from '../utils/responsive';
import { Ionicons } from '@expo/vector-icons';
import OpusAgentLogo from '../components/OpusAgentLogo';
import { getCompanyInfo, getOnlineStatus, setOnlineStatus, recordJobAccepted, recordJobRequest, getStats, getSelectedSector, getBookings, getEarningsSummary, pushNotification, getNotifications, loadOnlineStatus, cacheEarningsSummary, loadCachedEarningsSummary, cacheAvgRating, loadCachedAvgRating } from '../utils/appState';
import { setBookings } from '../utils/appState';
import GradientHeader from '../components/GradientHeader';
// Theme toggle removed from header; theme selection moved to Profile
import { useTheme } from '../context/ThemeContext';
import { CustomerBookingsAPI } from '../lib/customerBookings';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useVerification } from '../hooks/useVerification';

const DashboardScreen: React.FC = () => {
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const { user } = useAuth();
  const { verification } = useVerification();
  const [brandName, setBrandName] = useState<string>('Fixit Partner');
  const [isOnline, setIsOnline] = useState<boolean>(getOnlineStatus());
  const [showGoOnlinePrompt, setShowGoOnlinePrompt] = useState<boolean>(false);
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [hasActiveBooking, setHasActiveBooking] = useState<boolean>(false);
  const [todayEarnings, setTodayEarnings] = useState<number>(getEarningsSummary?.().todayAmount || 0);
  const [todayCompletedCount, setTodayCompletedCount] = useState<number>(getEarningsSummary?.().todayCompletedCount || 0);
  const [weeklyAmount, setWeeklyAmount] = useState<number | null>(null);
  const [acceptancePct, setAcceptancePct] = useState<number>(getEarningsSummary?.().acceptancePct || 0);
  const [notificationCount, setNotificationCount] = useState<number>(getNotifications().length);
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
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [reviewCount, setReviewCount] = useState<number>(0);
  const sliderX = useRef(new Animated.Value(0)).current;
  const toggleAnim = useRef(new Animated.Value(isOnline ? 1 : 0)).current;
  const { width } = Dimensions.get('window');
  const [headerHeight, setHeaderHeight] = useState<number>(140);

  // Compute total earnings for the current week (Monday -> today)
  const getStartOfWeek = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay(); // 0 = Sunday
    const diff = (day + 6) % 7; // days since Monday
    d.setDate(d.getDate() - diff);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const parseAmountValue = (amt: any) => {
    if (amt == null) return 0;
    if (typeof amt === 'number') return amt;
    if (typeof amt === 'string') {
      const cleaned = amt.replace(/[^0-9.\-]/g, '').replace(/,/g, '');
      const n = parseFloat(cleaned);
      return isNaN(n) ? 0 : n;
    }
    return 0;
  };

  useEffect(() => {
    try {
      const start = getStartOfWeek(new Date());
      const now = new Date();
      const sum = bookings.reduce((acc, b) => {
        const created = b?.createdAt ? new Date(b.createdAt) : null;
        if (!created) return acc;
        if (created < start || created > now) return acc;
        const status = (b?.status || '').toString().toLowerCase();
        if (status !== 'completed') return acc; // count only completed jobs as earnings
        return acc + parseAmountValue(b.amount);
      }, 0);
      setWeeklyAmount(Math.round(sum));
    } catch (err) {
      console.error('Error computing weekly earnings', err);
    }
  }, [bookings]);
  const horizontalPadding = moderateScale(16);
  const gap = moderateScale(12);
  const tileWidth = Math.floor((width - horizontalPadding * 2 - gap * 2));
  const singleTileWidth = Math.floor(tileWidth / 3);
  const quickThirdWidth = Math.floor((width - horizontalPadding * 2 - gap * 2) / 3);
  const quickHalfWidth = Math.floor((width - horizontalPadding * 2 - gap) / 2);

  // Fixed header - no animations needed

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

      if (servicesError || !services || services.length === 0) {
        console.log('No services found for provider');
        setBookings([]);
        return;
      }

      // Get all provider_service_ids
      const providerServiceIds = services.map(s => s.id);

      // Fetch bookings for all provider service IDs
      const allBookings: any[] = [];
      for (const serviceId of providerServiceIds) {
        const bookings = await CustomerBookingsAPI.getByProviderId(serviceId);
        allBookings.push(...bookings);
      }

      console.log('✅ Total bookings fetched:', allBookings.length);

      // Sort by creation date (newest first)
      allBookings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // Update app state with real bookings
      setBookings(allBookings);
      setBookingsState(allBookings);
      // Update earnings/acceptance from refreshed bookings summary
      try {
        const esFresh = getEarningsSummary();
        setTodayEarnings(esFresh.todayAmount || 0);
        setTodayCompletedCount(esFresh.todayCompletedCount || 0);
        setAcceptancePct(esFresh.acceptancePct || 0);
      } catch (e) {
        console.debug('Could not update earnings from refreshed bookings', e);
      }
        // Cache earnings summary after bookings refresh
        try {
          const esToCache = getEarningsSummary();
          await cacheEarningsSummary(esToCache);
        } catch (e) {
          console.debug('Error caching earnings after bookings refresh', e);
        }
      // keep concise state update if needed

      // Helper function to normalize status for comparison
      const normalizeStatus = (status: string) => (status || '').toLowerCase();

      const active = allBookings.some(b => {
        const status = normalizeStatus(b.status);
        return status === 'confirmed' ||
          status === 'assigned' ||
          status === 'inprogress' ||
          status === 'in_progress';
      });
      setHasActiveBooking(active);
    } catch (error) {
      console.error('Failed to fetch provider bookings:', error);
    }
  };

  // Fetch average rating from reviews table
  const fetchAverageRating = async () => {
    if (!user?.id) return;
    try {
      // Prefer server-side RPC to compute stats (create the function in Supabase SQL first)
      try {
        const { data: rpcData, error: rpcErr } = await supabase.rpc('get_provider_review_stats', { p_user: user.id });
        if (!rpcErr && rpcData) {
          // rpcData may be an object or array depending on driver
          const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
          const rpcAvg = row?.avg_rating ? Number(row.avg_rating) : 0;
          const rpcCount = row?.review_count ? Number(row.review_count) : 0;
          setAvgRating(rpcAvg);
          setReviewCount(rpcCount);
          try { await cacheAvgRating({ avgRating: rpcAvg, reviewCount: rpcCount }); } catch (e) { console.debug('cache avg rating failed', e); }
          return;
        }
      } catch (e) {
        // ignore rpc errors and fall back to client-side scanning
        console.debug('RPC get_provider_review_stats failed, falling back:', e);
      }
      // 1) If this user is a doctor, fetch reviews by doctor_id
      const { data: docData, error: docErr } = await supabase
        .from('reviews')
        .select('rating')
        .eq('doctor_id', user.id);

      if (!docErr && docData && docData.length > 0) {
        const sum = docData.reduce((acc, r) => acc + (r.rating || 0), 0);
        const docAvg = Math.round((sum / docData.length) * 10) / 10;
        setAvgRating(docAvg);
        setReviewCount(docData.length);
        try { await cacheAvgRating({ avgRating: docAvg, reviewCount: docData.length }); } catch (e) { console.debug('cache avg rating failed', e); }
        return;
      }

      // 2) For regular providers, find all providers_services ids for this user and query reviews where provider_id IN (...) 
      const { data: services, error: svcErr } = await supabase
        .from('providers_services')
        .select('id')
        .eq('user_id', user.id);

      // Gather numeric service IDs (providers_services.id)
      const serviceIdsRaw = (!svcErr && services) ? services.map(s => s.id) : [];
      const numericServiceIds = serviceIdsRaw.map(id => Number(id)).filter(n => Number.isFinite(n));
      const serviceIdStrings = serviceIdsRaw.map((id: any) => String(id));

      // Also gather provider_profile ids (UUIDs) for this user to match reviews that reference profiles
      const { data: profiles, error: profilesErr } = await supabase
        .from('providers_profiles')
        .select('id')
        .eq('user_id', user.id);
      const profileIds = (!profilesErr && profiles) ? profiles.map((p: any) => String(p.id)) : [];

      // Fetch recent reviews without filtering on provider_id to avoid bigint/uuid cast issues.
      // We'll filter client-side by numeric service ids and profile ids.
      const { data: allReviews, error: allErr } = await supabase
        .from('reviews')
        .select('rating, provider_id, doctor_id')
        .limit(1000);

      if (allErr) {
        console.error('Error fetching reviews:', allErr);
        setAvgRating(0);
        setReviewCount(0);
        return;
      }

      const matched: any[] = [];
      console.debug('fetchAverageRating:', { numericServiceIdsLength: numericServiceIds.length, profileIdsLength: profileIds.length, totalReviews: (allReviews || []).length });
      for (const r of (allReviews || [])) {
        // Include doctor reviews for this user
        if (r.doctor_id && String(r.doctor_id) === String(user.id)) {
          matched.push(r);
          continue;
        }

        // provider_id can be numeric (providers_services.id) or string UUID (providers_profiles.id)
        const pid = r.provider_id;
        if (pid == null) continue;

        if (typeof pid === 'number') {
          if (numericServiceIds.includes(pid)) matched.push(r);
        } else if (typeof pid === 'string') {
          // direct match to user id (some rows may store user id in provider_id)
          if (String(pid) === String(user.id)) {
            matched.push(r);
            continue;
          }

            // direct match to service id string (e.g. '152')
            if (serviceIdStrings.includes(pid)) {
              matched.push(r);
              continue;
            }

            // if string looks numeric, treat as number
            const asNum = Number(pid);
            if (Number.isFinite(asNum) && numericServiceIds.includes(asNum)) {
              matched.push(r);
            } else if (profileIds.includes(pid)) {
              matched.push(r);
            }
        }
      }

      if (matched.length > 0) {
        const sum = matched.reduce((acc, r) => acc + (r.rating || 0), 0);
        const matchedAvg = Math.round((sum / matched.length) * 10) / 10;
        setAvgRating(matchedAvg);
        setReviewCount(matched.length);
        try { await cacheAvgRating({ avgRating: matchedAvg, reviewCount: matched.length }); } catch (e) { console.debug('cache avg rating failed', e); }
        return;
      }

      // 3) Last fallback: some rows may have provider_id set to a UUID (providers_profiles.id) or user.id
      // If no numeric service IDs or no ratings found, we cannot safely query provider_id using UUIDs
      // without risking bigint casting errors. Reset to defaults.
      setAvgRating(0);
      setReviewCount(0);
      try { await cacheAvgRating({ avgRating: 0, reviewCount: 0 }); } catch (e) { console.debug('cache avg rating failed', e); }
    } catch (error) {
      console.error('Error fetching average rating:', error);
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
        await fetchProviderBookings();
      } else {
        Alert.alert('Error', 'Failed to assign employee. Please try again.');
      }
    } catch (error) {
      console.error('Error assigning employee:', error);
      Alert.alert('Error', 'Failed to assign employee. Please try again.');
    }
  };

  // Fetch verification ID and load online status from database
  const fetchVerificationId = async () => {
    if (!user) return;
    try {
      const { data, error } = await api.companyVerification.getCompanyVerification(user.id);
      if (data && !error) {
        setVerificationId(data.id);
        // Load online status from database if available
        if (data.online_status !== undefined && data.online_status !== null) {
          setIsOnline(data.online_status);
          await setOnlineStatus(data.online_status);
          toggleAnim.setValue(data.online_status ? 1 : 0);
        }
      }
    } catch (error) {
      console.error('Error fetching verification ID:', error);
    }
  };

  // Helper function to save online status to both local storage and database
  const saveOnlineStatus = async (status: boolean) => {
    // Save to local storage
    await setOnlineStatus(status);
    setIsOnline(status);
    toggleAnim.setValue(status ? 1 : 0);

    // Save to database if verification ID is available
    if (verificationId && user) {
      try {
        await api.companyVerification.updateCompanyVerification(verificationId, {
          online_status: status
        });
      } catch (error) {
        console.error('Error saving online status to database:', error);
      }
    }
  };

  // Guard: Redirect doctor consultation users to DoctorDashboard
  useEffect(() => {
    if (verification?.selected_sector === 'Doctor Consultation') {
      navigation.reset({
        index: 0,
        routes: [{ name: 'DoctorDashboard' as never }],
      });
    }
  }, [verification, navigation]);

  // Load online status and bookings from storage on first mount
  useEffect(() => {
    const initOnlineStatus = async () => {
      const status = await loadOnlineStatus();
      setIsOnline(status);
      // Sync toggle animation with loaded status
      toggleAnim.setValue(status ? 1 : 0);
      // Fetch verification ID to enable database updates
      await fetchVerificationId();
    };
    initOnlineStatus();
    // Initialize bookings from app state
    setBookingsState(getBookings());
    // Load cached earnings & rating quickly and surface them
    (async () => {
      try {
        const cached = await loadCachedEarningsSummary();
        if (cached) {
          setTodayEarnings(cached.todayAmount || 0);
          setTodayCompletedCount(cached.todayCompletedCount || 0);
          setAcceptancePct(cached.acceptancePct || 0);
          setWeeklyAmount(Math.round(cached.weeklyAmount) || 0);
        }
      } catch (e) {
        console.debug('Error loading cached earnings:', e);
      }

      try {
        const cachedRating = await loadCachedAvgRating();
        if (cachedRating) {
          setAvgRating(cachedRating.avgRating ?? null);
          setReviewCount(cachedRating.reviewCount || 0);
        }
      } catch (e) {
        console.debug('Error loading cached rating:', e);
      }
    })();
    // Ensure earnings/acceptance show immediately from cached summary
    try {
      const esInit = getEarningsSummary();
      setTodayEarnings(esInit.todayAmount || 0);
      setTodayCompletedCount(esInit.todayCompletedCount || 0);
      setAcceptancePct(esInit.acceptancePct || 0);
    } catch (e) {
      console.debug('Could not initialize earnings from cache', e);
    }
    // Fetch fresh bookings and ratings from database
    fetchProviderBookings();
    fetchAverageRating();
  }, []);

  useEffect(() => {
    if (isFocused) {
      setBrandName(getCompanyInfo().companyName || 'Fixit Partner');
      // Sync online status whenever this screen regains focus
      const status = getOnlineStatus();
      setIsOnline(status);
      // Sync toggle animation with current status
      toggleAnim.setValue(status ? 1 : 0);
      // Fetch verification ID if not already loaded
      if (!verificationId) {
        fetchVerificationId();
      } else {
        // Load online status from database if verification ID is available
        const loadOnlineStatusFromDB = async () => {
          try {
            const { data, error } = await api.companyVerification.getCompanyVerification(user?.id || '');
            if (data && !error && data.online_status !== undefined && data.online_status !== null) {
              setIsOnline(data.online_status);
              await setOnlineStatus(data.online_status);
              toggleAnim.setValue(data.online_status ? 1 : 0);
            }
          } catch (error) {
            console.error('Error loading online status from database:', error);
          }
        };
        loadOnlineStatusFromDB();
      }
      // Fetch real bookings from database
      fetchProviderBookings();
      fetchAverageRating();
      // Simulate a new incoming job request for the banner card
      recordJobRequest();
      const es = getEarningsSummary();
      setTodayEarnings(es.todayAmount);
      setTodayCompletedCount(es.todayCompletedCount);
      // avoid showing possibly stale summary value; compute weeklyAmount from bookings
      setWeeklyAmount(null);
      setAcceptancePct(es.acceptancePct);
      setNotificationCount(getNotifications().length);
    }
  }, [isFocused, verificationId, user]);

  // Set up realtime subscription for new bookings
  useEffect(() => {
    if (!user?.id) return;

    let providerServiceIds: number[] = [];
    let channel: any = null;

    // First, get provider service IDs
    const setupRealtimeSubscription = async () => {
      try {
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

        // Create a channel for realtime updates
        channel = supabase
          .channel('new-bookings-dashboard')
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'bookings',
            },
            async (payload) => {
              const newBooking = payload.new;

              // Check if booking belongs to this provider
              if (!providerServiceIds.includes(newBooking.provider_service_id)) {
                return;
              }

              console.log('📡 New booking received via realtime:', newBooking);

              try {
                // Transform the new booking using the same function
                const transformedBooking = await CustomerBookingsAPI.getByProviderId(newBooking.provider_service_id);
                const found = transformedBooking.find(b => b.id === newBooking.id);

                if (found) {
                  // Add new booking to the beginning of the list (newest first)
                  setBookingsState((prevBookings: any[]) => {
                    // Check if booking already exists to avoid duplicates
                    const exists = prevBookings.some((b: any) => b.id === found.id);
                    if (exists) {
                      return prevBookings;
                    }
                    // Add to beginning and sort by creation date
                    const updated = [found, ...prevBookings];
                    updated.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                    return updated;
                  });

                  // Update hasActiveBooking if this is an active booking
                  const normalizeStatus = (status: string) => (status || '').toLowerCase();
                  const status = normalizeStatus(found.status);
                  if (status === 'confirmed' || status === 'assigned' || status === 'inprogress' || status === 'in_progress') {
                    setHasActiveBooking(true);
                  }

                  // Update app state
                  const currentBookings = getBookings();
                  const updatedBookings = [found, ...currentBookings];
                  updatedBookings.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                  setBookings(updatedBookings);
                }
              } catch (error) {
                console.error('Error processing new booking:', error);
                // Fallback: reload all bookings
                fetchProviderBookings();
              }
            }
          )
          .subscribe((status) => {
            console.log('📡 Realtime subscription status for new bookings:', status);
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
  }, [user?.id]);
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      setBrandName(getCompanyInfo().companyName || 'Fixit Partner');
      setIsOnline(getOnlineStatus());
      // Refresh bookings from database
      await fetchProviderBookings();
      await fetchAverageRating();
      const es = getEarningsSummary();
      setTodayEarnings(es.todayAmount);
      setTodayCompletedCount(es.todayCompletedCount);
      // avoid showing possibly stale summary value; compute weeklyAmount from bookings
      setWeeklyAmount(null);
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


  // Sector-aware colors: teal for healthcare
  const selected = (getSelectedSector?.() as 'home' | 'healthcare' | 'automobile' | 'appliance') || 'home';
  const sectorPrimary = selected === 'healthcare' ? '#0AAE8A' : '#3B5BFD';
  const sectorPrimarySoft = selected === 'healthcare' ? 'rgba(10,174,138,0.35)' : 'rgba(58,99,255,0.35)';
  // Sector header gradient
  const sectorGradient: [string, string] = selected === 'healthcare' ? ['#0BB48F', '#0A8F6A'] : ['#004c8f', '#0c1a5d'];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={sectorGradient[0]} translucent={true} />

      {/* Fixed Header */}
      <View style={[
        styles.fixedHeader,
        {
          paddingTop: insets.top,
        }
      ]}>
        <LinearGradient
          colors={sectorGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.simpleHeaderGradient}
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

          {/* Movable Toggle Switch - positioned below brand name */}
          <View style={styles.toggleContainer}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={async () => {
                const next = !isOnline;
                // Animate toggle
                Animated.spring(toggleAnim, {
                  toValue: next ? 1 : 0,
                  useNativeDriver: true,
                  tension: 100,
                  friction: 8,
                }).start();
                // Save to both local storage and database
                await saveOnlineStatus(next);
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
        style={[styles.collapsibleHeader, { opacity: 0, paddingTop: Math.max(0, insets.top - 10) }]}
        onLayout={(e) => setHeaderHeight(Math.max(100, Math.round(e.nativeEvent.layout.height)))}
        pointerEvents="none"
      >
        <GradientHeader
          gradientColors={sectorGradient}
          left={<View style={{ height: 100 }} />}
          right={<View style={{ height: 100 }} />}
          bottom={<View style={{ height: 100 }} />}
        />
      </View>

      {/* Scrollable Content */}
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={[styles.scrollContent, { paddingTop: headerHeight + insets.top - moderateScale(10), paddingHorizontal: moderateScale(16), backgroundColor: colors.background }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Quick action cards moved above banner as requested */}
        <View style={[styles.quickRow, { columnGap: gap, paddingHorizontal: 0, marginTop: moderateScale(-100), zIndex: 10, elevation: 10 }]}>
          <TouchableOpacity
            style={[styles.quickBoxWhite, styles.cardShadow, {
              width: quickHalfWidth,
              padding: 0,
              overflow: 'hidden',
              height: moderateScale(90),
              zIndex: 11,
              elevation: 11
            }]}
            onPress={() => {
              try {
                const sector = (getSelectedSector?.() as 'home' | 'healthcare' | 'automobile' | 'appliance') || 'home';
                (navigation as any).navigate('AddNewService', { root: sector, lockRoot: true });
              } catch (error) {
                console.error('Navigation error:', error);
              }
            }}
            activeOpacity={0.85}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <LinearGradient
              colors={sectorGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={{
                width: '100%',
                height: '100%',
                borderRadius: moderateScale(12),
                padding: moderateScale(9),
                alignItems: 'center',
                justifyContent: 'center'
              }}
              pointerEvents="none"
            >
              <View style={styles.quickBoxCol} pointerEvents="none">
                <View style={[styles.quickIconXl, { backgroundColor: '#e9eefb' }]}><Ionicons name="add" size={moderateScale(20)} color="#001973" /></View>
                <Text numberOfLines={2} style={[styles.quickTextXl, { color: '#ffffff', fontSize: moderateScale(12) }]}>Add services</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickBoxWhite, styles.cardShadow, {
              width: quickHalfWidth,
              padding: 0,
              overflow: 'hidden',
              height: moderateScale(90),
              zIndex: 11,
              elevation: 11
            }]}
            onPress={() => {
              try {
                (navigation as any).navigate('EmployeeDetails');
              } catch (error) {
                console.error('Navigation error:', error);
              }
            }}
            activeOpacity={0.85}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <LinearGradient
              colors={sectorGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={{
                width: '100%',
                height: '100%',
                borderRadius: moderateScale(12),
                padding: moderateScale(9),
                alignItems: 'center',
                justifyContent: 'center'
              }}
              pointerEvents="none"
            >
              <View style={styles.quickBoxCol} pointerEvents="none">
                <View style={[styles.quickIconXl, { backgroundColor: '#e9eefb' }]}><Ionicons name="people-outline" size={moderateScale(20)} color="#001973" /></View>
                <Text numberOfLines={2} style={[styles.quickTextXl, { color: '#ffffff', fontSize: moderateScale(12) }]}>Employee Details</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Recent Requests section - moved here from Active Jobs */}
        <Text style={[styles.sectionHeader, { color: colors.text, marginTop: moderateScale(20) }]}>Recent Requests</Text>
        {(() => {
          // Only show new/pending bookings in Recent Requests
          const normalizeStatus = (status: string) => (status || '').toLowerCase();
          const recentBookings = bookings.filter(b => {
            const status = normalizeStatus(b.status);
            return status === 'new' || status === 'pending' || status === 'requested';
          }).slice(0, 5); // Show only 5 most recent new bookings

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

          return recentBookings.map(b => (
            <TouchableOpacity
              key={b.id}
              style={[styles.jobCardWhite, styles.cardShadow, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
              activeOpacity={0.7}
              onPress={() => {
                try {
                  (navigation as any).navigate('ActiveJobDetails', { bookingId: b.id });
                } catch (error) {
                  console.error('Navigation error:', error);
                }
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.jobTitleDark, { color: colors.text }]}>{b.customerName}</Text>
                <Text style={[styles.linkBlue, { marginTop: moderateScale(6) }]}>{b.serviceName}</Text>
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
                const normalizeStatus = (status: string) => (status || '').toLowerCase();
                const status = normalizeStatus(b.status);

                if (status === 'assigned' || status === 'inprogress' || status === 'in_progress') {
                  return (
                    <View style={[styles.assignedBtn, { paddingHorizontal: moderateScale(12) }]}>
                      <Text style={styles.assignedBtnText}>Assigned</Text>
                    </View>
                  );
                } else {
                  return (
                    <Ionicons name="chevron-forward" size={moderateScale(24)} color={colors.textSecondary} />
                  );
                }
              })()}
            </TouchableOpacity>
          ));
        })()}

        <Text style={[styles.sectionHeader, { color: colors.text }]}>Performance Insights</Text>
        <View style={[styles.insightsRow, { columnGap: gap }]}>
          <TouchableOpacity
            style={[styles.tile, styles.cardShadow, { width: singleTileWidth, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('ProviderWeeklyPerformance' as never)}
          >
            <Ionicons name="pulse-outline" size={moderateScale(22)} color="#3B5BFD" />
            <Text style={[styles.tileValue, { color: colors.text }]}>
              {weeklyAmount == null ? '...' : `₹${weeklyAmount}`}
            </Text>
            <Text style={[styles.tileLabel, { color: colors.textSecondary }]}>Weekly</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tile, styles.cardShadow, { width: singleTileWidth, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]} activeOpacity={0.85}>
            <Ionicons name="checkmark-done-outline" size={moderateScale(22)} color="#3B5BFD" />
            <Text style={[styles.tileValue, { color: colors.text }]}>
              {acceptancePct}%
            </Text>
            <Text style={[styles.tileLabel, { color: colors.textSecondary }]}>Acceptance</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tile, styles.cardShadow, { width: singleTileWidth, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('ProviderReviews' as never)}
          >
            <Ionicons name="star" size={moderateScale(22)} color="#F5B700" />
            <Text style={[styles.tileValue, { color: colors.text }]}>{avgRating == null ? '...' : `${avgRating}/5`}</Text>
            <Text style={[styles.tileLabel, { color: colors.textSecondary }]}>Rating</Text>
            <Text style={[styles.tileSub, { color: colors.textSecondary }]}>{reviewCount} reviews</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.earningsCardWhite, styles.cardShadow, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitleDark, { color: colors.text }]}>Today's Earnings</Text>
            <Text style={[styles.cardAmountBlue, { color: '#0b1960' }]}>₹{todayEarnings}</Text>
            <Text style={[styles.cardMetaDark, { color: colors.textSecondary }]}>{todayCompletedCount} Jobs Completed</Text>
          </View>
          <LinearGradient colors={sectorGradient} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={[styles.walletCircle, { alignItems: 'center', justifyContent: 'center' }]}>
            <TouchableOpacity onPress={() => navigation.navigate('Earnings')} activeOpacity={0.85}>
              <Ionicons name="wallet-outline" size={moderateScale(22)} color="#ffffff" />
            </TouchableOpacity>
          </LinearGradient>
          <TouchableOpacity onPress={() => navigation.navigate('Earnings')} style={styles.viewDetailsInside}><Text style={[styles.viewDetailsDark, { color: '#0b1960' }]}>View details  →</Text></TouchableOpacity>
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionHeader, { color: colors.text }]}>Active jobs</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('Bookings', { tab: 'Active' })}
            activeOpacity={0.7}
            style={styles.viewAllButton}
          >
            <Text style={[styles.viewAllText, { color: sectorPrimary }]}>View all</Text>
            <Ionicons name="chevron-forward" size={moderateScale(16)} color={sectorPrimary} />
          </TouchableOpacity>
        </View>

        {(() => {
          // Helper function to normalize status for comparison
          const normalizeStatus = (status: string) => (status || '').toLowerCase();

          const activeBookings = bookings.filter(b => {
            const status = normalizeStatus(b.status);
            return status === 'confirmed' ||
              status === 'assigned' ||
              status === 'inprogress' ||
              status === 'in_progress';
            // Explicitly exclude completed and cancelled
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
                    <LinearGradient colors={sectorGradient} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={[styles.primaryBtnFill]}>
                      <TouchableOpacity activeOpacity={0.85} onPress={async () => { await saveOnlineStatus(true); }}>
                        <Text style={styles.primaryBtnFillText}>Go Online</Text>
                      </TouchableOpacity>
                    </LinearGradient>
                  </View>
                ) : null}
              </View>
            );
          }

          return activeBookings.map(b => (
            <TouchableOpacity
              key={b.id}
              style={[styles.jobCardWhite, styles.cardShadow, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
              activeOpacity={0.7}
              onPress={() => {
                try {
                  (navigation as any).navigate('ActiveJobDetails', { bookingId: b.id });
                } catch (error) {
                  console.error('Navigation error:', error);
                }
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.jobTitleDark, { color: colors.text }]}>{b.customerName}</Text>
                <Text style={[styles.linkBlue, { marginTop: moderateScale(6) }]}>{b.serviceName}</Text>
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
                const normalizeStatus = (status: string) => (status || '').toLowerCase();
                const status = normalizeStatus(b.status);

                if (status === 'completed') {
                  return (
                    <View style={[styles.greenTag, { paddingHorizontal: moderateScale(12), paddingVertical: moderateScale(8) }]}>
                      <Text style={styles.greenTagText}>Completed</Text>
                    </View>
                  );
                } else if (b.partnerName) {
                  return (
                    <View style={[styles.assignedBtn]}>
                      <Text style={styles.assignedBtnText}>Assigned</Text>
                    </View>
                  );
                } else {
                  return (
                    <TouchableOpacity
                      style={[styles.assignBtnRed]}
                      onPress={() => handleAssignPartner(b)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.assignBtnRedText}>Assign</Text>
                    </TouchableOpacity>
                  );
                }
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
              <TouchableOpacity style={styles.noticeBtnFill} onPress={async () => { await saveOnlineStatus(true); }}>
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

                {/* Service Info */}
                <View style={styles.bookingDetailSection}>
                  <Text style={styles.bookingDetailLabel}>Service</Text>
                  <Text style={styles.bookingDetailValue}>{selectedBooking.serviceName}</Text>
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
                      {selectedBooking.customerAddress.line1}
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
                {selectedBooking.status === 'New' && (
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
                            // removed verbose log
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
                            // removed verbose log
                            // Update booking status to confirmed
                            const success = await CustomerBookingsAPI.updateStatus(selectedBooking.id, 'confirmed');
                            // removed verbose log
                            if (success) {
                              // Refresh bookings to show updated status
                              // removed verbose log
                              await fetchProviderBookings();
                              // removed verbose log
                              setShowBookingModal(false);
                              Alert.alert('Success', 'Booking accepted successfully! You can now assign a partner from Active Jobs.');
                            } else {
                              console.error('❌ Failed to update booking status');
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
                {selectedBooking.status !== 'New' && (
                  <View style={styles.statusBadgeContainer}>
                    <View style={[
                      styles.statusBadge,
                      selectedBooking.status === 'Completed' && { backgroundColor: '#D7F5E7' },
                      selectedBooking.status === 'Assigned' && { backgroundColor: '#DBEAFE' },
                      selectedBooking.status === 'InProgress' && { backgroundColor: '#FEF3C7' },
                    ]}>
                      <Text style={[
                        styles.statusBadgeText,
                        selectedBooking.status === 'Completed' && { color: '#118B50' },
                        selectedBooking.status === 'Assigned' && { color: '#1E40AF' },
                        selectedBooking.status === 'InProgress' && { color: '#B45309' },
                      ]}>
                        {selectedBooking.status}
                      </Text>
                    </View>
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

      {/* Fixed bottom navigation */}
      <BottomTab active={'Home'} floating={true} />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  gradientBg: { flex: 1 },
  container: { flex: 1, padding: moderateScale(14) },
  scrollContent: { paddingBottom: moderateScale(120), paddingTop: moderateScale(8), backgroundColor: '#ffffff' },
  fixedHeader: {
    position: 'absolute',
    top: -50,
    left: 0,
    right: 0,
    zIndex: 9999,
    elevation: 9999,
  },
  headerGradient: {
    flex: 1,
    paddingHorizontal: moderateScale(20),
    paddingBottom: moderateScale(6),
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,

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
  // Simplified header styles (kept for backward compatibility)
  simpleHeader: {
    position: 'absolute',
    top: -50,
    left: 0,
    right: 0,
    zIndex: 9999,
    elevation: 9999,
    paddingTop: 0,
    marginBottom: 20,
  },
  simpleHeaderGradient: {
    paddingHorizontal: moderateScale(20),
    paddingTop: moderateScale(12),
    paddingBottom: moderateScale(16),
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    minHeight: moderateScale(90),
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: moderateScale(20),
    marginBottom: moderateScale(10),
  },
  headerLeftSection: {
    flex: 1,
  },
  // Toggle Switch Styles
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
  // Old simple toggle styles (kept for backward compatibility)
  simpleToggle: {
    backgroundColor: '#ff3b30',
    borderRadius: moderateScale(16),
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(8),
    minWidth: moderateScale(80),
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    marginTop: moderateScale(-5),
    marginBottom: moderateScale(10),
  },
  simpleToggleText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: moderateScale(12),

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
  // Quick action buttons styles
  quickActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 0,
    paddingVertical: moderateScale(10),
    marginTop: moderateScale(6),
  },
  quickActionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: moderateScale(60),
    minHeight: moderateScale(60),
    paddingVertical: moderateScale(8),
  },
  quickActionIcon: {
    width: moderateScale(40),
    height: moderateScale(40),
    borderRadius: moderateScale(12),
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: moderateScale(6),
  },
  quickActionText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: moderateScale(9),
    textAlign: 'center',
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
  onlineToggleText: { color: '#ffffff', fontSize: moderateScale(12), fontWeight: '700', alignSelf: 'center' },
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
  earningsCardWhite: { backgroundColor: '#ffffff', borderRadius: moderateScale(14), padding: moderateScale(14), flexDirection: 'row', alignItems: 'center', marginBottom: moderateScale(12) },
  cardTitleDark: { color: '#111827', fontWeight: '600' },
  cardAmountBlue: { color: '#3B5BFD', fontSize: moderateScale(28), fontWeight: '800', marginTop: moderateScale(8) },
  cardMetaDark: { color: '#374151', marginTop: moderateScale(6) },
  walletCircle: { width: moderateScale(44), height: moderateScale(44), borderRadius: moderateScale(22), backgroundColor: '#3B5BFD', alignItems: 'center', justifyContent: 'center' },
  viewDetailsInside: { position: 'absolute', right: moderateScale(16), bottom: moderateScale(12) },
  viewDetailsDark: { color: '#3B5BFD', fontWeight: '700' },
  sectionHeader: { color: '#ffffff', fontWeight: '700', marginTop: moderateScale(6), marginBottom: moderateScale(12), fontSize: moderateScale(17) },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: moderateScale(12),
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(4),
  },
  viewAllText: {
    fontSize: moderateScale(14),
    fontWeight: '700',
  },
  acceptedPill: { color: '#26e07f', fontWeight: '800' },
  devRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: moderateScale(8) },
  devBtn: { borderWidth: 1, borderColor: '#3B5BFD', paddingVertical: moderateScale(6), paddingHorizontal: moderateScale(10), borderRadius: moderateScale(10), backgroundColor: '#0b1f66' },
  devBtnText: { color: '#baccff', fontWeight: '700', fontSize: moderateScale(12) },
  insightsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: moderateScale(14) },
  tile: { backgroundColor: '#ffffff', borderRadius: moderateScale(14), padding: moderateScale(12), width: '31%', alignItems: 'flex-start' },
  tileValue: { color: '#111827', fontWeight: '700', marginTop: moderateScale(12) },
  tileLabel: { color: '#6B7280', marginTop: moderateScale(8) },
  tileSub: { color: '#9CA3AF', marginTop: moderateScale(4), fontSize: moderateScale(12) },
  quickRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: moderateScale(12) },
  quickBoxWhite: { backgroundColor: '#ffffff', borderRadius: moderateScale(12), padding: moderateScale(10) },
  quickBoxRow: { flexDirection: 'row', alignItems: 'center' },
  quickBoxCol: { alignItems: 'center' },
  quickIcon: { width: moderateScale(36), height: moderateScale(36), borderRadius: moderateScale(18), backgroundColor: '#3B5BFD', alignItems: 'center', justifyContent: 'center', marginBottom: moderateScale(6) },
  quickIconSmall: { width: moderateScale(28), height: moderateScale(28), borderRadius: moderateScale(14), backgroundColor: '#3B5BFD', alignItems: 'center', justifyContent: 'center', marginBottom: moderateScale(4) },
  quickIconLarge: { width: moderateScale(36), height: moderateScale(36), borderRadius: moderateScale(18), backgroundColor: '#3B5BFD', alignItems: 'center', justifyContent: 'center', marginBottom: moderateScale(6) },
  quickIconXl: { width: moderateScale(44), height: moderateScale(44), borderRadius: moderateScale(22), backgroundColor: '#3B5BFD', alignItems: 'center', justifyContent: 'center', marginBottom: moderateScale(8) },
  quickTextDark: { color: '#111827', fontWeight: '600', marginLeft: moderateScale(6), maxWidth: moderateScale(90), fontSize: moderateScale(12) },
  quickTextLarge: { color: '#111827', fontWeight: '700', marginLeft: moderateScale(8), maxWidth: moderateScale(110), fontSize: moderateScale(13) },
  quickTextXl: { color: '#111827', fontWeight: '800', textAlign: 'center', maxWidth: moderateScale(120), fontSize: moderateScale(13) },
  jobCardWhite: { backgroundColor: '#ffffff', borderRadius: moderateScale(16), padding: moderateScale(16), marginTop: moderateScale(8), flexDirection: 'row', alignItems: 'center' },
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
  emptyCard: { backgroundColor: '#ffffff', borderRadius: moderateScale(16), padding: moderateScale(16), alignItems: 'flex-start', marginTop: moderateScale(6) },
  emptyIconWrap: { width: moderateScale(36), height: moderateScale(36), borderRadius: moderateScale(18), backgroundColor: 'rgba(59,91,253,0.12)', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontWeight: '800', marginTop: moderateScale(10), fontSize: moderateScale(15) },
  emptySub: { marginTop: moderateScale(6) },

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
    backgroundColor: '#F3F4F6',
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
