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
} from 'react-native';
import { Image as Img } from 'expo-image';
import { Asset } from 'expo-asset';
import { useNavigation } from '@react-navigation/native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useCart } from '../../context/CartContext';
import { useTheme } from '../../context/ThemeContext';
import DateTimePicker from '../../components/DateTimePicker';
import Toast from '../../components/Toast';
import { ApplianceServicesApi, ApplianceServiceRow, getSupabaseImageUrl } from '../../lib/applianceServices';
import { supabase } from '../../lib/supabase';

// Define the service item type
interface ServiceItem {
  id: string;
  title: string;
  description?: string;
  price: string;
  time: string;
  image: any;
  imagePath?: string | null;
  category: string;
  bullets?: string[];
  rating?: string | null;
  reviews?: number | null;
}

const ApplianceServicesScreen = () => {
  const navigation = useNavigation();
  const router = useRouter();
  const { addToCart, cartItems, getTotalItems } = useCart();
  const { colors, isDark } = useTheme();
  const params = useLocalSearchParams<{ category?: string; section?: string }>();

  const mapSectionToGroup = (section?: string): string | 'All' => {
    // If a specific section is provided, return it directly for precise navigation
    if (section) {
      return section;
    }
    return 'All';
  };

  const initialCategory = typeof params.category === 'string'
    ? params.category
    : mapSectionToGroup(typeof params.section === 'string' ? params.section : undefined);
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);

  // Handle section parameter changes
  React.useEffect(() => {
    if (params.section) {
      const newCategory = mapSectionToGroup(params.section);
      setSelectedCategory(newCategory);
      setHasScrolledToCategory(false); // Reset scroll state to allow scrolling to new section
    }
  }, [params.section]);
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

  // Database state
  const [dbSections, setDbSections] = useState<any[] | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Default image for all appliance services
  const defaultImage = require('../../assets/images/applianceservice.png');

  // Function to get image source - prioritizes Supabase storage, falls back to default
  const getImageSource = (imagePath: string | null) => {
    if (imagePath) {
      const supabaseUrl = getSupabaseImageUrl(imagePath);
      if (supabaseUrl) {
        return { uri: supabaseUrl };
      }
    }
    // Fallback to default image
    return defaultImage;
  };

  // Load data from database
  React.useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const rows = await ApplianceServicesApi.list();
        
        // Group rows by section_title to match existing UI shape
        const grouped: Record<string, any[]> = {};
        rows.forEach((r: ApplianceServiceRow) => {
          const item = {
            id: r.id,
            title: r.title,
            description: r.description || '', // Don't create description from bullets
            price: r.price ?? '₹0',
            time: r.time ?? 'Service in 60 mins',
            image: getImageSource(r.image_path),
            imagePath: r.image_path,
            category: r.category,
            bullets: r.bullets || [],
            rating: r.rating,
            reviews: r.reviews,
          };
          if (!grouped[r.section_title]) grouped[r.section_title] = [];
          grouped[r.section_title].push(item);
        });
        
        const nextSections = Object.keys(grouped).map((title) => ({
          key: (rows.find(r => r.section_title === title)?.section_key) || title.toLowerCase().replace(/\s+/g, '-'),
          title,
          services: grouped[title],
        }));
        setDbSections(nextSections);
      } catch (e) {
        setDbSections([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);



  const lowerSearch = searchText.toLowerCase();
  // Use only database sections
  const sourceSections = dbSections || [];
  const baseSections = sourceSections
    .map(section => ({
      ...section,
      services: section.services.filter((service: ServiceItem) => {
        const matchesSearch =
          service.title.toLowerCase().includes(lowerSearch) ||
          (service.bullets && service.bullets.some(bullet => bullet.toLowerCase().includes(lowerSearch)));
        return matchesSearch;
      }),
    }))
    .filter(section => section.services.length > 0 || lowerSearch.length === 0);

  const getPriorityTitle = (cat?: string): string | null => {
    if (!cat || cat === 'All') return null;
    // cat already equals a section.title when set via params.category or mapping
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
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  // Update selected category and reset scroll flag when route params change
  React.useEffect(() => {
    const nextCat = typeof params.category === 'string'
      ? params.category
      : mapSectionToGroup(typeof params.section === 'string' ? params.section : undefined);
    setSelectedCategory(nextCat);
    setHasScrolledToCategory(false);
    // Clear search so all sections remain visible for accurate scroll target
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
        bookingDate: date,
        bookingTime: time,
      });
      setToastMessage('Service added to cart!');
      setShowToast(true);
      setShowDateTimePicker(false);
    }
  };

  React.useEffect(() => {
    // Preload default image
    try { 
      Asset.fromModule(defaultImage).downloadAsync(); 
    } catch {}
  }, []);

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
          <Text style={[styles.title, { color: colors.text }]}>Appliance Services</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>We fix it all, right at your home.</Text>
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
              {section.services.map((item: ServiceItem) => (
                <TouchableOpacity 
                  key={item.id} 
                  style={[styles.card, { backgroundColor: colors.card }]}
                  onPress={() => router.push({ pathname: '/product/[id]', params: { id: item.id, title: item.title, description: item.description, price: item.price, time: item.time, category: item.category, imageUri: item.imagePath ? getSupabaseImageUrl(item.imagePath) : '', imageKey: item.imagePath ? '' : 'applianceservice' } })}
                  activeOpacity={0.8}
                >
                  <View style={styles.cardImageWrap}>
                    <Img source={item.image} style={styles.cardImage} contentFit="cover" transition={150} cachePolicy="memory-disk" />
                  </View>

                  <View style={styles.cardRight}>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>{item.title}</Text>
                    {item.description && <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>{item.description}</Text>}
                    
                    {/* Display bullets if available */}
                    {item.bullets && item.bullets.length > 0 && (
                      <View style={styles.bulletsContainer}>
                        {item.bullets.slice(0, 2).map((bullet, index) => (
                          <Text key={index} style={[styles.bulletText, { color: colors.textSecondary }]}>• {bullet}</Text>
                        ))}
                        {item.bullets.length > 2 && (
                          <Text style={[styles.bulletText, { color: colors.textSecondary }]}>• +{item.bullets.length - 2} more</Text>
                        )}
                      </View>
                    )}

                    <View style={styles.priceRow}>
                      <Text style={styles.price}>{item.price}</Text>
                      <Text style={[styles.time, { color: colors.textSecondary }]}>{item.time}</Text>
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
};

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

  // Categories
  categories: { flexDirection: 'row', marginBottom: 15, flexWrap: 'wrap' },
  categoryButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ccc',
    marginRight: 10,
    marginBottom: 10,
  },
  categorySelected: { backgroundColor: '#fff' },
  categoryText: { color: '#fff', fontSize: 13 },

  // Card style (height increased)
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
  viewDetailsBadge: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  viewDetailsText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  cardRight: { flex: 1, paddingVertical: 16, paddingHorizontal: 12, justifyContent: 'space-between' },
  cardTitle: { fontSize: 16, fontWeight: 'bold' },
  cardDesc: { fontSize: 13, marginVertical: 4 },
  bulletsContainer: { marginVertical: 4 },
  bulletText: { fontSize: 12, marginVertical: 1 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 4 },
  rating: { fontSize: 12, fontWeight: '600' },
  reviews: { fontSize: 11, marginLeft: 4 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  price: { fontSize: 15, fontWeight: 'bold', color: '#004c8f' },
  time: { fontSize: 12 },
  bookButton: {
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
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

export default ApplianceServicesScreen;