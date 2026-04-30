import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { moderateScale } from '../utils/responsive';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { PatientsService, Patient } from '../services/patientsService';

const PatientDetailsScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors } = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [patientConsultations, setPatientConsultations] = useState<Patient[]>([]);
  const [patientInfo, setPatientInfo] = useState<{
    name: string;
    phone: string | null;
    email: string | null;
    address: any | null;
  } | null>(null);

  // Get patient identifier from route params
  const params = route.params as any;
  const patientName = params?.patientName as string;
  const patientPhone = params?.patientPhone as string | undefined;

  const sectorGradient: [string, string] = ['#0BB48F', '#0A8F6A'];
  const sectorPrimary = '#0BB48F';

  const loadPatientDetails = async (showLoading: boolean = true) => {
    if (!user?.id || !patientName) {
      setLoading(false);
      return;
    }

    try {
      if (showLoading) {
        setLoading(true);
      }

      // Fetch all consultations for this patient
      const consultations = await PatientsService.getByPatientNameAndPhone(
        user.id,
        patientName,
        patientPhone || null
      );

      if (consultations && consultations.length > 0) {
        // Sort by consultation_date (most recent first)
        consultations.sort((a, b) => {
          const dateA = new Date(a.consultation_date).getTime();
          const dateB = new Date(b.consultation_date).getTime();
          return dateB - dateA;
        });

        setPatientConsultations(consultations);

        // Extract patient info from the most recent consultation
        const latest = consultations[0];
        setPatientInfo({
          name: latest.patient_name,
          phone: latest.patient_phone,
          email: latest.patient_email,
          address: latest.patient_address,
        });
      } else {
        setPatientConsultations([]);
        setPatientInfo({
          name: patientName,
          phone: patientPhone || null,
          email: null,
          address: null,
        });
      }
    } catch (error) {
      console.error('Error loading patient details:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPatientDetails();
  }, [user?.id, patientName, patientPhone]);

  // Refresh patient details when screen comes into focus (without showing loading indicator)
  useFocusEffect(
    React.useCallback(() => {
      loadPatientDetails(false);
    }, [user?.id, patientName, patientPhone])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPatientDetails();
    setRefreshing(false);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    }
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const formatDateTime = (consultation: Patient) => {
    const dateStr = formatDate(consultation.consultation_date);
    const timeStr = consultation.consultation_time || 'N/A';
    return `${dateStr} at ${timeStr}`;
  };

  const getStatusColor = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower === 'completed') return '#26e07f';
    if (statusLower === 'in_progress' || statusLower === 'inprogress') return '#F2940A';
    if (statusLower === 'accepted' || statusLower === 'assigned') return '#0BB48F';
    if (statusLower === 'cancelled' || statusLower === 'rejected') return '#FF3B30';
    return '#6B7280';
  };

  const getStatusLabel = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower === 'completed') return 'Completed';
    if (statusLower === 'in_progress' || statusLower === 'inprogress') return 'In Progress';
    if (statusLower === 'accepted' || statusLower === 'assigned') return 'Accepted';
    if (statusLower === 'cancelled') return 'Cancelled';
    if (statusLower === 'rejected') return 'Rejected';
    return 'Pending';
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={sectorPrimary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Loading patient details...
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
            <Text style={styles.headerTitle}>Patient Details</Text>
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
        {/* Patient Information Card */}
        {patientInfo && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.patientHeaderCard}>
              <View style={[styles.avatarLarge, { backgroundColor: '#ecf2ff' }]}>
                <Text style={[styles.avatarTextLarge, { color: sectorPrimary }]}>
                  {patientInfo.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2)}
                </Text>
              </View>
              <View style={styles.patientInfoCard}>
                <Text style={[styles.patientNameLarge, { color: colors.text }]}>
                  {patientInfo.name}
                </Text>
                {patientInfo.phone && (
                  <View style={styles.contactRowCard}>
                    <Ionicons name="call-outline" size={moderateScale(16)} color={colors.textSecondary} />
                    <Text style={[styles.contactTextCard, { color: colors.textSecondary }]}>
                      {patientInfo.phone}
                    </Text>
                  </View>
                )}
                {patientInfo.email && (
                  <View style={styles.contactRowCard}>
                    <Ionicons name="mail-outline" size={moderateScale(16)} color={colors.textSecondary} />
                    <Text style={[styles.contactTextCard, { color: colors.textSecondary }]} numberOfLines={1}>
                      {patientInfo.email}
                    </Text>
                  </View>
                )}
                {patientInfo.address && (
                  <View style={styles.contactRowCard}>
                    <Ionicons name="home-outline" size={moderateScale(16)} color={colors.textSecondary} />
                    <Text style={[styles.contactTextCard, { color: colors.textSecondary }]} numberOfLines={2}>
                      {typeof patientInfo.address === 'string'
                        ? patientInfo.address
                        : patientInfo.address.line1 || patientInfo.address.address || 'N/A'}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Consultations History */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Consultation History ({patientConsultations.length})
          </Text>

          {patientConsultations.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={moderateScale(48)} color={colors.textSecondary} />
              <Text style={[styles.emptyStateText, { color: colors.text }]}>
                No consultations found
              </Text>
              <Text style={[styles.emptyStateSubtext, { color: colors.textSecondary }]}>
                This patient has no consultation history yet.
              </Text>
            </View>
          ) : (
            patientConsultations.map((consultation, index) => (
              <View key={consultation.id || index}>
                <TouchableOpacity
                  style={[
                    styles.consultationCard,
                    { backgroundColor: colors.background, borderColor: colors.border },
                    index < patientConsultations.length - 1 && styles.consultationCardWithMargin,
                  ]}
                  onPress={() => {
                    if (consultation.booking_id) {
                      (navigation as any).navigate('DoctorAppointmentDetails', {
                        appointmentId: consultation.booking_id,
                      });
                    }
                  }}
                  activeOpacity={consultation.booking_id ? 0.7 : 1}
                >
                  <View style={styles.consultationHeader}>
                    <View style={styles.consultationDateContainer}>
                      <Ionicons name="calendar-outline" size={moderateScale(18)} color={sectorPrimary} />
                      <Text style={[styles.consultationDate, { color: colors.text }]}>
                        {formatDateTime(consultation)}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: getStatusColor(consultation.status) + '20' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          { color: getStatusColor(consultation.status) },
                        ]}
                      >
                        {getStatusLabel(consultation.status)}
                      </Text>
                    </View>
                  </View>

                  {consultation.consultation_type && (
                    <View style={styles.consultationDetailRow}>
                      <Ionicons name="location-outline" size={moderateScale(16)} color={colors.textSecondary} />
                      <Text style={[styles.consultationDetailText, { color: colors.textSecondary }]}>
                        {consultation.consultation_type}
                      </Text>
                    </View>
                  )}

                  {consultation.booking_id && (
                    <View style={styles.viewDetailsButton}>
                      <Text style={[styles.viewDetailsText, { color: sectorPrimary }]}>
                        View Full Details →
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
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
  patientHeaderCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarLarge: {
    width: moderateScale(64),
    height: moderateScale(64),
    borderRadius: moderateScale(32),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: moderateScale(16),
  },
  avatarTextLarge: {
    fontWeight: '700',
    fontSize: moderateScale(24),
  },
  patientInfoCard: {
    flex: 1,
  },
  patientNameLarge: {
    fontSize: moderateScale(22),
    fontWeight: '800',
    marginBottom: moderateScale(8),
  },
  contactRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: moderateScale(4),
  },
  contactTextCard: {
    fontSize: moderateScale(14),
    marginLeft: moderateScale(8),
    flex: 1,
  },
  sectionTitle: {
    fontSize: moderateScale(18),
    fontWeight: '800',
    marginBottom: moderateScale(16),
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
  consultationCard: {
    borderRadius: moderateScale(12),
    padding: moderateScale(16),
    borderWidth: 1,
  },
  consultationCardWithMargin: {
    marginBottom: moderateScale(12),
  },
  consultationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: moderateScale(12),
  },
  consultationDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  consultationDate: {
    fontSize: moderateScale(15),
    fontWeight: '700',
    marginLeft: moderateScale(8),
  },
  statusBadge: {
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(6),
    borderRadius: moderateScale(16),
  },
  statusText: {
    fontSize: moderateScale(12),
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  consultationDetailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: moderateScale(8),
  },
  consultationDetailText: {
    fontSize: moderateScale(14),
    marginLeft: moderateScale(8),
    flex: 1,
  },
  viewDetailsButton: {
    marginTop: moderateScale(12),
    paddingTop: moderateScale(12),
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  viewDetailsText: {
    fontSize: moderateScale(14),
    fontWeight: '700',
  },
});

export default PatientDetailsScreen;

