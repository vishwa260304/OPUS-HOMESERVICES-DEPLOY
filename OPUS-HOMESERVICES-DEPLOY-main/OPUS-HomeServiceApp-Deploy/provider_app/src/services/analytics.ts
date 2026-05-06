/**
 * Mixpanel Analytics Service
 * 
 * Centralized analytics service for tracking user events and behaviors
 * All analytics tracking should go through this service
 */

import { MIXPANEL_CONFIG } from '../config/mixpanel';
import { Platform } from 'react-native';

// Dynamically import Mixpanel to handle cases where it's not available
let Mixpanel: any = null;
try {
  // Try both default export and named export
  const mixpanelModule = require('mixpanel-react-native');
  Mixpanel = mixpanelModule.default || mixpanelModule.Mixpanel || mixpanelModule;
  
  if (!Mixpanel) {
    console.warn('⚠️ Analytics: Mixpanel export not found in module');
  }
} catch (error) {
  console.warn('⚠️ Analytics: mixpanel-react-native not available. Analytics will be disabled.');
  console.warn('   This is normal in Expo Go. To enable Mixpanel, create a development build:');
  console.warn('   1. npx expo install expo-dev-client');
  console.warn('   2. npx expo prebuild');
  console.warn('   3. npx expo run:ios (or npx expo run:android)');
}

class AnalyticsService {
  private mixpanel: any = null;
  private isInitialized = false;
  private userId: string | null = null;

