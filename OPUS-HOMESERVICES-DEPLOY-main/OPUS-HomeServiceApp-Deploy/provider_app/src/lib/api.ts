import { supabase, userProfile } from './supabase'
import { User, AuthError } from '@supabase/supabase-js'

export interface ProviderProfile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  phone: string | null
  created_at: string
  updated_at: string
}

export interface Service {
  id: number
  user_id: string
  company_id: string | null
  service_name: string
  service_type: string
  description: string | null
  experience_years?: number | null
  submitted_at: string
  updated_at: string
}

export interface Booking {
  id: number
  provider_id: string
  customer_id: string
  service_id: number
  booking_date: string
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'
  customer_address: string | null
  customer_phone: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Earnings {
  id: number
  provider_id: string
  booking_id: number
  amount: number
  commission_rate: number
  net_amount: number
  status: 'pending' | 'paid' | 'cancelled'
  paid_at: string | null
  created_at: string
}

// Authentication API
export const authAPI = {
  // Sign up with email and password
  signUp: async (email: string, password: string, fullName?: string, phone?: string) => {
    try {
      // Sign up the user - this will create the user in auth.users
      // Profile will be created automatically after email verification (on SIGNED_IN event)
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // Don't set emailRedirectTo - let Supabase use default behavior
          // This allows email verification to work properly
          data: {
            full_name: fullName || '',
            fullName: fullName || '', // Also set fullName for compatibility
            phone: phone || '',
          },
        },
      })

      // If signup was successful but there's an error, log it for debugging
      if (error) {
        console.error('Sign up error:', {
          message: error.message,
          status: error.status,
          name: error.name,
          code: (error as any).code,
        })
      } else if (data?.user) {
        console.log('User created successfully in auth.users:', data.user.id)
        // Profile will be created automatically after email verification
      }

      return { data, error }
    } catch (error) {
      console.error('Sign up exception:', error)
      return { data: null, error: error as AuthError }
    }
  },

  // Sign in with email and password
  signIn: async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      return { data, error }
    } catch (error) {
      return { data: null, error: error as AuthError }
    }
  },

  // Sign out current user
  signOut: async () => {
    try {
      const { error } = await supabase.auth.signOut()
      return { error }
    } catch (error) {
      return { error: error as AuthError }
    }
  },

  // Get current user
  getCurrentUser: async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser()
      return { user, error }
    } catch (error) {
      return { user: null, error: error as AuthError }
    }
  },

  // Reset password
  resetPassword: async (email: string) => {
    try {
      const { data, error } = await supabase.auth.resetPasswordForEmail(email)
      return { data, error }
    } catch (error) {
      return { data: null, error: error as AuthError }
    }
  },

  // Listen to auth state changes
  onAuthStateChange: (callback: (event: string, session: any) => void) => {
    return supabase.auth.onAuthStateChange(callback)
  }
}

// Provider Profile API
export const profileAPI = {
  // Get provider profile
  getProfile: async (userId: string) => {
    try {
      const { data, error } = await userProfile.getProfile(userId)
      return { data, error }
    } catch (error) {
      return { data: null, error: error as AuthError }
    }
  },

  // Update provider profile
  updateProfile: async (
    userId: string,
    updates: Partial<Pick<ProviderProfile, 'full_name' | 'avatar_url' | 'phone'>>
  ) => {
    try {
      // Remove any null values from updates, as the DB expects undefined or string, not null
      const sanitizedUpdates: {
        full_name?: string;
        avatar_url?: string;
        phone?: string;
      } = {};

      if (updates.full_name !== undefined && updates.full_name !== null) {
        sanitizedUpdates.full_name = updates.full_name;
      }
      if (updates.avatar_url !== undefined && updates.avatar_url !== null) {
        sanitizedUpdates.avatar_url = updates.avatar_url;
      }
      if (updates.phone !== undefined && updates.phone !== null) {
        sanitizedUpdates.phone = updates.phone;
      }

      const { data, error } = await userProfile.updateProfile(userId, sanitizedUpdates);
      return { data, error };
    } catch (error) {
      return { data: null, error: error as AuthError };
    }
  },

  // Create provider profile
  createProfile: async (userId: string, email: string, fullName?: string, phone?: string) => {
    try {
      const { data, error } = await userProfile.createProfile(userId, email, fullName, phone)
      return { data, error }
    } catch (error) {
      return { data: null, error: error as AuthError }
    }
  }
}

