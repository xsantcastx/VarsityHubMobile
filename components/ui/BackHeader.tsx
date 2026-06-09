import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { safeGoBack } from '@/utils/navigation';

interface BackHeaderProps {
  title?: string;
  onBack?: () => void;
  rightElement?: React.ReactNode;
  backgroundColor?: string;
  textColor?: string;
  borderColor?: string;
  showDivider?: boolean;
}

export function BackHeader({
  title,
  onBack,
  rightElement,
  backgroundColor,
  textColor,
  borderColor,
  showDivider = true,
}: BackHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const resolvedBackgroundColor = backgroundColor ?? theme.background;
  const resolvedTextColor = textColor ?? theme.text;
  const resolvedBorderColor = borderColor ?? theme.border;

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      safeGoBack(router);
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top,
          backgroundColor: resolvedBackgroundColor,
          borderBottomWidth: showDivider ? 1 : 0,
          borderBottomColor: resolvedBorderColor,
        },
      ]}
    >
      <View style={styles.content}>
        <Pressable
          style={styles.backButton}
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <MaterialIcons name="chevron-left" size={24} color={resolvedTextColor} />
        </Pressable>

        {title && (
          <Text style={[styles.title, { color: resolvedTextColor }]} numberOfLines={1}>
            {title}
          </Text>
        )}

        <View style={styles.rightContainer}>{rightElement}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingHorizontal: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -12,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginHorizontal: 16,
  },
  rightContainer: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
