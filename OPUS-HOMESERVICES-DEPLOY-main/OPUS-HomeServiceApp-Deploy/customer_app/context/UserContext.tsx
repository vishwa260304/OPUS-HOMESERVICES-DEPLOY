import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type UserAddress = {
  label: string;
  streetLine?: string;
  area?: string;
  city?: string;
  postalCode?: string;
  fullText?: string;
  latitude?: number;
  longitude?: number;
};

type UserContextValue = {
  location: string;
  setLocation: (next: string) => Promise<void>;
  address: UserAddress | null;
  setAddress: (addr: UserAddress) => Promise<void>;
};

const UserContext = createContext<UserContextValue | undefined>(undefined);

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [location, setLocationState] = useState<string>('Chennai, Tamil Nadu');
  const [address, setAddressState] = useState<UserAddress | null>(null);

  useEffect(() => {
    const hydrate = async () => {
      try {
        const savedLocation = await AsyncStorage.getItem('user_location');
        if (savedLocation && savedLocation.trim().length > 0) {
          setLocationState(savedLocation);
        }
      } catch {}
      try {
        const savedAddress = await AsyncStorage.getItem('user_address');
        if (savedAddress) {
          const parsed: UserAddress = JSON.parse(savedAddress);
          setAddressState(parsed);
        }
      } catch {}
    };
    hydrate();
  }, []);

  const setLocation = async (next: string) => {
    const trimmed = (next || '').trim();
    setLocationState(trimmed);
    try {
      await AsyncStorage.setItem('user_location', trimmed);
    } catch {}
  };

  const setAddress = async (addr: UserAddress) => {
    setAddressState(addr);
    try {
      await AsyncStorage.setItem('user_address', JSON.stringify(addr));
    } catch {}
  };

  return (
    <UserContext.Provider value={{ location, setLocation, address, setAddress }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within a UserProvider');
  return ctx;
};


