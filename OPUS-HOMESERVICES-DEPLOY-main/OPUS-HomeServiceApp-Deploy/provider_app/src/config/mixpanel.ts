/**
 * Mixpanel Configuration
 * 
 * Mixpanel token is injected by EAS environment variables at build time.
 * Never hardcode production analytics credentials in source control.
 */

export const MIXPANEL_CONFIG = {
  token: process.env.EXPO_PUBLIC_MIXPANEL_TOKEN ?? '',
  
  // Enable debug mode in development
  debug: __DEV__,
  
  // Track automatic events (screen views, app opens, etc.)
  trackAutomaticEvents: true,
};
