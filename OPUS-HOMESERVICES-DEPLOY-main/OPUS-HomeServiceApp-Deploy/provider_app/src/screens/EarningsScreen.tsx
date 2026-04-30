import React, { useEffect, useRef, useState } from 'react';
import { useNavigation, useIsFocused, useRoute } from '@react-navigation/native';
import { getCompanyInfo, getEarningsSummary, getBookings, getNotifications, loadCachedEarningsSummary, cacheEarningsSummary } from '../utils/appState';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, Platform, StatusBar, RefreshControl, Alert, BackHandler } from 'react-native';
import { BlurView } from 'expo-blur';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import BottomTab from '../components/BottomTab';
import { moderateScale } from '../utils/responsive';
import LineChart from '../components/LineChart';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVerification } from '../hooks/useVerification';

const EarningsScreen = () => {
  const navigation = useNavigation();
  const [viewType, setViewType] = useState<'Day' | 'Week'>('Day');
  const isFocused = useIsFocused();
  const route = useRoute();
  const { verification } = useVerification();
  const [brandName, setBrandName] = useState('Fixit Partner');
  const [notificationCount, setNotificationCount] = useState<number>(0);
  const [todayAmount, setTodayAmount] = useState<number>(0);
  const [todayJobs, setTodayJobs] = useState<number>(0);
  const [weeklyAmount, setWeeklyAmount] = useState<number>(0);
  const [currentWeekRange, setCurrentWeekRange] = useState<string>('13 Oct-19 Oct');
  const [weeklyJobsCount, setWeeklyJobsCount] = useState<number>(0);
  const [todayCompletedList, setTodayCompletedList] = useState<any[]>([]);
  const [weeklyChartData, setWeeklyChartData] = useState<number[]>([]);
  const [weeklyChartLabels, setWeeklyChartLabels] = useState<string[]>([]);
  const [monthWeeks, setMonthWeeks] = useState<{ title: string; jobs: string; amount: string }[]>([]);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    const weekStart = new Date(today);
    weekStart.setDate(diff);
    weekStart.setHours(0, 0, 0, 0);
    return weekStart;
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [userName, setUserName] = useState<string>('HARIGOWTHAM');
  const [walletBalance, setWalletBalance] = useState<number>(0);
  
  // Check if user is doctor consultation or acting driver
  const { getSelectedSector } = require('../utils/appState');
  const selectedSector = (getSelectedSector?.() as 'home' | 'healthcare' | 'appliance' | 'automobile') || 'home';
  const isDoctorConsultation = verification?.selected_sector === 'Doctor Consultation' || 
                               selectedSector === 'healthcare' ||
                               route.name === 'DoctorDashboard' ||
                               route.name === 'Appointments' ||
                               route.name === 'MyPatients';
  const isActingDriver = verification?.selected_sector === 'Acting Drivers';

  // Acting driver: back (hardware or header) goes to ActingDriversDashboard
  useEffect(() => {
    if (!isActingDriver) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      (navigation as any).navigate('ActingDriversDashboard');
      return true;
    });
    return () => sub.remove();
  }, [isActingDriver, navigation]);

  

  // Helper function to format date range
  const formatDateRange = (startDate: Date) => {
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    
    const formatDate = (date: Date) => {
      return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    };
    
    return `${formatDate(startDate)}-${formatDate(endDate)}`;
  };

  // Helper function to get week start (Monday)
  const getWeekStart = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  // Load earnings data
  const loadEarningsData = async () => {
    try {
      setLoading(true);
      
      // Get company info for user name
      const companyInfo = getCompanyInfo();
      if (companyInfo?.companyName) {
        setUserName(companyInfo.companyName.toUpperCase());
      }
      
      setNotificationCount(getNotifications().length);
      
      // Load earnings summary
      const es = getEarningsSummary();
      setTodayAmount(es.todayAmount || 0);
      setTodayJobs(es.todayCompletedCount || 0);
      
      // Wallet balance equals sum of all completed booking amounts
      const wallet = getBookings()
        .filter(b => b.status === 'Completed')
        .reduce((sum, b) => sum + (Number(String(b.amount).replace(/[^0-9.]/g, '')) || 0), 0);
      setWalletBalance(wallet);
      
      // Set current week range
      const weekStart = getWeekStart(currentWeekStart);
      setCurrentWeekRange(formatDateRange(weekStart));
      
      // Get bookings data
      const list = getBookings();
      const now = new Date();

      // Compute weekly total and jobs for the selected week (count only Completed)
      try {
        const weekStartForCalc = getWeekStart(currentWeekStart);
        const weekEndForCalc = new Date(weekStartForCalc);
        weekEndForCalc.setDate(weekEndForCalc.getDate() + 6);
        const bookingsInWeek = list.filter(
          b => b.createdAt && new Date(b.createdAt) >= weekStartForCalc && new Date(b.createdAt) <= weekEndForCalc && String((b.status || '')).toLowerCase() === 'completed'
        );
        const computedWeeklyTotal = bookingsInWeek.reduce((sum, b) => sum + (Number(String(b.amount).replace(/[^0-9.]/g, '')) || 0), 0);
        setWeeklyAmount(Math.round(computedWeeklyTotal));
        setWeeklyJobsCount(bookingsInWeek.length);
        try {
          await cacheEarningsSummary(getEarningsSummary());
        } catch (e) {
          console.debug('Error caching earnings from EarningsScreen', e);
        }
      } catch (e) {
        console.error('Error computing weekly total in EarningsScreen', e);
      }
      
      // (time on duty removed)

      // Today's completed bookings
      const isSameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
      const todayList = list.filter(b => b.status === 'Completed' && b.createdAt && isSameDay(new Date(b.createdAt), now));
      setTodayCompletedList(todayList);

      // Weekly chart data (last 7 days)
      const labels: string[] = [];
      const data: number[] = [];
      for (let i = 6; i >= 0; i -= 1) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const dayLabel = d.toLocaleDateString(undefined, { weekday: 'short' });
        labels.push(dayLabel);
        const dayTotal = list
          .filter(b => (b.status === 'Completed' || b.status === 'InProgress') && b.createdAt && isSameDay(new Date(b.createdAt), d))
          .reduce((sum, b) => sum + Number(String(b.amount).replace(/[^0-9.]/g, '')) || 0, 0);
        data.push(dayTotal);
      }
      setWeeklyChartLabels(labels);
      setWeeklyChartData(data);

      // Month weekly breakdown
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const weeks: { title: string; jobs: string; amount: string }[] = [];
      let cursor = new Date(startOfMonth);
      let weekIndex = 1;
      while (cursor <= endOfMonth) {
        const weekStart = new Date(cursor);
        const weekEnd = new Date(cursor);
        weekEnd.setDate(weekEnd.getDate() + 6);
        if (weekEnd > endOfMonth) weekEnd.setTime(endOfMonth.getTime());

        const inWeek = list.filter(b => {
          const ts = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return ts >= weekStart.getTime() && ts <= weekEnd.getTime();
        });
        const amountNum = inWeek
          .filter(b => b.status === 'Completed' || b.status === 'InProgress')
          .reduce((sum, b) => sum + Number(String(b.amount).replace(/[^0-9.]/g, '')) || 0, 0);
        const jobsCount = inWeek.filter(b => b.status === 'Completed').length;

        const title = `Week ${weekIndex}: ${weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}–${weekEnd.toLocaleDateString(undefined, { day: 'numeric' })}`;
        weeks.push({ title, jobs: `${jobsCount} Jobs`, amount: `₹${amountNum}` });

        cursor.setDate(cursor.getDate() + 7);
        weekIndex += 1;
      }
      setMonthWeeks(weeks);
      
    } catch (error) {
      console.error('Error loading earnings data:', error);
      Alert.alert('Error', 'Failed to load earnings data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle week navigation
  const navigateWeek = (direction: 'prev' | 'next') => {
    const newWeekStart = new Date(currentWeekStart);
    const today = new Date();
    const currentWeekStartDate = getWeekStart(today);
    
    if (direction === 'prev') {
      newWeekStart.setDate(newWeekStart.getDate() - 7);
      // Don't allow going to future weeks
      if (newWeekStart <= currentWeekStartDate) {
        setCurrentWeekStart(newWeekStart);
      }
    } else {
      newWeekStart.setDate(newWeekStart.getDate() + 7);
      // Don't allow going to future weeks
      if (newWeekStart <= currentWeekStartDate) {
        setCurrentWeekStart(newWeekStart);
      }
    }
  };

  // Check if current week is the actual current week
  const isCurrentWeek = () => {
    const today = new Date();
    const currentWeekStartDate = getWeekStart(today);
    const selectedWeekStart = getWeekStart(currentWeekStart);
    return currentWeekStartDate.getTime() === selectedWeekStart.getTime();
  };

  // Check if we can navigate to previous week
  const canNavigatePrev = () => {
    const newWeekStart = new Date(currentWeekStart);
    newWeekStart.setDate(newWeekStart.getDate() - 7);
    const today = new Date();
    const currentWeekStartDate = getWeekStart(today);
    return newWeekStart <= currentWeekStartDate;
  };

  // Check if we can navigate to next week
  const canNavigateNext = () => {
    const newWeekStart = new Date(currentWeekStart);
    newWeekStart.setDate(newWeekStart.getDate() + 7);
    const today = new Date();
    const currentWeekStartDate = getWeekStart(today);
    return newWeekStart <= currentWeekStartDate;
  };

  // Handle refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await loadEarningsData();
    setRefreshing(false);
  };

  // Handle wallet balance tap
  const handleWalletBalance = () => {
    Alert.alert('Wallet Balance', `Your current wallet balance is ₹${walletBalance}`);
  };

  // Handle payout history navigation
  const handlePayoutHistory = () => {
    Alert.alert('Payout History', 'Payout history will be available soon!');
  };

  // Handle withdraw button
  const handleWithdraw = () => {
    if (walletBalance <= 0) {
      Alert.alert('No Balance', 'You have no balance to withdraw.');
      return;
    }
    Alert.alert(
      'Withdraw Funds', 
      `Withdraw ₹${walletBalance} to your bank account?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Withdraw', onPress: () => {
          Alert.alert('Success', 'Withdrawal request submitted successfully!');
        }}
      ]
    );
  };

  useEffect(() => {
    if (isFocused) {
      (async () => {
        try {
          const cached = await loadCachedEarningsSummary();
          if (cached) {
            setTodayAmount(cached.todayAmount || 0);
            setTodayJobs(cached.todayCompletedCount || 0);
            setWeeklyAmount(Math.round(cached.weeklyAmount) || 0);
            setWeeklyJobsCount(cached.todayCompletedCount || 0);
          }
        } catch (e) {
          console.debug('Error loading cached earnings in EarningsScreen', e);
        }
        await loadEarningsData();
      })();
    }
  }, [isFocused, currentWeekStart]);

  const weeklyRef = useRef(null);
  const scrollRef = useRef(null);

  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  
  // Header gradient colors - always blue, even for doctor users
  const sectorGradient: [string, string] = ['#004c8f', '#0c1a5d'];
  const accentColor = '#004c8f'; // Main accent color used throughout the app

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={sectorGradient[0]} translucent />
      
      {/* Custom header without bottom border radius */}
      <LinearGradient
        colors={sectorGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.customHeader}
      >
        <View style={styles.headerTopRow}>
          <View style={[styles.headerLeftContent, { paddingTop: insets.top + 8 }]}>
            <Text style={styles.brandName}>{brandName}</Text>
          </View>
          <View style={[styles.headerRightContent, { paddingTop: insets.top + 8 }]}>
            <View style={{ flexDirection:'row', alignItems:'center' }}>
              <TouchableOpacity style={styles.bellWrap} onPress={() => navigation.navigate('Notifications')} activeOpacity={0.85}>
                <Ionicons name="notifications" size={moderateScale(18)} color="#ffffff" />
                {notificationCount > 0 ? (
                  <View style={styles.badge}><Text style={styles.badgeText}>{notificationCount > 99 ? '99+' : String(notificationCount)}</Text></View>
                ) : null}
              </TouchableOpacity>
              <View style={{ width: moderateScale(10) }} />
              <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
                <Ionicons name="person-circle" size={moderateScale(32)} color="#cfe0ff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </LinearGradient>

      <ScrollView 
        contentContainerStyle={[styles.scrollContent, { paddingBottom: moderateScale(120) + insets.bottom }]} 
        ref={scrollRef}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[accentColor]}
            tintColor={accentColor}
          />
        }
      >
        {/* Page Title */}
        

        {/* Current Week Earnings Card */}
        <View style={[styles.earningsCard, { backgroundColor: colors.card }]}>
          {/* Date Range with Navigation */}
          <View style={styles.dateRangeContainer}>
            <TouchableOpacity 
              style={[
                styles.dateNavButton,
                (loading || !canNavigatePrev()) && styles.dateNavButtonDisabled
              ]}
              onPress={() => navigateWeek('prev')}
              disabled={loading || !canNavigatePrev()}
            >
              <Ionicons 
                name="chevron-back" 
                size={20} 
                color={loading || !canNavigatePrev() ? colors.textSecondary : colors.text} 
              />
              </TouchableOpacity>
            <View style={styles.dateRange}>
              <Text style={[styles.dateRangeText, { color: colors.text }]}>{currentWeekRange}</Text>
              <Text style={[styles.thisWeekText, { color: colors.textSecondary }]}>
                {isCurrentWeek() ? 'This week' : 'Previous week'}
              </Text>
            </View>
            <TouchableOpacity 
              style={[
                styles.dateNavButton,
                (loading || !canNavigateNext()) && styles.dateNavButtonDisabled
              ]}
              onPress={() => navigateWeek('next')}
              disabled={loading || !canNavigateNext()}
            >
              <Ionicons 
                name="chevron-forward" 
                size={20} 
                color={loading || !canNavigateNext() ? colors.textSecondary : colors.text} 
              />
            </TouchableOpacity>
          </View>

          {/* Total Earnings */}
          <View style={styles.totalEarningsContainer}>
            <Text style={[styles.totalEarningsLabel, { color: colors.textSecondary }]}>Total earnings</Text>
            <Text style={[styles.totalEarningsAmount, { color: colors.text }]}>₹{weeklyAmount}</Text>
        </View>

          {/* Time on Duty removed */}


          {/* User Avatar */}
          <View style={styles.avatarContainer}>
          <View style={styles.userAvatar}>
            <Ionicons name="person" size={24} color={accentColor} />
            <View style={styles.avatarBadge}>
              <Ionicons name="flash" size={12} color="#fff" />
            </View>
          </View>
          </View>
        </View>

        {/* Wallet Balance Card */}
        <TouchableOpacity 
          style={[styles.walletBalanceCard, { backgroundColor: colors.card }]}
          onPress={handleWalletBalance}
          disabled={loading}
        >
          <View style={styles.walletBalanceLeft}>
            <View style={styles.walletIconContainer}>
              <Ionicons name="wallet" size={24} color={accentColor} />
            </View>
            <View style={styles.walletBalanceInfo}>
              <Text style={[styles.walletBalanceLabel, { color: colors.textSecondary }]}>Total Wallet Balance</Text>
              <Text style={[styles.walletBalanceAmount, { color: colors.text }]}>
                {loading ? '...' : `₹${walletBalance}`}
              </Text>
            </View>
          </View>
          
          </TouchableOpacity>

        {/* Payout Status Card */}
        <View style={[styles.payoutStatusCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.payoutStatusText, { color: colors.textSecondary }]}>No payout transferred due to no earnings</Text>
          <View style={styles.payoutDivider} />
          <TouchableOpacity 
            style={styles.payoutHistoryButton}
            onPress={handlePayoutHistory}
            disabled={loading}
          >
            <Text style={[styles.payoutHistoryText, { color: accentColor }]}>Payout history →</Text>
          </TouchableOpacity>
        </View>

        {/* View Toggle */}
        <View style={styles.viewToggleContainer}>
          <TouchableOpacity 
            style={[styles.viewToggleButton, viewType === 'Day' && styles.viewToggleButtonActive]}
            onPress={() => setViewType('Day')}
          >
            <Text style={[styles.viewToggleText, viewType === 'Day' && { color: accentColor }]}>Day view</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.viewToggleButton, viewType === 'Week' && styles.viewToggleButtonActive]}
            onPress={() => setViewType('Week')}
          >
            <Text style={[styles.viewToggleText, viewType === 'Week' && { color: accentColor }]}>Week view</Text>
          </TouchableOpacity>
              </View>

        {/* Day/Week View Summary */}
        <View style={[styles.summaryContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Total earnings</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>
              {loading ? '...' : `₹${viewType === 'Day' ? todayAmount : weeklyAmount}`}
            </Text>
          </View>
          {viewType === 'Day' && (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Jobs completed</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>
                {loading ? '...' : `${todayJobs} jobs`}
              </Text>
            </View>
          )}
          {viewType === 'Week' && (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Jobs completed</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>
                {loading ? '...' : `${weeklyJobsCount} jobs`}
              </Text>
            </View>
          )}
        </View>

        {/* Loading Indicator */}
        {loading && (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading earnings data...</Text>
          </View>
        )}

        {/* Withdraw Button (Gradient) */}
        <TouchableOpacity 
          style={styles.withdrawButtonOuter}
          onPress={handleWithdraw}
          disabled={loading}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={sectorGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.withdrawButton}
          >
            <Ionicons 
              name="arrow-up" 
              size={20} 
              color="#ffffff" 
            />
            <Text style={styles.withdrawButtonText}>
              Withdraw to Bank
            </Text>
          </LinearGradient>
            </TouchableOpacity>
      </ScrollView>
      {/* Full-screen overlay: real blur on iOS; themed semi-opaque sheath on Android (expo-blur has weak blur on Android) */}
      {Platform.OS === 'ios' ? (
        <BlurView
          tint={isDark ? 'dark' : 'light'}
          intensity={80}
          style={[StyleSheet.absoluteFillObject, styles.blurOverlay]}
        />
      ) : (
        <View
          style={[
            StyleSheet.absoluteFillObject,
            styles.blurOverlay,
            {
              backgroundColor: isDark
                ? 'rgba(18, 18, 18, 0.97)'
                : 'rgba(255, 255, 255, 0.95)',
            },
          ]}
        />
      )}

      {/* "Coming soon" block — uses same gradient as header */}
      <View style={styles.comingSoonOverlay}>
        <LinearGradient
          colors={sectorGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.comingSoonPill}
        >
          <Text style={styles.comingSoonSubline}>Earnings & payouts in one place</Text>
          <Text style={styles.comingSoonHeadline}>coming soon!</Text>
        </LinearGradient>
      </View>


      
      <BottomTab active={'Earnings'} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#0b1960'
  },
  blurOverlay: {
    zIndex: 1,
  },
  comingSoonOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  comingSoonPill: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: moderateScale(24),
    paddingHorizontal: moderateScale(32),
    borderRadius: moderateScale(20),
    minWidth: moderateScale(260),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  comingSoonSubline: {
    fontSize: moderateScale(15),
    color: 'rgba(255,255,255,0.95)',
    fontWeight: '600',
    marginBottom: moderateScale(4),
    letterSpacing: 0.3,
  },
  comingSoonHeadline: {
    fontSize: moderateScale(26),
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  customHeader: {
    paddingTop: 12,
    paddingHorizontal: 24,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  headerTopRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center' 
  },
  headerLeftContent: { paddingTop: 0 },
  headerRightContent: { alignItems:'flex-end', paddingTop: 0 },
  brandName: { 
    color: '#ffffff', 
    fontSize: moderateScale(24), 
    fontWeight: '800' 
  },
  bellWrap: { 
    width: moderateScale(32), 
    height: moderateScale(32), 
    borderRadius: moderateScale(16), 
    backgroundColor:'#13235d', 
    alignItems:'center', 
    justifyContent:'center', 
    marginRight: moderateScale(12), 
    position:'relative' 
  },
  badge: { 
    position:'absolute', 
    top:-6, 
    right:-6, 
    backgroundColor:'#ff3b30', 
    borderRadius: 8, 
    paddingHorizontal:5, 
    paddingVertical:1 
  },
  badgeText: { 
    color:'#ffffff', 
    fontSize:10, 
    fontWeight:'700' 
  },
  scrollContent: { 
    paddingBottom: moderateScale(120), 
    paddingTop: moderateScale(20),
    paddingHorizontal: 20
  },
  
  // Page Title
  pageTitle: { 
    color:'#ffffff', 
    fontWeight:'800', 
    fontSize: moderateScale(18), 
    marginBottom: moderateScale(12) 
  },

  // Earnings Card
  earningsCard: {
    backgroundColor: '#ffffff',
    borderRadius: moderateScale(16),
    padding: moderateScale(20),
    marginBottom: moderateScale(16),
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    position: 'relative',
  },
  dateRangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: moderateScale(16),
  },
  dateNavButton: {
    padding: moderateScale(8),
    opacity: 1,
  },
  dateNavButtonDisabled: {
    opacity: 0.3,
  },
  dateRange: {
    alignItems: 'center',
  },
  dateRangeText: {
    fontSize: moderateScale(16),
    fontWeight: '600',
    color: '#374151',
  },
  thisWeekText: {
    fontSize: moderateScale(14),
    color: '#6B7280',
    marginTop: moderateScale(4),
  },
  totalEarningsContainer: {
    marginBottom: moderateScale(16),
  },
  totalEarningsLabel: {
    fontSize: moderateScale(16),
    color: '#6B7280',
    marginBottom: moderateScale(8),
  },
  totalEarningsAmount: {
    fontSize: moderateScale(32),
    fontWeight: '700',
    color: '#1F2937',
  },
  
  avatarContainer: {
    position: 'absolute',
    bottom: moderateScale(20),
    right: moderateScale(20),
  },
  userAvatar: {
    width: moderateScale(48),
    height: moderateScale(48),
    borderRadius: moderateScale(24),
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: moderateScale(20),
    height: moderateScale(20),
    borderRadius: moderateScale(10),
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Wallet Balance Card
  walletBalanceCard: {
    backgroundColor: '#ffffff',
    borderRadius: moderateScale(12),
    padding: moderateScale(16),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: moderateScale(16),
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  walletBalanceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  walletIconContainer: {
    width: moderateScale(48),
    height: moderateScale(48),
    borderRadius: moderateScale(24),
    backgroundColor: '#E6F3FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: moderateScale(12),
  },
  walletBalanceInfo: {
    flex: 1,
  },
  walletBalanceLabel: {
    fontSize: moderateScale(14),
    color: '#6B7280',
    marginBottom: moderateScale(4),
  },
  walletBalanceAmount: {
    fontSize: moderateScale(20),
    fontWeight: '700',
    color: '#1F2937',
  },

  // Payout Status Card
  payoutStatusCard: {
    backgroundColor: '#ffffff',
    borderRadius: moderateScale(12),
    padding: moderateScale(16),
    marginBottom: moderateScale(20),
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  payoutStatusText: {
    fontSize: moderateScale(14),
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: moderateScale(12),
  },
  payoutDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginBottom: moderateScale(12),
  },
  payoutHistoryButton: {
    alignItems: 'center',
  },
  payoutHistoryText: {
    fontSize: moderateScale(14),
    color: '#004c8f',
    fontWeight: '500',
  },

  // View Toggle
  viewToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: moderateScale(8),
    padding: moderateScale(4),
    marginBottom: moderateScale(20),
  },
  viewToggleButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: moderateScale(8),
    borderRadius: moderateScale(6),
  },
  viewToggleButtonActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  viewToggleText: {
    fontSize: moderateScale(14),
    color: '#6B7280',
    fontWeight: '500',
  },
  viewToggleTextActive: {
    color: '#004c8f',
    fontWeight: '600',
  },

  // Summary Container
  summaryContainer: {
    backgroundColor: '#ffffff',
    borderRadius: moderateScale(12),
    padding: moderateScale(16),
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  summaryRow: {
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    marginBottom: moderateScale(12),
  },
  summaryLabel: {
    fontSize: moderateScale(14),
    color: '#6B7280',
  },
  summaryValue: {
    fontSize: moderateScale(14),
    color: '#1F2937',
    fontWeight: '600',
  },

  // Loading styles
  loadingContainer: {
    alignItems: 'center',
    padding: moderateScale(20),
    marginTop: moderateScale(20),
  },
  loadingText: {
    fontSize: moderateScale(14),
    color: '#6B7280',
    fontStyle: 'italic',
  },

  // Withdraw Button
  withdrawButtonOuter: {
    borderRadius: moderateScale(12),
    overflow: 'hidden',
    marginTop: moderateScale(20),
    marginBottom: moderateScale(20),
  },
  withdrawButton: {
    borderRadius: moderateScale(12),
    padding: moderateScale(16),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: moderateScale(20),
    marginBottom: moderateScale(20),
  },
  withdrawButtonDisabled: {
    backgroundColor: '#E5E7EB',
    shadowOpacity: 0,
    elevation: 0,
  },
  withdrawButtonText: {
    color: '#ffffff', 
    fontSize: moderateScale(16),
    fontWeight: '600',
    marginLeft: moderateScale(8),
  },
  withdrawButtonTextDisabled: {
    color: '#9CA3AF',
  },
});

export default EarningsScreen;
