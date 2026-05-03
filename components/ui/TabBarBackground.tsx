// components/ui/TabBarBackground.tsx
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function useBottomTabOverflow() {
  const insets = useSafeAreaInsets();
  return insets.bottom;
}
