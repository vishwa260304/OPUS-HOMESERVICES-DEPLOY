import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
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
}

const DoctorReviewsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [averageRating, setAverageRating] = useState<number>(0);

  const sectorGradient: [string, string] = ['#004c8f', '#0c1a5d'];
  const sectorPrimary = '#3B5BFD';

  const fetchReviews = async (userId: string) => {
    try {
      setLoading(true);
      // 1) Fetch reviews where this user is the doctor
      const [{ data: doctorData, error: doctorErr }, servicesRes] = await Promise.all([
        supabase
          .from('reviews')
          .select('id, rating, review_text, review_date, customer_user_id, booking_id, service_name, created_at')
          .eq('doctor_id', userId)
          .order('created_at', { ascending: false }),
        // Also fetch provider service ids for this user to query provider reviews
        supabase
          .from('providers_services')
          .select('id')
          .eq('user_id', userId),
      ]);

      let combined: Review[] = [];

      if (doctorErr) {
        console.error('Error fetching doctor reviews:', doctorErr);
      } else if (doctorData) {
        combined = combined.concat(doctorData as Review[]);
      }

      // 2) Fetch reviews where provider_id matches any providers_services.id (numeric)
      const serviceIds = (servicesRes.data || []).map((s: any) => Number(s.id)).filter((n: number) => Number.isFinite(n));
      if (serviceIds.length > 0) {
        const { data: provData, error: provErr } = await supabase
          .from('reviews')
          .select('id, rating, review_text, review_date, customer_user_id, booking_id, service_name, created_at')
          .in('provider_id', serviceIds as any[])
          .order('created_at', { ascending: false });

        if (provErr) {
          console.error('Error fetching provider reviews:', provErr);
        } else if (provData) {
          combined = combined.concat(provData as Review[]);
        }
      }

      // Deduplicate by id and sort
      const byId: Record<string, Review> = {};
      for (const r of combined) {
        if (r && r.id) byId[r.id] = r;
      }
      const reviewsData = Object.values(byId).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setReviews(reviewsData);

      // Calculate average rating
      if (reviewsData.length > 0) {
        const sum = reviewsData.reduce((acc, review) => acc + (review.rating || 0), 0);
        const average = sum / reviewsData.length;
        setAverageRating(Math.round(average * 10) / 10);
      } else {
        setAverageRating(0);
      }
    } catch (error) {
      console.error('Exception fetching reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchReviews(user.id);
    }
  }, [user?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (user?.id) {
      await fetchReviews(user.id);
    }
    setRefreshing(false);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const renderStars = (rating: number) => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Ionicons
            key={star}
            name={star <= rating ? 'star' : 'star-outline'}
            size={moderateScale(16)}
            color={star <= rating ? '#F5B700' : '#E5E7EB'}
          />
        ))}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={sectorPrimary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Loading reviews...
            </Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={sectorGradient[0]} translucent />

      {/* Header */}
      <LinearGradient
        colors={sectorGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.header}
      >
        <SafeAreaView edges={['top']}>
          <View style={styles.headerContent}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButtonHeader}
            >
              <Ionicons name="arrow-back" size={moderateScale(24)} color="#ffffff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>My Reviews</Text>
            <View style={{ width: moderateScale(40) }} />
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Average Rating Card */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.averageRatingContainer}>
            <View style={styles.averageRatingCircle}>
              <Text style={styles.averageRatingValue}>
                {averageRating > 0 ? averageRating.toFixed(1) : '0.0'}
              </Text>
              <Text style={styles.averageRatingLabel}>out of 5</Text>
            </View>
            <View style={styles.averageRatingInfo}>
              <Text style={[styles.averageRatingTitle, { color: colors.text }]}>
                Average Rating
              </Text>
              <Text style={[styles.averageRatingCount, { color: colors.textSecondary }]}>
                Based on {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}
              </Text>
              {renderStars(Math.round(averageRating))}
            </View>
          </View>
        </View>

        {/* Reviews List */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            All Reviews ({reviews.length})
          </Text>

          {reviews.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="star-outline" size={moderateScale(48)} color={colors.textSecondary} />
              <Text style={[styles.emptyStateText, { color: colors.text }]}>
                No reviews yet
              </Text>
              <Text style={[styles.emptyStateSubtext, { color: colors.textSecondary }]}>
                Reviews from patients will appear here once they rate your service.
              </Text>
            </View>
          ) : (
            reviews.map((review, index) => (
              <View key={review.id || index}>
                <View
                  style={[
                    styles.reviewCard,
                    { backgroundColor: colors.background, borderColor: colors.border },
                    index < reviews.length - 1 && styles.reviewCardWithMargin,
                  ]}
                >
                  <View style={styles.reviewHeader}>
                    <View style={styles.reviewHeaderLeft}>
                      {renderStars(review.rating)}
                      <Text style={[styles.reviewDate, { color: colors.textSecondary }]}>
                        {formatDate(review.review_date || review.created_at)}
                      </Text>
                    </View>
                    <View style={[styles.ratingBadge, { backgroundColor: '#F5B70020' }]}>
                      <Text style={[styles.ratingBadgeText, { color: '#F5B700' }]}>
                        {review.rating}/5
                      </Text>
                    </View>
                  </View>

                  {review.review_text && review.review_text.trim() !== '' ? (
                    <Text style={[styles.reviewText, { color: colors.text }]}>
                      {review.review_text}
                    </Text>
                  ) : (
                    <Text style={[styles.reviewText, { color: colors.textSecondary, fontStyle: 'italic' }]}>
                      No comment provided
                    </Text>
                  )}

                  {review.service_name && (
                    <View style={styles.serviceNameContainer}>
                      <Ionicons name="medical-outline" size={moderateScale(14)} color={colors.textSecondary} />
                      <Text style={[styles.serviceName, { color: colors.textSecondary }]}>
                        {review.service_name}
                      </Text>
                    </View>
                  )}
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
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingTop: moderateScale(10),
    paddingBottom: moderateScale(16),
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: moderateScale(20),
    paddingTop: moderateScale(10),
  },
  backButtonHeader: {
    width: moderateScale(40),
    height: moderateScale(40),
    borderRadius: moderateScale(20),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: moderateScale(20),
    fontWeight: '800',
    color: '#ffffff',
    flex: 1,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: moderateScale(16),
    paddingBottom: moderateScale(40),
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: moderateScale(40),
  },
  loadingText: {
    marginTop: moderateScale(16),
    fontSize: moderateScale(14),
    fontWeight: '600',
  },
  card: {
    borderRadius: moderateScale(16),
    padding: moderateScale(20),
    marginBottom: moderateScale(16),
    borderWidth: 1,
  },
  averageRatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  averageRatingCircle: {
    width: moderateScale(80),
    height: moderateScale(80),
    borderRadius: moderateScale(40),
    backgroundColor: '#F5B70020',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: moderateScale(20),
  },
  averageRatingValue: {
    fontSize: moderateScale(28),
    fontWeight: '900',
    color: '#F5B700',
  },
  averageRatingLabel: {
    fontSize: moderateScale(12),
    fontWeight: '600',
    color: '#F5B700',
    marginTop: moderateScale(2),
  },
  averageRatingInfo: {
    flex: 1,
  },
  averageRatingTitle: {
    fontSize: moderateScale(18),
    fontWeight: '800',
    marginBottom: moderateScale(4),
  },
  averageRatingCount: {
    fontSize: moderateScale(14),
    marginBottom: moderateScale(8),
  },
  starsContainer: {
    flexDirection: 'row',
    gap: moderateScale(4),
  },
  sectionTitle: {
    fontSize: moderateScale(18),
    fontWeight: '800',
    marginBottom: moderateScale(16),
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: moderateScale(40),
  },
  emptyStateText: {
    fontSize: moderateScale(16),
    fontWeight: '600',
    marginTop: moderateScale(12),
  },
  emptyStateSubtext: {
    fontSize: moderateScale(14),
    marginTop: moderateScale(4),
    textAlign: 'center',
  },
  reviewCard: {
    borderRadius: moderateScale(12),
    padding: moderateScale(16),
    borderWidth: 1,
  },
  reviewCardWithMargin: {
    marginBottom: moderateScale(12),
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: moderateScale(12),
  },
  reviewHeaderLeft: {
    flex: 1,
  },
  reviewDate: {
    fontSize: moderateScale(12),
    marginTop: moderateScale(4),
  },
  ratingBadge: {
    paddingHorizontal: moderateScale(10),
    paddingVertical: moderateScale(4),
    borderRadius: moderateScale(12),
  },
  ratingBadgeText: {
    fontSize: moderateScale(12),
    fontWeight: '700',
  },
  reviewText: {
    fontSize: moderateScale(14),
    lineHeight: moderateScale(20),
    marginBottom: moderateScale(12),
  },
  serviceNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: moderateScale(8),
  },
  serviceName: {
    fontSize: moderateScale(12),
    marginLeft: moderateScale(6),
    fontStyle: 'italic',
  },
});

export default DoctorReviewsScreen;