// Services API
export const servicesAPI = {
  // Get all services for a user
  getServices: async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('providers_services')
        .select('*')
        .eq('user_id', userId)
        .order('submitted_at', { ascending: false })
      return { data, error }
    } catch (error) {
      return { data: null, error: error as AuthError }
    }
  },

  // Get service by ID
  getService: async (serviceId: number) => {
    try {
      const { data, error } = await supabase
        .from('providers_services')
        .select('*')
        .eq('id', serviceId)
        .single()
      return { data, error }
    } catch (error) {
      return { data: null, error: error as AuthError }
    }
  },

  // Create new service
  createService: async (serviceData: Omit<Service, 'id' | 'submitted_at' | 'updated_at'>) => {
    try {
      // Insert into providers_services first (no triggers will fire)
      const { data: serviceResult, error: serviceError } = await supabase
        .from('providers_services')
        .insert(serviceData)
        .select()
        .single();

      if (serviceError) {
        console.error('Service insert error:', serviceError);
        return { data: null, error: serviceError };
      }

      // Manually insert into provider_service_mapping (bypassing all triggers)
      try {
        const { error: mappingError } = await supabase
          .from('provider_service_mapping')
          .insert({
            provider_service_id: serviceResult.id,
            service_name: serviceData.service_name,
            service_type: serviceData.service_type,
            total_linked_services: 1,
            linked_subservices: [serviceData.service_name],
            linked_at: new Date().toISOString()
          });

        if (mappingError) {
          console.warn('Mapping insert failed (non-critical):', mappingError);
          // Don't fail the whole operation if mapping fails
        } else {
          console.log('Service and mapping created successfully');
        }
      } catch (mappingErr) {
        console.warn('Mapping insert error (non-critical):', mappingErr);
        // Continue even if mapping fails
      }

      return { data: serviceResult, error: null };
    } catch (error) {
      console.error('Service creation error:', error);
      return { data: null, error: error as AuthError };
    }
  },

  // Update service
  updateService: async (serviceId: number, updates: Partial<Service>) => {
    try {
      const { data, error } = await supabase
        .from('providers_services')
        .update(updates)
        .eq('id', serviceId)
        .select()
      return { data, error }
    } catch (error) {
      return { data: null, error: error as AuthError }
    }
  },

  // Delete service
  deleteService: async (serviceId: number) => {
    try {
      // First, delete from provider_service_mapping table
      const { error: mappingError } = await supabase
        .from('provider_service_mapping')
        .delete()
        .eq('provider_service_id', serviceId)

      if (mappingError) {
        console.warn('Failed to delete from provider_service_mapping:', mappingError);
        // Continue with service deletion even if mapping deletion fails
      }

      // Then delete from providers_services table
      const { error } = await supabase
        .from('providers_services')
        .delete()
        .eq('id', serviceId)

      return { error }
    } catch (error) {
      return { error: error as AuthError }
    }
  }
}

// Bookings API
export const bookingsAPI = {
  // Get all bookings for a provider
  getBookings: async (providerId: string) => {
    try {
      const { data, error } = await supabase
        .from('providers_bookings')
        .select(`
          *,
          services:service_id (
            service_name,
            service_type
          )
        `)
        .eq('provider_id', providerId)
        .order('updated_at', { ascending: false })
      return { data, error }
    } catch (error) {
      return { data: null, error: error as AuthError }
    }
  },

  // Get booking by ID
  getBooking: async (bookingId: number) => {
    try {
      const { data, error } = await supabase
        .from('providers_bookings')
        .select(`
          *,
          services:service_id (
            service_name,
            service_type
          )
        `)
        .eq('id', bookingId)
        .single()
      return { data, error }
    } catch (error) {
      return { data: null, error: error as AuthError }
    }
  },

  // Update booking status
  updateBookingStatus: async (bookingId: number, status: Booking['status']) => {
    try {
      const { data, error } = await supabase
        .from('providers_bookings')
        .update({ status })
        .eq('id', bookingId)
        .select()
      return { data, error }
    } catch (error) {
      return { data: null, error: error as AuthError }
    }
  }
}

