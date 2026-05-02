import React, { useMemo, useState } from 'react'
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
import { useNavigation } from '@react-navigation/native'
import { LinearGradient } from 'expo-linear-gradient'
import { useScreenTracking } from '../hooks/useScreenTracking'
import { analytics, trackEvent } from '../services/analytics'
import { useAuth } from '../context/AuthContext'
import * as WebBrowser from 'expo-web-browser'
import * as AppleAuthentication from 'expo-apple-authentication'
import { makeRedirectUri } from 'expo-auth-session'
import { useIdTokenAuthRequest } from 'expo-auth-session/providers/google'

WebBrowser.maybeCompleteAuthSession()

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

const LoginScreen: React.FC = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [modal, setModal] = useState<AppModalState>({ visible: false, type: 'info', title: '' })
  const navigation = useNavigation()
  const { signIn, signInWithGoogle, signInWithApple } = useAuth()
  const googleConfigured = Boolean(
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ||
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID
  )

  const googleConfig = useMemo(() => ({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? 'missing-ios-client-id',
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? 'missing-android-client-id',
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? 'missing-web-client-id',
    scopes: ['openid', 'profile', 'email'],
    selectAccount: true,
    redirectUri: makeRedirectUri({
      scheme: 'fixitapp',
      path: 'oauthredirect',
    }),
  }), [])

  const [googleRequest, , promptGoogleAsync] = useIdTokenAuthRequest(googleConfig)

  // Track screen view
  useScreenTracking('Login Screen')

  const showModal = (config: Omit<AppModalState, 'visible'>) =>
    setModal({ ...config, visible: true })

  const hideModal = () =>
    setModal(prev => ({ ...prev, visible: false }))

  const generateNonce = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`

  const handleGoogleLogin = async () => {
    if (!googleConfigured || !googleRequest) {
      showModal({
        type: 'warning',
        title: 'Google Sign-In Not Ready',
        message: 'Please add the Google client IDs to .env and restart the app.',
        primaryLabel: 'OK',
        onPrimary: hideModal,
      })
      return
    }

    setLoading(true)
    try {
      const result = await promptGoogleAsync()
      if (result.type !== 'success') {
        return
      }

      const idToken = result.authentication?.idToken ?? result.params?.id_token
      const accessToken = result.authentication?.accessToken ?? result.params?.access_token

      if (!idToken) {
        throw new Error('Google sign-in did not return an ID token.')
      }

      const { error } = await signInWithGoogle({
        token: idToken,
        accessToken,
      })

      if (error) {
        showModal({
          type: 'error',
          title: 'Google Login Failed',
          message: error.message || 'Unable to sign in with Google.',
          primaryLabel: 'OK',
          onPrimary: hideModal,
        })
        return
      }
    } catch (error: any) {
      showModal({
        type: 'error',
        title: 'Google Login Failed',
        message: error?.message || 'Unable to sign in with Google.',
        primaryLabel: 'OK',
        onPrimary: hideModal,
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAppleLogin = async () => {
    if (Platform.OS !== 'ios') {
      showModal({
        type: 'warning',
        title: 'Apple Sign-In',
        message: 'Apple sign-in is only available on iPhone and iPad.',
        primaryLabel: 'OK',
        onPrimary: hideModal,
      })
      return
    }

    const available = await AppleAuthentication.isAvailableAsync()
    if (!available) {
      showModal({
        type: 'warning',
        title: 'Apple Sign-In Not Available',
        message: 'Apple sign-in is not available on this device.',
        primaryLabel: 'OK',
        onPrimary: hideModal,
      })
      return
    }

    const nonce = generateNonce()

    setLoading(true)
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce,
      })

      if (!credential.identityToken) {
        throw new Error('Apple sign-in did not return an identity token.')
      }

      const { error } = await signInWithApple({
        token: credential.identityToken,
        nonce,
      })

      if (error) {
        showModal({
          type: 'error',
          title: 'Apple Login Failed',
          message: error.message || 'Unable to sign in with Apple.',
          primaryLabel: 'OK',
          onPrimary: hideModal,
        })
        return
      }
    } catch (error: any) {
      if (error?.code === 'ERR_REQUEST_CANCELED') {
        return
      }

      showModal({
        type: 'error',
        title: 'Apple Login Failed',
        message: error?.message || 'Unable to sign in with Apple.',
        primaryLabel: 'OK',
        onPrimary: hideModal,
      })
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = async () => {
    if (!email || !password) {
      showModal({
        type: 'error',
        title: 'Error',
        message: 'Please fill in all fields',
        primaryLabel: 'OK',
        onPrimary: hideModal,
      })
      trackEvent('Login Attempt Failed', {
        reason: 'missing_fields',
        email_provided: !!email,
      })
      return
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      showModal({
        type: 'error',
        title: 'Invalid Email',
        message: 'Please enter a valid email address (e.g. name@gmail.com)',
        primaryLabel: 'OK',
        onPrimary: hideModal,
      })
      trackEvent('Login Attempt Failed', {
        reason: 'invalid_email_format',
        email_provided: true,
      })
      return
    }

    setLoading(true)
    trackEvent('Login Attempt Started', {
      email: email.toLowerCase(), // Track email for user identification
    })

    try {
      const { data, error } = await signIn(email, password)

      console.log('[LOGIN RESULT]', { userId: data?.user?.id, error }) // FIXED: Bug 2

      if (error) {
        trackEvent('Login Failed', {
          error_message: error.message,
          error_code: error.status,
          user_id: null,
        })

        showModal({
          type: 'error',
          title: 'Login Failed',
          message: error.message || 'Invalid email or password',
          primaryLabel: 'OK',
          onPrimary: hideModal,
        })

        return
      }

      if (data?.user) {
        analytics.identify(data.user.id, { email: data.user.email ?? email.toLowerCase() })
        console.log('// FIXED: Issue 1 - Mixpanel identify runs before Login Successful')

        trackEvent('Login Successful', {
          email: data.user.email,
          user_id: data.user.id,
        })
        // FIXED: Bug 1
        // Navigation will be handled by the auth state change in AppNavigator
        // The AppNavigator will automatically redirect based on verification status
      }
    } catch (error: any) {
      showModal({
        type: 'error',
        title: 'Error',
        message: 'An unexpected error occurred',
        primaryLabel: 'OK',
        onPrimary: hideModal,
      })
      trackEvent('Login Error', {
        error_message: error?.message || 'Unknown error',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = () => {
    if (!email) {
      showModal({
        type: 'error',
        title: 'Error',
        message: 'Please enter your email first',
        primaryLabel: 'OK',
        onPrimary: hideModal,
      })
      return
    }

    // Navigate to forgot password screen or show modal
    showModal({
      type: 'info',
      title: 'Reset Password',
      message: 'A password reset link will be sent to your email',
      primaryLabel: 'Send',
      onPrimary: () => {
        showModal({
          type: 'success',
          title: 'Success',
          message: 'Password reset email sent!',
          primaryLabel: 'OK',
          onPrimary: hideModal,
        })
      },
      secondaryLabel: 'Cancel',
      onSecondary: hideModal,
    })
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <LinearGradient
        colors={['#004c8f', '#0c1a5d']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroBackdrop}
      />
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.brandHeader}>
          <View style={styles.brandMark}>
            <Ionicons name="construct" size={24} color="#ffffff" />
          </View>
          <Text style={styles.brandTitle}>FIXIT Partner</Text>
          <Text style={styles.brandSubtitle}>Manage jobs, payouts, and provider support in one place.</Text>
        </View>

        <View style={styles.formContainer}>
          <Text style={styles.title}>Welcome</Text>
          <Text style={styles.subtitle}>Sign in to your Fixit service provider account</Text>

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
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
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

          <TouchableOpacity
            style={styles.forgotPassword}
            onPress={handleForgotPassword}
          >
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginButtonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or continue with</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={[styles.socialButton, styles.googleButton, (!googleConfigured || loading) && styles.socialButtonDisabled]}
            onPress={handleGoogleLogin}
            activeOpacity={0.85}
            disabled={!googleConfigured || loading}
          >
            <View style={styles.googleMark}>
              <Text style={styles.googleMarkText}>G</Text>
            </View>
            <Text style={styles.socialButtonText}>Continue with Google</Text>
          </TouchableOpacity>

          {Platform.OS === 'ios' ? (
            <View style={[styles.appleButtonWrap, loading && styles.socialButtonDisabled]}>
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={10}
                style={styles.appleNativeButton}
                onPress={loading ? () => undefined : handleAppleLogin}
              />
            </View>
          ) : null}

          <View style={styles.signupContainer}>
            <Text style={styles.signupText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('SignUp' as never)}>
              <Text style={styles.signupLink}>Sign Up</Text>
            </TouchableOpacity>
          </View>


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
  heroBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 280,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    paddingTop: 64,
    paddingBottom: 36,
  },
  brandHeader: {
    alignItems: 'center',
    marginBottom: 22,
  },
  brandMark: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  brandTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0,
  },
  brandSubtitle: {
    color: '#dbeafe',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 300,
  },
  formContainer: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#eef2f7',
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
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  forgotPasswordText: {
    color: '#007bff',
    fontSize: 14,
  },
  loginButton: {
    backgroundColor: '#007bff',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  loginButtonDisabled: {
    backgroundColor: '#ccc',
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#d1d5db',
  },
  dividerText: {
    marginHorizontal: 12,
    color: '#6b7280',
    fontSize: 13,
    fontWeight: '600',
  },
  socialButton: {
    minHeight: 52,
    borderRadius: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 12,
    borderWidth: 1,
  },
  socialButtonDisabled: {
    opacity: 0.6,
  },
  googleButton: {
    backgroundColor: '#ffffff',
    borderColor: '#d1d5db',
  },
  googleMark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleMarkText: {
    color: '#4285F4',
    fontSize: 16,
    fontWeight: '800',
  },
  appleButtonWrap: {
    height: 52,
    marginBottom: 12,
  },
  appleNativeButton: {
    width: '100%',
    height: 52,
  },
  socialButtonText: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '700',
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signupText: {
    fontSize: 16,
    color: '#666',
  },
  signupLink: {
    fontSize: 16,
    color: '#007bff',
    fontWeight: '600',
  },
  verifiedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d4edda',
    borderColor: '#c3e6cb',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    marginBottom: 8,
  },
  verifiedIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  verifiedTextContainer: {
    flex: 1,
  },
  verifiedTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#155724',
    marginBottom: 4,
  },
  verifiedMessage: {
    fontSize: 14,
    color: '#155724',
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    fontSize: 24,
    color: '#155724',
    fontWeight: 'bold',
  },
  Button: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: 'center',
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

export default LoginScreen
