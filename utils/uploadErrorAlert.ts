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
  const code = String(error?.data?.code || error?.code || '');
  const isNetwork = /network|fetch|failed to fetch|typeerror/i.test(rawMessage);
  const isTimeout = /timeout|timed out|aborted/i.test(rawMessage);
  const isSessionExpired = error?.isSessionExpired === true;
  // v1.0.3: distinguish true session-auth 401s from upstream-provider 401s.
  // The server now reclassifies Cloudinary 401s as 502 with code UPSTREAM_*,
  // but we treat anything with UPSTREAM_ prefix or a 502 from an upload path
  // as upstream regardless of how it got here (defense-in-depth).
  const isUpstreamFailure =
    status === 502 ||
    code.startsWith('UPSTREAM_') ||
    /upload service is (misconfigured|temporarily unavailable)/i.test(rawMessage);
  const isAuth =
    !isUpstreamFailure && (status === 401 || /unauthoriz/i.test(rawMessage));
  const isServer =
    (typeof status === 'number' && status >= 500 && !isUpstreamFailure) ||
    /HTTP 5\d\d/i.test(rawMessage);
  const isSize = /too large|size|413/i.test(rawMessage);

  // Session expiry is handled centrally by AuthProvider (via sessionEvents):
  // it clears local state, shows a toast, and navigates to /sign-in. Showing
  // a modal that tells the user to "sign out and sign back in" would be
  // redundant and misleading — the app is already doing it for them.
  if (isSessionExpired) {
    if (__DEV__) {
      console.warn(`[${logTag}] Upload aborted — session expired, navigating to sign-in`);
    }
    return;
  }

  if (isUpstreamFailure) {
    // Cloudinary or another upstream provider rejected the upload. This is
    // infrastructure — not the user's session. Show a clear retry prompt,
    // never mention signing in/out.
    Alert.alert(
      'Upload Unavailable',
      rawMessage ||
        'The upload service is temporarily unavailable. Please try again in a minute.'
    );
  } else if (isAuth) {
    // A genuine 401 that isn't upstream — either a race where the
    // session-expired event hasn't fired yet or a legitimate permission issue
    // on this specific endpoint. Never tell the user to sign out manually —
    // the session-expired path does that automatically if needed.
    Alert.alert(
      'Upload Failed',
      "We couldn't authorize this upload. Please try again in a moment."
    );
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
