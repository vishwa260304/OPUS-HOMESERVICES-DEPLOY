import React, { createContext, useCallback, useContext, useState, ReactNode } from 'react';
import { getReviewsByServiceId, submitReview } from '../lib/reviews';

export interface Review {
  id: string;
  serviceId: string;
  serviceTitle: string;
  rating: number;
  comment: string;
  userName: string;
  date: string;
  images?: string[];
  helpful: number;
  verified: boolean;
}

interface ReviewsContextType {
  reviews: Review[];
  addReview: (review: Omit<Review, 'id' | 'date' | 'helpful' | 'verified'>) => Promise<Review | null>;
  getReviewsForService: (serviceId: string) => Promise<Review[]>;
  getAverageRating: (serviceId: string) => number;
  markReviewHelpful: (reviewId: string) => void;
}

const ReviewsContext = createContext<ReviewsContextType | undefined>(undefined);

export const useReviews = () => {
  const context = useContext(ReviewsContext);
  if (!context) {
    throw new Error('useReviews must be used within a ReviewsProvider');
  }
  return context;
};

interface ReviewsProviderProps {
  children: ReactNode;
}

export const ReviewsProvider: React.FC<ReviewsProviderProps> = ({ children }) => {
  const [reviews, setReviews] = useState<Review[]>([]);

  const addReview = useCallback(async (reviewData: Omit<Review, 'id' | 'date' | 'helpful' | 'verified'>) => {
    try {
      const saved = await submitReview(reviewData);
      if (saved) {
        setReviews(prev => [saved, ...prev.filter(review => review.id !== saved.id)]);
      }
      return saved;
    } catch (error) {
      console.error('Error submitting review:', error);
      return null;
    }
  }, []);

  const getReviewsForService = useCallback(async (serviceId: string): Promise<Review[]> => {
    try {
      const serviceReviews = await getReviewsByServiceId(serviceId);
      setReviews(prev => {
        const otherReviews = prev.filter(review => review.serviceId !== serviceId);
        return [...serviceReviews, ...otherReviews];
      });
      return serviceReviews;
    } catch (error) {
      console.error('Error fetching reviews:', error);
      return [];
    }
  }, []);

  const getAverageRating = useCallback((serviceId: string) => {
    const serviceReviews = reviews.filter(review => review.serviceId === serviceId);
    if (serviceReviews.length === 0) return 0;
    
    const totalRating = serviceReviews.reduce((sum, review) => sum + review.rating, 0);
    return Math.round((totalRating / serviceReviews.length) * 10) / 10;
  }, [reviews]);

  const markReviewHelpful = useCallback((reviewId: string) => {
    setReviews(prev => 
      prev.map(review => 
        review.id === reviewId 
          ? { ...review, helpful: review.helpful + 1 }
        : review
      )
    );
  }, []);

  const value: ReviewsContextType = {
    reviews,
    addReview,
    getReviewsForService,
    getAverageRating,
    markReviewHelpful,
  };

  return (
    <ReviewsContext.Provider value={value}>
      {children}
    </ReviewsContext.Provider>
  );
};
