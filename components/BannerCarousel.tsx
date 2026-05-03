// @ts-nocheck
import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  Image,
  FlatList,
  Dimensions,
  StyleSheet,
  Animated,
  ActivityIndicator,
  NativeScrollEvent,
  NativeSyntheticEvent,
  TouchableOpacity,
} from 'react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Responsive design calculations
const getBannerDimensions = () => {
  const isTablet = screenWidth > 768;
  const isDesktop = screenWidth > 1024;

  if (isDesktop) {
    return {
      width: screenWidth * 0.75, // slightly larger cards on desktop
      height: (screenWidth * 0.75) * (9 / 18) * 1.12, // slightly taller
      itemsPerScreen: 2.2, // Show 2.2 items on desktop (adjusted for wider banners)
    };
  } else if (isTablet) {
    return {
      width: screenWidth * 0.80, // slightly larger cards on tablet
      height: (screenWidth * 0.80) * (9 / 18) * 1.12, // slightly taller
      itemsPerScreen: 1.3, // Show 1.3 items on tablet (adjusted for wider banners)
    };
  } else {
    return {
      width: screenWidth * 0.78, // slightly larger cards on mobile
      height: (screenWidth * 0.78) * (9 / 18) * 1.12, // slightly taller
      itemsPerScreen: 1, // Show 1 item on mobile
    };
  }
};

const { width: bannerWidth, height: bannerHeight, itemsPerScreen } = getBannerDimensions();
const ITEM_SPACING = 8; // Space between items - reduced gap
const SIDE_MARGIN = (screenWidth - bannerWidth) / 2;

interface BannerItem {
  id: string;
  image: string | { uri: string } | number; // Support both local and remote images
}

interface BannerCarouselProps {
  banners: BannerItem[];
  showPagination?: boolean;
  enableLazyLoading?: boolean;
  onBannerPress?: (banner: BannerItem) => void;
}

