import { Alert } from 'react-native';

export function promptForSignIn(
  onConfirm: () => void,
  options?: {
    title?: string;
    message?: string;
  }
) {
  Alert.alert(
    options?.title || 'Sign In Required',
    options?.message || 'Please sign in to continue.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign In', onPress: onConfirm },
    ]
  );
}
