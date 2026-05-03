import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useReviews } from '../context/ReviewsContext';
import { hapticButtonPress, hapticSuccess } from '../utils/haptics';

interface WriteReviewModalProps {
  visible: boolean;
  onClose: () => void;
  serviceId: string;
  serviceTitle: string;
}

const WriteReviewModal: React.FC<WriteReviewModalProps> = ({
  visible,
  onClose,
  serviceId,
  serviceTitle,
}) => {
  const { addReview } = useReviews();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [userName, setUserName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert('Please select a rating');
      return;
    }
    if (comment.trim().length < 10) {
      Alert.alert('Please write a review (at least 10 characters)');
      return;
    }
    if (userName.trim().length === 0) {
      Alert.alert('Please enter your name');
      return;
    }

    setSubmitting(true);
    try {
      const saved = await addReview({
        serviceId,
        serviceTitle,
        rating,
        comment: comment.trim(),
        userName: userName.trim(),
      });

      if (!saved) {
        Alert.alert('Review not submitted', 'Reviews can only be submitted for completed bookings.');
        return;
      }

      hapticSuccess();
      Alert.alert('Thank you!', 'Your review has been submitted successfully.');
      
      // Reset form
      setRating(0);
      setComment('');
      setUserName('');
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const renderStars = () => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <TouchableOpacity
          key={i}
          onPress={() => {
            hapticButtonPress();
            setRating(i);
          }}
        >
          <Ionicons
            name={i <= rating ? "star" : "star-outline"}
            size={40}
            color={i <= rating ? "#FFD700" : "#ccc"}
            style={styles.star}
          />
        </TouchableOpacity>
      );
    }
    return stars;
  };

  const getRatingText = () => {
    const ratingTexts = {
      1: 'Poor',
      2: 'Fair',
      3: 'Good',
      4: 'Very Good',
      5: 'Excellent',
    };
    return ratingTexts[rating as keyof typeof ratingTexts] || 'Select Rating';
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>Write a Review</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <Text style={styles.serviceTitle}>{serviceTitle}</Text>
            
            {/* Rating Selection */}
            <View style={styles.ratingSection}>
              <Text style={styles.sectionTitle}>Rate your experience</Text>
              <View style={styles.starsContainer}>
                {renderStars()}
              </View>
              <Text style={styles.ratingText}>{getRatingText()}</Text>
            </View>

            {/* Name Input */}
            <View style={styles.inputSection}>
              <Text style={styles.sectionTitle}>Your Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your name"
                value={userName}
                onChangeText={setUserName}
                maxLength={30}
              />
            </View>

            {/* Comment Input */}
            <View style={styles.inputSection}>
              <Text style={styles.sectionTitle}>Your Review</Text>
              <TextInput
                style={[styles.input, styles.commentInput]}
                placeholder="Share your experience with this service..."
                value={comment}
                onChangeText={setComment}
                multiline
                numberOfLines={4}
                maxLength={500}
                textAlignVertical="top"
              />
              <Text style={styles.characterCount}>
                {comment.length}/500 characters
              </Text>
            </View>
          </ScrollView>

          {/* Submit Button */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[
                styles.submitButton,
                (rating === 0 || comment.trim().length < 10 || userName.trim().length === 0) &&
                styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={submitting || rating === 0 || comment.trim().length < 10 || userName.trim().length === 0}
            >
              <Text style={styles.submitButtonText}>{submitting ? 'Submitting...' : 'Submit Review'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 5,
  },
  content: {
    padding: 20,
  },
  serviceTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  ratingSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  starsContainer: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  star: {
    marginHorizontal: 4,
  },
  ratingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  inputSection: {
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  commentInput: {
    height: 100,
  },
  characterCount: {
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
    marginTop: 4,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  submitButton: {
    backgroundColor: '#3366ff',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default WriteReviewModal;
