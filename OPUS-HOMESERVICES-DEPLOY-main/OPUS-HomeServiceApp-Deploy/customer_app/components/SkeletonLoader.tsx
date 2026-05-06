import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

interface SkeletonLoaderProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
}

const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  width: skeletonWidth = '100%',
  height = 20,
  borderRadius = 8,
  style,
}) => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: false,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: false,
        }),
      ])
    );

    animation.start();

    return () => animation.stop();
  }, [animatedValue]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width: skeletonWidth,
          height,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
};

// Pre-built skeleton components for common use cases
export const ServiceCardSkeleton = () => (
  <View style={styles.serviceCardSkeleton}>
    <SkeletonLoader height={120} borderRadius={14} />
    <View style={styles.cardContentSkeleton}>
      <SkeletonLoader height={16} width="70%" />
      <SkeletonLoader height={12} width="50%" style={{ marginTop: 8 }} />
      <View style={styles.cardBottomSkeleton}>
        <SkeletonLoader height={32} width={80} borderRadius={16} />
      </View>
    </View>
  </View>
);

export const RecommendedCardSkeleton = () => (
  <View style={styles.recommendedCardSkeleton}>
    <SkeletonLoader height={100} borderRadius={16} />
    <View style={styles.recommendedContentSkeleton}>
      <SkeletonLoader height={14} width="80%" />
      <View style={styles.recommendedDetailsSkeleton}>
        <SkeletonLoader height={10} width="40%" />
        <SkeletonLoader height={10} width="30%" />
      </View>
    </View>
  </View>
);

export const BannerSkeleton = () => (
  <View style={styles.bannerSkeleton}>
    <SkeletonLoader height={200} borderRadius={20} />
  </View>
);

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#E1E9EE',
  },
  serviceCardSkeleton: {
    backgroundColor: '#fff',
    borderRadius: 14,
    width: (width - 45) / 2,
    marginRight: 15,
    overflow: 'hidden',
    elevation: 4,
  },
  cardContentSkeleton: {
    padding: 12,
  },
  cardBottomSkeleton: {
    marginTop: 12,
    alignItems: 'flex-end',
  },
  recommendedCardSkeleton: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: (width - 45) / 2,
    marginBottom: 15,
    overflow: 'hidden',
    elevation: 6,
  },
  recommendedContentSkeleton: {
    padding: 12,
  },
  recommendedDetailsSkeleton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  bannerSkeleton: {
    marginHorizontal: 25,
    marginTop: 25,
  },
});

export default SkeletonLoader;
