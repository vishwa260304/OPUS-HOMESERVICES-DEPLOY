import React, { useState, useLayoutEffect, useRef, useEffect } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useCart } from '../../context/CartContext';
import { useTheme } from '../../context/ThemeContext';
import { HomeServicesApi, HomeServiceRow, getSupabaseImageUrl } from '../../lib/homeServices';
import { useAuth } from '../../context/AuthContext';
import DateTimePicker from '../../components/DateTimePicker';
import Toast from '../../components/Toast';

type HSItem = {
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

type HSSection = { 
  key: string;
  title: string; 
  services: HSItem[] 
};

const formatRating = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === '') return '—';
  const num = Number(value);
  return Number.isFinite(num) ? num.toFixed(1) : '—';
};

export default function HomeServices() {
  const navigation = useNavigation();
  const router = useRouter();
  const { addToCart, cartItems, getTotalItems } = useCart();
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ section?: string; category?: string }>();
  const [searchText, setSearchText] = useState('');
  const [showDateTimePicker, setShowDateTimePicker] = useState(false);
  const [selectedService, setSelectedService] = useState<any>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const scrollViewRef = useRef<any>(null);
  const [hasScrolledToCategory, setHasScrolledToCategory] = useState(false);
  const sectionPositionsRef = useRef<Record<string, number>>({});
  const contentMeasureTickRef = useRef(0);
  const scrollRetryRef = useRef(0);
  const sectionsCacheRef = useRef<HSSection[] | null>(null);

  const mapSectionToGroup = (section?: string): string | 'All' => {
    switch (section) {
      case 'Electrical Services':
        return 'Electrical Services';
      case 'Plumbing Services':
        return 'Plumbing Services';
      case 'Carpentry Services':
        return 'Carpentry Services';
      case 'Painting & Renovation':
        return 'Painting & Renovation';
      case 'Cleaning & Pest Control':
        return 'Cleaning & Pest Control';
      // Newly added sections from Services modal
      case 'Women’s Salon':
        return 'Women’s Salon';
      case 'Men’s Salon':
        return 'Men’s Salon';
      case 'Unisex & Spa':
        return 'Unisex & Spa';
      case 'Pet Grooming':
        return 'Pet Grooming';
      case 'Pet Health & Training':
        return 'Pet Health & Training';
      case 'Pet Boarding & Sitting':
        return 'Pet Boarding & Sitting';
      default:
        return 'All';
    }
  };

  const initialCategory = typeof params.category === 'string'
    ? params.category
    : mapSectionToGroup(typeof params.section === 'string' ? params.section : undefined);
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);

  const [dbSections, setDbSections] = useState<HSSection[] | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const imageFromKey = (key: string) => {
    // Default fallback image for all services
    return require('../../assets/images/homeservice.png');
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
    return imageFromKey('default');
  };


  useEffect(() => {
    sectionsCacheRef.current = null;
    setDbSections(null);
  }, [user?.id]);

  useEffect(() => {
    const load = async () => {
      try {
        if (sectionsCacheRef.current?.length) {
          setDbSections(sectionsCacheRef.current);
        }
        setLoading(true);
        const rows = await HomeServicesApi.list();
        // Group rows by section_title to match existing UI shape
        const grouped: Record<string, HSItem[]> = {};
        rows.forEach((r: HomeServiceRow) => {
          const bullets: string[] = Array.isArray(r.bullets) ? r.bullets : [];
          const item: HSItem = {
            id: r.id,
            title: r.title,
            rating: formatRating(r.rating),
            reviews: r.reviews ?? 0,
            price: r.price ?? '₹0',
            bullets,
            time: r.time ?? 'Service in 60 mins',
            image: getImageSource(r.image_path),
            imagePath: r.image_path,
            category: r.category,
          };
          if (!grouped[r.section_title]) grouped[r.section_title] = [];
          grouped[r.section_title].push(item);
        });
        // Ensure unique section keys to avoid React key warning
        const seenKeys = new Set();
        const nextSections: HSSection[] = Object.keys(grouped).map((title) => {
          let baseKey = (rows.find(r => r.section_title === title)?.section_key) || title.toLowerCase();
          let key = baseKey;
          let suffix = 1;
          while (seenKeys.has(key)) {
            key = `${baseKey}_${suffix++}`;
          }
          seenKeys.add(key);
          return {
            key,
            title,
            services: grouped[title],
          };
        });
        if (nextSections.length > 0) {
          sectionsCacheRef.current = nextSections;
          setDbSections(nextSections);
        }
      } catch (e) {
        // Failed to load home services
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.id]);

  const lowerSearch = searchText.toLowerCase();
  const sourceSections = dbSections ?? [];
  const baseSections = sourceSections
    .map(section => ({
      ...section,
      services: section.services.filter(service => {
        const matchesSearch =
          service.title.toLowerCase().includes(lowerSearch) ||
          service.bullets.some(bullet => bullet.toLowerCase().includes(lowerSearch));
        return matchesSearch;
      }),
    }))
    .filter(section => section.services.length > 0 || lowerSearch.length === 0);

  const getPriorityTitle = (cat?: string): string | null => {
    if (!cat || cat === 'All') return null;
    return cat;
  };

  const priorityTitle = getPriorityTitle(selectedCategory);
  const filteredSections = priorityTitle
    ? [
        ...baseSections.filter(s => s.title === priorityTitle),
        ...baseSections.filter(s => s.title !== priorityTitle),
      ]
    : baseSections;

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  // Update selected category and reset scroll flag when route params change
  React.useEffect(() => {
    const nextCat = typeof params.category === 'string'
      ? params.category
      : mapSectionToGroup(typeof params.section === 'string' ? params.section : undefined);
    setSelectedCategory(nextCat);
    setHasScrolledToCategory(false);
    setSearchText('');
  }, [params.category, params.section]);

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

  const navigateToDetails = (item: HSItem, sectionTitle: string) => {
    router.push({
      pathname: '/product/[id]',
      params: {
        id: item.id,
        title: item.title,
        description: item.bullets.join(' • '),
        price: item.price,
        time: item.time,
        category: sectionTitle,
        rating: item.rating,
        imageUri: item.imagePath ? getSupabaseImageUrl(item.imagePath) : '',
        imageKey: item.imagePath ? '' : 'homeservice',
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
  refreshControl={undefined}
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
    <Text style={[styles.title, { color: colors.text }]}>Home Services</Text>
    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Professional services for your home.</Text>
  </View>

  {/* Sectioned Service Cards */}
  {filteredSections.length > 0 ? (
    filteredSections.map((section) => (
      <View
        key={section.key}
        onLayout={(e) => {
          sectionPositionsRef.current[section.title] = e.nativeEvent.layout.y;
        }}
      >
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
              <Image source={item.image} style={styles.cardImage} contentFit="cover" cachePolicy="disk" />
            </View>

            <View style={styles.cardRight}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{item.title}</Text>

              <View style={styles.ratingRow}>
                <Ionicons name="star" size={14} color="#F59E0B" />
                <Text style={[styles.ratingText, { color: colors.textSecondary }]}>
                  {item.rating} ({item.reviews} reviews)
                </Text>
              </View>

              <View style={styles.priceRow}>
                <Text style={styles.price}>{item.price}</Text>
                <Text style={[styles.time, { color: colors.textSecondary }]}>{item.time}</Text>
              </View>

              <View style={styles.bulletsContainer}>
                {item.bullets.slice(0, 2).map((bullet, index) => (
                  <View key={`${item.id}-bullet-${index}`} style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={[styles.bulletText, { color: colors.textSecondary }]}>{bullet}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  handleBookNow(item);
                }}
                activeOpacity={0.8}
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
                <Text style={styles.viewDetailsLinkText}>View details</Text>
                <Ionicons name="chevron-forward" size={16} color="#004c8f" />
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    ))
  ) : (
    <View style={{ alignItems: 'center', marginTop: 50 }}>
      <Text style={{ color: colors.text, fontSize: 16 }}>
        {loading ? 'Loading services...' : 'No services available.'}
      </Text>
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

      {/* Toast */}
      <Toast
        visible={showToast}
        message={toastMessage}
        onHide={() => setShowToast(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 15 },

  // Top Row
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    marginTop: 30,
  },
  profileImage: { width: 36, height: 36, borderRadius: 18 },

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
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  ratingText: { marginLeft: 4, fontSize: 12 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  price: { fontSize: 15, fontWeight: 'bold', color: '#004c8f' },
  time: { fontSize: 12 },
  bulletsContainer: { marginBottom: 8 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 3 },
  bulletDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#6B7280', marginTop: 6, marginRight: 6 },
  bulletText: { flex: 1, fontSize: 11, lineHeight: 14 },
  bookButton: {
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    marginBottom: 6,
  },
  bookText: { fontSize: 14, fontWeight: '600' },
  viewDetailsLink: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', marginTop: 6 },
  viewDetailsLinkText: { color: '#004c8f', fontSize: 12, fontWeight: '600', marginRight: 4 },

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
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
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
