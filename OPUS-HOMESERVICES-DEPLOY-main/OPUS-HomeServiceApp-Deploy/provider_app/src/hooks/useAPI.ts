import { useAuth } from '../context/AuthContext'
import { api, ProviderProfile } from '../lib/api'

/**
 * Custom hook that provides access to all API functions
 * Automatically includes user context for authenticated operations
 */
export const useAPI = () => {
  const { user } = useAuth()

  return {
    // Authentication APIs (no user context needed)
    auth: api.auth,
    
    // Profile APIs (uses current user context)
    profile: {
      getProfile: () => user ? api.profile.getProfile(user.id) : Promise.resolve({ data: null, error: new Error('No user logged in') }),
      updateProfile: (updates: Partial<ProviderProfile>) => user ? api.profile.updateProfile(user.id, updates) : Promise.resolve({ data: null, error: new Error('No user logged in') }),
    },
    
    // Services APIs (uses current user context)
    services: {
      getServices: () => user ? api.services.getServices(user.id) : Promise.resolve({ data: null, error: new Error('No user logged in') }),
      getService: api.services.getService,
      createService: (serviceData: any) => user ? api.services.createService({ ...serviceData, user_id: user.id }) : Promise.resolve({ data: null, error: new Error('No user logged in') }),
      updateService: api.services.updateService,
      deleteService: api.services.deleteService,
    },
    
    // Bookings APIs (uses current user context)
    bookings: {
      getBookings: () => user ? api.bookings.getBookings(user.id) : Promise.resolve({ data: null, error: new Error('No user logged in') }),
      getBooking: api.bookings.getBooking,
      updateBookingStatus: api.bookings.updateBookingStatus,
    },
    
    // Earnings APIs (uses current user context)
    earnings: {
      getEarnings: () => user ? api.earnings.getEarnings(user.id) : Promise.resolve({ data: null, error: new Error('No user logged in') }),
      getEarningsSummary: (period?: 'week' | 'month' | 'year') => user ? api.earnings.getEarningsSummary(user.id, period) : Promise.resolve({ data: null, error: new Error('No user logged in') }),
    },
    
    // Documents APIs (uses current user context)
    documents: {
      getDocuments: () => user ? api.documents.getDocuments(user.id) : Promise.resolve({ data: null, error: new Error('No user logged in') }),
      uploadDocument: (documentData: any) => user ? api.documents.uploadDocument({ ...documentData, user_id: user.id }) : Promise.resolve({ data: null, error: new Error('No user logged in') }),
      deleteDocument: api.documents.deleteDocument,
    },
  }
}

export default useAPI
