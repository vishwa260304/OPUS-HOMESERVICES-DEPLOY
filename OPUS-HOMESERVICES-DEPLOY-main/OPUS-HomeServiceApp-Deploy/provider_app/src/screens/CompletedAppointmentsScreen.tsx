import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { moderateScale } from '../utils/responsive';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { DoctorAppointmentsService } from '../services/doctorAppointmentsService';

type AppointmentItem = {
  id: string;
  consultation_type?: string | null;
  patient_name?: string | null;
  appointment_date?: string | null;
  appointment_time?: string | null;
  created_at?: string | null;
  status?: string | null;
  amount?: number | null;
  total?: number | null;
};

const sectorGradient: [string, string] = ['#004c8f', '#0c1a5d'];
const sectorPrimary = '#3B5BFD';

const CompletedAppointmentsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'No date';
    const d = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const isToday = d.toDateString() === today.toDateString();
    const isTomorrow = d.toDateString() === tomorrow.toDateString();
    
    if (isToday) {
      return 'Today';
    } else if (isTomorrow) {
      return 'Tomorrow';
    } else {
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  };

  const formatTime = (dateString?: string | null) => {
    if (!dateString) return '';
    const d = new Date(dateString);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const formatDateTime = (item: AppointmentItem) => {
    const appointmentDate = item.appointment_date || item.created_at;
    const appointmentTime = item.appointment_time || (appointmentDate ? formatTime(appointmentDate) : '');
    
    if (appointmentTime) {
      return `${formatDate(appointmentDate)} • ${appointmentTime}`;
    }
    return formatDate(appointmentDate);
  };

  const loadData = async () => {
    try {
      if (!user) {
        setAppointments([]);
        return;
      }

      setLoading(true);

      // Fetch doctor appointments from bookings table (same approach as BookingsScreen)
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          id,
          user_id,
          items,
          address,
          schedule,
          appointment_date,
          appointment_time,
          status,
          total,
          amount,
          payment_status,
          payment_amount,
          currency,
          provider_id,
          provider_service_id,
          provider_name,
          doctor_user_id,
          patient_name,
          patient_phone,
          patient_email,
          consultation_type,
          symptoms,
          created_at,
          notes
        `)
        .eq('doctor_user_id', user.id)
        .order('created_at', { ascending: false });

      if (bookingsError) {
        console.error('Error fetching doctor appointments:', bookingsError);
        setAppointments([]);
        setLoading(false);
        return;
      }

      const bookings = bookingsData || [];
      
      // Fetch doctor_appointments records to get persisted status
      const appointmentRecords = await DoctorAppointmentsService.getByDoctorId(user.id);
      const statusMap = new Map<string, string>();
      
      appointmentRecords.forEach(record => {
        statusMap.set(record.booking_id, record.status);
      });
      
      // Filter only completed appointments and transform to match format
      const completedAppointments = bookings
        .filter((booking: any) => {
          const persistedStatus = statusMap.get(booking.id);
          const effectiveStatus = persistedStatus || booking.status || 'pending';
          return effectiveStatus.toLowerCase() === 'completed';
        })
        .map((booking: any) => {
          return {
            id: booking.id,
            consultation_type: booking.consultation_type || 'Doctor Consultation',
            patient_name: booking.patient_name || 'Unknown Patient',
            appointment_date: booking.appointment_date || booking.created_at,
            appointment_time: booking.appointment_time || null,
            created_at: booking.created_at,
            status: 'completed',
            amount: booking.amount || booking.total || 0,
            total: booking.total || booking.amount || 0,
          };
        });

      // Sort by appointment_date or created_at (newest first)
      completedAppointments.sort((a, b) => {
        const dateA = a.appointment_date ? new Date(a.appointment_date).getTime() : new Date(a.created_at || 0).getTime();
        const dateB = b.appointment_date ? new Date(b.appointment_date).getTime() : new Date(b.created_at || 0).getTime();
        return dateB - dateA;
      });

      setAppointments(completedAppointments);
    } catch (err) {
      console.error('Exception fetching completed appointments:', err);
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const renderItem = ({ item }: { item: AppointmentItem }) => {
    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        activeOpacity={0.7}
        onPress={() => {
          try {
            (navigation as any).navigate('DoctorAppointmentDetails', { appointmentId: String(item.id) });
          } catch (error) {
            console.error('Navigation error:', error);
          }
        }}
      >
        {/* Patient Name as Title */}
        <Text style={[styles.patientName, { color: colors.text }]} numberOfLines={1}>
          {item.patient_name || 'Unknown Patient'}
        </Text>
        
        {/* Date and Time */}
        <View style={styles.dateTimeRow}>
          <Ionicons name="calendar-outline" size={moderateScale(16)} color={colors.textSecondary} />
          <Text style={[styles.dateTimeText, { color: colors.textSecondary }]}>
            {formatDateTime(item)}
          </Text>
        </View>
        
        {/* Consultation Type */}
        <View style={styles.consultationRow}>
          <Ionicons name="medical-outline" size={moderateScale(16)} color={colors.textSecondary} />
          <Text style={[styles.consultationText, { color: colors.textSecondary }]}>
            {item.consultation_type || 'Doctor Consultation'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={sectorGradient[0]} translucent />
      <LinearGradient colors={sectorGradient} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.header}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButtonHeader}>
              <Ionicons name="arrow-back" size={moderateScale(24)} color="#ffffff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Your Appointments</Text>
            <View style={{ width: moderateScale(40) }} />
          </View>
        </SafeAreaView>
      </LinearGradient>

      {loading ? (
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading appointments...</Text>
        </View>
      ) : (
        <FlatList
          data={appointments}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={sectorPrimary} />}
          ListEmptyComponent={
            <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="checkmark-done-circle-outline" size={moderateScale(48)} color={colors.textSecondary} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No completed appointments</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>Completed visits will appear here.</Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
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
    flex: 0.8,
    textAlign: 'left',
  },
  listContent: {
    padding: moderateScale(20),
    paddingBottom: moderateScale(40),
  },
  card: {
    borderRadius: moderateScale(16),
    padding: moderateScale(16),
    marginBottom: moderateScale(12),
    borderWidth: 1,
  },
  patientName: {
    fontSize: moderateScale(18),
    fontWeight: '800',
    marginBottom: moderateScale(12),
  },
  dateTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(8),
    marginBottom: moderateScale(8),
  },
  dateTimeText: {
    fontSize: moderateScale(14),
    fontWeight: '600',
  },
  consultationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(8),
  },
  consultationText: {
    fontSize: moderateScale(14),
    fontWeight: '500',
  },
  emptyState: {
    borderRadius: moderateScale(16),
    padding: moderateScale(40),
    borderWidth: 1,
    alignItems: 'center',
    marginTop: moderateScale(60),
  },
  emptyTitle: {
    marginTop: moderateScale(12),
    fontSize: moderateScale(18),
    fontWeight: '700',
  },
  emptySubtitle: {
    marginTop: moderateScale(6),
    fontSize: moderateScale(14),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: moderateScale(60),
  },
  loadingText: {
    fontSize: moderateScale(14),
    fontWeight: '600',
  },
});

export default CompletedAppointmentsScreen;


