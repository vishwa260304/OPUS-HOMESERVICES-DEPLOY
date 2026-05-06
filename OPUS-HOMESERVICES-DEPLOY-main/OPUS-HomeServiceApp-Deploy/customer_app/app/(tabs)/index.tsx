import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
  TextInput,
  ScrollView,
  Modal,
  Alert,
  Animated,
  StatusBar,
  Keyboard,
  Platform,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Image as Img } from 'expo-image';
import { Asset } from 'expo-asset';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { hapticButtonPress, hapticSuccess } from '../../utils/haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUser } from '../../context/UserContext';
import * as Location from 'expo-location';
import { Fonts } from '../../constants/Fonts';
import CategoryFilter from '../../components/CategoryFilter';
import { useTheme } from '../../context/ThemeContext';
import GlobalText from '../../components/GlobalText';
import BannerCarousel from '../../components/BannerCarousel';
import { useAnalytics } from '../../context/AnalyticsContext';
import { AutomobileServicesApi, AutomobileServiceRow } from '../../lib/automobileServices';
import { ApplianceServicesApi, ApplianceServiceRow } from '../../lib/applianceServices';
import { HomeServicesApi, HomeServiceRow } from '../../lib/homeServices';

const { width } = Dimensions.get('window');
const cardWidth = (width - 80) / 4;

interface Service {
  id: string;
  title: string;
  icon: string;
  iconColor: string;
  color: string;
}

// Union type for all service rows
type ServiceRow = AutomobileServiceRow | ApplianceServiceRow | HomeServiceRow;

// Extended service type for search results
interface ExtendedService {
  id: string;
  section_key: string;
  section_title: string;
  title: string;
  rating: string | null;
  reviews: number | null;
  price: string | null;
  bullets: string[] | null;
  time: string | null;
  image_path: string | null;
  category: string;
  created_at: string;
  updated_at: string;
  serviceType: 'automobile' | 'appliance' | 'home';
  displayCategory: string;
  searchScore: number;
}

const servicesData = (colors: any) => [
  { id: '1', title: 'Automobile', icon: 'car', iconColor: '#1E3A8A', color: colors.surface },
  { id: '2', title: 'Appliances', icon: 'construct', iconColor: '#DC2626', color: colors.surface },
  { id: '3', title: 'Home', icon: 'home', iconColor: '#7C3AED', color: colors.surface },
  { id: '4', title: 'Real Estate', icon: 'business', iconColor: '#059669', color: colors.surface },
];

// Banner images for services page
const bannerImages = [
  {
    id: '1',
    image: require('../../assets/images/realestate_banner.png'),
    title: 'Real Estate',
  },
  {
    id: '2',
    image: require('../../assets/images/service_banner_2.png'),
    title: 'Automobile_Serives',

  },
  {
    id: '3',
    image: require('../../assets/images/service_banner_3.png'),
    title: 'Home decor',

  },
  {
    id: '4',
    image: require('../../assets/images/service_banner_1.png'),
    title: 'Appliance_Services',

  },
  {
    id: '5',
    image: require('../../assets/images/acting_driver_banner.webp'),
    title: 'Acting_Driver',

  },
];

