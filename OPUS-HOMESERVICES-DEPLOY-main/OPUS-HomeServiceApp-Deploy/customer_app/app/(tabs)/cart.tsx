import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Modal, Dimensions, TextInput, Alert, StatusBar, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCart } from '../../context/CartContext';
import { hapticButtonPress } from '../../utils/haptics';
import { useAuth } from '../../context/AuthContext';
import { UserAddressesApi } from '../../lib/userAddresses';
import { useUser } from '../../context/UserContext';
import { useTheme } from '../../context/ThemeContext';
import { serviceProvidersAPI, ServiceProvider } from '../../lib/serviceProviders';
import { BookingsApi } from '../../lib/bookings';

const { width } = Dimensions.get('window');

interface ServiceSlot {
  serviceId: string;
  date: string;
  time: string;
}

// ServiceProvider interface is now imported from serviceProviders.ts

// Helper component to render provider avatar with fallback to first letter
const ProviderAvatar = ({ 
  provider, 
  size = 50, 
  style 
}: { 
  provider: ServiceProvider | null | undefined; 
  size?: number;
  style?: any;
}) => {
  const { colors } = useTheme();
  
  if (!provider) return null;
  
  const imageUri = provider.image;
  const hasValidImage = imageUri && 
    typeof imageUri === 'string' &&
    imageUri.trim() !== '' && 
    !imageUri.includes('placeholder') &&
    imageUri !== 'null' &&
    (imageUri.startsWith('http://') || imageUri.startsWith('https://') || imageUri.startsWith('data:'));
  
  const displayName = provider.companyName || provider.name || '?';
  const firstLetter = displayName.charAt(0).toUpperCase();
  
  if (hasValidImage) {
    return (
      <Image 
        source={{ uri: imageUri }} 
        style={[{ width: size, height: size, borderRadius: size / 2 }, style]} 
      />
    );
  }
  
  return (
    <View 
      style={[
        { 
          width: size, 
          height: size, 
          borderRadius: size / 2, 
          backgroundColor: colors?.primary || '#1818ec',
          alignItems: 'center',
          justifyContent: 'center'
        }, 
        style
      ]}
    >
      <Text style={{ 
        color: '#FFFFFF', 
        fontSize: size * 0.4, 
        fontWeight: '700' 
      }}>
        {firstLetter}
      </Text>
    </View>
  );
};

