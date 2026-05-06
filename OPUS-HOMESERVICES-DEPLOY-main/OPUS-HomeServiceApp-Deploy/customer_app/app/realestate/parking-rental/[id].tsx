import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, Image, StyleSheet, Dimensions, TouchableOpacity, StatusBar, ActivityIndicator, Share, Alert } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../../context/ThemeContext';
import { hapticButtonPress } from '../../../utils/haptics';
import { ParkingRentalsApi, ParkingRental } from '../../../lib/parkingRentals';

const { width } = Dimensions.get('window');

const ImageCarousel = ({ images }: { images: string[] }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!images || images.length <= 1) return;
    intervalRef.current = setInterval(() => {
      setCurrentIndex((prev) => {
        const next = (prev + 1) % images.length;
        scrollViewRef.current?.scrollTo({ x: next * width, y: 0, animated: true });
        return next;
      });
    }, 3500) as unknown as number;
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [images]);

  const onScroll = (e: any) => {
    const x = e.nativeEvent.contentOffset.x;
    setCurrentIndex(Math.round(x / width));
  };

  if (!images || images.length === 0) {
    return (
      <View style={[styles.galleryContainer, { alignItems: 'center', justifyContent: 'center' }]}>
        <Ionicons name="car" size={48} color="#999" />
      </View>
    );
  }

  return (
    <View style={styles.galleryContainer}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={styles.gallery}
      >
        {images.map((uri, idx) => (
          <Image key={`${uri}-${idx}`} source={{ uri }} style={styles.galleryImage} resizeMode="cover" />
        ))}
      </ScrollView>
      {images.length > 1 && (
        <View style={styles.galleryPaginationContainer}>
          {images.map((_, i) => (
            <View key={`dot-${i}`} style={[styles.galleryPaginationDot, currentIndex === i && styles.galleryPaginationDotActive]} />
          ))}
        </View>
      )}
      <View style={styles.imageCounter}>
        <Text style={styles.imageCounterText}>{currentIndex + 1} / {images.length}</Text>
      </View>
    </View>
  );
};

