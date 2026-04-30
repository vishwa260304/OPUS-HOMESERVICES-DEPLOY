import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Image, ActivityIndicator, RefreshControl, Alert, Dimensions } from 'react-native';
import { useRouter, useNavigation, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { hapticButtonPress, hapticSuccess } from '../../utils/haptics';
import { ParkingRentalsApi, ParkingRental } from '../../lib/parkingRentals';
import { supabase } from '../../lib/supabase';

const { width: screenWidth } = Dimensions.get('window');
const CARD_WIDTH = screenWidth - 32; // Account for padding

// Auto-scrolling Image Carousel Component
interface ImageCarouselProps {
  images: string[];
  placeholderIcon?: keyof typeof Ionicons.glyphMap;
  colors: any;
}

const ImageCarousel: React.FC<ImageCarouselProps> = ({ images, placeholderIcon = 'car', colors }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (images && images.length > 1) {
      // Auto-scroll every 3 seconds
      intervalRef.current = setInterval(() => {
        setCurrentIndex((prevIndex) => {
          const nextIndex = (prevIndex + 1) % images.length;
          scrollViewRef.current?.scrollTo({
            x: nextIndex * CARD_WIDTH,
            animated: true,
          });
          return nextIndex;
        });
      }, 3000) as unknown as number;
    }

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, [images]);

  const handleScroll = (event: any) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / CARD_WIDTH);
    setCurrentIndex(index);
  };

  if (!images || images.length === 0) {
    return (
      <View style={[styles.parkingImagePlaceholder, { backgroundColor: colors.background }]}>
        <Ionicons name={placeholderIcon} size={48} color={colors.textSecondary} />
      </View>
    );
  }

  return (
    <View style={styles.carouselContainer}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={styles.imageScrollView}
      >
        {images.map((imageUri, index) => (
          <Image
            key={`${imageUri}-${index}`}
            source={{ uri: imageUri }}
            style={[styles.parkingImage, { width: CARD_WIDTH }]}
            resizeMode="cover"
          />
        ))}
      </ScrollView>

      {/* Pagination Dots */}
      {images.length > 1 && (
        <View style={styles.paginationContainer}>
          {images.map((_, index) => (
            <View
              key={index}
              style={[
                styles.paginationDot,
                {
                  backgroundColor: index === currentIndex ? '#fff' : 'rgba(255, 255, 255, 0.5)',
                  width: index === currentIndex ? 8 : 6,
                  height: index === currentIndex ? 8 : 6,
                },
              ]}
            />
          ))}
        </View>
      )}

      {/* Image Counter */}
      {images.length > 1 && (
        <View style={styles.imageCounter}>
          <Text style={styles.imageCounterText}>
            {currentIndex + 1}/{images.length}
          </Text>
        </View>
      )}
    </View>
  );
};

