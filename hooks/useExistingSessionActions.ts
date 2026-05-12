import { useCallback } from 'react';

type SetBoolean = (value: boolean) => void;
type SetStringOrNull = (value: string | null) => void;

interface ExistingSessionActionOptions {
  authBusy: boolean;
  signOut: () => Promise<void>;
  setSigningOut: SetBoolean;
  setError: SetStringOrNull;
  user?: any;
  checkAuth: (options?: {
    email?: string;
    pendingVerification?: boolean;
    replaceSession?: boolean;
  }) => Promise<any>;
  routeCurrentUser: (resolvedUser?: any) => Promise<void>;
  expiredMessage: string;
  restoreFailedMessage: string;
}

export function useExistingSessionActions({
  authBusy,
  signOut,
  setSigningOut,
  setError,
  user,
  checkAuth,
  routeCurrentUser,
  expiredMessage,
  restoreFailedMessage,
}: ExistingSessionActionOptions) {
  const handleSignOutToContinue = useCallback(async () => {
    if (authBusy) return;
    setError(null);
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  }, [authBusy, setError, setSigningOut, signOut]);

  const handleContinueExistingSession = useCallback(async () => {
    if (authBusy) return;
    setError(null);
    try {
      const authUser = user || (await checkAuth());
      if (authUser) {
        await routeCurrentUser(authUser);
        return;
      }
      setError(expiredMessage);
    } catch (e: any) {
      const message = e?.message || '';
      if (e?.isNetworkError === true || message.startsWith('Cannot connect to server')) {
        setError(message);
        return;
      }
      if (e?.status === 401) {
        setError(expiredMessage);
        return;
      }
      setError(restoreFailedMessage);
    }
  }, [
    authBusy,
    checkAuth,
    expiredMessage,
    restoreFailedMessage,
    routeCurrentUser,
    setError,
    user,
  ]);

  return {
    handleSignOutToContinue,
    handleContinueExistingSession,
  };
}
