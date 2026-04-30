import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState, useLayoutEffect, useRef } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AutomobileServicesApi, AutomobileServiceRow, getSupabaseImageUrl } from '../../lib/automobileServices';
import { supabase } from '../../lib/supabase';
import { useCart } from '../../context/CartContext';
import { useTheme } from '../../context/ThemeContext';
import DateTimePicker from '../../components/DateTimePicker';
import Toast from '../../components/Toast';

const { width } = Dimensions.get('window');

type ServiceItem = {
  id: string;
  title: string;
  rating: string;
  reviews: number;
  price: string;
  bullets: string[];
  time: string;
  image: any;
  imagePath: string | null;
  category: string;
};

type ServiceSection = {
  key: string;
  title: string;
  services: ServiceItem[];
};
// All service cards are now sourced from Supabase only

function AutomobileServicesScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const { addToCart, cartItems, getTotalItems } = useCart();
  const { colors, isDark } = useTheme();
  const params = useLocalSearchParams<{ section?: string; service?: string }>();

  const [searchText, setSearchText] = useState('');
  const [selectedSection, setSelectedSection] = useState<'All' | string>('All');
  const [showDateTimePicker, setShowDateTimePicker] = useState(false);
  const [selectedService, setSelectedService] = useState<any>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const sectionPositionsRef = useRef<Record<string, number>>({});
  const [pendingSection, setPendingSection] = useState<string | null>(null);
  const scrollViewRef = useRef<any>(null);
  const [hasScrolledToCategory, setHasScrolledToCategory] = useState(false);
  const contentMeasureTickRef = useRef(0);
  const scrollRetryRef = useRef(0);

  const mapSectionToKey = (section?: string): string | 'All' => {
    if (!section) return 'All';
    const s = section.toLowerCase().trim();

    // Car
    if (
      s === 'car general maintenance & repairs' ||
      s === 'car general maintenance & services' ||
      s === 'car general maintenance & service' ||
      s.includes('car general maintenance')
    ) {
        return 'car-general-maintenance';
    }
    if (s === 'car engine & electronic services') {
        return 'car-engine-electronics';
    }
    if (s === 'car body & paint work' || s.includes('paint')) {
        return 'car-body-paint';
    }
    if (s === 'car tires & wheels' ) {
        return 'car-tires-wheels';
    }
    if (s === 'car detailing & cleaning' ) {
        return 'car-detailing-cleaning';
    }

    // Bike sections - check specific section names
    if (
      s === 'bike general maintenance & repairs' ||
      s === 'bike general maintenance & services' ||
      s === 'bike general maintenance & service' ||
      (s.startsWith('bike ') && s.includes('general maintenance'))
    ) {
      return 'bike-general-maintenance';
    }
    if (
      s === 'bike engine & electronic services' ||
      s === 'bike engine & electronics' ||
      (s.startsWith('bike ') && (s.includes('engine') && s.includes('electronic')))
    ) {
      return 'bike-engine-electronics';
    }
    if (
      s === 'bike tires & wheels' ||
      s === 'bike tyres & wheels' ||
      (s.startsWith('bike ') && (s.includes('tire') || s.includes('tyre') || s.includes('wheel')))
    ) {
      return 'bike-tires-wheels';
    }
    if (
      s === 'bike detailing & cleaning' ||
      (s.startsWith('bike ') && (s.includes('detailing') || s.includes('cleaning')))
    ) {
      return 'bike-detailing-cleaning';
    }

      // Acting drivers
    if (s === 'personal & trip-based services' || s.includes('acting driver') || s.includes('driver')) {
        return 'acting-drivers-personal';
    }

    return 'All';
  };

  const initialCategory = typeof params.section === 'string'
    ? mapSectionToKey(params.section)
    : 'All';
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [dbSections, setDbSections] = useState<ServiceSection[] | null>(null);
  const [actingDriverSection, setActingDriverSection] = useState<ServiceSection | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const imageForKey = (key?: string | null) => {
    // Default fallback image for all automobile services
    return require('../../assets/images/carwash.png');
  };

  // Function to get image source - prioritizes Supabase storage, falls back to default
  const getImageSource = (imagePath: string | null) => {
    if (imagePath) {
      const supabaseUrl = getSupabaseImageUrl(imagePath);
      if (supabaseUrl) {
        return { uri: supabaseUrl };
      }
    }
    // Fallback to default image
    return imageForKey('default');
  };

  const transformRowsToSections = (rows: AutomobileServiceRow[]): ServiceSection[] => {
    const map: Record<string, ServiceSection> = {};
    for (const r of rows) {
      // Skip legacy Acting Drivers service definitions; these now come from providers_acting_drivers
      if (/personal\s*&\s*trip-based/i.test(r.section_title || '')) {
        continue;
      }

      const key = r.section_key;
      if (!map[key]) {
        map[key] = { key, title: r.section_title, services: [] };
      }
      map[key].services.push({
        id: r.id,
        title: r.title,
        rating: r.rating ?? '4.6',
        reviews: r.reviews ?? 0,
        price: r.price ?? '₹0',
        bullets: r.bullets ?? [],
        time: r.time ?? 'Service in 60 mins',
        image: getImageSource(r.image_path),
        imagePath: r.image_path,
        category: r.category,
      });
    }
    return Object.values(map).sort((a, b) => a.title.localeCompare(b.title));
  };

  React.useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setLoadError(null);
        // Load automobile services (except acting drivers, which will use providers_acting_drivers)
        const rows = await AutomobileServicesApi.list();
        if (rows && rows.length > 0) {
          setDbSections(transformRowsToSections(rows));
        } else {
          setDbSections(null);
        }

        // Load approved acting drivers from providers_acting_drivers table
        const { data: drivers, error } = await supabase
          .from('providers_acting_drivers')
          .select('*')
          .eq('verification_status', 'approved');

        if (error) {
          console.error('Error loading acting drivers:', error);
        } else if (drivers && drivers.length > 0) {
          const services: ServiceItem[] = drivers.map((driver: any) => ({
            id: driver.id,
            title: driver.name || 'Acting Driver',
            rating: '4.8', // placeholder rating for now
            reviews: 0,
            price: 'Price varies by trip',
            bullets: [
              driver.driving_experience_years
                ? `${driver.driving_experience_years} years of driving experience`
                : 'Experienced acting driver',
              driver.address || 'Available in your city',
            ],
            time: 'Available on request',
            image: imageForKey('acting-driver'),
            imagePath: null,
            category: 'acting-driver',
          }));

          setActingDriverSection({
            key: 'acting-drivers-personal',
            title: '🚗 Personal & Trip-based Services',
            services,
          });
        } else {
          setActingDriverSection(null);
        }
      } catch (e: any) {
        setLoadError(e?.message || 'Failed to load services');
        setDbSections(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const lowerSearch = searchText.toLowerCase();
  const serviceParam = typeof params.service === 'string' ? params.service : undefined;

  const getPriorityKey = (cat?: string): string | null => {
    if (!cat || cat === 'All') return null;
    return cat;
  };
  const priorityKey = getPriorityKey(selectedCategory);

  const keyToDefaultTitle = (key: string): string => {
    switch (key) {
      case 'car-general-maintenance':
        return '🚗 General Maintenance & Repairs';
      case 'car-engine-electronics':
        return '⚙️ Engine & Electronic Services';
      case 'car-body-paint':
        return '🎨 Body & Paint Work';
      case 'car-tires-wheels':
        return '🛞 Tyres & Wheels';
      case 'car-detailing-cleaning':
        return '🧽 Detailing & Cleaning';
      case 'bike-general-maintenance':
        return '🏍 General Maintenance & Repairs';
      case 'bike-engine-electronics':
        return '⚙️ Engine & Electronic Services';
      case 'bike-tires-wheels':
        return '🛞 Tires & Wheels';
      case 'bike-detailing-cleaning':
        return '🧽 Detailing & Cleaning';
      case 'acting-drivers-personal':
        return '🚗 Personal & Trip-based Services';
      default:
        return '';
    }
  };

  // Build combined sections including acting drivers (overriding any existing acting-drivers section)
  const combinedSections: ServiceSection[] = React.useMemo(() => {
    let sections = dbSections ? [...dbSections] : [];
    if (actingDriverSection) {
      sections = sections.filter((s) => s.key !== 'acting-drivers-personal');
      sections.push(actingDriverSection);
    }
    return sections;
  }, [dbSections, actingDriverSection]);

  // Build base sections filtered by search, then optionally prioritize a service within its section
  let baseSections = combinedSections
    .map(section => ({
      ...section,
      services: section.services.filter(service => {
        const matchesSearch =
          service.title.toLowerCase().includes(lowerSearch) ||
          service.bullets.some(bullet => bullet.toLowerCase().includes(lowerSearch));
        return matchesSearch;
      }),
    }))
    .filter(section => section.services.length > 0);

  // If a specific service is provided, move it to the top within its section (for the prioritized section)
  if (serviceParam) {
    const serviceLower = serviceParam.toLowerCase();
    baseSections = baseSections.map(sec => {
      const idx = sec.services.findIndex(s => s.title.toLowerCase().includes(serviceLower));
      if (idx > 0) {
        const copy = [...sec.services];
        const [hit] = copy.splice(idx, 1);
        copy.unshift(hit);
        return { ...sec, services: copy };
      }
      return sec;
    });
  }

  const filteredSections = priorityKey
    ? [
        ...baseSections.filter(s => s.key === priorityKey),
        ...baseSections.filter(s => s.key !== priorityKey),
      ]
    : baseSections;

  // If the desired section key doesn't exist, remap to the closest matching existing section by title
  React.useEffect(() => {
    if (!dbSections || !priorityKey) return;
    const exists = dbSections.some(s => s.key === priorityKey);
    if (exists) return;

    const desiredTitle = keyToDefaultTitle(priorityKey);
    const normalize = (t: string) => t.replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\s]+/u, '').trim().toLowerCase();
    const desiredNorm = normalize(desiredTitle);

    let match = dbSections.find(s => normalize(s.title) === desiredNorm);
    if (!match) {
      // fallback: contains main words
      if (priorityKey.includes('general-maintenance')) {
        match = dbSections.find(s => /general|maintenance/i.test(s.title));
      } else if (priorityKey.includes('engine-electronics')) {
        match = dbSections.find(s => /engine|electronic/i.test(s.title));
      } else if (priorityKey.includes('body-paint')) {
        match = dbSections.find(s => /paint|body/i.test(s.title));
      } else if (priorityKey.includes('tires') || priorityKey.includes('tyres')) {
        match = dbSections.find(s => /tire|tyre|wheel/i.test(s.title));
      } else if (priorityKey.includes('detailing-cleaning')) {
        match = dbSections.find(s => /detail|clean/i.test(s.title));
      } else if (priorityKey.includes('acting-drivers')) {
        match = dbSections.find(s => /driver|trip/i.test(s.title));
      }
      
      // Bike-specific fallback logic
      if (priorityKey.startsWith('bike-')) {
        if (priorityKey.includes('general-maintenance')) {
          match = dbSections.find(s => /bike.*general|bike.*maintenance/i.test(s.title));
        } else if (priorityKey.includes('engine-electronics')) {
          match = dbSections.find(s => /bike.*engine|bike.*electronic/i.test(s.title));
        } else if (priorityKey.includes('tires') || priorityKey.includes('tyres')) {
          match = dbSections.find(s => /bike.*tire|bike.*tyre|bike.*wheel/i.test(s.title));
        } else if (priorityKey.includes('detailing-cleaning')) {
          match = dbSections.find(s => /bike.*detail|bike.*clean/i.test(s.title));
        }
      }
    }
    if (match && match.key !== selectedCategory) {
      setSelectedCategory(match.key);
    }
  }, [dbSections, priorityKey]);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  // Update selected category and reset scroll flag when route params change
  React.useEffect(() => {
    const nextCat = typeof params.section === 'string'
      ? mapSectionToKey(params.section)
      : 'All';
    setSelectedCategory(nextCat);
    setHasScrolledToCategory(false);
    setSearchText('');
  }, [params.section]);

  // Scroll to the selected section heading once layout info is available
  React.useEffect(() => {
    if (!selectedCategory || selectedCategory === 'All' || hasScrolledToCategory) return;

    const tryScroll = () => {
      const targetY = sectionPositionsRef.current[selectedCategory];
      if (typeof targetY === 'number' && scrollViewRef.current) {
        const y = Math.max(targetY - 15, 0);
        scrollViewRef.current.scrollTo({ y, animated: true });
        setHasScrolledToCategory(true);
        scrollRetryRef.current = 0;
        return true;
      }
      return false;
    };

    if (!tryScroll() && scrollRetryRef.current < 10) {
      const timer = setTimeout(() => {
        scrollRetryRef.current += 1;
        tryScroll();
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [selectedCategory, hasScrolledToCategory, contentMeasureTickRef.current]);

  const handleBookNow = (service: any) => {
    setSelectedService(service);
    setShowDateTimePicker(true);
  };

  const handleDateTimeConfirm = (date: string, time: string) => {
    if (selectedService) {
      addToCart({
        ...selectedService,
        image: selectedService.image,
        bookingDate: date,
        bookingTime: time,
      });
      setToastMessage('Service added to cart!');
      setShowToast(true);
      setShowDateTimePicker(false);
    }
  };

  const navigateToDetails = (item: ServiceItem, sectionTitle: string) => {
    // Prefer the exact Supabase image URL when available; otherwise pass a stable key
    const supabaseUrl = item.imagePath ? getSupabaseImageUrl(item.imagePath) : undefined;
    router.push({
      pathname: '/product/[id]',
      params: {
        id: item.id,
        title: item.title,
        description: item.bullets.join(' • '),
        price: item.price,
        time: item.time,
        category: sectionTitle,
        imageUri: supabaseUrl || '',
        imageKey: supabaseUrl ? '' : 'carwash',
      },
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        ref={scrollViewRef}
        onContentSizeChange={() => {
          contentMeasureTickRef.current += 1;
        }}
      >
        {/* Top Row: Back + Profile */}
        <View style={styles.topRow}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={[styles.searchRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="search" size={22} color={colors.textTertiary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Start your search"
            placeholderTextColor={colors.textTertiary}
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>

        {/* Title */}
        <View style={styles.titleSection}>
          <Text style={[styles.title, { color: colors.text }]}>Automobile Services</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>We bring the garage to your gate.</Text>
        </View>

        {/* Sectioned Service Cards */}
        {filteredSections.length > 0 ? (
          filteredSections.map((section) => (
            <View key={section.key} onLayout={(e) => {
              sectionPositionsRef.current[section.title] = e.nativeEvent.layout.y;
            }}>
              <Text style={[
                styles.sectionTitle, 
                { color: colors.text },
                selectedCategory !== 'All' && section.title === selectedCategory && styles.sectionTitleHighlighted
              ]}>{section.title}</Text>
              {section.services.map((item) => (
                <TouchableOpacity 
                  key={item.id} 
                  style={[styles.card, { backgroundColor: colors.card }]}
                  onPress={() => navigateToDetails(item, section.title)}
                  activeOpacity={0.8}
                >
                  <View style={styles.cardImageWrap}>
                    <Image source={item.image} style={styles.cardImage} />
                    </View>

                  <View style={styles.cardRight}>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>{item.title}</Text>
                    <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>{item.bullets.slice(0, 2).join(' • ')}</Text>

                    <View style={styles.priceRow}>
                      <Text style={[styles.price, { color: '#004c8f' }]}>{item.price}</Text>
                      <Text style={[styles.time, { color: colors.textSecondary }]}>{item.time}</Text>
                      </View>

                    

                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        handleBookNow(item);
                      }}
                    >
                      <LinearGradient
                        colors={[colors.secondary, colors.secondaryDark]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.bookButton}
                      >
                        <Text style={[styles.bookText, { color: '#FFFFFF' }]}>Book Now</Text>
                      </LinearGradient>
                  </TouchableOpacity>

                    <View style={styles.viewDetailsLink}>
                      <Text style={[styles.viewDetailsLinkText, { color: '#004c8f' }]}>View details</Text>
                      <Ionicons name="chevron-forward" size={16} color="#004c8f" />
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ))
        ) : (
          <View style={{ alignItems: 'center', marginTop: 50 }}>
            <Text style={{ color: colors.text, fontSize: 16 }}>Loading Services...</Text>
          </View>
        )}
      </ScrollView>

      {/* DateTime Picker Modal */}
      <DateTimePicker
        visible={showDateTimePicker}
        onClose={() => setShowDateTimePicker(false)}
        onConfirm={handleDateTimeConfirm}
        serviceTitle={selectedService?.title || ''}
        useBlueGradient={true}
      />

      {/* Toast Message */}
      <Toast
        visible={showToast}
        message={toastMessage}
        type="success"
        onHide={() => setShowToast(false)}
      />

      {/* Floating Cart Icon */}
      {getTotalItems() > 0 && (
        <LinearGradient
          colors={[colors.secondary, colors.secondaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.floatingCartButton}
        >
          <TouchableOpacity
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
            onPress={() => router.push('/(tabs)/cart')}
            activeOpacity={0.8}
          >
            <Ionicons name="cart" size={24} color="#FFFFFF" />
            {getTotalItems() > 0 && (
              <View style={[styles.cartBadge, { backgroundColor: colors.surface, borderColor: '#0A6DDB' }] }>
                <Text style={[styles.cartBadgeText, { color: '#0A6DDB' }]}>{getTotalItems()}</Text>
              </View>
            )}
          </TouchableOpacity>
        </LinearGradient>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    padding: 15 
  },

  // Top Row
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    marginTop: 30,
  },

  // Search Row
  searchRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 15,
    borderRadius: 20,
    paddingHorizontal: 15,
    height: 40,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
  },

  // Title
  titleSection: { marginBottom: 15 },
  title: { fontSize: 22, fontWeight: 'bold' },
  subtitle: { fontSize: 14 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginTop: 8, marginBottom: 10 },
  sectionTitleHighlighted: { marginTop: 24, marginBottom: 16 },

  // Card style (matching appliance page)
  card: {
    flexDirection: 'row',
    borderRadius: 14,
    marginBottom: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
    minHeight: 140,
  },
  cardImageWrap: {
    width: 140,
    height: 140,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#fff',
    margin: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  cardImage: { width: '100%', height: '100%' },
  cardRight: { 
    flex: 1, 
    paddingVertical: 16, 
    paddingHorizontal: 12, 
    justifyContent: 'space-between' 
  },
  cardTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  cardDesc: { fontSize: 13, marginVertical: 4 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  price: { fontSize: 15, fontWeight: 'bold' },
  time: { fontSize: 12 },
  
  bookButton: {
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    marginBottom: 6,
  },
  bookText: { fontSize: 14, fontWeight: '600' },
  viewDetailsLink: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', marginTop: 6 },
  viewDetailsLinkText: { fontSize: 12, fontWeight: '600', marginRight: 4 },
  
  // Floating Cart Button
  floatingCartButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 1000,
  },
  cartBadge: {
    position: 'absolute',
    top: -2,
    right: -15,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  cartBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default function AutomobileServices() {
  return <AutomobileServicesScreen />;
}