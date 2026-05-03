import { useColorScheme } from '../hooks/useColorScheme';
import * as Sentry from '@sentry/react-native';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import Constants from 'expo-constants';
import { useFonts } from 'expo-font';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { CartProvider } from '../context/CartContext';
import { UserProvider } from '../context/UserContext';
import { ThemeProvider as AppThemeProvider } from '../context/ThemeContext';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { AnalyticsProvider } from '../context/AnalyticsContext';
import { ReviewsProvider } from '../context/ReviewsContext';
import ErrorBoundary from '../components/ErrorBoundary';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const sentryDsn =
  Constants.expoConfig?.extra?.EXPO_PUBLIC_SENTRY_DSN ??
  process.env.EXPO_PUBLIC_SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: process.env.NODE_ENV ?? 'development',
  });
}

function AnimatedSplashScreen() {
  // Animation values for Zomato-style splash
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.5);
  const logoTranslateY = useSharedValue(20);
  
  const taglineOpacity = useSharedValue(0);
  const taglineTranslateY = useSharedValue(15);
  
  const backgroundOpacity = useSharedValue(0);

  useEffect(() => {
    backgroundOpacity.value = withTiming(1, { duration: 300 });

    const logoTimer = setTimeout(() => {
      logoOpacity.value = withTiming(1, { duration: 600 });
      logoScale.value = withSequence(
        withTiming(1.1, { duration: 300, easing: Easing.out(Easing.back(1.5)) }),
        withTiming(1, { duration: 200, easing: Easing.out(Easing.back(1.2)) })
      );
      logoTranslateY.value = withTiming(0, { duration: 600, easing: Easing.out(Easing.cubic) });
    }, 200);

    const taglineTimer = setTimeout(() => {
      taglineOpacity.value = withTiming(1, { duration: 500 });
      taglineTranslateY.value = withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) });
    }, 800);

    return () => {
      clearTimeout(logoTimer);
      clearTimeout(taglineTimer);
    };
  }, [
    backgroundOpacity,
    logoOpacity,
    logoScale,
    logoTranslateY,
    taglineOpacity,
    taglineTranslateY,
  ]);

  // Animated styles
  const backgroundStyle = useAnimatedStyle(() => ({
    opacity: backgroundOpacity.value,
  }), []);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [
      { scale: logoScale.value },
      { translateY: logoTranslateY.value },
    ],
  }), []);

  const taglineStyle = useAnimatedStyle(() => ({
    opacity: taglineOpacity.value,
    transform: [{ translateY: taglineTranslateY.value }],
  }), []);

  return (
    <View style={styles.splashContainer}>
      {/* Blue Gradient Background */}
      <Animated.View style={[StyleSheet.absoluteFillObject, backgroundStyle]}>
        <LinearGradient
          colors={['#004c8f', '#0c1a5d']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>
      
      {/* Fixit Logo */}
      <Animated.View style={[styles.logoContainer, logoStyle]}>
        <Text style={styles.logoText}>FIXIT</Text>
      </Animated.View>
      
      {/* Tagline */}
      <Animated.View style={[styles.taglineContainer, taglineStyle]}>
        <Text style={styles.taglineText}>service at your door step</Text>
      </Animated.View>
    </View>
  );
}

// Prevent the native splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

function RootLayoutContent() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  const [showSplash, setShowSplash] = useState(true);
  const [hasNavigated, setHasNavigated] = useState(false);
  const router = useRouter();
  const routerRef = useRef(router);
  const splashStartRef = useRef(Date.now());
  const { session, loading: authLoading } = useAuth();
  const isConnected = useNetworkStatus();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  // Hide native splash screen when fonts and auth state are both ready.
  useEffect(() => {
    if (loaded && !authLoading) {
      SplashScreen.hideAsync();
    }
  }, [loaded, authLoading]);

  useEffect(() => {
    if (!loaded || authLoading) {
      return;
    }

    const elapsed = Date.now() - splashStartRef.current;
    const remaining = Math.max(0, 2000 - elapsed);
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, remaining);
    return () => clearTimeout(timer);
  }, [loaded, authLoading]);

  useEffect(() => {
    setHasNavigated(false);
  }, [session]);

  // Navigate based on authentication status after splash screen
  useEffect(() => {
    const navigateAfterSplash = () => {
      if (!showSplash && !authLoading && !hasNavigated) {
        if (session) {
          // User is logged in, go to location fetching first
          setHasNavigated(true);
          routerRef.current.replace('/location/fetching');
        } else {
          // User is not logged in, show onboarding
          setHasNavigated(true);
          routerRef.current.replace('/onboarding');
        }
      }
    };

    navigateAfterSplash();
  }, [showSplash, authLoading, hasNavigated, session]);

  if (!loaded) {
    return null;
  }

  // Show splash screen while loading
  if (showSplash) {
    return <AnimatedSplashScreen />;
  }
  return (
    <NavigationThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnalyticsProvider>
        <UserProvider>
          <CartProvider>
            <Stack>
              <Stack.Screen name="onboarding" options={{ headerShown: false }} />
              <Stack.Screen name="subcategories/login" options={{ headerShown: false }} />
              <Stack.Screen name="subcategories/otp" options={{ headerShown: false }} />
              <Stack.Screen name="location/fetching" options={{ headerShown: false }} />
              <Stack.Screen name="location/select" options={{ headerShown: false }} />
              <Stack.Screen name="location/new" options={{ headerShown: false }} />
              <Stack.Screen name="location/confirm" options={{ headerShown: false }} />
              <Stack.Screen name="booking/confirmed" options={{ headerShown: false }} />
              <Stack.Screen name="booking/[id]" options={{ headerShown: false }} />
              <Stack.Screen name="profile/auth-profile" options={{ headerShown: false }} />
              <Stack.Screen name="product/[id]" options={{ headerShown: false }} />
              <Stack.Screen name="profile" options={{ headerShown: false }} />
              <Stack.Screen name="realestate" options={{ headerShown: false }} />
              <Stack.Screen name="subcategories" options={{ headerShown: false }} />
              <Stack.Screen name="search" options={{ headerShown: false }} />
              <Stack.Screen name="payment" options={{ headerShown: false }} />
              <Stack.Screen name="ProfileScreen" options={{ headerShown: false }} />
              <Stack.Screen name="address-selection" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="+not-found" />
            </Stack>
            {!isConnected ? (
              <View style={[styles.offlineBanner, { bottom: Math.max(24, insets.bottom + 8) }]}>
                <Text style={styles.offlineText}>You are offline</Text>
              </View>
            ) : null}
            <StatusBar style="auto" />
          </CartProvider>
        </UserProvider>
      </AnalyticsProvider>
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <AppThemeProvider>
        <AuthProvider>
          <ReviewsProvider>
            <RootLayoutContent />
          </ReviewsProvider>
        </AuthProvider>
      </AppThemeProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  logoText: {
    fontSize: 72,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 4,
    textTransform: 'uppercase',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  taglineContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  taglineText: {
    fontSize: 14,
    fontWeight: '300',
    color: '#FFFFFF',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  offlineBanner: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
    backgroundColor: '#111827',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  offlineText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
