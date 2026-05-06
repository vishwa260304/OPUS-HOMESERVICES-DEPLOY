import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useCart } from "../../context/CartContext";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../../context/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePathname } from "expo-router";

const BAR_HEIGHT = 70;

// ----------------------------- Tab Icon ------------------------------
const TabIcon = ({
  focused,
  iconName,
  label,
  badgeCount = 0,
  gradientColors,
}: {
  focused: boolean;
  iconName: string;
  label: string;
  badgeCount?: number;
  gradientColors: readonly [string, string, ...string[]];
}) => {
  const { colors, isDark } = useTheme();

  // Get the primary gradient color for focused state
  const primaryColor = gradientColors[0];
  const unfocusedColor = isDark ? '#6B7280' : '#9CA3AF';

  return (
    <View style={styles.itemRoot}>
      <View style={styles.iconWrapper}>
        {focused ? (
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientIcon}
          >
            <Ionicons
              name={iconName as any}
              size={24}
              color="#FFFFFF"
            />
          </LinearGradient>
        ) : (
          <Ionicons
            name={iconName as any}
            size={24}
            color={unfocusedColor}
          />
        )}
        {badgeCount > 0 && (
          <View style={[styles.badge, { backgroundColor: '#FF4757', borderColor: '#FFFFFF' }]}>
            <Text style={[styles.badgeText, { color: '#fff' }]}>
              {badgeCount > 99 ? "99+" : badgeCount}
            </Text>
          </View>
        )}
      </View>

      <Text
        style={[styles.label, { color: focused ? primaryColor : unfocusedColor }]}
        allowFontScaling={false}
      >
        {label}
      </Text>
    </View>
  );
};

// ----------------------------- Layout ------------------------------
export default function Layout() {
  const { getTotalItems } = useCart();
  const cartItemCount = getTotalItems();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  // Get gradient colors based on current route and theme
  const getTabBarGradient = (): readonly [string, string, ...string[]] => {
    // Blue gradient for all pages
    return isDark
      ? ['#3B82F6', '#2563EB', '#1D4ED8'] as const // Lighter blue for dark mode
      : ['#1E3A8A', '#1E40AF', '#1D4ED8'] as const; // Original blue for light mode
  };

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarStyle: {
            height: BAR_HEIGHT + insets.bottom,
            backgroundColor: 'transparent',
            borderTopWidth: 0,
            elevation: 0,
            paddingBottom: insets.bottom,
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
          },
          tabBarItemStyle: {
            paddingVertical: 8,
          },
        }}
        tabBar={(props) => (
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: BAR_HEIGHT + insets.bottom }}>
            <View
              style={{
                flex: 1,
                flexDirection: 'row',
                backgroundColor: colors.surface,
                paddingBottom: insets.bottom,
                paddingTop: 8,
                paddingHorizontal: 16,
                borderTopWidth: 1,
                borderTopColor: colors.border,
              }}
            >
              {props.state.routes.map((route, index) => {
                const { options } = props.descriptors[route.key];
                const isFocused = props.state.index === index;

                const onPress = () => {
                  const event = props.navigation.emit({
                    type: 'tabPress',
                    target: route.key,
                    canPreventDefault: true,
                  });

                  if (!isFocused && !event.defaultPrevented) {
                    props.navigation.navigate(route.name, route.params);
                  }
                };

                const getIconName = (routeName: string, focused: boolean) => {
                  switch (routeName) {
                    case 'index':
                      return focused ? 'home' : 'home-outline';
                    case 'orders':
                      return focused ? 'receipt' : 'receipt-outline';
                    case 'cart':
                      return focused ? 'cart' : 'cart-outline';
                    case 'profile':
                      return focused ? 'person' : 'person-outline';
                    default:
                      return 'circle';
                  }
                };

                const getLabel = (routeName: string) => {
                  switch (routeName) {
                    case 'index':
                      return 'Home';
                    case 'orders':
                      return 'Bookings';
                    case 'cart':
                      return 'Cart';
                    case 'profile':
                      return 'Profile';
                    default:
                      return routeName;
                  }
                };

                return (
                  <TouchableOpacity
                    key={route.key}
                    onPress={onPress}
                    style={styles.tabItem}
                  >
                    <TabIcon
                      focused={isFocused}
                      iconName={getIconName(route.name, isFocused)}
                      label={getLabel(route.name)}
                      badgeCount={route.name === 'cart' ? cartItemCount : 0}
                      gradientColors={getTabBarGradient()}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
      >
        <Tabs.Screen name="index" options={{}} />
        <Tabs.Screen name="orders" options={{}} />
        <Tabs.Screen name="cart" options={{}} />
        <Tabs.Screen name="profile" options={{}} />
      </Tabs>
    </View>
  );
}

// ----------------------------- Styles ------------------------------
const styles = StyleSheet.create({
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  itemRoot: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
    marginTop: 6,
  },
  iconWrapper: {
    position: "relative",
  },
  gradientIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    marginHorizontal: -12,
  },
  badge: {
    position: "absolute",
    top: -6,
    right: -10,
    backgroundColor: "#ff4757",
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 3,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#0D0D3B",
  },
  badgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "bold",
  },
});