export default function ParkingRentalsListScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();
  const params = useLocalSearchParams();

  const [parkingRentals, setParkingRentals] = useState<ParkingRental[]>([]);
  const [filteredRentals, setFilteredRentals] = useState<ParkingRental[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string>('All');

  const parkingTypeFilters = ['All', 'Open', 'Covered', 'Basement', 'Multi-level'];

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
    loadParkingRentals();
  }, [navigation]);

  const loadParkingRentals = async () => {
    try {
      setLoading(true);
      // Fetch all parking rentals (including pending ones)
      const { data, error } = await supabase
        .from('parking_rentals')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setParkingRentals(data || []);
      setFilteredRentals(data || []);
    } catch (error) {
      console.error('Error loading parking rentals:', error);
      Alert.alert('Error', 'Failed to load parking rentals. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadParkingRentals();
    setRefreshing(false);
  }, []);

  useEffect(() => {
    if (selectedFilter === 'All') {
      setFilteredRentals(parkingRentals);
    } else {
      const filtered = parkingRentals.filter(
        rental => rental.parking_type === selectedFilter
      );
      setFilteredRentals(filtered);
    }
  }, [selectedFilter, parkingRentals]);

  const handleFilterPress = (filter: string) => {
    hapticButtonPress();
    setSelectedFilter(filter);
  };

  const handleRentalPress = (rental: ParkingRental) => {
    hapticButtonPress();
    if (!rental.id) return;
    router.push({ pathname: '/realestate/parking-rental/[id]', params: { id: rental.id } });
  };

  const renderParkingCard = (rental: ParkingRental) => {
    const hasPhotos = rental.parking_photos && rental.parking_photos.length > 0;
    const parkingPhotos = hasPhotos ? rental.parking_photos || [] : [];

    return (
      <TouchableOpacity
        key={rental.id}
        style={[styles.parkingCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        activeOpacity={0.8}
        onPress={() => handleRentalPress(rental)}
      >
        {/* Image Carousel Section */}
        <ImageCarousel images={parkingPhotos} placeholderIcon="car" colors={colors} />

        {/* Type Badge */}
        <View style={[styles.typeBadge, { backgroundColor: getTypeColor(rental.parking_type) }]}>
          <Text style={styles.typeBadgeText}>{rental.parking_type}</Text>
        </View>

        {/* Content Section */}
        <View style={styles.parkingContent}>
          {/* Location */}
          <View style={styles.locationRow}>
            <Ionicons name="location" size={16} color={colors.secondary} />
            <Text style={[styles.parkingLocation, { color: colors.text }]} numberOfLines={1}>
              {rental.parking_location}
            </Text>
          </View>

          {/* Building Name (if available) */}
          {rental.building_name && (
            <Text style={[styles.buildingName, { color: colors.textSecondary }]} numberOfLines={1}>
              {rental.building_name}
            </Text>
          )}

          {/* Details Row */}
          <View style={styles.detailsRow}>
            {/* Vehicle Type */}
            <View style={styles.detailItem}>
              <Ionicons name={getVehicleIcon(rental.vehicle_allowed)} size={14} color={colors.textSecondary} />
              <Text style={[styles.detailText, { color: colors.textSecondary }]}>{rental.vehicle_allowed}</Text>
            </View>

            {/* Dimensions (if available) */}
            {rental.length && rental.width && (
              <View style={styles.detailItem}>
                <Ionicons name="resize-outline" size={14} color={colors.textSecondary} />
                <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                  {rental.length}×{rental.width}m
                </Text>
              </View>
            )}
          </View>

          {/* Price Row */}
          <View style={styles.priceRow}>
            <View style={[styles.priceContainer, { backgroundColor: colors.secondary + '15' }]}>
              <Text style={[styles.priceAmount, { color: colors.secondary }]}>
                ₹{rental.rent_amount}
              </Text>
              <Text style={[styles.pricePeriod, { color: colors.secondary }]}>
                /{rental.rent_period}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.viewButton, { backgroundColor: colors.secondary }]}
              onPress={() => handleRentalPress(rental)}
            >
              <Text style={styles.viewButtonText}>View Details</Text>
              <Ionicons name="arrow-forward" size={14} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const getTypeColor = (type: string): string => {
    switch (type) {
      case 'Open': return '#3B82F6';
      case 'Covered': return '#10B981';
      case 'Basement': return '#8B5CF6';
      case 'Multi-level': return '#F59E0B';
      default: return '#6B7280';
    }
  };

  const getVehicleIcon = (vehicleType: string): any => {
    if (vehicleType === 'Car') return 'car';
    if (vehicleType === 'Bike') return 'bicycle';
    return 'car';
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent />

      {/* Header */}
      <LinearGradient
        colors={isDark ? ['#1a1a1a', colors.background] : [colors.secondary + '15', colors.background]}
        style={styles.headerGradient}
      >
        <View style={styles.headerSpacer} />
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => {
              hapticButtonPress();
              router.back();
            }}
            style={[styles.iconBtn, { backgroundColor: colors.card }]}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Parking Rentals</Text>
            <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
              Available parking spaces
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              hapticButtonPress();
              router.push('/realestate/car-parking-rental');
            }}
            style={[styles.iconBtn, { backgroundColor: colors.secondary }]}
          >
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Filter Bar */}
      <View style={[styles.filterBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContent}>
          {parkingTypeFilters.map((filter) => (
            <TouchableOpacity
              key={filter}
              style={[
                styles.filterChip,
                {
                  backgroundColor: selectedFilter === filter ? colors.secondary : colors.card,
                  borderColor: selectedFilter === filter ? colors.secondary : colors.border,
                },
              ]}
              onPress={() => handleFilterPress(filter)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: selectedFilter === filter ? '#fff' : colors.text },
                ]}
              >
                {filter}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.secondary]} />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.secondary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading parking rentals...</Text>
          </View>
        ) : filteredRentals.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="car-outline" size={64} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No Parking Available</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              {selectedFilter === 'All'
                ? 'Be the first to list your parking space!'
                : `No ${selectedFilter.toLowerCase()} parking spaces available`}
            </Text>
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: colors.secondary }]}
              onPress={() => {
                hapticButtonPress();
                router.push('/realestate/car-parking-rental');
              }}
            >
              <Ionicons name="add-circle" size={20} color="#fff" />
              <Text style={styles.addButtonText}>List Your Parking</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.resultsHeader}>
              <Text style={[styles.resultsCount, { color: colors.text }]}>
                {filteredRentals.length} {filteredRentals.length === 1 ? 'Parking' : 'Parkings'} Available
              </Text>
            </View>
            {filteredRentals.map((rental) => renderParkingCard(rental))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  headerGradient: {
    paddingTop: 0,
    paddingBottom: 16,
  },
  headerSpacer: {
    height: 50,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 0,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  filterBar: {
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  filterContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  resultsHeader: {
    marginBottom: 16,
  },
  resultsCount: {
    fontSize: 16,
    fontWeight: '700',
  },
  parkingCard: {
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  carouselContainer: {
    width: '100%',
    height: 180,
    position: 'relative',
  },
  imageScrollView: {
    width: '100%',
    height: 180,
  },
  parkingImage: {
    width: '100%',
    height: 180,
  },
  parkingImagePlaceholder: {
    width: '100%',
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paginationContainer: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  paginationDot: {
    borderRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  imageCounter: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  imageCounterText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  typeBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  typeBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  parkingContent: {
    padding: 16,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 6,
  },
  parkingLocation: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  buildingName: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 12,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 16,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: 12,
    fontWeight: '500',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  priceAmount: {
    fontSize: 18,
    fontWeight: '800',
  },
  pricePeriod: {
    fontSize: 12,
    fontWeight: '600',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  viewButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});

