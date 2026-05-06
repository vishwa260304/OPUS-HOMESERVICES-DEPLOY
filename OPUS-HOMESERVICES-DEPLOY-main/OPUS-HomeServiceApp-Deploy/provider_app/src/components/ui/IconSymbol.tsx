// components/ui/IconSymbol.tsx
import React from 'react';
import { FontAwesome5 } from '@expo/vector-icons';

export function IconSymbol({
  name,
  color,
  size = 24,
}: {
  name: React.ComponentProps<typeof FontAwesome5>['name'];
  color: string;
  size?: number;
}) {
  return <FontAwesome5 name={name} size={size} color={color} />;
}
