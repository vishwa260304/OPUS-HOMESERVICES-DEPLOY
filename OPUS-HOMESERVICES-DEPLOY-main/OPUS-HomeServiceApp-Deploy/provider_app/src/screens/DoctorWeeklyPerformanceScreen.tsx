import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { moderateScale } from '../utils/responsive';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import LineChart from '../components/LineChart';
import { getBookings } from '../utils/appState';
import { DoctorAppointmentsService } from '../services/doctorAppointmentsService';

interface WeeklyData {
  date: string;
  label: string;
  appointmentsCompleted: number;
  earnings: number;
  appointmentsAccepted: number;
}

const DoctorWeeklyPerformanceScreen: React.FC = () => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([]);
  const [selectedMetric, setSelectedMetric] = useState<'earnings' | 'appointments' | 'accepted'>('earnings');

  const sectorGradient: [string, string] = ['#004c8f', '#0c1a5d'];
  const sectorPrimary = '#3B5BFD';

  const fetchWeeklyData = async (doctorUserId: string) => {
    try {
      setLoading(true);

      // Fetch all bookings for this doctor
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          id,
          status,
          amount,
          total,
          created_at,
          appointment_date
        `)
        .eq('doctor_user_id', doctorUserId)
        .order('created_at', { ascending: false });

      if (bookingsError) {
        console.error('Error fetching bookings:', bookingsError);
        return;
      }

      // Fetch doctor_appointments records to get persisted status
      const appointmentRecords = await DoctorAppointmentsService.getByDoctorId(doctorUserId);
      const statusMap = new Map<string, string>();
      appointmentRecords.forEach(record => {
        statusMap.set(record.booking_id, record.status);
      });

      // Get current date and calculate last 7 days starting from Monday
      const now = new Date();
      const weeklyStats: WeeklyData[] = [];

      // Find the most recent Monday
      const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1; // Days to subtract to get to Monday

      // Start from Monday (6 days ago from today if today is Sunday, otherwise currentDay - 1 days ago)
      for (let i = 0; i < 7; i++) {
        const date = new Date(now);
        date.setDate(now.getDate() - daysFromMonday + i);
        date.setHours(0, 0, 0, 0);

        const nextDay = new Date(date);
        nextDay.setDate(nextDay.getDate() + 1);

        const dayLabel = date.toLocaleDateString('en-US', { weekday: 'short' });

        // Filter bookings for this day
        const dayBookings = (bookingsData || []).filter((booking: any) => {
          // Use appointment_date if available, otherwise use created_at
          const bookingDate = booking.appointment_date
            ? new Date(booking.appointment_date)
            : new Date(booking.created_at);

          bookingDate.setHours(0, 0, 0, 0);

          return bookingDate.getTime() >= date.getTime() && bookingDate.getTime() < nextDay.getTime();
        });

        // Calculate metrics for this day
        let appointmentsCompleted = 0;
        let earnings = 0;
        let appointmentsAccepted = 0;

        dayBookings.forEach((booking: any) => {
          const persistedStatus = statusMap.get(booking.id);
          const effectiveStatus = (persistedStatus || booking.status || '').toLowerCase();

          // Count completed appointments
          if (effectiveStatus === 'completed') {
            appointmentsCompleted++;
            const amount = booking.amount || booking.total || 0;
            earnings += typeof amount === 'number' ? amount : parseFloat(String(amount)) || 0;
          }

          // Count accepted appointments (accepted, assigned, in_progress, completed)
          if (effectiveStatus === 'accepted' ||
            effectiveStatus === 'assigned' ||
            effectiveStatus === 'in_progress' ||
            effectiveStatus === 'completed') {
            appointmentsAccepted++;
          }
        });

        weeklyStats.push({
          date: date.toISOString(),
          label: dayLabel,
          appointmentsCompleted,
          earnings: Math.round(earnings),
          appointmentsAccepted,
        });
      }

      setWeeklyData(weeklyStats);
    } catch (error) {
      console.error('Exception fetching weekly data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchWeeklyData(user.id);
    }
  }, [user?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (user?.id) {
      await fetchWeeklyData(user.id);
    }
    setRefreshing(false);
  };

  // Get chart data based on selected metric
  const chartData = useMemo(() => {
    if (selectedMetric === 'earnings') {
      return weeklyData.map(d => d.earnings);
    } else if (selectedMetric === 'appointments') {
      return weeklyData.map(d => d.appointmentsCompleted);
    } else {
      return weeklyData.map(d => d.appointmentsAccepted);
    }
  }, [weeklyData, selectedMetric]);

  const chartLabels = useMemo(() => {
    return weeklyData.map(d => d.label);
  }, [weeklyData]);

  const maxY = useMemo(() => {
    // Fixed scale: 0-10,000 with 2000 intervals for earnings
    if (selectedMetric === 'earnings') {
      return 10000;
    } else {
      // Fixed scale: 0-25 with 5 intervals for completed and accepted
      return 25;
    }
  }, [chartData, selectedMetric]);

  const totalValue = useMemo(() => {
    return chartData.reduce((sum, val) => sum + val, 0);
  }, [chartData]);

  const averageValue = useMemo(() => {
    return chartData.length > 0 ? Math.round(totalValue / chartData.length) : 0;
  }, [totalValue, chartData.length]);

  const getMetricTitle = () => {
    if (selectedMetric === 'earnings') return 'Weekly Earnings';
    if (selectedMetric === 'appointments') return 'Appointments Completed';
    return 'Appointments Accepted';
  };

  const getMetricValue = (value: number) => {
    if (selectedMetric === 'earnings') {
      return `₹${value}`;
    }
    return `${value}`;
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={sectorPrimary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Loading weekly performance...
            </Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={sectorGradient[0]} translucent />

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
              onPress={() => navigation.goBack()}
              style={styles.backButtonHeader}
            >
              <Ionicons name="arrow-back" size={moderateScale(24)} color="#ffffff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Weekly Performance</Text>
            <View style={{ width: moderateScale(40) }} />
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Metric Selector */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Select Metric</Text>
          <View style={styles.metricSelector}>
            <TouchableOpacity
              style={[
                styles.metricButton,
                selectedMetric === 'earnings' && styles.metricButtonActive,
                { borderColor: colors.border }
              ]}
              onPress={() => setSelectedMetric('earnings')}
              activeOpacity={0.7}
            >
              <Ionicons
                name="cash-outline"
                size={moderateScale(18)}
                color={selectedMetric === 'earnings' ? '#ffffff' : colors.textSecondary}
              />
              <Text
                style={[
                  styles.metricButtonText,
                  { color: selectedMetric === 'earnings' ? '#ffffff' : colors.text }
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit={true}
                minimumFontScale={0.8}
              >
                Earnings
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.metricButton,
                selectedMetric === 'appointments' && styles.metricButtonActive,
                { borderColor: colors.border }
              ]}
              onPress={() => setSelectedMetric('appointments')}
              activeOpacity={0.7}
            >
              <Ionicons
                name="checkmark-done-circle-outline"
                size={moderateScale(18)}
                color={selectedMetric === 'appointments' ? '#ffffff' : colors.textSecondary}
              />
              <Text
                style={[
                  styles.metricButtonText,
                  { color: selectedMetric === 'appointments' ? '#ffffff' : colors.text }
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit={true}
                minimumFontScale={0.8}
              >
                Completed
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.metricButton,
                selectedMetric === 'accepted' && styles.metricButtonActive,
                { borderColor: colors.border }
              ]}
              onPress={() => setSelectedMetric('accepted')}
              activeOpacity={0.7}
            >
              <Ionicons
                name="calendar-outline"
                size={moderateScale(18)}
                color={selectedMetric === 'accepted' ? '#ffffff' : colors.textSecondary}
              />
              <Text
                style={[
                  styles.metricButtonText,
                  { color: selectedMetric === 'accepted' ? '#ffffff' : colors.text }
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit={true}
                minimumFontScale={0.8}
              >
                Accepted
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Total</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>
              {getMetricValue(totalValue)}
            </Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Average</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>
              {getMetricValue(averageValue)}
            </Text>
          </View>
        </View>

        {/* Line Chart */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {getMetricTitle()}
          </Text>

          <View style={[styles.chartContainer, { backgroundColor: '#ffffff' }]}>
            <View style={styles.chartInner}>
              <LineChart
                data={chartData}
                labels={chartLabels}
                height={moderateScale(240)}
                maxY={maxY}
                strokeGradientFrom="#004c8f"
                strokeGradientTo="#3B5BFD"
                dotColor={sectorPrimary}
                gridColor="#E5E7EB"
                areaGradientFrom="rgba(0, 76, 143, 0.15)"
                areaGradientTo="rgba(59, 91, 253, 0.02)"
                valueFormatter={(v) => getMetricValue(v)}
                yTickCount={5}
              />
            </View>
          </View>
        </View>

        {/* Daily Breakdown */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Daily Breakdown</Text>

          {weeklyData.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="bar-chart-outline" size={moderateScale(48)} color={colors.textSecondary} />
              <Text style={[styles.emptyStateText, { color: colors.text }]}>
                No data available
              </Text>
              <Text style={[styles.emptyStateSubtext, { color: colors.textSecondary }]}>
                Weekly performance data will appear here once you have appointments.
              </Text>
            </View>
          ) : (
            weeklyData.map((day, index) => (
              <View
                key={day.date}
                style={[
                  styles.dayRow,
                  { borderColor: colors.border },
                  index < weeklyData.length - 1 && styles.dayRowWithMargin,
                ]}
              >
                <View style={styles.dayRowLeft}>
                  <Text style={[styles.dayLabel, { color: colors.text }]}>{day.label}</Text>
                  <Text style={[styles.dayDate, { color: colors.textSecondary }]}>
                    {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </Text>
                </View>
                <View style={styles.dayRowRight}>
                  {selectedMetric === 'earnings' && (
                    <Text style={[styles.dayValue, { color: colors.text }]}>
                      ₹{day.earnings}
                    </Text>
                  )}
                  {selectedMetric === 'appointments' && (
                    <Text style={[styles.dayValue, { color: colors.text }]}>
                      {day.appointmentsCompleted} completed
                    </Text>
                  )}
                  {selectedMetric === 'accepted' && (
                    <Text style={[styles.dayValue, { color: colors.text }]}>
                      {day.appointmentsAccepted} accepted
                    </Text>
                  )}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
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
    paddingTop: moderateScale(10),
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
  card: {
    borderRadius: moderateScale(16),
    padding: moderateScale(20),
    marginBottom: moderateScale(16),
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: moderateScale(18),
    fontWeight: '800',
    marginBottom: moderateScale(16),
  },
  metricSelector: {
    flexDirection: 'row',
    gap: moderateScale(10),
  },
  metricButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: moderateScale(12),
    paddingHorizontal: moderateScale(8),
    borderRadius: moderateScale(12),
    borderWidth: 1,
    gap: moderateScale(4),
    minHeight: moderateScale(44),
  },
  metricButtonActive: {
    backgroundColor: '#3B5BFD',
    borderColor: '#3B5BFD',
  },
  metricButtonText: {
    fontSize: moderateScale(12),
    fontWeight: '700',
    textAlign: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: moderateScale(12),
    marginBottom: moderateScale(16),
  },
  summaryCard: {
    flex: 1,
    borderRadius: moderateScale(16),
    padding: moderateScale(16),
    borderWidth: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: moderateScale(12),
    fontWeight: '600',
    marginBottom: moderateScale(8),
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontSize: moderateScale(24),
    fontWeight: '900',
  },
  chartContainer: {
    borderRadius: moderateScale(12),
    marginTop: moderateScale(8),
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'visible',
  },
  chartInner: {
    padding: moderateScale(24),
    paddingTop: moderateScale(20),
    paddingBottom: moderateScale(32),
    paddingLeft: moderateScale(32),
    paddingRight: moderateScale(20),
    minHeight: moderateScale(280),
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: moderateScale(40),
  },
  emptyStateText: {
    fontSize: moderateScale(16),
    fontWeight: '600',
    marginTop: moderateScale(12),
  },
  emptyStateSubtext: {
    fontSize: moderateScale(14),
    marginTop: moderateScale(4),
    textAlign: 'center',
  },
  dayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: moderateScale(12),
    borderBottomWidth: 1,
  },
  dayRowWithMargin: {
    marginBottom: moderateScale(4),
  },
  dayRowLeft: {
    flex: 1,
  },
  dayLabel: {
    fontSize: moderateScale(15),
    fontWeight: '700',
    marginBottom: moderateScale(2),
  },
  dayDate: {
    fontSize: moderateScale(12),
  },
  dayRowRight: {
    alignItems: 'flex-end',
  },
  dayValue: {
    fontSize: moderateScale(15),
    fontWeight: '700',
  },
});

export default DoctorWeeklyPerformanceScreen;

