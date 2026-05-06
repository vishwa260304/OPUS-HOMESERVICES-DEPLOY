import React, { createContext, useContext, useState, ReactNode } from 'react';

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
  addReview: (review: Omit<Review, 'id' | 'date' | 'helpful' | 'verified'>) => void;
  getReviewsForService: (serviceId: string) => Review[];
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
  const [reviews, setReviews] = useState<Review[]>([
    // Sample reviews for demonstration
    {
      id: '1',
      serviceId: '1',
      serviceTitle: 'AC Repair',
      rating: 5,
      comment: 'Excellent service! The technician was very professional and fixed my AC quickly. Highly recommended!',
      userName: 'Rahul S.',
      date: '2024-01-15',
      helpful: 12,
      verified: true,
    },
    {
      id: '2',
      serviceId: '1',
      serviceTitle: 'AC Repair',
      rating: 4,
      comment: 'Good service, arrived on time. AC is working well now.',
      userName: 'Priya M.',
      date: '2024-01-14',
      helpful: 8,
      verified: true,
    },
    {
      id: '3',
      serviceId: '2',
      serviceTitle: 'Lab Testing',
      rating: 5,
      comment: 'Very professional lab. Results were accurate and delivered on time.',
      userName: 'Arun K.',
      date: '2024-01-13',
      helpful: 15,
      verified: true,
    },
    {
      id: '4',
      serviceId: '11',
      serviceTitle: 'Pest Control',
      rating: 4,
      comment: 'Effective pest control service. The team was thorough and professional.',
      userName: 'Meera R.',
      date: '2024-01-12',
      helpful: 6,
      verified: true,
    },
    {
      id: '5',
      serviceId: '12',
      serviceTitle: 'Painting',
      rating: 5,
      comment: 'Amazing painting work! The quality is outstanding and they finished on schedule.',
      userName: 'Vikram P.',
      date: '2024-01-11',
      helpful: 20,
      verified: true,
    },
  ]);

  const addReview = (reviewData: Omit<Review, 'id' | 'date' | 'helpful' | 'verified'>) => {
    const newReview: Review = {
      ...reviewData,
      id: Date.now().toString(),
      date: new Date().toISOString().split('T')[0],
      helpful: 0,
      verified: true,
    };
    setReviews(prev => [newReview, ...prev]);
  };

  const getReviewsForService = (serviceId: string) => {
    return reviews.filter(review => review.serviceId === serviceId);
  };

  const getAverageRating = (serviceId: string) => {
    const serviceReviews = getReviewsForService(serviceId);
    if (serviceReviews.length === 0) return 0;
    
    const totalRating = serviceReviews.reduce((sum, review) => sum + review.rating, 0);
    return Math.round((totalRating / serviceReviews.length) * 10) / 10;
  };

  const markReviewHelpful = (reviewId: string) => {
    setReviews(prev => 
      prev.map(review => 
        review.id === reviewId 
          ? { ...review, helpful: review.helpful + 1 }
          : review
      )
    );
  };

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
