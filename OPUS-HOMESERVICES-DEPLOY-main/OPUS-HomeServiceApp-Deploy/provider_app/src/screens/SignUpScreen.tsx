import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Modal,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Linking } from 'react-native'
import { useAuth } from '../context/AuthContext'
import { useNavigation } from '@react-navigation/native'
import { useScreenTracking } from '../hooks/useScreenTracking'
import { trackEvent } from '../services/analytics'

type AppModalType = 'error' | 'success' | 'warning' | 'info'

type AppModalState = {
  visible: boolean
  type: AppModalType
  title: string
  message?: string
  errors?: string[]
  primaryLabel?: string
  onPrimary?: () => void
  secondaryLabel?: string
  onSecondary?: () => void
}

type AppModalProps = AppModalState & {
  onDismiss: () => void
}

const MODAL_TYPE_CONFIG: Record<AppModalType, { color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  error: { color: '#dc3545', icon: 'close-circle' },
  success: { color: '#28a745', icon: 'checkmark-circle' },
  warning: { color: '#f59e0b', icon: 'alert-circle' },
  info: { color: '#007bff', icon: 'information-circle' },
}

const AppModal: React.FC<AppModalProps> = ({
  visible,
  type,
  title,
  message,
  errors,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  onDismiss,
}) => {
  const { color, icon } = MODAL_TYPE_CONFIG[type]
  const handlePrimary = () => {
    if (onPrimary) {
      onPrimary()
      return
    }
    onDismiss()
  }

  const handleSecondary = () => {
    if (onSecondary) {
      onSecondary()
      return
    }
    onDismiss()
  }

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Ionicons name={icon} size={44} color={color} style={styles.modalIcon} />
          <Text style={styles.modalTitle}>{title}</Text>
          {message ? <Text style={styles.modalMessage}>{message}</Text> : null}
          {errors?.length ? (
            <View style={styles.modalErrors}>
              {errors.map((error, index) => (
                <View key={`${error}-${index}`} style={styles.modalErrorRow}>
                  <Ionicons name="close-circle" size={18} color="#dc3545" style={styles.modalErrorIcon} />
                  <Text style={styles.modalErrorText}>{error}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {secondaryLabel ? (
            <View style={styles.modalButtonRow}>
              <TouchableOpacity style={styles.modalSecondaryButton} onPress={handleSecondary}>
                <Text style={styles.modalSecondaryButtonText}>{secondaryLabel}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalPrimaryButton, { backgroundColor: color }]} onPress={handlePrimary}>
                <Text style={styles.modalPrimaryButtonText}>{primaryLabel || 'OK'}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={[styles.modalPrimaryButton, styles.modalPrimaryButtonFull, { backgroundColor: color }]} onPress={handlePrimary}>
              <Text style={styles.modalPrimaryButtonText}>{primaryLabel || 'OK'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  )
}

const SignUpScreen: React.FC = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [fullName, setFullName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [loading, setLoading] = useState(false)
  const [modal, setModal] = useState<AppModalState>({ visible: false, type: 'info', title: '' })
  const { signUp } = useAuth()
  const navigation = useNavigation()

  // Track screen view
  useScreenTracking('Sign Up Screen')

  const showModal = (config: Omit<AppModalState, 'visible'>) =>
    setModal({ ...config, visible: true })

  const hideModal = () =>
    setModal(prev => ({ ...prev, visible: false }))

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const getPasswordErrors = (password: string): string[] => {
    const errors: string[] = []
    if (password.length < 8) errors.push('At least 8 characters')
    if (!/[A-Z]/.test(password)) errors.push('At least one uppercase letter (A-Z)')
    if (!/[a-z]/.test(password)) errors.push('At least one lowercase letter (a-z)')
    if (!/[0-9]/.test(password)) errors.push('At least one number (0-9)')
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) errors.push('At least one special character (!@#$...)')
    return errors
  }

  const validatePhoneNumber = (phone: string) => {
    const phoneRegex = /^[6-9]\d{9}$/
    return phoneRegex.test(phone)
  }

  const showPasswordErrorModal = (errors: string[]) => showModal({
    type: 'error',
    title: 'Password Too Weak',
    message: 'Your password must meet all of the following requirements:',
    errors,
    primaryLabel: 'Got it',
    onPrimary: hideModal,
  })

  const handleSignUp = async () => {
    if (!email || !password || !confirmPassword || !fullName || !phoneNumber) {
      showModal({
        type: 'error',
        title: 'Error',
        message: 'Please fill in all fields',
        primaryLabel: 'OK',
        onPrimary: hideModal,
      })
      trackEvent('Sign Up Attempt Failed', { reason: 'missing_fields' })
      return
    }

    if (!validateEmail(email)) {
      showModal({
        type: 'error',
        title: 'Error',
        message: 'Please enter a valid email address',
        primaryLabel: 'OK',
        onPrimary: hideModal,
      })
      trackEvent('Sign Up Attempt Failed', { reason: 'invalid_email' })
      return
    }

    if (!validatePhoneNumber(phoneNumber)) {
      showModal({
        type: 'error',
        title: 'Error',
        message: 'Please enter a valid 10-digit phone number',
        primaryLabel: 'OK',
        onPrimary: hideModal,
      })
      trackEvent('Sign Up Attempt Failed', { reason: 'invalid_phone' })
      return
    }

    const passwordErrors = getPasswordErrors(password)
    if (passwordErrors.length > 0) {
      showPasswordErrorModal(passwordErrors)
      trackEvent('Sign Up Attempt Failed', { reason: 'weak_password' })
      return
    }

    if (password !== confirmPassword) {
      showModal({
        type: 'error',
        title: 'Error',
        message: 'Passwords do not match',
        primaryLabel: 'OK',
        onPrimary: hideModal,
      })
      trackEvent('Sign Up Attempt Failed', { reason: 'password_mismatch' })
      return
    }

    setLoading(true)
    trackEvent('Sign Up Attempt Started', {
      email: email.toLowerCase(),
      has_full_name: !!fullName,
      has_phone: !!phoneNumber,
    })

    try {
      const { data, error } = await signUp(email, password, fullName, phoneNumber)

      if (error) {
        // Log detailed error for debugging
        console.error('Sign up error details:', {
          message: error.message,
          status: (error as any).status,
          code: (error as any).code,
          name: error.name,
        })

        // Show user-friendly error message
        let errorMessage = error.message || 'An error occurred during sign up'

        // Provide more specific error messages based on error type
        if (error.message?.includes('User already registered')) {
          errorMessage = 'This email is already registered. Please sign in instead.'
        } else if (error.message?.includes('Password')) {
          errorMessage = 'Password does not meet requirements. Please try again.'
        } else if (error.message?.includes('Email')) {
          errorMessage = 'Invalid email address. Please check and try again.'
        } else if ((error as any).status === 500 || error.message?.includes('Database')) {
          errorMessage = 'A database error occurred. Please try again in a moment. If the problem persists, contact support.'
        }

        showModal({
          type: 'error',
          title: 'Sign Up Failed',
          message: errorMessage,
          primaryLabel: 'OK',
          onPrimary: hideModal,
        })
        trackEvent('Sign Up Failed', {
          error_message: error.message,
          error_code: (error as any).status || 'unknown',
        })
      } else {
        // Track successful signup
        trackEvent('Sign Up Successful', {
          user_id: data?.user?.id ?? null, // FIXED: Bug 1
          email: email.toLowerCase(),
          has_session: !!data?.session,
        })

        // Check if user session was created
        if (data?.session && data?.user) {
          // User is automatically logged in (email confirmation disabled)
          // Profile will be created automatically via AuthContext on SIGNED_IN event
          // Navigate directly to ServiceSectorSelection
          setTimeout(() => {
            (navigation as any).reset({
              index: 0,
              routes: [{ name: 'ServiceSectorSelection' }],
            });
          }, 500); // Small delay to ensure auth state is updated
        } else if (data?.user) {
          // User created but email confirmation is required
          // Profile will be created automatically after email verification (on SIGNED_IN)
          showModal({
            type: 'success',
            title: 'Account Created',
            message: 'Your account has been created successfully! Please check your email to verify your account. After verification, please Sign In.',
            primaryLabel: 'OK',
            onPrimary: () => {
              hideModal()
              navigation.navigate('Login' as never)
            },
          })
        }
      }
    } catch (error) {
      showModal({
        type: 'error',
        title: 'Error',
        message: 'An unexpected error occurred',
        primaryLabel: 'OK',
        onPrimary: hideModal,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.formContainer}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join as a service provider</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Enter your full name"
              autoCapitalize="words"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Phone Number</Text>
            <View style={styles.phoneInputContainer}>
              <View style={styles.countryCodeContainer}>
                <Text style={styles.countryCode}>+91</Text>
              </View>
              <TextInput
                style={styles.phoneInput}
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                placeholder="Enter your phone number"
                keyboardType="phone-pad"
                maxLength={10}
              />
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                value={password}
                onChangeText={setPassword}
                placeholder="Create a password (min 8 characters)"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={24} color="#666" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Confirm Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm your password"
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                <Ionicons name={showConfirmPassword ? "eye-off-outline" : "eye-outline"} size={24} color="#666" />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.signupButton, loading && styles.signupButtonDisabled]}
            onPress={handleSignUp}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.signupButtonText}>Create Account</Text>
            )}
          </TouchableOpacity>

          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login' as never)}>
              <Text style={styles.loginLink}>Sign In</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.termsText}>
            By creating an account, you agree to our{' '}
            <Text style={styles.linkText} onPress={() => Linking.openURL('https://www.thefixit.in/partner-terms-and-conditions')}>
              Terms of Service
            </Text>
            {' '}and{' '}
            <Text style={styles.linkText} onPress={() => Linking.openURL('https://www.thefixit.in/partner-privacy-policy')}>
              Privacy Policy
            </Text>
          </Text>


        </View>
      </ScrollView>
      <AppModal {...modal} onDismiss={hideModal} />
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  formContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f8f9fa',
  },
  passwordContainer: {
    position: 'relative',
    justifyContent: 'center',
  },
  passwordInput: {
    paddingRight: 50,
  },
  eyeIcon: {
    position: 'absolute',
    right: 12,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countryCodeContainer: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#ddd',
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRightWidth: 0,
  },
  countryCode: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  phoneInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f8f9fa',
  },
  signupButton: {
    backgroundColor: '#28a745',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  signupButtonDisabled: {
    backgroundColor: '#ccc',
  },
  signupButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  loginText: {
    fontSize: 16,
    color: '#666',
  },
  loginLink: {
    fontSize: 16,
    color: '#007bff',
    fontWeight: '600',
  },
  termsText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    lineHeight: 16,
  },
  linkText: {
    color: '#007bff',
    textDecorationLine: 'underline',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalIcon: {
    alignSelf: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#222',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 14,
    color: '#555',
    lineHeight: 22,
    textAlign: 'center',
  },
  modalErrors: {
    marginTop: 16,
  },
  modalErrorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  modalErrorIcon: {
    marginRight: 10,
    marginTop: 2,
  },
  modalErrorText: {
    flex: 1,
    fontSize: 14,
    color: '#555',
    lineHeight: 22,
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  modalPrimaryButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalPrimaryButtonFull: {
    width: '100%',
    marginTop: 24,
  },
  modalPrimaryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  modalSecondaryButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  modalSecondaryButtonText: {
    color: '#374151',
    fontSize: 15,
    fontWeight: '700',
  },

})

export default SignUpScreen