  /**
   * Initialize Mixpanel
   * Call this once when the app starts
   */
  async initialize(): Promise<void> {
    try {
      if (this.isInitialized) {
        console.log('✅ Analytics: Already initialized');
        return;
      }

      // Check if Mixpanel is available
      if (!Mixpanel) {
        console.warn('⚠️ Analytics: Mixpanel is not available. Analytics will be disabled.');
        this.isInitialized = false;
        this.mixpanel = null;
        return;
      }

      // Validate token
      if (!MIXPANEL_CONFIG.token) {
        console.warn('⚠️ Analytics: Mixpanel token is missing');
        return;
      }

      if (MIXPANEL_CONFIG.token === 'YOUR_MIXPANEL_PROJECT_TOKEN') {
        console.warn('⚠️ Analytics: Mixpanel token not configured. Please add your token in src/config/mixpanel.ts');
        return;
      }

      // Check token format (should be 32 hex characters)
      if (!/^[a-f0-9]{32}$/i.test(MIXPANEL_CONFIG.token)) {
        console.warn('⚠️ Analytics: Mixpanel token format appears invalid. Expected 32 hex characters.');
      }

      console.log('🔄 Analytics: Initializing Mixpanel...');
      console.log('   Token:', MIXPANEL_CONFIG.token.substring(0, 8) + '...');
      console.log('   Platform:', Platform.OS);
      console.log('   Track Auto Events:', MIXPANEL_CONFIG.trackAutomaticEvents);

      const trackAutomaticEvents = MIXPANEL_CONFIG.trackAutomaticEvents ?? true;
      
      // Check if Mixpanel constructor is available
      if (typeof Mixpanel !== 'function') {
        console.warn('⚠️ Analytics: Mixpanel constructor is not available. Analytics will be disabled.');
        this.isInitialized = false;
        this.mixpanel = null;
        return;
      }
      
      this.mixpanel = new Mixpanel(MIXPANEL_CONFIG.token, trackAutomaticEvents);
      
      console.log('⏳ Analytics: Calling mixpanel.init()...');
      await this.mixpanel.init();

      this.isInitialized = true;
      console.log('✅ Analytics: Mixpanel initialized successfully!');

      // Track app open
      this.track('App Opened', {
        platform: Platform.OS,
        platform_version: Platform.Version,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('❌ Analytics: Failed to initialize Mixpanel');
      console.error('   Error:', error);
      console.error('   Message:', error?.message);
      console.error('   Stack:', error?.stack);
      // Don't throw - allow app to continue without analytics
      this.isInitialized = false;
      this.mixpanel = null;
    }
  }

  /**
   * Identify a user
   * Call this after user logs in
   */
  identify(userId: string, userProperties?: Record<string, any>): void {
    this.userId = userId;
    if (!this.mixpanel || !this.isInitialized) return;

    try {
      this.mixpanel.identify(userId);
      
      if (userProperties) {
        this.mixpanel.getPeople().set(userProperties);
      }

      console.log('Analytics: User identified', userId);
    } catch (error) {
      console.error('Analytics: Failed to identify user', error);
    }
  }

  /**
   * Track an event
   * @param eventName - Name of the event (e.g., "Screen Viewed", "Button Clicked")
   * @param properties - Additional properties to track with the event
   */
  track(eventName: string, properties?: Record<string, any>): void {
    if (!this.mixpanel || !this.isInitialized) {
      if (__DEV__) {
        console.log(`Analytics: [Not Initialized] Would track "${eventName}"`, properties);
      }
      return;
    }

    try {
      const eventUserId =
        properties && Object.prototype.hasOwnProperty.call(properties, 'user_id')
          ? properties.user_id ?? null
          : this.userId ?? null;

      const eventProperties = {
        ...properties,
        timestamp: new Date().toISOString(),
        platform: Platform.OS,
        user_id: eventUserId, // FIXED: Bug 1
      };

      this.mixpanel.track(eventName, eventProperties);
      
      if (__DEV__) {
        console.log(`✅ Analytics: Tracked "${eventName}"`, eventProperties);
      }
    } catch (error) {
      console.error(`❌ Analytics: Failed to track event "${eventName}"`, error);
    }
  }

  /**
   * Track screen view
   * @param screenName - Name of the screen
   * @param properties - Additional properties
   */
  trackScreenView(screenName: string, properties?: Record<string, any>): void {
    this.track('Screen Viewed', {
      screen_name: screenName,
      ...properties,
    });
  }

  /**
   * Set user properties
   * @param properties - Properties to set for the current user
   */
  setUserProperties(properties: Record<string, any>): void {
    if (!this.mixpanel || !this.isInitialized) return;

    try {
      this.mixpanel.getPeople().set(properties);
      console.log('Analytics: User properties set', properties);
    } catch (error) {
      console.error('Analytics: Failed to set user properties', error);
    }
  }

  /**
   * Increment user property
   * @param property - Property name to increment
   * @param value - Value to increment by (default: 1)
   */
  incrementUserProperty(property: string, value: number = 1): void {
    if (!this.mixpanel || !this.isInitialized) return;

    try {
      this.mixpanel.getPeople().increment(property, value);
    } catch (error) {
      console.error('Analytics: Failed to increment user property', error);
    }
  }

  /**
   * Track user logout
   */
  logout(): void {
    if (!this.mixpanel || !this.isInitialized) return;

    try {
      this.track('User Logged Out');
      this.mixpanel.reset();
      this.userId = null;
      console.log('Analytics: User logged out');
    } catch (error) {
      console.error('Analytics: Failed to logout', error);
    }
  }

  /**
   * Flush events immediately
   * Useful when app is closing
   */
  flush(): void {
    if (!this.mixpanel || !this.isInitialized) return;

    try {
      this.mixpanel.flush();
    } catch (error) {
      console.error('Analytics: Failed to flush events', error);
    }
  }

  /**
   * Get the current user ID
   */
  getUserId(): string | null {
    return this.userId;
  }
}

// Export singleton instance
export const analytics = new AnalyticsService();

// Export convenience functions
export const trackEvent = (eventName: string, properties?: Record<string, any>) => {
  analytics.track(eventName, properties);
};

export const trackScreen = (screenName: string, properties?: Record<string, any>) => {
  analytics.trackScreenView(screenName, properties);
};
