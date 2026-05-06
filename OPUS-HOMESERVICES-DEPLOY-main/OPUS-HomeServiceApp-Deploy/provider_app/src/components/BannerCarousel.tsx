// @ts-nocheck
import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  Dimensions,
  StyleSheet,
  Animated,
  ActivityIndicator,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Responsive design calculations
const getBannerDimensions = () => {
  const isTablet = screenWidth > 768;
  const isDesktop = screenWidth > 1024;
  
  if (isDesktop) {
    return {
      width: screenWidth * 0.74,
      height: 168, // slightly reduced further
      itemsPerScreen: 2.2,
    } as const;
  } else if (isTablet) {
    return {
      width: screenWidth * 0.79,
      height: 160, // slightly reduced further
      itemsPerScreen: 1.3,
    } as const;
  } else {
    return {
      width: screenWidth * 0.77,
      height: 148, // slightly reduced further
      itemsPerScreen: 1,
    } as const;
  }
};

const { width: bannerWidth, height: bannerHeight, itemsPerScreen } = getBannerDimensions();
const ITEM_SPACING = 8; // Space between items - reduced gap
// We'll compute side margin based on the actual container width for perfect centering inside padded parents

interface BannerItem {
  id: string;
  image?: string | { uri: string } | number; // Support both local and remote images
  component?: React.ReactNode; // Support custom components
}

interface BannerCarouselProps {
  banners?: BannerItem[];
  showPagination?: boolean;
  enableLazyLoading?: boolean;
  autoTips?: boolean; // when true, auto-generate 4 sector-based tip cards
}

import { useTheme } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getSelectedSector } from '../utils/appState';

