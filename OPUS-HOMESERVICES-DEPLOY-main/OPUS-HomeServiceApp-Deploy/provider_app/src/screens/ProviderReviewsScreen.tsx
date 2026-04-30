import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { moderateScale } from '../utils/responsive';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

interface Review {
  id: string;
  rating: number;
  review_text: string | null;
  review_date: string;
  customer_user_id: string | null;
  booking_id: string | null;
  service_name: string;
  created_at: string;
  provider_id?: any;
}

const ProviderReviewsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [averageRating, setAverageRating] = useState<number>(0);
  const [reviewCount, setReviewCount] = useState<number>(0);

  const sectorGradient: [string, string] = ['#004c8f', '#0c1a5d'];
  const sectorPrimary = '#3B5BFD';

  const fetchReviews = async (userId: string) => {
    try {
      setLoading(true);

      // Try server-side RPC first to get canonical stats (if available)
      let rpcProvided = false;
      try {
        const { data: rpcData, error: rpcErr } = await supabase.rpc('get_provider_review_stats', { p_user: userId });
        if (!rpcErr && rpcData) {
          const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
          const rpcCount = row?.review_count ? Number(row.review_count) : 0;
          const hasRpcReviews = rpcCount > 0 || (row?.reviews && (Array.isArray(row.reviews) ? row.reviews.length : 0) > 0);
          if (row && hasRpcReviews) {
            setAverageRating(row?.avg_rating ? Number(row.avg_rating) : 0);
            setReviewCount(rpcCount);
            // If RPC returns a reviews jsonb array, hydrate the UI directly from it
            if (row.reviews) {
              try {
                const revs = Array.isArray(row.reviews) ? row.reviews : JSON.parse(String(row.reviews));
                const mapped = (revs || []).map((r: any) => ({
                  id: String(r.id),
                  rating: Number(r.rating) || 0,
                  review_text: r.review_text || null,
                  review_date: r.created_at || r.review_date || null,
                  customer_user_id: r.customer_user_id || null,
                  booking_id: r.booking_id || null,
                  service_name: r.service_name || '',
                  created_at: r.created_at || null,
                  provider_id: r.provider_id || null,
                }));
                setReviews(mapped);
              } catch (e) {
                console.debug('ProviderReviews: failed to parse rpc reviews', e);
              }
            }
            rpcProvided = true;
            setLoading(false);
            return;
          }
          // RPC returned 0 reviews (e.g. acting driver not in RPC); fall through to client-side fetches
        }
      } catch (e) {
        // RPC may not exist; ignore and fall back to client-side computation
        console.debug('ProviderReviews: RPC get_provider_review_stats not available, falling back', e);
      }

      // Fetch provider service ids and provider profile ids for this user
      const [{ data: services, error: svcErr }, { data: profiles, error: profErr }] = await Promise.all([
        supabase.from('providers_services').select('id').eq('user_id', userId),
        supabase.from('providers_profiles').select('id').eq('user_id', userId),
      ]);

      const serviceIds = (services || []).map((s: any) => s.id);
      const serviceIdStrings = serviceIds.map((id: any) => String(id));
      const profileIds = (profiles || []).map((p: any) => String(p.id));

      // We'll collect matching reviews from several safe queries to avoid mixed-type cast errors.
      const matchedMap: Record<string, Review> = {};

      // 1) Doctor reviews (safe equality)
      try {
        const { data: docReviews } = await supabase
          .from('reviews')
          .select('id, rating, review_text, review_date, customer_user_id, booking_id, service_name, created_at, provider_id')
          .eq('doctor_id', userId)
          .order('created_at', { ascending: false })
          .limit(500);
        for (const r of (docReviews || [])) {
          if (!r || !r.id) continue;
          matchedMap[String(r.id)] = r as Review;
        }
      } catch (e) {
        console.debug('ProviderReviews: doctor reviews query failed', e);
      }

      // 2) Acting driver reviews (acting_driver_id = user id)
      try {
        const { data: actingReviews } = await supabase
          .from('reviews')
          .select('id, rating, review_text, review_date, customer_user_id, booking_id, service_name, created_at, provider_id')
          .eq('acting_driver_id', userId)
          .order('created_at', { ascending: false })
          .limit(500);
        for (const r of (actingReviews || [])) {
          if (!r || !r.id) continue;
          matchedMap[String(r.id)] = r as Review;
        }
      } catch (e) {
        console.debug('ProviderReviews: acting driver reviews query failed', e);
      }

      // Combine into a single safe fetch: get recent reviews and filter client-side
      const numericServiceIds = serviceIds.map((s: any) => Number(s)).filter((n: number) => Number.isFinite(n));
      try {
        const { data: allReviews, error: allErr } = await supabase
          .from('reviews')
          .select('id, rating, review_text, review_date, customer_user_id, booking_id, service_name, created_at, provider_id, doctor_id, acting_driver_id')
          .order('created_at', { ascending: false })
          .limit(2000);
        if (!allErr && allReviews) {
          for (const r of allReviews) {
            if (!r || !r.id) continue;
            // include if doctor match
            if (r.doctor_id && String(r.doctor_id) === String(userId)) {
              matchedMap[String(r.id)] = r as Review;
              continue;
            }
            // include if acting driver match
            if ((r as any).acting_driver_id && String((r as any).acting_driver_id) === String(userId)) {
              matchedMap[String(r.id)] = r as Review;
              continue;
            }
            const pid = r.provider_id;
            if (pid == null) continue;
            if (typeof pid === 'number') {
              if (numericServiceIds.includes(pid)) matchedMap[String(r.id)] = r as Review;
            } else if (typeof pid === 'string') {
              if (serviceIdStrings.includes(pid)) { matchedMap[String(r.id)] = r as Review; continue; }
              const asNum = Number(pid);
              if (Number.isFinite(asNum) && numericServiceIds.includes(asNum)) { matchedMap[String(r.id)] = r as Review; continue; }
              if (profileIds.includes(pid)) { matchedMap[String(r.id)] = r as Review; continue; }
              if (String(pid) === String(userId)) { matchedMap[String(r.id)] = r as Review; continue; }
            }
          }
        }
      } catch (e) {
        console.debug('ProviderReviews: all reviews fetch failed', e);
      }

      const matched = Object.values(matchedMap);

      setReviews(matched);

      // If RPC didn't supply reviewCount/average, compute locally
      if (!rpcProvided) {
        if (matched.length > 0) {
          const sum = matched.reduce((acc, rv) => acc + (rv.rating || 0), 0);
          setAverageRating(Math.round((sum / matched.length) * 10) / 10);
          setReviewCount(matched.length);
        } else {
          setAverageRating(0);
          setReviewCount(0);
        }
      }
    } catch (error) {
      console.error('Exception fetching provider reviews:', error);
      setReviews([]);
      setAverageRating(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) fetchReviews(user.id);
  }, [user?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (user?.id) await fetchReviews(user.id);
    setRefreshing(false);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const renderStars = (rating: number) => (
    <View style={styles.starsContainer}>
      {[1,2,3,4,5].map(n => (
        <Ionicons key={n} name={n <= rating ? 'star' : 'star-outline'} size={moderateScale(16)} color={n <= rating ? '#F5B700' : '#E5E7EB'} />
      ))}
    </View>
  );

  if (loading) return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <SafeAreaView style={styles.safeArea}> 
        <View style={styles.loadingContainer}><ActivityIndicator size="large" color={sectorPrimary} /><Text style={{ color: colors.textSecondary, marginTop: 8 }}>Loading reviews...</Text></View>
      </SafeAreaView>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <StatusBar barStyle="light-content" backgroundColor={sectorGradient[0]} translucent />
      <LinearGradient colors={sectorGradient} start={{ x:0,y:0 }} end={{ x:0,y:1 }} style={styles.header}> 
        <SafeAreaView edges={[ 'top' ]}> 
          <View style={styles.headerContent}> 
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButtonHeader}><Ionicons name="arrow-back" size={moderateScale(24)} color="#ffffff" /></TouchableOpacity>
            <Text style={styles.headerTitle}>My Reviews</Text>
            <View style={{ width: moderateScale(40) }} />
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}> 
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}> 
          <View style={styles.averageRatingContainer}> 
            <View style={styles.averageRatingCircle}> 
              <Text style={styles.averageRatingValue}>{averageRating > 0 ? averageRating.toFixed(1) : '0.0'}</Text> 
              <Text style={styles.averageRatingLabel}>out of 5</Text> 
            </View>
            <View style={styles.averageRatingInfo}> 
              <Text style={[styles.averageRatingTitle, { color: colors.text }]}>Average Rating</Text> 
              <Text style={[styles.averageRatingCount, { color: colors.textSecondary }]}>Based on {reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}</Text> 
              {renderStars(Math.round(averageRating))} 
            </View>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}> 
          <Text style={[styles.sectionTitle, { color: colors.text }]}>All Reviews ({reviews.length})</Text>
          {reviews.length === 0 ? (
            <View style={styles.emptyState}><Ionicons name="star-outline" size={moderateScale(48)} color={colors.textSecondary} /><Text style={[styles.emptyStateText, { color: colors.text }]}>No reviews yet</Text><Text style={[styles.emptyStateSubtext, { color: colors.textSecondary }]}>Provider reviews will appear here once customers rate your service.</Text></View>
          ) : (
            reviews.map((review, index) => (
              <View key={review.id || index}> 
                <View style={[styles.reviewCard, { backgroundColor: colors.background, borderColor: colors.border }, index < reviews.length - 1 && styles.reviewCardWithMargin]}> 
                  <Text style={[styles.reviewTitle, { color: colors.text }]} numberOfLines={2}>{review.service_name || 'Service'}</Text>
                  <View style={styles.reviewHeader}> 
                    <View style={styles.reviewHeaderLeft}>
                      {renderStars(review.rating)}
                      <Text style={[styles.reviewDate, { color: colors.textSecondary }]}>{formatDate(review.review_date || review.created_at)}</Text>
                    </View>
                    <View style={[styles.ratingBadge, { backgroundColor: '#F5B70020' }]}><Text style={[styles.ratingBadgeText, { color: '#F5B700' }]}>{review.rating}/5</Text></View>
                  </View>
                  <Text style={[styles.reviewText, { color: colors.text }]}>{review.review_text || 'No review text provided.'}</Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingVertical: moderateScale(12), paddingHorizontal: moderateScale(16) },
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButtonHeader: { width: moderateScale(40), alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#ffffff', fontWeight: '800', fontSize: moderateScale(18) },
  scrollView: { flex: 1 },
  scrollContent: { padding: moderateScale(16), paddingBottom: moderateScale(120) },
  card: { borderRadius: moderateScale(12), padding: moderateScale(12), marginBottom: moderateScale(12) },
  averageRatingContainer: { flexDirection: 'row', alignItems: 'center' },
  averageRatingCircle: { width: moderateScale(88), height: moderateScale(88), borderRadius: moderateScale(44), backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center' },
  averageRatingValue: { fontSize: moderateScale(20), fontWeight: '900' },
  averageRatingLabel: { fontSize: moderateScale(12), color: '#6B7280' },
  averageRatingInfo: { marginLeft: moderateScale(12), flex: 1 },
  averageRatingTitle: { fontWeight: '800' },
  averageRatingCount: { marginTop: moderateScale(6) },
  sectionTitle: { fontWeight: '800', marginBottom: moderateScale(8) },
  emptyState: { alignItems: 'center', padding: moderateScale(20) },
  emptyStateText: { fontWeight: '800', marginTop: moderateScale(8) },
  emptyStateSubtext: { marginTop: moderateScale(6) },
  reviewCard: { borderRadius: moderateScale(8), padding: moderateScale(12), borderWidth: 1 },
  reviewCardWithMargin: { marginBottom: moderateScale(10) },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reviewHeaderLeft: { flexDirection: 'column' },
  reviewDate: { marginTop: moderateScale(6) },
  ratingBadge: { borderRadius: moderateScale(8), paddingHorizontal: moderateScale(8), paddingVertical: moderateScale(6) },
  ratingBadgeText: { fontWeight: '700' },
  reviewText: { marginTop: moderateScale(8) },
  reviewTitle: { fontWeight: '800', fontSize: moderateScale(16) },
  starsContainer: { flexDirection: 'row' },
});

export default ProviderReviewsScreen;
