import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { AppState } from 'react-native';
import { usePathname, useSegments } from 'expo-router';
import { useAuth } from './AuthContext';
import { analytics } from '../lib/analytics';

interface AnalyticsContextType {
  trackPageView: (pageName: string, pagePath: string) => void;
  trackPageExit: (pageName: string, pagePath: string) => void;
  trackServiceView: (serviceType: string, serviceId?: string, metadata?: Record<string, any>) => void;
  trackServiceSelect: (serviceType: string, serviceId?: string, metadata?: Record<string, any>) => void;
  trackInteraction: (interactionType: string, pageName?: string, elementId?: string, metadata?: Record<string, any>) => void;
  trackSearch: (query: string, resultsCount?: number, metadata?: Record<string, any>) => void;
  trackCartAdd: (itemId: string, itemName: string, price?: number) => void;
  trackCartRemove: (itemId: string) => void;
  trackCustomEvent: (eventName: string, metadata?: Record<string, any>) => void;
}

const AnalyticsContext = createContext<AnalyticsContextType | undefined>(undefined);

export const useAnalytics = () => {
  const context = useContext(AnalyticsContext);
  if (!context) {
    throw new Error('useAnalytics must be used within AnalyticsProvider');
  }
  return context;
};

interface AnalyticsProviderProps {
  children: ReactNode;
}

export const AnalyticsProvider: React.FC<AnalyticsProviderProps> = ({ children }) => {
  const pathname = usePathname();
  const segments = useSegments();
  const { user, profile } = useAuth();
  const userId = user?.id;

  // Identify user in Mixpanel when user logs in
  useEffect(() => {
    if (userId) {
      analytics.identifyUser(userId, {
        email: user?.email,
        phone: user?.phone,
        created_at: user?.created_at,
        ...profile,
      });
    } else {
      // Reset Mixpanel user on logout
      analytics.resetUser();
    }
  }, [userId, user, profile]);

  // Track page views automatically
  useEffect(() => {
    if (pathname) {
      const pageName = segments.length > 0 ? segments[segments.length - 1] : 'index';
      const pagePath = pathname;
      
      analytics.trackPageView(pageName, pagePath, userId);

      // Track page exit when component unmounts or pathname changes
      return () => {
        analytics.trackPageExit(pageName, pagePath, userId);
      };
    }
  }, [pathname, segments, userId]);

  const trackPageView = (pageName: string, pagePath: string) => {
    analytics.trackPageView(pageName, pagePath, userId);
  };

  const trackPageExit = (pageName: string, pagePath: string) => {
    analytics.trackPageExit(pageName, pagePath, userId);
  };

  const trackServiceView = (serviceType: string, serviceId?: string, metadata?: Record<string, any>) => {
    analytics.trackServiceView(serviceType, serviceId, userId, metadata);
  };

  const trackServiceSelect = (serviceType: string, serviceId?: string, metadata?: Record<string, any>) => {
    analytics.trackServiceSelect(serviceType, serviceId, userId, metadata);
  };

  const trackInteraction = (interactionType: string, pageName?: string, elementId?: string, metadata?: Record<string, any>) => {
    analytics.trackInteraction(interactionType, pageName, elementId, userId, metadata);
  };

  const trackSearch = (query: string, resultsCount?: number, metadata?: Record<string, any>) => {
    analytics.trackSearch(query, resultsCount, userId, metadata);
  };

  const trackCartAdd = (itemId: string, itemName: string, price?: number) => {
    analytics.trackCartAdd(itemId, itemName, price, userId);
  };

  const trackCartRemove = (itemId: string) => {
    analytics.trackCartRemove(itemId, userId);
  };

  const trackCustomEvent = (eventName: string, metadata?: Record<string, any>) => {
    analytics.trackCustomEvent(eventName, userId, metadata);
  };

  // Flush analytics when the app leaves the foreground.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' || nextState === 'inactive') {
        analytics.flush();
      }
    });

    return () => {
      subscription.remove();
      analytics.flush();
    };
  }, []);

  return (
    <AnalyticsContext.Provider
      value={{
        trackPageView,
        trackPageExit,
        trackServiceView,
        trackServiceSelect,
        trackInteraction,
        trackSearch,
        trackCartAdd,
        trackCartRemove,
        trackCustomEvent,
      }}
    >
      {children}
    </AnalyticsContext.Provider>
  );
};
