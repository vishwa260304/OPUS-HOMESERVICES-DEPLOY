import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, StatusBar, RefreshControl } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { moderateScale } from '../utils/responsive';
import { getBookings, getSelectedSector } from '../utils/appState';
import BottomTab from '../components/BottomTab';

interface Patient {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  lastConsultationDate?: string;
  nextAppointment?: string;
  nextAppointmentDate?: string;
  nextAppointmentTime?: string;
  totalConsultations: number;
  conditions?: string[];
}

const MyPatientsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'upcoming'>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'name' | 'lastConsultation'>('recent');
  const [refreshing, setRefreshing] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [allPatients, setAllPatients] = useState<Patient[]>([]);
  const [activePatients, setActivePatients] = useState<Patient[]>([]);
  const [upcomingPatients, setUpcomingPatients] = useState<Patient[]>([]);

  const selectedSector = (getSelectedSector?.() as 'home' | 'healthcare' | 'appliance' | 'automobile') || 'home';
  const sectorGradient: [string, string] = selectedSector === 'healthcare' ? ['#0BB48F', '#0A8F6A'] : ['#004c8f', '#0c1a5d'];
  const sectorPrimary = selectedSector === 'healthcare' ? '#0AAE8A' : '#004c8f';

  // Extract patients from bookings and watch for real-time changes
  useEffect(() => {
    if (!isFocused) return;

    // Load patients immediately when screen is focused
    loadPatients();

    // Watch for bookings changes in real-time
    // This ensures patients list updates when bookings are added/updated/deleted
    let lastBookingsSignature = '';
    
    const checkBookingsChanges = () => {
      const currentBookings = getBookings();
      // Create a signature based on bookings count, IDs, and statuses
      const currentSignature = `${currentBookings.length}-${currentBookings
        .map(b => `${b.id}-${b.status}-${(b as any).originalStatus || ''}`)
        .join(',')}`;
      
      // If bookings changed, reload patients
      if (currentSignature !== lastBookingsSignature) {
        lastBookingsSignature = currentSignature;
        loadPatients();
      }
    };

    // Check for changes every 1.5 seconds for real-time updates
    const interval = setInterval(checkBookingsChanges, 1500);

    // Initial signature
    const initialBookings = getBookings();
    lastBookingsSignature = `${initialBookings.length}-${initialBookings
      .map(b => `${b.id}-${b.status}-${(b as any).originalStatus || ''}`)
      .join(',')}`;

    return () => {
      clearInterval(interval);
    };
  }, [isFocused]);

  const loadPatients = () => {
    const bookings = getBookings();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Separate maps for all, active, and upcoming patients
    const allPatientMap = new Map<string, Patient>();
    const activePatientMap = new Map<string, Patient>();
    const upcomingPatientMap = new Map<string, Patient>();

    bookings.forEach((booking) => {
      const patientName = booking.customerName;
      
      // Check status first - process accepted/assigned and completed appointments
      const normalizedStatus = (booking.status || '').toString().toLowerCase();
      const originalStatus = ((booking as any).originalStatus || '').toString().toLowerCase();
      
      // Determine if appointment is accepted/assigned/in progress (more comprehensive check)
      const isAccepted = booking.status === 'Assigned' || 
                        booking.status === 'InProgress' || 
                        normalizedStatus === 'confirmed' ||
                        normalizedStatus === 'accepted' ||
                        normalizedStatus === 'assigned' ||
                        normalizedStatus === 'inprogress' ||
                        normalizedStatus === 'in_progress' ||
                        originalStatus === 'accepted' ||
                        originalStatus === 'assigned';
      
      // Determine if appointment is completed
      const isCompleted = booking.status === 'Completed' ||
                          normalizedStatus === 'completed' ||
                          originalStatus === 'completed';
      
      // Process accepted/assigned appointments OR completed appointments (for "All Patients")
      if (!isAccepted && !isCompleted) {
        return; // Skip non-accepted and non-completed appointments
      }
      
      // Get appointment_date and appointment_time from booking (same as AppointmentsScreen)
      const appointmentDate = (booking as any).appointment_date || (booking as any).appointmentDate || null;
      const appointmentTime = (booking as any).appointment_time || (booking as any).appointmentTime || null;
      
      // Parse appointment_date properly (same logic as AppointmentsScreen)
      let bookingDate: Date | null = null;
      let bookingDateOnly: Date | null = null;
      
      if (appointmentDate) {
        // Parse appointment_date (could be ISO string or date string)
        let dateToParse = appointmentDate;
        if (typeof appointmentDate === 'string' && appointmentDate.includes('T')) {
          // ISO format - extract date part only to avoid timezone issues
          dateToParse = appointmentDate.split('T')[0];
        } else if (typeof appointmentDate === 'string' && appointmentDate.includes(' ')) {
          // Format like "2025-12-25 00:00:00+00" - extract date part
          dateToParse = appointmentDate.split(' ')[0];
        }
        
        bookingDate = new Date(dateToParse + 'T00:00:00');
        if (!isNaN(bookingDate.getTime())) {
          bookingDateOnly = new Date(bookingDate.getFullYear(), bookingDate.getMonth(), bookingDate.getDate());
        }
      }
      
      // Fallback to createdAt if no appointment_date
      if (!bookingDate && booking.createdAt) {
        bookingDate = new Date(booking.createdAt);
        bookingDateOnly = new Date(bookingDate.getFullYear(), bookingDate.getMonth(), bookingDate.getDate());
      }

      if (!bookingDate) return; // Skip if no date available
      
      // isCompleted is already declared above
      const isUncompleted = !isCompleted; // Not completed
      
      // Check if booking is today, past, or future
      const isToday = bookingDateOnly && bookingDateOnly.getTime() === today.getTime();
      const isPast = bookingDateOnly && bookingDateOnly.getTime() < today.getTime();
      const isFuture = bookingDateOnly && bookingDateOnly.getTime() > today.getTime();

      // Helper function to create or update patient
      const createOrUpdatePatient = (patientMap: Map<string, Patient>) => {
        // Get phone from booking - check multiple possible field names
        const patientPhone = (booking as any).patient_phone 
          || (booking as any).phone 
          || ((booking.address as any)?.phone) 
          || null;
        
        // Get email from booking
        const patientEmail = (booking as any).patient_email 
          || (booking as any).email 
          || null;
        
        if (!patientMap.has(patientName)) {
          patientMap.set(patientName, {
            id: patientName,
            name: patientName,
            phone: patientPhone,
            email: patientEmail,
            totalConsultations: 0,
            conditions: [],
          });
        }
        const patient = patientMap.get(patientName)!;
        patient.totalConsultations += 1;
        
        // Store appointment_date and appointment_time
        if (appointmentDate) {
          const currentNextDate = patient.nextAppointmentDate ? new Date(patient.nextAppointmentDate) : null;
          if (!currentNextDate || bookingDate < currentNextDate) {
            patient.nextAppointmentDate = appointmentDate;
            patient.nextAppointmentTime = appointmentTime || null;
            patient.nextAppointment = appointmentDate;
          }
        } else {
          if (!patient.nextAppointment || bookingDate < new Date(patient.nextAppointment)) {
            patient.nextAppointment = booking.createdAt;
          }
        }
        
        if (!patient.lastConsultationDate || bookingDate > new Date(patient.lastConsultationDate)) {
          patient.lastConsultationDate = appointmentDate || booking.createdAt;
        }
        
        // Extract symptoms/conditions
        if ((booking as any).symptoms) {
          const symptoms = String((booking as any).symptoms).split(',').map(s => s.trim());
          symptoms.forEach(symptom => {
            if (symptom && !patient.conditions?.includes(symptom)) {
              if (!patient.conditions) patient.conditions = [];
              patient.conditions.push(symptom);
            }
          });
        }
      };

      // ACTIVE: Today's uncompleted accepted patients (not completed, appointment is today)
      const isActive = isToday && isUncompleted && isAccepted;
      
      // UPCOMING: Future upcoming accepted patients (accepted appointments with date > today)
      // IMPORTANT: Exclude today's appointments - only include future dates
      const isUpcoming = isFuture && !isToday && isAccepted;

      // ALL PATIENTS: Include ALL accepted AND completed appointments (any date - today, past, or future)
      // Include both accepted/assigned appointments and completed appointments
      if (isAccepted || isCompleted) {
        createOrUpdatePatient(allPatientMap);
      }

      // ACTIVE: Today's uncompleted accepted patients (only accepted, not completed)
      if (isActive) {
        createOrUpdatePatient(activePatientMap);
      }

      // UPCOMING: Future upcoming accepted patients (only accepted, not completed)
      if (isUpcoming) {
        createOrUpdatePatient(upcomingPatientMap);
      }
    });

    const allList = Array.from(allPatientMap.values());
    const activeList = Array.from(activePatientMap.values());
    const upcomingList = Array.from(upcomingPatientMap.values());
    
    setAllPatients(allList);
    setActivePatients(activeList);
    setUpcomingPatients(upcomingList);
  };

  // Update patients list when filter changes
  useEffect(() => {
    if (filterStatus === 'all') {
      setPatients(allPatients);
    } else if (filterStatus === 'active') {
      setPatients(activePatients);
    } else {
      setPatients(upcomingPatients);
    }
  }, [filterStatus, allPatients, activePatients, upcomingPatients]);

  // Filter and sort patients
  const filteredPatients = useMemo(() => {
    let filtered = patients.filter(patient => {
      const matchesSearch = 
        patient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (patient.phone && patient.phone.includes(searchQuery)) ||
        (patient.email && patient.email.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchesSearch;
    });

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'lastConsultation':
          const dateA = a.lastConsultationDate ? new Date(a.lastConsultationDate).getTime() : 0;
          const dateB = b.lastConsultationDate ? new Date(b.lastConsultationDate).getTime() : 0;
          return dateB - dateA;
        case 'recent':
        default:
          const recentA = a.lastConsultationDate ? new Date(a.lastConsultationDate).getTime() : 0;
          const recentB = b.lastConsultationDate ? new Date(b.lastConsultationDate).getTime() : 0;
          return recentB - recentA;
      }
    });

    return filtered;
  }, [patients, searchQuery, sortBy]);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatDateTime = (patient: Patient) => {
    // Use appointment_date and appointment_time if available (same as AppointmentsScreen)
    const appointmentDate = patient.nextAppointmentDate || patient.nextAppointment || null;
    const appointmentTime = patient.nextAppointmentTime || null;
    
    if (appointmentDate) {
      // Parse appointment_date (could be ISO string or date string)
      let dateToParse = appointmentDate;
      if (typeof appointmentDate === 'string' && appointmentDate.includes('T')) {
        // ISO format - extract date part only to avoid timezone issues
        dateToParse = appointmentDate.split('T')[0];
      } else if (typeof appointmentDate === 'string' && appointmentDate.includes(' ')) {
        // Format like "2025-12-25 00:00:00+00" - extract date part
        dateToParse = appointmentDate.split(' ')[0];
      }
      
      const apptDate = new Date(dateToParse + 'T00:00:00');
      
      // Check if date is valid
      if (!isNaN(apptDate.getTime())) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const isToday = apptDate.toDateString() === today.toDateString();
        const isTomorrow = apptDate.toDateString() === tomorrow.toDateString();
        
        // Format date
        let dateStr: string;
        if (isToday) {
          dateStr = 'Today';
        } else if (isTomorrow) {
          dateStr = 'Tomorrow';
        } else {
          dateStr = apptDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }
        
        // Use appointment_time if available, otherwise format from appointment_date
        let timeStr: string;
        if (appointmentTime && appointmentTime.trim() !== '') {
          timeStr = appointmentTime.trim(); // Use as-is (e.g., "4:00 PM")
        } else {
          timeStr = apptDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        }
        
        return `${dateStr} at ${timeStr}`;
      }
    }
    
    // Fall back to nextAppointment if no appointment_date
    if (patient.nextAppointment) {
      const date = new Date(patient.nextAppointment);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const isToday = date.toDateString() === today.toDateString();
      const isTomorrow = date.toDateString() === tomorrow.toDateString();
      
      const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      
      if (isToday) {
        return `Today at ${timeStr}`;
      } else if (isTomorrow) {
        return `Tomorrow at ${timeStr}`;
      } else {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ` at ${timeStr}`;
      }
    }
    
    return null;
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadPatients();
    setTimeout(() => setRefreshing(false), 500);
  };

  const renderPatientCard = ({ item: patient }: { item: Patient }) => (
    <TouchableOpacity
      style={[styles.patientCard, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
      onPress={() => {
        (navigation as any).navigate('PatientDetails', {
          patientName: patient.name,
          patientPhone: patient.phone,
        });
      }}
      activeOpacity={0.8}
    >
      <View style={styles.patientHeader}>
        <View style={[styles.avatarContainer, { backgroundColor: '#ecf2ff' }]}>
          <Text style={[styles.avatarText, { color: sectorPrimary }]}>{getInitials(patient.name)}</Text>
        </View>
        <View style={styles.patientInfo}>
          <Text style={[styles.patientName, { color: colors.text }]}>{patient.name}</Text>
          {patient.phone && (
            <View style={styles.contactRow}>
              <Ionicons name="call-outline" size={moderateScale(14)} color={colors.textSecondary} />
              <Text style={[styles.contactText, { color: colors.textSecondary }]}>{patient.phone}</Text>
            </View>
          )}
          {patient.email && (
            <View style={styles.contactRow}>
              <Ionicons name="mail-outline" size={moderateScale(14)} color={colors.textSecondary} />
              <Text style={[styles.contactText, { color: colors.textSecondary }]} numberOfLines={1}>{patient.email}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.patientDetails}>
        {(patient.nextAppointment || patient.nextAppointmentDate) && (
          <View style={styles.detailRow}>
            <Ionicons name="calendar" size={moderateScale(16)} color="#0AAE8A" />
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Appointment:</Text>
            <Text style={[styles.detailValue, { color: '#0AAE8A', fontWeight: '700' }]}>
              {formatDateTime(patient) || 'Not scheduled'}
            </Text>
          </View>
        )}

        {patient.conditions && patient.conditions.length > 0 && (
          <View style={styles.conditionsRow}>
            <Ionicons name="medical-outline" size={moderateScale(16)} color={colors.textSecondary} />
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Conditions:</Text>
            <Text style={[styles.conditionsText, { color: colors.text }]} numberOfLines={2}>
              {patient.conditions.slice(0, 3).join(', ')}
              {patient.conditions.length > 3 ? '...' : ''}
            </Text>
          </View>
        )}

        <View style={styles.consultationsBadge}>
          <Ionicons name="document-text-outline" size={moderateScale(14)} color={sectorPrimary} />
          <Text style={[styles.consultationsText, { color: sectorPrimary }]}>
            {patient.totalConsultations} consultation{patient.totalConsultations !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>

      <View style={styles.actionButtonsRow}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#ecf2ff', borderColor: sectorPrimary, flex: 1 }]}
          onPress={() => {
            (navigation as any).navigate('PatientDetails', {
              patientName: patient.name,
              patientPhone: patient.phone,
            });
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="eye-outline" size={moderateScale(16)} color={sectorPrimary} />
          <Text style={[styles.actionButtonText, { color: sectorPrimary }]}>View Details</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const stats = useMemo(() => {
    const all = allPatients.length;
    const active = activePatients.length;
    const upcoming = upcomingPatients.length;

    return { all, active, upcoming };
  }, [allPatients, activePatients, upcomingPatients]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={sectorGradient[0]} translucent />
      
      {/* Header */}
      <LinearGradient
        colors={sectorGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.headerGradient}
      >
        <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.headerTitle}>My Patients</Text>
              
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Patients List with scrollable header */}
      <FlatList
        data={filteredPatients}
        keyExtractor={(item) => item.id}
        renderItem={renderPatientCard}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <>
            {/* Stats Cards - Now act as filters */}
            <View style={styles.statsContainer}>
              <TouchableOpacity 
                style={[
                  styles.statCard, 
                  { 
                    backgroundColor: filterStatus === 'all' ? sectorPrimary : colors.card, 
                    borderColor: filterStatus === 'all' ? sectorPrimary : colors.border, 
                    borderWidth: filterStatus === 'all' ? 2 : 1 
                  }
                ]}
                onPress={() => setFilterStatus('all')}
                activeOpacity={0.7}
              >
                <Text style={[styles.statNumber, { color: filterStatus === 'all' ? '#ffffff' : sectorPrimary }]}>{stats.all}</Text>
                <Text style={[styles.statLabel, { color: filterStatus === 'all' ? '#ffffff' : colors.textSecondary }]}>All Patients</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[
                  styles.statCard, 
                  { 
                    backgroundColor: filterStatus === 'active' ? '#0AAE8A' : colors.card, 
                    borderColor: filterStatus === 'active' ? '#0AAE8A' : colors.border, 
                    borderWidth: filterStatus === 'active' ? 2 : 1 
                  }
                ]}
                onPress={() => setFilterStatus('active')}
                activeOpacity={0.7}
              >
                <Text style={[styles.statNumber, { color: filterStatus === 'active' ? '#ffffff' : '#0AAE8A' }]}>{stats.active}</Text>
                <Text style={[styles.statLabel, { color: filterStatus === 'active' ? '#ffffff' : colors.textSecondary }]}>TODAY</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[
                  styles.statCard, 
                  { 
                    backgroundColor: filterStatus === 'upcoming' ? '#F2940A' : colors.card, 
                    borderColor: filterStatus === 'upcoming' ? '#F2940A' : colors.border, 
                    borderWidth: filterStatus === 'upcoming' ? 2 : 1 
                  }
                ]}
                onPress={() => setFilterStatus('upcoming')}
                activeOpacity={0.7}
              >
                <Text style={[styles.statNumber, { color: filterStatus === 'upcoming' ? '#ffffff' : '#F2940A' }]}>{stats.upcoming}</Text>
                <Text style={[styles.statLabel, { color: filterStatus === 'upcoming' ? '#ffffff' : colors.textSecondary }]}>Upcoming</Text>
              </TouchableOpacity>
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
              <View style={[styles.searchInputContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name="search" size={moderateScale(20)} color={colors.textSecondary} style={styles.searchIcon} />
                <TextInput
                  style={[styles.searchInput, { color: colors.text }]}
                  placeholder="Search patients by name, phone, or email..."
                  placeholderTextColor={colors.textSecondary}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7}>
                    <Ionicons name="close-circle" size={moderateScale(20)} color={colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Sort Options */}
            <View style={styles.sortContainer}>
              <Text style={[styles.sortLabel, { color: colors.textSecondary }]}>Sort by:</Text>
              {(['recent', 'name', 'lastConsultation'] as const).map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.sortChip,
                    { 
                      backgroundColor: sortBy === option ? sectorPrimary : colors.surface,
                      borderColor: colors.border
                    }
                  ]}
                  onPress={() => setSortBy(option)}
                >
                  <Text style={[
                    styles.sortChipText,
                    { color: sortBy === option ? '#ffffff' : colors.text }
                  ]}>
                    {option === 'recent' ? 'Recent First' : option === 'name' ? 'Name A-Z' : 'Last Consultation'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={moderateScale(48)} color={colors.textSecondary} />
            <Text style={[styles.emptyStateText, { color: colors.text }]}>
              {searchQuery ? 'No patients found' : 'No patients yet'}
            </Text>
            <Text style={[styles.emptyStateSubtext, { color: colors.textSecondary }]}>
              {searchQuery
                ? 'Try adjusting your search'
                : filterStatus === 'all'
                ? 'No patients found'
                : filterStatus === 'active'
                ? 'No active appointments today'
                : 'No upcoming appointments found'}
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />

      <BottomTab active={'My Patients'} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerGradient: {
    paddingHorizontal: moderateScale(20),
    paddingBottom: moderateScale(20),
    paddingTop: moderateScale(10),
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: moderateScale(24),
    fontWeight: '800',
  },
  headerSubtitle: {
    color: '#cfe0ff',
    fontSize: moderateScale(14),
    marginTop: moderateScale(4),
  },
  backButton: {
    padding: moderateScale(8),
    borderRadius: moderateScale(20),
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: moderateScale(0),
    marginTop: moderateScale(16),
    marginBottom: moderateScale(16),
    gap: moderateScale(8),
  },
  statCard: {
    flex: 1,
    padding: moderateScale(16),
    borderRadius: moderateScale(12),
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statNumber: {
    fontSize: moderateScale(24),
    fontWeight: '800',
    marginBottom: moderateScale(4),
  },
  statLabel: {
    fontSize: moderateScale(12),
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  searchContainer: {
    paddingHorizontal: moderateScale(0),
    marginBottom: moderateScale(12),
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: moderateScale(12),
    borderWidth: 1,
    paddingHorizontal: moderateScale(12),
    height: moderateScale(48),
  },
  searchIcon: {
    marginRight: moderateScale(8),
  },
  searchInput: {
    flex: 1,
    fontSize: moderateScale(16),
    paddingVertical: 0,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: moderateScale(16),
    marginBottom: moderateScale(12),
    gap: moderateScale(8),
  },
  filterChip: {
    paddingHorizontal: moderateScale(16),
    paddingVertical: moderateScale(8),
    borderRadius: moderateScale(20),
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: moderateScale(14),
    fontWeight: '600',
  },
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: moderateScale(0),
    marginBottom: moderateScale(16),
    gap: moderateScale(8),
  },
  sortLabel: {
    fontSize: moderateScale(14),
    fontWeight: '600',
    marginRight: moderateScale(8),
  },
  sortChip: {
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(6),
    borderRadius: moderateScale(16),
    borderWidth: 1,
  },
  sortChipText: {
    fontSize: moderateScale(12),
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: moderateScale(16),
    paddingBottom: moderateScale(100),
  },
  patientCard: {
    borderRadius: moderateScale(16),
    padding: moderateScale(16),
    marginBottom: moderateScale(12),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  patientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: moderateScale(12),
  },
  avatarContainer: {
    width: moderateScale(56),
    height: moderateScale(56),
    borderRadius: moderateScale(28),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: moderateScale(12),
  },
  avatarText: {
    fontWeight: '700',
    fontSize: moderateScale(18),
  },
  patientInfo: {
    flex: 1,
  },
  patientName: {
    fontSize: moderateScale(18),
    fontWeight: '800',
    marginBottom: moderateScale(4),
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: moderateScale(2),
  },
  contactText: {
    fontSize: moderateScale(13),
    marginLeft: moderateScale(6),
  },
  patientDetails: {
    marginTop: moderateScale(8),
    marginBottom: moderateScale(12),
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: moderateScale(8),
  },
  detailLabel: {
    fontSize: moderateScale(13),
    marginLeft: moderateScale(8),
    marginRight: moderateScale(8),
  },
  detailValue: {
    fontSize: moderateScale(13),
    fontWeight: '700',
    flex: 1,
  },
  conditionsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: moderateScale(8),
  },
  conditionsText: {
    fontSize: moderateScale(13),
    marginLeft: moderateScale(8),
    flex: 1,
  },
  consultationsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#ecf2ff',
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(6),
    borderRadius: moderateScale(16),
    marginTop: moderateScale(4),
  },
  consultationsText: {
    fontSize: moderateScale(12),
    fontWeight: '700',
    marginLeft: moderateScale(6),
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: moderateScale(8),
    marginTop: moderateScale(8),
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: moderateScale(10),
    borderRadius: moderateScale(10),
    borderWidth: 1,
    gap: moderateScale(6),
  },
  actionButtonText: {
    fontSize: moderateScale(13),
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: moderateScale(60),
  },
  emptyStateText: {
    fontWeight: '600',
    fontSize: moderateScale(16),
    marginTop: moderateScale(12),
  },
  emptyStateSubtext: {
    fontSize: moderateScale(14),
    marginTop: moderateScale(4),
    textAlign: 'center',
    paddingHorizontal: moderateScale(40),
  },
});

export default MyPatientsScreen;

