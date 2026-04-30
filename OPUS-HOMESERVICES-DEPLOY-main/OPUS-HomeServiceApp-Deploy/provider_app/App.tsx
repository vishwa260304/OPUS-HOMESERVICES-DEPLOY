import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme, createNavigationContainerRef } from '@react-navigation/native';
import { enableScreens } from 'react-native-screens';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator, { NavigationController } from './src/navigation/AppNavigator';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { useVerification } from './src/hooks/useVerification';
import type { RootStackParamList } from './src/types/navigation';
import LoadingScreen from './src/components/LoadingScreen';
import SplashScreen from './src/components/SplashScreen';
import { StatusBar, AppState } from 'react-native';
import { registerRootComponent } from 'expo';
import { analytics } from './src/services/analytics';

enableScreens();

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

const AppShell: React.FC = () => {
  const { isDark, colors } = useTheme();
  const { loading, user } = useAuth();
  const { refreshVerification, verification } = useVerification();
  const [isNavReady, setIsNavReady] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  const navTheme = isDark
    ? { ...DarkTheme, colors: { ...DarkTheme.colors, background: colors.background, card: colors.card } }
    : { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.background, card: colors.card } };

  // Initialize analytics
  useEffect(() => {
    const initAnalytics = async () => {
      try {
        await analytics.initialize();
      } catch (error) {
        console.error('Failed to initialize analytics:', error);
      }
    };
    
    initAnalytics();
  }, []);

  // Identify user when they log in
  useEffect(() => {
    if (user?.id) {
      analytics.identify(user.id, {
        email: user.email,
        created_at: user.created_at,
      });

      // Set user properties from verification
      if (verification) {
        analytics.setUserProperties({
          selected_sector: verification.selected_sector,
          is_verified: verification.is_verified,
          verification_status: verification.status,
        });
      }
    }
  }, [user, verification]);

  // Track app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active' && user) {
        // Refresh verification status when app becomes active
        refreshVerification();
        analytics.track('App Became Active');
      } else if (nextAppState === 'background') {
        analytics.track('App Went to Background');
        analytics.flush(); // Flush events when app goes to background
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription?.remove();
      analytics.flush(); // Flush events on unmount
    };
  }, [user, refreshVerification]);

  // Hide splash screen after 3 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  // No deep linking configuration needed
  const linking = undefined;

  if (showSplash) {
    return <SplashScreen />;
  }

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer ref={navigationRef} onReady={() => setIsNavReady(true)} theme={navTheme}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.primary} />
      <NavigationController navigationRef={navigationRef} isNavReady={isNavReady} />
      <AppNavigator />
    </NavigationContainer>
  );
};

const App: React.FC = () => {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <AppShell />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
};

// Ensure native entry 'main' is registered even if AppEntry isn't used
registerRootComponent(App);

export default App;