export default function CartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { cartItems, removeFromCart, updateQuantity, getTotalPrice } = useCart();
  const { user } = useAuth();
  const { colors, isDark } = useTheme();

  const [serviceSlots, setServiceSlots] = useState<ServiceSlot[]>([]);
  const [providerPickerOpen, setProviderPickerOpen] = useState(false);
  const [activeServiceId, setActiveServiceId] = useState<string | null>(null);
  const [selectedProviders, setSelectedProviders] = useState<{ [serviceId: string]: string }>({});
  const [serviceProviders, setServiceProviders] = useState<{ [serviceId: string]: ServiceProvider[] }>({});
  const [loadingProviders, setLoadingProviders] = useState<{ [serviceId: string]: boolean }>({});
  const [serviceCategories, setServiceCategories] = useState<{ [serviceId: string]: string }>({});
  const [couponOpen, setCouponOpen] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [refreshing, setRefreshing] = useState(false);
  // Load saved coupon on mount
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem('cart_coupon');
        if (saved) {
          const code = saved.toUpperCase();
          setAppliedCoupon(code);
          setDiscountPercent(code === 'SAVE10' ? 10 : code === 'SAVE20' ? 20 : 0);
        }
      } catch { }
    })();
  }, []);
  // Address state
  const [addresses, setAddresses] = useState<any[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [showAddressSelector, setShowAddressSelector] = useState(false);
  const [newAddress, setNewAddress] = useState({
    name: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    type: 'Home' as 'Home' | 'Work' | 'Other'
  });

  useEffect(() => {
    // Extract booking slots from cart items that already have date/time
    const next = cartItems.map(item => ({
      serviceId: item.id,
      date: item.bookingDate || '',
      time: item.bookingTime || ''
    }));
    setServiceSlots(next);
  }, [cartItems]);

  // Fetch service providers when cart items change
  useEffect(() => {
    const serviceItems = cartItems.filter(item =>
      !pharmEasyCategories.includes(item.category) &&
      !labTestCategories.includes(item.category) &&
      !doctorAppointmentCategories.includes(item.category)
    );

    serviceItems.forEach(item => {
      // Determine service type based on category
      let serviceType = 'home'; // default
      // Use optional chaining and fallback to empty string to prevent crashes
      const categoryLower = (item.category || '').toLowerCase();
      const titleLower = (item.title || '').toLowerCase();

      // Check for automobile services (car, bike, automobile)
      if (categoryLower.includes('automobile') ||
        categoryLower.includes('car') ||
        categoryLower.includes('bike') ||
        titleLower.includes('bike') ||
        titleLower.includes('car')) {
        serviceType = 'automobile';
      } else if (categoryLower.includes('appliance') || categoryLower.includes('repair')) {
        serviceType = 'appliance';
      } else if (categoryLower.includes('healthcare') || categoryLower.includes('medical')) {
        serviceType = 'healthcare';
      } else if (categoryLower.includes('salon') || categoryLower.includes('beauty') || categoryLower.includes('spa')) {
        serviceType = 'home'; // Salon services are typically home services
      }

      // Fetch providers for this service, passing both title and category for better matching
      // Store the category with the service for filtering
      fetchServiceProviders(item.id, item.title || '', serviceType, item.category);
    });

    // Auto-select provider for Lab items if not already selected
    const labTestItems = cartItems.filter(item => item.labId || labTestCategories.includes(item.category));

    if (labTestItems.length > 0) {
      // Find lab items that have a labId but no provider selected yet
      const labsToSelect = labTestItems.filter(item => item.labId && !selectedProviders[item.id]);

      if (labsToSelect.length > 0) {
        const newSelections = { ...selectedProviders };
        let hasUpdates = false;

        labsToSelect.forEach(item => {
          // Assume labId corresponds to a provider_id and format it as expected by payment.tsx
          const labId = item.labId;
          const providerKey = `provider_${labId}`;
          newSelections[item.id] = providerKey;
          hasUpdates = true;

          // Also try to fetch provider details (image, rating, etc) if not already loaded
          if (!serviceProviders[item.id] || serviceProviders[item.id].length === 0) {
            // We need to fetch specific provider details
            const numericId = parseInt(String(labId), 10);
            if (!isNaN(numericId)) {
              serviceProvidersAPI.getProviderDetails(numericId).then(({ data: provider, error }) => {
                if (provider) {
                  setServiceProviders(prev => ({
                    ...prev,
                    [item.id]: [provider] // Store as array to match type
                  }));
                }
              });
            }
          }
        });

        if (hasUpdates) {
          setSelectedProviders(prev => ({ ...prev, ...newSelections }));
        }
      }
    }
  }, [cartItems]);

  useEffect(() => {
    const loadAddresses = async () => {
      try {
        if (user?.id) {
          // Load from Supabase API
          const rows = await UserAddressesApi.listByUser(user.id);
          const mapped = rows.map(r => ({
            id: r.id,
            name: r.recipient_name || '',
            phone: r.phone || '',
            address: r.line1,
            city: r.city,
            state: r.state,
            pincode: r.pincode,
            type: r.label || 'Home',
            isDefault: false // You can add this field to your API if needed
          }));
          setAddresses(mapped);
          // Select first address by default if none selected
          if (mapped.length > 0) {
            // Try to find a default address first, otherwise use the first one
            const defaultAddr = mapped.find(addr => addr.isDefault) || mapped[0];
            setSelectedAddressId(defaultAddr.id);
          }
        } else {
          // Fallback to AsyncStorage for non-authenticated users
          const stored = await AsyncStorage.getItem('addresses');
          const parsed = stored ? JSON.parse(stored) : [];
          setAddresses(parsed);
          const def = parsed.find((a: any) => a.isDefault) || parsed[0];
          if (def) setSelectedAddressId(def.id);
        }
      } catch (error) {
        console.error('Failed to load addresses:', error);
      }
    };
    loadAddresses();
  }, [user?.id]);

  // Real-time address synchronization - reload addresses periodically
  useEffect(() => {
    if (!user?.id) return;

    const interval = setInterval(async () => {
      try {
        const rows = await UserAddressesApi.listByUser(user.id);
        const mapped = rows.map(r => ({
          id: r.id,
          name: r.recipient_name || '',
          phone: r.phone || '',
          address: r.line1,
          city: r.city,
          state: r.state,
          pincode: r.pincode,
          type: r.label || 'Home',
          isDefault: false
        }));

        // Only update if addresses have changed
        const currentIds = addresses.map(a => a.id).sort().join(',');
        const newIds = mapped.map(a => a.id).sort().join(',');

        if (currentIds !== newIds) {
          setAddresses(mapped);

          // If current selected address no longer exists, select first available
          if (selectedAddressId && !mapped.find(addr => addr.id === selectedAddressId)) {
            if (mapped.length > 0) {
              setSelectedAddressId(mapped[0].id);
            } else {
              setSelectedAddressId(null);
            }
          }
        }
      } catch (error) {
        console.error('Failed to sync addresses:', error);
      }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [user?.id, selectedAddressId, addresses]);

  const getSlot = (id: string) => serviceSlots.find(s => String(s.serviceId) === String(id));
  const getProvider = (serviceId: string) => selectedProviders[serviceId];

  const formatDateKey = (key: string) => {
    if (!key) return '';
    let add = 0;
    if (key === 'tomorrow') add = 1;
    else if (key.startsWith('day')) {
      const n = parseInt(key.replace('day', ''), 10);
      if (!isNaN(n)) add = n;
    }
    const d = new Date();
    d.setDate(d.getDate() + add);
    const day = d.getDate().toString().padStart(2, '0');
    const month = d.toLocaleString('en-GB', { month: 'short' });
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  };

  const openProviderPicker = (id: string) => {
    setActiveServiceId(id);
    setProviderPickerOpen(true);
  };

  const selectProvider = (serviceId: string, providerId: string) => {
    setSelectedProviders(prev => ({ ...prev, [serviceId]: providerId }));
    setProviderPickerOpen(false);
    setActiveServiceId(null);
  };

  // Check if all items have required selections
  const pharmEasyCategories = ['Wellness', 'Diabetes', 'Vitamins', 'Ayurveda', 'Personal Care'];
  const labTestCategories = ['Lab Test'];
  const doctorAppointmentCategories = ['Doctor Appointment'];
  const serviceItems = cartItems.filter(item =>
    !pharmEasyCategories.includes(item.category) &&
    !item.labId && // Lab services have labId, so exclude them from service provider selection
    !labTestCategories.includes(item.category) && // Also exclude Lab Test category as fallback
    !doctorAppointmentCategories.includes(item.category) // Exclude Doctor Appointment from service provider selection
  );
  const medicineItems = cartItems.filter(item => pharmEasyCategories.includes(item.category));
  const labTestItems = cartItems.filter(item => item.labId || labTestCategories.includes(item.category)); // Lab services are identified by having labId or Lab Test category
  const doctorAppointmentItems = cartItems.filter(item => doctorAppointmentCategories.includes(item.category)); // Doctor appointment items

  const allServiceSlotsSelected = serviceItems.every(item => {
    const slot = serviceSlots.find(s => String(s.serviceId) === String(item.id));
    return slot?.date && slot?.time;
  });

  const allServiceProvidersSelected = serviceItems.every(item => selectedProviders[item.id]);

  const allSelected = allServiceSlotsSelected && allServiceProvidersSelected;

  // Get provider price for specific service
  const getProviderPrice = (serviceId: string, providerId: string): number => {
    // Mock pricing matrix - each provider has different additional charges for different services
    const priceMatrix: { [key: string]: { [key: string]: number } } = {
      'provider_1': {
        'default': 1799,
        'plumbing': 299,
        'electrical': 499,
        'cleaning': 199,
        'ac_repair': 599,
        'carpentry': 399
      },
      'provider_2': {
        'default': 1900,
        'plumbing': 399,
        'electrical': 599,
        'cleaning': 299,
        'ac_repair': 799,
        'carpentry': 499
      },
      'provider_3': {
        'default': 2000,
        'plumbing': 499,
        'electrical': 699,
        'cleaning': 399,
        'ac_repair': 899,
        'carpentry': 599
      }
    };

    // Try to get price based on service category or use default
    const serviceCategory = cartItems.find(item => item.id === serviceId)?.category?.toLowerCase() || 'default';
    return priceMatrix[providerId]?.[serviceCategory] || priceMatrix[providerId]?.['default'] || 0;
  };

  // Calculate total cost using fixed item prices (provider selection does not change price)
  const getTotalCost = () => {
    let totalCost = 0;
    cartItems.forEach(item => {
      const isPharmEasyItem = pharmEasyCategories.includes(item.category);
      const isLabTestItem = !!item.labId || labTestCategories.includes(item.category); // Lab services are identified by having labId or Lab Test category
      const isDoctorAppointmentItem = doctorAppointmentCategories.includes(item.category);

      if (isPharmEasyItem) {
        // For PharmEasy items, use the item's price directly
        const raw = typeof item.price === 'string' ? item.price : String(item.price ?? '');
        const numeric = parseFloat(String(raw).replace(/[^\d.]/g, ''));
        const price = Number.isFinite(numeric) ? numeric : 0;
        const qty = Number.isFinite(item.quantity) ? item.quantity : 0;
        totalCost += price * qty;
      } else if (isLabTestItem) {
        // For lab test items, use the item's price directly
        const raw = typeof item.price === 'string' ? item.price : String(item.price ?? '');
        const numeric = parseFloat(String(raw).replace(/[^\d.]/g, ''));
        const price = Number.isFinite(numeric) ? numeric : 0;
        totalCost += price;
      } else if (isDoctorAppointmentItem) {
        // For doctor appointment items, use the doctor's fee directly
        const raw = typeof item.price === 'string' ? item.price : String(item.price ?? '');
        const numeric = parseFloat(String(raw).replace(/[^\d.]/g, ''));
        const price = Number.isFinite(numeric) ? numeric : 0;
        totalCost += price;
      } else {
        // For service items (home, appliances, automobile), use fixed item price regardless of provider
        const raw = typeof item.price === 'string' ? item.price : String(item.price ?? '');
        const numeric = parseFloat(String(raw).replace(/[^\d.]/g, ''));
        const price = Number.isFinite(numeric) ? numeric : 0;
        const qty = Number.isFinite(item.quantity) ? item.quantity : 1;
        totalCost += price * qty;
      }
    });
    return totalCost;
  };

  const itemTotal = getTotalCost();
  const tax = Math.round(itemTotal * 0.18);
  const serviceFee = 60;
  const discount = Math.round(itemTotal * (discountPercent / 100));
  const total = itemTotal + serviceFee + tax - discount;

  const proceed = async () => {
    // Require login before proceeding to checkout
    if (!user) {
      Alert.alert(
        'Login required',
        'Please sign in to continue to checkout.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Login', onPress: () => router.push('/subcategories/login' as any) }
        ]
      );
      return;
    }
    if (!allSelected) {
      Alert.alert('Complete Selection', 'Please select service provider.');
      return;
    }
    const addr = addresses.find(a => a.id === selectedAddressId);
    if (!addr) {
      Alert.alert('Select address', 'Please choose a delivery address.');
      return;
    }
    await AsyncStorage.setItem('service_slots', JSON.stringify(serviceSlots));
    await AsyncStorage.setItem('selected_providers', JSON.stringify(selectedProviders));
    await AsyncStorage.setItem('selected_checkout_address', JSON.stringify(addr));

    // Don't create bookings here - they will be created in payment page after payment confirmation
    hapticButtonPress();
    router.push('/payment');
  };

  // Fetch service providers from database
  const fetchServiceProviders = async (serviceId: string, serviceName: string, serviceType?: string, category?: string) => {
    if (loadingProviders[serviceId] || serviceProviders[serviceId]) {
      return; // Already loading or loaded
    }

    setLoadingProviders(prev => ({ ...prev, [serviceId]: true }));

    // Store category for filtering
    if (category) {
      setServiceCategories(prev => ({ ...prev, [serviceId]: category }));
    }

    try {
      console.log(`[Cart] Fetching providers for service: "${serviceName}", type: "${serviceType}", category: "${category}"`);
      const { data: providers, error } = await serviceProvidersAPI.getProvidersByServiceName(serviceName, serviceType);

      if (error) {
        console.error('Error fetching service providers:', error);
        // Fallback to empty array if error
        setServiceProviders(prev => ({ ...prev, [serviceId]: [] }));
      } else {
        // Filter providers to match the specific category for all service types
        let filteredProviders = providers || [];

        if (category && filteredProviders.length > 0) {
          const categoryLower = category.toLowerCase().trim();
          const serviceNameLower = serviceName.toLowerCase().trim();

          // Helper function to extract appliance type from a string
          const getApplianceType = (str: string): string | null => {
            const appliances = [
              { keywords: ['dishwasher'], name: 'dishwasher' },
              { keywords: ['washing machine', 'washer'], name: 'washing machine' },
              { keywords: ['ac', 'air conditioner', 'air conditioning'], name: 'ac' },
              { keywords: ['refrigerator', 'fridge'], name: 'refrigerator' },
              { keywords: ['microwave'], name: 'microwave' },
              { keywords: ['geyser'], name: 'geyser' },
              { keywords: ['chimney'], name: 'chimney' },
              { keywords: ['fan'], name: 'fan' },
              { keywords: ['television', 'tv'], name: 'television' },
              { keywords: ['laptop', 'pc', 'computer'], name: 'laptop' },
              { keywords: ['water purifier'], name: 'water purifier' },
              { keywords: ['water cooler'], name: 'water cooler' },
              { keywords: ['speaker'], name: 'speaker' },
              { keywords: ['gas stove', 'hob'], name: 'gas stove' },
              { keywords: ['inverter', 'ups'], name: 'inverter' },
            ];

            for (const appliance of appliances) {
              if (appliance.keywords.some(keyword => str.includes(keyword))) {
                return appliance.name;
              }
            }

            return null;
          };

          filteredProviders = filteredProviders.filter(provider => {
            const providerServiceName = provider.serviceName?.toLowerCase().trim() || '';

            // For appliance services with broad categories (Kitchen Appliances, Home Appliances)
            // Match based on appliance type from service name, not the broad category
            const isBroadApplianceCategory = categoryLower === 'kitchen appliances' ||
              categoryLower === 'home appliances' ||
              categoryLower.includes('appliances');

            // Short-circuit: if broad appliance category, show all providers returned by API
            if (isBroadApplianceCategory && serviceType === 'appliance') {
              return true;
            }

            if (isBroadApplianceCategory && serviceType === 'appliance') {
              // Extract appliance type from the service title and provider service name
              const serviceApplianceType = getApplianceType(serviceNameLower);
              const providerApplianceType = getApplianceType(providerServiceName);

              // If we can identify appliance types, they must match
              if (serviceApplianceType && providerApplianceType) {
                return serviceApplianceType === providerApplianceType;
              }

              // Map service keywords to appliance types (for services that don't directly mention the appliance)
              const serviceToApplianceMap: { [key: string]: string[] } = {
                'dishwasher': ['detergent', 'dishwasher', 'dish', 'plate', 'cutlery'],
                'washing machine': ['washing', 'washer', 'detergent', 'drum', 'spin'],
                'ac': ['ac', 'air conditioner', 'air conditioning', 'cooling', 'compressor', 'gas filling', 'jet pump'],
                'refrigerator': ['refrigerator', 'fridge', 'cooling', 'freezer', 'compressor'],
                'microwave': ['microwave', 'magnetron', 'heating'],
                'geyser': ['geyser', 'heating', 'water heater', 'hot water'],
                'chimney': ['chimney', 'exhaust', 'filter', 'mesh'],
                'fan': ['fan', 'blade', 'motor', 'regulator'],
                'television': ['television', 'tv', 'screen', 'display', 'remote'],
                'laptop': ['laptop', 'pc', 'computer', 'keyboard', 'touchpad', 'ssd', 'ram'],
                'water purifier': ['water purifier', 'ro', 'membrane', 'filter', 'tds'],
                'water cooler': ['water cooler', 'cooling', 'compressor'],
                'speaker': ['speaker', 'sound', 'woofer', 'amplifier'],
                'gas stove': ['gas stove', 'hob', 'burner', 'ignition', 'auto-ignition', 'flame', 'gas leakage'],
                'inverter': ['inverter', 'ups', 'battery', 'backup', 'power'],
              };

              // Check if service name contains keywords that map to a specific appliance type
              let serviceMappedAppliance: string | null = null;
              for (const [appliance, keywords] of Object.entries(serviceToApplianceMap)) {
                if (keywords.some(keyword => serviceNameLower.includes(keyword))) {
                  serviceMappedAppliance = appliance;
                  break;
                }
              }

              // If we mapped the service to an appliance type, check if provider matches
              if (serviceMappedAppliance && providerApplianceType) {
                return serviceMappedAppliance === providerApplianceType;
              }

              // If provider has an appliance type but service doesn't, check if service keywords match
              if (providerApplianceType) {
                const providerKeywords = serviceToApplianceMap[providerApplianceType] || [];
                const hasMatchingKeyword = providerKeywords.some(keyword =>
                  serviceNameLower.includes(keyword)
                );
                if (hasMatchingKeyword) {
                  return true;
                }
              }

              // For broad categories, if the provider was found by the API (which matches linked_subservices),
              // and we can't definitively exclude it, include it
              // The API already filtered by service name matching linked_subservices
              // Only exclude if we can clearly identify a mismatch
              if (serviceApplianceType && providerApplianceType && serviceApplianceType !== providerApplianceType) {
                return false; // Clear mismatch
              }

              // If we can't determine a mismatch, include the provider
              // (The API already verified it matches the service via linked_subservices)
              return true;
            }

            // For specific categories (not broad appliance categories), do strict matching
            // Normalize strings for comparison (remove punctuation, normalize whitespace)
            const normalizeString = (str: string) => {
              return str
                .replace(/[&,]/g, ' ') // Replace & and commas with space
                .replace(/\s+/g, ' ') // Normalize whitespace
                .trim();
            };

            const normalizedCategory = normalizeString(categoryLower);
            const normalizedServiceName = normalizeString(providerServiceName);

            // Strategy 1: Exact match after normalization
            if (normalizedCategory === normalizedServiceName) {
              return true;
            }

            // Strategy 2: Check if normalized strings are very similar
            const categoryWords = normalizedCategory.split(/\s+/).filter(w => w.length > 2);
            const serviceWords = normalizedServiceName.split(/\s+/).filter(w => w.length > 2);

            // Calculate how many words from category appear in service name
            const matchingWords = categoryWords.filter(cw =>
              serviceWords.some(sw => sw === cw || sw.includes(cw) || cw.includes(sw))
            );

            // If 80% or more of the category words match, consider it a match
            const matchRatio = categoryWords.length > 0 ? matchingWords.length / categoryWords.length : 0;

            if (matchRatio >= 0.8) {
              // Additional validation: ensure we're not matching different appliance types
              const categoryAppliance = getApplianceType(categoryLower);
              const providerAppliance = getApplianceType(providerServiceName);

              // If both have appliance types, they must match exactly
              if (categoryAppliance && providerAppliance) {
                if (categoryAppliance !== providerAppliance) {
                  return false; // Different appliances, don't match
                }
              }

              // Handle bike vs car distinction
              const isBikeCategory = categoryLower.includes('bike');
              const isCarCategory = categoryLower.includes('car');
              const isBikeProvider = providerServiceName.includes('bike');
              const isCarProvider = providerServiceName.includes('car');

              // Exclude mismatches between bike and car
              if (isBikeCategory && isCarProvider) return false;
              if (isCarCategory && isBikeProvider) return false;

              return true;
            }

            // Strategy 3: For automobile services, handle bike/car distinction
            const isBikeCategory = categoryLower.includes('bike');
            const isCarCategory = categoryLower.includes('car');
            const isBikeProvider = providerServiceName.includes('bike');
            const isCarProvider = providerServiceName.includes('car');

            // Exclude mismatches between bike and car
            if (isBikeCategory && isCarProvider) return false;
            if (isCarCategory && isBikeProvider) return false;

            // No match found
            return false;
          });
        }

        console.log(`[Cart] Filtered to ${filteredProviders.length} provider(s) for "${serviceName}" (category: "${category}")`);
        setServiceProviders(prev => ({ ...prev, [serviceId]: filteredProviders }));
      }
    } catch (error) {
      console.error('Error in fetchServiceProviders:', error);
      setServiceProviders(prev => ({ ...prev, [serviceId]: [] }));
    } finally {
      setLoadingProviders(prev => ({ ...prev, [serviceId]: false }));
    }
  };

  // Get service providers (now from database)
  const getServiceProviders = (serviceId: string): ServiceProvider[] => {
    return serviceProviders[serviceId] || [];
  };

  const applyCoupon = async () => {
    const code = couponCode.trim().toUpperCase();
    if (!code) return;
    // Demo mapping
    if (code === 'SAVE10') {
      setAppliedCoupon('SAVE10');
      setDiscountPercent(10);
    } else if (code === 'SAVE20') {
      setAppliedCoupon('SAVE20');
      setDiscountPercent(20);
    } else {
      setAppliedCoupon(null);
      setDiscountPercent(0);
      Alert.alert('Invalid', 'Coupon not recognized');
      return;
    }
    setCouponOpen(false);
    try { await AsyncStorage.setItem('cart_coupon', code); } catch { }
    hapticButtonPress();
  };

  const refreshAddresses = async () => {
    if (!user?.id) return;

    setRefreshing(true);
    try {
      const rows = await UserAddressesApi.listByUser(user.id);
      const mapped = rows.map(r => ({
        id: r.id,
        name: r.recipient_name || '',
        phone: r.phone || '',
        address: r.line1,
        city: r.city,
        state: r.state,
        pincode: r.pincode,
        type: r.label || 'Home',
        isDefault: false
      }));
      setAddresses(mapped);

      // If current selected address no longer exists, select first available
      if (selectedAddressId && !mapped.find(addr => addr.id === selectedAddressId)) {
        if (mapped.length > 0) {
          setSelectedAddressId(mapped[0].id);
        } else {
          setSelectedAddressId(null);
        }
      }
    } catch (error) {
      console.error('Failed to refresh addresses:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const renderItem = (item: any) => {
    const slot = getSlot(item.id);
    const hasSlot = !!(slot?.date && slot?.time);
    const providerId = getProvider(item.id);
    const providers = getServiceProviders(item.id);
    const provider = providers.find(p => p.id === providerId);
    const hasProvider = !!provider;
    const isPharmEasyItem = pharmEasyCategories.includes(item.category);
    const isLabTestItem = !!item.labId || labTestCategories.includes(item.category); // Lab services are identified by having labId or Lab Test category
    const isDoctorAppointmentItem = doctorAppointmentCategories.includes(item.category); // Doctor appointment items

    // Calculate dynamic price based on quantity
    let displayPrice = item.price;
    if (isPharmEasyItem && item.quantity > 1) {
      const raw = typeof item.price === 'string' ? item.price : String(item.price ?? '');
      const numeric = parseInt(String(raw).replace(/[^\d]/g, ''), 10);
      const unitPrice = Number.isFinite(numeric) ? numeric : 0;
      const qty = Number.isFinite(item.quantity) ? item.quantity : 1;
      const totalPrice = unitPrice * qty;

      // Format the price with currency symbol
      const currencySymbol = raw.includes('₹') ? '₹' : '';
      displayPrice = `${currencySymbol}${totalPrice.toLocaleString()}`;
    }

    return (
      <View key={item.id} style={styles.serviceCard}>
        <View style={styles.serviceHeader}>
          <Image source={item.image} style={styles.serviceImage} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.serviceName, { color: colors.text }]}>{item.title}</Text>
            <Text style={[styles.serviceCategory, { color: colors.textSecondary }]}>{item.category || 'Service'}</Text>
            {hasSlot && !isPharmEasyItem && !isDoctorAppointmentItem ? (
              <Text style={[styles.serviceSlotText, { color: colors.text }]}>📅 {formatDateKey(slot?.date || '')} • {slot?.time}</Text>
            ) : isDoctorAppointmentItem && item.bookingDate && item.bookingTime ? (
              <Text style={[styles.serviceSlotText, { color: colors.text }]}>📅 {item.bookingDate} • {item.bookingTime}</Text>
            ) : null}
            <Text style={[styles.servicePrice, { color: colors.primary }]}>{displayPrice}</Text>

            {/* Quantity controls for PharmEasy items - integrated in main card */}
            {isPharmEasyItem && (
              <View style={styles.inlineQuantityControls}>
                <TouchableOpacity
                  style={[styles.quantityBtn, styles.quantityBtnDecrease]}
                  onPress={() => {
                    if (item.quantity > 1) {
                      updateQuantity(item.id, item.quantity - 1);
                    } else {
                      removeFromCart(item.id);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="remove" size={12} color="#FFFFFF" />
                </TouchableOpacity>
                <View style={[styles.quantityTextContainer, { backgroundColor: colors.surface }]}>
                  <Text style={[styles.quantityText, { color: colors.text }]}>{item.quantity || 1}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.quantityBtn, styles.quantityBtnIncrease]}
                  onPress={() => updateQuantity(item.id, (item.quantity || 1) + 1)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={12} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            )}
          </View>
          <TouchableOpacity onPress={() => removeFromCart(item.id)}>
            <Ionicons name="close-circle" size={22} color={colors.error} />
          </TouchableOpacity>
        </View>

        {/* Show lab information for lab test items, doctor appointment info, service provider selection for other services */}
        {isLabTestItem && item.labName ? (
          <View style={[styles.slotRow, styles.slotRowSelected, { backgroundColor: colors.surface, borderColor: colors.success }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              {/* Try to show the ACTUAL lab image if we fetched the provider details */}
              {hasProvider && provider ? (
                <ProviderAvatar 
                  provider={provider} 
                  size={24} 
                  style={{ marginRight: 10 }} 
                />
              ) : (
                <Ionicons name="checkmark-circle" size={18} color="#10B981" style={{ marginRight: 10 }} />
              )}

              <View>
                <Text style={[styles.slotLabel, { color: colors.textSecondary }]}>Lab Selected</Text>
                <Text style={[styles.slotValue, { color: colors.text }]}>
                  {item.labName} • ⭐ {item.labRating || (provider?.rating ? provider.rating : '0')} ({item.labReviews || (provider?.reviews ? provider.reviews : '0')} reviews)
                </Text>
              </View>
            </View>
          </View>
        ) : !isPharmEasyItem && !isLabTestItem && !isDoctorAppointmentItem && (
          <TouchableOpacity style={[styles.slotRow, hasProvider && styles.slotRowSelected, { backgroundColor: colors.surface, borderColor: hasProvider ? colors.success : colors.border }]} onPress={() => openProviderPicker(item.id)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              {hasProvider && provider ? (
                <ProviderAvatar 
                  provider={provider} 
                  size={24} 
                  style={{ marginRight: 10 }} 
                />
              ) : (
                <Ionicons name="person-outline" size={18} color="#6B7280" style={{ marginRight: 10 }} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={[styles.slotLabel, { color: colors.textSecondary }]}>{hasProvider ? 'Service Provider Selected' : 'Select Service Provider'}</Text>
                {hasProvider ? (
                  <Text style={[styles.slotValue, { color: colors.text }]}>
                    {provider?.name} • ⭐ {provider?.rating} ({provider?.reviews} reviews)
                  </Text>
                ) : null}
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} translucent />

      <ScrollView
        style={[styles.scroll, { backgroundColor: colors.background }]}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: (StatusBar.currentHeight || 12), paddingBottom: 100 + insets.bottom, backgroundColor: colors.background }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshAddresses}
            tintColor={colors.text}
            title="Pull to refresh addresses"
            titleColor={colors.text}
          />
        }
      >
        {/* Page Title */}
        <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 10, textAlign: 'left', marginLeft: 20, color: colors.text }}>Your Cart</Text>

        {/* Cart Count Section */}
        <View style={[styles.cartCountSection, { backgroundColor: colors.surface }]}>
          <Text style={[styles.cartCountText, { color: colors.text }]}>{cartItems.length} item{cartItems.length !== 1 ? 's' : ''} in cart</Text>
          {cartItems.length > 0 && (
            <TouchableOpacity onPress={() => {
              Alert.alert('Clear Cart', 'Are you sure you want to remove all items?', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Clear All', style: 'destructive', onPress: () => {
                    cartItems.forEach(item => removeFromCart(item.id));
                  }
                }
              ]);
            }}>
              <Text style={[styles.clearAllText, { color: colors.error }]}>Clear All</Text>
            </TouchableOpacity>
          )}
        </View>
        {cartItems.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="cart-outline" size={64} color={colors.textTertiary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Your cart is empty</Text>
            <Text style={[styles.emptySub, { color: colors.textSecondary }]}>Add services to continue</Text>
            <TouchableOpacity onPress={() => router.push('/')}>
              <LinearGradient
                colors={[colors.primary, colors.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.exploreBtn}
              >
                <Text style={[styles.gradientText, { color: colors.surface }]}>Explore Services</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Address selection */}
            <View style={[styles.card, { backgroundColor: colors.card }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Service Address</Text>
                <TouchableOpacity
                  onPress={() => setShowAddressSelector(true)}
                >
                  <LinearGradient
                    colors={['#004c8f', '#0c1a5d']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.changeAddressBtn}
                  >
                    <Ionicons name="swap-horizontal" size={16} color="#FFFFFF" />
                    <Text style={[styles.changeAddressBtnText, { color: '#FFFFFF' }]}>Change</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>

              {addresses.length === 0 ? (
                <View style={styles.emptyAddressContainer}>
                  <Ionicons name="location-outline" size={32} color={colors.textTertiary} />
                  <Text style={[styles.emptyAddressText, { color: colors.text }]}>No saved addresses</Text>
                  <Text style={[styles.emptyAddressSub, { color: colors.textSecondary }]}>Add a new address to continue</Text>
                  <TouchableOpacity
                    onPress={() => setShowAddAddress(true)}
                  >
                    <LinearGradient
                      colors={[colors.primary, colors.secondary]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.addAddressBtn}
                    >
                      <Ionicons name="add-circle-outline" size={20} color={colors.surface} />
                      <Text style={[styles.gradientText, { color: colors.surface }]}>Add Address</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  {/* Address Display */}
                  {(() => {
                    const selectedAddr = addresses.find(addr => addr.id === selectedAddressId);
                    return selectedAddr ? (
                      <View style={[styles.defaultAddressCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <View style={styles.defaultAddressHeader}>
                          <View style={styles.defaultAddressInfo}>
                            <Text style={[styles.defaultAddressName, { color: colors.text }]}>{selectedAddr.name} • {selectedAddr.phone}</Text>
                            <Text style={[styles.defaultAddressText, { color: colors.textSecondary }]}>
                              {selectedAddr.address}, {selectedAddr.city}, {selectedAddr.state} - {selectedAddr.pincode}
                            </Text>
                            {selectedAddr.type && (
                              <Text style={[styles.defaultAddressType, { color: colors.success }]}>{selectedAddr.type}</Text>
                            )}
                          </View>
                        </View>
                      </View>
                    ) : null;
                  })()}
                </>
              )}
            </View>

            <View style={[styles.card, { backgroundColor: colors.card }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Selected Services</Text>
              {cartItems.map(renderItem)}
            </View>

            {/* Offers & Coupons */}
            <View style={[styles.card, { backgroundColor: colors.card }]}>
              <TouchableOpacity style={styles.couponRow} onPress={() => setCouponOpen(true)}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={[styles.offerIcon, { backgroundColor: colors.surface }]}><Ionicons name="gift-outline" size={18} color={colors.success} /></View>
                  <View>
                    <Text style={[styles.couponTitle, { color: colors.text }]}>Offers & Coupons {appliedCoupon ? `(Applied: ${appliedCoupon})` : ''}</Text>
                    <Text style={[styles.couponSub, { color: colors.textSecondary }]}>{appliedCoupon ? `You are saving ${discountPercent}%` : 'Apply coupon code'}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>

            {/* Order Summary */}
            <View style={[styles.card, { backgroundColor: colors.card }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Order Summary</Text>

              {/* Service Items */}
              <View style={styles.summarySection}>
                {cartItems.map((item, index) => {
                  const isPharmEasyItem = pharmEasyCategories.includes(item.category);
                  const isLabTestItem = !!item.labId || labTestCategories.includes(item.category); // Lab services are identified by having labId or Lab Test category
                  const isDoctorAppointmentItem = doctorAppointmentCategories.includes(item.category); // Doctor appointment items
                  const providerId = selectedProviders[item.id];

                  let itemPrice = 0;
                  let itemDescription = item.category;

                  if (isPharmEasyItem) {
                    // For PharmEasy items, calculate price based on quantity
                    const raw = typeof item.price === 'string' ? item.price : String(item.price ?? '');
                    const numeric = parseFloat(String(raw).replace(/[^\d.]/g, ''));
                    const price = Number.isFinite(numeric) ? numeric : 0;
                    const qty = Number.isFinite(item.quantity) ? item.quantity : 0;
                    itemPrice = price * qty;
                    itemDescription = `${item.category} • Qty: ${qty}`;
                  } else if (isLabTestItem) {
                    // For lab test items, use item price and show lab name
                    const raw = typeof item.price === 'string' ? item.price : String(item.price ?? '');
                    const numeric = parseFloat(String(raw).replace(/[^\d.]/g, ''));
                    const price = Number.isFinite(numeric) ? numeric : 0;
                    itemPrice = price;
                    itemDescription = item.labName ?
                      `${item.category} • ${item.labName}` :
                      item.category;
                  } else if (isDoctorAppointmentItem) {
                    // For doctor appointment items, use item price and show appointment details
                    const raw = typeof item.price === 'string' ? item.price : String(item.price ?? '');
                    const numeric = parseFloat(String(raw).replace(/[^\d.]/g, ''));
                    const price = Number.isFinite(numeric) ? numeric : 0;
                    itemPrice = price;
                    itemDescription = item.bookingDate && item.bookingTime ?
                      `${item.category} • ${item.bookingDate} • ${item.bookingTime}` :
                      item.category;
                  } else {
                    // For service items, use fixed item price (provider does not affect price)
                    const raw = typeof item.price === 'string' ? item.price : String(item.price ?? '');
                    const numeric = parseFloat(String(raw).replace(/[^\d.]/g, ''));
                    const price = Number.isFinite(numeric) ? numeric : 0;
                    const qty = Number.isFinite(item.quantity) ? item.quantity : 1;
                    itemPrice = price * qty;
                    itemDescription = providerId ?
                      `${item.category} • ${getServiceProviders(item.id).find(p => p.id === providerId)?.name}` :
                      item.category;
                  }

                  return (
                    <View key={item.id} style={styles.summaryRow}>
                      <View style={styles.summaryItemInfo}>
                        <Text style={[styles.summaryItemName, { color: colors.text }]}>{item.title}</Text>
                        <Text style={[styles.summaryItemCategory, { color: colors.textSecondary }]}>
                          {itemDescription}
                        </Text>
                      </View>
                      <Text style={[styles.summaryItemPrice, { color: colors.text }]}>₹{itemPrice}</Text>
                    </View>
                  );
                })}
              </View>

              {/* Divider */}
              <View style={[styles.summaryDivider, { backgroundColor: colors.divider }]} />

              {/* Pricing Breakdown */}
              <View style={styles.summarySection}>
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Subtotal</Text>
                  <Text style={[styles.summaryValue, { color: colors.text }]}>₹{itemTotal}</Text>
                </View>

                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Service Fee</Text>
                  <Text style={[styles.summaryValue, { color: colors.text }]}>₹{serviceFee}</Text>
                </View>

                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Tax (18%)</Text>
                  <Text style={[styles.summaryValue, { color: colors.text }]}>₹{tax}</Text>
                </View>

                {discount > 0 && (
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryDiscountLabel, { color: colors.success }]}>Discount ({discountPercent}%)</Text>
                    <Text style={[styles.summaryDiscountValue, { color: colors.success }]}>-₹{discount}</Text>
                  </View>
                )}
              </View>

              {/* Divider */}
              <View style={[styles.summaryDivider, { backgroundColor: colors.divider }]} />

              {/* Total */}
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryTotalLabel, { color: colors.text }]}>Total Amount</Text>
                <Text style={[styles.summaryTotalValue, { color: colors.primary }]}>₹{total}</Text>
              </View>

              {/* Checkout Button */}
              <TouchableOpacity
                onPress={proceed}
                style={{ marginTop: 16 }}
              >
                <LinearGradient
                  colors={['#004c8f', '#0c1a5d']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.checkoutButton}
                >
                  <Text style={[styles.gradientText, { color: '#FFFFFF' }]}>Proceed to Checkout</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Removed Price Summary card as requested */}
          </>
        )}
      </ScrollView>

      {/* Service Provider Picker Modal - Full Screen */}
      <Modal visible={providerPickerOpen} animationType="slide" onRequestClose={() => setProviderPickerOpen(false)}>
        <View style={[styles.fullScreenModalContainer, { backgroundColor: colors.background }]}>
          <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.surface} />
          
          {/* Header */}
          <View style={[styles.fullScreenModalHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border, paddingTop: insets.top + 16 }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.fullScreenModalTitle, { color: colors.text }]}>Choose Your Provider</Text>
              {activeServiceId && (() => {
                const serviceItem = cartItems.find(item => item.id === activeServiceId);
                return serviceItem ? (
                  <Text style={[styles.fullScreenModalSubtitle, { color: colors.textSecondary }]}>
                    {serviceItem.title}
                  </Text>
                ) : null;
              })()}
            </View>
            <TouchableOpacity 
              onPress={() => setProviderPickerOpen(false)}
              style={[styles.closeButton, { backgroundColor: colors.border }]}
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView 
            style={{ flex: 1, backgroundColor: colors.background }}
            contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
          >
            {activeServiceId && (() => {
              const providers = getServiceProviders(activeServiceId);
              const isLoading = loadingProviders[activeServiceId];

              if (isLoading) {
                return (
                  <View style={styles.loadingContainer}>
                    <Ionicons name="hourglass-outline" size={48} color={colors.textTertiary} />
                    <Text style={[styles.loadingText, { color: colors.textSecondary, marginTop: 12 }]}>
                      Finding the best providers for you...
                    </Text>
                  </View>
                );
              }

              if (providers.length === 0) {
                return (
                  <View style={styles.emptyContainer}>
                    <View style={[styles.emptyIconContainer, { backgroundColor: colors.border }]}>
                      <Ionicons name="business-outline" size={48} color={colors.textTertiary} />
                    </View>
                    <Text style={[styles.emptyTitle, { color: colors.text }]}>No Providers Available</Text>
                    <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                      We couldn't find any service providers for this service at the moment. Please try again later.
                    </Text>
                  </View>
                );
              }

              return (
                <>
                  <Text style={[styles.providersCountText, { color: colors.textSecondary, marginBottom: 16 }]}>
                    {providers.length} {providers.length === 1 ? 'provider' : 'providers'} available
                  </Text>
                  {providers.map(provider => (
                    <TouchableOpacity
                      key={provider.id}
                      style={[
                        styles.fullScreenProviderCard, 
                        !provider.available && styles.providerCardDisabled, 
                        { 
                          backgroundColor: colors.card, 
                          borderColor: provider.available ? colors.border : colors.border + '80',
                          opacity: provider.available ? 1 : 0.5
                        }
                      ]}
                      onPress={() => {
                        if (provider.available && activeServiceId) {
                          selectProvider(activeServiceId, provider.id);
                          hapticButtonPress();
                        }
                      }}
                      disabled={!provider.available}
                      activeOpacity={0.7}
                    >
                      <View style={styles.fullScreenProviderContent}>
                        <View style={[styles.fullScreenProviderImageContainer, { backgroundColor: colors.border }]}>
                          <ProviderAvatar provider={provider} size={72} />
                        </View>
                        <View style={styles.fullScreenProviderInfo}>
                          <Text style={[styles.fullScreenProviderName, { color: colors.text }]} numberOfLines={1}>
                            {provider.companyName}
                          </Text>
                          <Text style={[styles.providerService, { color: colors.textTertiary, fontSize: 13, marginTop: 2 }]} numberOfLines={1}>
                            {provider.serviceName}
                          </Text>
                          
                          {/* Rating and Experience Row */}
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, flexWrap: 'wrap', gap: 12 }}>
                            {/* Rating */}
                            {provider.reviews > 0 ? (
                              <View style={[styles.ratingBadge, { backgroundColor: colors.success + '15' }]}>
                                <Ionicons name="star" size={14} color="#F59E0B" />
                                <Text style={[styles.ratingText, { color: colors.text }]}>
                                  {provider.rating.toFixed(1)}
                                </Text>
                                <Text style={[styles.reviewCountText, { color: colors.textSecondary }]}>
                                  ({provider.reviews})
                                </Text>
                              </View>
                            ) : (
                              <View style={[styles.ratingBadge, { backgroundColor: colors.border }]}>
                                <Ionicons name="star-outline" size={14} color={colors.textTertiary} />
                                <Text style={[styles.reviewCountText, { color: colors.textTertiary }]}>
                                  New
                                </Text>
                              </View>
                            )}
                            
                            {/* Experience */}
                            {provider.experience && (
                              <View style={[styles.experienceBadge, { backgroundColor: colors.primary + '10' }]}>
                                <Ionicons name="briefcase-outline" size={12} color={colors.primary} />
                                <Text style={[styles.experienceText, { color: colors.primary }]}>
                                  {provider.experience}
                                </Text>
                              </View>
                            )}
                          </View>
                          
                          {!provider.available && (
                            <View style={[styles.unavailableBadge, { backgroundColor: colors.error + '15', marginTop: 10 }]}>
                              <Ionicons name="close-circle" size={14} color={colors.error} />
                              <Text style={[styles.unavailableText, { color: colors.error, marginLeft: 4 }]}>
                                Currently unavailable
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </>
              );
            })()}
          </ScrollView>
        </View>
      </Modal>

      {/* Address Selector Modal */}
      <Modal visible={showAddressSelector} animationType="slide" transparent onRequestClose={() => setShowAddressSelector(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalSheet, { maxHeight: '75%', backgroundColor: colors.surface }]}>
            <View style={styles.modalHead}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Choose Address</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <TouchableOpacity onPress={refreshAddresses} disabled={refreshing}>
                  <Ionicons
                    name='refresh'
                    size={18}
                    color={refreshing ? colors.textTertiary : colors.primary}
                    style={{ transform: [{ rotate: refreshing ? '180deg' : '0deg' }] }}
                  />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowAddressSelector(false)}>
                  <Ionicons name="close" size={22} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {addresses.map((addr) => (
                <TouchableOpacity
                  key={addr.id}
                  style={[
                    styles.addressSelectorItem,
                    selectedAddressId === addr.id && styles.addressSelectorItemSelected,
                    {
                      borderBottomColor: colors.divider,
                      backgroundColor: selectedAddressId === addr.id ? colors.surface : 'transparent'
                    }
                  ]}
                  onPress={() => {
                    setSelectedAddressId(addr.id);
                    setShowAddressSelector(false);
                  }}
                >
                  <View style={styles.addressSelectorLeft}>
                    <View style={[
                      styles.addressSelectorRadio,
                      selectedAddressId === addr.id && styles.addressSelectorRadioSelected,
                      {
                        borderColor: selectedAddressId === addr.id ? colors.success : colors.border,
                        backgroundColor: selectedAddressId === addr.id ? colors.success : 'transparent'
                      }
                    ]}>
                      {selectedAddressId === addr.id && (
                        <Ionicons name="checkmark" size={12} color="#fff" />
                      )}
                    </View>
                    <View style={styles.addressSelectorDetails}>
                      <Text style={[styles.addressSelectorName, { color: colors.text }]}>{addr.name} • {addr.phone}</Text>
                      <Text style={[styles.addressSelectorText, { color: colors.textSecondary }]}>
                        {addr.address}, {addr.city}, {addr.state} - {addr.pincode}
                      </Text>
                      {addr.type && (
                        <Text style={[styles.addressSelectorType, { color: colors.success }]}>{addr.type}</Text>
                      )}
                    </View>
                  </View>
                  {selectedAddressId === addr.id && (
                    <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                  )}
                </TouchableOpacity>
              ))}

              <TouchableOpacity
                style={[styles.addNewAddressBtn, { borderTopColor: colors.divider }]}
                onPress={() => {
                  setShowAddressSelector(false);
                  setShowAddAddress(true);
                }}
              >
                <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
                <Text style={[styles.addNewAddressText, { color: colors.primary }]}>Add New Address</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Coupon Modal */}

      {/* Add Address Modal */}
      <Modal visible={showAddAddress} animationType="slide" transparent onRequestClose={() => setShowAddAddress(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalSheet, { maxHeight: '85%', backgroundColor: colors.surface }]}>
            <View style={styles.modalHead}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Add New Address</Text>
              <TouchableOpacity onPress={() => setShowAddAddress(false)}><Ionicons name="close" size={22} color={colors.textTertiary} /></TouchableOpacity>
            </View>
            <ScrollView>
              {[
                { key: 'name', label: 'Full Name' },
                { key: 'phone', label: 'Phone' },
                { key: 'address', label: 'Address' },
                { key: 'city', label: 'City' },
                { key: 'state', label: 'State' },
                { key: 'pincode', label: 'Pincode' },
              ].map(f => (
                <View key={f.key} style={{ marginBottom: 12 }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 6 }}>{f.label}</Text>
                  <TextInput value={(newAddress as any)[f.key]} onChangeText={(t) => setNewAddress(prev => ({ ...prev, [f.key]: t }))} style={[styles.couponInput, { borderColor: colors.border, color: colors.text }]} />
                </View>
              ))}

              {/* Address Type Selection */}
              <View style={{ marginBottom: 12 }}>
                <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 6 }}>Address Type</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {['Home', 'Work', 'Other'].map(type => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.addressTypeBtn,
                        newAddress.type === type && styles.addressTypeBtnSelected,
                        {
                          borderColor: newAddress.type === type ? colors.primary : colors.border,
                          backgroundColor: newAddress.type === type ? colors.primary : colors.surface
                        }
                      ]}
                      onPress={() => setNewAddress(prev => ({ ...prev, type: type as 'Home' | 'Work' | 'Other' }))}
                    >
                      <Text style={[
                        styles.addressTypeBtnText,
                        newAddress.type === type && styles.addressTypeBtnTextSelected,
                        { color: newAddress.type === type ? colors.surface : colors.textSecondary }
                      ]}>
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>
            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: colors.primary }]}
              onPress={async () => {
                if (!newAddress.name || !newAddress.phone || !newAddress.address || !newAddress.city || !newAddress.state || !newAddress.pincode) {
                  Alert.alert('Error', 'Please fill all fields');
                  return;
                }

                try {
                  if (user?.id) {
                    // Save to Supabase API
                    const newAddr = await UserAddressesApi.create({
                      user_id: user.id,
                      label: newAddress.type,
                      recipient_name: newAddress.name,
                      phone: newAddress.phone,
                      line1: newAddress.address,
                      city: newAddress.city,
                      state: newAddress.state,
                      pincode: newAddress.pincode,
                    });

                    const mapped = {
                      id: newAddr.id,
                      name: newAddr.recipient_name || '',
                      phone: newAddr.phone || '',
                      address: newAddr.line1,
                      city: newAddr.city,
                      state: newAddr.state,
                      pincode: newAddr.pincode,
                      type: newAddr.label || 'Home',
                      isDefault: false
                    };

                    const updated = [...addresses, mapped];
                    setAddresses(updated);
                    setSelectedAddressId(mapped.id);
                  } else {
                    // Fallback to AsyncStorage
                    const addr = { id: `addr_${Date.now()}`, ...newAddress } as any;
                    const updated = [...addresses, addr];
                    setAddresses(updated);
                    setSelectedAddressId(addr.id);
                    await AsyncStorage.setItem('addresses', JSON.stringify(updated));
                  }

                  setShowAddAddress(false);
                  setNewAddress({ name: '', phone: '', address: '', city: '', state: '', pincode: '', type: 'Home' });
                } catch (error) {
                  console.error('Failed to save address:', error);
                  Alert.alert('Error', 'Failed to save address. Please try again.');
                }
              }}
            >
              <Text style={[styles.confirmText, { color: colors.surface }]}>Save Address</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <Modal visible={couponOpen} animationType="slide" transparent onRequestClose={() => setCouponOpen(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.couponModalSheet, { backgroundColor: colors.surface }]}>
            {/* Handle bar */}
            <View style={styles.couponHandleBar} />
            
            {/* Header */}
            <View style={styles.couponModalHead}>
              <View style={styles.couponHeaderLeft}>
                <View style={[styles.couponIconContainer, { backgroundColor: colors.primaryLight || '#E8F5E9' }]}>
                  <Ionicons name="pricetag" size={20} color={colors.primary} />
                </View>
                <Text style={[styles.couponModalTitle, { color: colors.text }]}>Apply Coupon</Text>
              </View>
              <TouchableOpacity 
                style={[styles.couponCloseBtn, { backgroundColor: colors.background }]} 
                onPress={() => setCouponOpen(false)}
              >
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Coupon Input */}
            <View style={[styles.couponInputContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Ionicons name="ticket-outline" size={20} color={colors.textTertiary} style={{ marginRight: 10 }} />
              <TextInput 
                style={[styles.couponInputField, { color: colors.text }]} 
                placeholder="Enter coupon code" 
                placeholderTextColor={colors.textTertiary} 
                value={couponCode} 
                onChangeText={setCouponCode} 
                autoCapitalize="characters" 
              />
              <TouchableOpacity 
                style={[
                  styles.couponApplyBtn, 
                  { backgroundColor: couponCode.trim() ? colors.primary : colors.border }
                ]} 
                onPress={applyCoupon}
                disabled={!couponCode.trim()}
              >
                <Text style={[styles.couponApplyBtnText, { color: couponCode.trim() ? '#fff' : colors.textTertiary }]}>Apply</Text>
              </TouchableOpacity>
            </View>

            {/* Divider */}
            <View style={[styles.couponDivider, { backgroundColor: colors.border }]} />

            {/* Available Coupons Section */}
            <View style={styles.couponAvailableSection}>
              <Text style={[styles.couponSectionTitle, { color: colors.textSecondary }]}>Available Coupons</Text>
              
              {/* No Coupons Available */}
              <View style={styles.noCouponsContainer}>
                <View style={[styles.noCouponsIconBg, { backgroundColor: colors.background }]}>
                  <Ionicons name="ticket-outline" size={40} color={colors.textTertiary} />
                </View>
                <Text style={[styles.noCouponsTitle, { color: colors.text }]}>No Coupons Available</Text>
                <Text style={[styles.noCouponsSubtitle, { color: colors.textSecondary }]}>
                  Check back later for exciting offers and discounts!
                </Text>
              </View>
            </View>
          </View>
        </View>
      </Modal>


    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingBottom: 10,
    paddingTop: 50,
    backgroundColor: 'transparent',
  },

  // Top Bar (same as home page) - Now static
  topBar: {
    marginTop: 20, // Increased to account for status bar
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 25,
    alignItems: 'center',
    zIndex: 1000, // Ensure it stays on top
  },
  greeting: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  location: { color: '#fff', fontWeight: '700' },
  topRightIcons: { flexDirection: 'row', alignItems: 'center' },
  themeToggleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  profileCircle: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  profileImage: { width: '80%', height: '80%' },

  // Cart title uses shared 'title' style like Orders page
  cartCountBadge: {
    backgroundColor: '#ff6b6b',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  cartCountText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600'
  },
  clearAllText: {
    fontSize: 14,
    fontWeight: '600'
  },

  // Cart Count Section
  cartCountSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8
  },

  scroll: {
    flex: 1,
    marginTop: 0, // No margin since header is now static
    backgroundColor: 'transparent',
  },
  card: {
    backgroundColor: 'transparent',
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    // Removed shadows to prevent rendering issues with transparent background
  },
  sectionTitle: { fontWeight: '900', marginBottom: 10 },

  serviceCard: { backgroundColor: 'transparent', borderRadius: 12, padding: 12, marginBottom: 12 },
  serviceHeader: { flexDirection: 'row', alignItems: 'center' },
  serviceImage: { width: 80, height: 80, borderRadius: 16, marginRight: 16 },
  serviceName: { fontWeight: '900' },
  serviceCategory: { marginTop: 2 },
  serviceSlotText: { fontWeight: '700', fontSize: 12, marginTop: 4 },
  servicePrice: { fontWeight: '900', marginTop: 6 },


  slotRow: { marginTop: 10, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  slotRowSelected: {},
  slotLabel: { fontSize: 12 },
  slotValue: { fontWeight: '800', fontSize: 13 },

  couponRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  offerIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  couponTitle: { fontWeight: '900' },
  couponSub: { fontSize: 12 },

  savingsBadge: { alignSelf: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, marginBottom: 8 },
  savingsText: { fontWeight: '800', fontSize: 12 },

  label: { fontSize: 14 },
  value: { fontWeight: '900' },
  divider: { height: 1, marginVertical: 10 },
  totalValue: { fontWeight: '900' },

  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptySub: { marginTop: 4 },
  exploreBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, marginTop: 12 },
  exploreText: { fontWeight: '800' },
  gradientTextContainer: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, marginTop: 12 },
  gradientText: { fontWeight: '800', textAlign: 'center' },

  // Modal shared
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, maxHeight: '80%' },
  modalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { fontWeight: '900', fontSize: 16 },

  // Full Screen Modal styles
  fullScreenModalContainer: {
    flex: 1,
  },
  fullScreenModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  fullScreenModalTitle: {
    fontSize: 26,
    fontWeight: '900',
    marginBottom: 4,
  },
  fullScreenModalSubtitle: {
    fontSize: 15,
    marginTop: 4,
    fontWeight: '500',
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  providersCountText: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fullScreenProviderCard: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  fullScreenProviderContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fullScreenProviderImageContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fullScreenProviderInfo: {
    flex: 1,
    marginLeft: 16,
  },
  fullScreenProviderName: {
    fontSize: 18,
    fontWeight: '800',
  },
  fullScreenProviderRating: {
    fontSize: 15,
    fontWeight: '700',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '700',
  },
  reviewCountText: {
    fontSize: 12,
    fontWeight: '600',
  },
  experienceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  experienceText: {
    fontSize: 11,
    fontWeight: '700',
  },
  selectButtonContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  unavailableBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  unavailableText: {
    fontSize: 12,
    fontWeight: '700',
  },
  emptyIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  loadingText: {
    fontSize: 15,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  groupLabel: { fontSize: 12, marginTop: 14, marginBottom: 8 },
  pill: { borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, marginRight: 10, alignItems: 'center' },
  pillActive: {},
  pillTop: { fontSize: 12, fontWeight: '700' },
  pillTopActive: {},
  pillSub: { fontWeight: '900', marginTop: 2 },
  timeHeader: { fontSize: 12, fontWeight: '700', marginTop: 14, marginBottom: 8 },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  timePill: { borderRadius: 999, paddingVertical: 8, paddingHorizontal: 12, marginRight: 8, marginBottom: 10 },
  timePillActive: {},
  timeText: { fontWeight: '800' },
  timeTextActive: {},
  confirmBtn: { borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  confirmText: { fontWeight: '900' },

  couponInput: { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginRight: 8 },
  applyBtn: { paddingHorizontal: 14, borderRadius: 10, justifyContent: 'center' },
  applyBtnText: { fontWeight: '800' },
  suggestPill: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, marginRight: 8 },
  suggestPillText: { fontWeight: '700' },
  
  // Coupon Modal Styles
  couponModalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 30,
    paddingTop: 12,
  },
  couponHandleBar: {
    width: 40,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  couponModalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  couponHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  couponIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  couponModalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  couponCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  couponInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginBottom: 20,
  },
  couponInputField: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    paddingVertical: 12,
  },
  couponApplyBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  couponApplyBtnText: {
    fontWeight: '700',
    fontSize: 14,
  },
  couponDivider: {
    height: 1,
    marginBottom: 20,
  },
  couponAvailableSection: {
    minHeight: 150,
  },
  couponSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  noCouponsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  noCouponsIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  noCouponsTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 6,
  },
  noCouponsSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },

  // New styles for date pill
  datePill: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginRight: 10,
    alignItems: 'center',
  },
  datePillActive: {
    backgroundColor: '#1818ec',
  },
  dateLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  dateLabelActive: {
    color: '#fff',
  },

  // Provider card styles
  providerCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  providerCardDisabled: {
    opacity: 0.5,
  },
  providerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  providerImageContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  providerImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  providerInfo: {
    flex: 1,
  },
  providerName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  providerRating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  reviewsText: {
    fontSize: 12,
    marginLeft: 4,
  },
  providerExperience: {
    fontSize: 12,
  },
  providerService: {
    fontSize: 12,
    marginTop: 2,
  },
  reviewCount: {
    fontSize: 12,
    marginTop: 2,
  },

  // Address selection styles
  emptyAddressContainer: {
    alignItems: 'center',
    paddingVertical: 20
  },
  emptyAddressText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  emptyAddressSub: {
    fontSize: 12,
    marginTop: 4,
  },
  addAddressBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 16,
    borderWidth: 1,
  },
  addAddressBtnText: {
    color: '#1818ec',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 8,
  },
  addressList: {
    marginTop: 8,
  },
  addressItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  addressItemSelected: {
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
  },
  addressItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  addressRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  addressRadioSelected: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  addressDetails: {
    flex: 1,
  },
  addressName: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  addressText: {
    fontSize: 12,
    lineHeight: 16,
  },
  addressType: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
    textTransform: 'uppercase',
  },

  // Address type selection styles
  addressTypeBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  addressTypeBtnSelected: {
    // backgroundColor and borderColor will be set dynamically in JSX
  },
  addressTypeBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  addressTypeBtnTextSelected: {
    // color will be set dynamically in JSX
  },

  // Default address display styles
  defaultAddressCard: {
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
  },
  defaultAddressHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  defaultAddressInfo: {
    flex: 1,
    marginRight: 12,
  },
  defaultAddressName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  defaultAddressText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  defaultAddressType: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  addAddressHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  addAddressHeaderText: {
    fontSize: 12,
    fontWeight: '600',
  },
  changeAddressBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  changeAddressBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Address selector modal styles
  addressSelectorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  addressSelectorItemSelected: {
    // backgroundColor will be set dynamically in JSX
  },
  addressSelectorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  addressSelectorRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  addressSelectorRadioSelected: {
    // backgroundColor and borderColor will be set dynamically in JSX
  },
  addressSelectorDetails: {
    flex: 1,
  },
  addressSelectorName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  addressSelectorText: {
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 4,
  },
  addressSelectorType: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  addNewAddressBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderTopWidth: 1,
  },
  addNewAddressText: {
    color: '#1818ec',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },

  // Order summary styles
  summarySection: {
    marginBottom: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  summaryItemInfo: {
    flex: 1,
    marginRight: 12,
  },
  summaryItemName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  summaryItemCategory: {
    fontSize: 12,
  },
  summaryItemPrice: {
    fontSize: 14,
    fontWeight: '600',
  },
  summaryDivider: {
    height: 1,
    marginVertical: 8,
  },
  summaryLabel: {
    fontSize: 14,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  summaryDiscountLabel: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '600',
  },
  summaryDiscountValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
  },
  summaryTotalLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  summaryTotalValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1818ec',
  },

  // Location Modal Styles
  locOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  locCard: {
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  locTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  locInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 20,
  },
  locInput: {
    flex: 1,
    fontSize: 16,
  },
  locActions: {
    flexDirection: 'row',
    gap: 12,
  },
  locBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  locCancel: {},
  locSave: {
    backgroundColor: '#1818ec',
  },
  locBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },
  locCancelText: {},
  locSaveText: {
    color: '#fff',
  },

  checkoutButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkoutButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1818ec',
  },

  quantityTextContainer: {
    borderRadius: 8,
    paddingHorizontal: 6,
    marginHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityBtnDecrease: {
    backgroundColor: '#10B981',
  },
  quantityBtnIncrease: {
    backgroundColor: '#10B981',
  },
  quantityText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  inlineQuantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    alignSelf: 'flex-start',
  },
});
