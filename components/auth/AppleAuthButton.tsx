import * as AppleAuthentication from 'expo-apple-authentication';

type AppleAuthButtonProps = {
  accessibilityLabel?: string;
  colorScheme?: 'light' | 'dark' | null;
  mode: 'signIn' | 'signUp';
  onPress: () => void;
  style?: any;
};

const {
  AppleAuthenticationButton,
  AppleAuthenticationButtonStyle,
  AppleAuthenticationButtonType,
} = AppleAuthentication;

export default function AppleAuthButton({
  accessibilityLabel,
  colorScheme,
  mode,
  onPress,
  style,
}: AppleAuthButtonProps) {
  return (
    <AppleAuthenticationButton
      accessibilityLabel={accessibilityLabel}
      buttonStyle={colorScheme === 'dark' ? AppleAuthenticationButtonStyle.WHITE : AppleAuthenticationButtonStyle.BLACK}
      buttonType={mode === 'signUp' ? AppleAuthenticationButtonType.SIGN_UP : AppleAuthenticationButtonType.SIGN_IN}
      cornerRadius={8}
      onPress={onPress}
      style={style}
    />
  );
}
