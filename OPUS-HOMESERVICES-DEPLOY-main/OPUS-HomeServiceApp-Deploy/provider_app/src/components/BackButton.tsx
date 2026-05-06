import React from 'react';
import { TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { moderateScale } from '../utils/responsive';

type Props = {
  color?: string;
  size?: number;
  style?: ViewStyle | ViewStyle[];
  onPress?: () => void;
};

const BackButton: React.FC<Props> = ({ color = '#ffffff', size = moderateScale(22), style, onPress }) => {
  const navigation = useNavigation();
  return (
    <TouchableOpacity
      onPress={onPress || (() => navigation.goBack())}
      activeOpacity={0.7}
      style={[styles.btn, style]}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
    >
      <Ionicons name="chevron-back" size={size} color={color} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  btn: { paddingVertical: moderateScale(4), paddingHorizontal: moderateScale(4) },
});

export default BackButton;


