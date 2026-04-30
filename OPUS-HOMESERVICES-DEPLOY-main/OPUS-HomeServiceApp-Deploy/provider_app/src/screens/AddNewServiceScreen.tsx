import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, TextInput, ActivityIndicator, Alert, Platform, KeyboardAvoidingView } from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import BackButton from '../components/BackButton';
import { moderateScale } from '../utils/responsive';
import BottomTab from '../components/BottomTab';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { getSelectedSector } from '../utils/appState';

type CategoryId = 'home' | 'salon' | 'pet' | 'appliance' | 'healthcare' | 'automobile';

type ServiceGroup = {
  title: string;
  items: string[];
};

type Category = {
  id: CategoryId;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  groups: ServiceGroup[];
};

const CATEGORIES: Category[] = [
  {
    id: 'home',
    title: 'Home Services',
    icon: 'home',
    groups: [
      {
        title: 'Home services', items: [
          'Cleaning & Pest Control',
          'Plumbing Services',
          'Electrical Services',
          'Carpentry Services',
          'Painting & Renovation',
        ]
      },
      {
        title: 'Salon Services', items: [

          'Women’s Salon',
          'Men’s Salon',
          'Unisex & Spa',
        ]
      },
      {
        title: 'Pet Care Services', items: [
          'Pet Grooming',
          'Pet Health & Training',
          'Pet Boarding & Sitting',
        ]
      },

    ],
  },

  {
    id: 'appliance',
    title: 'Appliances',
    icon: 'hardware-chip',
    groups: [
      {
        title: 'Kitchen Appliances', items: [
          'Gas Stove & Hob Services',
          'Chimney Repair & Services',
          'Dishwasher Repair & Services',
          'Microwave Repair & Services',
          'Refrigerator Repair & Services',
          'Water Purifier & Services',
        ]
      },
      {
        title: 'Home Appliances', items: [
          'AC Repair & Services',
          'Geyser Repair & Services',
          'Water Cooler Repair & Services',
          'Washing Machine Repair',
          'Fan Repair & Services',
        ]
      },
      {
        title: 'Home Electronics', items: [
          'Television Repair & Services',
          'Speaker Repair & Services',
          'Inverter & UPS Repair & Services',
          'Laptop & PC Repair & Services',
        ]
      },
    ],
  },
  {
    id: 'healthcare',
    title: 'Healthcare',
    icon: 'medkit',
    groups: [
      {
        title: 'Diagnostics Tests', items: [
          'Complete blood picture',
          'Blood sugar level',
          'Hb A1C levels',
          'Urine analysis',
          'Lipid Profile Screening',
          'Thyroid Screening',
          'Liver Function Test',
          'Kidney function test',
          'Thyroid Function Test',
          'Cardiac markers',
          'Arterial blood gases',
          'Serum Electrolytes',
        ]
      },
      {
        title: 'Comprehensive health checkups', items: [
          'Diabetic package',
          'Basic master health checkup',
          'Preventive Health Checkup',
          'Senior Citizen Health Checkup',
          'Whole Body health checkup',
          'Healthy Heart Premium',
        ]
      },
      {
        title: 'Advanced Diagnosis', items: [
          'Sleep Study',
          'Ambulatory Blood pressure monitoring',
          'Holter Monitoring',
          'X-ray at home',
          'ECG at home',
        ]
      },
      {
        title: 'Physiotherapy', items: [
          'Musculoskeletal / Orthopedic Physiotherapy',
          'Neurological Physiotherapy',
          'Cardiopulmonary Physiotherapy',
          'Pediatric Physiotherapy',
          'Geriatric Physiotherapy',
        ]
      },
    ],
  },
  {
    id: 'automobile',
    title: 'Automobile',
    icon: 'car',
    groups: [
      {
        title: 'Car Repair Services', items: [
          'Car General Maintenance & Repairs',
          'Car Engine & Electronic Services',
          'Car Body & Paint Work',
          'Car Tyres & Wheels',
          'Car Detailing & Cleaning',
        ]
      },
      {
        title: 'Bike Repair Services', items: [
          'Bike General Maintenance & Repairs',
          'Bike Engine & Electronic Services',
          'Bike Tires & Wheels',
          'Bike Detailing & Cleaning',
        ]
      },
      {
        title: 'Acting Drivers', items: [
          'Personal & Trip-based Services',

        ]
      },

    ],
  },
];

const AddNewServiceScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors } = useTheme();
  const { user } = useAuth();
  const HORIZONTAL_PADDING = Platform.OS === 'android' ? moderateScale(-2) : moderateScale(20);
  const selectedSector = (getSelectedSector?.() as CategoryId | undefined) || undefined;
  const initialRoot = ((route.params as any)?.root as CategoryId | undefined) || selectedSector;
  const lockRoot = !!(route.params as any)?.lockRoot;
  const [activeCategory, setActiveCategory] = useState<CategoryId>(initialRoot || 'home');
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [myServices, setMyServices] = useState<any[]>([]);
  const [servicesLoading, setServicesLoading] = useState<boolean>(false);
  const [companyId, setCompanyId] = useState<string | null>(null);

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Enable multiple selection for all categories
  const isMultipleSelectionMode = true;

  // Get current selected services (always multiple selection)
  const getCurrentSelections = () => {
    return selectedServices;
  };

  // Handle service selection (always multiple selection mode)
  const handleServiceSelection = (service: string) => {
    setSelectedServices(prev => {
      if (prev.includes(service)) {
        return prev.filter(s => s !== service);
      } else {
        return [...prev, service];
      }
    });
  };

  // Check if a service is selected
  const isServiceSelected = (service: string) => {
    return selectedServices.includes(service);
  };
  const [description, setDescription] = useState<string>('');
  const [experienceYears, setExperienceYears] = useState<string>('');

  // Clear all form data and selections when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      setSelectedService(null);
      setSelectedServices([]);
      setDescription('');
      setExperienceYears('');
      setExpandedGroups({});
    }, [])
  );

  useEffect(() => {
    const fetchMyServices = async () => {
      if (!user) return;
      try {
        setServicesLoading(true);
        const { data, error } = await api.services.getServices(user.id);
        if (!error) setMyServices(data || []);
      } finally {
        setServicesLoading(false);
      }
    };

    const fetchCompanyId = async () => {
      if (!user) return;
      try {
        const { data, error } = await api.companyVerification.getCompanyVerification(user.id);
        if (!error && data) {
          setCompanyId(data.id);
        }
      } catch (error) {
        console.error('Error fetching company verification:', error);
      }
    };

    fetchMyServices();
    fetchCompanyId();
  }, [user]);

  return (
    <LinearGradient colors={[colors.primary, colors.primary]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.gradientBg}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <ScrollView contentContainerStyle={[styles.scrollContent, { paddingHorizontal: HORIZONTAL_PADDING }]} style={{ backgroundColor: colors.background }} showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={[styles.headerRow, { paddingHorizontal: 0 }]}>
              <BackButton style={styles.headerBack} color="#000000" size={moderateScale(22)} />
              <Text style={[styles.headerTitle, { color: colors.text }]}>Add Services</Text>
              <View style={{ width: moderateScale(22) }} />
            </View>

            {/* Category buttons removed as requested */}

            {/* Your existing services summary */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
              <View style={[styles.cardHeader, { justifyContent: 'space-between' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={styles.headerIconCircle}>
                    <Ionicons name="briefcase-outline" size={moderateScale(18)} color="#3B5BFD" />
                  </View>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>Your Services</Text>
                </View>
                <View style={styles.headerRightContainer}>
                  <Text style={[styles.selectedValue, { color: colors.textSecondary }]}>
                    {servicesLoading ? 'Loading...' : `${myServices.length} total`}
                  </Text>
                  <TouchableOpacity
                    style={[styles.viewAllButton, { backgroundColor: colors.surface }]}
                    onPress={() => (navigation as any).navigate('YourServices')}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="eye-outline" size={moderateScale(16)} color={colors.primary} />
                    <Text style={[styles.viewAllButtonText, { color: colors.primary }]}>View All</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {!servicesLoading && myServices.slice(0, 3).map((svc) => (
                <View key={svc.id} style={[styles.optionRow, { borderColor: colors.border, backgroundColor: colors.card }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.serviceText, { color: colors.text }]} numberOfLines={1}>{svc.service_name}</Text>
                    <Text style={[styles.hint, { color: colors.textSecondary }]}>{svc.service_type} • {svc.status}</Text>
                  </View>
                  <View style={[styles.optionIconCircle, { backgroundColor: colors.surface }]}>
                    <Ionicons name="checkmark-circle" size={moderateScale(18)} color="#12B76A" />
                  </View>
                </View>
              ))}
            </View>

            {/* Category heading based on selected sector */}
            <View style={[styles.categoryHeader, { paddingHorizontal: 0 }]}>
              <View style={styles.categoryIconCircle}>
                <Ionicons name={CATEGORIES.find(c => c.id === activeCategory)?.icon || 'apps'} size={moderateScale(24)} color="#3B5BFD" />
              </View>
              <Text style={[styles.categoryTitle, { color: colors.text }]}>{CATEGORIES.find(c => c.id === activeCategory)?.title || 'Services'}</Text>
            </View>

            {/* Single active category with dropdown groups and multi-select items */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
              {/* Card header removed to simplify UI */}
              {CATEGORIES.find(c => c.id === activeCategory)?.groups.map(group => {
                const key = `${activeCategory}:${group.title}`;
                const isOpen = !!expandedGroups[key];
                return (
                  <View key={group.title} style={{ marginBottom: moderateScale(10) }}>
                    <TouchableOpacity style={styles.groupHeaderRow} onPress={() => toggleGroup(key)} activeOpacity={0.85}>
                      <Text style={styles.groupTitle}>{group.title}</Text>
                      <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={moderateScale(18)} color={colors.textSecondary} />
                    </TouchableOpacity>
                    {isOpen && group.items.map(item => {
                      const isSelected = isServiceSelected(item);
                      return (
                        <TouchableOpacity key={item} style={[styles.optionRow, { borderColor: colors.border, backgroundColor: colors.card }, isSelected && styles.optionRowActive]} onPress={() => {
                          handleServiceSelection(item);
                        }} activeOpacity={0.85}>
                          <View style={[styles.optionIconCircle, { backgroundColor: colors.surface }, isSelected && styles.optionIconCircleActive]}>
                            {isSelected && <Ionicons name="checkmark" size={moderateScale(18)} color="#ffffff" />}
                          </View>
                          <View style={styles.optionTextContainer}>
                            <Text style={[styles.optionText, { color: colors.text }]} numberOfLines={1}>{item}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                );
              })}
            </View>

            {/* Selected service preview (moved above Service Details) */}
            {getCurrentSelections().length > 0 ? (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
                <View style={[styles.cardHeader, { justifyContent: 'space-between' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={styles.headerIconCircle}>
                      <Ionicons name="checkmark-circle" size={moderateScale(18)} color="#12B76A" />
                    </View>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>
                      Selected Services
                    </Text>
                  </View>
                  <Text style={[styles.selectedValue, { color: colors.text }]} numberOfLines={1}>
                    {getCurrentSelections().length} selected
                  </Text>
                </View>
                {getCurrentSelections().length > 0 && (
                  <View style={styles.selectedServicesList}>
                    {getCurrentSelections().map((service, index) => (
                      <View key={index} style={[styles.selectedServiceItem, { backgroundColor: colors.surface }]}>
                        <Text style={[styles.selectedServiceText, { color: colors.text }]}>{service}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ) : null}

            {/* Service Details */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>Service Details</Text>
              </View>
              <Text style={[styles.label, { color: colors.text }]}>Short Description</Text>
              <TextInput
                style={[styles.textArea, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                placeholder="Describe the type of service you provide briefly..."
                placeholderTextColor={colors.textSecondary}
                value={description}
                onChangeText={setDescription}
                multiline
              />
              {/* Service Experience (in years) */}
              <Text style={[styles.label, { color: colors.text }]}>Service Experience (years)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                placeholder="e.g., 5"
                placeholderTextColor={colors.textSecondary}
                value={experienceYears}
                onChangeText={setExperienceYears}
                keyboardType="numeric"
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, (getCurrentSelections().length === 0 || loading) && styles.primaryBtnDisabled]}
              disabled={getCurrentSelections().length === 0 || loading}
              onPress={async () => {
                if (!user) {
                  Alert.alert('Not signed in', 'Please sign in to submit your service.');
                  return;
                }
                const currentSelections = getCurrentSelections();
                if (currentSelections.length === 0) return;

                try {
                  setLoading(true);

                  console.log('Creating services with data:', {
                    user_id: user.id,
                    company_id: companyId,
                    service_type: activeCategory,
                    selectedServices: currentSelections
                  });

                  // Submit each selected service separately
                  const promises = currentSelections.map(serviceName =>
                    api.services.createService({
                      user_id: user.id,
                      company_id: companyId,
                      service_name: serviceName,
                      service_type: activeCategory,
                      description: description || null,
                      experience_years: experienceYears ? Number(experienceYears) : null,
                    } as any)
                  );

                  const results = await Promise.all(promises);
                  console.log('Service creation results:', results);

                  const errors = results.filter(result => result.error);

                  if (errors.length > 0) {
                    console.error('Service creation errors:', errors);
                    Alert.alert('Error', `Failed to submit ${errors.length} service(s). Please try again.`);
                    return;
                  }

                  navigation.navigate('ServiceSubmitted', {
                    serviceName: currentSelections.length === 1 ? currentSelections[0] : `${currentSelections.length} services`,
                    submittedOn: new Date().toLocaleString()
                  });
                } catch (e: any) {
                  Alert.alert('Error', e?.message || 'Failed to submit service');
                } finally {
                  setLoading(false);
                }
              }}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.primaryBtnText}>Submit</Text>
              )}
            </TouchableOpacity>


            <Text style={styles.footerNote}>Our team will verify before making it live.</Text>
          </ScrollView>
        </KeyboardAvoidingView>
        <BottomTab active={'Home'} />
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradientBg: { flex: 1 },
  container: { flex: 1, padding: moderateScale(20) },
  scrollContent: { paddingBottom: moderateScale(140), paddingHorizontal: moderateScale(20) },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: moderateScale(12), marginTop: moderateScale(20) },
  headerBack: { padding: moderateScale(6) },
  headerTitle: { color: '#ffffff', fontWeight: '800', fontSize: moderateScale(18) },
  headerSubtitle: { color: '#6B7280', fontWeight: '600', marginBottom: moderateScale(8) },
  card: { backgroundColor: '#ffffff', borderRadius: moderateScale(16), padding: moderateScale(16), marginBottom: moderateScale(14) },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: moderateScale(10) },
  headerIconCircle: { width: moderateScale(32), height: moderateScale(32), borderRadius: moderateScale(16), backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center', marginRight: moderateScale(10) },
  cardTitle: { color: '#0b1960', fontWeight: '700', fontSize: moderateScale(18) },
  selectedValue: { color: '#0b1960', fontWeight: '500', fontSize: moderateScale(12) },
  headerRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(8)
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: moderateScale(8),
    paddingVertical: moderateScale(4),
    borderRadius: moderateScale(12),
    backgroundColor: '#F4F6FB',
    borderWidth: 1,
    borderColor: '#E6ECFF',
  },
  viewAllButtonText: {
    color: '#3B5BFD',
    fontWeight: '600',
    fontSize: moderateScale(12),
    marginLeft: moderateScale(4),
  },
  categoryHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: moderateScale(20), paddingHorizontal: moderateScale(4) },
  categoryIconCircle: { width: moderateScale(48), height: moderateScale(48), borderRadius: moderateScale(24), backgroundColor: '#EAF0FF', alignItems: 'center', justifyContent: 'center', marginRight: moderateScale(12) },
  categoryTitle: { color: '#ffffff', fontWeight: '800', fontSize: moderateScale(20) },
  catChip: { flexDirection: 'row', alignItems: 'center', borderRadius: moderateScale(16), borderWidth: 1, borderColor: '#2a3e85', paddingVertical: moderateScale(6), paddingHorizontal: moderateScale(10), marginRight: moderateScale(8), backgroundColor: '#1a2a6b' },
  catChipActive: { backgroundColor: '#e6e8ff', borderColor: '#e6e8ff' },
  catChipText: { color: '#cfe0ff', marginLeft: moderateScale(6), fontWeight: '700' },
  catChipTextActive: { color: '#0b1960' },
  groupHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: moderateScale(6) },
  groupTitle: { color: '#0b1960', fontWeight: '800' },
  optionRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E4E9FF', borderRadius: moderateScale(14), padding: moderateScale(12), marginBottom: moderateScale(10), backgroundColor: '#F9FAFF', justifyContent: 'flex-start', paddingLeft: moderateScale(16) },
  optionRowActive: { borderColor: '#3B5BFD', backgroundColor: '#EEF3FF' },
  optionIconCircle: { width: moderateScale(44), height: moderateScale(44), borderRadius: moderateScale(22), backgroundColor: '#EAF0FF', alignItems: 'center', justifyContent: 'center', marginRight: moderateScale(12), marginLeft: moderateScale(-4) },
  optionIconCircleActive: { backgroundColor: '#3B5BFD' },
  optionTextContainer: {
    flex: 1,
    justifyContent: 'center', marginTop: 15,
  },
  optionText: { color: '#0b1960', fontWeight: '600', textAlign: 'left', flex: 1 },
  serviceText: { color: '#0b1960', fontWeight: '600', fontSize: moderateScale(16), },
  label: { color: '#0b1960', fontWeight: '600', marginTop: moderateScale(6), marginBottom: moderateScale(6) },
  input: { height: moderateScale(48), borderRadius: moderateScale(12), backgroundColor: '#F4F6FB', paddingHorizontal: moderateScale(12), color: '#000000', borderWidth: 1, borderColor: '#E6ECFF' },
  textArea: { height: moderateScale(120), borderRadius: moderateScale(12), backgroundColor: '#F4F6FB', paddingHorizontal: moderateScale(12), paddingVertical: moderateScale(12), color: '#000000', borderWidth: 1, borderColor: '#E6ECFF', textAlignVertical: 'top' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchLabel: { color: '#0b1960', fontWeight: '600' },
  hint: { color: '#5B6B95', marginTop: moderateScale(8) },
  primaryBtn: { backgroundColor: '#3b5bfd', borderRadius: moderateScale(12), paddingVertical: moderateScale(14), alignItems: 'center', marginTop: moderateScale(10) },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { color: '#ffffff', fontWeight: '700' },
  footerNote: { color: '#cfe0ff', textAlign: 'center', marginTop: moderateScale(10) },
  selectedServicesList: { marginTop: moderateScale(12) },
  selectedServiceItem: {
    backgroundColor: '#F4F6FB',
    borderRadius: moderateScale(8),
    padding: moderateScale(8),
    marginBottom: moderateScale(6)
  },
  selectedServiceText: {
    color: '#0b1960',
    fontWeight: '500',
    fontSize: moderateScale(14)
  },
});

export default AddNewServiceScreen;


