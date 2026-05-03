import * as Haptics from 'expo-haptics';

export const hapticFeedback = {
  // Light impact for subtle interactions
  light: () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  },

  // Medium impact for button presses
  medium: () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  },

  // Heavy impact for important actions
  heavy: () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  },

  // Success feedback for completed actions
  success: () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  },

  // Warning feedback for important notices
  warning: () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  },

  // Error feedback for failed actions
  error: () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  },

  // Selection feedback for picker changes
  selection: () => {
    Haptics.selectionAsync();
  },
};

// Convenience functions for common use cases
export const hapticButtonPress = () => hapticFeedback.medium();
export const hapticSuccess = () => hapticFeedback.success();
export const hapticError = () => hapticFeedback.error();
export const hapticSelection = () => hapticFeedback.selection();