const BannerCarousel = ({
  banners = [],
  showPagination = true,
  enableLazyLoading = true,
  autoTips = true,
}: BannerCarouselProps): JSX.Element | null => {
  const flatListRef = useRef<FlatList<BannerItem> | null>(null);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [loadingImages, setLoadingImages] = useState<Set<string>>(new Set());
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollTimeoutRef = useRef<number | null>(null);
  const autoScrollIntervalRef = useRef<number | null>(null);
  const isUserInteractingRef = useRef<boolean>(false);
  const [containerWidth, setContainerWidth] = useState<number>(screenWidth);
  const widthRatio = bannerWidth / screenWidth;
  const effectiveBannerWidth = Math.max(0, Math.round(containerWidth * widthRatio));
  const sideMargin = Math.max(0, Math.round((containerWidth - effectiveBannerWidth) / 2));
  const itemWidth = effectiveBannerWidth + ITEM_SPACING;

  // Auto-generate sector tips if requested
  const { colors } = useTheme();
  const sector = (getSelectedSector?.() as 'home' | 'healthcare' | 'automobile' | 'appliance') || 'home';
  const sectorPrimary = sector === 'healthcare' ? '#0AAE8A' : sector === 'automobile' ? '#FF6B00' : sector === 'appliance' ? '#6C63FF' : '#3B5BFD';

  const tipsData: BannerItem[] = React.useMemo(() => {
    if (!autoTips) return banners;
    const tips = {
      home: [
        { t: 'Evening Hot Time', s: '5–8 PM surge', b: 'Plumbing and AC cleaning in high demand' },
        { t: 'Weekend Peak', s: 'Sat–Sun', b: 'Deep cleaning and handyman tasks trend up' },
        { t: 'Neighborhood Demand', s: 'Your area', b: 'Fan installation requests increasing this week' },
        { t: 'Stay Online', s: 'High conversion', b: 'Respond under 2 min to win more jobs' },
      ],
      healthcare: [
        { t: 'Morning Hot Time', s: '7–10 AM', b: 'Home sample collection spikes before office hours' },
        { t: 'Chronic Care', s: 'Steady demand', b: 'BP & sugar check packages popular this week' },
        { t: 'Nearby Clinics', s: 'Tie-ups', b: 'Offer quick reports for more referrals' },
        { t: 'Stay Online', s: 'Faster assignment', b: 'Instant confirm boosts patient trust' },
      ],
      automobile: [
        { t: 'Commute Peak', s: '8–10 AM, 6–8 PM', b: 'Puncture repair and jump-start leads rise' },
        { t: 'Weekend Trips', s: 'Fri evening', b: 'Bike service bookings increase before travel' },
        { t: 'Spare Alerts', s: 'Availability', b: 'Keep common spares ready for quick wins' },
        { t: 'Stay Online', s: 'Top of list', b: 'Fast response ranks you higher nearby' },
      ],
      appliance: [
        { t: 'Afternoon Calls', s: '12–3 PM', b: 'AC & fridge complaints spike in heat' },
        { t: 'Warranty Push', s: 'Upsell', b: 'Offer AMC to convert one-time jobs' },
        { t: 'Local Trend', s: 'Your area', b: 'Washing machine service in demand this week' },
        { t: 'Stay Online', s: 'More assigns', b: 'Keep app active for priority routing' },
      ],
    } as const;

    const items = (tips[sector] || tips.home).slice(0, 4).map((tip, idx) => ({
      id: `tip-${sector}-${idx}`,
      component: (
        <LinearGradient colors={sector === 'healthcare' ? ['#0BB48F', '#0A8F6A'] : ['#0b1960', '#001973']} start={{ x:0, y:0 }} end={{ x:0, y:1 }} style={styles.tipCard}>
          <View>
            <Text style={styles.tipTitle}>{tip.t}</Text>
            <Text style={styles.tipSub}>{tip.s}</Text>
          </View>
          <Text style={styles.tipBody}>{tip.b}</Text>
          <View style={styles.tipChevron}><Ionicons name="chevron-forward" size={16} color="#ffffff" /></View>
        </LinearGradient>
      ),
    }));
    return items;
  }, [autoTips, banners, sector, sectorPrimary]);

  const effectiveBanners = autoTips ? tipsData : banners;

  // Ensure first banner is centered on mount (account for circular array)
  useEffect(() => {
    if (effectiveBanners.length > 1) {
      setTimeout(() => {
        const initialOffset = itemWidth; // Skip the duplicate at the beginning
        try {
          flatListRef.current?.scrollToOffset({
            offset: initialOffset,
            animated: false,
          });
        } catch (error) {
          console.warn('Initial scroll error:', error);
        }
      }, 300);
    } else if (effectiveBanners.length > 0) {
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
  }, [effectiveBanners.length, bannerWidth, ITEM_SPACING]);

  const handleScrollBeginDrag = useCallback(() => {
    isUserInteractingRef.current = true;
    if (autoScrollIntervalRef.current) {
      clearInterval(autoScrollIntervalRef.current);
      autoScrollIntervalRef.current = null;
    }
  }, []);

  const handleScrollEndDrag = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    const offsetX = event.nativeEvent.contentOffset.x;
    const rawIndex = Math.round(offsetX / itemWidth);

    let proposedIndex = rawIndex - 1;
    if (effectiveBanners.length > 1) {
      proposedIndex = Math.max(0, Math.min(banners.length - 1, proposedIndex));
    } else {
      proposedIndex = 0;
    }

    const delta = proposedIndex - currentIndex;
    if (delta !== 0) {
      const step = delta > 0 ? 1 : -1;
      let nextIndex = currentIndex + step;
      if (nextIndex < 0) nextIndex = banners.length - 1;
      if (nextIndex >= banners.length) nextIndex = 0;

      const targetOffset = (nextIndex + 1) * itemWidth; // +1 for leading duplicate
      try {
        flatListRef.current?.scrollToOffset({ offset: targetOffset, animated: true });
      } catch {}
      setCurrentIndex(nextIndex);
    }
  }, [effectiveBanners.length, itemWidth, currentIndex]);

  const handleMomentumScrollEnd = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const itemWidthLocal = itemWidth;
    const index = Math.round(contentOffsetX / itemWidthLocal);
    
    if (effectiveBanners.length > 1) {
      if (index === 0) {
        setTimeout(() => {
          flatListRef.current?.scrollToOffset({
            offset: effectiveBanners.length * itemWidthLocal,
            animated: false,
          });
        }, 100);
        setCurrentIndex(effectiveBanners.length - 1);
      } else if (index === effectiveBanners.length + 1) {
        setTimeout(() => {
          flatListRef.current?.scrollToOffset({
            offset: itemWidthLocal,
            animated: false,
          });
        }, 100);
        setCurrentIndex(0);
      } else {
        setCurrentIndex(index - 1);
      }
    } else {
      setCurrentIndex(index);
    }
    isUserInteractingRef.current = false;
    if (!autoScrollIntervalRef.current) {
      setTimeout(() => {
        if (!isUserInteractingRef.current) startAutoScroll();
      }, 800);
    }
  }, [effectiveBanners.length, itemWidth]);

  const handleScrollEnd = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const itemWidthLocal = itemWidth;
    const index = Math.round(contentOffsetX / itemWidthLocal);
    
    if (effectiveBanners.length > 1) {
      if (index === 0) {
        setTimeout(() => {
          flatListRef.current?.scrollToOffset({
            offset: effectiveBanners.length * itemWidthLocal,
            animated: false,
          });
        }, 100);
        setCurrentIndex(effectiveBanners.length - 1);
      } else if (index === effectiveBanners.length + 1) {
        setTimeout(() => {
          flatListRef.current?.scrollToOffset({
            offset: itemWidthLocal,
            animated: false,
          });
        }, 100);
        setCurrentIndex(0);
      } else {
        setCurrentIndex(index - 1);
      }
    } else {
      setCurrentIndex(index);
    }
  }, [effectiveBanners.length, itemWidth]);

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

  const startAutoScroll = useCallback(() => {
    if (autoScrollIntervalRef.current || effectiveBanners.length <= 1) return;
    const itemWidthLocal = itemWidth;
    autoScrollIntervalRef.current = setInterval(() => {
      if (isUserInteractingRef.current) return;
      const isAtLast = currentIndex === effectiveBanners.length - 1;
      try {
        if (isAtLast) {
          flatListRef.current?.scrollToOffset({
            offset: (effectiveBanners.length + 1) * itemWidthLocal,
            animated: true,
          });
          if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
          scrollTimeoutRef.current = setTimeout(() => {
            flatListRef.current?.scrollToOffset({
              offset: itemWidthLocal,
              animated: false,
            });
            setCurrentIndex(0);
          }, 450) as unknown as number;
        } else {
          const nextIndex = currentIndex + 1;
          flatListRef.current?.scrollToOffset({
            offset: (nextIndex + 1) * itemWidthLocal,
            animated: true,
          });
          setCurrentIndex(nextIndex);
        }
      } catch {}
    }, 3500) as unknown as number;
  }, [effectiveBanners.length, itemWidth, currentIndex]);

  useEffect(() => {
    startAutoScroll();
    return () => {
      if (autoScrollIntervalRef.current) {
        clearInterval(autoScrollIntervalRef.current);
        autoScrollIntervalRef.current = null;
      }
    };
  }, [startAutoScroll]);

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

  const renderLoadingPlaceholder = () => (
    <View style={[styles.bannerImage, styles.loadingPlaceholder]}>
      <ActivityIndicator size="large" color="#007AFF" />
    </View>
  );

  const renderBannerItem = ({ item, index }: { item: BannerItem; index: number }) => {
    const inputRange = [
      (index - 1) * itemWidth,
      index * itemWidth,
      (index + 1) * itemWidth,
    ];

    const opacity = scrollX.interpolate({
      inputRange,
      outputRange: [0.2, 1.0, 0.2],
      extrapolate: 'clamp',
    });

    const scale = scrollX.interpolate({
      inputRange,
      outputRange: [0.92, 1.08, 0.92],
      extrapolate: 'clamp',
    });

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
            width: effectiveBannerWidth,
          },
        ]}
      >
        <Animated.View style={[styles.bannerCard]} renderToHardwareTextureAndroid shouldRasterizeIOS>
          {item.component ? (
            item.component
          ) : isImageLoading ? (
            renderLoadingPlaceholder()
          ) : (
            <Image
              source={typeof item.image === 'string' ? { uri: item.image } : item.image}
              style={styles.bannerImage}
              onLoadStart={() => handleImageLoadStart(item.id)}
              onLoadEnd={() => handleImageLoadEnd(item.id)}
              onError={() => handleImageLoadEnd(item.id)}
            />
          )}
        </Animated.View>
      </Animated.View>
    );
  };

  const renderPaginationDots = () => {
    if (!showPagination || banners.length <= 1) return null;

    return (
      <View style={styles.paginationContainer}>
        {banners.map((_, index: number) => {
          const isActive = index === currentIndex;
          return (
            <View
              key={`dot-${index}`}
              style={[styles.paginationDot, isActive && styles.paginationDotActive]}
            />
          );
        })}
      </View>
    );
  };

  const sourceBanners = effectiveBanners;
  if (sourceBanners.length === 0) return null;

  const displayBanners: BannerItem[] = sourceBanners.length > 1 
    ? [
        { ...sourceBanners[sourceBanners.length - 1], id: `${sourceBanners[sourceBanners.length - 1].id}-duplicate-start` },
        ...sourceBanners,
        { ...sourceBanners[0], id: `${sourceBanners[0].id}-duplicate-end` }
      ]
    : sourceBanners;

  return (
    <View style={[styles.container, { marginBottom: 8 }]} onLayout={(e)=> setContainerWidth(Math.max(0, Math.round(e.nativeEvent.layout.width)))}> 
      <Animated.FlatList
        ref={flatListRef}
        data={displayBanners}
        renderItem={renderBannerItem}
        keyExtractor={(item: BannerItem, index: number) => `${item.id}-${index}`}
        horizontal
        pagingEnabled={false}
        showsHorizontalScrollIndicator={false}
        snapToInterval={itemWidth}
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
            paddingLeft: sideMargin,
            paddingRight: sideMargin,
            alignItems: 'center',
            paddingBottom: 10,
          }
        ]}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScrollEndDrag={handleScrollEnd}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        bounces={false}
        disableIntervalMomentum={true}
        disableScrollViewPanResponder={true}
        removeClippedSubviews={false}
        initialNumToRender={4}
        maxToRenderPerBatch={6}
        windowSize={10}
        getItemLayout={(_data: BannerItem[] | null, index: number) => ({
          length: itemWidth,
          offset: itemWidth * index,
          index,
        })}
        onScrollToIndexFailed={(info: { index: number; highestMeasuredFrameIndex: number; averageItemLength: number }) => {
          const wait = new Promise(resolve => setTimeout(resolve, 500));
          wait.then(() => {
            flatListRef.current?.scrollToIndex({
              index: info.index,
              animated: true,
            });
          });
        }}
      />
      {renderPaginationDots()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginTop: 12, marginBottom: 12 },
  flatListContainer: { alignItems: 'center', justifyContent: 'center' },
  bannerContainer: { width: bannerWidth, height: bannerHeight + 16, marginVertical: 6, marginHorizontal: ITEM_SPACING / 2 },
  bannerCard: { width: '100%', height: '100%', borderRadius: 16, overflow: 'hidden', elevation: 8, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 8 } },
  bannerImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  loadingPlaceholder: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' },
  paginationContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 10, gap: 8 },
  paginationDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(0, 76, 143, 0.3)', marginHorizontal: 3 },
  paginationDotActive: { backgroundColor: '#004c8f', width: 8, height: 8, borderRadius: 4, marginHorizontal: 3 },
  // Tip card styles
  tipCard: { borderRadius: 16, padding: 16, height: '100%', justifyContent:'center' },
  tipTitle: { color:'#ffffff', fontWeight:'900', fontSize: 14 },
  tipSub: { color:'#e8eeff', marginTop: 4, fontWeight:'700' },
  tipBody: { color:'#ffffff', marginTop: 10, fontWeight:'900', fontSize: 16 },
  tipChevron: { position:'absolute', right: 12, bottom: 12, backgroundColor:'rgba(255,255,255,0.18)', width: 30, height: 30, borderRadius: 10, alignItems:'center', justifyContent:'center' },
});

export default BannerCarousel;


