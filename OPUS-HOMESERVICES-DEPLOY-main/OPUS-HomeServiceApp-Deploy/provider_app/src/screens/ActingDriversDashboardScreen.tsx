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
import { useTheme } from '../context/ThemeContext';
import { CustomerBookingsAPI } from '../lib/customerBookings';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useVerification } from '../hooks/useVerification';

const ActingDriversDashboardScreen: React.FC = () => {
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

  // Replaced segmented period control with a persistent search-style bar and filter chips
  const [jobFilter, setJobFilter] = useState<'All' | 'New' | 'Assigned' | 'InProgress' | 'Completed'>('All');

  // Fetch real bookings from customer bookings table
  const fetchProviderBookings = async () => {
    try {
      // Get current user
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;

      const isActingDriver = verification?.selected_sector === 'Acting Drivers';

      let allBookings: any[] = [];

      if (isActingDriver) {
        // Acting drivers: fetch from bookings table where acting_driver_id = user.id
        allBookings = await CustomerBookingsAPI.getByActingDriverId(authUser.id);
      } else {
        // Other providers: fetch by provider services
        const { data: services, error: servicesError } = await supabase
          .from('providers_services')
          .select('id')
          .eq('user_id', authUser.id);

        if (servicesError || !services || services.length === 0) {
          console.log('No services found for provider');
          setBookings([]);
          setBookingsState([]);
          return;
        }

        const providerServiceIds = services.map((s: any) => s.id);
        for (const serviceId of providerServiceIds) {
          const bookings = await CustomerBookingsAPI.getByProviderId(serviceId);
          allBookings.push(...bookings);
        }
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
      // Prefer server-side RPC only when it returns actual reviews (RPC may not include acting_driver_id)
      try {
        const { data: rpcData, error: rpcErr } = await supabase.rpc('get_provider_review_stats', { p_user: user.id });
        if (!rpcErr && rpcData) {
          const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
          const rpcCount = row?.review_count ? Number(row.review_count) : 0;
          if (rpcCount > 0) {
            const rpcAvg = row?.avg_rating ? Number(row.avg_rating) : 0;
            setAvgRating(rpcAvg);
            setReviewCount(rpcCount);
            try { await cacheAvgRating({ avgRating: rpcAvg, reviewCount: rpcCount }); } catch (e) { console.debug('cache avg rating failed', e); }
            return;
          }
          // RPC returned 0 reviews; fall through to acting_driver_id / doctor / provider queries
        }
      } catch (e) {
        console.debug('RPC get_provider_review_stats failed, falling back:', e);
      }

      // 0) Acting driver: always try reviews by acting_driver_id first (so card shows actual avg from reviews table)
      const { data: actingReviews, error: actingErr } = await supabase
        .from('reviews')
        .select('rating')
        .eq('acting_driver_id', user.id);
      if (!actingErr && actingReviews && actingReviews.length > 0) {
        const sum = actingReviews.reduce((acc, r) => acc + (r.rating || 0), 0);
        const avg = Math.round((sum / actingReviews.length) * 10) / 10;
        setAvgRating(avg);
        setReviewCount(actingReviews.length);
        try { await cacheAvgRating({ avgRating: avg, reviewCount: actingReviews.length }); } catch (e) { console.debug('cache avg rating failed', e); }
        return;
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

  // Fetch verification ID and load online status from database (providers_acting_drivers.is_online)
  const fetchVerificationId = async () => {
    if (!user) return;
    try {
      const { data, error } = await api.actingDrivers.getActingDriverDetails(user.id);
      if (data && !error) {
        setVerificationId(data.id);
        // Use Is_online from DB as source of truth (column name is "Is_online"); default true if missing
        const dbOnline = (data as any).Is_online;
        const status = typeof dbOnline === 'boolean' ? dbOnline : (getOnlineStatus() ?? true);
        setIsOnline(status);
        toggleAnim.setValue(status ? 1 : 0);
        await setOnlineStatus(status);
      }
    } catch (error) {
      console.error('Error fetching verification ID:', error);
    }
  };

  // Save online status to database (is_online column) and local storage; session persists until turned on again
  const saveOnlineStatus = async (status: boolean) => {
    if (verificationId) {
      try {
        const { error } = await api.actingDrivers.updateActingDriverDetails(verificationId, {
          is_online: status,
        });
        if (error) {
          console.error('Error saving online status to database:', error);
        }
      } catch (e) {
        console.error('Error updating is_online:', e);
      }
    }
    await setOnlineStatus(status);
    setIsOnline(status);
    toggleAnim.setValue(status ? 1 : 0);
  };

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
      // For acting drivers, get name from acting drivers table
      const loadActingDriverName = async () => {
        if (user?.id) {
          try {
            const { data } = await api.actingDrivers.getActingDriverDetails(user.id);
            if (data?.name) {
              setBrandName(data.name);
            } else {
              setBrandName('Acting Driver');
            }
          } catch (error) {
            setBrandName('Acting Driver');
          }
        }
      };
      loadActingDriverName();
      // Sync online status from DB when we have verificationId, else from local storage
      const syncOnlineFromDb = async () => {
        if (verificationId && user?.id) {
          const { data } = await api.actingDrivers.getActingDriverDetails(user.id);
          if (data) {
            const dbOnline = (data as any).Is_online;
            const status = typeof dbOnline === 'boolean' ? dbOnline : getOnlineStatus();
            setIsOnline(status);
            toggleAnim.setValue(status ? 1 : 0);
            return;
          }
        }
        const status = getOnlineStatus();
        setIsOnline(status);
        toggleAnim.setValue(status ? 1 : 0);
      };
      syncOnlineFromDb();
      if (!verificationId) {
        fetchVerificationId();
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

    const isActingDriver = verification?.selected_sector === 'Acting Drivers';
    let channel: any = null;

    const setupRealtimeSubscription = async () => {
      try {
        if (isActingDriver) {
          // Acting drivers: listen for bookings where acting_driver_id = user.id
          channel = supabase
            .channel('new-bookings-dashboard-acting-driver')
            .on(
              'postgres_changes',
              {
                event: 'INSERT',
                schema: 'public',
                table: 'bookings',
                filter: `acting_driver_id=eq.${user.id}`,
              },
              async (payload: any) => {
                const newBooking = payload.new;
                console.log('📡 New acting driver booking received via realtime:', newBooking.id);
                try {
                  const list = await CustomerBookingsAPI.getByActingDriverId(user.id);
                  const found = list.find((b: any) => b.id === newBooking.id);
                  if (found) {
                    setBookingsState((prev: any[]) => {
                      const exists = prev.some((b: any) => b.id === found.id);
                      if (exists) return prev;
                      const updated = [found, ...prev];
                      updated.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                      return updated;
                    });
                    const status = (found.status || '').toLowerCase();
                    if (['confirmed', 'assigned', 'inprogress', 'in_progress'].includes(status)) {
                      setHasActiveBooking(true);
                    }
                    const currentBookings = getBookings();
                    const updatedBookings = [found, ...currentBookings];
                    updatedBookings.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                    setBookings(updatedBookings);
                  }
                } catch (err) {
                  console.error('Error processing new acting driver booking:', err);
                  fetchProviderBookings();
                }
              }
            )
            .subscribe((status: string) => {
              console.log('📡 Realtime subscription status (acting driver):', status);
            });
        } else {
          // Other providers: listen by provider_service_id
          const { data: services, error: servicesError } = await supabase
            .from('providers_services')
            .select('id')
            .eq('user_id', user.id);

          if (servicesError || !services || services.length === 0) {
            console.log('No services found for provider, skipping realtime subscription');
            return;
          }

          const providerServiceIds = services.map((s: any) => s.id);

          channel = supabase
            .channel('new-bookings-dashboard')
            .on(
              'postgres_changes',
              {
                event: 'INSERT',
                schema: 'public',
                table: 'bookings',
              },
              async (payload: any) => {
                const newBooking = payload.new;
                if (!providerServiceIds.includes(newBooking.provider_service_id)) {
                  return;
                }
                console.log('📡 New booking received via realtime:', newBooking.id);
                try {
                  const transformedBooking = await CustomerBookingsAPI.getByProviderId(newBooking.provider_service_id);
                  const found = transformedBooking.find((b: any) => b.id === newBooking.id);
                  if (found) {
                    setBookingsState((prevBookings: any[]) => {
                      const exists = prevBookings.some((b: any) => b.id === found.id);
                      if (exists) return prevBookings;
                      const updated = [found, ...prevBookings];
                      updated.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                      return updated;
                    });
                    const normalizeStatus = (status: string) => (status || '').toLowerCase();
                    const status = normalizeStatus(found.status);
                    if (status === 'confirmed' || status === 'assigned' || status === 'inprogress' || status === 'in_progress') {
                      setHasActiveBooking(true);
                    }
                    const currentBookings = getBookings();
                    const updatedBookings = [found, ...currentBookings];
                    updatedBookings.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                    setBookings(updatedBookings);
                  }
                } catch (error) {
                  console.error('Error processing new booking:', error);
                  fetchProviderBookings();
                }
              }
            )
            .subscribe((status: string) => {
              console.log('📡 Realtime subscription status for new bookings:', status);
            });
        }
      } catch (error) {
        console.error('Error setting up realtime subscription:', error);
      }
    };

    setupRealtimeSubscription();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [user?.id, verification?.selected_sector]);
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      // For acting drivers, get name from acting drivers table
      if (user?.id) {
        try {
          const { data } = await api.actingDrivers.getActingDriverDetails(user.id);
          if (data?.name) {
            setBrandName(data.name);
          } else {
            setBrandName('Acting Driver');
          }
        } catch (error) {
          setBrandName('Acting Driver');
        }
      }
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

  // Acting drivers use blue gradient (same as default)
  const sectorGradient: [string, string] = ['#004c8f', '#0c1a5d'];
  const sectorPrimary = '#3B5BFD';

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
                // Save to local storage
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
        contentContainerStyle={[styles.scrollContent, { paddingTop: headerHeight - moderateScale(80), paddingHorizontal: moderateScale(16), backgroundColor: colors.background }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Quick action cards removed - no Add Service or Add Employee buttons for acting drivers */}

        {/* Recent Requests section */}
        <Text style={[styles.sectionHeader, { color: colors.text, marginTop: moderateScale(8) }]}>Recent Requests</Text>
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
                  (navigation as any).navigate('ActingDriverBookingDetails', { bookingId: b.id });
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
                  (navigation as any).navigate('ActingDriverBookingDetails', { bookingId: b.id });
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

                if (status === 'completed') {
                  return (
                    <View style={[styles.greenTag, { paddingHorizontal: moderateScale(12), paddingVertical: moderateScale(8) }]}>
                      <Text style={styles.greenTagText}>Completed</Text>
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
  brandName: { color: '#ffffff', fontSize: moderateScale(22), fontWeight: '800' },
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
  insightsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: moderateScale(14) },
  tile: { backgroundColor: '#ffffff', borderRadius: moderateScale(14), padding: moderateScale(12), width: '31%', alignItems: 'flex-start' },
  tileValue: { color: '#111827', fontWeight: '700', marginTop: moderateScale(12) },
  tileLabel: { color: '#6B7280', marginTop: moderateScale(8) },
  tileSub: { color: '#9CA3AF', marginTop: moderateScale(4), fontSize: moderateScale(12) },
  jobCardWhite: { backgroundColor: '#ffffff', borderRadius: moderateScale(16), padding: moderateScale(16), marginTop: moderateScale(8), flexDirection: 'row', alignItems: 'center' },
  jobTitleDark: { color: '#111827', fontWeight: '700', fontSize: moderateScale(16) },
  jobMetaDark: { color: '#374151', fontSize: moderateScale(14) },
  dotSep: { color: '#9CA3AF' },
  linkBlue: { color: '#3B5BFD', fontWeight: '700' },
  greenTag: { backgroundColor: '#D7F5E7', borderRadius: moderateScale(14), paddingHorizontal: moderateScale(10), paddingVertical: moderateScale(4) },
  greenTagText: { color: '#118B50', fontWeight: '700', fontSize: moderateScale(12) },
  primaryBtnFill: { backgroundColor: '#3b5bfd', paddingVertical: moderateScale(12), paddingHorizontal: moderateScale(16), borderRadius: moderateScale(12) },
  primaryBtnFillText: { color: '#ffffff', fontWeight: '700' },
  assignedBtn: { backgroundColor: '#26e07f', paddingVertical: moderateScale(12), paddingHorizontal: moderateScale(16), borderRadius: moderateScale(12) },
  assignedBtnText: { color: '#0b1960', fontWeight: '900' },
  cardShadow: { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  noticeBanner: { position: 'absolute', left: 16, right: 16, top: '35%', backgroundColor: '#0b1f66', borderColor: '#2a3e85', borderWidth: 1.4, borderRadius: 22, paddingVertical: 24, paddingHorizontal: 20 },
  noticeHeaderRow: { flexDirection: 'row', alignItems: 'center' },
  noticeTitle: { color: '#ffffff', fontWeight: '900', marginLeft: 12, fontSize: moderateScale(20) },
  noticeSub: { color: '#cfe0ff', marginTop: 12, fontSize: moderateScale(14) },
  noticeActionsRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 },
  noticeBtnOutline: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1, borderColor: '#3b5bfd', marginRight: 12 },
  noticeBtnOutlineText: { color: '#cfe0ff', fontWeight: '800' },
  noticeBtnFill: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 14, backgroundColor: '#3b5bfd' },
  noticeBtnFillText: { color: '#ffffff', fontWeight: '800' },
  emptyCard: { backgroundColor: '#ffffff', borderRadius: moderateScale(16), padding: moderateScale(16), alignItems: 'flex-start', marginTop: moderateScale(6) },
  emptyIconWrap: { width: moderateScale(36), height: moderateScale(36), borderRadius: moderateScale(18), backgroundColor: 'rgba(59,91,253,0.12)', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontWeight: '800', marginTop: moderateScale(10), fontSize: moderateScale(15) },
  emptySub: { marginTop: moderateScale(6) },
});

export default ActingDriversDashboardScreen;
