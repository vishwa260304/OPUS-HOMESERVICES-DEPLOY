import React, { useLayoutEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Platform } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useNavigation } from "expo-router";

const headerGradient = ['#004c8f', '#0c1a5d'] as const;

export default function ProMembershipScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false } as any);
  }, [navigation]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Pro Membership</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <Text style={[styles.title, { color: colors.text }]}>Fixit Pro</Text>
        <Text style={[styles.desc, { color: colors.textSecondary }]}>Get priority support, exclusive offers, and faster bookings.</Text>
        <TouchableOpacity activeOpacity={0.9}>
          <LinearGradient colors={[...headerGradient]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.btn}>
            <Text style={styles.btnText}>Upgrade - ₹299/year</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Full-screen overlay: real blur on iOS; themed semi-opaque on Android */}
      {Platform.OS === 'ios' ? (
        <BlurView
          tint={isDark ? 'dark' : 'light'}
          intensity={80}
          style={[StyleSheet.absoluteFillObject, styles.blurOverlay]}
        />
      ) : (
        <View
          style={[
            StyleSheet.absoluteFillObject,
            styles.blurOverlay,
            {
              backgroundColor: isDark
                ? 'rgba(18, 18, 18, 0.97)'
                : 'rgba(255, 255, 255, 0.95)',
            },
          ]}
        />
      )}

      {/* Coming soon pill — same gradient as header */}
      <View style={styles.comingSoonOverlay}>
        <LinearGradient
          colors={[...headerGradient]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.comingSoonPill}
        >
          
          <Text style={styles.comingSoonHeadline}>Pro Membership coming soon!</Text>
        </LinearGradient>
      </View>

      {/* Back chevron above overlay so it stays tappable */}
      <TouchableOpacity
        onPress={() => router.back()}
        style={styles.overlayBackButton}
        activeOpacity={0.7}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : '#000'} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  card: { margin: 16, padding: 20, borderRadius: 12 },
  title: { fontSize: 20, fontWeight: "800", marginBottom: 8 },
  desc: { marginBottom: 16 },
  btn: { paddingVertical: 12, borderRadius: 10, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700" },
  blurOverlay: { zIndex: 1 },
  comingSoonOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  comingSoonPill: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    paddingHorizontal: 28,
    borderRadius: 18,
    minWidth: 260,
    maxWidth: 320,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 7,
  },
  comingSoonSubline: {
    fontSize: 14,
    color: "rgba(255,255,255,0.95)",
    fontWeight: "600",
    marginBottom: 6,
    letterSpacing: 0.25,
  },
  comingSoonHeadline: {
    fontSize: 23,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.45,
    textAlign: "center",
  },
  overlayBackButton: {
    position: "absolute",
    top: 50,
    left: 16,
    zIndex: 3,
    padding: 4,
  },
});