// Earnings API
export const earningsAPI = {
  // Get all earnings for a provider
  getEarnings: async (providerId: string) => {
    try {
      const { data, error } = await supabase
        .from('providers_earnings')
        .select(`
          *,
          bookings:booking_id (
            service_id,
            booking_date,
            services:service_id (
              service_name
            )
          )
        `)
        .eq('provider_id', providerId)
        .order('updated_at', { ascending: false })
      return { data, error }
    } catch (error) {
      return { data: null, error: error as AuthError }
    }
  },

  // Get earnings summary
  getEarningsSummary: async (providerId: string, period: 'week' | 'month' | 'year' = 'month') => {
    try {
      let dateFilter = new Date()
      switch (period) {
        case 'week':
          dateFilter.setDate(dateFilter.getDate() - 7)
          break
        case 'month':
          dateFilter.setMonth(dateFilter.getMonth() - 1)
          break
        case 'year':
          dateFilter.setFullYear(dateFilter.getFullYear() - 1)
          break
      }

      const { data, error } = await supabase
        .from('providers_earnings')
        .select('amount, net_amount, status, created_at')
        .eq('provider_id', providerId)
        .gte('created_at', dateFilter.toISOString())

      if (error) return { data: null, error }

      const summary = {
        totalEarnings: data?.reduce((sum, earning) => sum + (earning.status === 'paid' ? earning.net_amount : 0), 0) || 0,
        pendingEarnings: data?.reduce((sum, earning) => sum + (earning.status === 'pending' ? earning.net_amount : 0), 0) || 0,
        totalBookings: data?.length || 0,
        paidBookings: data?.filter(earning => earning.status === 'paid').length || 0
      }

      return { data: summary, error: null }
    } catch (error) {
      return { data: null, error: error as AuthError }
    }
  }
}

// Documents API
export const documentsAPI = {
  // Get documents for a user
  getDocuments: async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('providers_documents')
        .select('*')
        .eq('user_id', userId)
        .order('uploaded_at', { ascending: false })
      return { data, error }
    } catch (error) {
      return { data: null, error: error as AuthError }
    }
  },

  // Upload document
  uploadDocument: async (documentData: Omit<Service, 'id' | 'uploaded_at'>) => {
    try {
      const { data, error } = await supabase
        .from('providers_documents')
        .insert(documentData)
        .select()
      return { data, error }
    } catch (error) {
      return { data: null, error: error as AuthError }
    }
  },

  // Delete document
  deleteDocument: async (documentId: number) => {
    try {
      const { error } = await supabase
        .from('providers_documents')
        .delete()
        .eq('id', documentId)
      return { error }
    } catch (error) {
      return { error: error as AuthError }
    }
  }
}

