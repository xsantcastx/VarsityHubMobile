import { AccessibilityProps, ActivityIndicator, ViewStyle } from 'react-native';
import Button from './button';

interface PrimaryButtonProps extends Pick<AccessibilityProps, 'accessibilityLabel'> {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  testID?: string;
}

export default function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  style,
  accessibilityLabel,
  testID,
}: PrimaryButtonProps) {
  return (
    <Button
      onPress={onPress}
      disabled={disabled || loading}
      size="lg"
      style={{ width: '100%', maxWidth: 400, alignSelf: 'center', ...style }}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      {loading ? <ActivityIndicator color="white" /> : label}
    </Button>
  );
}