export default function ParkingRentalDetailsScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams();

  const [rental, setRental] = useState<ParkingRental | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const id = params.id as string;

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await ParkingRentalsApi.getParkingRentalById(id);
        setRental(data);
      } catch (e) {
        setError('Failed to load parking details');
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchDetails();
  }, [id]);

  if (loading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent />
        <ActivityIndicator size="large" color={colors.secondary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading details...</Text>
      </View>
    );
  }

  if (error || !rental) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}> 
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent />
        <View style={styles.headerSpacer} />
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={[styles.headerBtn, { backgroundColor: colors.card }]}> 
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Parking Details</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color={colors.textSecondary} />
          <Text style={[styles.errorText, { color: colors.text }]}>{error || 'Not found'}</Text>
          <TouchableOpacity onPress={() => router.back()} style={[styles.retryButton, { backgroundColor: colors.secondary }]}>
            <Text style={styles.retryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const images = Array.isArray(rental.parking_photos) && rental.parking_photos.length > 0 ? rental.parking_photos : [];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}> 
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent />

      <View style={styles.headerSpacer} />
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.headerBtn, { backgroundColor: colors.card }]}> 
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>Parking Details</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <ImageCarousel images={images} />

        <View style={[styles.titleBox, { backgroundColor: colors.surface }]}> 
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
            {rental.parking_location}
          </Text>
          {!!rental.building_name && (
            <View style={styles.locationRow}>
              <Ionicons name="business-outline" size={14} color={colors.textSecondary} />
              <Text style={[styles.location, { color: colors.textSecondary }]}>{rental.building_name}</Text>
            </View>
          )}
          <LinearGradient colors={[colors.secondary, colors.secondaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.pricePill}>
            <Text style={styles.pricePillText}>₹{rental.rent_amount} / {rental.rent_period}</Text>
          </LinearGradient>
          <View style={styles.quickRow}>
            <QuickIcon colors={colors} icon="car-outline" label={rental.vehicle_allowed} />
            <QuickIcon colors={colors} icon="home-outline" label={rental.parking_type} />
            {!!rental.length && !!rental.width && (
              <QuickIcon colors={colors} icon="resize-outline" label={`${rental.length}×${rental.width} m`} />
            )}
          </View>
        </View>

        <Section colors={colors} label="Key Facts">
          <FactsGrid colors={colors} facts={[
            { icon: 'car-outline', label: 'Vehicle Allowed', value: rental.vehicle_allowed },
            { icon: 'home-outline', label: 'Parking Type', value: rental.parking_type },
            { icon: 'resize-outline', label: 'Dimensions', value: (rental.length && rental.width) ? `${rental.length}×${rental.width} m` : 'N/A' },
            { icon: 'layers-outline', label: 'Floor Level', value: rental.floor_level || 'N/A' },
            { icon: 'cash-outline', label: 'Rent', value: `₹${rental.rent_amount}` },
            { icon: 'time-outline', label: 'Rent Period', value: rental.rent_period },
            // Removed Security Deposit, Payment Mode, and Posted info per request
          ]} />
        </Section>

        <View style={{ height: 88 }} />
      </ScrollView>

      <View style={[styles.bottomBar, { borderTopColor: colors.border, backgroundColor: colors.background }]}> 
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={0.9} onPress={() => {
          hapticButtonPress();
          if (rental.phone) {
            Alert.alert('Contact Owner', `Call: ${rental.phone}`, [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Call Now', onPress: () => {} },
            ]);
          }
        }}>
          <LinearGradient colors={[colors.secondary, colors.secondaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaBtn}>
            <Ionicons name="call" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.ctaText}>Contact Owner</Text>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.9} onPress={async () => {
          try {
            hapticButtonPress();
            await Share.share({ message: `${rental.parking_location} — ₹${rental.rent_amount} / ${rental.rent_period}` });
          } catch {}
        }}>
          <LinearGradient colors={[colors.secondary, colors.secondaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.bottomIconBtn}>
            <Ionicons name="share-social" color="#fff" size={20} />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Section({ colors, label, children }: { colors: any; label: string; children: React.ReactNode }) {
  return (
    <View style={[styles.section, { backgroundColor: colors.background }]}> 
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{label}</Text>
      {children}
    </View>
  );
}

function QuickIcon({ colors, icon, label }: { colors: any; icon: any; label: string }) {
  return (
    <View style={styles.quickItem}>
      <Ionicons name={icon} size={16} color={colors.text} />
      <Text style={[styles.quickText, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

function FactsGrid({ colors, facts }: { colors: any; facts: { icon: any; label: string; value: string }[] }) {
  return (
    <View style={styles.grid2}>
      {facts.map((f, i) => (
        <View key={i} style={[styles.factCard, { borderColor: colors.border, backgroundColor: colors.card }]}> 
          <Ionicons name={f.icon} size={18} color={colors.text} />
          <Text style={[styles.factLabel, { color: colors.textSecondary }]}>{f.label}</Text>
          <Text style={[styles.factValue, { color: colors.text }]} numberOfLines={2}>{f.value}</Text>
        </View>
      ))}
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
  galleryPaginationContainer: { position: 'absolute', bottom: 16, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  galleryPaginationDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255, 255, 255, 0.5)' },
  galleryPaginationDotActive: { width: 20, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF' },
  imageCounter: { position: 'absolute', top: 16, right: 16, backgroundColor: 'rgba(0, 0, 0, 0.6)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  imageCounterText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  titleBox: { padding: 16, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#00000010' },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  location: { fontSize: 14, flex: 1 },
  pricePill: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginBottom: 8 },
  pricePillText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  quickItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  quickText: { fontSize: 12 },
  section: { paddingVertical: 14, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 10 },
  grid2: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  factCard: { width: (width - 16*2 - 10*3) / 2, padding: 12, borderWidth: 1, borderRadius: 10 },
  factLabel: { fontSize: 12, marginTop: 4 },
  factValue: { fontSize: 14, fontWeight: '700' },
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


