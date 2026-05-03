import React, { useState, useEffect, useLayoutEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  ScrollView,
  Dimensions,
  StatusBar,
  TextInput,
  Alert,
  Share,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams, useNavigation } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { hapticButtonPress } from '../../utils/haptics';
import { PropertyListingsApi, transformPropertyListing, PropertyListing } from '../../lib/propertyListings';

const { width } = Dimensions.get('window');

interface Property {
  id: string;
  title: string;
  location: string;
  price: string;
  deposit: string;
  area: string;
  areaType: string;
  postedDays: number;
  dealerName: string;
  isVerified: boolean;
  isFeatured: boolean;
  imageCount: number;
  category: string;
  subcategory: string;
  image: any;
  images?: any[]; // Array of images for carousel
}

// Sample data for fallback when no properties are available
const sampleProperties: Property[] = [
  {
    id: 'sample-1',
    title: 'No properties available',
    location: 'Please add some properties to see them here',
    price: 'Contact us',
    deposit: 'For more information',
    area: 'N/A',
    areaType: 'N/A',
    postedDays: 0,
    dealerName: 'Fixit Real Estate',
    isVerified: false,
    isFeatured: false,
    imageCount: 0,
    category: 'Residential',
    subcategory: 'Properties for Sale',
    image: require('../../assets/images/Aframe.webp'),
  }
];

// Image Carousel Component
const ImageCarousel = ({ images, isVerified, colors }: { images: any[], isVerified: boolean, colors: any }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollViewRef = React.useRef<ScrollView>(null);
  const autoScrollInterval = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const cardWidth = width - 16; // accounting for padding
  const AUTO_SCROLL_INTERVAL = 3000; // 3 seconds

  // Auto-scroll functionality
  const startAutoScroll = () => {
    // Only auto-scroll if there are multiple images
    if (images.length <= 1) return;

    autoScrollInterval.current = setInterval(() => {
      setCurrentIndex((prevIndex) => {
        const nextIndex = (prevIndex + 1) % images.length;
        
        // Scroll to the next image
        scrollViewRef.current?.scrollTo({
          x: nextIndex * cardWidth,
          y: 0,
          animated: true,
        });
        
        return nextIndex;
      });
    }, AUTO_SCROLL_INTERVAL);
  };

  const stopAutoScroll = () => {
    if (autoScrollInterval.current) {
      clearInterval(autoScrollInterval.current);
      autoScrollInterval.current = null;
    }
  };

  // Start auto-scroll on mount
  useEffect(() => {
    startAutoScroll();
    
    // Cleanup on unmount
    return () => {
      stopAutoScroll();
    };
  }, [images.length]);

  const handleScroll = (event: any) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / cardWidth);
    setCurrentIndex(index);
  };

  // Pause auto-scroll when user starts scrolling manually
  const handleScrollBeginDrag = () => {
    stopAutoScroll();
  };

  // Resume auto-scroll after user stops scrolling
  const handleScrollEndDrag = () => {
    startAutoScroll();
  };

  return (
    <View style={styles.carouselContainer}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScrollEndDrag={handleScrollEndDrag}
        scrollEventThrottle={16}
        style={styles.carouselScrollView}
      >
        {images.map((img, index) => (
          <Image
            key={`image-${index}`}
            source={img}
            style={[styles.rentalServiceImage, { width: cardWidth }]}
            resizeMode="cover"
          />
        ))}
      </ScrollView>
      
      {/* Pagination Dots */}
      {images.length > 1 && (
        <View style={styles.paginationContainer}>
          {images.map((_, index) => (
            <View
              key={`dot-${index}`}
              style={[
                styles.paginationDot,
                currentIndex === index && styles.paginationDotActive
              ]}
            />
          ))}
        </View>
      )}

      {/* Verified Badge */}
      {isVerified && (
        <LinearGradient
          colors={[colors.secondary, colors.secondaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.rentalVerifiedBadge}
        >
          <Ionicons name="checkmark" size={12} color="#FFFFFF" />
          <Text style={styles.rentalVerifiedText}>VERIFIED</Text>
        </LinearGradient>
      )}

      {/* Image Count Badge */}
      <View style={styles.rentalImageCount}>
        <Ionicons name="images" size={16} color="#FFFFFF" />
        <Text style={styles.rentalImageCountText}>{images.length}</Text>
      </View>
    </View>
  );
};

