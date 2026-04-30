import React from 'react';
import { FontAwesome5 } from '@expo/vector-icons';

export function IconSymbol({
  name,
  size = 24,
  color,
}: {
  name: React.ComponentProps<typeof FontAwesome5>['name'];
  size?: number;
  color: string;
}) {
  return <FontAwesome5 name={name} size={size} color={color} />;
}
