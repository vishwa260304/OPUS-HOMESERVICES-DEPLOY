import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
  Image,
  ActionSheetIOS,
  Platform,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../context/AuthContext'
import { useVerification } from '../hooks/useVerification'
import { useTheme } from '../context/ThemeContext'
import { supabase, auth as supabaseAuth } from '../lib/supabase'
import { api } from '../lib/api'

interface ProfileData {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  phone: string | null
  created_at: string
  updated_at: string
}

const ProfileScreen: React.FC = () => {
  const navigation = useNavigation()
  const { user, signOut, updateProfile } = useAuth()
  const { themeMode, isDark, setThemeMode, colors } = useTheme()
  const insets = useSafeAreaInsets()
  const { verification } = useVerification()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [fullName, setFullName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [saving, setSaving] = useState(false)
  const [profileImage, setProfileImage] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [showThemeModal, setShowThemeModal] = useState(false)
  const [selectedTheme, setSelectedTheme] = useState<'light' | 'dark' | 'system'>(themeMode)
  const [isDoctor, setIsDoctor] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)

  useEffect(() => {
    if (user) {
      checkIfDoctor().then(() => {
        fetchProfile()
      })
    }
  }, [user, verification])

  const checkIfDoctor = async (): Promise<boolean> => {
    if (!user) {
      setIsDoctor(false)
      return false
    }

    try {
      // Check if user has a Doctor Consultation service
      const { data, error } = await supabase
        .from('providers_services')
        .select('id')
        .eq('user_id', user.id)
        .eq('service_type', 'Doctor Consultation')
        .limit(1)

      const doctorStatus = !!(data && data.length > 0) || verification?.selected_sector === 'Doctor Consultation'
      setIsDoctor(doctorStatus)
      return doctorStatus
    } catch (error) {
      console.error('Error checking doctor status:', error)
      // Fallback to verification check
      const doctorStatus = verification?.selected_sector === 'Doctor Consultation' || false
      setIsDoctor(doctorStatus)
      return doctorStatus
    }
  }

  const fetchProfile = async () => {
    if (!user) return

    try {
      // Check if user is a doctor - use verification first, then isDoctor state
      const isDoctorUser = verification?.selected_sector === 'Doctor Consultation' || isDoctor
      const isActingDriverUser = verification?.selected_sector === 'Acting Drivers'

      if (isDoctorUser) {
        // Fetch from providers_doctor_details for doctors
        const { data, error } = await supabase
          .from('providers_doctor_details')
          .select('id, doctor_name, phone_number, email, avatar_url, created_at, updated_at')
          .eq('user_id', user.id)
          .single()

        if (error) {
          // PGRST116 means no rows found - this is expected for new users
          if (error.code === 'PGRST116') {
            // Doctor details don't exist yet, set empty state
            setProfile(null)
            setFullName('')
            setPhoneNumber('')
            setProfileImage(null)
          } else {
            console.error('Error fetching doctor profile:', error)
            Alert.alert('Error', 'Failed to load profile')
          }
        } else {
          // Map doctor_details fields to profile format
          setProfile({
            id: data.id || user.id,
            email: data.email || user?.email || '',
            full_name: data.doctor_name || null,
            phone: data.phone_number || null,
            avatar_url: data.avatar_url || null,
            created_at: data.created_at || new Date().toISOString(),
            updated_at: data.updated_at || new Date().toISOString(),
          } as ProfileData)
          setFullName(data.doctor_name || '')
          setPhoneNumber(data.phone_number || '')
          setProfileImage(data.avatar_url || null)
        }
      } else if (isActingDriverUser) {
        // Fetch from providers_acting_drivers for acting drivers (including profile_photo)
        const result = await api.actingDrivers.getActingDriverDetails(user.id)

        if (result.error || !result.data) {
          // When no row exists yet, just show empty editable fields
          if ((result.error as any)?.code === 'PGRST116') {
            setProfile(null)
            setFullName('')
            setPhoneNumber('')
            setProfileImage(null)
          } else if (result.error) {
            console.error('Error fetching acting driver profile:', result.error)
            Alert.alert('Error', 'Failed to load profile')
          }
        } else {
          const driver = result.data as any
          // Resolve profile photo URL from profile_photo column (path in profile-images or legacy verification-documents)
          let profilePhotoUrl: string | null = null
          if (driver.profile_photo) {
            if (driver.profile_photo.startsWith('http')) {
              profilePhotoUrl = driver.profile_photo
            } else {
              const bucket = driver.profile_photo.startsWith('verification-documents/')
                ? 'verification-documents'
                : 'profile-images'
              const { data: urlData } = api.supabase.storage
                .from(bucket)
                .getPublicUrl(driver.profile_photo)
              profilePhotoUrl = urlData.publicUrl
            }
          }
          setProfile({
            id: driver.id || user.id,
            email: driver.email || user.email || '',
            full_name: driver.name || null,
            phone: driver.phone || null,
            avatar_url: profilePhotoUrl,
            created_at: driver.created_at || new Date().toISOString(),
            updated_at: driver.updated_at || new Date().toISOString(),
          } as ProfileData)
          setFullName(driver.name || '')
          setPhoneNumber(driver.phone || '')
          setProfileImage(profilePhotoUrl)
        }
      } else {
        // Fetch from providers_profiles for non-doctors / non-acting drivers
        const { data, error } = await supabase
          .from('providers_profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        if (error) {
          // PGRST116 means no rows found - this is expected for new users
          if (error.code === 'PGRST116') {
            // Profile doesn't exist yet, set empty state
            setProfile(null)
            setFullName('')
            setPhoneNumber('')
            setProfileImage(null)
          } else {
            console.error('Error fetching profile:', error)
            Alert.alert('Error', 'Failed to load profile')
          }
        } else {
          setProfile(data)
          setFullName(data.full_name || '')
          setPhoneNumber(data.phone || '')
          setProfileImage(data.avatar_url)
        }
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
      Alert.alert('Error', 'Failed to load profile')
    } finally {
      setLoading(false)
    }
  }


  const uploadImage = async (imageUri: string) => {
    if (!user) return

    setUploadingImage(true)
    try {
      // Create a unique filename
      const fileExt = imageUri.split('.').pop()?.toLowerCase() || 'jpg'
      const fileName = `${user.id}-${Date.now()}.${fileExt}`
      const filePath = `${user.id}/${fileName}`

      // Create FormData for file upload (React Native compatible)
      const formData = new FormData()
      formData.append('file', {
        uri: imageUri,
        type: `image/${fileExt}`,
        name: fileName,
      } as any)

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('profile-images')
        .upload(filePath, formData, {
          contentType: `image/${fileExt}`,
          upsert: false
        })

      if (uploadError) {
        console.error('Storage upload error:', uploadError)
        // If bucket doesn't exist, try to create it
        if (uploadError.message?.includes('not found') || uploadError.message?.includes('does not exist')) {
          console.log('Storage bucket not found, please create "profile-images" bucket in Supabase Storage')
          Alert.alert(
            'Storage Setup Required',
            'Please create a "profile-images" bucket in your Supabase Storage settings to upload profile images.'
          )
          return
        }
        throw uploadError
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('profile-images')
        .getPublicUrl(filePath)

      if (__DEV__) console.log('Upload successful, public URL:', urlData.publicUrl)

      // Update the correct table by user type
      const isDoctorUser = verification?.selected_sector === 'Doctor Consultation' || isDoctor
      const isActingDriverUser = verification?.selected_sector === 'Acting Drivers'

      if (isDoctorUser) {
        const { error: updateError } = await supabase
          .from('providers_doctor_details')
          .update({ avatar_url: urlData.publicUrl })
          .eq('user_id', user.id)

        if (updateError) {
          console.error('Update error:', updateError)
          throw updateError
        }
      } else if (isActingDriverUser) {
        // Store path (within bucket) in profile_photo column
        const driverResult = await api.actingDrivers.getActingDriverDetails(user.id)
        if (driverResult.data && !driverResult.error) {
          const { error: updateError } = await api.actingDrivers.updateActingDriverDetails(driverResult.data.id, {
            profile_photo: filePath,
          })
          if (updateError) {
            console.error('Update error:', updateError)
            throw updateError
          }
        }
      } else {
        const { error: updateError } = await supabase
          .from('providers_profiles')
          .update({ avatar_url: urlData.publicUrl })
          .eq('id', user.id)

        if (updateError) {
          console.error('Update error:', updateError)
          throw updateError
        }
      }

      // Update local state
      setProfileImage(urlData.publicUrl)
      setProfile(prev => prev ? { ...prev, avatar_url: urlData.publicUrl } : null)

      Alert.alert('Success', 'Profile image updated successfully!')
    } catch (error) {
      console.error('Error uploading image:', error)
      Alert.alert('Error', `Failed to upload image: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setUploadingImage(false)
    }
  }

  const showImagePicker = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose from Library'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            pickImage('camera')
          } else if (buttonIndex === 2) {
            pickImage('library')
          }
        }
      )
    } else {
      Alert.alert(
        'Select Profile Image',
        'Choose how you want to add your profile picture',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Take Photo', onPress: () => pickImage('camera') },
          { text: 'Choose from Library', onPress: () => pickImage('library') },
        ]
      )
    }
  }

  const pickImage = async (source: 'camera' | 'library') => {
    try {
      // Request permissions
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (source === 'camera') {
        const cameraPermission = await ImagePicker.requestCameraPermissionsAsync()
        if (!cameraPermission.granted) {
          Alert.alert('Permission Required', 'Camera permission is needed to take photos')
          return
        }
      }

      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Photo library permission is needed to select images')
        return
      }

      // Configure image picker
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true, // Enable base64 for fallback
        exif: false, // Disable EXIF data to reduce file size
        allowsMultipleSelection: false, // Ensure only one image is selected
      }

      let result
      if (source === 'camera') {
        result = await ImagePicker.launchCameraAsync(options)
      } else {
        result = await ImagePicker.launchImageLibraryAsync(options)
      }

      if (!result.canceled && result.assets[0]) {
        if (__DEV__) console.log('Image selected:', result.assets[0].uri)
        await uploadImage(result.assets[0].uri)
      } else {
        if (__DEV__) console.log('Image selection canceled')
      }
    } catch (error) {
      console.error('Error picking image:', error)
      Alert.alert('Error', 'Failed to pick image')
    }
  }

  const handleSave = async () => {
    if (!user) return

    setSaving(true)
    try {
      // Check if user is a doctor to update the correct table
      const isDoctorUser = verification?.selected_sector === 'Doctor Consultation' || isDoctor
      const isActingDriverUser = verification?.selected_sector === 'Acting Drivers'

      if (isDoctorUser) {
        // Update providers_doctor_details table for doctors
        const { error: profileError } = await supabase
          .from('providers_doctor_details')
          .update({
            doctor_name: fullName,
            phone_number: phoneNumber,
          })
          .eq('user_id', user.id)

        if (profileError) {
          Alert.alert('Error', 'Failed to update profile')
          return
        }

        // Update local state
        setProfile(prev => prev ? {
          ...prev,
          full_name: fullName,
          phone: phoneNumber
        } : null)
      } else if (isActingDriverUser) {
        // Update providers_acting_drivers table for acting drivers
        try {
          const detailsId = verification?.id
          if (!detailsId) {
            // Fallback: fetch details by user id
            const result = await api.actingDrivers.getActingDriverDetails(user.id)
            if (result.data && !result.error) {
              await api.actingDrivers.updateActingDriverDetails(result.data.id, {
                name: fullName,
                phone: phoneNumber,
              })
            } else {
              Alert.alert('Error', 'Failed to update profile')
              return
            }
          } else {
            const { error: updateError } = await api.actingDrivers.updateActingDriverDetails(detailsId as string, {
              name: fullName,
              phone: phoneNumber,
            })
            if (updateError) {
              Alert.alert('Error', 'Failed to update profile')
              return
            }
          }
        } catch (err) {
          console.error('Error updating acting driver profile:', err)
          Alert.alert('Error', 'Failed to update profile')
          return
        }

        // Update local state
        setProfile(prev => prev ? {
          ...prev,
          full_name: fullName,
          phone: phoneNumber
        } : null)
      } else {
        // Update providers_profiles table for non-doctors
        const { error: profileError } = await supabase
          .from('providers_profiles')
          .update({
            full_name: fullName,
            phone: phoneNumber,
          })
          .eq('id', user.id)

        if (profileError) {
          Alert.alert('Error', 'Failed to update profile')
          return
        }

        // Update local state
        setProfile(prev => prev ? {
          ...prev,
          full_name: fullName,
          phone: phoneNumber
        } : null)
      }

      setEditing(false)
      Alert.alert('Success', 'Profile updated successfully!')
    } catch (error) {
      console.error('Error updating profile:', error)
      Alert.alert('Error', 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const handleThemeSelection = (theme: 'light' | 'dark' | 'system') => {
    setSelectedTheme(theme)
  }

  const handleSaveTheme = () => {
    setThemeMode(selectedTheme)
    setShowThemeModal(false)
    Alert.alert('Success', 'Theme preference saved!')
  }

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            const { error } = await signOut()
            if (error) {
              Alert.alert('Error', 'Failed to sign out')
            } else {
              // Navigate to Login screen
              (navigation as any).reset({
                index: 0,
                routes: [{ name: 'Login' }],
              })
            }
          }
        }
      ]
    )
  }

  const handleDeleteAccount = async () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to permanently delete your account? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingAccount(true)
            try {
              const { error } = await supabaseAuth.deleteUserAccount()
              if (error) {
                console.error('Delete account error:', error)
                Alert.alert('Error', 'Failed to delete account. Please try again.')
              } else {
                // Delete succeeded, sign out locally
                await signOut()
                ;(navigation as any).reset({
                  index: 0,
                  routes: [{ name: 'Login' }],
                })
              }
            } catch (err) {
              console.error('Delete account exception:', err)
              Alert.alert('Error', 'An unexpected error occurred.')
            } finally {
              setDeletingAccount(false)
            }
          }
        }
      ]
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]} >
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border, paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          onPress={() => {
            const savedSector = verification?.selected_sector;
            // Navigate to the correct dashboard based on user's sector
            // NavigationController will maintain doctor session and prevent unwanted resets
            if (savedSector === 'Medicine Delivery') {
              (navigation as any).navigate('PharmDashboard')
            } else if (savedSector === 'Doctor Consultation') {
              (navigation as any).navigate('DoctorDashboard')
            } else if (savedSector === 'Acting Drivers') {
              (navigation as any).navigate('ActingDriversDashboard')
            } else {
              (navigation as any).navigate('Dashboard')
            }
          }}
          style={[styles.backButton, { backgroundColor: colors.background }]}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Profile</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* User Profile Summary */}
        <View style={[styles.profileCard, { backgroundColor: colors.card }]}>
          {/* Edit Button - Top Right */}
          <View style={styles.editButtonContainer}>
            {!editing && (
              <TouchableOpacity
                onPress={() => setEditing(true)}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#004c8f', '#0c1a5d']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.editButton}
                >
                  <Text style={styles.editButtonText}>Edit</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.profileInfo}>
            <View style={styles.avatarContainer}>
              <TouchableOpacity
                style={styles.avatarTouchable}
                onPress={showImagePicker}
                disabled={uploadingImage}
              >
                <View style={[styles.avatar, { backgroundColor: colors.surface }]}>
                  {profileImage ? (
                    <Image
                      source={{ uri: profileImage }}
                      style={styles.avatarImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <Text style={[styles.avatarText, { color: colors.textSecondary }]}>
                      {profile?.full_name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || '?'}
                    </Text>
                  )}
                </View>
                <View style={styles.cameraIconContainer}>
                  {uploadingImage ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="camera" size={16} color="#fff" />
                  )}
                </View>
              </TouchableOpacity>
            </View>
            <View style={styles.userInfo}>
              {editing ? (
                <TextInput
                  style={[styles.editInput, { color: colors.text, borderBottomColor: colors.primary }]}
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Full Name"
                  placeholderTextColor={colors.textSecondary}
                />
              ) : (
                <Text style={[styles.userName, { color: colors.text }]}>{profile?.full_name || fullName || 'User Name'}</Text>
              )}
              <Text style={[styles.userEmail, { color: colors.textSecondary }]}>{profile?.email || user?.email}</Text>
              {editing ? (
                <TextInput
                  style={[styles.editInput, { color: colors.text, borderBottomColor: colors.primary }]}
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  placeholder="Phone Number"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="phone-pad"
                />
              ) : (
                <Text style={[styles.userPhone, { color: colors.textSecondary }]}>{profile?.phone || 'Phone not set'}</Text>
              )}
              <Text style={[styles.memberSince, { color: colors.textSecondary }]}>
                Member since {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                }) : 'Unknown'}
              </Text>
            </View>
          </View>

          {/* Cancel and Save Buttons - Bottom Right */}
          {editing && (
            <View style={[styles.bottomButtonContainer, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.editButton, styles.cancelButton]}
                onPress={() => {
                  setEditing(false)
                  setFullName(profile?.full_name || '')
                  setPhoneNumber(profile?.phone || '')
                }}
              >
                <Text style={[styles.editButtonText, styles.cancelButtonText]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#004c8f', '#0c1a5d']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.editButton}
                >
                  <Text style={styles.editButtonText}>
                    {saving ? 'Saving...' : 'Save'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </View>


        {/* Quick Access Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Access</Text>
          <View style={styles.quickAccessContainer}>
            {isDoctor ? (
              <TouchableOpacity style={[styles.quickAccessCard, { backgroundColor: colors.card }]} onPress={() => (navigation as any).navigate('CompletedAppointments')}>
                <Ionicons name="calendar-outline" size={24} color={colors.primary} />
                <Text style={[styles.quickAccessText, { color: colors.text }]}>My Appointments</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[styles.quickAccessCard, { backgroundColor: colors.card }]} onPress={() => (navigation as any).navigate('Bookings')}>
                <Ionicons name="bag-outline" size={24} color={colors.primary} />
                <Text style={[styles.quickAccessText, { color: colors.text }]}>
                  {verification?.selected_sector === 'Acting Drivers' ? 'My Bookings' : 'My Orders'}
                </Text>
              </TouchableOpacity>
            )}
            {isDoctor ? (
              <TouchableOpacity style={[styles.quickAccessCard, { backgroundColor: colors.card }]} onPress={() => (navigation as any).navigate('HospitalLocation')}>
                <Ionicons name="medical-outline" size={24} color={colors.primary} />
                <Text style={[styles.quickAccessText, { color: colors.text }]}>Hospital Location</Text>
              </TouchableOpacity>
            ) : verification?.selected_sector === 'Acting Drivers' ? (
              <TouchableOpacity style={[styles.quickAccessCard, { backgroundColor: colors.card }]} onPress={() => (navigation as any).navigate('ActingDriverPersonalDetails')}>
                <Ionicons name="person-outline" size={24} color={colors.primary} />
                <Text style={[styles.quickAccessText, { color: colors.text }]}>Personal Details</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[styles.quickAccessCard, { backgroundColor: colors.card }]} onPress={() => (navigation as any).navigate('CompanyLocations')}>
                <Ionicons name="location-outline" size={24} color={colors.primary} />
                <Text style={[styles.quickAccessText, { color: colors.text }]}>Company Location</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.quickAccessCard, { backgroundColor: colors.card }]} onPress={() => (navigation as any).navigate('Earnings')}>
              <Ionicons name="wallet-outline" size={24} color={colors.primary} />
              <Text style={[styles.quickAccessText, { color: colors.text }]}>Wallet</Text>
            </TouchableOpacity>
          </View>

          {/* Services/Employees for non-doctors and non-acting-drivers, Your Patients for doctors */}
          {isDoctor ? (
            <TouchableOpacity
              style={[styles.menuItem, { backgroundColor: colors.card, marginTop: 16 }]}
              onPress={() => (navigation as any).navigate('MyPatients')}
            >
              <View style={styles.menuItemLeft}>
                <Ionicons name="people-outline" size={20} color={colors.primary} />
                <Text style={[styles.menuItemText, { color: colors.text }]}>Your Patients</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : verification?.selected_sector !== 'Acting Drivers' ? (
            <>
              <TouchableOpacity
                style={[styles.menuItem, { backgroundColor: colors.card, marginTop: 16 }]}
                onPress={() => (navigation as any).navigate('YourServices')}
              >
                <View style={styles.menuItemLeft}>
                  <Ionicons name="briefcase-outline" size={20} color={colors.primary} />
                  <Text style={[styles.menuItemText, { color: colors.text }]}>Your Services</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.menuItem, { backgroundColor: colors.card }]}
                onPress={() => (navigation as any).navigate('YourEmployees')}
              >
                <View style={styles.menuItemLeft}>
                  <Ionicons name="people-outline" size={20} color={colors.primary} />
                  <Text style={[styles.menuItemText, { color: colors.text }]}>Your Employees</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </>
          ) : null}
        </View>

        {/* Main Menu Items */}
        <View style={[styles.section, styles.sectionReducedMargin]}>
          <TouchableOpacity
            style={[styles.menuItem, { backgroundColor: colors.card, marginTop: 16 }]}
            onPress={() => (navigation as any).navigate('BankDetails')}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="card-outline" size={20} color={colors.primary} />
              <Text style={[styles.menuItemText, { color: colors.text }]}>Bank Details</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
          </TouchableOpacity>


          <TouchableOpacity style={[styles.menuItem, { backgroundColor: colors.card }]} onPress={() => (navigation as any).navigate('Support')}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="headset-outline" size={20} color={colors.primary} />
              <Text style={[styles.menuItemText, { color: colors.text }]}>Support & Help</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* My Account Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>My Account</Text>

          {/* Doctor Bio - Only show for doctors */}
          {isDoctor && (
            <TouchableOpacity
              style={[styles.menuItem, { backgroundColor: colors.card }]}
              onPress={() => (navigation as any).navigate('DoctorBio', { onboarding: false })}
              activeOpacity={0.7}
            >
              <View style={styles.menuItemLeft}>
                <Ionicons name="document-text-outline" size={20} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.menuItemText, { color: colors.text }]}>Bio (About Me)</Text>

                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.menuItem, { backgroundColor: colors.card }]}
            onPress={() => (navigation as any).navigate('ProviderReviews')}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="star-outline" size={20} color={colors.primary} />
              <Text style={[styles.menuItemText, { color: colors.text }]}>Ratings & Reviews</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, { backgroundColor: colors.card }]}
            onPress={() => (navigation as any).navigate('Notifications')}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="notifications-outline" size={20} color={colors.primary} />
              <Text style={[styles.menuItemText, { color: colors.text }]}>Notifications Settings</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, { backgroundColor: colors.card }]}
            onPress={() => (navigation as any).navigate('Security')}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="shield-outline" size={20} color={colors.primary} />
              <Text style={[styles.menuItemText, { color: colors.text }]}>Privacy & Security</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.menuItem, { backgroundColor: colors.card }]} onPress={() => setShowThemeModal(true)}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="color-palette-outline" size={20} color={colors.primary} />
              <Text style={[styles.menuItemText, { color: colors.text }]}>Appearance</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={[styles.logoutButton, { backgroundColor: colors.card }]} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={20} color="#dc3545" />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        {/* Delete Account Button */}
        <TouchableOpacity 
          style={[styles.logoutButton, { backgroundColor: colors.card, marginBottom: 40, marginTop: -10 }]} 
          onPress={handleDeleteAccount}
          disabled={deletingAccount}
        >
          {deletingAccount ? (
            <ActivityIndicator size="small" color="#dc3545" />
          ) : (
            <Ionicons name="trash-outline" size={20} color="#dc3545" />
          )}
          <Text style={styles.logoutText}>
            {deletingAccount ? 'Deleting...' : 'Delete Account'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Theme Modal */}
      {showThemeModal && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: colors.card }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Appearance</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowThemeModal(false)}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              <TouchableOpacity
                style={styles.themeOption}
                onPress={() => handleThemeSelection('dark')}
              >
                <Text style={[styles.themeOptionText, { color: colors.text }]}>Dark</Text>
                <View style={styles.radioButton}>
                  <View style={[styles.radioButtonOuter, { borderColor: colors.border }]}>
                    {selectedTheme === 'dark' && <View style={[styles.radioButtonInner, { backgroundColor: colors.primary }]} />}
                  </View>
                </View>
              </TouchableOpacity>

              <View style={[styles.separator, { backgroundColor: colors.border }]} />

              <TouchableOpacity
                style={styles.themeOption}
                onPress={() => handleThemeSelection('light')}
              >
                <Text style={[styles.themeOptionText, { color: colors.text }]}>Light</Text>
                <View style={styles.radioButton}>
                  <View style={[styles.radioButtonOuter, { borderColor: colors.border }]}>
                    {selectedTheme === 'light' && <View style={[styles.radioButtonInner, { backgroundColor: colors.primary }]} />}
                  </View>
                </View>
              </TouchableOpacity>

              <View style={[styles.separator, { backgroundColor: colors.border }]} />

              <TouchableOpacity
                style={styles.themeOption}
                onPress={() => handleThemeSelection('system')}
              >
                <Text style={[styles.themeOptionText, { color: colors.text }]}>Use device theme</Text>
                <View style={styles.radioButton}>
                  <View style={[styles.radioButtonOuter, { borderColor: colors.border }]}>
                    {selectedTheme === 'system' && <View style={[styles.radioButtonInner, { backgroundColor: colors.primary }]} />}
                  </View>
                </View>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={[styles.saveButton, { backgroundColor: colors.primary }]} onPress={handleSaveTheme}>
              <Text style={styles.saveButtonText}>Save preference</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 0,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 25,
    fontWeight: 'bold',
    flex: 1,
    color: '#333',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40, // Same width as back button to balance the layout
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  editButtonContainer: {
    position: 'absolute',
    top: 20,
    right: 10,
    zIndex: 1,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  bottomButtonContainer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingBottom: 4,
  },
  editButton: {
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 60,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButtonText: {
    color: '#fff',
    fontSize: 14,
    marginTop: -2,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: '#6c757d',
  },
  cancelButtonText: {
    color: '#fff',
  },
  editInput: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#004c8f',
    paddingVertical: 4,
  },
  scrollContainer: {
    flex: 1,
  },
  profileCard: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatarContainer: {
    marginRight: 16,
  },
  avatarTouchable: {
    position: 'relative',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#666',
  },
  cameraIconContainer: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#004c8f',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#000',
    marginBottom: 2,
  },
  userPhone: {
    fontSize: 14,
    color: '#000',
  },
  memberSince: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 20,
  },
  sectionReducedMargin: {
    marginTop: -20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    marginLeft: 4,
  },
  quickAccessContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickAccessCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  quickAccessText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginTop: 8,
    textAlign: 'center',
  },
  menuItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuItemText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
    fontWeight: '600',
  },
  menuItemSubtext: {
    fontSize: 12,
    marginLeft: 12,
    marginTop: 2,
  },
  logoutButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  logoutText: {
    fontSize: 16,
    color: '#dc3545',
    marginLeft: 12,
    fontWeight: '500',
  },
  // Modal styles
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  themeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  themeOptionText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '400',
  },
  separator: {
    height: 1,
    backgroundColor: '#E5E5E5',
    marginLeft: 0,
  },
  radioButton: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#8B5CF6',
  },
  saveButton: {
    backgroundColor: '#000',
    marginHorizontal: 20,
    marginBottom: 20,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Banner cards
  bannerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  bannerCard: {
    flex: 1,
    height: 84,
    borderRadius: 16,
    padding: 14,
    justifyContent: 'center'
  },
  bannerTitle: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 14,
  },
  bannerSub: {
    color: '#e8eeff',
    marginTop: 6,
    fontSize: 12,
  },

})

export default ProfileScreen
