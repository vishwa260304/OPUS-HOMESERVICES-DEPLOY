import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React, { useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
  TextInput,
  Modal,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { hapticButtonPress } from "../../utils/haptics";
import { ReviewsApi } from '../../lib/reviews';

export default function RatingsScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { user } = useAuth();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  // In-memory reviews; replace with API later
  const [reviews, setReviews] = useState<{ id: number | string; service: string; provider: string; rating: number; review: string; date: string; category?: string; bookingId?: string }[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [inputRating, setInputRating] = useState<number>(0);
  const [inputReview, setInputReview] = useState<string>("");

  // Edit modal state
  const [editVisible, setEditVisible] = useState<boolean>(false);
  const [editId, setEditId] = useState<number | string | null>(null);
  const [editRating, setEditRating] = useState<number>(0);
  const [editText, setEditText] = useState<string>("");

  const overall = useMemo(() => {
    if (reviews.length === 0) return { avg: 0, count: 0 };
    const sum = reviews.reduce((acc, r) => acc + (r.rating || 0), 0);
    return { avg: +(sum / reviews.length).toFixed(1), count: reviews.length };
  }, [reviews]);

  // Load reviews from database and AsyncStorage
  const loadReviews = async () => {
    setLoading(true);
    try {
      // First try to load from database if user is authenticated
      if (user?.id) {
        const { data: dbReviews, error } = await ReviewsApi.getByUserId(user.id);
        if (!error && dbReviews && dbReviews.length > 0) {
          // Convert database format to display format
          const formattedReviews = dbReviews.map(review => ({
            id: review.id,
            service: review.service_name,
            provider: review.provider_name || 'Provider',
            rating: review.rating,
            review: review.review_text || '',
            date: review.review_date,
            category: review.category || 'General',
            bookingId: review.booking_id,
          }));
          setReviews(formattedReviews);
          setLoading(false);
          return;
        }
      }

      // Fallback to AsyncStorage
      const raw = await AsyncStorage.getItem('user_reviews');
      if (raw) {
        const localReviews = JSON.parse(raw);
        setReviews(localReviews);
      }
    } catch (error) {
      console.error('Error loading reviews:', error);
      // Fallback to AsyncStorage on error
      try {
        const raw = await AsyncStorage.getItem('user_reviews');
        if (raw) setReviews(JSON.parse(raw));
      } catch {}
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReviews();
  }, [user?.id]);

  // Refresh reviews when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadReviews();
    }, [])
  );

  // Persist whenever reviews change
  useEffect(() => {
    (async () => {
      try {
        await AsyncStorage.setItem('user_reviews', JSON.stringify(reviews));
      } catch {}
    })();
  }, [reviews]);

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, index) => (
      <Ionicons
        key={index}
        name={index < rating ? "star" : "star-outline"}
        size={16}
        color="#FFD700"
      />
    ));
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text as any} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Ratings & Reviews</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Overall Rating Card */}
        <View style={[styles.overallRatingCard, { backgroundColor: colors.card, shadowColor: colors.shadow, borderWidth: 1, borderColor: colors.border, borderRadius: 14 }]}>
          <Text style={[styles.overallRatingTitle, { color: colors.text }]}>Your Overall Rating</Text>
          <View style={styles.ratingContainer}>
            <Text style={styles.ratingNumber}>{overall.avg.toFixed(1)}</Text>
            <View style={styles.starsContainer}>
              {renderStars(Math.round(overall.avg))}
            </View>
            <Text style={[styles.ratingText, { color: colors.textSecondary }]}>Based on {overall.count} reviews</Text>
          </View>
        </View>

        {/* Add a review */}
        <View style={[styles.addCard, { backgroundColor: colors.card, shadowColor: colors.shadow, borderWidth: 1, borderColor: colors.border, borderRadius: 14, opacity: user ? 1 : 0.6 }]}> 
          <Text style={[styles.sectionTitleDark, { color: colors.text }]}>Add your review</Text>
          <View style={{ flexDirection: 'row', marginBottom: 8 }}>
            {[1,2,3,4,5].map(n => (
              <TouchableOpacity
                key={n}
                onPress={() => {
                  if (!user) {
                    Alert.alert('Login required', 'Please log in to write a review.', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Login', onPress: () => router.push('/subcategories/login' as any) },
                    ]);
                    return;
                  }
                  setInputRating((prev) => (prev === n ? n - 1 : n));
                }}
                style={{ marginRight: 4 }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name={n <= inputRating ? 'star' : 'star-outline'} size={24} color="#f59e0b" />
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.card }]}
            placeholder="Write your review"
            placeholderTextColor={isDark ? '#FFFFFF' : '#9CA3AF'}
            value={inputReview}
            onChangeText={setInputReview}
            multiline
          />
          <TouchableOpacity
            style={[styles.submitBtn, !(inputRating && inputReview.trim()) && { opacity: 0.6 }]}
            disabled={!(inputRating && inputReview.trim())}
            onPress={async () => {
              if (!user) {
                Alert.alert('Login required', 'Please log in to write a review.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Login', onPress: () => router.push('/subcategories/login' as any) },
                ]);
                return;
              }
              
              try {
                const now = new Date();
                const newReview = { 
                  id: Date.now(), 
                  service: 'Service', 
                  provider: 'Provider', 
                  rating: inputRating, 
                  review: inputReview.trim(), 
                  date: now.toISOString().slice(0,10) 
                };

                // Save to database
                const { error: dbError } = await ReviewsApi.create({
                  booking_id: `manual_${Date.now()}`, // Manual review ID
                  service_name: 'Service',
                  provider_name: 'Provider',
                  category: 'General',
                  rating: inputRating,
                  review_text: inputReview.trim(),
                });

                if (dbError) {
                  console.error('Database review save error:', dbError);
                  // Continue with local save even if database fails
                }

                // Update local state
                setReviews(prev => [newReview, ...prev]);
                setInputRating(0);
                setInputReview("");
              } catch (error) {
                console.error('Error submitting review:', error);
                Alert.alert('Error', 'Failed to submit review');
              }
            }}
          >
            <LinearGradient
              colors={["#004c8f", "#0c1a5d"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.submitGradient}
            >
              <Text style={styles.submitText}>Submit</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Reviews List */}
        <View style={styles.reviewsSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Reviews</Text>
          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading reviews...</Text>
            </View>
          ) : reviews.map((review, index) => (
            <View key={review.id} style={[styles.reviewCard, { backgroundColor: colors.card, shadowColor: colors.shadow, borderWidth: 1, borderColor: colors.border, borderRadius: 14 }]}>
              <View style={styles.reviewHeader}>
                <Ionicons name="document-text-outline" size={32} color={colors.text as any} style={{ marginRight: 12 }} />
                <View style={[styles.reviewInfo, { flex: 1 }]}>
                  <Text style={[styles.serviceName, { color: colors.text }]}>{review.service}</Text>
                  <Text style={[styles.providerName, { color: colors.textSecondary }]}>{review.provider}</Text>
                  <Text style={[styles.reviewDate, { color: colors.textSecondary }]}>{review.date}</Text>
                </View>
                <View style={{ flexDirection: 'row' }}>
                  <TouchableOpacity
                    onPress={() => {
                      setEditId(review.id);
                      setEditRating(review.rating);
                      setEditText(review.review);
                      setEditVisible(true);
                    }}
                    style={{ marginRight: 12 }}
                  >
                    <Ionicons name="pencil" size={18} color="#2563eb" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      Alert.alert('Delete review', 'Are you sure you want to delete this review?', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Delete', style: 'destructive', onPress: () => setReviews(prev => prev.filter(r => r.id !== review.id)) },
                      ]);
                    }}
                  >
                    <Ionicons name="trash" size={18} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={[styles.reviewText, { color: colors.text }]}>{review.review}</Text>
            </View>
          ))}
        </View>

        {/* Empty State */}
        {!loading && reviews.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="star-outline" size={64} color={colors.textSecondary as any} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No Reviews Yet</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }] }>
              Your reviews and ratings will appear here after you complete services.
            </Text>
          </View>
        )}

        {/* Edit Review Modal */}
        <Modal visible={editVisible} transparent animationType="fade" onRequestClose={() => setEditVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={[styles.sectionTitleDark, { color: colors.text }]}>Edit review</Text>
                <TouchableOpacity onPress={() => setEditVisible(false)}>
                  <Ionicons name="close" size={22} color={colors.text as any} />
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: 'row', marginBottom: 8 }}>
                {[1,2,3,4,5].map(n => (
                  <TouchableOpacity key={n} onPress={() => setEditRating(prev => (prev === n ? n - 1 : n))} style={{ marginRight: 4 }}>
                    <Ionicons name={n <= editRating ? 'star' : 'star-outline'} size={24} color="#f59e0b" />
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.card }]} multiline value={editText} onChangeText={setEditText} />
              <TouchableOpacity
                style={[styles.submitBtn, !(editId && editText.trim()) && { opacity: 0.6 }]}
                disabled={!(editId && editText.trim())}
                onPress={async () => {
                  try {
                    // Update local state first
                    setReviews(prev => prev.map(r => r.id === editId ? { ...r, rating: editRating, review: editText.trim() } : r));
                    
                    // Update in database if it's a database review
                    const reviewToUpdate = reviews.find(r => r.id === editId);
                    if (reviewToUpdate && typeof reviewToUpdate.id === 'string' && reviewToUpdate.id.length > 10) {
                      // This looks like a database ID (UUID), try to update in database
                      const { error } = await ReviewsApi.update(reviewToUpdate.id, {
                        rating: editRating,
                        review_text: editText.trim(),
                      });
                      
                      if (error) {
                        console.error('Database review update error:', error);
                      }
                    }
                    
                    setEditVisible(false);
                  } catch (error) {
                    console.error('Error updating review:', error);
                    Alert.alert('Error', 'Failed to update review');
                  }
                }}
              >
                <LinearGradient
                  colors={["#004c8f", "#0c1a5d"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.submitGradient}
                >
                  <Text style={styles.submitText}>Save</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  overallRatingCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  overallRatingTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 16,
  },
  ratingContainer: {
    alignItems: "center",
  },
  ratingNumber: {
    fontSize: 48,
    fontWeight: "800",
    color: "#004c8f",
    marginBottom: 8,
  },
  starsContainer: {
    flexDirection: "row",
    marginBottom: 8,
  },
  ratingText: {
    fontSize: 14,
    color: "#6b7280",
  },
  addCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitleDark: { fontSize: 16, fontWeight: '800', color: '#111', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  submitBtn: { marginTop: 10, borderRadius: 10, height: 44, alignItems: 'center', justifyContent: 'center' },
  submitGradient: { borderRadius: 10, height: 44, alignItems: 'center', justifyContent: 'center', width: '100%' },
  submitText: { color: '#fff', fontWeight: '800' },
  loadingContainer: { padding: 20, alignItems: 'center' },
  loadingText: { fontSize: 16, fontStyle: 'italic' },
  reviewsSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 16,
  },
  reviewCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  reviewHeader: {
    flexDirection: "row",
    marginBottom: 12,
  },
  serviceImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 12,
  },
  reviewInfo: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  serviceName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  providerName: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 2,
  },
  reviewRating: {
    flexDirection: "row",
    alignItems: "center",
  },
  reviewDate: {
    fontSize: 12,
    color: "#9ca3af",
  },
  reviewText: {
    fontSize: 14,
    color: "#374151",
    lineHeight: 20,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 32,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  modalCard: { width: '88%', backgroundColor: '#fff', borderRadius: 12, padding: 16 },
});