import { Alert, Linking } from 'react-native';
import { captureException } from '@/utils/sentry';

type OpenExternalUrlOptions = {
  errorTitle?: string;
  errorMessage?: string;
  context?: string;
};

export async function openExternalUrl(
  url: string,
  options: OpenExternalUrlOptions = {}
): Promise<boolean> {
  const {
    errorTitle = 'Link Unavailable',
    errorMessage = 'Unable to open this link right now. Please try again.',
    context = 'open_external_url',
  } = options;

  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      throw new Error('URL is not supported by this device');
    }
    await Linking.openURL(url);
    return true;
  } catch (error) {
    captureException(error instanceof Error ? error : new Error('Failed to open external URL'), {
      tags: { context },
      url,
    });
    Alert.alert(errorTitle, errorMessage);
    return false;
  }
}