export default function RealEstateScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();
  const { section, name } = useLocalSearchParams();
  const [activeSection, setActiveSection] = useState<string | undefined>(Array.isArray(section) ? section[0] : (section as string | undefined));
  const [activeQuickFilter, setActiveQuickFilter] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [properties, setProperties] = useState<Property[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Hide the navigation header
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  // Load properties from database
  useEffect(() => {
    loadProperties();
  }, []);

  const loadProperties = async (searchTerm?: string) => {
    try {
      setIsLoading(true);
      setError(null);
      let listings;
      if (searchTerm && searchTerm.trim()) {
        listings = await PropertyListingsApi.search(searchTerm.trim());
      } else {
        listings = await PropertyListingsApi.list();
      }
      const transformedProperties = listings.map(transformPropertyListing);
      setProperties(transformedProperties);
    } catch (err) {
      console.error('Failed to load properties:', err);
      setError('Failed to load properties. Please try again.');
      setProperties(sampleProperties);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle search
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      loadProperties(query);
    } else {
      loadProperties();
    }
  };

  // Only use backend data (removed AsyncStorage merge)
  const allData: any[] = [...properties];

  // Filter properties based on section parameter (used by older UI fragments)
  const filteredProperties = allData.filter(property => {
    if (section) {
      const label = Array.isArray(section) ? section[0] : section;
      const map: Record<string, (p: any) => boolean> = {
        'Residential': (p) => p.category === 'Residential',
        'Commercial': (p) => p.category === 'Commercial',
        'Industrial': (p) => p.category === 'Industrial',
        'Land & Plots': (p) => p.category === 'Land & Plots',
        'Sale': (p) => p.subcategory === 'Properties for Sale',
        'Short-term Rentals': (p) => p.subcategory === 'Short-term Rentals',
        'PG': (p) => p.subcategory === 'PG Accommodations',
        'Ready to Move': (p) => p.subcategory === 'Ready to Move Properties',
        'Under Construction': (p) => p.subcategory === 'Under Construction Properties',
        'New Launch': (p) => p.subcategory === 'New Launch Properties',
        'Affordable': (p) => p.subcategory === 'Affordable Properties',
        'Mid-range': (p) => p.subcategory === 'Mid-range Properties',
        'Luxury/Premium': (p) => p.subcategory === 'Luxury Properties',
        'Car/Bike Parking': (p) => p.subcategory === 'Parking for Rent' || /parking/i.test(p.title),
      };
      const fn = map[label as string];
      return fn ? fn(property) : true;
    }
    return true;
  });

  const handlePropertyPress = (property: Property) => {
    hapticButtonPress();
    // Navigate to property details page
    router.push({
      pathname: '/realestate/[id]',
      params: {
        id: property.id,
      },
    });
  };

  const handleCallDealer = (property: Property) => {
    hapticButtonPress();
    Alert.alert('Call Dealer', `Calling ${property.dealerName}...`);
  };

  const handleWhatsAppDealer = (property: Property) => {
    hapticButtonPress();
    Alert.alert('WhatsApp', `Opening WhatsApp chat with ${property.dealerName}...`);
  };

  const handleViewNumber = (property: Property) => {
    hapticButtonPress();
    Alert.alert('View Number', `Showing contact number for ${property.dealerName}...`);
  };

  const handleShare = async (property: Property) => {
    try {
      hapticButtonPress();
      await Share.share({
        message: `${property.title} — ${property.location}\nPrice: ${property.price}`,
        title: property.title,
      });
    } catch (e) {
      // no-op
    }
  };

  return (
    <>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} translucent />
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        {/* Header spacer to match Home header vertical padding */}
        <View style={styles.headerSpacer} />

        {/* Premium Back + Search */}
        <View style={styles.premiumHeaderRow}>
          <TouchableOpacity
            onPress={() => { hapticButtonPress(); router.back(); }}
            style={styles.premiumBackBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>

          <View style={[styles.premiumSearchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.searchIconContainer}>
              <Ionicons name="search" size={20} color={colors.textTertiary} />
            </View>
            <TextInput
              placeholder="Search City/Locality/Project"
              placeholderTextColor={colors.textTertiary}
              style={[styles.premiumSearchInput, { color: colors.text }]}
              value={searchQuery}
              onChangeText={handleSearch}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 ? (
              <TouchableOpacity 
                onPress={() => {
                  setSearchQuery('');
                  loadProperties();
                }} 
                style={styles.premiumClearButton}
              >
                <Ionicons name="close-circle" size={20} color={colors.textTertiary} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Main Scrollable Content */}
        <ScrollView
          style={[styles.mainScrollView, { backgroundColor: colors.background }]}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.mainScrollContent, { paddingHorizontal: 8 }]}
        >
          {/* Loading State */}
          {isLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.secondary} />
              <Text style={[styles.loadingText, { color: colors.text }]}>Loading properties...</Text>
            </View>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={48} color={colors.textSecondary} />
              <Text style={[styles.errorText, { color: colors.text }]}>{error}</Text>
              <TouchableOpacity
                style={[styles.retryButton, { backgroundColor: colors.secondary }]}
                onPress={() => {
                  loadProperties();
                }}
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Properties Content */}
          {!isLoading && !error && (
            <>
              {/* Empty State when no properties */}
              {properties.length === 0 && (
                <View style={styles.emptyContainer}> 
                  <Ionicons name="home-outline" size={80} color={colors.textSecondary} />
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>No Properties Available</Text>
                  <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>Be the first to list your property!</Text>
                  <TouchableOpacity
                    style={[styles.emptyAddButton, { backgroundColor: colors.secondary }]}
                    onPress={() => {
                      hapticButtonPress();
                      router.push('/realestate/person' as any);
                    }}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="add-circle" size={20} color="#fff" />
                    <Text style={styles.emptyAddButtonText}>Post a Property</Text>
                  </TouchableOpacity>
                </View>
              )}
              {/* Dynamic Sections - two cards per filter */}
              {(() => {
            // Helpers for quick filters
            const parsePriceToLac = (price: string): number | null => {
              try {
                // Normalize
                const clean = price.replace(/[^0-9.,A-Za-z/ ]/g, '').toLowerCase();
                if (clean.includes('cr')) {
                  const num = parseFloat(clean.replace(/[^0-9.]/g, ''));
                  if (!isNaN(num)) return num * 100; // 1 Cr = 100 Lacs
                }
                if (clean.includes('lac') || clean.includes('lacs')) {
                  const num = parseFloat(clean.replace(/[^0-9.]/g, ''));
                  if (!isNaN(num)) return num;
                }
                if (clean.includes('/month') || clean.includes('month')) {
                  // Rough conversion: 1 Lac/month treated as 1 Lac for filtering
                  const num = parseFloat(clean.replace(/[^0-9.]/g, ''));
                  if (!isNaN(num)) return num; 
                }
              } catch {}
              return null;
            };

            const matchesQuickFilter = (p: Property): boolean => {
              switch (activeQuickFilter) {
                case 'budget': {
                  const lac = parsePriceToLac(p.price);
                  if (lac === null) return false;
                  // Budget threshold: <= 100 Lacs or rent <= 0.5 Lac/month
                  return lac <= 100 && lac > 0;
                }
                case 'furnished': {
                  // Approximate: treat Super Area or Featured as proxy for furnished
                  return p.isFeatured || p.areaType === 'Super Area';
                }
                case 'bachelor': {
                  return p.subcategory === 'PG Accommodations' || /single room|shared room/i.test(p.area);
                }
                case 'parking': {
                  return /parking|garage|car/i.test(p.title) || /sector|cyber city/i.test(p.location);
                }
                case 'petFriendly': {
                  return /pet|pets/i.test(p.title) || /villa|independent/i.test(p.title);
                }
                case 'newlyBuilt': {
                  return /new launch|ready to move|under construction|new/i.test(p.title) || p.postedDays <= 2;
                }
                case 'gated': {
                  return /gated|community|society/i.test(p.title);
                }
                case 'lowDeposit': {
                  return /deposit\s*(1|one)\s*month/i.test(p.deposit) || /no deposit|low deposit/i.test(p.deposit);
                }
                // Parking-specific filters
                case 'open': {
                  return /open|outdoor|uncovered/i.test(p.title) || /open/i.test(p.areaType);
                }
                case 'covered': {
                  return /covered|sheltered|roofed|indoor/i.test(p.title) || /covered/i.test(p.areaType);
                }
                case 'basement': {
                  return /basement|underground/i.test(p.title) || /basement/i.test(p.areaType);
                }
                default:
                  return false;
              }
            };

            // Treat these as specific subcategories; items in these should not also appear in broad category sections
            const narrowSubSet = new Set([
              'Properties for Sale',
              'Properties for Rent',
              'Short-term Rentals',
              'PG Accommodations',
              'Ready to Move Properties',
              'Under Construction Properties',
              'New Launch Properties',
              'Affordable Properties',
              'Mid-range Properties',
              'Luxury Properties',
            ]);
            const isNarrowSub = (s: string) => narrowSubSet.has(s);

            const sections = [
              { key: 'Residential', title: 'Residential', aliases: ['Residential Properties'], match: (p: Property) => p.category === 'Residential' && !isNarrowSub(p.subcategory) },
              { key: 'Commercial', title: 'Commercial', aliases: ['Commercial Properties'], match: (p: Property) => p.category === 'Commercial' && !isNarrowSub(p.subcategory) },
              { key: 'Industrial', title: 'Industrial', aliases: ['Industrial Properties'], match: (p: Property) => p.category === 'Industrial' && !isNarrowSub(p.subcategory) },
              { key: 'Land & Plots', title: 'Land & Plots', match: (p: Property) => p.category === 'Land & Plots' && !isNarrowSub(p.subcategory) },
              { key: 'Properties for Sale', title: 'Sale', aliases: ['Sale'], match: (p: Property) => p.subcategory === 'Properties for Sale' },
              { key: 'Short-term Rentals', title: 'Short-term Rentals', aliases: ['Short-term Rentals'], match: (p: Property) => p.subcategory === 'Short-term Rentals' },
              { key: 'PG Accommodations', title: 'PG', aliases: ['PG'], match: (p: Property) => p.subcategory === 'PG Accommodations' },
              { key: 'Under Construction Properties', title: 'Under Construction', aliases: ['Under Construction'], match: (p: Property) => p.subcategory === 'Under Construction Properties' },
              { key: 'Ready to Move Properties', title: 'Ready to Move', aliases: ['Ready to Move'], match: (p: Property) => p.subcategory === 'Ready to Move Properties' },
              { key: 'New Launch Properties', title: 'New Launch', aliases: ['New Launch'], match: (p: Property) => p.subcategory === 'New Launch Properties' },
              { key: 'Affordable Properties', title: 'Affordable', aliases: ['Affordable'], match: (p: Property) => p.subcategory === 'Affordable Properties' },
              { key: 'Mid-range Properties', title: 'Mid-range', aliases: ['Mid-range', 'Mid range'], match: (p: Property) => p.subcategory === 'Mid-range Properties' },
              { key: 'Luxury Properties', title: 'Luxury/Premium', aliases: ['Luxury', 'Luxury/Premium', 'Premium'], match: (p: Property) => p.subcategory === 'Luxury Properties' },
            ];

            // Build initial order
            const order = sections.slice();
            const normalize = (val: unknown) =>
              typeof val === 'string'
                ? val.trim().toLowerCase().replace(/\s+/g, ' ')
                : '';
            const sectionValue = Array.isArray(activeSection) ? activeSection[0] : (activeSection as string | undefined);
            const sectionNorm = normalize(sectionValue);
            const idx = sectionNorm
              ? order.findIndex(s => {
                  const candidates = [s.key, s.title, ...((s as any).aliases || [])];
                  return candidates.map(normalize).includes(sectionNorm);
                })
              : -1;
            if (idx > -1) {
              const [picked] = order.splice(idx, 1);
              order.unshift(picked);
            }

            // If a quick filter is active, create a synthetic section at top
            const filteredByQuick = activeQuickFilter ? allData.filter(matchesQuickFilter).slice(0, 2) : [];

            const renderCard = (item: Property) => {
              // Prepare images array (limit to 5 images)
              const displayImages = item.images && item.images.length > 0 
                ? item.images.slice(0, 5) 
                : [item.image];

              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.rentalServiceCard, { backgroundColor: colors.surface }]}
                  onPress={() => {
                    hapticButtonPress();
                    handlePropertyPress(item);
                  }}
                  activeOpacity={0.9}
                >
                  <View style={styles.rentalImageContainer}>
                    <ImageCarousel 
                      images={displayImages}
                      isVerified={item.isVerified}
                      colors={colors}
                    />
                  </View>
                <View style={styles.rentalServiceDetails}>
                  <Text style={[styles.rentalLocation, { color: colors.textSecondary }]}>{item.location}</Text>
                  <Text style={[styles.rentalTitle, { color: colors.text }]} numberOfLines={2}>{item.title}</Text>
                  <Text style={[styles.rentalPrice, { color: colors.secondary }]}>{item.price}</Text>
                  <Text style={[styles.rentalDeposit, { color: colors.textSecondary }]}>{item.deposit}</Text>
                  <Text style={[styles.rentalArea, { color: colors.text }]}>{item.area}</Text>
                  <Text style={[styles.rentalAreaType, { color: colors.textTertiary }]}>{item.areaType}</Text>
                </View>
                <View style={styles.rentalDealerInfo}>
                  <Text style={[styles.rentalPostedTime, { color: colors.textTertiary }]}>{item.postedDays}d ago</Text>
                  <View style={styles.rentalDealerDetails}>
                    <View style={styles.rentalDealerAvatar}>
                      <Ionicons name="person" size={16} color={colors.textTertiary} />
                    </View>
                    {item.isFeatured && (
                      <View style={styles.rentalFeaturedBadge}>
                        <Text style={styles.rentalFeaturedText}>FEATURED DEALER</Text>
                      </View>
                    )}
                    <Text style={[styles.rentalDealerName, { color: colors.text }]} numberOfLines={1}>{item.dealerName}</Text>
                  </View>
                </View>
                <View style={styles.rentalActionButtons}>
                  <TouchableOpacity onPress={() => handleViewNumber(item)} activeOpacity={0.9} style={{ flex: 1 }}>
                    <LinearGradient
                      colors={[colors.secondary, colors.secondaryDark]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.gradientPrimaryBtn}
                    >
                      <Text style={styles.rentalViewNumberText}>Contact owner</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleShare(item)} activeOpacity={0.9}>
                    <LinearGradient
                      colors={[colors.secondary, colors.secondaryDark]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.rentalShareButton}
                    >
                      <Ionicons name="share-social" size={20} color="#FFFFFF" />
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
              );
            };

            const rendered: any[] = [];
            if (filteredByQuick.length > 0) {
              rendered.push(
                <View key={`quick-${activeQuickFilter}`} style={[styles.rentalServicesSection, { backgroundColor: colors.background }]}>
                  <Text style={[styles.rentalServicesTitle, { color: colors.text }]}>
                    {activeQuickFilter === 'budget' && 'Budget Matches'}
                    {activeQuickFilter === 'furnished' && 'Furnished Picks'}
                    {activeQuickFilter === 'bachelor' && 'Bachelor-friendly'}
                    {activeQuickFilter === 'parking' && 'Parking Available'}
                    {activeQuickFilter === 'petFriendly' && 'Pet-friendly'}
                    {activeQuickFilter === 'newlyBuilt' && 'Newly Built'}
                    {activeQuickFilter === 'gated' && 'Gated Community'}
                    {activeQuickFilter === 'lowDeposit' && 'Low Deposit'}
                    {activeQuickFilter === 'open' && 'Open Parking'}
                    {activeQuickFilter === 'covered' && 'Covered Parking'}
                    {activeQuickFilter === 'basement' && 'Basement Parking'}
                  </Text>
                  <View style={styles.rentalServicesContainer}>{filteredByQuick.map(renderCard)}</View>
                </View>
              );
            }

            rendered.push(...order.map(sectionCfg => {
              const items = allData.filter(sectionCfg.match).slice(0, 2);
              if (items.length === 0) return null;
              return (
                <View key={sectionCfg.key} style={[styles.rentalServicesSection, { backgroundColor: colors.background }]}>
                  <Text style={[styles.rentalServicesTitle, { color: colors.text }]}>{sectionCfg.title}</Text>
                  <View style={styles.rentalServicesContainer}>
                    {items.map(renderCard)}
                  </View>
                </View>
              );
            }));
            return rendered;
          })()}
            </>
          )}

          {/* All Properties section removed as requested */}
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingTop: 20 },
  headerSpacer: { height: 25 },
  
  // Premium Header Styles
  premiumHeaderRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    marginBottom: 20,
    marginTop: 5
  },
  premiumBackBtn: { 
    width: 44, 
    height: 44, 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: 10,
  },
  premiumSearchBar: { 
    flex: 1, 
    flexDirection: 'row', 
    backgroundColor: '#FFFFFF', 
    borderRadius: 25, 
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    height: 50,
    alignItems: 'center',
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  searchIconContainer: {
    marginRight: 12,
    opacity: 0.7
  },
  premiumSearchInput: { 
    flex: 1, 
    color: '#333', 
    fontSize: 16,
    height: '100%',
  },
  premiumClearButton: {
    padding: 4,
    marginLeft: 8
  },
  filterBar: {
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  filterContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Main scrollable content
  mainScrollView: {
    flex: 1,
  },
  mainScrollContent: {
    paddingBottom: 20,
    flexGrow: 1,
  },
  // Properties section
  propertiesSection: {
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  propertiesTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
  },
  propertiesContainer: {
    gap: 16,
  },
  // Legacy scroll styles (kept for compatibility)
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  propertyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  imageContainer: {
    position: 'relative',
    height: 200,
  },
  propertyImage: {
    width: '100%',
    height: '100%',
  },
  verifiedBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  verifiedText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  imageActions: {
    position: 'absolute',
    top: 12,
    right: 12,
    gap: 8,
  },
  imageActionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageCount: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  imageCountText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  propertyDetails: {
    padding: 16,
  },
  location: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    lineHeight: 22,
  },
  price: {
    fontSize: 18,
    fontWeight: '700',
    color: '#004c8f', // colors.secondary
    marginBottom: 4,
  },
  deposit: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  area: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  areaType: {
    fontSize: 12,
    color: '#999',
  },
  dealerInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  postedTime: {
    fontSize: 12,
    color: '#999',
  },
  dealerDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginLeft: 8,
  },
  dealerAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featuredBadge: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  featuredText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '700',
  },
  dealerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  viewNumberButton: {
    flex: 1,
    backgroundColor: '#26A69A',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  viewNumberText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  whatsappButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#25D366',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#25D366',
    alignItems: 'center',
    justifyContent: 'center',
  },
  callButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#26A69A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Category Cards Styles
  categoriesSection: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  categoriesTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
  },
  categoriesContainer: {
    paddingRight: 16,
    gap: 16,
  },
  categoryCard: {
    width: 160,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  categoryImageContainer: {
    position: 'relative',
    height: 120,
  },
  categoryImage: {
    width: '100%',
    height: '100%',
  },
  categoryBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryCount: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  categoryDetails: {
    padding: 12,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  categorySubtitle: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
  },
  // Rental Services Styles
  rentalServicesSection: {
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  rentalServicesTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
  },
  rentalServicesContainer: {
    gap: 16,
  },
  rentalServiceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  rentalImageContainer: {
    position: 'relative',
    height: 200,
  },
  kebabButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)'
  },
  rentalServiceImage: {
    width: '100%',
    height: '100%',
  },
  rentalVerifiedBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  rentalVerifiedText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  rentalImageActions: {
    position: 'absolute',
    top: 12,
    right: 12,
    gap: 8,
  },
  rentalImageActionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rentalImageCount: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  rentalImageCountText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  rentalServiceDetails: {
    padding: 16,
  },
  rentalLocation: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  rentalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    lineHeight: 22,
  },
  rentalPrice: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  rentalDeposit: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  rentalArea: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  rentalAreaType: {
    fontSize: 12,
    color: '#999',
  },
  rentalDealerInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  rentalPostedTime: {
    fontSize: 12,
    color: '#999',
  },
  rentalDealerDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginLeft: 8,
  },
  rentalDealerAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rentalFeaturedBadge: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  rentalFeaturedText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '700',
  },
  rentalDealerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  rentalActionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  rentalViewNumberButton: {
    flex: 1,
    backgroundColor: '#26A69A',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  gradientPrimaryBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rentalViewNumberText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  rentalWhatsappButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#25D366',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rentalShareButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rentalCallButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#26A69A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Loading and Error States
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  // Image Carousel Styles
  carouselContainer: {
    position: 'relative',
    height: 200,
  },
  carouselScrollView: {
    height: 200,
  },
  paginationContainer: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  paginationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  paginationDotActive: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  // Empty state styles
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 400,
    paddingVertical: 60,
    paddingHorizontal: 32,
    width: '100%',
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  emptyAddButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});