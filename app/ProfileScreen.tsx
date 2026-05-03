import { FontAwesome5, Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React, { useEffect, useLayoutEffect, useState } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  TextInput,
  Alert,
  Platform,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import Animated, { Easing, FadeInUp, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { hapticButtonPress } from "../utils/haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from '../context/ThemeContext';
import AppearanceModal from '../components/AppearanceModal';
import Toast from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { UserProfileDetailsApi } from '../lib/userProfileDetails';
import { supabase } from '../lib/supabase';

export default function ProfileScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const [appearanceVisible, setAppearanceVisible] = useState(false);

  // 🔹 State for profile data
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [language, setLanguage] = useState<string>("English");
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [isAuthed, setIsAuthed] = useState(false);
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'success' | 'error' | 'info' }>({
    visible: false,
    message: '',
    type: 'success',
  });

  // 🔹 Edit mode (default: view)
  const [isEditing, setIsEditing] = useState(false);
  const [backupProfile, setBackupProfile] = useState<
    { name: string; email: string; phone: string; avatarUri: string | null } | null
  >(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  // 🔹 Load saved profile
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const [savedLang, savedAvatar] = await Promise.all([
          AsyncStorage.getItem("app_language"),
          AsyncStorage.getItem("user_avatar_uri"),
        ]);
        const authLogged = user?.id ? "true" : "false";

        if (authLogged === "true" && user?.id) {
          try {
            // ✅ Load from Supabase first
            const details = await UserProfileDetailsApi.get(user.id);
            if (details) {
              setName(details.full_name ?? "");
              setEmail(details.email ?? user?.email ?? "");
              // Use profile phone, fallback to auth phone if not set
              setPhone(details.phone ?? user?.phone ?? "");
              setBackupProfile({
                name: details.full_name ?? "",
                email: details.email ?? user?.email ?? "",
                phone: details.phone ?? user?.phone ?? "",
                avatarUri: savedAvatar ?? null,
              });
              setIsAuthed(true);
            } else {
              // New user - no profile yet, use auth data
              setName("");
              setEmail(user?.email ?? "");
              setPhone(user?.phone ?? "");
              setBackupProfile({
                name: "",
                email: user?.email ?? "",
                phone: user?.phone ?? "",
                avatarUri: savedAvatar ?? null,
              });
              setIsAuthed(true);
            }
          } catch (err) {
            console.warn("Supabase fetch failed, falling back to local", err);
            const storedProfile = await AsyncStorage.getItem("user_profile");
            if (storedProfile) {
              const parsed = JSON.parse(storedProfile);
              setName(parsed.name ?? "");
              setEmail(parsed.email ?? user?.email ?? "");
              // Use stored phone, fallback to auth phone
              setPhone(parsed.phone ?? user?.phone ?? "");
              setBackupProfile({
                name: parsed.name ?? "",
                email: parsed.email ?? user?.email ?? "",
                phone: parsed.phone ?? user?.phone ?? "",
                avatarUri: savedAvatar ?? null,
              });
              setIsAuthed(true);
            } else {
              // No stored profile, use auth data
              setName("");
              setEmail(user?.email ?? "");
              setPhone(user?.phone ?? "");
              setBackupProfile({
                name: "",
                email: user?.email ?? "",
                phone: user?.phone ?? "",
                avatarUri: savedAvatar ?? null,
              });
              setIsAuthed(true);
            }
          }
        } else {
          setName("");
          setEmail("");
          setPhone("");
          setBackupProfile(null);
          setIsAuthed(false);
        }

        if (savedLang) setLanguage(savedLang);
        if (savedAvatar) setAvatarUri(savedAvatar);
      } catch (error) {
        console.warn("Failed to load profile", error);
      }
    };
    loadProfile();
  }, [user?.id]);

  // 🔹 Validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phoneRegex = /^[0-9]{10}$/;
  const validName = name.trim().length >= 2;
  const validEmail = emailRegex.test(email.trim());
  const validPhone = phoneRegex.test(phone.trim());
  const isFormValid = validName && validEmail && validPhone;

  // 🔹 Save Profile
  const handleSave = async () => {
    if (!isFormValid) return;
    try {
      const profileToSave = {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
      };

      // ✅ Save to Supabase
      if (user?.id) {
        await UserProfileDetailsApi.upsert(user.id, {
          full_name: profileToSave.name,
          email: profileToSave.email,
          phone: profileToSave.phone,
        } as any);
      }

      // Backup to AsyncStorage
      await AsyncStorage.setItem("user_profile", JSON.stringify(profileToSave));

      setBackupProfile({
        name: profileToSave.name,
        email: profileToSave.email,
        phone: profileToSave.phone,
        avatarUri,
      });

      setToast({ visible: true, message: 'Profile saved', type: 'success' });
      hapticButtonPress();
      setIsEditing(false);
    } catch (error) {
      console.warn("Failed to save profile", error);
    }
  };

  const handleCancel = async () => {
    if (backupProfile) {
      setName(backupProfile.name);
      setEmail(backupProfile.email);
      setPhone(backupProfile.phone);
      setAvatarUri(backupProfile.avatarUri);
    }
    setIsEditing(false);
  };

  // 🔹 Avatar handlers (same as your code, unchanged)
  const ensureMediaPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission required", "Media library permission is needed.");
      return false;
    }
    return true;
  };

  const ensureCameraPermissions = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission required", "Camera permission is needed.");
      return false;
    }
    return true;
  };

  const saveAvatar = async (uri: string) => {
    try {
      const baseDir = (((FileSystem as any).documentDirectory) || ((FileSystem as any).cacheDirectory) || '') as string;
      const dest = `${baseDir}avatar-${Date.now()}.jpg`;
      await FileSystem.copyAsync({ from: uri, to: dest });
      setAvatarUri(dest);
      await AsyncStorage.setItem("user_avatar_uri", dest);
    } catch (e) {
      console.warn("Failed to save avatar", e);
    }
  };

  const pickFromGallery = async () => {
    const ok = await ensureMediaPermissions();
    if (!ok) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      await saveAvatar(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const ok = await ensureCameraPermissions();
    if (!ok) return;
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      await saveAvatar(result.assets[0].uri);
    }
  };

  // 🔹 Logout
  const handleLogout = async () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          try {
            await supabase.auth.signOut();
            await AsyncStorage.removeItem("user_profile");
            await AsyncStorage.removeItem("user_avatar_uri");
            setName("");
            setEmail("");
            setPhone("");
            setLanguage("English");
            setAvatarUri(null);
            setIsAuthed(false);
            router.replace("/subcategories/login" as any);
          } catch { }
        },
      },
    ]);
  };

  const handleLogin = () => {
    router.replace("/subcategories/login" as any);
  };

  // 🔹 Rest of your UI code remains UNCHANGED...
  // (your ScrollView, header, tiles, edit form, etc.)


  useEffect(() => {
    const sub = navigation.addListener("focus", async () => {
      // Refresh language and profile when returning
      try {
        const [savedLang, storedProfile] = await Promise.all([
          AsyncStorage.getItem("app_language"),
          AsyncStorage.getItem("user_profile"),
        ]);
        const authLogged = user?.id ? "true" : "false";

        if (savedLang) setLanguage(savedLang);

        try {
          const parsed = storedProfile ? JSON.parse(storedProfile) : {};
          const hasPhone = ((parsed.phone ?? "") + "").trim().length > 0;
          setIsAuthed(authLogged === "true" && (!!user?.id || hasPhone));
        } catch { }
      } catch { }
    });
    return sub as any;
  }, [navigation]);


  const initials = name
    .trim()
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s: string) => s[0]?.toUpperCase())
    .join("");

  // animations
  const headerOpacity = useSharedValue(0);
  const cardOpacity = useSharedValue(0);
  const cardTranslate = useSharedValue(12);
  const scrollY = useSharedValue(0);

  useEffect(() => {
    headerOpacity.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) });
    cardOpacity.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) });
    cardTranslate.value = withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) });
  }, []);

  const headerStyle = useAnimatedStyle(() => ({ opacity: headerOpacity.value }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ translateY: cardTranslate.value - scrollY.value * 0.15 }],
  }));

  // Main horizontal quick access items
  const mainTiles = [
    { key: "orders", label: "My Orders", icon: <Ionicons name="file-tray-outline" size={24} color={colors.text as any} />, onPress: () => router.push("/(tabs)/orders" as any) },
    {
      key: "listings", label: "My Listings", icon: <Ionicons name="home-outline" size={24} color={colors.text as any} />, onPress: () => {
        if (!isAuthed) {
          Alert.alert('Login required', 'Please log in to view your listings.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Login', onPress: () => router.push('/subcategories/login' as any) },
          ]);
          return;
        }
        router.push("/profile/my-listings" as any);
      }
    },
    { key: "addresses", label: "Saved Addresses", icon: <Ionicons name="location-outline" size={24} color={colors.text as any} />, onPress: () => router.push("/profile/addresses" as any) },
    { key: "wallet", label: "Wallet", icon: <Ionicons name="wallet-outline" size={24} color={colors.text as any} />, onPress: () => router.push("/profile/opus-wallet" as any) },
  ];

  // Additional tiles for vertical layout
  const gradientBlue = ["#004c8f", "#0c1a5d"] as const;
  const additionalTiles = [
    { key: "payments", label: "Payment Methods", icon: <MaterialIcons name="payment" size={18} color={gradientBlue[0]} />, onPress: () => router.push("/profile/payment-modes" as any) },
    { key: "pro", label: "Pro Membership", icon: <Ionicons name="diamond-outline" size={18} color={gradientBlue[0]} />, onPress: () => router.push("/profile/pro-membership" as any) },
    { key: "support", label: "Support & Help", icon: <Ionicons name="headset-outline" size={18} color={gradientBlue[0]} />, onPress: () => router.push("/profile/support" as any) },
  ];

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* 🔹 Top Bar (brand + bell) */}
      <Animated.View style={[styles.topBar, headerStyle]}>


        <Text style={[styles.headerTitle, { color: colors.text }]} pointerEvents="none">Profile</Text>

        {isEditing ? (
          <TouchableOpacity
            onPress={handleSave}
            disabled={!isFormValid}
            style={[styles.headerSaveBtn, !isFormValid && { opacity: 0.6 }]}
          >
            <Text style={styles.headerSaveText}>Save</Text>
          </TouchableOpacity>
        ) : null}
      </Animated.View>

      {/* 🔹 Main Container */}
      <View style={styles.floatingContainer}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} disabled={Platform.OS === 'web'}>
            <ScrollView
              contentContainerStyle={{ paddingBottom: 120 }}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              onScroll={({ nativeEvent }) => {
                scrollY.value = nativeEvent.contentOffset.y;
              }}
              scrollEventThrottle={16}
            >


              {/* 🔹 Identity Card (toggle edit) */}
              <Animated.View style={[
                styles.userCard,
                cardStyle,
                { backgroundColor: colors.card, shadowColor: colors.shadow, borderWidth: 1, borderColor: colors.border }
              ]}>
                <View style={styles.avatarContainer}>
                  {avatarUri ? (
                    <Image source={{ uri: avatarUri }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarPlaceholder]}>
                      <Text style={styles.avatarInitials}>{initials || "?"}</Text>
                    </View>
                  )}
                  {/* Removed blue edit overlay icon over avatar */}
                </View>

                <View style={{ flex: 1, marginLeft: 12 }}>
                  {isEditing ? (
                    <>
                      <TextInput
                        style={[styles.input, !validName && styles.inputError, { color: colors.text, borderColor: colors.border }]}
                        value={name}
                        onChangeText={setName}
                        placeholder="Full name"
                        placeholderTextColor={isDark ? '#ffffff' : '#6b7280'}
                      />
                      {!validName ? <Text style={styles.errorText}>Please enter at least 2 characters</Text> : null}

                      <TextInput
                        style={[styles.input, !validEmail && styles.inputError, { color: colors.text, borderColor: colors.border }]}
                        value={email}
                        onChangeText={setEmail}
                        placeholder="Email"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        placeholderTextColor={isDark ? '#ffffff' : '#6b7280'}
                      />
                      {!validEmail ? <Text style={styles.errorText}>Enter a valid email</Text> : null}

                      <TextInput
                        style={[styles.input, !validPhone && styles.inputError, { color: colors.text, borderColor: colors.border }]}
                        value={phone}
                        onChangeText={setPhone}
                        placeholder="Phone"
                        keyboardType="phone-pad"
                        placeholderTextColor={isDark ? '#ffffff' : '#6b7280'}
                      />
                      {!validPhone ? <Text style={styles.errorText}>Enter a 10-digit phone number</Text> : null}



                      {/* Avatar actions when editing */}
                      <View style={styles.avatarActions}>
                        <TouchableOpacity style={styles.smallBtn} onPress={takePhoto}>
                          <Text style={styles.smallBtnText}>Camera</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.smallBtn} onPress={pickFromGallery}>
                          <Text style={styles.smallBtnText}>Gallery</Text>
                        </TouchableOpacity>
                        {avatarUri ? (
                          <TouchableOpacity
                            style={[styles.smallBtn, { backgroundColor: '#ff4d4f' }]}
                            onPress={async () => {
                              try {
                                const path = avatarUri;
                                setAvatarUri(null);
                                await AsyncStorage.removeItem('user_avatar_uri');
                                if (path) {
                                  try { await FileSystem.deleteAsync(path, { idempotent: true }); } catch { }
                                }
                                setToast({ visible: true, message: 'Photo removed', type: 'info' });
                              } catch { }
                            }}
                          >
                            <Text style={styles.smallBtnText}>Remove</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </>
                  ) : (
                    <>
                      <Text style={[styles.userName, { textAlign: 'left', color: colors.text }]}>{name || "Add your name"}</Text>
                      {!!email && <Text style={[styles.userEmail, { textAlign: 'left', color: colors.textSecondary }]}>{email}</Text>}
                      {!!phone && <Text style={[styles.userPhone, { textAlign: 'left', color: colors.textSecondary }]}>{phone}</Text>}

                    </>
                  )}
                </View>

                {!isEditing && isAuthed ? (
                  <LinearGradient
                    colors={["#004c8f", "#0c1a5d"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.editPill}
                  >
                    <TouchableOpacity onPress={() => setIsEditing(true)} activeOpacity={0.9}>
                      <Text style={styles.editPillText}>Edit</Text>
                    </TouchableOpacity>
                  </LinearGradient>
                ) : null}
              </Animated.View>

              {/* 🔹 Quick Access - Main Horizontal Cards */}
              <Text style={styles.sectionTitle}>Quick Access</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalCards}
              >
                {mainTiles.map((t, idx) => (
                  <Animated.View key={t.key} entering={FadeInUp.delay(idx * 60)}>
                    <TouchableOpacity style={[
                      styles.horizontalCard,
                      { backgroundColor: 'transparent' }
                    ]} onPress={t.onPress}>
                      <View style={[styles.iconTile, { backgroundColor: colors.card, borderColor: isDark ? '#fff3' : (colors.border as any) }]}>
                        {t.icon}
                      </View>
                      <Text style={[styles.cardText, { color: colors.text }]}>{t.label}</Text>
                    </TouchableOpacity>
                  </Animated.View>
                ))}
              </ScrollView>

              {/* 🔹 Additional Quick Access Items */}
              <View style={styles.quickList}>
                {additionalTiles.map((t, idx) => (
                  <Animated.View key={t.key} entering={FadeInUp.delay((idx + 3) * 60)}>
                    <TouchableOpacity style={[
                      styles.quickItem,
                      { backgroundColor: colors.card, shadowColor: colors.shadow, borderWidth: 1, borderColor: colors.border }
                    ]} onPress={() => {
                      if (!isAuthed && (t.key === 'payments' || t.key === 'wallet')) {
                        Alert.alert('Login required', 'Please log in to access this feature.', [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Login', onPress: () => router.push('/subcategories/login' as any) },
                        ]);
                        return;
                      }
                      t.onPress();
                    }}>
                      <LinearGradient colors={["#eff6ff", "#e0f2fe"]} style={styles.quickIcon}>{t.icon}</LinearGradient>
                      <Text style={[styles.quickText, { color: colors.text }]}>{t.label}</Text>
                      <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
                    </TouchableOpacity>
                  </Animated.View>
                ))}
              </View>

              {/* 🔹 Bottom Settings List */}
              <Text style={[styles.sectionTitle, { marginTop: 8, color: colors.text }]}>My Account</Text>
              {[
                {
                  label: "Ratings & Reviews", onPress: () => {
                    if (!isAuthed) {
                      Alert.alert('Login required', 'Please log in to access this feature.', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Login', onPress: () => router.push('/subcategories/login' as any) },
                      ]);
                      return;
                    }
                    router.push('/profile/ratings' as any);
                  }
                },
                { label: "Notifications Settings", onPress: () => router.push("/profile/notifications" as any) },
                { label: "Privacy & Security", onPress: () => router.push("/profile/privacy-security" as any) },
                { label: "Appearance", onPress: () => setAppearanceVisible(true) },
              ].map((item, index) => (
                <Animated.View key={index} entering={FadeInUp.delay(80 * index)}>
                  <TouchableOpacity style={[
                    styles.listItem,
                    { backgroundColor: colors.card, shadowColor: colors.shadow, borderWidth: 1, borderColor: colors.border }
                  ]} onPress={item.onPress}>
                    <Text style={[styles.listLabel, { color: colors.text }]}>{item.label}</Text>
                    <View style={styles.listRight}>
                      <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              ))}

              {/* 🔹 Auth Action */}
              {isAuthed ? (
                <TouchableOpacity style={[styles.logoutButton, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={handleLogout}>
                  <Ionicons name="log-out-outline" size={20} color="red" />
                  <Text style={styles.logoutText}>Logout</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={handleLogin} activeOpacity={0.8} style={styles.loginPillContainer}>
                  <LinearGradient
                    colors={["#004c8f", "#0c1a5d"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.loginPill}
                  >
                    <Ionicons name="log-in-outline" size={20} color="#ffffff" />
                    <Text style={styles.loginPillText}>Login</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </ScrollView>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>

        {/* 🔹 Sticky bottom Save/Cancel */}
        {isEditing ? (
          <View style={styles.editToolbar}>
            <TouchableOpacity style={[styles.toolbarBtn, styles.toolbarCancel]} onPress={handleCancel}>
              <Text style={[styles.toolbarBtnText, styles.toolbarCancelText]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toolbarBtn, styles.toolbarSave, !isFormValid && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={!isFormValid}
            >
              <Text style={[styles.toolbarBtnText, styles.toolbarSaveText]}>Save</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
      <AppearanceModal visible={appearanceVisible} onClose={() => setAppearanceVisible(false)} />
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast((current) => ({ ...current, visible: false }))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: {
    paddingTop: 70,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: "transparent",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#000",
    position: 'absolute',
    left: 30,
    right: 0,
    textAlign: 'left',
    top: 50
  },
  themeToggleButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  floatingContainer: {
    flex: 1,
    backgroundColor: "transparent",
  },
  headerCard: {
    marginHorizontal: 16,
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  headerCardTitle: { fontSize: 20, fontWeight: "bold", color: "#111", textAlign: "left" },
  userCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    padding: 16,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  avatarContainer: { width: 72, height: 72, borderRadius: 36, overflow: "hidden", backgroundColor: "#e7e7e7" },
  avatar: { width: 72, height: 72, borderRadius: 36 },
  avatarPlaceholder: { alignItems: "center", justifyContent: "center" },
  avatarInitials: { fontWeight: "800", color: "#555" },
  avatarEditBtn: { position: 'absolute', right: 0, bottom: 0, backgroundColor: '#004c8f', width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  avatarActions: { flexDirection: "row", gap: 8, marginTop: 8 },
  smallBtn: { backgroundColor: "#004c8f", paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8 },
  smallBtnText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  input: {
    borderBottomWidth: 1,
    borderColor: "#e5e5e5",
    marginBottom: 8,
    paddingVertical: 6,
    fontSize: 14,
  },
  inputError: {
    borderColor: "#d9534f",
  },
  errorText: { color: "#d9534f", fontSize: 12, marginTop: -4, marginBottom: 6 },
  tilesGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginHorizontal: 16, marginTop: 8 },
  tile: { backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  tileLeft: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", marginRight: 8 },
  tileText: { flex: 1, color: "#111", fontWeight: "600", marginLeft: 8 },
  horizontalCards: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginTop: 8,
    gap: 12,
  },
  horizontalCard: {
    width: 85,
    backgroundColor: "transparent",
    borderRadius: 16,
    paddingVertical: 0,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    height: 100,
  },
  iconTile: {
    width: 72,
    height: 68,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1,
  },
  cardIconContainer: {
    marginBottom: 8,
    alignItems: "center",
    justifyContent: "center",
    height: 32,
  },
  cardText: {
    color: "#000",
    fontWeight: "600",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 14,
    flexWrap: "wrap",
  },
  quickList: { marginHorizontal: 16, marginTop: 8 },
  quickItem: { backgroundColor: "#fff", borderRadius: 14, paddingVertical: 14, paddingHorizontal: 14, marginBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  quickIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center", marginRight: 12 },
  quickText: { flex: 1, color: "#111", fontWeight: "600" },
  sectionTitle: { marginTop: 12, marginHorizontal: 16, color: '#000', fontWeight: '700' },
  listItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: "#fff",
    borderRadius: 14,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  listLabel: { fontSize: 15, color: "#111", fontWeight: '600' },
  listRight: { flexDirection: "row", alignItems: "center" },
  listRightText: { color: "#6b7280", marginRight: 5 },
  logoutButton: {
    backgroundColor: "#fff",
    margin: 16,
    padding: 14,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#f0f0f0",
  },
  logoutText: { color: "red", marginLeft: 5, fontWeight: "bold" },
  editPill: { position: "absolute", right: 10, top: 10, borderRadius: 10, paddingVertical: 6, paddingHorizontal: 14 },
  editPillText: { color: "#fff", fontWeight: "700" },
  userName: { fontSize: 20, fontWeight: "bold", color: "#111" },
  userEmail: { fontSize: 14, color: "#555", marginTop: 2 },
  userPhone: { fontSize: 14, color: "#555", marginTop: 2 },
  loginPillContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  loginPill: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 140,
    flexDirection: 'row',
    gap: 8,
  },
  loginPillText: { color: '#ffffff', fontSize: 16, fontWeight: '700', marginLeft: 6 },
  editToolbar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#fff",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderColor: "#eee",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -3 },
    elevation: 8,
    zIndex: 100,
  },
  headerSaveBtn: {
    backgroundColor: "#004c8f",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  headerSaveText: {
    color: "#fff",
    fontWeight: "700",
  },
  toolbarBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
  },
  toolbarBtnText: { fontWeight: "700" },
  toolbarCancel: { backgroundColor: "#f6f6f7" },
  toolbarCancelText: { color: "#111", fontWeight: "700" },
  toolbarSave: { backgroundColor: "#004c8f" },
  toolbarSaveText: { color: "#fff", fontWeight: "700" },
});