// Company Verification API
export const companyVerificationAPI = {
  // Get company verification for a user
  getCompanyVerification: async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('providers_company_verification')
        .select(`
          *,
          documents:providers_verification_documents(*)
        `)
        .eq('user_id', userId)
        .single()
      return { data, error }
    } catch (error) {
      return { data: null, error: error as AuthError }
    }
  },

  // Create company verification
  createCompanyVerification: async (verificationData: {
    user_id: string
    company_name: string
    gst_number?: string
    official_email: string
    contact_number: string
    business_type?: string
    business_address?: string
    selected_sector?: string
    documents_required?: string[]
  }) => {
    try {
      const { data, error } = await supabase
        .from('providers_company_verification')
        .insert(verificationData)
        .select()
      return { data, error }
    } catch (error) {
      return { data: null, error: error as AuthError }
    }
  },

  // Get all pharmacy users (medicine delivery sector)
  getPharmacyUserIds: async () => {
    try {
      const { data, error } = await supabase
        .from('providers_company_verification')
        .select('user_id')
        .eq('selected_sector', 'medicine delivery')
      // Only fetch active/verified providers if needed, strictly following prompt just sector filter for now

      if (error) {
        console.error('Error fetching pharmacy users:', error);
        return { data: [], error };
      }

      // Return array of user IDs
      const userIds = data?.map(d => d.user_id) || [];
      return { data: userIds, error: null };
    } catch (error) {
      return { data: [], error: error as AuthError }
    }
  },

  // Update company verification
  updateCompanyVerification: async (verificationId: string, updates: {
    company_name?: string
    gst_number?: string
    official_email?: string
    contact_number?: string
    business_type?: string
    business_address?: string
    selected_sector?: string
    verification_status?: 'pending' | 'under_review' | 'approved' | 'rejected'
    verification_notes?: string
    online_status?: boolean
  }) => {
    try {
      const { data, error } = await supabase
        .from('providers_company_verification')
        .update(updates)
        .eq('id', verificationId)
        .select()
      return { data, error }
    } catch (error) {
      return { data: null, error: error as AuthError }
    }
  },

  // Upload verification document (auto-approved)
  uploadVerificationDocument: async (documentData: {
    verification_id: string
    user_id: string
    document_type: string
    document_name: string
    file_url: string
    file_size?: number
    mime_type?: string
  }) => {
    try {
      const { data, error } = await supabase
        .from('providers_verification_documents')
        .insert({
          ...documentData,
          document_status: 'approved', // Auto-approve all documents
          verified_at: new Date().toISOString()
        })
        .select()
      return { data, error }
    } catch (error) {
      return { data: null, error: error as AuthError }
    }
  },

  // Get verification documents
  getVerificationDocuments: async (verificationId: string) => {
    try {
      const { data, error } = await supabase
        .from('providers_verification_documents')
        .select('*')
        .eq('verification_id', verificationId)
        .order('uploaded_at', { ascending: false })
      return { data, error }
    } catch (error) {
      return { data: null, error: error as AuthError }
    }
  },

  // Update document status
  updateDocumentStatus: async (documentId: string, status: 'pending' | 'approved' | 'rejected', rejectionReason?: string) => {
    try {
      const { data, error } = await supabase
        .from('providers_verification_documents')
        .update({
          document_status: status,
          rejection_reason: rejectionReason || null,
          verified_at: status === 'approved' ? new Date().toISOString() : null
        })
        .eq('id', documentId)
        .select()
      return { data, error }
    } catch (error) {
      return { data: null, error: error as AuthError }
    }
  },

  // Delete verification document
  deleteVerificationDocument: async (documentId: string) => {
    try {
      const { error } = await supabase
        .from('providers_verification_documents')
        .delete()
        .eq('id', documentId)
      return { error }
    } catch (error) {
      return { error: error as AuthError }
    }
  },

  // Check if verification is complete
  checkVerificationComplete: async (verificationId: string) => {
    try {
      const { data, error } = await supabase.rpc('check_document_completion', {
        verification_id: verificationId
      })
      return { data, error }
    } catch (error) {
      return { data: null, error: error as AuthError }
    }
  },

  // Update verification status
  updateVerificationStatus: async (verificationId: string, status: 'pending' | 'under_review' | 'approved' | 'rejected', notes?: string) => {
    try {
      const { data, error } = await supabase.rpc('update_verification_status', {
        verification_id: verificationId,
        new_status: status,
        notes: notes || null
      })
      return { data, error }
    } catch (error) {
      return { data: null, error: error as AuthError }
    }
  }
}

// Doctor Details API
export const doctorDetailsAPI = {
  // Get doctor details for a user
  getDoctorDetails: async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('providers_doctor_details')
        .select('*')
        .eq('user_id', userId)
        .single()
      return { data, error }
    } catch (error) {
      return { data: null, error: error as AuthError }
    }
  },

  // Upsert doctor details keyed by user_id
  // Schema: id, user_id, doctor_name, medical_registration_number, specialty, address, doctor_bio, created_at, updated_at
  upsertDoctorDetails: async (
    userId: string,
    details: {
      doctor_name?: string
      medical_registration_number?: string
      specialty?: string
      address?: string
      doctor_bio?: string
    }
  ) => {
    try {
      const payload: any = {
        user_id: userId,
      }

      // Only include fields that are provided
      if (details.doctor_name !== undefined) payload.doctor_name = details.doctor_name
      if (details.medical_registration_number !== undefined) payload.medical_registration_number = details.medical_registration_number
      if (details.specialty !== undefined) payload.specialty = details.specialty
      if (details.address !== undefined) payload.address = details.address
      if (details.doctor_bio !== undefined) payload.doctor_bio = details.doctor_bio

      const { data, error } = await supabase
        .from('providers_doctor_details')
        .upsert(payload, { onConflict: 'user_id' })
        .select()
      return { data, error }
    } catch (error) {
      return { data: null, error: error as AuthError }
    }
  },

  // Update bio specifically
  updateBio: async (userId: string, bio: string) => {
    try {
      const { data, error } = await supabase
        .from('providers_doctor_details')
        .upsert(
          {
            user_id: userId,
            doctor_bio: bio,
          },
          { onConflict: 'user_id' }
        )
        .select()
      return { data, error }
    } catch (error) {
      return { data: null, error: error as AuthError }
    }
  }
}

