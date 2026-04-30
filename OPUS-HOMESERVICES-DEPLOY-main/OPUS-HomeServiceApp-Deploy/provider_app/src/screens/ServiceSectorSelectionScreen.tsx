import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Image, ActivityIndicator, Platform } from 'react-native';
import { useFocusEffect, useNavigation, useIsFocused } from '@react-navigation/native';
import { getCompanyInfo, setSelectedSector as setSelectedSectorStore, getSelectedSector } from '../utils/appState';
import { RootStackParamList } from '../types/navigation';
import { moderateScale } from '../utils/responsive';
import { useTheme } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useVerification } from '../hooks/useVerification';
import { trackEvent, trackScreen } from '../services/analytics';

interface ServiceSector {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  bgColor: string;
  services: string[];
}

const ServiceSectorSelectionScreen: React.FC = () => {
  const navigation = useNavigation();
  const { isDark, colors } = useTheme();
  const isFocused = useIsFocused();
  const { isVerified, loading: verificationLoading, verification } = useVerification();
  const [brandName, setBrandName] = useState<string>('Fixit Partner');
  const [selectedSector, setSelectedSector] = useState<'home' | 'healthcare' | 'appliance' | 'automobile' | 'actingDrivers' | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [expandedSector, setExpandedSector] = useState<string | null>(null);
  const hasTrackedScreenFocus = useRef(false);
  const trackingStateRef = useRef({
    isVerified,
    currentSector: verification?.selected_sector,
  });

  trackingStateRef.current = {
    isVerified,
    currentSector: verification?.selected_sector,
  };

  useFocusEffect(
    useCallback(() => {
      if (!hasTrackedScreenFocus.current) {
        hasTrackedScreenFocus.current = true;
        console.log('// FIXED: Issue 2 - Service sector screen tracked once per focus');
        trackScreen('Service Sector Selection Screen', {
          is_verified: trackingStateRef.current.isVerified,
          current_sector: trackingStateRef.current.currentSector,
        });
      }

      return () => {
        hasTrackedScreenFocus.current = false;
      };
    }, [])
  );

  useEffect(() => {
    if (isFocused) {
      setBrandName(getCompanyInfo().companyName || 'Fixit Partner');
    }
  }, [isFocused]);

  // Redirect verified users to appropriate Dashboard
  useEffect(() => {
    console.log('ServiceSectorSelectionScreen - isFocused:', isFocused, 'verificationLoading:', verificationLoading, 'isVerified:', isVerified);
    if (isFocused && !verificationLoading && isVerified) {
      const savedSector = verification?.selected_sector;
      // Check saved sector to route to appropriate dashboard
      let targetRoute = 'Dashboard';
      if (savedSector === 'Medicine Delivery') {
        targetRoute = 'PharmDashboard';
      } else if (savedSector === 'Doctor Consultation') {
        targetRoute = 'DoctorDashboard';
      } else if (savedSector === 'Acting Drivers') {
        targetRoute = 'ActingDriversDashboard';
      }
      console.log(`User is verified, saved sector: ${savedSector}, redirecting to ${targetRoute}...`);
      navigation.reset({
        index: 0,
        routes: [{ name: targetRoute as never }],
      });
    }
  }, [isFocused, verificationLoading, isVerified, verification, navigation]);

  const serviceSectors: ServiceSector[] = [
    {
      id: 'doctor consultation',
      title: 'Doctor Consultation',
      description: 'Tap to view services',
      icon: 'person',
      iconColor: '#9C27B0',
      bgColor: '#F3E5F5',
      services: [
        'General physician',
        'Pediatrics',
        'Gynecology',
        'Dermatology',
        'Orthopedics',
        'Physiotherapy',
        'Psychiatry',
        'ENT',
        'cardiology',
        'Geriatric Care'
      ]
    },
    {
      id: 'medicine delivery',
      title: 'Medicine Delivery',
      description: 'Tap to view services',
      icon: 'medkit',
      iconColor: '#4A90E2',
      bgColor: '#E3F2FD',
      services: [
        'Manage Orders',
        'Prescription Refill',
        'Update Delivery Status',

      ]
    },
    {
      id: 'healthcare',
      title: 'Healthcare',
      description: 'Tap to view services',
      icon: 'heart',
      iconColor: '#FF6B6B',
      bgColor: '#FFE5E5',
      services: [
        'Medicine delivery',
        'Lab test',
        'Physiotherapy',
        'wellcare'
      ]
    },
    {
      id: 'home',
      title: 'Home Services',
      description: 'Tap to view services',
      icon: 'home',
      iconColor: '#4CAF50',
      bgColor: '#E8F5E9',
      services: [
        'Cleaning & Deep Cleaning',
        'Pest Control & Waterproofing',
        'Gardening & Landscaping',
        'Clothes Ironing & Laundry',
        'Plumbing, Electrical, Carpentry',
        'Party/Event Decoration'
      ]
    },
    {
      id: 'automobile',
      title: 'Automobile Services',
      description: 'Tap to view services',
      icon: 'construct',
      iconColor: '#FF9500',
      bgColor: '#FFF3E0',
      services: [
        'Bike & Car Service',
        'Rapid Puncture Repair',
        'Car Wash & Interior Cleaning',
        'Roadside Assistance',
        'Tyre & Battery Replacement (at home)'
      ]
    },
    {
      id: 'appliance',
      title: 'Appliance Services',
      description: 'Tap to view services',
      icon: 'cube',
      iconColor: '#3F51B5',
      bgColor: '#E8EAF6',
      services: [
        'AC Repair & Gas Refill',
        'Refrigerator Repair',
        'Washing Machine Repair',
        'Microwave & Oven Repair',
        'Water Purifier Service',
        'TV & Geyser Installation/Repair'
      ]
    },
    {
      id: 'acting drivers',
      title: 'Acting Drivers',
      description: 'Tap to view services',
      icon: 'car-sport',
      iconColor: '#FF5722',
      bgColor: '#FFE8E1',
      services: [
        'Personal Driver Service',
        'Trip-based Driving',
        'Airport/Station Pickup & Drop',
        'Long Distance Driving',
      ]
    }
  ];

  const handleSectorSelect = (sector: ServiceSector): void => {
    // Map displayed sectors to root keys used by app state and navigation
    const rootMap: Record<string, 'home' | 'healthcare' | 'appliance' | 'automobile' | 'actingDrivers' | undefined> = {
      'doctor consultation': 'healthcare',
      'medicine delivery': 'healthcare',
      healthcare: 'healthcare',
      home: 'home',
      automobile: 'automobile',
      appliance: 'appliance',
      'acting drivers': 'actingDrivers',
    };
    const root = rootMap[sector.id];
    setSelectedCardId(sector.id);
    setSelectedSector(root ?? null);
    if (root) setSelectedSectorStore(root);
    console.log('// FIXED: Issue 3 - Screen Viewed uses selected sector local value');
    trackScreen('Service Sector Selection Screen', {
      is_verified: isVerified,
      current_sector: sector.id,
    });
  };

  const toggleExpand = (sectorId: string): void => {
    setExpandedSector(prev => (prev === sectorId ? null : sectorId));
  };

  // Show loading while checking verification status
  if (verificationLoading) {
    return (
      <View style={[styles.gradientBg, { backgroundColor: '#f5f5f5' }]}>
        <SafeAreaView style={styles.container}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0b1960" />
            <Text style={styles.loadingText}>Checking verification status...</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // Don't render the service selection screen if user is verified
  // The useEffect above will handle the redirect
  if (isVerified) {
    return (
      <View style={[styles.gradientBg, { backgroundColor: '#f5f5f5' }]}>
        <SafeAreaView style={styles.container}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0b1960" />
            <Text style={styles.loadingText}>Redirecting to Dashboard...</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={[styles.gradientBg, { backgroundColor: '#f5f5f5' }]}>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Header Section */}
          <View style={styles.headerContainer}>
            <Text style={[styles.instruction, { color: '#000000' }]}>Service Categories</Text>
            <Text style={styles.subtitle}>Choose your service area to get started</Text>
          </View>

          {/* Service Sectors */}
          <View style={styles.sectorsContainer}>
            {serviceSectors.map((sector) => {
              const isSelected = selectedCardId === sector.id;
              return (
                <View key={sector.id}>
                  <TouchableOpacity
                    style={[
                      styles.sectorCard,
                      { backgroundColor: colors.card },
                      isSelected && styles.selectedSectorCard,
                      expandedSector === sector.id && { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }
                    ]}
                    onPress={() => handleSectorSelect(sector)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.sectorHeader}>
                      <View style={[
                        styles.iconContainer, 
                        { backgroundColor: isSelected ? sector.iconColor : sector.bgColor }
                      ]}>
                        <Ionicons
                          name={sector.icon}
                          size={moderateScale(24)}
                          color={isSelected ? '#FFFFFF' : sector.iconColor}
                        />
                      </View>
                      <View style={styles.sectorInfo}>
                        <Text style={[styles.sectorTitle, { color: colors.text }]}>{sector.title}</Text>
                      </View>
                      
                      {isSelected ? (
                        <Ionicons
                          name="checkmark-circle"
                          size={moderateScale(24)}
                          color="#3B5BFD"
                        />
                      ) : (
                        <TouchableOpacity onPress={() => toggleExpand(sector.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                          <Ionicons
                            name={expandedSector === sector.id ? "chevron-up" : "chevron-down"}
                            size={moderateScale(24)}
                            color={colors.textSecondary}
                          />
                        </TouchableOpacity>
                      )}
                    </View>
                  </TouchableOpacity>

                  {/* Dropdown Services */}
                  {expandedSector === sector.id && (
                    <View style={[
                      styles.servicesDropdown,
                      { backgroundColor: colors.card }
                    ]}>
                      {sector.services.map((service, index) => (
                        <View key={index} style={styles.serviceItem}>
                          <Text style={styles.bulletPoint}>•</Text>
                          <Text style={styles.serviceText}>{service}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          {/* Continue Button */}
          {selectedSector === null && (
            <Text style={[styles.helperText]}>Please select a service sector to continue</Text>
          )}
          <TouchableOpacity
            onPress={() => {
              if (!selectedSector) return;
              const selected = serviceSectors.find(s => s.id === selectedCardId);
              const sectorName = selected ? selected.title : undefined;

              trackEvent('Service Sector Selected', {
                sector_id: selectedSector,
                sector_name: sectorName,
                is_doctor_consultation: sectorName === 'Doctor Consultation',
                sub_services: selected?.services || [],
              });

              if (sectorName === 'Doctor Consultation') {
                navigation.navigate('DoctorVerification', { sector: selectedSector, sectorName });
              } else {
                navigation.navigate('KYCVerification', { sector: selectedSector, sectorName });
              }
            }}
            activeOpacity={0.8}
            disabled={!selectedSector}
          >
            <LinearGradient
              colors={['#004c8f', '#0c1a5d']}
              style={[styles.continueButton, !selectedSector && styles.disabledContinueButton]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
            >
              <Text style={[styles.continueButtonText, !selectedSector && styles.disabledContinueButtonText]}>
                Continue
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  gradientBg: { flex: 1 },
  container: {
    flex: 1,
    paddingHorizontal: moderateScale(20),
    paddingTop: 20,
    paddingBottom: moderateScale(20),
  },
  scrollContent: {
    paddingBottom: moderateScale(40),
  },
  headerContainer: {
    alignItems: 'center',
    marginTop: moderateScale(20),
    marginBottom: moderateScale(30),
  },
  instruction: {
    color: '#000000',
    fontSize: moderateScale(26),
    fontWeight: 'bold',
    textAlign: 'center',
  },
  subtitle: {
    color: '#666666',
    fontSize: moderateScale(16),
    marginTop: moderateScale(8),
    textAlign: 'center',
  },
  sectorsContainer: {
    flex: 1,
    paddingHorizontal: 0,
  },
  sectorCard: {
    backgroundColor: '#ffffff',
    borderRadius: moderateScale(16),
    padding: moderateScale(20),
    marginBottom: moderateScale(16),
    marginHorizontal: 0,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: moderateScale(8),
    shadowOffset: { width: 0, height: moderateScale(2) },
    elevation: 2,
    position: 'relative',
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  selectedSectorCard: {
    backgroundColor: '#EEF4FF',
    borderColor: '#3B5BFD',
    borderLeftWidth: 4,
  },
  sectorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: moderateScale(48),
    height: moderateScale(48),
    borderRadius: moderateScale(24),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: moderateScale(16),
  },
  sectorInfo: {
    flex: 1,
  },
  sectorTitle: {
    fontSize: moderateScale(18),
    fontWeight: '600',
    color: '#000000',
  },
  continueButton: {
    paddingVertical: moderateScale(16),
    borderRadius: moderateScale(14),
    alignItems: 'center',
    marginTop: moderateScale(20),
    marginHorizontal: 0,
    shadowColor: '#004c8f',
    shadowOpacity: 0.35,
    shadowRadius: moderateScale(8),
    shadowOffset: { width: 0, height: moderateScale(4) },
    elevation: 3,
  },
  continueButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: moderateScale(16),
  },
  disabledContinueButton: {
    shadowOpacity: 0,
    elevation: 0,
    opacity: 0.6,
  },
  disabledContinueButtonText: {
    color: '#666666',
  },
  helperText: {
    color: '#666666',
    marginTop: moderateScale(4),
    marginBottom: moderateScale(8),
    textAlign: 'center',
  },
  servicesDropdown: {
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: moderateScale(16),
    borderBottomRightRadius: moderateScale(16),
    marginTop: moderateScale(-8),
    marginBottom: moderateScale(16),
    paddingTop: moderateScale(12),
    paddingBottom: moderateScale(16),
    paddingHorizontal: moderateScale(20),
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: '#e0e0e0',
  },
  serviceItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: moderateScale(10),
  },
  bulletPoint: {
    fontSize: moderateScale(18),
    color: '#000000',
    marginRight: moderateScale(12),
    marginTop: moderateScale(2),
  },
  serviceText: {
    fontSize: moderateScale(15),
    color: '#000000',
    flex: 1,
    lineHeight: moderateScale(22),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: moderateScale(100),
  },
  loadingText: {
    marginTop: moderateScale(16),
    fontSize: moderateScale(16),
    color: '#666',
    textAlign: 'center',
  },
});

export default ServiceSectorSelectionScreen;
