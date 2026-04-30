import { useState, useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';

export const useNetworkStatus = () => {
  const [isConnected, setIsConnected] = useState(true);
  const [connectionType, setConnectionType] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected ?? true);
      setConnectionType(state.type);
    });

    return () => unsubscribe();
  }, []);

  return { isConnected, connectionType };
};

export const getConnectionStatusText = (isConnected: boolean, connectionType: string | null) => {
  if (!isConnected) {
    return 'You are offline';
  }
  
  switch (connectionType) {
    case 'wifi':
      return 'Connected to WiFi';
    case 'cellular':
      return 'Connected to Mobile Data';
    case 'none':
      return 'No internet connection';
    default:
      return 'Connected to internet';
  }
};
