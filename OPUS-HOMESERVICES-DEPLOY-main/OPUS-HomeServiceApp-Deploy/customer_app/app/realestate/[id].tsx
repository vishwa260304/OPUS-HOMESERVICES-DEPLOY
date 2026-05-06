import React, { useState, useEffect, useLayoutEffect } from 'react';
import { View, Text, ScrollView, Image, StyleSheet, Dimensions, TouchableOpacity, StatusBar, Alert, Share, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { hapticButtonPress } from '../../utils/haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { PropertyListing } from '../../lib/propertyListings';

const { width } = Dimensions.get('window');

// Image Carousel Component for Details Page
const PropertyImageCarousel = ({ images, colors }: { images: any[], colors: any }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollViewRef = React.useRef<ScrollView>(null);
  const autoScrollInterval = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const AUTO_SCROLL_INTERVAL = 4000; // 4 seconds

  const startAutoScroll = () => {
    if (images.length <= 1) return;

    autoScrollInterval.current = setInterval(() => {
      setCurrentIndex((prevIndex) => {
        const nextIndex = (prevIndex + 1) % images.length;
        scrollViewRef.current?.scrollTo({
          x: nextIndex * width,
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
    const index = Math.round(contentOffsetX / width);
    setCurrentIndex(index);
  };

  const handleScrollBeginDrag = () => {
    stopAutoScroll();
  };

  const handleScrollEndDrag = () => {
    startAutoScroll();
  };

  return (
    <View style={styles.galleryContainer}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScrollEndDrag={handleScrollEndDrag}
        scrollEventThrottle={16}
        style={styles.gallery}
      >
        {images.map((img, idx) => (
          <Image key={idx} source={img} style={styles.galleryImage} resizeMode="cover" />
        ))}
      </ScrollView>
      
      {/* Pagination Dots */}
      {images.length > 1 && (
        <View style={styles.galleryPaginationContainer}>
          {images.map((_, index) => (
            <View
              key={`dot-${index}`}
              style={[
                styles.galleryPaginationDot,
                currentIndex === index && styles.galleryPaginationDotActive
              ]}
            />
          ))}
        </View>
      )}

      {/* Image Counter */}
      <View style={styles.imageCounter}>
        <Text style={styles.imageCounterText}>{currentIndex + 1} / {images.length}</Text>
      </View>
    </View>
  );
};

export default function RealEstateDetailsScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams();
  const { colors, isDark } = useTheme();
  const [property, setProperty] = useState<PropertyListing | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const propertyId = params.id as string;

  // Hide the navigation header
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  // Fetch property details from backend
  useEffect(() => {
    const fetchPropertyDetails = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from('property_listings')
          .select('*')
          .eq('id', propertyId)
          .single();

        if (fetchError) throw fetchError;
        
        setProperty(data);
      } catch (err) {
        console.error('Error fetching property:', err);
        setError('Failed to load property details');
      } finally {
        setIsLoading(false);
      }
    };

    if (propertyId) {
      fetchPropertyDetails();
    }
  }, [propertyId]);

  const Section = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <View style={[styles.section, { backgroundColor: colors.background }]}> 
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{label}</Text>
      {children}
    </View>
  );

  // Show loading state
  if (isLoading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent />
        <ActivityIndicator size="large" color={colors.secondary} />
        <Text style={[styles.loadingText, { color: colors.text }]}>Loading property details...</Text>
      </View>
    );
  }

  // Show error state
  if (error || !property) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent />
        <View style={styles.headerSpacer} />
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={[styles.headerBtn, { backgroundColor: colors.card }]}> 
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Details</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color={colors.textSecondary} />
          <Text style={[styles.errorText, { color: colors.text }]}>
            {error || 'Property not found'}
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.secondary }]}
            onPress={() => router.back()}
          >
            <Text style={styles.retryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Prepare images
  const images = property.images && property.images.length > 0
    ? property.images.map(url => ({ uri: url }))
    : [require('../../assets/images/Aframe.webp')];

  // Format price display
  let priceDisplay = 'Contact for Price';
  let depositDisplay = '';
  
  if (property.property_for === 'rent') {
    priceDisplay = property.rent_amount ? `₹${property.rent_amount}/month` : 'Contact for Price';
    depositDisplay = property.deposit_amount ? `Deposit: ₹${property.deposit_amount}` : 'Deposit Negotiable';
  } else if (property.property_for === 'lease') {
    priceDisplay = property.lease_amount ? `₹${property.lease_amount}` : 'Contact for Price';
    depositDisplay = property.security_deposit ? `Security: ₹${property.security_deposit}` : 'Security Negotiable';
  } else if (property.property_for === 'sale') {
    priceDisplay = property.sale_price ? `₹${property.sale_price}` : 'Contact for Price';
    depositDisplay = property.booking_amount ? `Booking: ₹${property.booking_amount}` : 'Negotiable';
  }

  // Calculate days since posting
  const postedDays = property.created_at 
    ? Math.floor((Date.now() - new Date(property.created_at).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}> 
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent />

      {/* Header */}
      <View style={styles.headerSpacer} />
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.headerBtn, { backgroundColor: colors.card }]}> 
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          Details
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Gallery with Carousel */}
        <PropertyImageCarousel images={images} colors={colors} />

        {/* Title & Price */}
        <View style={[styles.titleBox, { backgroundColor: colors.surface }]}> 
          <Text style={[styles.title, { color: colors.text }]}>
            {property.title || `${property.bhk_type} ${property.apartment_type}`}
          </Text>
          {!!property.location && (
            <View style={styles.locationRow}>
              <Ionicons name="location" size={14} color={colors.textSecondary} />
              <Text style={[styles.location, { color: colors.textSecondary }]}>{property.location}</Text>
            </View>
          )}
          <LinearGradient
            colors={[colors.secondary, colors.secondaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.pricePill}
          >
            <Text style={styles.pricePillText}>{priceDisplay}</Text>
          </LinearGradient>
          {property.is_verified && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="shield-checkmark" size={16} color="#10B981" />
              <Text style={[styles.verifiedText, { color: '#10B981' }]}>Verified Property</Text>
            </View>
          )}
          <View style={styles.quickRow}>
            <QuickIcon colors={colors} name="bed-outline" label={property.bhk_type} />
            <QuickIcon colors={colors} name="crop-outline" label={property.property_size || 'N/A'} />
            <QuickIcon colors={colors} name="home-outline" label={property.apartment_type} />
            <QuickIcon colors={colors} name="calendar-outline" label={`${postedDays}d ago`} />
          </View>
        </View>

        {/* Key Facts */}
        <Section label="Key Facts">
          <View style={styles.grid4}>
            {[
              { icon: 'water-outline', label: 'Bathrooms', value: property.bathrooms?.toString() || 'N/A' },
              { icon: 'flower-outline', label: 'Balconies', value: property.balconies?.toString() || 'N/A' },
              { icon: 'layers-outline', label: 'Floor', value: property.floor && property.total_floor ? `${property.floor} of ${property.total_floor}` : property.floor || 'N/A' },
              { icon: 'calendar-outline', label: 'Available', value: property.available_from || 'Immediate' },
              { icon: 'cash-outline', label: 'Deposit', value: depositDisplay },
              { icon: 'car-outline', label: 'Parking', value: property.parking || 'N/A' },
              { icon: 'leaf-outline', label: 'Furnishing', value: property.furnishing || 'N/A' },
              { icon: 'location-outline', label: 'Facing', value: property.facing || 'N/A' },
            ].map((f, i) => (
              <View key={i} style={[styles.factCard, { borderColor: colors.border, backgroundColor: colors.card }]}> 
                <Ionicons name={f.icon as any} size={18} color={colors.text} />
                <Text style={[styles.factLabel, { color: colors.textSecondary }]}>{f.label}</Text>
                <Text style={[styles.factValue, { color: colors.text }]}>{f.value}</Text>
              </View>
            ))}
          </View>

          {/* Preferred Tenants */}
          {property.preferred_tenants && Object.keys(property.preferred_tenants).length > 0 && (
            <View style={styles.preferredTenantsContainer}>
              <Text style={[styles.preferredTenantsTitle, { color: colors.text }]}>Preferred Tenants</Text>
              <View style={styles.preferredTenantsGrid}>
                {Object.entries(property.preferred_tenants).map(([key, value]) => 
                  value && (
                    <View key={key} style={[styles.preferredTenantChip, { backgroundColor: colors.card, borderColor: colors.secondary }]}>
                      <Ionicons name="checkmark-circle" size={16} color={colors.secondary} />
                      <Text style={[styles.preferredTenantText, { color: colors.text }]}>
                        {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Text>
                    </View>
                  )
                )}
              </View>
            </View>
          )}
        </Section>

        {/* Overview / Description */}
        {property.description && (
          <Section label="Description">
            <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
              {property.description}
            </Text>
          </Section>
        )}

        {/* Property Details */}
        <Section label="Property Details">
          <View style={styles.detailsGrid}>
            {property.property_age && (
              <DetailRow colors={colors} label="Property Age" value={property.property_age} />
            )}
            {property.property_for && (
              <DetailRow colors={colors} label="Listed For" value={property.property_for.charAt(0).toUpperCase() + property.property_for.slice(1)} />
            )}
            {property.category && (
              <DetailRow colors={colors} label="Category" value={property.category} />
            )}
            {property.subcategory && (
              <DetailRow colors={colors} label="Subcategory" value={property.subcategory} />
            )}
            {property.monthly_maintenance && (
              <DetailRow colors={colors} label="Monthly Maintenance" value={`₹${property.monthly_maintenance}`} />
            )}
            {property.water_supply && (
              <DetailRow colors={colors} label="Water Supply" value={property.water_supply} />
            )}
            {property.current_situation && (
              <DetailRow colors={colors} label="Current Situation" value={property.current_situation} />
            )}
          </View>
        </Section>

        {/* Amenities */}
        {(property.gym || property.gated_security || property.pet_allowed || property.non_veg_allowed || property.other_amenities) && (
          <Section label="Amenities">
            <View style={styles.chipsRow}>
              {property.gated_security && <AmenityChip colors={colors} icon="business-outline" label="Gated Security" />}
              {property.gym && <AmenityChip colors={colors} icon="barbell-outline" label="Gym" />}
              {property.pet_allowed && <AmenityChip colors={colors} icon="paw-outline" label="Pet Allowed" />}
              {property.non_veg_allowed && <AmenityChip colors={colors} icon="restaurant-outline" label="Non-Veg Allowed" />}
              {property.other_amenities && Object.entries(property.other_amenities).map(([key, value]) => 
                value && <AmenityChip key={key} colors={colors} icon="checkmark-circle-outline" label={key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} />
              )}
            </View>
          </Section>
        )}

        {/* Contact Information */}
        {property.contact_number && (
          <Section label="Contact Information">
            <View style={[styles.contactBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="call" size={20} color={colors.text} />
              <Text style={[styles.contactText, { color: colors.text }]}>{property.contact_number}</Text>
            </View>
            {property.secondary_number && (
              <View style={[styles.contactBox, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 8 }]}>
                <Ionicons name="call-outline" size={20} color={colors.text} />
                <Text style={[styles.contactText, { color: colors.text }]}>{property.secondary_number}</Text>
              </View>
            )}
          </Section>
        )}

        {property.directions_tip && (
          <Section label="Directions">
            <View style={[styles.directionsBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="navigate" size={20} color={colors.secondary} />
              <Text style={[styles.directionsText, { color: colors.textSecondary }]}>{property.directions_tip}</Text>
            </View>
          </Section>
        )}

        <View style={{ height: 88 }} />
      </ScrollView>

      {/* Bottom Action Bar - Contact owner + Share */}
      <View style={[styles.bottomBar, { borderTopColor: colors.border, backgroundColor: colors.background }]}> 
        <TouchableOpacity 
          activeOpacity={0.9} 
          style={{ flex: 1 }} 
          onPress={() => { 
            hapticButtonPress(); 
            if (property.contact_number) {
              Alert.alert('Contact Owner', `Call: ${property.contact_number}`, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Call Now', onPress: () => {} }
              ]);
            }
          }}
        >
          <LinearGradient
            colors={[colors.secondary, colors.secondaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.ctaBtn}
          >
            <Ionicons name="call" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.ctaText}>Contact Owner</Text>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity 
          activeOpacity={0.9} 
          onPress={async () => { 
            try { 
              hapticButtonPress(); 
              await Share.share({ 
                message: `${property.title || property.bhk_type + ' ' + property.apartment_type} — ${property.location}\n${priceDisplay}` 
              }); 
            } catch {} 
          }}
        >
          <LinearGradient
            colors={[colors.secondary, colors.secondaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.bottomIconBtn}
          >
            <Ionicons name="share-social" color="#fff" size={20} />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function QuickIcon({ colors, name, label }: { colors: any; name: any; label: string }) {
  return (
    <View style={styles.quickItem}>
      <Ionicons name={name} size={16} color={colors.text} />
      <Text style={[styles.quickText, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

function DetailRow({ colors, label, value }: { colors: any; label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

function AmenityChip({ colors, icon, label }: { colors: any; icon: any; label: string }) {
  return (
    <View style={[styles.chip, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <Ionicons name={icon} size={14} color={colors.text} />
      <Text style={[styles.chipText, { color: colors.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerSpacer: { height: 50 },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 8 },
  headerBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700' },
  headerRight: { width: 36 },
  scrollContent: { paddingBottom: 12 },
  galleryContainer: { position: 'relative', width, height: width * 0.75, marginBottom: 12 },
  gallery: { width, height: width * 0.75 },
  galleryImage: { width, height: width * 0.75 },
  galleryPaginationContainer: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  galleryPaginationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  galleryPaginationDotActive: {
    width: 20,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  imageCounter: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  imageCounterText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  titleBox: { padding: 16, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#00000010' },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12 },
  location: { fontSize: 14, flex: 1 },
  pricePill: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginBottom: 8 },
  pricePillText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  verifiedText: { fontSize: 14, fontWeight: '600' },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  quickItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  quickText: { fontSize: 12 },
  section: { paddingVertical: 14, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 10 },
  grid4: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  factCard: { width: (width - 16*2 - 10*3) / 2, padding: 12, borderWidth: 1, borderRadius: 10 },
  factLabel: { fontSize: 12, marginTop: 4 },
  factValue: { fontSize: 14, fontWeight: '700' },
  preferredTenantsContainer: { marginTop: 16, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#00000010' },
  preferredTenantsTitle: { fontSize: 14, fontWeight: '700', marginBottom: 12 },
  preferredTenantsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  preferredTenantChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1.5, borderRadius: 20 },
  preferredTenantText: { fontSize: 13, fontWeight: '600' },
  paragraph: { fontSize: 14, lineHeight: 22 },
  detailsGrid: { gap: 12 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#00000010' },
  detailLabel: { fontSize: 14, flex: 1 },
  detailValue: { fontSize: 14, fontWeight: '600', textAlign: 'right' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderRadius: 16 },
  chipText: { fontSize: 12, fontWeight: '600' },
  contactBox: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderWidth: 1, borderRadius: 12 },
  contactText: { fontSize: 16, fontWeight: '600', flex: 1 },
  directionsBox: { flexDirection: 'row', gap: 12, padding: 16, borderWidth: 1, borderRadius: 12 },
  directionsText: { fontSize: 14, lineHeight: 20, flex: 1 },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: StyleSheet.hairlineWidth },
  bottomIconBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  ctaBtn: { flex: 1, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  loadingText: { marginTop: 16, fontSize: 16 },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  errorText: { marginTop: 16, fontSize: 16, textAlign: 'center', marginBottom: 20 },
  retryButton: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  retryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});