// Doctor Documents API
export const doctorDocumentsAPI = {
  // List doctor documents for a user
  getDoctorDocuments: async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('providers_doctor_documents')
        .select('*')
        .eq('user_id', userId)
        .order('uploaded_at', { ascending: false })
      return { data, error }
    } catch (error) {
      return { data: null, error: error as AuthError }
    }
  },

  // Insert a doctor document metadata row
  // Schema: id, user_id, doctor_details_id, document_type, document_name, file_url, file_size, mime_type, document_status, rejection_reason, uploaded_at, verified_at
  insertDoctorDocument: async (doc: {
    user_id: string
    doctor_details_id?: string | null
    document_type: string
    document_name: string
    file_url: string
    file_size?: number | null
    mime_type?: string | null
    document_status?: string // defaults to 'approved' in DB
  }) => {
    try {
      const payload = {
        user_id: doc.user_id,
        doctor_details_id: doc.doctor_details_id || null,
        document_type: doc.document_type,
        document_name: doc.document_name,
        file_url: doc.file_url,
        file_size: doc.file_size || null,
        mime_type: doc.mime_type || null,
        document_status: doc.document_status || 'approved',
        verified_at: doc.document_status === 'approved' ? new Date().toISOString() : null,
      }
      const { data, error } = await supabase
        .from('providers_doctor_documents')
        .insert(payload)
        .select()
      return { data, error }
    } catch (error) {
      return { data: null, error: error as AuthError }
    }
  }
}

// Acting Drivers API
export const actingDriversAPI = {
  // Get acting driver details for a user
  getActingDriverDetails: async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('providers_acting_drivers')
        .select('*')
        .eq('user_id', userId)
        .single()
      return { data, error }
    } catch (error) {
      return { data: null, error: error as AuthError }
    }
  },

  // Create or update acting driver details
  upsertActingDriverDetails: async (
    userId: string,
    details: {
      name: string
      phone: string
      email: string
      address: string
      driving_experience_years?: number
      profile_photo?: string
      aadhaar_number?: string
      drivers_licence?: string
      fare_per_hour?: number
      about?: string
      selected_sector?: string
    }
  ) => {
    try {
      const payload: any = {
        user_id: userId,
        name: details.name,
        phone: details.phone,
        email: details.email,
        address: details.address,
        selected_sector: details.selected_sector || 'Acting Drivers',
      }
      
      // Only include driving_experience_years if provided
      if (details.driving_experience_years !== undefined) {
        payload.driving_experience_years = details.driving_experience_years ?? null;
      }
      
      // Only include profile_photo if provided
      if (details.profile_photo !== undefined) {
        payload.profile_photo = details.profile_photo || null;
      }
      
      // Only include aadhaar_number if provided
      if (details.aadhaar_number !== undefined) {
        payload.aadhaar_number = details.aadhaar_number || null;
      }
      
      // Only include drivers_licence if provided
      if (details.drivers_licence !== undefined) {
        payload.drivers_licence = details.drivers_licence || null;
      }

      // Only include fare_per_hour if provided
      if (details.fare_per_hour !== undefined) {
        payload.fare_per_hour = details.fare_per_hour ?? null;
      }

      // Only include about if provided
      if (details.about !== undefined) {
        payload.about = details.about || null;
      }

      const { data, error } = await supabase
        .from('providers_acting_drivers')
        .upsert(payload, { onConflict: 'user_id' })
        .select()
      return { data, error }
    } catch (error) {
      return { data: null, error: error as AuthError }
    }
  },

  // Update acting driver details
  updateActingDriverDetails: async (
    detailsId: string,
    updates: {
      name?: string
      phone?: string
      email?: string
      address?: string
      driving_experience_years?: number
      profile_photo?: string
      aadhaar_number?: string
      drivers_licence?: string
      fare_per_hour?: number
      about?: string
      services_offered?: string[]
      is_online?: boolean
      verification_status?: 'pending' | 'under_review' | 'approved' | 'rejected'
      verification_notes?: string
    }
  ) => {
    try {
      // DB column is "Is_online" (case-sensitive); map is_online -> Is_online for update
      const payload = { ...updates } as Record<string, unknown>
      if (updates.is_online !== undefined) {
        payload.Is_online = updates.is_online
        delete payload.is_online
      }
      const { data, error } = await supabase
        .from('providers_acting_drivers')
        .update(payload)
        .eq('id', detailsId)
        .select()
      return { data, error }
    } catch (error) {
      return { data: null, error: error as AuthError }
    }
  },

  // Update verification status
  updateVerificationStatus: async (
    detailsId: string,
    status: 'pending' | 'under_review' | 'approved' | 'rejected',
    notes?: string
  ) => {
    try {
      const { data, error } = await supabase
        .from('providers_acting_drivers')
        .update({
          verification_status: status,
          verification_notes: notes || null,
          verified_at: status === 'approved' ? new Date().toISOString() : null,
        })
        .eq('id', detailsId)
        .select()
      return { data, error }
    } catch (error) {
      return { data: null, error: error as AuthError }
    }
  }
}

