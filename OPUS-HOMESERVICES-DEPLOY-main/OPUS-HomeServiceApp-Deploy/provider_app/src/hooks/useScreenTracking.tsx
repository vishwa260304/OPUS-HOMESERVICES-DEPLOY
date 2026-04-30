/**
 * Hook for automatic screen tracking
 * 
 * Usage:
 * ```tsx
 * const MyScreen = () => {
 *   useScreenTracking('MyScreen');
 *   return <View>...</View>;
 * }
 * ```
 */

import { useEffect } from 'react';
import { useRoute } from '@react-navigation/native';
import { trackScreen } from '../services/analytics';

export const useScreenTracking = (screenName?: string, additionalProperties?: Record<string, any>) => {
  const route = useRoute();

  useEffect(() => {
    const name = screenName || route.name;
    
    trackScreen(name, {
      route_name: route.name,
      ...additionalProperties,
    });
  }, [screenName, route.name, additionalProperties]);
};

