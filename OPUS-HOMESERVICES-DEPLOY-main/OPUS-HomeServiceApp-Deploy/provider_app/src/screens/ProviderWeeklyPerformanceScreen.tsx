import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { moderateScale } from '../utils/responsive';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import LineChart from '../components/LineChart';
import { CustomerBookingsAPI } from '../lib/customerBookings';

interface WeeklyData {
  date: string;
  label: string;
  appointmentsCompleted: number;
  earnings: number;
  appointmentsAccepted: number;
}

const ProviderWeeklyPerformanceScreen: React.FC = () => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([]);
  const [selectedMetric, setSelectedMetric] = useState<'earnings' | 'appointments' | 'accepted'>('earnings');
  const [allBookingsCache, setAllBookingsCache] = useState<any[]>([]);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = day === 0 ? -6 : 1 - day; // days to Monday
    const monday = new Date(today);
    monday.setDate(today.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  });

  const sectorGradient: [string, string] = ['#004c8f', '#0c1a5d'];
  const sectorPrimary = '#3B5BFD';

  const parseAmount = (a: any) => {
    if (typeof a === 'number') return a;
    if (typeof a === 'string') return Number(String(a).replace(/[^0-9.-]+/g, '')) || 0;
    return 0;
  };

  // Fetch bookings once: for service providers by provider_service_id; for acting drivers by acting_driver_id
  const fetchAllBookingsForProvider = async (providerUserId: string) => {
    // 1) Fetch provider services for this user
    const { data: services, error: svcErr } = await supabase
      .from('providers_services')
      .select('id')
      .eq('user_id', providerUserId);

    if (!svcErr && services && services.length > 0) {
      const serviceIds = (services || []).map((s: any) => Number(s.id)).filter((n: number) => Number.isFinite(n));
      let allBookings: any[] = [];
      for (const sid of serviceIds) {
        try {
          const b = await CustomerBookingsAPI.getByProviderId(sid);
          if (b && b.length) allBookings.push(...b);
        } catch (e) {
          console.debug('ProviderWeekly: failed to fetch bookings for service', sid, e);
        }
      }
      const byId = new Map<string, any>();
      for (const b of allBookings) {
        if (!b || !b.id) continue;
        if (!byId.has(b.id)) byId.set(b.id, b);
      }
      return Array.from(byId.values());
    }

    // 2) No provider services: fetch as acting driver (bookings where acting_driver_id = user id)
    try {
      const actingBookings = await CustomerBookingsAPI.getByActingDriverId(providerUserId);
      const byId = new Map<string, any>();
      for (const b of actingBookings || []) {
        if (!b || !b.id) continue;
        if (!byId.has(b.id)) byId.set(b.id, b);
      }
      return Array.from(byId.values());
    } catch (e) {
      console.debug('ProviderWeekly: failed to fetch acting driver bookings', e);
      return [];
    }
  };

  const computeWeeklyStats = (bookingsData: any[], weekStart: Date) => {
    const weeklyStats: WeeklyData[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      date.setHours(0, 0, 0, 0);
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);

      const dayLabel = date.toLocaleDateString('en-US', { weekday: 'short' });

      const dayBookings = bookingsData.filter((booking: any) => {
        // Use schedule[0].date for acting driver bookings; else appointment_date / createdAt
        const scheduleDate = booking.schedule?.[0]?.date;
        const bookingDate = scheduleDate
          ? new Date(scheduleDate)
          : (booking.appointment_date ? new Date(booking.appointment_date) : new Date(booking.createdAt || booking.created_at || booking.appointmentDate || booking.createdAt));
        if (!bookingDate || !bookingDate.getTime || isNaN(bookingDate.getTime())) return false;
        bookingDate.setHours(0, 0, 0, 0);
        return bookingDate.getTime() >= date.getTime() && bookingDate.getTime() < nextDay.getTime();
      });

      let appointmentsCompleted = 0;
      let earnings = 0;
      let appointmentsAccepted = 0;

      const normalizedStatus = (s: string) => String(s || '').toLowerCase();
      for (const booking of dayBookings) {
        const status = normalizedStatus(booking.statusRaw || booking.status || '');
        if (status === 'completed') {
          appointmentsCompleted++;
          const amount = parseAmount(booking.amount || booking.total || booking.breakdown?.total || booking.payment_amount || 0);
          earnings += amount;
        }
        if (['accepted', 'assigned', 'confirmed', 'inprogress', 'in_progress', 'completed'].includes(status)) {
          appointmentsAccepted++;
        }
      }

      weeklyStats.push({
        date: date.toISOString(),
        label: dayLabel,
        appointmentsCompleted,
        earnings: Math.round(earnings),
        appointmentsAccepted,
      });
    }

    return weeklyStats;
  };

  // On mount / user change: fetch bookings once and compute stats for currentWeekStart
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!user?.id) return;
      setLoading(true);
      try {
        const bookings = await fetchAllBookingsForProvider(user.id);
        if (!mounted) return;
        setAllBookingsCache(bookings);
        const stats = computeWeeklyStats(bookings, currentWeekStart);
        setWeeklyData(stats);
      } catch (e) {
        console.error('Error initializing weekly data:', e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, [user?.id]);

  // When user changes selected week, compute from cache if available
  useEffect(() => {
    if (!allBookingsCache || allBookingsCache.length === 0) return;
    const stats = computeWeeklyStats(allBookingsCache, currentWeekStart);
    setWeeklyData(stats);
  }, [currentWeekStart, allBookingsCache]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (user?.id) {
      try {
        setLoading(true);
        const bookings = await fetchAllBookingsForProvider(user.id);
        setAllBookingsCache(bookings);
        const stats = computeWeeklyStats(bookings, currentWeekStart);
        setWeeklyData(stats);
      } catch (e) {
        console.error('Error refreshing weekly data:', e);
      } finally {
        setLoading(false);
      }
    }
    setRefreshing(false);
  };

  const getWeekRangeLabel = (start: Date) => {
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    return `${fmt(start)} - ${fmt(end)}`;
  };

  const canNavigateNext = () => {
    const today = new Date();
    const thisWeekStart = new Date(today);
    const day = today.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    thisWeekStart.setDate(today.getDate() + diff);
    thisWeekStart.setHours(0,0,0,0);
    return currentWeekStart.getTime() < thisWeekStart.getTime();
  };

  const navigateWeek = (dir: 'prev' | 'next') => {
    const next = new Date(currentWeekStart);
    next.setDate(currentWeekStart.getDate() + (dir === 'prev' ? -7 : 7));
    // prevent navigating into future beyond current week
    if (dir === 'next' && !canNavigateNext()) return;
    setCurrentWeekStart(next);
  };

  const chartData = useMemo(() => {
    if (selectedMetric === 'earnings') return weeklyData.map(d => d.earnings);
    if (selectedMetric === 'appointments') return weeklyData.map(d => d.appointmentsCompleted);
    return weeklyData.map(d => d.appointmentsAccepted);
  }, [weeklyData, selectedMetric]);

  const chartLabels = useMemo(() => weeklyData.map(d => d.label), [weeklyData]);

  const totalValue = useMemo(() => chartData.reduce((s, v) => s + v, 0), [chartData]);
  const averageValue = useMemo(() => chartData.length ? Math.round(totalValue / chartData.length) : 0, [totalValue, chartData.length]);

  const getMetricTitle = () => selectedMetric === 'earnings' ? 'Weekly Earnings' : selectedMetric === 'appointments' ? 'Appointments Completed' : 'Appointments Accepted';
  const getMetricValue = (v: number) => selectedMetric === 'earnings' ? `₹${v}` : `${v}`;

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={sectorPrimary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading weekly performance...</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <StatusBar barStyle="light-content" backgroundColor={sectorGradient[0]} translucent />
      <LinearGradient colors={sectorGradient} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.header}>
        <SafeAreaView edges={[ 'top' ]}>
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButtonHeader}><Ionicons name="arrow-back" size={moderateScale(24)} color="#ffffff" /></TouchableOpacity>
            <Text style={styles.headerTitle}>Weekly Performance</Text>
            <View style={{ width: moderateScale(40) }} />
          </View>
        </SafeAreaView>
      </LinearGradient>

        {/* Week selector */}
        <View style={[styles.weekSelector, { paddingHorizontal: moderateScale(16), paddingVertical: moderateScale(10), backgroundColor: colors.background }] }>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <TouchableOpacity onPress={() => navigateWeek('prev')} style={styles.dateNavButton}>
              <Ionicons name="chevron-back" size={20} color={colors.text} />
            </TouchableOpacity>
            <Text style={{ fontWeight: '700', color: colors.text }}>{getWeekRangeLabel(currentWeekStart)}</Text>
            <TouchableOpacity onPress={() => navigateWeek('next')} style={styles.dateNavButton} disabled={!canNavigateNext()}>
              <Ionicons name="chevron-forward" size={20} color={canNavigateNext() ? colors.text : '#ccc'} />
            </TouchableOpacity>
          </View>
        </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Select Metric</Text>
          <View style={styles.metricSelector}>
            <TouchableOpacity style={[styles.metricButton, selectedMetric === 'earnings' && styles.metricButtonActive, { borderColor: colors.border }]} onPress={() => setSelectedMetric('earnings')} activeOpacity={0.7}>
              <Ionicons name="cash-outline" size={moderateScale(18)} color={selectedMetric === 'earnings' ? '#ffffff' : colors.textSecondary} />
              <Text style={[styles.metricButtonText, { color: selectedMetric === 'earnings' ? '#ffffff' : colors.text }]} numberOfLines={1}>Earnings</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.metricButton, selectedMetric === 'appointments' && styles.metricButtonActive, { borderColor: colors.border }]} onPress={() => setSelectedMetric('appointments')} activeOpacity={0.7}>
              <Ionicons name="checkmark-done-circle-outline" size={moderateScale(18)} color={selectedMetric === 'appointments' ? '#ffffff' : colors.textSecondary} />
              <Text style={[styles.metricButtonText, { color: selectedMetric === 'appointments' ? '#ffffff' : colors.text }]} numberOfLines={1}>Completed</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.metricButton, selectedMetric === 'accepted' && styles.metricButtonActive, { borderColor: colors.border }]} onPress={() => setSelectedMetric('accepted')} activeOpacity={0.7}>
              <Ionicons name="calendar-outline" size={moderateScale(18)} color={selectedMetric === 'accepted' ? '#ffffff' : colors.textSecondary} />
              <Text style={[styles.metricButtonText, { color: selectedMetric === 'accepted' ? '#ffffff' : colors.text }]} numberOfLines={1}>Accepted</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Total</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>{getMetricValue(totalValue)}</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Average</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>{getMetricValue(averageValue)}</Text>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{getMetricTitle()}</Text>
          <View style={[styles.chartContainer, { backgroundColor: '#ffffff' }]}>
            <View style={styles.chartInner}>
              <LineChart data={chartData} labels={chartLabels} height={moderateScale(240)} maxY={selectedMetric === 'earnings' ? 10000 : 25} strokeGradientFrom="#004c8f" strokeGradientTo="#3B5BFD" dotColor={sectorPrimary} gridColor="#E5E7EB" areaGradientFrom="rgba(0,76,143,0.15)" areaGradientTo="rgba(59,91,253,0.02)" valueFormatter={(v) => getMetricValue(v)} yTickCount={5} />
            </View>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Daily Breakdown</Text>
          {weeklyData.length === 0 ? (
            <View style={styles.emptyState}><Ionicons name="bar-chart-outline" size={moderateScale(48)} color={colors.textSecondary} /><Text style={[styles.emptyStateText, { color: colors.text }]}>No data available</Text><Text style={[styles.emptyStateSubtext, { color: colors.textSecondary }]}>Weekly performance data will appear here once you have bookings.</Text></View>
          ) : (
            weeklyData.map((day, index) => (
              <View key={day.date} style={[styles.dayRow, { borderColor: colors.border }, index < weeklyData.length - 1 && styles.dayRowWithMargin]}>
                <View style={styles.dayRowLeft}><Text style={[styles.dayLabel, { color: colors.text }]}>{day.label}</Text><Text style={[styles.dayDate, { color: colors.textSecondary }]}>{new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text></View>
                <View style={styles.dayRowRight}>{selectedMetric === 'earnings' && (<Text style={[styles.dayValue, { color: colors.text }]}>₹{day.earnings}</Text>)}{selectedMetric === 'appointments' && (<Text style={[styles.dayValue, { color: colors.text }]}>{day.appointmentsCompleted} completed</Text>)}{selectedMetric === 'accepted' && (<Text style={[styles.dayValue, { color: colors.text }]}>{day.appointmentsAccepted} accepted</Text>)}</View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: moderateScale(40) },
  loadingText: { marginTop: moderateScale(16), fontSize: moderateScale(14), fontWeight: '600' },
  header: { paddingTop: moderateScale(10), paddingBottom: moderateScale(16) },
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: moderateScale(20), paddingTop: moderateScale(10) },
  backButtonHeader: { width: moderateScale(40), height: moderateScale(40), borderRadius: moderateScale(20), backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: moderateScale(20), fontWeight: '800', color: '#ffffff', flex: 1, textAlign: 'center' },
  weekSelector: { borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  dateNavButton: { padding: moderateScale(8) },
  scrollView: { flex: 1 },
  scrollContent: { padding: moderateScale(16), paddingBottom: moderateScale(40) },
  card: { borderRadius: moderateScale(16), padding: moderateScale(20), marginBottom: moderateScale(16), borderWidth: 1 },
  sectionTitle: { fontSize: moderateScale(18), fontWeight: '800', marginBottom: moderateScale(16) },
  metricSelector: { flexDirection: 'row', gap: moderateScale(10) },
  metricButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: moderateScale(12), paddingHorizontal: moderateScale(8), borderRadius: moderateScale(12), borderWidth: 1, gap: moderateScale(4), minHeight: moderateScale(44) },
  metricButtonActive: { backgroundColor: '#3B5BFD', borderColor: '#3B5BFD' },
  metricButtonText: { fontSize: moderateScale(12), fontWeight: '700', textAlign: 'center' },
  summaryRow: { flexDirection: 'row', gap: moderateScale(12), marginBottom: moderateScale(16) },
  summaryCard: { flex: 1, borderRadius: moderateScale(16), padding: moderateScale(16), borderWidth: 1, alignItems: 'center' },
  summaryLabel: { fontSize: moderateScale(12), fontWeight: '600', marginBottom: moderateScale(8), textTransform: 'uppercase' },
  summaryValue: { fontSize: moderateScale(24), fontWeight: '900' },
  chartContainer: { borderRadius: moderateScale(12), marginTop: moderateScale(8), borderWidth: 1, borderColor: '#E5E7EB', overflow: 'visible' },
  chartInner: { padding: moderateScale(24), paddingTop: moderateScale(20), paddingBottom: moderateScale(32), paddingLeft: moderateScale(32), paddingRight: moderateScale(20), minHeight: moderateScale(280) },
  emptyState: { alignItems: 'center', paddingVertical: moderateScale(40) },
  emptyStateText: { fontSize: moderateScale(16), fontWeight: '600', marginTop: moderateScale(12) },
  emptyStateSubtext: { fontSize: moderateScale(14), marginTop: moderateScale(4), textAlign: 'center' },
  dayRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: moderateScale(12), borderBottomWidth: 1 },
  dayRowWithMargin: { marginBottom: moderateScale(4) },
  dayRowLeft: { flex: 1 },
  dayLabel: { fontSize: moderateScale(15), fontWeight: '700', marginBottom: moderateScale(2) },
  dayDate: { fontSize: moderateScale(12) },
  dayRowRight: { alignItems: 'flex-end' },
  dayValue: { fontSize: moderateScale(15), fontWeight: '700' },
});

export default ProviderWeeklyPerformanceScreen;
