import { Dimensions, PixelRatio, Platform } from 'react-native';
import { scale as sizeMattersScale, verticalScale as sizeMattersVerticalScale, moderateScale as sizeMattersModerateScale } from 'react-native-size-matters';
import { widthPercentageToDP, heightPercentageToDP } from 'react-native-responsive-screen';

// Get window dimensions
const { width, height } = Dimensions.get('window');

// Base sizes from iPhone 14/15 reference width (for backward compatibility)
const BASE_WIDTH = 390; // iPhone 14/15 logical width
const BASE_HEIGHT = 844;

/**
 * Scale function using react-native-size-matters
 * Scales based on width (default base: 350)
 */
export const scaleSize = (size: number): number => {
  return sizeMattersScale(size);
};

/**
 * Vertical scale function using react-native-size-matters
 * Scales based on height (default base: 680)
 */
export const scaleVertical = (size: number): number => {
  return sizeMattersVerticalScale(size);
};

/**
 * Moderate scale function - combines react-native-size-matters and responsive-screen
 * Provides balanced scaling that works well across devices
 */
export const moderateScale = (size: number, factor: number = 0.5): number => {
  // Use size-matters for more consistent scaling
  return sizeMattersModerateScale(size, factor);
};

/**
 * Responsive font size using both libraries for better consistency
 */
export const responsiveFont = (size: number): number => {
  const scaledSize = sizeMattersModerateScale(size, 0.3);
  return PixelRatio.roundToNearestPixel(scaledSize);
};

/**
 * Width percentage using react-native-responsive-screen
 * @param percentage - Percentage of screen width (0-100)
 */
export const wp = (percentage: number): number => {
  return widthPercentageToDP(percentage);
};

/**
 * Height percentage using react-native-responsive-screen
 * @param percentage - Percentage of screen height (0-100)
 */
export const hp = (percentage: number): number => {
  return heightPercentageToDP(percentage);
};

/**
 * Legacy scale function (backward compatibility)
 * Uses react-native-size-matters for consistent scaling
 */
export const scale = (size: number): number => {
  return sizeMattersScale(size);
};

/**
 * Legacy verticalScale function (backward compatibility)
 * Uses react-native-size-matters for consistent scaling
 */
export const verticalScale = (size: number): number => {
  return sizeMattersVerticalScale(size);
};

// Export dimensions for direct use
export const screenWidth = width;
export const screenHeight = height;

// Platform-specific scaling helpers
export const isIOS = Platform.OS === 'ios';
export const isAndroid = Platform.OS === 'android';

/**
 * Platform-aware moderate scale
 * Slightly different scaling for iOS and Android for better visual consistency
 */
export const platformModerateScale = (size: number, factor: number = 0.5): number => {
  if (isIOS) {
    return sizeMattersModerateScale(size, factor);
  } else {
    // Android might need slightly different scaling
    return sizeMattersModerateScale(size, factor * 0.9);
  }
};
