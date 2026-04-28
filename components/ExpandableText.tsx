import React from 'react';
import {
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
  type NativeSyntheticEvent,
  type StyleProp,
  type TextLayoutEventData,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

interface ExpandableTextProps {
  text: string | null | undefined;
  maxLines?: number;
  style?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  expandStyle?: StyleProp<TextStyle>;
  moreLabel?: string;
  lessLabel?: string;
}

export function ExpandableText({
  text,
  maxLines = 3,
  style,
  containerStyle,
  expandStyle,
  moreLabel = '⬇️ Read more',
  lessLabel = '⬆️ Show less',
}: ExpandableTextProps) {
  const [expanded, setExpanded] = React.useState(false);
  const [canExpand, setCanExpand] = React.useState(false);

  React.useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  React.useEffect(() => {
    setExpanded(false);
    setCanExpand(false);
  }, [text, maxLines]);

  const handleTextLayout = React.useCallback(
    (event: NativeSyntheticEvent<TextLayoutEventData>) => {
      if (expanded || canExpand) return;
      const lineCount = event.nativeEvent.lines?.length ?? 0;
      if (lineCount > maxLines) {
        setCanExpand(true);
      }
    },
    [canExpand, expanded, maxLines]
  );

  const toggleExpanded = React.useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(prev => !prev);
  }, []);

  if (!text) return null;

  return (
    <View style={containerStyle}>
      <Text
        style={style}
        numberOfLines={expanded ? undefined : maxLines}
        onTextLayout={handleTextLayout}
      >
        {text}
      </Text>
      {canExpand ? (
        <Pressable
          onPress={toggleExpanded}
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'Collapse text' : 'Expand text'}
          hitSlop={8}
          android_ripple={{ color: 'rgba(37, 99, 235, 0.12)' }}
          style={({ pressed }) => [styles.toggleButton, pressed && styles.toggleButtonPressed]}
        >
          <Text style={[styles.toggle, expandStyle]}>{expanded ? lessLabel : moreLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  toggleButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  toggleButtonPressed: {
    opacity: 0.85,
  },
  toggle: {
    fontSize: 13,
    fontWeight: '700',
  },
});

export default ExpandableText;
