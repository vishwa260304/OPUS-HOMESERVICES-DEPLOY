import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useReviews, Review } from '../context/ReviewsContext';
import { hapticButtonPress } from '../utils/haptics';

interface ReviewsSectionProps {
  serviceId: string;
  serviceTitle: string;
  onWriteReview?: () => void;
}

const ReviewsSection: React.FC<ReviewsSectionProps> = ({ 
  serviceId, 
  serviceTitle, 
  onWriteReview 
}) => {
  const { getReviewsForService, getAverageRating, markReviewHelpful } = useReviews();
  const reviews = getReviewsForService(serviceId);
  const averageRating = getAverageRating(serviceId);

  const renderStars = (rating: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Ionicons
          key={i}
          name={i <= rating ? "star" : "star-outline"}
          size={16}
          color={i <= rating ? "#FFD700" : "#ccc"}
        />
      );
    }
    return stars;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  if (reviews.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Reviews</Text>
          <TouchableOpacity 
            style={styles.writeReviewButton}
            onPress={() => {
              hapticButtonPress();
              onWriteReview?.();
            }}
          >
            <Text style={styles.writeReviewText}>Write Review</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.noReviews}>
          <Ionicons name="chatbubble-outline" size={48} color="#ccc" />
          <Text style={styles.noReviewsTitle}>No reviews yet</Text>
          <Text style={styles.noReviewsText}>
            Be the first to review {serviceTitle}!
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Reviews</Text>
          <View style={styles.ratingSummary}>
            <View style={styles.starsContainer}>
              {renderStars(Math.round(averageRating))}
            </View>
            <Text style={styles.averageRating}>{averageRating}</Text>
            <Text style={styles.reviewCount}>({reviews.length} reviews)</Text>
          </View>
        </View>
        <TouchableOpacity 
          style={styles.writeReviewButton}
          onPress={() => {
            hapticButtonPress();
            onWriteReview?.();
          }}
        >
          <Text style={styles.writeReviewText}>Write Review</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.reviewsList}
        showsVerticalScrollIndicator={false}
      >
        {reviews.map((review) => (
          <View key={review.id} style={styles.reviewCard}>
            <View style={styles.reviewHeader}>
              <View style={styles.reviewerInfo}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {review.userName.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View>
                  <Text style={styles.reviewerName}>{review.userName}</Text>
                  <View style={styles.reviewMeta}>
                    <View style={styles.starsContainer}>
                      {renderStars(review.rating)}
                    </View>
                    <Text style={styles.reviewDate}>{formatDate(review.date)}</Text>
                  </View>
                </View>
              </View>
              {review.verified && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                  <Text style={styles.verifiedText}>Verified</Text>
                </View>
              )}
            </View>
            
            <Text style={styles.reviewComment}>{review.comment}</Text>
            
            <View style={styles.reviewFooter}>
              <TouchableOpacity
                style={styles.helpfulButton}
                onPress={() => {
                  hapticButtonPress();
                  markReviewHelpful(review.id);
                }}
              >
                <Ionicons name="thumbs-up-outline" size={16} color="#666" />
                <Text style={styles.helpfulText}>Helpful ({review.helpful})</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: 15,
    marginVertical: 10,
    padding: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  ratingSummary: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    marginRight: 8,
  },
  averageRating: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginRight: 8,
  },
  reviewCount: {
    fontSize: 14,
    color: '#666',
  },
  writeReviewButton: {
    backgroundColor: '#3366ff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  writeReviewText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  noReviews: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  noReviewsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  noReviewsText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  reviewsList: {
    maxHeight: 400,
  },
  reviewCard: {
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingBottom: 16,
    marginBottom: 16,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  reviewerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3366ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  reviewerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  reviewMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewDate: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  verifiedText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '600',
    marginLeft: 4,
  },
  reviewComment: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginBottom: 12,
  },
  reviewFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  helpfulButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f8f9fa',
  },
  helpfulText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 6,
  },
});

export default ReviewsSection;
