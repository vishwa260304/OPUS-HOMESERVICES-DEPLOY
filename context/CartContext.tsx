import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { ImageSourcePropType } from 'react-native'; // ✅ Added for proper image typing
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';

export interface CartItem {
  id: string;
  title: string;
  description: string;
  price: string;
  time: string;
  image: ImageSourcePropType; // ✅ Fixed type for image
  imageUri?: string; // Optional normalized string URI if available
  category: string;
  quantity: number;
  bookingDate?: string;
  bookingTime?: string;
  // Lab-specific properties
  labId?: string;
  labName?: string;
  labRating?: number;
  labReviews?: number;
}

interface CartContextType {
  cartItems: CartItem[];
  addToCart: (item: Omit<CartItem, 'quantity'>) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => Promise<void>;
  getTotalItems: () => number;
  getTotalPrice: () => number;
  saveCartToStorage: () => Promise<void>;
  loadCartFromStorage: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

interface CartProviderProps {
  children: ReactNode;
}

export const CartProvider: React.FC<CartProviderProps> = ({ children }) => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const { user } = useAuth();
  const hasLoadedCartRef = useRef(false);
  const skipNextSaveRef = useRef(false);
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addToCart = (item: Omit<CartItem, 'quantity'>) => {
    setCartItems(prevItems => {
      const existingItem = prevItems.find(cartItem => cartItem.id === item.id);
      
      if (existingItem) {
        return prevItems.map(cartItem =>
          cartItem.id === item.id
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        );
      } else {
        return [...prevItems, { ...item, quantity: 1 }];
      }
    });
  };

  const removeFromCart = (id: string) => {
    setCartItems(prevItems => prevItems.filter(item => item.id !== id));
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(id);
      return;
    }
    
    setCartItems(prevItems =>
      prevItems.map(item =>
        item.id === id ? { ...item, quantity } : item
      )
    );
  };

  const clearCart = async () => {
    setCartItems([]);
    if (saveDebounceRef.current) {
      clearTimeout(saveDebounceRef.current);
      saveDebounceRef.current = null;
    }
    if (user) {
      try {
        const cartKey = `cart_${user.id}`;
        await AsyncStorage.removeItem(cartKey);
      } catch (error) {
        console.error('Error clearing cart from storage:', error);
      }
    }
  };

  const getTotalItems = () => {
    return cartItems.reduce((total, item) => total + item.quantity, 0);
  };

  const getTotalPrice = () => {
    return cartItems.reduce((total, item) => {
      const price = parseFloat(String(item.price ?? '').replace(/[^0-9.]/g, ''));
      const qty = Number.isFinite(item.quantity) ? item.quantity : 1;
      return total + (Number.isNaN(price) ? 0 : price * qty);
    }, 0);
  };

  // Cart persistence functions
  const saveCartToStorage = async () => {
    if (!user) return;
    
    try {
      const cartKey = `cart_${user.id}`;
      await AsyncStorage.setItem(cartKey, JSON.stringify(cartItems));
    } catch (error) {
      console.error('Error saving cart to storage:', error);
    }
  };

  const loadCartFromStorage = async () => {
    if (!user) return;
    
    try {
      const cartKey = `cart_${user.id}`;
      const savedCart = await AsyncStorage.getItem(cartKey);
      skipNextSaveRef.current = true;
      if (savedCart) {
        const parsedCart = JSON.parse(savedCart);
        setCartItems(Array.isArray(parsedCart) ? parsedCart : []);
      } else {
        setCartItems([]);
      }
      hasLoadedCartRef.current = true;
    } catch (error) {
      hasLoadedCartRef.current = true;
      console.error('Error loading cart from storage:', error);
    }
  };

  // Load the active user's cart once and reset state on logout.
  useEffect(() => {
    if (user) {
      hasLoadedCartRef.current = false;
      loadCartFromStorage();
    } else {
      hasLoadedCartRef.current = false;
      skipNextSaveRef.current = false;
      setCartItems([]);
    }
  }, [user]);

  // Persist cart changes after the initial load completes, including empty carts.
  useEffect(() => {
    if (!user || !hasLoadedCartRef.current) {
      return;
    }

    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }

    if (saveDebounceRef.current) {
      clearTimeout(saveDebounceRef.current);
    }

    saveDebounceRef.current = setTimeout(() => {
      saveCartToStorage();
      saveDebounceRef.current = null;
    }, 800);

    return () => {
      if (saveDebounceRef.current) {
        clearTimeout(saveDebounceRef.current);
        saveDebounceRef.current = null;
      }
    };
  }, [cartItems, user]);

  const value: CartContextType = {
    cartItems,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    getTotalItems,
    getTotalPrice,
    saveCartToStorage,
    loadCartFromStorage,
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};
