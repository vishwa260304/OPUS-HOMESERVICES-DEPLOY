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
  Alert,
  ActivityIndicator,
  RefreshControl,
  BackHandler,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useNavigation, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { hapticButtonPress, hapticSuccess } from '../../utils/haptics';
import { getUserPropertyListings, deletePropertyListing, PropertyListing } from '../../lib/propertyListings';
import { ParkingRentalsApi, ParkingRental } from '../../lib/parkingRentals';
import { useAuth } from '../../context/AuthContext';

const { width } = Dimensions.get('window');

type TabType = 'properties' | 'parking';

// Image Carousel Component for Listing Cards
const ListingImageCarousel = ({ images, onPress }: { images: any[], onPress: () => void }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollViewRef = React.useRef<ScrollView>(null);
  const autoScrollInterval = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const AUTO_SCROLL_INTERVAL = 3000; // 3 seconds

  const startAutoScroll = () => {
    if (images.length <= 1) return;

    autoScrollInterval.current = setInterval(() => {
      setCurrentIndex((prevIndex) => {
        const nextIndex = (prevIndex + 1) % images.length;
        scrollViewRef.current?.scrollTo({
          x: nextIndex * (width - 32),
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

  useEffect(() => {
    startAutoScroll();
    return () => {
      stopAutoScroll();
    };
  }, [images.length]);

  const handleScroll = (event: any) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / (width - 32));
    setCurrentIndex(index);
  };

  const handleScrollBeginDrag = () => {
    stopAutoScroll();
  };

  const handleScrollEndDrag = () => {
    startAutoScroll();
  };

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={styles.carouselContainer}>
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
        {images.map((img, idx) => (
          <Image key={idx} source={img} style={styles.carouselImage} resizeMode="cover" />
        ))}
      </ScrollView>
      
      {/* Pagination Dots */}
      {images.length > 1 && (
        <View style={styles.carouselPaginationContainer}>
          {images.map((_, index) => (
            <View
              key={`dot-${index}`}
              style={[
                styles.carouselPaginationDot,
                currentIndex === index && styles.carouselPaginationDotActive
              ]}
            />
          ))}
        </View>
      )}

      {/* Image Counter */}
      {images.length > 1 && (
        <View style={styles.carouselImageCounter}>
          <Ionicons name="images" size={12} color="#FFFFFF" />
          <Text style={styles.carouselImageCounterText}>{currentIndex + 1}/{images.length}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

export default function MyListingsScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams();
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  
  const [activeTab, setActiveTab] = useState<TabType>('properties');
  const [listings, setListings] = useState<PropertyListing[]>([]);
  const [parkingRentals, setParkingRentals] = useState<ParkingRental[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hide the navigation header
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  // Handle back navigation when coming from success page
  useEffect(() => {
    const fromSuccess = params.fromSuccess === 'true';
    
    if (fromSuccess) {
      // Ensure back navigation routes to services page
      const onBackPress = () => {
        router.replace('/(tabs)');
        return true; // prevent default back behavior
      };
      const backSub = BackHandler.addEventListener('hardwareBackPress', onBackPress);

      // Intercept only explicit back/pop actions to avoid loops
      let unsub: any = null;
      unsub = navigation.addListener('beforeRemove', (e: any) => {
        const actionType = e?.data?.action?.type;
        if (actionType === 'GO_BACK' || actionType === 'POP') {
          e.preventDefault();
          // Detach listener before redirect to prevent recursive triggers
          if (unsub) unsub();
          router.replace('/(tabs)');
        }
      });

      return () => {
        backSub.remove();
        if (unsub) unsub();
      };
    }
  }, [navigation, router, params.fromSuccess]);

  // Load user's property listings and parking rentals
  const loadListings = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const [propertyResult, parkingResult] = await Promise.all([
        getUserPropertyListings(),
        user?.id ? ParkingRentalsApi.getUserParkingRentals(user.id) : Promise.resolve([])
      ]);
      
      if (propertyResult.error) {
        console.error('Property fetch error:', propertyResult.error);
      }
      
      setListings(propertyResult.data || []);
      setParkingRentals(Array.isArray(parkingResult) ? parkingResult : []);
    } catch (err) {
      console.error('Failed to load listings:', err);
      setError('Failed to load your listings. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Refresh listings
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadListings();
    setIsRefreshing(false);
  };

  useEffect(() => {
    loadListings();
  }, []);

  // Handle delete property
  const handleDelete = (listing: PropertyListing) => {
    Alert.alert(
      'Delete Property',
      `Are you sure you want to delete "${listing.title || listing.bhk_type + ' ' + listing.apartment_type}"? This action cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              hapticButtonPress();
              
              const { error: deleteError } = await deletePropertyListing(listing.id!);
              
              if (deleteError) {
                throw deleteError;
              }
              
              // Remove from local state
              setListings(prev => prev.filter(item => item.id !== listing.id));
              
              hapticSuccess();
              Alert.alert('Success', 'Property deleted successfully');
            } catch (err) {
              console.error('Failed to delete property:', err);
              Alert.alert('Error', 'Failed to delete property. Please try again.');
            }
          },
        },
      ]
    );
  };

  // Handle delete parking rental
  const handleDeleteParking = (parking: ParkingRental) => {
    Alert.alert(
      'Delete Parking Listing',
      `Are you sure you want to delete parking at "${parking.parking_location}"? This action cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              hapticButtonPress();
              
              if (!parking.id) {
                throw new Error('Parking ID is missing');
              }
              
              await ParkingRentalsApi.deleteParkingRental(parking.id);
              
              // Remove from local state
              setParkingRentals(prev => prev.filter(item => item.id !== parking.id));
              
              hapticSuccess();
              Alert.alert('Success', 'Parking listing deleted successfully');
            } catch (err) {
              console.error('Failed to delete parking:', err);
              Alert.alert('Error', 'Failed to delete parking listing. Please try again.');
            }
          },
        },
      ]
    );
  };

  // Handle view property details
  const handleViewProperty = (listing: PropertyListing) => {
    hapticButtonPress();
    if (!listing.id) return;
    router.push({
      pathname: '/realestate/[id]',
      params: {
        id: listing.id,
      },
    });
  };

  // Handle back button press
  const handleBackPress = () => {
    hapticButtonPress();
    const fromSuccess = params.fromSuccess === 'true';
    if (fromSuccess) {
      router.replace('/(tabs)');
    } else {
      router.back();
    }
  };

  // Check if both types of listings are empty
  const hasNoListings = listings.length === 0 && parkingRentals.length === 0;
  
  // Render empty state
  if (!isLoading && !error && hasNoListings) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent />
        
        {/* Header */}
        <View style={styles.headerSpacer} />
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={handleBackPress}
            style={[styles.headerBtn, { backgroundColor: colors.card }]}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>My Listings</Text>
          <View style={styles.headerRight} />
        </View>

        <View style={styles.emptyContainer}>
          <Ionicons name="home-outline" size={80} color={colors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No Listings Yet</Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            You haven't posted anything yet.{'\n'}Choose an option below to get started!
          </Text>
          
          {/* Two Action Cards */}
          <View style={styles.emptyActionContainer}>
            {/* Property Listing Card */}
            <TouchableOpacity
              style={[styles.emptyActionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => {
                hapticButtonPress();
                router.push('/realestate/person' as any);
              }}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={['#3B82F6', '#2563EB']}
                style={styles.emptyActionIcon}
              >
                <Ionicons name="home" size={28} color="#FFFFFF" />
              </LinearGradient>
              <Text style={[styles.emptyActionTitle, { color: colors.text }]}>Property</Text>
              <Text style={[styles.emptyActionSubtitle, { color: colors.textSecondary }]}>
                List your apartment, house, or commercial space
              </Text>
              <View style={[styles.emptyActionButton, { backgroundColor: colors.secondary + '15' }]}>
                <Text style={[styles.emptyActionButtonText, { color: colors.secondary }]}>Post Property</Text>
                <Ionicons name="arrow-forward" size={16} color={colors.secondary} />
              </View>
            </TouchableOpacity>

            {/* Parking Rental Card */}
            <TouchableOpacity
              style={[styles.emptyActionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => {
                hapticButtonPress();
                router.push('/realestate/car-parking-rental' as any);
              }}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={['#10B981', '#059669']}
                style={styles.emptyActionIcon}
              >
                <Ionicons name="car" size={28} color="#FFFFFF" />
              </LinearGradient>
              <Text style={[styles.emptyActionTitle, { color: colors.text }]}>Parking</Text>
              <Text style={[styles.emptyActionSubtitle, { color: colors.textSecondary }]}>
                Rent out your parking space for cars or bikes
              </Text>
              <View style={[styles.emptyActionButton, { backgroundColor: colors.secondary + '15' }]}>
                <Text style={[styles.emptyActionButtonText, { color: colors.secondary }]}>Post Parking</Text>
                <Ionicons name="arrow-forward" size={16} color={colors.secondary} />
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent />

      {/* Header */}
      <View style={styles.headerSpacer} />
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={handleBackPress}
          style={[styles.headerBtn, { backgroundColor: colors.card }]}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>My Listings</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Tab Selector */}
      <View style={[styles.tabContainer, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'properties' && styles.tabActive,
            { borderBottomColor: activeTab === 'properties' ? colors.secondary : 'transparent' }
          ]}
          onPress={() => {
            hapticButtonPress();
            setActiveTab('properties');
          }}
        >
          <Ionicons 
            name="home" 
            size={20} 
            color={activeTab === 'properties' ? colors.secondary : colors.textSecondary} 
          />
          <Text style={[
            styles.tabText,
            { color: activeTab === 'properties' ? colors.secondary : colors.textSecondary }
          ]}>
            Properties ({listings.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'parking' && styles.tabActive,
            { borderBottomColor: activeTab === 'parking' ? colors.secondary : 'transparent' }
          ]}
          onPress={() => {
            hapticButtonPress();
            setActiveTab('parking');
          }}
        >
          <Ionicons 
            name="car" 
            size={20} 
            color={activeTab === 'parking' ? colors.secondary : colors.textSecondary} 
          />
          <Text style={[
            styles.tabText,
            { color: activeTab === 'parking' ? colors.secondary : colors.textSecondary }
          ]}>
            Parking ({parkingRentals.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Loading State */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.secondary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>Loading your listings...</Text>
        </View>
      ) : error ? (
        /* Error State */
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color={colors.textSecondary} />
          <Text style={[styles.errorText, { color: colors.text }]}>{error}</Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.secondary }]}
            onPress={loadListings}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* Listings */
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.secondary} />
          }
        >
          <View style={styles.statsCard}>
            <Text style={[styles.statsText, { color: colors.textSecondary }]}>
              Total {activeTab === 'properties' ? 'Properties' : 'Parking Spots'}: <Text style={[styles.statsNumber, { color: colors.text }]}>{activeTab === 'properties' ? listings.length : parkingRentals.length}</Text>
            </Text>
          </View>

          {activeTab === 'properties' ? (
            /* Property Listings */
            listings.length === 0 ? (
              <View style={styles.emptyTabContainer}>
                <Ionicons name="home-outline" size={64} color={colors.textSecondary} />
                <Text style={[styles.emptyTabTitle, { color: colors.text }]}>No Property Listings</Text>
                <Text style={[styles.emptyTabText, { color: colors.textSecondary }]}>Post your first property listing.</Text>
                <TouchableOpacity
                  style={[styles.emptyTabButton, { backgroundColor: colors.secondary }]}
                  activeOpacity={0.85}
                  onPress={() => {
                    hapticButtonPress();
                    router.push('/realestate/person' as any);
                  }}
                >
                  <Ionicons name="add-circle" size={18} color="#fff" />
                  <Text style={styles.emptyTabButtonText}>Post a Property</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>


                {listings.map((listing) => {
            // Format price display
            let priceDisplay = 'Contact for Price';
            
            if (listing.property_for === 'rent') {
              priceDisplay = listing.rent_amount ? `₹${listing.rent_amount}/month` : 'Contact for Price';
            } else if (listing.property_for === 'lease') {
              priceDisplay = listing.lease_amount ? `₹${listing.lease_amount}` : 'Contact for Price';
            } else if (listing.property_for === 'sale') {
              priceDisplay = listing.sale_price ? `₹${listing.sale_price}` : 'Contact for Price';
            }

            // Calculate days since posting
            const postedDays = listing.created_at 
              ? Math.floor((Date.now() - new Date(listing.created_at).getTime()) / (1000 * 60 * 60 * 24))
              : 0;

            // Prepare images for carousel
            const images = listing.images && listing.images.length > 0
              ? listing.images.map(url => ({ uri: url }))
              : [require('../../assets/images/Aframe.webp')];

            return (
              <View key={listing.id} style={[styles.listingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {/* Image Carousel */}
                <View style={styles.imageContainer}>
                  <ListingImageCarousel 
                    images={images}
                    onPress={() => handleViewProperty(listing)}
                  />
                  
                  {/* Status Badge */}
                  <View style={[styles.statusBadge, { backgroundColor: listing.status === 'active' ? '#10B981' : '#9CA3AF' }]}>
                    <Text style={styles.statusText}>{listing.status?.toUpperCase()}</Text>
                  </View>

                  {/* Verified Badge */}
                  {listing.is_verified && (
                    <View style={styles.verifiedBadge}>
                      <Ionicons name="shield-checkmark" size={16} color="#FFFFFF" />
                    </View>
                  )}
                </View>

                <TouchableOpacity onPress={() => handleViewProperty(listing)} activeOpacity={0.9}>

                  <View style={styles.listingDetails}>
                    <Text style={[styles.listingTitle, { color: colors.text }]} numberOfLines={2}>
                      {listing.title || `${listing.bhk_type} ${listing.apartment_type}`}
                    </Text>
                    
                    {listing.location && (
                      <View style={styles.locationRow}>
                        <Ionicons name="location" size={14} color={colors.textSecondary} />
                        <Text style={[styles.locationText, { color: colors.textSecondary }]} numberOfLines={1}>
                          {listing.location}
                        </Text>
                      </View>
                    )}

                    <View style={styles.priceRow}>
                      <Text style={[styles.priceText, { color: colors.secondary }]}>{priceDisplay}</Text>
                      <Text style={[styles.postedText, { color: colors.textTertiary }]}>
                        {postedDays === 0 ? 'Today' : `${postedDays}d ago`}
                      </Text>
                    </View>

                    {/* Deposit/Security Information */}
                    {(() => {
                      let depositDisplay = '';
                      if (listing.property_for === 'rent' && listing.deposit_amount) {
                        depositDisplay = `Deposit: ₹${listing.deposit_amount}`;
                      } else if (listing.property_for === 'lease' && listing.security_deposit) {
                        depositDisplay = `Security: ₹${listing.security_deposit}`;
                      } else if (listing.property_for === 'sale' && listing.booking_amount) {
                        depositDisplay = `Booking: ₹${listing.booking_amount}`;
                      }
                      
                      return depositDisplay ? (
                        <Text style={[styles.depositText, { color: colors.textSecondary }]}>
                          {depositDisplay}
                        </Text>
                      ) : null;
                    })()}

                    {/* Property Size */}
                    {listing.property_size && (
                      <Text style={[styles.areaText, { color: colors.text }]}>
                        {listing.property_size}
                      </Text>
                    )}
                    
                    <Text style={[styles.areaTypeText, { color: colors.textSecondary }]}>
                      {listing.bhk_type} {listing.apartment_type}
                    </Text>

                    <View style={styles.detailsRow}>
                      <View style={styles.detailChip}>
                        <Ionicons name="bed-outline" size={14} color={colors.text} />
                        <Text style={[styles.detailText, { color: colors.text }]}>{listing.bhk_type}</Text>
                      </View>
                      {listing.property_size && (
                        <View style={styles.detailChip}>
                          <Ionicons name="crop-outline" size={14} color={colors.text} />
                          <Text style={[styles.detailText, { color: colors.text }]}>{listing.property_size}</Text>
                        </View>
                      )}
                      <View style={styles.detailChip}>
                        <Ionicons name="pricetag-outline" size={14} color={colors.text} />
                        <Text style={[styles.detailText, { color: colors.text }]}>
                          {listing.property_for.charAt(0).toUpperCase() + listing.property_for.slice(1)}
                        </Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>

                {/* Action Buttons */}
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={{ flex: 1 }}
                    onPress={() => handleViewProperty(listing)}
                    activeOpacity={0.9}
                  >
                    <LinearGradient
                      colors={[colors.secondary, colors.secondaryDark]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.viewButton}
                    >
                      <Ionicons name="eye-outline" size={18} color="#FFFFFF" />
                      <Text style={styles.viewButtonText}>View</Text>
                    </LinearGradient>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleDelete(listing)}
                    activeOpacity={0.9}
                  >
                    <View style={[styles.deleteButton, { backgroundColor: '#EF4444' }]}>
                      <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
                );
              })}
              </>
            )
          ) : (
            /* Parking Rentals */
            parkingRentals.length === 0 ? (
              <View style={styles.emptyTabContainer}>
                <Ionicons name="car-outline" size={64} color={colors.textSecondary} />
                <Text style={[styles.emptyTabTitle, { color: colors.text }]}>No Parking Listings</Text>
                <Text style={[styles.emptyTabText, { color: colors.textSecondary }]}>Post your first parking rental.</Text>
                <TouchableOpacity
                  style={[styles.emptyTabButton, { backgroundColor: colors.secondary }]}
                  activeOpacity={0.85}
                  onPress={() => {
                    hapticButtonPress();
                    router.push('/realestate/car-parking-rental' as any);
                  }}
                >
                  <Ionicons name="add-circle" size={18} color="#fff" />
                  <Text style={styles.emptyTabButtonText}>Post Parking</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {parkingRentals.map((parking) => {
                  // Format price display
                  const priceDisplay = `₹${parking.rent_amount}/${parking.rent_period}`;

                  // Calculate days since posting
                  const postedDays = parking.created_at 
                    ? Math.floor((Date.now() - new Date(parking.created_at).getTime()) / (1000 * 60 * 60 * 24))
                    : 0;

                  // Prepare images for carousel
                  const images = parking.parking_photos && parking.parking_photos.length > 0
                    ? parking.parking_photos.map(url => ({ uri: url }))
                    : [require('../../assets/images/carparking_rental.jpg')];

                  return (
                    <View key={parking.id} style={[styles.listingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      {/* Image Carousel */}
                      <View style={styles.imageContainer}>
                        <ListingImageCarousel 
                          images={images}
                          onPress={() => {
                            hapticButtonPress();
                            // Future: Navigate to parking detail page
                            Alert.alert(
                              parking.parking_location,
                              `Type: ${parking.parking_type}\nRent: ${priceDisplay}\nVehicle: ${parking.vehicle_allowed}`
                            );
                          }}
                        />
                        
                        {/* Type Badge */}
                        <View style={[styles.statusBadge, { backgroundColor: getTypeBadgeColor(parking.parking_type) }]}>
                          <Text style={styles.statusText}>{parking.parking_type}</Text>
                        </View>
                      </View>

                      <TouchableOpacity 
                        onPress={() => {
                          hapticButtonPress();
                          Alert.alert(
                            parking.parking_location,
                            `Type: ${parking.parking_type}\nRent: ${priceDisplay}\nVehicle: ${parking.vehicle_allowed}\nBuilding: ${parking.building_name || 'N/A'}\nFloor: ${parking.floor_level || 'N/A'}`
                          );
                        }} 
                        activeOpacity={0.9}
                      >
                        <View style={styles.listingDetails}>
                          <Text style={[styles.listingTitle, { color: colors.text }]} numberOfLines={2}>
                            {parking.parking_type} Parking
                          </Text>
                          
                          <View style={styles.locationRow}>
                            <Ionicons name="location" size={14} color={colors.textSecondary} />
                            <Text style={[styles.locationText, { color: colors.textSecondary }]} numberOfLines={1}>
                              {parking.parking_location}
                            </Text>
                          </View>

                          {parking.building_name && (
                            <Text style={[styles.areaTypeText, { color: colors.textSecondary }]}>
                              {parking.building_name}
                            </Text>
                          )}

                          <View style={styles.priceRow}>
                            <Text style={[styles.priceText, { color: colors.secondary }]}>{priceDisplay}</Text>
                            <Text style={[styles.postedText, { color: colors.textTertiary }]}>
                              {postedDays === 0 ? 'Today' : `${postedDays}d ago`}
                            </Text>
                          </View>

                          {parking.security_deposit && (
                            <Text style={[styles.depositText, { color: colors.textSecondary }]}>
                              Security: ₹{parking.security_deposit}
                            </Text>
                          )}

                          <View style={styles.detailsRow}>
                            <View style={styles.detailChip}>
                              <Ionicons name={parking.vehicle_allowed === 'Car' ? 'car' : parking.vehicle_allowed === 'Bike' ? 'bicycle' : 'car'} size={14} color={colors.text} />
                              <Text style={[styles.detailText, { color: colors.text }]}>{parking.vehicle_allowed}</Text>
                            </View>
                            {parking.length && parking.width && (
                              <View style={styles.detailChip}>
                                <Ionicons name="resize-outline" size={14} color={colors.text} />
                                <Text style={[styles.detailText, { color: colors.text }]}>{parking.length}×{parking.width}m</Text>
                              </View>
                            )}
                            {parking.floor_level && (
                              <View style={styles.detailChip}>
                                <Ionicons name="layers-outline" size={14} color={colors.text} />
                                <Text style={[styles.detailText, { color: colors.text }]}>{parking.floor_level}</Text>
                              </View>
                            )}
                          </View>
                        </View>
                      </TouchableOpacity>

                      {/* Action Buttons */}
                      <View style={styles.actionRow}>
                        <TouchableOpacity
                          style={{ flex: 1 }}
                          onPress={() => {
                            hapticButtonPress();
                            Alert.alert(
                              parking.parking_location,
                              `Type: ${parking.parking_type}\nRent: ${priceDisplay}\nVehicle: ${parking.vehicle_allowed}\nBuilding: ${parking.building_name || 'N/A'}\nFloor: ${parking.floor_level || 'N/A'}\nPayment: ${parking.payment_mode}`
                            );
                          }}
                          activeOpacity={0.9}
                        >
                          <LinearGradient
                            colors={[colors.secondary, colors.secondaryDark]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.viewButton}
                          >
                            <Ionicons name="eye-outline" size={18} color="#FFFFFF" />
                            <Text style={styles.viewButtonText}>View</Text>
                          </LinearGradient>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => handleDeleteParking(parking)}
                          activeOpacity={0.9}
                        >
                          <View style={[styles.deleteButton, { backgroundColor: '#EF4444' }]}>
                            <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
                          </View>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </>
            )
          )}

          <View style={{ height: 20 }} />
        </ScrollView>
      )}
    </View>
  );
}

// Helper function for parking type badge color
const getTypeBadgeColor = (type: string): string => {
  switch (type) {
    case 'Open': return '#3B82F6';
    case 'Covered': return '#10B981';
    case 'Basement': return '#8B5CF6';
    case 'Multi-level': return '#F59E0B';
    default: return '#6B7280';
  }
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerSpacer: { height: 50 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerRight: { width: 36 },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    marginBottom: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    borderBottomWidth: 2,
  },
  tabActive: {
    // Active tab styling handled by border color
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyTabContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyTabTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyTabText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyTabButton: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  emptyTabButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  statsCard: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  statsText: {
    fontSize: 14,
    fontWeight: '600',
  },
  statsNumber: {
    fontSize: 16,
    fontWeight: '700',
  },
  listingCard: {
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  imageContainer: {
    position: 'relative',
    height: 200,
  },
  listingImage: {
    width: '100%',
    height: '100%',
  },
  statusBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  verifiedBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageCountBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  imageCountText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  listingDetails: {
    padding: 16,
  },
  listingTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
    lineHeight: 22,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  locationText: {
    fontSize: 13,
    flex: 1,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  priceText: {
    fontSize: 18,
    fontWeight: '700',
  },
  postedText: {
    fontSize: 12,
  },
  depositText: {
    fontSize: 14,
    marginVertical: 4,
  },
  areaText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
  },
  areaTypeText: {
    fontSize: 13,
    marginTop: 2,
    marginBottom: 8,
  },
  detailsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  detailChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  detailText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    padding: 12,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  viewButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  deleteButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  emptyActionContainer: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    paddingHorizontal: 4,
  },
  emptyActionCard: {
    flex: 1,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  emptyActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyActionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyActionSubtitle: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 16,
  },
  emptyActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  emptyActionButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  addButton: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 25,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  // Loading and error states
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  // Carousel styles
  carouselContainer: {
    position: 'relative',
    width: '100%',
    height: 200,
  },
  carouselScrollView: {
    width: '100%',
    height: 200,
  },
  carouselImage: {
    width: width - 32,
    height: 200,
  },
  carouselPaginationContainer: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  carouselPaginationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  carouselPaginationDotActive: {
    width: 20,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  carouselImageCounter: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  carouselImageCounterText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
});
