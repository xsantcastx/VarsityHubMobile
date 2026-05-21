import { Alert } from 'react-native';
import { getCoachRecoveryRoute, type CoachUserLike } from './roleChecks';

type NavigationTarget = {
  replace: (href: any) => void;
};

function getCoachAccessCode(error: any): string | null {
  const code = error?.data?.code || error?.code;
  if (typeof code === 'string' && code.length > 0) {
    return code;
  }

  const rawError = error?.data?.error;
  if (typeof rawError === 'string' && rawError.length > 0) {
    return rawError;
  }

  return null;
}

export function handleCoachAccessError(
  router: NavigationTarget,
  error: any,
  actionLabel: string,
  user?: CoachUserLike | null
): boolean {
  const code = getCoachAccessCode(error);
  const recoveryRoute = user === undefined ? '/onboarding/pending-approval' : getCoachRecoveryRoute(user);

  if (code === 'COACH_AGREEMENT_REQUIRED') {
    Alert.alert(
      'Coach Agreement Required',
      `You need to accept the coach agreement before ${actionLabel}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Review Agreement', onPress: () => router.replace('/onboarding/coach-agreement') },
      ]
    );
    return true;
  }

  if (code === 'APPROVAL_REQUIRED') {
    const statusAction =
      recoveryRoute
        ? {
            text: recoveryRoute === '/(tabs)' ? 'Go Home' : 'View Status',
            onPress: () => router.replace(recoveryRoute),
          }
        : null;
    Alert.alert(
      'Approval Required',
      'Your coach account is pending approval. You can continue once a league admin approves it.',
      [{ text: 'OK' }, ...(statusAction ? [statusAction] : [])]
    );
    return true;
  }

  if (code === 'APPROVAL_REJECTED') {
    const statusAction =
      recoveryRoute
        ? {
            text: recoveryRoute === '/(tabs)' ? 'Go Home' : 'View Status',
            onPress: () => router.replace(recoveryRoute),
          }
        : null;
    Alert.alert(
      'Approval Rejected',
      'Your coach application was rejected. Contact support if you need help reapplying.',
      [{ text: 'OK' }, ...(statusAction ? [statusAction] : [])]
    );
    return true;
  }

  if (code === 'PAYMENT_REQUIRED') {
    Alert.alert(
      'Checkout Required',
      `Please complete your subscription checkout before ${actionLabel}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Go to Billing', onPress: () => router.replace('/settings/manage-subscription') },
      ]
    );
    return true;
  }

  return false;
}
