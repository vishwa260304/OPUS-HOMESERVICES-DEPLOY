import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { moderateScale } from '../utils/responsive';

type Props = {
  left?: React.ReactNode;
  right?: React.ReactNode;
  title?: string;
  subtitle?: string;
  bottom?: React.ReactNode; // slot under the header for chips, etc
  gradientColors?: readonly string[];
  minHeight?: number;
};

const GradientHeader: React.FC<Props> = ({ left, right, title, subtitle, bottom, gradientColors, minHeight }) => {
  const { colors } = useTheme();
  return (
    <LinearGradient
      // cast to tuple type expected by LinearGradient
      colors={
        (gradientColors && gradientColors.length > 0
          ? (gradientColors as unknown as [string, string, ...string[]])
          : [colors.primary, colors.primary])
      }
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={[styles.container, minHeight ? { height: minHeight, paddingTop: moderateScale(28) } : undefined]}
    >
      <View style={styles.topRow} pointerEvents="box-none">
        <View pointerEvents="box-none">{left}</View>
        <View pointerEvents="box-none">{right}</View>
      </View>
      {!!title && <Text style={[styles.title, { color: '#ffffff' }]}>{title}</Text>}
      {!!subtitle && <Text style={[styles.subtitle, { color: '#c7d2fe' }]}>{subtitle}</Text>}
      {bottom}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { 
    marginHorizontal: 0,
    marginTop: 0,
    paddingTop: 0,
    paddingHorizontal: 20,
    paddingBottom: 6,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    overflow: 'visible',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 },
  title: { fontSize: 18, fontWeight: '800', marginTop: 6 },
  subtitle: { marginTop: 2 },
});

export default GradientHeader;


