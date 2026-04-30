import { useEffect } from 'react';
import { useRouter, type Href } from 'expo-router';
import { useAuth } from '../context/AuthContext';

export const useAuthGuard = (redirectTo: Href = '/subcategories/login') => {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace(redirectTo);
    }
  }, [user, loading, router, redirectTo]);

  return { user, loading, isAuthenticated: !!user };
};

export const useOptionalAuth = () => {
  const { user, loading } = useAuth();
  return { user, loading, isAuthenticated: !!user };
};
