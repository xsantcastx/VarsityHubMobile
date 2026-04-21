import { Alert } from 'react-native';
import {
  ICLOUD_ERROR_MESSAGE,
  ICLOUD_ERROR_TITLE,
  isICloudError,
} from '@/utils/isICloudError';

type UploadErrorAlertOptions = {
  fallbackTitle?: string;
  fallbackMessage?: string;
  logTag?: string;
};

export function showUploadErrorAlert(
  error: any,
  {
    fallbackTitle = 'Upload Failed',
    fallbackMessage = 'Please try again.',
    logTag = 'upload',
  }: UploadErrorAlertOptions = {}
) {
  if (isICloudError(error)) {
    Alert.alert(ICLOUD_ERROR_TITLE, ICLOUD_ERROR_MESSAGE);
    return;
  }

  const rawMessage = String(error?.message || error || '').trim();
  const status = error?.status;
  const isNetwork = /network|fetch|failed to fetch|typeerror/i.test(rawMessage);
  const isTimeout = /timeout|timed out|aborted/i.test(rawMessage);
  const isAuth = status === 401 || /unauthoriz/i.test(rawMessage);
  const isServer =
    (typeof status === 'number' && status >= 500) || /HTTP 5\d\d/i.test(rawMessage);
  const isSize = /too large|size|413/i.test(rawMessage);

  if (isAuth) {
    Alert.alert('Sign-in Required', 'Please sign out and sign back in, then try again.');
  } else if (isTimeout) {
    Alert.alert(
      'Upload Timed Out',
      'The upload took too long. Check your connection and try again.'
    );
  } else if (isNetwork) {
    Alert.alert(
      'Network Error',
      'Unable to reach the server. Check your connection and try again.'
    );
  } else if (isServer) {
    Alert.alert(
      'Server Error',
      rawMessage || 'The upload service is temporarily unavailable. Please try again in a minute.'
    );
  } else if (isSize) {
    Alert.alert(
      'File Too Large',
      rawMessage || 'Files must be under the allowed size limit. Please try a smaller upload.'
    );
  } else if (rawMessage) {
    Alert.alert('Upload Failed', rawMessage);
  } else {
    Alert.alert(fallbackTitle, fallbackMessage);
  }

  if (__DEV__) {
    console.warn(`[${logTag}] Upload error:`, { message: rawMessage, status, error });
  }
}
