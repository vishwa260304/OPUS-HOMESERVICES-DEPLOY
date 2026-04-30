import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, Animated, Easing, GestureResponderEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from './ThemedText';
import { useTheme } from '../context/ThemeContext';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function AppearanceModal({ visible, onClose }: Props) {
  const { isDark, themeMode, setThemeMode, colors } = useTheme() as any;
  const translateY = useRef(new Animated.Value(0)).current;
  const backdrop = useRef(new Animated.Value(0)).current;
  const indicatorScales = useRef({
    light: new Animated.Value(0),
    dark: new Animated.Value(0),
    system: new Animated.Value(0),
  }).current as Record<'light' | 'dark' | 'system', Animated.Value>;
  const [pendingMode, setPendingMode] = useState<'light' | 'dark' | 'system'>(themeMode);

  useEffect(() => {
    if (visible) {
      translateY.setValue(1);
      backdrop.setValue(0);
      Animated.parallel([
        Animated.timing(translateY, { toValue: 0, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(backdrop, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: 1, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(backdrop, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  // Reset pending selection when opening
  useEffect(() => {
    if (visible) setPendingMode(themeMode);
  }, [visible, themeMode]);

  const sheetStyle = {
    transform: [{ translateY: translateY.interpolate({ inputRange: [0, 1], outputRange: [0, 50] }) }],
  };

  const onPick = (mode: 'light' | 'dark' | 'system') => {
    setPendingMode(mode);
  };

  // Animate radio indicator when selection changes
  useEffect(() => {
    (['light', 'dark', 'system'] as const).forEach((key) => {
      Animated.timing(indicatorScales[key], {
        toValue: pendingMode === key ? 1 : 0,
        duration: 180,
        useNativeDriver: true,
      }).start();
    });
  }, [pendingMode]);

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, { opacity: backdrop }]}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
      </Animated.View>

      <Animated.View style={[styles.sheet, sheetStyle, { backgroundColor: colors?.surface, borderTopColor: colors?.border }]}> 
        <View style={styles.headerRow}>
          <ThemedText type="subtitle" style={styles.header}>Appearance</ThemedText>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color={isDark ? '#ECEDEE' : '#11181C'} />
          </TouchableOpacity>
        </View>

        <View style={styles.optionList}>
          {([
            { key: 'dark', label: 'Dark', value: 'dark' },
            { key: 'light', label: 'Light', value: 'light' },
            { key: 'system', label: 'Use device theme', value: 'system' },
          ] as const).map((opt) => {
            const selected = pendingMode === opt.value;
            return (
              <TouchableOpacity key={opt.key} style={[styles.option, { borderColor: colors?.border }]} onPress={() => onPick(opt.value)}>
                <ThemedText style={styles.optionLabel}>{opt.label}</ThemedText>
                <View style={[styles.radio, { borderColor: selected ? '#6c5ce7' : colors?.border }]}
                >
                  <Animated.View
                    style={[styles.radioDot, {
                      transform: [{ scale: indicatorScales[opt.value] }],
                      backgroundColor: '#6c5ce7',
                    }]}
                  />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: '#111' }]}
          onPress={(e) => {
            const { pageX, pageY } = e.nativeEvent;
            setThemeMode(pendingMode, { x: pageX, y: pageY });
            onClose();
          }}
        >
          <ThemedText style={styles.saveText}>Save preference</ThemedText>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)'
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 28,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  header: {
    marginBottom: 0,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionList: {
    marginTop: 6,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    borderBottomWidth: 1,
  },
  optionLabel: {
    fontSize: 16,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  saveBtn: {
    marginTop: 18,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});