const BannerCarousel = ({
  banners,
  showPagination = true,
  enableLazyLoading = true,
  onBannerPress,
}: BannerCarouselProps): JSX.Element | null => {
  const flatListRef = useRef<FlatList<BannerItem> | null>(null);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [loadingImages, setLoadingImages] = useState<Set<string>>(new Set());
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollTimeoutRef = useRef<number | null>(null);
  const autoScrollIntervalRef = useRef<number | null>(null);
  const isUserInteractingRef = useRef<boolean>(false);

  // Ensure first banner is centered on mount (account for circular array)
  useEffect(() => {
    if (banners.length > 1) {
      // Small delay to ensure the component is fully rendered
      setTimeout(() => {
        const initialOffset = bannerWidth + ITEM_SPACING; // Skip the duplicate at the beginning
        try {
          flatListRef.current?.scrollToOffset({
            offset: initialOffset,
            animated: false,
          });
        } catch (error) {
          console.warn('Initial scroll error:', error);
        }
      }, 300); // Increased delay for better positioning
    } else if (banners.length > 0) {
      setTimeout(() => {
        try {
          flatListRef.current?.scrollToOffset({
            offset: 0,
            animated: false,
          });
        } catch (error) {
          console.warn('Initial scroll error:', error);
        }
      }, 300);
    }
  }, [banners.length, bannerWidth, ITEM_SPACING]);

  // Scroll animation value is updated via native driver in onScroll

  // Handle manual scroll start
  const handleScrollBeginDrag = useCallback(() => {
    isUserInteractingRef.current = true;
    if (autoScrollIntervalRef.current) {
      clearInterval(autoScrollIntervalRef.current);
      autoScrollIntervalRef.current = null;
    }
  }, []);

  // Handle manual scroll end - clamp to single-card step
  const handleScrollEndDrag = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    const itemWidth = bannerWidth + ITEM_SPACING;
    const offsetX = event.nativeEvent.contentOffset.x;
    const rawIndex = Math.round(offsetX / itemWidth);

    // Adjust for the duplicate at the start
    let proposedIndex = rawIndex - 1;
    if (banners.length > 1) {
      proposedIndex = Math.max(0, Math.min(banners.length - 1, proposedIndex));
    } else {
      proposedIndex = 0;
    }

    // Move only one step from the current index
    const delta = proposedIndex - currentIndex;
    if (delta !== 0) {
      const step = delta > 0 ? 1 : -1;
      let nextIndex = currentIndex + step;
      if (nextIndex < 0) nextIndex = banners.length - 1;
      if (nextIndex >= banners.length) nextIndex = 0;

      const targetOffset = (nextIndex + 1) * itemWidth; // +1 for leading duplicate
      try {
        flatListRef.current?.scrollToOffset({ offset: targetOffset, animated: true });
      } catch { }
      setCurrentIndex(nextIndex);
    }
  }, [banners.length, bannerWidth, currentIndex]);

  // Handle momentum scroll end for smoother transitions
  const handleMomentumScrollEnd = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    // Persist the event data to avoid null reference
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const itemWidth = bannerWidth + ITEM_SPACING;
    const index = Math.round(contentOffsetX / itemWidth);

    if (banners.length > 1) {
      // Handle circular scrolling with smooth momentum
      if (index === 0) {
        // Scrolled to the duplicate at the beginning, jump to the real last banner
        setTimeout(() => {
          flatListRef.current?.scrollToOffset({
            offset: banners.length * itemWidth,
            animated: false,
          });
        }, 100);
        setCurrentIndex(banners.length - 1);
      } else if (index === banners.length + 1) {
        // Scrolled to the duplicate at the end, jump to the real first banner
        setTimeout(() => {
          flatListRef.current?.scrollToOffset({
            offset: itemWidth,
            animated: false,
          });
        }, 100);
        setCurrentIndex(0);
      } else {
        // Normal scrolling, adjust index for the duplicate at the beginning
        setCurrentIndex(index - 1);
      }
    } else {
      setCurrentIndex(index);
    }
    // resume auto scroll after user interaction ends
    isUserInteractingRef.current = false;
    if (!autoScrollIntervalRef.current) {
      // restart timer shortly after momentum ends
      setTimeout(() => {
        if (!isUserInteractingRef.current) startAutoScroll();
      }, 800);
    }
  }, [banners.length, bannerWidth, ITEM_SPACING]);

  // Handle scroll end with circular scrolling
  const handleScrollEnd = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    // Persist the event data to avoid null reference
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const itemWidth = bannerWidth + ITEM_SPACING;
    const index = Math.round(contentOffsetX / itemWidth);

    if (banners.length > 1) {
      // Handle circular scrolling
      if (index === 0) {
        // Scrolled to the duplicate at the beginning, jump to the real last banner
        setTimeout(() => {
          flatListRef.current?.scrollToOffset({
            offset: banners.length * itemWidth,
            animated: false,
          });
        }, 100);
        setCurrentIndex(banners.length - 1);
      } else if (index === banners.length + 1) {
        // Scrolled to the duplicate at the end, jump to the real first banner
        setTimeout(() => {
          flatListRef.current?.scrollToOffset({
            offset: itemWidth,
            animated: false,
          });
        }, 100);
        setCurrentIndex(0);
      } else {
        // Normal scrolling, adjust index for the duplicate at the beginning
        setCurrentIndex(index - 1);
      }
    } else {
      setCurrentIndex(index);
    }
  }, [banners.length, bannerWidth, ITEM_SPACING]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      if (autoScrollIntervalRef.current) {
        clearInterval(autoScrollIntervalRef.current);
      }
    };
  }, []);

  // Scroll handlers removed (no auto-slide)
  // Auto-scroll logic
  const startAutoScroll = useCallback(() => {
    if (autoScrollIntervalRef.current || banners.length <= 1) return;
    const itemWidth = bannerWidth + ITEM_SPACING;
    autoScrollIntervalRef.current = setInterval(() => {
      if (isUserInteractingRef.current) return;
      const isAtLast = currentIndex === banners.length - 1;
      try {
        if (isAtLast) {
          // Step 1: animate to trailing duplicate (seamless forward motion)
          flatListRef.current?.scrollToOffset({
            offset: (banners.length + 1) * itemWidth,
            animated: true,
          });
          // Step 2: after animation completes, jump to first real item without animation
          if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
          scrollTimeoutRef.current = setTimeout(() => {
            flatListRef.current?.scrollToOffset({
              offset: itemWidth,
              animated: false,
            });
            setCurrentIndex(0);
          }, 450) as unknown as number; // small delay to allow the animated scroll to finish
        } else {
          const nextIndex = currentIndex + 1;
          flatListRef.current?.scrollToOffset({
            offset: (nextIndex + 1) * itemWidth,
            animated: true,
          });
          setCurrentIndex(nextIndex);
        }
      } catch { }
    }, 3500) as unknown as number;
  }, [banners.length, bannerWidth, currentIndex]);

  useEffect(() => {
    startAutoScroll();
    return () => {
      if (autoScrollIntervalRef.current) {
        clearInterval(autoScrollIntervalRef.current);
        autoScrollIntervalRef.current = null;
      }
    };
  }, [startAutoScroll]);

  // Image loading handlers
  const handleImageLoadStart = (imageId: string) => {
    if (enableLazyLoading) {
      setLoadingImages((prev: Set<string>) => new Set(prev).add(imageId));
    }
  };

  const handleImageLoadEnd = (imageId: string) => {
    if (enableLazyLoading) {
      setLoadingImages((prev: Set<string>) => {
        const newSet = new Set(prev);
        newSet.delete(imageId);
        return newSet;
      });
    }
  };

  // Render loading placeholder
  const renderLoadingPlaceholder = () => (
    <View style={[styles.bannerImage, styles.loadingPlaceholder]}>
      <ActivityIndicator size="large" color="#007AFF" />
    </View>
  );

  // Render banner item - memoized for performance
  const renderBannerItem = React.useCallback(({ item, index }: { item: BannerItem; index: number }) => {
    const inputRange = [
      (index - 1) * (bannerWidth + ITEM_SPACING),
      index * (bannerWidth + ITEM_SPACING),
      (index + 1) * (bannerWidth + ITEM_SPACING),
    ];

    // Increased opacity for side banners for better visibility
    const opacity = scrollX.interpolate({
      inputRange,
      outputRange: [0.6, 1.0, 0.6],
      extrapolate: 'clamp',
    });

    // Restore subtle scale for center card
    const scale = scrollX.interpolate({
      inputRange,
      outputRange: [0.92, 1.08, 0.92],
      extrapolate: 'clamp',
    });

    // Restore slight vertical translate for depth
    const translateY = scrollX.interpolate({
      inputRange,
      outputRange: [4, 0, 4],
      extrapolate: 'clamp',
    });

    const isImageLoading = enableLazyLoading && loadingImages.has(item.id);

    return (
      <Animated.View
        style={[
          styles.bannerContainer,
          {
            opacity,
            transform: [{ scale }, { translateY }],
          },
        ]}
        renderToHardwareTextureAndroid={true}
        shouldRasterizeIOS={true}
      >
        <TouchableOpacity
          style={styles.bannerCard}
          onPress={() => onBannerPress?.(item)}
          activeOpacity={0.8}
        >
          {isImageLoading ? (
            renderLoadingPlaceholder()
          ) : (
            <Image
              source={typeof item.image === 'string' ? { uri: item.image } : item.image}
              style={styles.bannerImage}
              onLoadStart={() => handleImageLoadStart(item.id)}
              onLoadEnd={() => handleImageLoadEnd(item.id)}
              onError={() => handleImageLoadEnd(item.id)}
              resizeMode="cover"
            />
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  }, [scrollX, bannerWidth, ITEM_SPACING, enableLazyLoading, loadingImages, onBannerPress]);

  // Render pagination dots
  const renderPaginationDots = () => {
    if (!showPagination || banners.length <= 1) return null;

    return (
      <View style={styles.paginationContainer}>
        {banners.map((_, index: number) => {
          const isActive = index === currentIndex;
          return (
            <View
              key={index}
              style={[
                styles.paginationDot,
                isActive && styles.paginationDotActive,
              ]}
            />
          );
        })}
      </View>
    );
  };

  if (banners.length === 0) return null;

  // Create circular data array with duplicates for seamless scrolling
  const displayBanners = banners.length > 1
    ? [
      { ...banners[banners.length - 1], id: `${banners[banners.length - 1].id}-duplicate-start` },
      ...banners,
      { ...banners[0], id: `${banners[0].id}-duplicate-end` }
    ]
    : banners;

  return (
    <View
      style={styles.container}
    >
      <Animated.FlatList
        ref={flatListRef}
        data={displayBanners}
        renderItem={renderBannerItem}
        keyExtractor={(item: BannerItem, index: number) => `${item.id}-${index}`}
        horizontal
        pagingEnabled={false}
        showsHorizontalScrollIndicator={false}
        snapToInterval={bannerWidth + ITEM_SPACING}
        snapToAlignment="start"
        decelerationRate="fast"
        directionalLockEnabled={true}
        alwaysBounceVertical={false}
        alwaysBounceHorizontal={true}
        overScrollMode="never"
        scrollsToTop={false}
        contentContainerStyle={[
          styles.flatListContainer,
          {
            paddingLeft: SIDE_MARGIN,
            paddingRight: SIDE_MARGIN,
            alignItems: 'center',
            paddingBottom: 10,
          }
        ]}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScrollEndDrag={handleScrollEndDrag}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={32}
        bounces={false}
        disableIntervalMomentum={true}
        disableScrollViewPanResponder={true}
        removeClippedSubviews={true}
        initialNumToRender={3}
        maxToRenderPerBatch={3}
        windowSize={5}
        updateCellsBatchingPeriod={50}
        getItemLayout={(_data: BannerItem[] | null, index: number) => ({
          length: bannerWidth + ITEM_SPACING,
          offset: (bannerWidth + ITEM_SPACING) * index,
          index,
        })}
        onScrollToIndexFailed={(info: { index: number; highestMeasuredFrameIndex: number; averageItemLength: number }) => {
          // Fallback for scroll to index
          const wait = new Promise(resolve => setTimeout(resolve, 500));
          wait.then(() => {
            flatListRef.current?.scrollToIndex({
              index: info.index,
              animated: true,
            });
          });
        }}
        renderToHardwareTextureAndroid={true}
        shouldRasterizeIOS={true}
      />
      {renderPaginationDots()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 15, // Increased top margin for more gap from header
    marginBottom: 16,
  },
  flatListContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerContainer: {
    width: bannerWidth,
    height: bannerHeight,
    marginVertical: 10,
    marginHorizontal: ITEM_SPACING / 2,
    // Android-specific optimizations to prevent translucent overlay
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderColor: 'transparent',
  },
  bannerCard: {
    width: '100%',
    height: '100%',
    borderRadius: 16, // More rounded like District
    overflow: 'hidden',
    elevation: 0, // Enhanced shadow for pop-out effect
    shadowColor: '#000',
    shadowOpacity: 0,
    shadowRadius: 12,
    marginLeft: 0,
    shadowOffset: { width: 0, height: 8 },
    backgroundColor: '#f8f9fa', // Light background for loading state
    // Android-specific optimizations
    borderWidth: 0,
    borderColor: 'transparent',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'stretch',
  },
  loadingPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    gap: 8,
  },
  paginationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(0, 76, 143, 0.3)',
    marginHorizontal: 3,
  },
  paginationDotActive: {
    backgroundColor: '#004c8f',
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 3,
  },
});

export default BannerCarousel;