// Employee API
export const employeesAPI = {
  // Get all employees for a provider
  getEmployees: async (providerId: string) => {
    try {
      const { data, error } = await supabase
        .from('providers_employees')
        .select('*')
        .eq('provider_id', providerId)
        .order('updated_at', { ascending: false })
      return { data, error }
    } catch (error) {
      return { data: null, error: error as AuthError }
    }
  },

  // Get all employees for a company
  getEmployeesByCompany: async (companyId: string) => {
    try {
      const { data, error } = await supabase
        .from('providers_employees')
        .select('*')
        .eq('company_id', companyId)
        .order('updated_at', { ascending: false })
      return { data, error }
    } catch (error) {
      return { data: null, error: error as AuthError }
    }
  },

  // Get employee by ID
  getEmployee: async (employeeId: number) => {
    try {
      const { data, error } = await supabase
        .from('providers_employees')
        .select('*')
        .eq('id', employeeId)
        .single()
      return { data, error }
    } catch (error) {
      return { data: null, error: error as AuthError }
    }
  },

  // Create new employee
  createEmployee: async (employeeData: {
    provider_id: string
    company_id?: string | null
    name: string
    phone: string
    email?: string
    role: string
    skills?: string[]
    experience_years?: number
    status: 'active' | 'inactive'
    avatar?: string | null
    photo?: string | null
    address?: string | null
  }) => {
    try {
      const { data, error } = await supabase
        .from('providers_employees')
        .insert(employeeData)
        .select()
      return { data, error }
    } catch (error) {
      return { data: null, error: error as AuthError }
    }
  },

  // Update employee
  updateEmployee: async (employeeId: number, updates: {
    name?: string
    phone?: string
    email?: string
    role?: string
    skills?: string[]
    experience_years?: number
    status?: 'active' | 'inactive'
    company_id?: string | null
    avatar?: string | null
    photo?: string | null
    address?: string | null
  }) => {
    try {
      const { data, error } = await supabase
        .from('providers_employees')
        .update(updates)
        .eq('id', employeeId)
        .select()
      return { data, error }
    } catch (error) {
      return { data: null, error: error as AuthError }
    }
  },

  // Delete employee
  deleteEmployee: async (employeeId: number) => {
    try {
      const { error } = await supabase
        .from('providers_employees')
        .delete()
        .eq('id', employeeId)
      return { error }
    } catch (error) {
      return { error: error as AuthError }
    }
  }
}

// Export all APIs
export const api = {
  auth: authAPI,
  profile: profileAPI,
  services: servicesAPI,
  bookings: bookingsAPI,
  earnings: earningsAPI,
  documents: documentsAPI,
  companyVerification: companyVerificationAPI,
  doctorDetails: doctorDetailsAPI,
  doctorDocuments: doctorDocumentsAPI,
  actingDrivers: actingDriversAPI,
  employees: employeesAPI,
  supabase: supabase
}

export default api