export default function ServicesScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const analytics = useAnalytics();
  const [showAutoSheet, setShowAutoSheet] = useState(false);
  const [showApplianceSheet, setShowApplianceSheet] = useState(false);
  const [showHomeSheet, setShowHomeSheet] = useState(false);
  const [showRealEstateSheet, setShowRealEstateSheet] = useState(false);
  const locationSuggestions = [
    'Bengaluru, Karnataka',
    'Chennai, Tamil Nadu',
    'Krishnagiri, Tamil Nadu',
    'Mumbai, Maharashtra',
    'Pune, Maharashtra',
    'Hyderabad, Telangana',
    'Delhi, Delhi',
    'Kolkata, West Bengal',
  ];

  // Animated header state
  const [showTopSection, setShowTopSection] = useState(true);
  const [scrollDirection, setScrollDirection] = useState<'up' | 'down' | null>(null);
  const [lastScrollY, setLastScrollY] = useState(0);

  // Enhanced search functionality
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchResults, setSearchResults] = useState<ExtendedService[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [showFullPageSearch, setShowFullPageSearch] = useState(false);
  const [allServices, setAllServices] = useState<ExtendedService[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<string>('All');
  const [showSearchHistory, setShowSearchHistory] = useState(false);


  const scrollListener = useCallback((event: any) => {
    const currentScrollY = event.nativeEvent.contentOffset.y;
    const scrollDiff = Math.abs(currentScrollY - lastScrollY);

    if (scrollDiff < 5) return; // Ignore small scroll changes

    if (currentScrollY > lastScrollY && currentScrollY > 10) {
      // Scrolling down
      if (scrollDirection !== 'down') {
        setScrollDirection('down');
        setShowTopSection(false);
      }
    } else if (currentScrollY < lastScrollY) {
      // Scrolling up
      if (scrollDirection !== 'up') {
        setScrollDirection('up');
      }
      // Only show profile section when near the top
      if (currentScrollY <= 10) {
        setShowTopSection(true);
      }
    }

    setLastScrollY(currentScrollY);
  }, [lastScrollY, scrollDirection]);

  // Load all services from database
  useEffect(() => {
    const loadAllServices = async () => {
      try {
        setLoadingServices(true);
        const [automobileServices, applianceServices, homeServices] = await Promise.all([
          AutomobileServicesApi.list(),
          ApplianceServicesApi.list(),
          HomeServicesApi.list(),
        ]);

        const formattedServices: ExtendedService[] = [
          ...automobileServices.map(service => ({
            ...service,
            serviceType: 'automobile' as const,
            displayCategory: 'Automobile',
            searchScore: 0
          })),
          ...applianceServices.map(service => ({
            ...service,
            serviceType: 'appliance' as const,
            displayCategory: 'Appliances',
            searchScore: 0
          })),
          ...homeServices.map(service => ({
            ...service,
            serviceType: 'home' as const,
            displayCategory: 'Home Services',
            searchScore: 0
          }))
        ];

        setAllServices(formattedServices);
      } catch (error) {
        console.error('Error loading services:', error);
      } finally {
        setLoadingServices(false);
      }
    };

    loadAllServices();
  }, []);

  // Load search history
  useEffect(() => {
    const loadSearchHistory = async () => {
      try {
        const history = await AsyncStorage.getItem('search_history');
        if (history) {
          setSearchHistory(JSON.parse(history));
        }
      } catch (error) {
        console.error('Error loading search history:', error);
      }
    };
    loadSearchHistory();
  }, []);

  // Generate search suggestions based on available services
  useEffect(() => {
    if (allServices.length > 0) {
      const suggestions = allServices
        .map(service => service.title)
        .filter((title, index, self) => self.indexOf(title) === index)
        .slice(0, 10);
      setSearchSuggestions(suggestions);
    }
  }, [allServices]);


  // Preload appliance tile images when the sheet opens to avoid decode jank
  useEffect(() => {
    if (!showApplianceSheet) return;
    const sources = [
      require('../../assets/images/Kitchen_appliances.webp'),
      require('../../assets/images/acservice.webp'),
      require('../../assets/images/tv.png'),
      require('../../assets/images/Kitchen_appliances.webp'),
    ];
    sources.forEach((src) => {
      try { Asset.fromModule(src).downloadAsync(); } catch { }
    });
  }, [showApplianceSheet]);


  // Enhanced search functionality
  const performSearch = useCallback(async (query: string) => {
    if (query.trim().length < 1) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);

    try {
      const lowercaseQuery = query.toLowerCase();

      // Use API search methods for better performance
      const [automobileResults, applianceResults, homeResults] = await Promise.all([
        AutomobileServicesApi.search(query),
        ApplianceServicesApi.search(query),
        HomeServicesApi.search(query),
      ]);

      // Format and combine results
      const allResults: ExtendedService[] = [
        ...automobileResults.map((service: AutomobileServiceRow): ExtendedService => ({
          ...service,
          serviceType: 'automobile' as const,
          displayCategory: 'Automobile',
          searchScore: calculateSearchScore(service.title, lowercaseQuery)
        })),
        ...applianceResults.map((service: ApplianceServiceRow): ExtendedService => ({
          ...service,
          serviceType: 'appliance' as const,
          displayCategory: 'Appliances',
          searchScore: calculateSearchScore(service.title, lowercaseQuery)
        })),
        ...homeResults.map((service: HomeServiceRow): ExtendedService => ({
          ...service,
          serviceType: 'home' as const,
          displayCategory: 'Home Services',
          searchScore: calculateSearchScore(service.title, lowercaseQuery)
        }))
      ];

      // Sort by search score (higher is better)
      const sortedResults = allResults.sort((a, b) => b.searchScore - a.searchScore);

      setSearchResults(sortedResults);

      // Track search analytics
      analytics.trackSearch(query, sortedResults.length, {
        has_results: sortedResults.length > 0,
        result_categories: [...new Set(sortedResults.map(r => r.serviceType))]
      });
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
      // Track failed search
      analytics.trackSearch(query, 0, { error: true });
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Enhanced search scoring with fuzzy matching
  const calculateSearchScore = (title: string, query: string): number => {
    const titleLower = title.toLowerCase();
    const queryLower = query.toLowerCase();

    // Exact match gets highest score
    if (titleLower === queryLower) return 100;

    // Starts with query gets high score
    if (titleLower.startsWith(queryLower)) return 90;

    // Word boundary match gets high score
    const words = titleLower.split(/\s+/);
    const queryWords = queryLower.split(/\s+/);
    const exactWordMatches = queryWords.filter(qw =>
      words.some(w => w === qw)
    ).length;

    if (exactWordMatches > 0) {
      return 80 + (exactWordMatches / queryWords.length) * 10;
    }

    // Contains query gets medium score
    if (titleLower.includes(queryLower)) return 70;

    // Fuzzy matching for partial words
    const fuzzyMatches = queryWords.filter(qw =>
      words.some(w => w.includes(qw) || qw.includes(w))
    ).length;

    if (fuzzyMatches > 0) {
      return 50 + (fuzzyMatches / queryWords.length) * 20;
    }

    // Character-level fuzzy matching
    const charMatches = queryLower.split('').filter(char =>
      titleLower.includes(char)
    ).length;

    if (charMatches > 0) {
      return 20 + (charMatches / queryLower.length) * 30;
    }

    return 0;
  };

  // Add to search history
  const addToSearchHistory = useCallback(async (query: string) => {
    if (!query.trim()) return;

    try {
      const trimmedQuery = query.trim();
      const newHistory = [trimmedQuery, ...searchHistory.filter(item => item !== trimmedQuery)].slice(0, 10);
      setSearchHistory(newHistory);
      await AsyncStorage.setItem('search_history', JSON.stringify(newHistory));
    } catch (error) {
      console.error('Error saving search history:', error);
    }
  }, [searchHistory]);

  // Helper functions for service type styling
  const getServiceTypeColor = (serviceType: string): string => {
    switch (serviceType) {
      case 'automobile': return '#1E3A8A';
      case 'appliance': return '#DC2626';
      case 'home': return '#7C3AED';
      default: return '#6B7280';
    }
  };

  const getServiceTypeBackgroundColor = (serviceType: string): string => {
    switch (serviceType) {
      case 'automobile': return '#EFF6FF';
      case 'appliance': return '#FEF2F2';
      case 'home': return '#F3E8FF';
      default: return '#F3F4F6';
    }
  };

  const getServiceTypeIcon = (serviceType: string): any => {
    switch (serviceType) {
      case 'automobile': return 'car';
      case 'appliance': return 'construct';
      case 'home': return 'home';
      default: return 'help-circle';
    }
  };

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery.trim().length > 0) {
        performSearch(searchQuery);
      } else {
        setSearchResults([]);
        setIsSearching(false);
      }
    }, 200);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, performSearch]);

  // Enhanced search handlers
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (query.trim().length > 0) {
      setShowSuggestions(true);
      setShowSearchHistory(false);
    } else {
      setShowSuggestions(false);
      setSearchResults([]);
      setShowSearchHistory(true);
    }
  }, []);

  const handleSearchSubmit = useCallback(async () => {
    const q = searchQuery.trim();
    if (q.length === 0) return;

    setShowSuggestions(false);
    setShowSearchHistory(false);
    await addToSearchHistory(q);
    hapticSuccess();
  }, [searchQuery, addToSearchHistory]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
    setShowSuggestions(false);
    setShowSearchHistory(false);
    setIsSearching(false);
    setIsSearchFocused(false);
    setShowFullPageSearch(false);
    hapticButtonPress();
  }, []);

  const closeFullPageSearch = useCallback(() => {
    setShowFullPageSearch(false);
    setShowSuggestions(false);
    setShowSearchHistory(false);
    setIsSearchFocused(false);
    Keyboard.dismiss();
  }, []);

  // Handle search suggestion selection
  const handleSuggestionSelect = useCallback((suggestion: string) => {
    setSearchQuery(suggestion);
    setShowSuggestions(false);
    setShowSearchHistory(false);
    performSearch(suggestion);
    addToSearchHistory(suggestion);
  }, [performSearch, addToSearchHistory]);

  // Handle search history selection
  const handleHistorySelect = useCallback((historyItem: string) => {
    setSearchQuery(historyItem);
    setShowSearchHistory(false);
    performSearch(historyItem);
  }, [performSearch]);

  // Clear search history
  const clearSearchHistory = useCallback(async () => {
    try {
      setSearchHistory([]);
      await AsyncStorage.removeItem('search_history');
      hapticButtonPress();
    } catch (error) {
      console.error('Error clearing search history:', error);
    }
  }, []);

  // Filter search results by service type
  const filteredSearchResults = useMemo(() => {
    if (selectedFilter === 'All') return searchResults;
    return searchResults.filter(service => service.displayCategory === selectedFilter);
  }, [searchResults, selectedFilter]);

  const handleServicePress = useCallback((service: ExtendedService) => {
    hapticButtonPress();

    // Navigate based on service type
    switch (service.serviceType) {
      case 'automobile':
        router.push('/subcategories/automobiles');
        break;
      case 'appliance':
        router.push('/subcategories/appliances');
        break;
      case 'home':
        router.push('/subcategories/homeservice');
        break;
      default:
        break;
    }
  }, [router]);

  const { location, setLocation, address, setAddress } = useUser();
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [pendingLocation, setPendingLocation] = useState<string>('');
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [mapRegion, setMapRegion] = useState({
    latitude: address?.latitude || 12.9716,
    longitude: address?.longitude || 77.5946,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });
  const [isDragging, setIsDragging] = useState(false);

  // Update map region when modal opens
  useEffect(() => {
    if (showLocationModal && address?.latitude && address?.longitude) {
      setMapRegion({
        latitude: address.latitude,
        longitude: address.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  }, [showLocationModal, address]);


  const handleUseCurrentLocation = useCallback(async () => {
    try {
      setIsFetchingLocation(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Location permission is needed to get your current location.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
      const { latitude, longitude } = position.coords;

      setMapRegion({
        latitude,
        longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      });

      const geocodes = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (geocodes && geocodes.length > 0) {
        const g: any = geocodes[0];
        const streetLine = `${g.street || ''} ${g.streetNumber || ''}`.trim();
        const primary = g.district || g.subregion || g.neighborhood || streetLine;
        const city = g.city || g.subregion || g.district || '';
        const label = [primary, city].filter(Boolean).join(', ');

        const addr = {
          label,
          streetLine: streetLine || undefined,
          area: primary || undefined,
          city: city || undefined,
          postalCode: g.postalCode || g.postal_code || undefined,
          latitude,
          longitude,
          fullText: [streetLine, primary, city, g.region, g.postalCode].filter(Boolean).join(', '),
        } as any;

        setPendingLocation(label);
        // We don't automatically save and close now, we let user see it on map
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to get current location.');
    } finally {
      setIsFetchingLocation(false);
    }
  }, []);

  const handleMapPress = async (event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    setMapRegion(prev => ({ ...prev, latitude, longitude }));

    try {
      const geocodes = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (geocodes && geocodes.length > 0) {
        const g: any = geocodes[0];
        const primary = g.district || g.subregion || g.neighborhood || g.street || 'Selected Location';
        const city = g.city || g.subregion || g.district || '';
        const label = [primary, city].filter(Boolean).join(', ');
        setPendingLocation(label);
      }
    } catch (e) {
      console.log('Error reverse geocoding');
    }
  };

  const handleMarkerDragEnd = async (event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    setMapRegion(prev => ({ ...prev, latitude, longitude }));

    try {
      const geocodes = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (geocodes && geocodes.length > 0) {
        const g: any = geocodes[0];
        const primary = g.district || g.subregion || g.neighborhood || g.street || 'Selected Location';
        const city = g.city || g.subregion || g.district || '';
        const label = [primary, city].filter(Boolean).join(', ');
        setPendingLocation(label);
      }
    } catch (e) {
      console.log('Error reverse geocoding');
    }
  };

  const saveSelectedLocation = async () => {
    try {
      setIsFetchingLocation(true);
      const geocodes = await Location.reverseGeocodeAsync({
        latitude: mapRegion.latitude,
        longitude: mapRegion.longitude,
      });

      let finalAddr: any;
      if (geocodes && geocodes.length > 0) {
        const g: any = geocodes[0];
        const streetLine = `${g.street || ''} ${g.streetNumber || ''}`.trim();
        const primary = g.district || g.subregion || g.neighborhood || streetLine;
        const city = g.city || g.subregion || g.district || '';
        const label = [primary, city].filter(Boolean).join(', ');

        finalAddr = {
          label,
          streetLine: streetLine || undefined,
          area: primary || undefined,
          city: city || undefined,
          postalCode: g.postalCode || g.postal_code || undefined,
          latitude: mapRegion.latitude,
          longitude: mapRegion.longitude,
          fullText: [streetLine, primary, city, g.region, g.postalCode].filter(Boolean).join(', '),
        };
      } else {
        finalAddr = {
          label: pendingLocation || 'Selected Location',
          latitude: mapRegion.latitude,
          longitude: mapRegion.longitude,
        };
      }

      await setAddress(finalAddr);
      await setLocation(finalAddr.label);
      setShowLocationModal(false);
      hapticSuccess();
    } catch (e) {
      Alert.alert('Error', 'Failed to save location.');
    } finally {
      setIsFetchingLocation(false);
    }
  };

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={colors.secondary} translucent />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Main Header with Profile, Search and Services */}
        <LinearGradient
          colors={[colors.secondary, colors.secondaryDark]}
          style={styles.completeHeader}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        >
          {/* Animated Profile Section */}
          <Animated.View
            style={[
              styles.profileSection,
              {
                opacity: showTopSection ? 1 : 0,
                height: showTopSection ? 60 : 0,
                transform: [
                  {
                    translateY: showTopSection ? 0 : -20,
                  },
                ],
              },
            ]}
          >
            {/* Top Row - Location, Toggle, and Profile */}
            <View style={styles.headerTopRow}>
              <View style={styles.locationSection}>
                <TouchableOpacity
                  style={styles.locationRow}
                  activeOpacity={0.8}
                  onPress={() => {
                    hapticButtonPress();
                    setShowLocationModal(true);
                  }}
                >
                  <Ionicons name="location" size={16} color="#FFFFFF" />
                  <View style={styles.locationTextContainer}>

                    <Text style={styles.locationArea} numberOfLines={1}>
                      {[
                        address?.streetLine,
                        address?.area,
                        address?.city,
                        address?.postalCode,
                      ].filter(Boolean).join(', ') || (location as string)}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>




            </View>
          </Animated.View>

          {/* Search Bar - Always Visible */}
          <TouchableOpacity
            style={[styles.swiggySearchBar, { backgroundColor: colors.surface }]}
            onPress={() => {
              hapticButtonPress();
              setShowFullPageSearch(true);
              setShowSuggestions(true);
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="search" size={20} color={colors.textTertiary} style={{ marginLeft: 16 }} />
            <Text style={[styles.swiggySearchButtonText, { color: colors.textSecondary }]}>
              Search services...
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} style={{ marginRight: 16 }} />
          </TouchableOpacity>

          {/* Our Services inside header - Always Visible */}
          <View style={styles.headerServicesSection}>
            <View style={styles.headerServicesGrid}>
              {servicesData(colors).map((service) => (
                <TouchableOpacity
                  key={service.id}
                  style={styles.headerServiceItem}
                  onPress={() => {
                    hapticButtonPress();
                    // Track service view
                    const serviceType = service.title.toLowerCase().replace(' ', '_');
                    analytics.trackServiceView(serviceType, service.id, {
                      service_name: service.title,
                      source: 'services_screen'
                    });

                    if (service.title === 'Real Estate') {
                      setShowRealEstateSheet(true);
                      analytics.trackServiceSelect('real_estate', service.id, { service_name: 'Real Estate' });
                    } else if (service.title === 'Automobile') {
                      setShowAutoSheet(true);
                      analytics.trackServiceSelect('automobile', service.id, { service_name: 'Automobile' });
                    } else if (service.title === 'Appliances') {
                      setShowApplianceSheet(true);
                      analytics.trackServiceSelect('appliances', service.id, { service_name: 'Appliances' });
                    } else if (service.title === 'Home') {
                      setShowHomeSheet(true);
                      analytics.trackServiceSelect('home', service.id, { service_name: 'Home' });
                    }
                    hapticSuccess();
                  }}
                >
                  <View style={[styles.headerServiceIconCard, { backgroundColor: service.color, borderColor: colors.border }]}>
                    <Ionicons name={service.icon as any} size={24} color={service.iconColor} />
                  </View>
                  <Text style={styles.headerServiceItemLabel}>{service.title}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </LinearGradient>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { backgroundColor: colors.background }]}
          onScroll={scrollListener}
          scrollEventThrottle={32}
          style={[styles.scrollView, { backgroundColor: colors.background }]}
          removeClippedSubviews={true}
        >
          {/* Enhanced Banner Carousel */}
          <BannerCarousel
            banners={bannerImages.map(banner => ({
              id: banner.id,
              image: banner.image,
            }))}
            showPagination={true}
            enableLazyLoading={false}
            onBannerPress={(banner) => {
              const baseId = banner.id.split('-')[0];
              hapticButtonPress();
              try {
                let serviceType = '';
                if (baseId === '1') {
                  // Real Estate
                  serviceType = 'real_estate';
                  router.push('/subcategories/realestate');
                } else if (baseId === '2') {
                  // Automobile
                  serviceType = 'automobile';
                  router.push('/subcategories/automobiles');
                } else if (baseId === '3') {
                  // Home Service
                  serviceType = 'home';
                  router.push('/subcategories/homeservice');
                } else if (baseId === '4') {
                  // Appliances
                  serviceType = 'appliances';
                  router.push('/subcategories/appliances');
                } else if (baseId === '5') {
                  // Acting Drivers
                  serviceType = 'acting-drivers';
                  router.push('/subcategories/acting-drivers');
                }
                // Track banner click
                if (serviceType) {
                  analytics.trackInteraction('banner_click', 'services', banner.id, {
                    service_type: serviceType,
                    banner_id: banner.id
                  });
                  analytics.trackServiceSelect(serviceType, banner.id, { source: 'banner' });
                }
              } finally {
                hapticSuccess();
              }
            }}
          />


          {/* Appliance Repair & Service Section */}
          <View style={[styles.applianceSection, { backgroundColor: colors.background }]}>
            <View style={styles.sectionHeaderWithLines}>
              <View style={[styles.headerLine, { backgroundColor: colors.divider }]} />
              <Text style={[styles.sectionTitleWithLines, { color: colors.text }]}>Appliance repair & service</Text>
              <View style={[styles.headerLine, { backgroundColor: colors.divider }]} />
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.applianceContainer}
            >
              {[
                {
                  id: '1',
                  title: 'AC',
                  image: require('../../assets/images/ac_card.png'),
                  category: 'Appliance',
                  section: 'AC Repair & Services'
                },
                {
                  id: '2',
                  title: 'Washing Machine',
                  image: require('../../assets/images/wash_card.png'),
                  category: 'Appliance',
                  section: 'Washing Machine Repair'
                },
                {
                  id: '3',
                  title: 'Water Purifier',
                  image: require('../../assets/images/filter_card.png'),
                  category: 'Appliance',
                  section: 'Water Purifier & Services'
                },
                {
                  id: '4',
                  title: 'Refrigerator',
                  image: require('../../assets/images/fridge_card.jpg'),
                  category: 'Appliance',
                  section: 'Refrigerator Repair & Services'
                },
                {
                  id: '5',
                  title: 'Microwave',
                  image: require('../../assets/images/oven_card.png'),
                  category: 'Appliance',
                  section: 'Microwave Repair & Services'
                },
              ].map((appliance) => (
                <TouchableOpacity
                  key={appliance.id}
                  style={[styles.applianceCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  activeOpacity={0.8}
                  onPress={() => {
                    hapticButtonPress();
                    router.push({
                      pathname: '/subcategories/appliances',
                      params: { section: appliance.section }
                    });
                    hapticSuccess();
                  }}
                >
                  <Image source={appliance.image} style={styles.applianceImage} resizeMode="cover" />
                  <GlobalText style={styles.applianceTitle}>
                    {appliance.title}
                  </GlobalText>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Service Categories Section */}
          <View style={[styles.whatLookingForSection, { backgroundColor: colors.background }]}>
            <View style={styles.whatLookingForHeader}>
              <View style={[styles.headerLine, { backgroundColor: colors.divider }]} />
              <Text style={[styles.whatLookingForTitle, { color: colors.text }]}>WHAT ARE YOU LOOKING FOR?</Text>
              <View style={[styles.headerLine, { backgroundColor: colors.divider }]} />
            </View>

            <View style={styles.serviceCategoriesGrid}>
              {[
                {
                  id: '1',
                  title: 'Automobile',
                  image: require('../../assets/images/bike_card.png'),
                  category: 'Automobile',
                  section: 'Bike General Maintenance & Repairs',
                },
                {
                  id: '2',
                  title: 'Appliances',
                  image: require('../../assets/images/wash_card.png'),
                  category: 'Appliance',
                  section: 'Washing Machine Repair',
                },
                {
                  id: '3',
                  title: 'Home Decor',
                  image: require('../../assets/images/home_card.png'),
                  category: 'Home',
                  section: 'Painting & Renovation',
                },
                {
                  id: '4',
                  title: 'Acting Drivers',
                  image: require('../../assets/images/actingdriver_card.jpg'),
                  category: 'Automobile',
                  section: 'Personal & Trip-based Services',
                },
                {
                  id: '5',
                  title: 'Pet Care',
                  image: require('../../assets/images/petcare_card.png'),
                  category: 'Home',
                  section: 'Pet Grooming',
                },
                {
                  id: '6',
                  title: 'Real Estate',
                  image: require('../../assets/images/realestate_card.png'),
                  category: 'Real Estate',
                  section: 'Property Types',
                },
              ].map((category) => (
                <TouchableOpacity
                  key={category.id}
                  style={[styles.serviceCategoryCard]}
                  activeOpacity={0.8}
                  onPress={() => {
                    hapticButtonPress();
                    try {
                      if (category.category === 'Automobile') {
                        router.push({ pathname: '/subcategories/automobiles', params: { section: category.section || '' } });
                      } else if (category.category === 'Appliance') {
                        router.push({ pathname: '/subcategories/appliances', params: { section: category.section || '' } });
                      } else if (category.category === 'Home') {
                        router.push({ pathname: '/subcategories/homeservice', params: { section: category.section || '' } });
                      } else if (category.category === 'Real Estate') {
                        router.push('/subcategories/realestate');
                      }
                    } finally {
                      hapticSuccess();
                    }
                  }}
                >
                  <Image source={category.image} style={styles.serviceCategoryImage} resizeMode="cover" />
                  <GlobalText style={styles.serviceCategoryTitle}>
                    {category.title}
                  </GlobalText>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Salon Services Section */}
          <View style={[styles.homeServiceSection, { backgroundColor: colors.background }]}>
            <View style={styles.sectionHeaderWithLines}>
              <View style={[styles.headerLine, { backgroundColor: colors.divider }]} />
              <Text style={[styles.sectionTitleWithLines, { color: colors.text }]}>Salon services</Text>
              <View style={[styles.headerLine, { backgroundColor: colors.divider }]} />
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.homeServiceContainer}
            >
              {[
                {
                  id: 's1',
                  title: 'Haircut',
                  image: require('../../assets/images/mshaircut.png'),
                  category: 'Home Services',
                  section: "Men’s Salon",
                },
                {
                  id: 's2',
                  title: 'Beard Grooming',
                  image: require('../../assets/images/msbeard.webp'),
                  category: 'Home Services',
                  section: "Men’s Salon",
                },
                {
                  id: 's3',
                  title: 'Facial',
                  image: require('../../assets/images/msfacial.webp'),
                  category: 'Home Services',
                  section: "Men’s Salon",
                },
                {
                  id: 's4',
                  title: 'Hair Spa',
                  image: require('../../assets/images/uxhairspa.webp'),
                  category: 'Home Services',
                  section: "Unisex & Spa",
                },
                {
                  id: 's5',
                  title: 'Waxing',
                  image: require('../../assets/images/wswax.webp'),
                  category: 'Home Services',
                  section: "Women’s Salon",
                },
              ].map((service) => (
                <TouchableOpacity
                  key={service.id}
                  style={[styles.homeServiceCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  activeOpacity={0.8}
                  onPress={() => {
                    hapticButtonPress();
                    router.push({
                      pathname: '/subcategories/homeservice',
                      params: { section: service.section }
                    });
                    hapticSuccess();
                  }}
                >
                  <Image source={service.image} style={styles.homeServiceImage} resizeMode="cover" />
                  <View style={styles.cardTitleContainer}>
                    <Text style={[styles.cardTitle, { color: isDark ? '#000000' : colors.text }]}>{service.title}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Promotional Banner Section */}
          <View style={[styles.promoSection, { backgroundColor: colors.background }]}>

            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => {
                hapticButtonPress();
                router.push('/subcategories/realestate');
                hapticSuccess();
              }}
              style={{ paddingHorizontal: 15 }}
            >
              <LinearGradient
                colors={[isDark ? '#9B2C2C' : '#C0392B', isDark ? '#B33A3A' : '#D35454']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.promoCard}
              >
                <View style={styles.promoTextContainer}>
                  <Text style={styles.promoTitle}>Get flat Offers on your dream home</Text>
                  <Text style={styles.promoSubtitle}>Where trust meets properties</Text>

                </View>
                <Image
                  source={require('../../assets/images/banner_realestate.png')}
                  style={styles.promoImage}
                  resizeMode="cover"
                />
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Real Estate Services Section */}
          <View style={[styles.homeServiceSection, { backgroundColor: colors.background }]}>
            <View style={styles.sectionHeaderWithLines}>
              <View style={[styles.headerLine, { backgroundColor: colors.divider }]} />
              <Text style={[styles.sectionTitleWithLines, { color: colors.text }]}>Real Estate Services</Text>
              <View style={[styles.headerLine, { backgroundColor: colors.divider }]} />
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.homeServiceContainer}
            >
              {[
                {
                  id: 're1',
                  title: 'Residential',
                  image: require('../../assets/images/residetial.webp'),
                  category: 'Real Estate',
                  section: 'Residential Properties',
                  isParking: false,
                },
                {
                  id: 're2',
                  title: 'Commercial',
                  image: require('../../assets/images/commercial.png'),
                  category: 'Real Estate',
                  section: 'Commercial Properties',
                  isParking: false,
                },
                {
                  id: 're3',
                  title: 'Industrial',
                  image: require('../../assets/images/industrial.webp'),
                  category: 'Real Estate',
                  section: 'Industrial Properties',
                  isParking: false,
                },
                {
                  id: 're4',
                  title: 'Land & Plots',
                  image: require('../../assets/images/land&plots.png'),
                  category: 'Real Estate',
                  section: 'Land & Plots',
                  isParking: false,
                },
                {
                  id: 're5',
                  title: 'PG',
                  image: require('../../assets/images/pg.png'),
                  category: 'Real Estate',
                  section: 'PG Accommodations',
                  isParking: false,
                },
                {
                  id: 're6',
                  title: 'Car/Bike Parking',
                  image: require('../../assets/images/carparking_rental.jpg'),
                  category: 'Real Estate',
                  section: 'Car/Bike Parking',
                  isParking: true,
                },
                {
                  id: 're7',
                  title: 'Post a Property',
                  image: require('../../assets/images/post_a_property.jpg'),
                  category: 'Real Estate',
                  section: 'Post a Property',
                  isParking: false,
                },
                {
                  id: 're8',
                  title: 'Car Parking Rental',
                  image: require('../../assets/images/carparking_rental.jpg'),
                  category: 'Real Estate',
                  section: 'Car Parking Rental',
                  isParking: false,
                },
              ].map((service) => (
                <TouchableOpacity
                  key={service.id}
                  style={[styles.homeServiceCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  activeOpacity={0.8}
                  onPress={() => {
                    hapticButtonPress();
                    if (service.isParking) {
                      router.push('/realestate/parking-rentals-list');
                    } else if (service.title === 'Post a Property') {
                      router.push('/realestate/person');
                    } else if (service.title === 'Car Parking Rental') {
                      router.push('/realestate/car-parking-rental');
                    } else {
                      router.push({
                        pathname: '/subcategories/realestate',
                        params: { section: service.section }
                      });
                    }
                    hapticSuccess();
                  }}
                >
                  <Image source={service.image} style={styles.homeServiceImage} resizeMode="cover" />
                  <View style={styles.cardTitleContainer}>
                    <Text style={[styles.cardTitle, { color: isDark ? '#000000' : colors.text }]}>{service.title}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Home Service and Repair Section */}
          <View style={[styles.homeServiceSection, { backgroundColor: colors.background }]}>
            <View style={styles.sectionHeaderWithLines}>
              <View style={[styles.headerLine, { backgroundColor: colors.divider }]} />
              <Text style={[styles.sectionTitleWithLines, { color: colors.text }]}>Home service and repair</Text>
              <View style={[styles.headerLine, { backgroundColor: colors.divider }]} />
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.homeServiceContainer}
            >
              {[
                {
                  id: '1',
                  title: 'Electrical',
                  image: require('../../assets/images/uielectrical.png'),
                  category: 'Home Services',
                  section: 'Electrical Services',
                },
                {
                  id: '2',
                  title: 'Plumbing',
                  image: require('../../assets/images/uiplumbing.png'),
                  category: 'Home Services',
                  section: 'Plumbing Services',
                },
                {
                  id: '3',
                  title: 'Carpentry',
                  image: require('../../assets/images/uicarpentry.png'),
                  category: 'Home Services',
                  section: 'Carpentry Services',
                },
                {
                  id: '4',
                  title: 'Painting',
                  image: require('../../assets/images/uipainting.png'),
                  category: 'Home Services',
                  section: 'Painting & Renovation',
                },
                {
                  id: '5',
                  title: 'Cleaning',
                  image: require('../../assets/images/uipest.png'),
                  category: 'Home Services',
                  section: 'Cleaning & Pest Control',
                },
              ].map((service) => (
                <TouchableOpacity
                  key={service.id}
                  style={[styles.homeServiceCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  activeOpacity={0.8}
                  onPress={() => {
                    hapticButtonPress();
                    router.push({
                      pathname: '/subcategories/homeservice',
                      params: { section: service.section }
                    });
                    hapticSuccess();
                  }}
                >
                  <Image source={service.image} style={styles.homeServiceImage} resizeMode="cover" />
                  <View style={styles.cardTitleContainer}>
                    <Text style={[styles.cardTitle, { color: isDark ? '#000000' : colors.text }]}>{service.title}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Acting Driver Banner */}
          <View style={{ paddingHorizontal: 15, marginTop: 10, marginBottom: 20 }}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => {
                hapticButtonPress();
                router.push('/subcategories/acting-drivers');
                hapticSuccess();
              }}
            >
              <Image
                source={require('../../assets/images/acting_driver_banner.webp')}
                style={{ width: '100%', height: 160, borderRadius: 16 }}
                resizeMode="cover"
              />
            </TouchableOpacity>
          </View>



        </ScrollView>
      </View>

      {/* Automobile picker bottom sheet */}
      <Modal visible={showAutoSheet} animationType="slide" transparent onRequestClose={() => setShowAutoSheet(false)}>
        <View style={[styles.sheetBackdrop, { backgroundColor: colors.overlay }]}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowAutoSheet(false)} />
          <View style={[styles.sheetContainer, { backgroundColor: colors.surface }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Automobile</Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Car Repair Services */}
              <View style={styles.serviceSection}>
                <Text style={[styles.mainHeading, { color: colors.text }]}>🚗 Car Repair Services</Text>
                <View style={styles.cardsGrid}>
                  {[
                    { title: 'Car General Maintenance & Repairs', image: require('../../assets/images/cargmr.png'), section: 'Car General Maintenance & Repairs' },
                    { title: 'Car Engine & Electronic Services', image: require('../../assets/images/carees.png'), section: 'Car Engine & Electronic Services' },
                    { title: 'Car Body & Paint Work', image: require('../../assets/images/carbpw.png'), section: 'Car Body & Paint Work' },
                    { title: 'Car Tires & Wheels', image: require('../../assets/images/cartw.png'), section: 'Car Tires & Wheels' },
                    { title: 'Car Detailing & Cleaning', image: require('../../assets/images/cardc.png'), section: 'Car Detailing & Cleaning' },
                  ].map(tile => (
                    <TouchableOpacity
                      key={`car-${tile.title}`}
                      style={[styles.serviceCard, { backgroundColor: colors.card }]}
                      activeOpacity={0.9}
                      onPress={() => {
                        setShowAutoSheet(false);
                        router.push({ pathname: '../subcategories/automobiles', params: { section: tile.section } });
                      }}
                    >
                      <Img source={tile.image} style={styles.serviceCardImage} contentFit="cover" transition={150} cachePolicy="memory-disk" />
                      <Text style={[styles.serviceCardTitle, { color: colors.text }]}>{tile.title}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Bike Repair Services */}
              <View style={styles.serviceSection}>
                <Text style={[styles.mainHeading, { color: colors.text }]}>🏍 Bike Repair Services</Text>
                <View style={styles.cardsGrid}>
                  {[
                    { title: 'Bike General Maintenance & Repairs', image: require('../../assets/images/bikegmr.png'), section: 'Bike General Maintenance & Repairs' },
                    { title: 'Bike Engine & Electronic Services', image: require('../../assets/images/bikeees.png'), section: 'Bike Engine & Electronic Services' },
                    { title: 'Bike Tires & Wheels', image: require('../../assets/images/biketw.png'), section: 'Bike Tires & Wheels' },
                    { title: 'Bike Detailing & Cleaning', image: require('../../assets/images/bikedc.png'), section: 'Bike Detailing & Cleaning' },
                  ].map(tile => (
                    <TouchableOpacity
                      key={`bike-${tile.title}`}
                      style={[styles.serviceCard, { backgroundColor: colors.card }]}
                      activeOpacity={0.9}
                      onPress={() => {
                        setShowAutoSheet(false);
                        router.push({ pathname: '../subcategories/automobiles', params: { section: tile.section } });
                      }}
                    >
                      <Image source={tile.image} style={styles.serviceCardImage} />
                      <Text style={[styles.serviceCardTitle, { color: colors.text }]}>{tile.title}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Acting Drivers */}
              <View style={styles.serviceSection}>
                <Text style={[styles.mainHeading, { color: colors.text }]}>🚗 Acting Drivers Services</Text>
                <View style={styles.cardsGrid}>
                  <TouchableOpacity
                    key={`drivers-all`}
                    style={[styles.serviceCard, { backgroundColor: colors.card }]}
                    activeOpacity={0.9}
                    onPress={() => {
                      setShowAutoSheet(false);
                      router.push('../subcategories/acting-drivers');
                    }}
                  >
                    <Image source={require('../../assets/images/actingdriver.png')} style={styles.serviceCardImage} />
                    <Text style={[styles.serviceCardTitle, { color: colors.text }]}>Personal & Trip-based Services</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Appliance picker bottom sheet */}
      <Modal visible={showApplianceSheet} animationType="slide" transparent onRequestClose={() => setShowApplianceSheet(false)}>
        <View style={[styles.sheetBackdrop, { backgroundColor: colors.overlay }]}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowApplianceSheet(false)} />
          <View style={[styles.sheetContainer, { backgroundColor: colors.surface }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Appliances</Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Kitchen Appliances */}
              <View style={styles.serviceSection}>
                <Text style={[styles.mainHeading, { color: colors.text }]}>Kitchen Appliances</Text>
                <View style={styles.cardsGrid}>
                  {[
                    { title: 'Stove', image: require('../../assets/images/stove.webp'), section: 'Gas Stove & Hob Services' },
                    { title: 'Chimney', image: require('../../assets/images/chimney.png'), section: 'Chimney Repair & Services' },
                    { title: 'Dishwasher', image: require('../../assets/images/Dishwasher.webp'), section: 'Dishwasher Repair & Services' },
                    { title: 'Microwave', image: require('../../assets/images/microwave.png'), section: 'Microwave Repair & Services' },
                    { title: 'Refrigerator', image: require('../../assets/images/fridge.webp'), section: 'Refrigerator Repair & Services' },
                    { title: 'Water Purifier', image: require('../../assets/images/waterpurifier.png'), section: 'Water Purifier & Services' },
                  ].map(tile => (
                    <TouchableOpacity
                      key={`kitchen-${tile.title}`}
                      style={[styles.serviceCard, { backgroundColor: colors.card }]}
                      activeOpacity={0.9}
                      onPress={() => {
                        setShowApplianceSheet(false);
                        router.push({ pathname: '../subcategories/appliances', params: { section: tile.section } });
                      }}
                    >
                      <Image source={tile.image} style={styles.serviceCardImage} />
                      <Text style={[styles.serviceCardTitle, { color: colors.text }]}>{tile.title}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Home Appliances */}
              <View style={styles.serviceSection}>
                <Text style={[styles.mainHeading, { color: colors.text }]}>Home Appliances</Text>
                <View style={styles.cardsGrid}>
                  {[
                    { title: 'AC', image: require('../../assets/images/ac.png'), section: 'AC Repair & Services' },
                    { title: 'Geyser', image: require('../../assets/images/geyser.webp'), section: 'Geyser Repair & Services' },
                    { title: 'Water Cooler Service', image: require('../../assets/images/watercooler.webp'), section: 'Water Cooler Repair & Services' },
                    { title: 'Washing Machine', image: require('../../assets/images/washmish.webp'), section: 'Washing Machine Repair' },
                    { title: 'Fan', image: require('../../assets/images/fan.webp'), section: 'Fan Repair & Services' },
                  ].map(tile => (
                    <TouchableOpacity
                      key={`home-${tile.title}`}
                      style={[styles.serviceCard, { backgroundColor: colors.card }]}
                      activeOpacity={0.9}
                      onPress={() => {
                        setShowApplianceSheet(false);
                        router.push({ pathname: '../subcategories/appliances', params: { section: tile.section } });
                      }}
                    >
                      <Image source={tile.image} style={styles.serviceCardImage} />
                      <Text style={[styles.serviceCardTitle, { color: colors.text }]}>{tile.title}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Home Electronics */}
              <View style={styles.serviceSection}>
                <Text style={[styles.mainHeading, { color: colors.text }]}>Home Electronics</Text>
                <View style={styles.cardsGrid}>
                  {[
                    { title: 'Television', image: require('../../assets/images/tv.png'), section: 'Television Repair & Services' },
                    { title: 'Speakers', image: require('../../assets/images/speakers.webp'), section: 'Speaker Repair & Services' },
                    { title: 'Inverter & UPS Service', image: require('../../assets/images/inverter.webp'), section: 'Inverter & UPS Repair & Services' },
                    { title: 'Laptop/PC', image: require('../../assets/images/laptop.png'), section: 'Laptop & PC Repair & Services' },
                  ].map(tile => (
                    <TouchableOpacity
                      key={`electronics-${tile.title}`}
                      style={[styles.serviceCard, { backgroundColor: colors.card }]}
                      activeOpacity={0.9}
                      onPress={() => {
                        setShowApplianceSheet(false);
                        router.push({ pathname: '../subcategories/appliances', params: { section: tile.section } });
                      }}
                    >
                      <Image source={tile.image} style={styles.serviceCardImage} />
                      <Text style={[styles.serviceCardTitle, { color: colors.text }]}>{tile.title}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Home picker bottom sheet (cards like Appliances) */}
      <Modal visible={showHomeSheet} animationType="slide" transparent onRequestClose={() => setShowHomeSheet(false)}>
        <View style={[styles.sheetBackdrop, { backgroundColor: colors.overlay }]}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowHomeSheet(false)} />
          <View style={[styles.sheetContainer, { backgroundColor: colors.surface }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Home</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Home Services */}
              <View style={styles.serviceSection}>
                <Text style={[styles.mainHeading, { color: colors.text }]}>Home Services</Text>
                <View style={styles.cardsGrid}>
                  {[
                    { title: 'Cleaning & Pest Control', image: require('../../assets/images/uipest.png'), section: 'Cleaning & Pest Control' },
                    { title: 'Plumbing Services', image: require('../../assets/images/uiplumbing.png'), section: 'Plumbing Services' },
                    { title: 'Electrical Services', image: require('../../assets/images/uielectrical.png'), section: 'Electrical Services' },
                    { title: 'Carpentry Services', image: require('../../assets/images/uicarpentry.png'), section: 'Carpentry Services' },
                    { title: 'Painting & Renovation', image: require('../../assets/images/uipainting.png'), section: 'Painting & Renovation' },
                  ].map(tile => (
                    <TouchableOpacity
                      key={`home-${tile.title}`}
                      style={[styles.serviceCard, { backgroundColor: colors.card }]}
                      activeOpacity={0.9}
                      onPress={() => {
                        setShowHomeSheet(false);
                        router.push({ pathname: '../subcategories/homeservice', params: { section: tile.section } });
                      }}
                    >
                      <Image source={tile.image} style={styles.serviceCardImage} />
                      <Text style={[styles.serviceCardTitle, { color: colors.text }]}>{tile.title}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Salon Services */}
              <View style={styles.serviceSection}>
                <Text style={[styles.mainHeading, { color: colors.text }]}>Salon Services</Text>
                <View style={styles.cardsGrid}>
                  {[
                    { title: 'Women’s Salon', image: require('../../assets/images/womenhairsalon.png'), section: 'Women’s Salon' },
                    { title: 'Men’s Salon', image: require('../../assets/images/mshaircut.png'), section: 'Men’s Salon' },
                    { title: 'Unisex & Spa', image: require('../../assets/images/unisexsalonservices.webp'), section: 'Unisex & Spa' },
                  ].map(tile => (
                    <TouchableOpacity
                      key={`salon-${tile.title}`}
                      style={[styles.serviceCard, { backgroundColor: colors.card }]}
                      activeOpacity={0.9}
                      onPress={() => {
                        setShowHomeSheet(false);
                        router.push({ pathname: '../subcategories/homeservice', params: { section: tile.section } });
                      }}
                    >
                      <Image source={tile.image} style={styles.serviceCardImage} />
                      <Text style={[styles.serviceCardTitle, { color: colors.text }]}>{tile.title}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Pet Care Services */}
              <View style={styles.serviceSection}>
                <Text style={[styles.mainHeading, { color: colors.text }]}>Pet Care Services</Text>
                <View style={styles.cardsGrid}>
                  {[
                    { title: 'Pet Grooming', image: require('../../assets/images/petgrooming.webp'), section: 'Pet Grooming' },
                    { title: 'Pet Health & Training', image: require('../../assets/images/PetHealth&Training.webp'), section: 'Pet Health & Training' },
                    { title: 'Pet Boarding & Sitting', image: require('../../assets/images/petboarding&sitting.webp'), section: 'Pet Boarding & Sitting' },
                  ].map(tile => (
                    <TouchableOpacity
                      key={`pet-${tile.title}`}
                      style={[styles.serviceCard, { backgroundColor: colors.card }]}
                      activeOpacity={0.9}
                      onPress={() => {
                        setShowHomeSheet(false);
                        router.push({ pathname: '../subcategories/homeservice', params: { section: tile.section } });
                      }}
                    >
                      <Image source={tile.image} style={styles.serviceCardImage} />
                      <Text style={[styles.serviceCardTitle, { color: colors.text }]}>{tile.title}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Real Estate picker bottom sheet */}
      <Modal visible={showRealEstateSheet} animationType="slide" transparent onRequestClose={() => setShowRealEstateSheet(false)}>
        <View style={[styles.sheetBackdrop, { backgroundColor: colors.overlay }]}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowRealEstateSheet(false)} />
          <View style={[styles.sheetContainer, { backgroundColor: colors.surface }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Real Estate</Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Property Type */}
              <View style={styles.serviceSection}>
                <Text style={[styles.mainHeading, { color: colors.text }]}>Property Type</Text>
                <View style={styles.cardsGrid}>
                  {[
                    { title: 'Residential', image: require('../../assets/images/residetial.webp'), section: 'Residential Properties', isParking: false },
                    { title: 'Commercial', image: require('../../assets/images/commercial.png'), section: 'Commercial Properties', isParking: false },
                    { title: 'Industrial', image: require('../../assets/images/industrial.webp'), section: 'Industrial Properties', isParking: false },
                    { title: 'Land & Plots', image: require('../../assets/images/land&plots.png'), section: 'Land & Plots', isParking: false },
                    { title: 'PG', image: require('../../assets/images/pg.png'), section: 'PG Accommodations', isParking: false },
                    { title: 'Car/Bike Parking', image: require('../../assets/images/carparking_rental.jpg'), section: 'Car/Bike Parking', isParking: true },

                  ].map(tile => (
                    <TouchableOpacity
                      key={`property-${tile.title}`}
                      style={[styles.serviceCard, { backgroundColor: colors.card }]}
                      activeOpacity={0.9}
                      onPress={() => {
                        setShowRealEstateSheet(false);
                        if (tile.isParking) {
                          router.push('../realestate/parking-rentals-list');
                        } else {
                          router.push({ pathname: '../subcategories/realestate', params: { section: tile.section } });
                        }
                      }}
                    >
                      <Image source={tile.image} style={styles.serviceCardImage} />
                      <Text style={[styles.serviceCardTitle, { color: colors.text }]}>{tile.title}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Post a Property - separate section */}
              <View style={styles.serviceSection}>
                <Text style={[styles.mainHeading, { color: colors.text }]}>Post a Property</Text>
                <View style={styles.cardsGrid}>
                  {[
                    { title: 'Post a Property', image: require('../../assets/images/post_a_property.jpg'), section: 'Post a Property' },
                    { title: 'Car Parking Rental', image: require('../../assets/images/carparking_rental.jpg'), section: 'Car Parking Rental' },
                  ].map(tile => (
                    <TouchableOpacity
                      key={`post-${tile.title}`}
                      style={[styles.serviceCard, { backgroundColor: colors.card }]}
                      activeOpacity={0.9}
                      onPress={() => {
                        setShowRealEstateSheet(false);
                        if (tile.title === 'Post a Property') {
                          router.push('/realestate/person');
                        } else if (tile.title === 'Car Parking Rental') {
                          router.push('/realestate/car-parking-rental');
                        }
                      }}
                    >
                      <Image source={tile.image} style={styles.serviceCardImage} />
                      <Text style={[styles.serviceCardTitle, { color: colors.text, fontWeight: '800' }]} numberOfLines={1} ellipsizeMode="tail">{tile.title}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Change Location Modal */}
      <Modal
        visible={showLocationModal}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowLocationModal(false)}
      >
        <View style={[styles.mapModalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.mapModalHeader, { backgroundColor: colors.surface }]}>
            <TouchableOpacity onPress={() => setShowLocationModal(false)} style={styles.mapCloseButton}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.mapModalTitle, { color: colors.text }]}>Set Your Location</Text>
            <View style={styles.mapHeaderSpacer} />
          </View>

          {/* Search Box on Map */}
          <View style={styles.mapQuickSearch}>
            <View style={[styles.locInputWrap, { backgroundColor: colors.surface, borderColor: colors.border, marginBottom: 0 }]}>
              <Ionicons name="search" size={18} color={colors.textTertiary} style={{ marginRight: 8 }} />
              <TextInput
                style={[styles.locInput, { color: colors.text }]}
                placeholder="Search area..."
                placeholderTextColor={colors.textTertiary}
                value={pendingLocation}
                onChangeText={setPendingLocation}
                autoFocus={false}
              />
              {pendingLocation.length > 0 && (
                <TouchableOpacity onPress={() => setPendingLocation('')}>
                  <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
                </TouchableOpacity>
              )}
            </View>

            {pendingLocation.trim().length > 0 && (
              <View style={[styles.locSuggestions, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 4 }]}>
                {locationSuggestions
                  .filter(s => s.toLowerCase().includes(pendingLocation.toLowerCase()))
                  .slice(0, 4)
                  .map((s, i) => (
                    <TouchableOpacity
                      key={i}
                      style={styles.locSuggestionItem}
                      onPress={async () => {
                        setPendingLocation(s);
                        // In a real app we'd geocode this name to get lat/lng
                        // For now we'll just set it
                      }}
                    >
                      <Ionicons name="pin" size={16} color={colors.textTertiary} style={{ marginRight: 8 }} />
                      <Text style={{ color: colors.text }}>{s}</Text>
                    </TouchableOpacity>
                  ))}
              </View>
            )}
          </View>

          <View style={styles.fullMapContainer}>
            <MapView
              provider={PROVIDER_GOOGLE}
              style={styles.fullMap}
              region={mapRegion}
              onPress={handleMapPress}
              showsUserLocation={true}
              showsMyLocationButton={true}
            >
              <Marker
                coordinate={{
                  latitude: mapRegion.latitude,
                  longitude: mapRegion.longitude,
                }}
                draggable
                onDragEnd={handleMarkerDragEnd}
              />
            </MapView>

            <TouchableOpacity
              style={[styles.myLocationBtn, { backgroundColor: colors.surface }]}
              onPress={handleUseCurrentLocation}
            >
              <Ionicons name="locate" size={24} color={colors.primary} />
            </TouchableOpacity>
          </View>

          <View style={[styles.mapModalFooter, { backgroundColor: colors.surface }]}>
            <View style={styles.selectedAddrInfo}>
              <Ionicons name="location" size={24} color={colors.primary} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.selectedAddrLabel, { color: colors.textTertiary }]}>SELECTED ADDRESS</Text>
                <Text style={[styles.selectedAddrText, { color: colors.text }]} numberOfLines={2}>
                  {pendingLocation || 'Tap on map or drag marker to set location'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.confirmLocBtn, { backgroundColor: colors.primary }, isFetchingLocation && { opacity: 0.7 }]}
              onPress={saveSelectedLocation}
              disabled={isFetchingLocation}
            >
              <Text style={styles.confirmLocBtnText}>
                {isFetchingLocation ? 'Processing...' : 'Confirm Location'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Full Page Search Modal */}
      <Modal
        visible={showFullPageSearch}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={closeFullPageSearch}
      >
        <View style={[styles.fullPageSearchContainer, { backgroundColor: colors.background }]}>
          <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />
          {/* Search Header */}
          <View style={[styles.fullPageSearchHeader, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={closeFullPageSearch}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
            <View style={[styles.fullPageSearchBar, { backgroundColor: colors.surface }]}>
              <Ionicons name="search" size={20} color={colors.textTertiary} style={{ marginLeft: 16 }} />
              <TextInput
                placeholder="Search services..."
                placeholderTextColor={colors.textTertiary}
                style={[styles.fullPageSearchInput, { color: colors.text }]}
                value={searchQuery}
                onChangeText={handleSearch}
                onSubmitEditing={handleSearchSubmit}
                returnKeyType="search"
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus={true}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
                  <Ionicons name="close-circle" size={20} color={colors.textTertiary} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Scrollable Content Container */}
          <ScrollView
            style={styles.fullPageSearchScrollContainer}
            contentContainerStyle={styles.fullPageSearchScrollContent}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
            scrollEnabled={true}
            bounces={true}
            indicatorStyle={Platform.OS === 'ios' ? 'black' : 'default'}
          >

            {/* Search Content */}
            {searchQuery.length === 0 && (
              <View style={[styles.searchModalContent, { backgroundColor: colors.background }]}>
                {/* Header Section */}
                <View style={styles.searchModalHeader}>
                  <View style={styles.searchModalIconContainer}>
                    <Ionicons name="bulb-outline" size={48} color={colors.textTertiary} />
                  </View>
                  <Text style={[styles.searchModalTitle, { color: colors.text }]}>Search across Automobile, Appliances & Home Services</Text>
                  <Text style={[styles.searchModalSubtitle, { color: colors.textSecondary }]}>Find car repair, AC service, plumbing & more</Text>
                </View>

                {/* Quick Actions */}
                <View style={styles.quickActionsContainer}>
                  <Text style={[styles.quickActionsTitle, { color: colors.text }]}>Quick Actions</Text>
                  <View style={styles.quickActionsGrid}>
                    <TouchableOpacity style={[styles.quickActionCard, { backgroundColor: colors.card }]} onPress={() => {
                      hapticButtonPress();
                      closeFullPageSearch();
                      router.push('/subcategories/automobiles');
                    }}>
                      <View style={[styles.quickActionIcon, { backgroundColor: colors.secondary }]}>
                        <Ionicons name="car" size={24} color="#FFFFFF" />
                      </View>
                      <Text style={[styles.quickActionText, { color: colors.text }]}>Automobile</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.quickActionCard, { backgroundColor: colors.card }]} onPress={() => {
                      hapticButtonPress();
                      closeFullPageSearch();
                      router.push('/subcategories/appliances');
                    }}>
                      <View style={[styles.quickActionIcon, { backgroundColor: colors.secondary }]}>
                        <Ionicons name="construct" size={24} color="#FFFFFF" />
                      </View>
                      <Text style={[styles.quickActionText, { color: colors.text }]}>Appliances</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.quickActionCard, { backgroundColor: colors.card }]} onPress={() => {
                      hapticButtonPress();
                      closeFullPageSearch();
                      router.push('/subcategories/homeservice');
                    }}>
                      <View style={[styles.quickActionIcon, { backgroundColor: colors.secondary }]}>
                        <Ionicons name="home" size={24} color="#FFFFFF" />
                      </View>
                      <Text style={[styles.quickActionText, { color: colors.text }]}>Home Services</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.quickActionCard, { backgroundColor: colors.card }]} onPress={() => {
                      hapticButtonPress();
                      closeFullPageSearch();
                      router.push('/subcategories/realestate');
                    }}>
                      <View style={[styles.quickActionIcon, { backgroundColor: colors.secondary }]}>
                        <Ionicons name="business" size={24} color="#FFFFFF" />
                      </View>
                      <Text style={[styles.quickActionText, { color: colors.text }]}>Real Estate</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Trending Searches */}
                <View style={styles.trendingSection}>
                  <View style={styles.trendingHeader}>
                    <Ionicons name="trending-up" size={20} color={colors.secondary} />
                    <Text style={[styles.trendingTitle, { color: colors.text }]}>Trending Now</Text>
                  </View>
                  <View style={styles.trendingGrid}>
                    {[
                      { text: 'Car Repair', icon: 'checkmark-circle' },
                      { text: 'AC Service', icon: 'pulse' },
                      { text: 'Plumbing', icon: 'heart' },
                      { text: 'Electrical', icon: 'sunny' },
                      { text: 'Washing Machine', icon: 'leaf' },
                      { text: 'Refrigerator', icon: 'water' },
                    ].map((item, index) => (
                      <TouchableOpacity
                        key={index}
                        style={[styles.trendingItem, { backgroundColor: colors.surface }]}
                        onPress={() => {
                          setSearchQuery(item.text);
                          performSearch(item.text);
                        }}
                      >
                        <Ionicons name={item.icon as any} size={16} color={colors.secondary} />
                        <Text style={[styles.trendingText, { color: colors.text }]}>{item.text}</Text>
                        <Ionicons name="chevron-forward" size={12} color={colors.textTertiary} />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Smart Suggestions removed as requested */}
              </View>
            )}

            {/* Search Results */}
            {searchQuery.length > 0 && (
              <View style={[styles.searchResultsContainer, { backgroundColor: colors.background }]}>
                {isSearching ? (
                  <View style={styles.searchLoadingContainer}>
                    <Ionicons name="hourglass-outline" size={20} color={colors.textTertiary} />
                    <Text style={[styles.searchLoadingText, { color: colors.text }]}>Searching...</Text>
                  </View>
                ) : filteredSearchResults.length > 0 ? (
                  <>
                    <View style={[styles.searchResultsHeader, { borderBottomColor: colors.border }]}>
                      <Text style={[styles.searchResultsCount, { color: colors.text }]}>
                        {filteredSearchResults.length} result{filteredSearchResults.length !== 1 ? 's' : ''} found
                      </Text>
                      {/* Service type filters */}
                      <View style={styles.serviceTypeFilters}>
                        {['All', 'Automobile', 'Appliances', 'Home Services'].map((filter) => (
                          <TouchableOpacity
                            key={filter}
                            style={[
                              styles.filterChip,
                              {
                                backgroundColor: selectedFilter === filter ? colors.primary : colors.card,
                                borderColor: selectedFilter === filter ? colors.primary : colors.border
                              }
                            ]}
                            onPress={() => {
                              setSelectedFilter(filter);
                              hapticButtonPress();
                            }}
                          >
                            <Text style={[
                              styles.filterChipText,
                              { color: selectedFilter === filter ? '#FFFFFF' : colors.text }
                            ]}>{filter}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                    {filteredSearchResults.map((service, index) => (
                      <TouchableOpacity
                        key={`${service.serviceType}-${service.id}-${index}`}
                        style={[
                          styles.fullPageSuggestionItem,
                          { borderLeftColor: getServiceTypeColor(service.serviceType), backgroundColor: colors.surface }
                        ]}
                        activeOpacity={0.6}
                        onPress={() => {
                          hapticButtonPress();
                          closeFullPageSearch();
                          setSearchQuery('');
                          handleServicePress(service);
                        }}
                      >
                        <View style={[
                          styles.fullPageSuggestionIconContainer,
                          { backgroundColor: getServiceTypeBackgroundColor(service.serviceType) }
                        ]}>
                          <Ionicons
                            name={getServiceTypeIcon(service.serviceType)}
                            size={24}
                            color={getServiceTypeColor(service.serviceType)}
                          />
                        </View>
                        <View style={styles.fullPageSuggestionContent}>
                          <View style={styles.serviceTitleRow}>
                            <Text style={[styles.fullPageSuggestionTitle, { color: colors.text }]} numberOfLines={2}>{service.title}</Text>
                            <View style={[
                              styles.serviceTypeBadge,
                              { backgroundColor: getServiceTypeColor(service.serviceType) }
                            ]}>
                              <Text style={styles.serviceTypeBadgeText}>{service.displayCategory}</Text>
                            </View>
                          </View>
                          <Text style={[styles.fullPageSuggestionCategory, { color: colors.textSecondary }]}>{service.category}</Text>
                          <View style={styles.fullPageSuggestionMeta}>
                            <Text style={[styles.fullPageSuggestionTime, { color: colors.textTertiary }]}>{service.time || 'Available'}</Text>
                            {service.price && (
                              <Text style={[styles.fullPageSuggestionPrice, { color: colors.text }]}>{service.price}</Text>
                            )}
                          </View>
                          {service.bullets && service.bullets.length > 0 && (
                            <Text style={[styles.bulletsText, { color: colors.textTertiary }]} numberOfLines={1}>
                              {service.bullets.slice(0, 2).join(' • ')}
                            </Text>
                          )}
                        </View>
                        <View style={styles.fullPageSuggestionActions}>
                          <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
                        </View>
                      </TouchableOpacity>
                    ))}
                  </>
                ) : searchQuery.length >= 2 ? (
                  <View style={[styles.noResults, { backgroundColor: colors.background }]}>
                    <Ionicons name="search-outline" size={48} color={colors.textTertiary} style={{ marginBottom: 16 }} />
                    <Text style={[styles.noResultsText, { color: colors.text }]}>No services found</Text>
                    <Text style={[styles.noResultsSubtext, { color: colors.textSecondary }]}>Try searching for "car repair", "AC service", or "plumbing"</Text>
                  </View>
                ) : searchQuery.length === 1 ? (
                  <View style={[styles.searchHint, { backgroundColor: colors.background }]}>
                    <Ionicons name="create-outline" size={32} color={colors.textTertiary} style={{ marginBottom: 16 }} />
                    <Text style={[styles.searchHintText, { color: colors.text }]}>Keep typing...</Text>
                    <Text style={[styles.searchHintSubtext, { color: colors.textSecondary }]}>Popular: "repair", "service", "maintenance"</Text>
                  </View>
                ) : null}
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  completeHeader: {
    paddingTop: 55,
    paddingBottom: 20,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  profileSection: {
    overflow: 'hidden',
  },
  mapModalContainer: {
    flex: 1,
  },
  mapModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 15,
    paddingHorizontal: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  mapCloseButton: {
    padding: 8,
  },
  mapModalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  mapHeaderSpacer: {
    width: 40,
  },
  mapQuickSearch: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 110 : 80,
    left: 20,
    right: 20,
    zIndex: 10,
  },
  fullMapContainer: {
    flex: 1,
  },
  fullMap: {
    width: '100%',
    height: '100%',
  },
  myLocationBtn: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  mapModalFooter: {
    padding: 20,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    marginTop: -25,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -5 },
  },
  selectedAddrInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  selectedAddrLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 4,
  },
  selectedAddrText: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  confirmLocBtn: {
    height: 55,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmLocBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
  },
  toggleWrapper: {
    marginHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  locationTextContainer: {
    flex: 1,
    marginLeft: 6,
    marginRight: 6,
  },
  helloText: {
    fontSize: 16,
    color: '#F1F5F9',
    marginBottom: 2,
    fontWeight: '700'
  },
  locationArea: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerRightIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  swiggySearchBar: {
    flexDirection: 'row',
    marginTop: -20,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    alignItems: 'center',
    height: 48,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  swiggySearchInput: {
    flex: 1,
    color: '#333',
    fontSize: 16,
    marginLeft: 8,
    marginRight: 8,
  },
  swiggySearchButtonText: {
    flex: 1,
    color: '#333',
    fontSize: 16,
    marginLeft: 8,
    marginRight: 8,
  },
  clearButton: {
    padding: 8,
    marginRight: 16
  },
  micButton: {
    padding: 8,
    marginRight: 16
  },
  headerServicesSection: {
    marginTop: 16,
  },
  headerSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 12,
  },
  headerServicesGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerServiceItem: {
    alignItems: 'center',
    width: (width - 15 * 2 - 12 * 3) / 4,
  },
  headerServiceIconCard: {
    width: 64,
    height: 64,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  headerServiceItemLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#F1F5F9',
    textAlign: 'center',
    lineHeight: 14,
  },
  scrollView: {
    backgroundColor: '#FFFFFF',
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 140,
    backgroundColor: '#FFFFFF',
    flexGrow: 1,
  },
  // Section titles
  sectionTitle: { color: '#000000', fontSize: 22, fontWeight: '800', marginBottom: 15 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 15,
    marginTop: 32,
    backgroundColor: '#FFFFFF',
  },
  seeAllText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
  },

  // Services grid (matching index page)
  servicesGrid: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 15 },
  serviceItem: { alignItems: 'center', width: (width - 15 * 2 - 12 * 3) / 4 },
  serviceIconCard: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  serviceItemLabel: { marginTop: 8, color: '#FFFFFF', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  serviceCard: { width: (width - (-30) * 2 - 2 * 6) / 3, backgroundColor: '#fff', borderRadius: 12, marginBottom: 15, padding: 8, marginHorizontal: 2, alignItems: 'center' },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 25,
    alignItems: 'center',
  },
  greeting: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  helloSmall: { color: '#E0E7FF', fontSize: 14, fontWeight: '700' },
  greetingName: { color: '#FFFFFF', fontSize: 26, fontWeight: '900' },
  greetingSub: { color: '#B1E3FF', fontSize: 12, marginTop: 4, marginBottom: 6 },
  locationExact: { color: '#fff', fontWeight: '800' },
  topRightIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  themeToggleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  profileCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileImage: {
    width: '80%',
    height: '80%',
  },
  searchBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
    marginHorizontal: 15,
    paddingHorizontal: 6,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  searchInput: {
    flex: 1,
    color: '#333',
    fontSize: 16,
  },
  servicesTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 25,
    marginBottom: 15,
    paddingHorizontal: 15,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    width: cardWidth,
    height: cardWidth,
    overflow: 'hidden',
    elevation: 3,
    marginBottom: 15,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },


  // Appliance Repair & Service Section
  applianceSection: {
    marginTop: -15,
    backgroundColor: '#FFFFFF',
  },
  applianceContainer: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    paddingVertical: 16,
    gap: 16,
  },
  applianceCard: {
    width: 120,
    height: 120,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
  },
  applianceImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  applianceTitle: {
    position: 'absolute',
    top: 12,
    left: 12,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: Fonts.bold,
    color: '#000000',
  },

  // Home Service and Repair Section
  homeServiceSection: {
    backgroundColor: '#FFFFFF',
  },
  homeServiceContainer: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    paddingVertical: 16,
    gap: 16,
  },
  homeServiceCard: {
    width: 120,
    height: 140,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
  },
  homeServiceImage: {
    width: '100%',
    height: 100,
    resizeMode: 'cover',
  },
  cardTitleContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    color: '#000000',
  },

  sheetBackdrop: { flex: 1, backgroundColor: 'transparent', justifyContent: 'flex-end' },
  sheetContainer: { backgroundColor: 'transparent', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 12, paddingHorizontal: 20, paddingBottom: 24, maxHeight: '70%' },
  sheetHandle: { width: 48, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 10 },
  sheetTitle: { fontSize: 22, fontWeight: '800', marginBottom: 12 },
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  tileCard: { width: (width - 16 * 2 - 12 * 3) / 4, alignItems: 'center', marginBottom: 16 },
  tileCardImage: { width: (width - 16 * 2 - 12 * 3) / 4, height: ((width - 16 * 2 - 12 * 3) / 4), borderRadius: 12, marginBottom: 6 },
  tileCardText: { textAlign: 'center', color: '#111827', fontSize: 12 },
  tileGrid3: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  tileCard3: { width: (width - 16 * 2 - 12 * 2) / 3, alignItems: 'center', marginBottom: 16 },
  tileCardImage3: { width: (width - 16 * 2 - 12 * 2) / 3, height: ((width - 16 * 2 - 12 * 2) / 3), borderRadius: 12, marginBottom: 6 },
  serviceSection: { marginBottom: 30 },
  mainHeading: { fontSize: 22, fontWeight: '800', marginBottom: 20 },
  subSection: { marginBottom: 24 },
  subHeading: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  serviceGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: 8 },
  serviceCardImage: { width: '100%', height: ((width - (-30) * 2 - 2 * 6) / 3) - 16, borderRadius: 8, marginBottom: 6 },
  serviceCardText: { textAlign: 'center', fontSize: 11, lineHeight: 14 },
  categoryCard: { backgroundColor: '#f8fafc', borderRadius: 12, padding: 16, marginBottom: 16, flexDirection: 'row', alignItems: 'center' },
  categoryCardImage: { width: 60, height: 60, borderRadius: 8, marginRight: 12 },
  categoryCardText: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  categoryCardSubtext: { fontSize: 12, color: '#6b7280', lineHeight: 16 },
  serviceGrid4: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: 8 },
  applianceServiceCard: { width: (width - 16 * 2 - 16 * 3) / 4, alignItems: 'center', marginBottom: 20, marginHorizontal: 4 },
  applianceServiceImage: { width: (width - 16 * 2 - 16 * 3) / 4, height: ((width - 16 * 2 - 16 * 3) / 4), borderRadius: 10, marginBottom: 8 },
  applianceServiceText: { textAlign: 'center', fontSize: 11, lineHeight: 14 },
  serviceGrid3: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: 8 },
  applianceServiceCard3: { width: (width - 16 * 2 - 12 * 2) / 3, alignItems: 'center', marginBottom: 20, marginHorizontal: 4 },
  applianceServiceImage3: { width: (width - 16 * 2 - 12 * 2) / 3, height: ((width - 16 * 2 - 12 * 2) / 3), borderRadius: 10, marginBottom: 8 },
  cardsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20, paddingHorizontal: 16, justifyContent: 'space-between' },
  serviceCardTitle: { fontSize: 13, fontWeight: '700', textAlign: 'center', marginBottom: 3, lineHeight: 16 },
  serviceCardSubtext: { fontSize: 9, color: '#6B7280', textAlign: 'center', lineHeight: 12 },
  // Location modal styles
  locOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  locCard: {
    width: '86%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
  },
  locTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 12,
  },
  locInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f9fafb',
  },
  locInput: {
    flex: 1,
    color: '#000000',
    fontSize: 14,
  },
  locSuggestions: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 10,
  },
  locSuggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)'
  },
  locActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 14,
  },
  locBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginLeft: 8,
  },
  locBtnText: {
    fontWeight: '700',
  },
  locCancel: { backgroundColor: '#f3f4f6' },
  locCancelText: { color: '#111827' },
  locSave: { backgroundColor: '#1818ec' },
  locSaveText: { color: '#fff' },
  locUseCurrentBtn: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 10,
  },
  locUseCurrentText: {
    color: '#2563eb',
    fontWeight: '700',
  },

  // Brands Section
  brandsSection: {
    marginTop: 25,
    paddingHorizontal: 15,
    backgroundColor: '#FFFFFF',
  },
  brandsTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#000000',
    marginBottom: 15,
  },
  brandsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  brandItem: {
    width: (width - 40 - 40 - 30) / 3, // Calculate width for exactly 3 items per row with more spacing
    height: (width - 40 - 40 - 30) / 3, // Square aspect ratio
    borderRadius: 6,
    marginBottom: 25,
    overflow: 'hidden',
  },
  brandImage: {
    width: '100%',
    height: '100%',
  },

  // Service Categories Section
  whatLookingForSection: {
    marginBottom: 5,
    paddingVertical: 10,
  },
  whatLookingForHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  headerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  whatLookingForTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
    marginHorizontal: 15,
    letterSpacing: 0.5,
  },
  sectionHeaderWithLines: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    paddingHorizontal: 15,
    marginTop: 5,
  },
  sectionTitleWithLines: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
    marginHorizontal: 15,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  // Promotional banner styles
  promoSection: {
    marginBottom: 20,
  },
  promoCard: {
    borderRadius: 16,
    height: 150,
    padding: 20,
    paddingLeft: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  promoTextContainer: {
    flex: 1,
    paddingRight: 8,
    marginLeft: 12,
    alignSelf: 'center',
  },
  promoTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 6,
  },
  promoSubtitle: {
    color: '#FDECEF',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  promoBrand: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  promoCta: {
    marginTop: 14,
    backgroundColor: '#FFFFFF',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoImage: {
    width: 180,
    height: '160%',
    alignSelf: 'center',
    marginLeft: 10,
    marginRight: -32,
    marginTop: 30,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
  },
  // Best Offers (services page)
  bestOffersSection: {
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
    paddingVertical: 25,
  },
  bestOffersCardsContainer: {
    paddingHorizontal: 15,
    paddingVertical: 2,
    gap: 12,
  },
  bestOfferCard: {
    width: 120,
    height: 140,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    position: 'relative',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginRight: 12,
  },
  bestOfferNewTag: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#FF6B35',
    paddingHorizontal: 18,
    paddingVertical: 3,
    borderRadius: 6,
    zIndex: 1,
  },
  bestOfferNewTagText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  bestOfferCardContent: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    height: '100%',
  },
  bestOfferTextContainer: {
    flex: 1,
    paddingRight: 8,
    paddingTop: 8,
    width: '100%',
  },
  bestOfferImageContainer: {
    width: '100%',
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bestOfferImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  bestOfferTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#000000',
    marginBottom: 2,
    lineHeight: 18,
    textAlign: 'left',
  },
  bestOfferSubtitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FF6B35',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  serviceCategoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 15,
    justifyContent: 'space-between',
  },
  serviceCategoryCard: {
    width: (width - 30 - 20) / 3, // 3 columns with padding and gap
    height: 140,
    borderRadius: 12,
    marginBottom: 15,
    overflow: 'hidden',
  },
  serviceCategoryImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  serviceCategoryTitle: {
    position: 'absolute',
    top: 12,
    left: 12,
    fontSize: 14,
    fontWeight: '900',
    fontFamily: Fonts.bold,
    color: '#000000',
  },

  // Full page search styles
  fullPageSearchContainer: {
    flex: 1,
    backgroundColor: '#F8F8F8',
  },
  fullPageSearchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 55 : 25,
    backgroundColor: '#F8F8F8',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  backButton: {
    marginRight: 12,
    padding: 8,
    borderRadius: 20,
  },
  fullPageSearchBar: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    alignItems: 'center',
    height: 48,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  fullPageSearchScrollContainer: {
    flex: 1,
  },
  fullPageSearchScrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  searchModalContent: {
    flex: 1,
    paddingHorizontal: 16,
  },
  searchModalHeader: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  searchModalIconContainer: {
    marginBottom: 20,
  },
  searchModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 24,
  },
  searchModalSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  searchResultsContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  fullPageSearchInput: {
    flex: 1,
    color: '#333',
    fontSize: 16,
    marginLeft: 8,
    marginRight: 8,
  },
  fullPageSearchContent: {
    flex: 1,
    paddingHorizontal: 16,
    backgroundColor: '#F8F8F8',
  },
  searchResultsHeader: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    marginBottom: 8,
  },
  searchResultsCount: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  serviceTypeFilters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  filterChipText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  fullPageSuggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginVertical: 4,
    backgroundColor: '#fff',
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  fullPageSuggestionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  fullPageSuggestionContent: {
    flex: 1,
    marginRight: 12,
  },
  serviceTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  fullPageSuggestionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
    lineHeight: 22,
    flex: 1,
  },
  serviceTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 8,
  },
  serviceTypeBadgeText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  fullPageSuggestionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  fullPageSuggestionCategory: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  fullPageSuggestionPrice: {
    fontSize: 14,
    color: '#26A69A',
    fontWeight: '600',
  },
  fullPageSuggestionTime: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
  },
  fullPageSuggestionActions: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceFeaturesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 12,
  },
  bulletsText: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
    fontStyle: 'italic',
  },
  labNameText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    marginTop: 2,
    marginBottom: 4,
  },
  searchPriceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  searchRatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchRatingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000000',
    marginLeft: 4,
  },
  searchLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  searchLoadingText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    fontStyle: 'italic',
  },
  noResults: {
    padding: 20,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 16,
    color: '#666',
    fontStyle: 'italic',
  },
  noResultsSubtext: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 4,
  },
  searchHint: {
    padding: 20,
    alignItems: 'center',
  },
  searchHintText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
    textAlign: 'center',
  },
  searchHintSubtext: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 4,
  },
  popularSearchesContainer: {
    marginTop: 16,
    width: '100%',
  },
  popularSearchesTitle: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'left',
  },
  popularSearchesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  popularSearchItem: {
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  popularSearchText: {
    fontSize: 12,
    color: '#495057',
    fontWeight: '500',
  },

  // Search History Styles
  searchHistoryContainer: {
    marginTop: 20,
    width: '100%',
  },
  searchHistoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  searchHistoryTitle: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  clearHistoryText: {
    fontSize: 14,
    color: '#26A69A',
    fontWeight: '500',
  },
  searchHistoryList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  searchHistoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  searchHistoryText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    marginLeft: 12,
  },

  // Search Suggestions Styles
  searchSuggestionsContainer: {
    marginTop: 20,
    width: '100%',
  },
  searchSuggestionsTitle: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
    marginBottom: 12,
  },
  searchSuggestionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  searchSuggestionItem: {
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  searchSuggestionText: {
    fontSize: 12,
    color: '#495057',
    fontWeight: '500',
  },

  // Enhanced Filter Styles (moved to main filterChip definition)

  // Suggestions Styles
  suggestionsContainer: {
    marginTop: 20,
    width: '100%',
  },
  suggestionsTitle: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  suggestionsList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  suggestionText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    marginLeft: 12,
  },

  // Quick Suggestions Styles
  quickSuggestionsContainer: {
    marginTop: 20,
    width: '100%',
  },
  quickSuggestionsTitle: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  quickSuggestionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  quickSuggestionItem: {
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  quickSuggestionText: {
    fontSize: 12,
    color: '#495057',
    fontWeight: '500',
  },

  // Enhanced Search Modal Styles
  enhancedSearchHeader: {
    backgroundColor: '#FFFFFF',
    paddingTop: 20,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  searchHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchTitleContainer: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 16,
  },
  searchTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 2,
  },
  searchSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  headerSpacer: {
    width: 40,
  },
  enhancedSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: '#E9ECEF',
  },
  searchIconContainer: {
    marginRight: 12,
  },
  enhancedSearchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  enhancedClearButton: {
    padding: 4,
    marginLeft: 8,
  },

  // Enhanced Service Card Styles
  enhancedServiceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  serviceCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  enhancedServiceIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  serviceCardTitleContainer: {
    flex: 1,
    marginRight: 12,
  },
  enhancedServiceTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
    lineHeight: 24,
  },
  enhancedServiceSection: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  enhancedServiceTypeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  enhancedServiceTypeText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  serviceCardBody: {
    marginBottom: 16,
  },
  serviceCardMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  serviceCardCategory: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  serviceCardCategoryText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
    fontWeight: '500',
  },
  serviceCardPrice: {
    backgroundColor: '#E8F5E8',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  enhancedServicePrice: {
    fontSize: 16,
    color: '#26A69A',
    fontWeight: '700',
  },
  serviceCardFeatures: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 16,
  },
  serviceCardFeature: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  serviceCardFeatureText: {
    fontSize: 13,
    color: '#666',
    marginLeft: 4,
    fontWeight: '500',
  },
  serviceCardBullets: {
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#26A69A',
  },
  enhancedBulletsText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    fontStyle: 'italic',
  },
  serviceCardFooter: {
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 12,
  },
  serviceCardAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  serviceCardActionText: {
    fontSize: 14,
    color: '#26A69A',
    fontWeight: '600',
  },

  // Enhanced No Results Styles
  enhancedNoResults: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  noResultsIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  enhancedNoResultsText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  enhancedNoResultsSubtext: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  enhancedSuggestionsContainer: {
    width: '100%',
    marginBottom: 32,
  },
  enhancedSuggestionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  enhancedSuggestionsList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  enhancedSuggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  suggestionIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E8F5E8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  enhancedSuggestionText: {
    flex: 1,
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  searchTipsContainer: {
    width: '100%',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
  },
  searchTipsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  searchTipsList: {
    gap: 4,
  },
  searchTipText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },

  // Enhanced Search Hint Styles
  enhancedSearchHint: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  searchHintIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E8F5E8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  enhancedSearchHintText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  enhancedSearchHintSubtext: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },

  // Innovative Search Features Styles
  innovativeSearchSection: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },

  // Quick Actions
  quickActionsContainer: {
    marginBottom: 32,
  },
  quickActionsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  quickActionCard: {
    width: (width - 32 - 12) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
  },

  // Trending Section
  trendingSection: {
    marginBottom: 32,
  },
  trendingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  trendingTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginLeft: 8,
  },
  trendingGrid: {
    gap: 8,
  },
  trendingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  trendingText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
    marginLeft: 12,
  },

  // Smart Suggestions
  smartSuggestionsSection: {
    marginBottom: 32,
  },
  smartSuggestionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  smartSuggestionsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginLeft: 8,
  },
  suggestionChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  suggestionChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#166534',
    marginLeft: 4,
  },

});