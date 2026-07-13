import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconSymbolName =
  | 'house.fill'
  | 'plus.circle.fill'
  | 'square.grid.2x2.fill'
  | 'paperplane.fill'
  | 'magnifyingglass'
  | 'star.fill'
  | 'person.crop.circle'
  | 'video.fill'
  | 'bubble.left.and.bubble.right.fill'
  | 'chevron.left.forwardslash.chevron.right'
  | 'chevron.right';

const MAPPING: Record<IconSymbolName, ComponentProps<typeof MaterialIcons>['name']> = {
  'house.fill': 'home',
  'plus.circle.fill': 'add-circle',
  'square.grid.2x2.fill': 'grid-view',
  'paperplane.fill': 'send',
  magnifyingglass: 'search',
  'star.fill': 'star',
  'person.crop.circle': 'person',
  'video.fill': 'videocam',
  'bubble.left.and.bubble.right.fill': 'chat-bubble',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
};

// iOS release builds were rendering fallback question-marks for SymbolView tab icons.
// Use the same MaterialIcons mapping as the cross-platform fallback so tabs render
// consistently across release/dev and across platforms.
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
