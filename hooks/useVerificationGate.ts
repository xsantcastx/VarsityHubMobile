import { extractApiError } from '@/utils/apiErrors';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface VerificationGateOpenOptions {
  email?: string | null;
}

export interface VerificationGateHookOptions {
  getDefaultEmail?: () => string | null | undefined;
  requestCode: () => Promise<any>;
  confirmCode: (code: string) => Promise<any>;
  onVerified?: () => Promise<void> | void;
  autoFinishOnVerified?: boolean;
  resendCooldownSeconds?: number;
  getRequestSuccessState?: (
    response: any
  ) => { info?: string | null; error?: string | null; cooldownSeconds?: number } | void;
  getRequestErrorMessage?: (error: any) => string;
  getConfirmErrorMessage?: (error: any) => string;
  onRequestSuccess?: (response: any) => void;
  onRequestError?: (error: any) => void;
  onConfirmError?: (error: any) => void;
}

export interface VerificationGateState {
  visible: boolean;
  email: string | null;
  code: string;
  loading: boolean;
  error: string | null;
  info: string | null;
  resendCooldown: number;
  setCode: (value: string) => void;
  verify: () => Promise<void>;
  resend: () => Promise<void>;
  cancel: () => void;
}

type VerificationGateOpener = (options?: VerificationGateOpenOptions) => Promise<boolean>;

let gateOpener: VerificationGateOpener | null = null;

function setGateOpener(next: VerificationGateOpener | null) {
  gateOpener = next;
}

export function openVerificationGate(options?: VerificationGateOpenOptions): Promise<boolean> {
  if (!gateOpener) return Promise.resolve(false);
  return gateOpener(options);
}

export function isEmailVerificationRequiredError(status?: number, payload?: any): boolean {
  if (status !== 403) return false;
  const raw =
    (typeof payload?.error === 'string' && payload.error) ||
    (typeof payload?.message === 'string' && payload.message) ||
    '';
  return raw.trim().toLowerCase() === 'email verification required';
}

function defaultRequestErrorMessage(error: any): string {
  const { code, message, status } = extractApiError(error, 'Unable to send a verification code right now.');

  if (code === 'VERIFY_REQUEST_COOLDOWN') {
    return 'Please wait a moment before requesting another code.';
  }
  if (code === 'VERIFY_REQUEST_RATE_LIMITED') {
    return 'Too many verification requests. Please try again later.';
  }
  if (status === 429) {
    return message.includes('Too many requests')
      ? 'Too many verification requests. Please try again later.'
      : 'Please wait a moment before requesting another code.';
  }
  if (status === 401) {
    return 'Please sign in again to verify your email.';
  }
  return message;
}

function defaultConfirmErrorMessage(error: any): string {
  const { code, message, status } = extractApiError(error, 'Verification failed. Please try again.');

  if (code === 'VERIFY_CODE_EXPIRED') return 'Verification code expired. Request a new code.';
  if (code === 'VERIFY_NO_CODE') return 'No verification code is active. Request a new code.';
  if (code === 'VERIFY_CODE_INVALID') {
    return 'Invalid verification code. Check the code and try again.';
  }
  if (status === 429) return 'Too many attempts. Please wait a moment and try again.';
  if (status === 401) return 'Please sign in again to verify your email.';
  if (status === 400) {
    if (message.includes('expired')) return 'Verification code expired. Request a new code.';
    if (message.includes('No verification in progress')) {
      return 'No verification code is active. Request a new code.';
    }
    if (message.includes('Invalid code')) {
      return 'Invalid verification code. Check the code and try again.';
    }
  }
  return message;
}

export function useVerificationGate({
  getDefaultEmail,
  requestCode,
  confirmCode,
  onVerified,
  autoFinishOnVerified = true,
  resendCooldownSeconds = 30,
  getRequestSuccessState,
  getRequestErrorMessage,
  getConfirmErrorMessage,
  onRequestSuccess,
  onRequestError,
  onConfirmError,
}: VerificationGateHookOptions): VerificationGateState {
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [code, setCodeState] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  const resolveRef = useRef<((value: boolean) => void) | null>(null);
  const pendingPromiseRef = useRef<Promise<boolean> | null>(null);
  const verifyInFlightRef = useRef(false);
  const resendInFlightRef = useRef(false);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(current => Math.max(0, current - 1)), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const finish = useCallback((result: boolean) => {
    setVisible(false);
    setLoading(false);
    setCodeState('');
    setError(null);
    setInfo(null);
    setResendCooldown(0);
    verifyInFlightRef.current = false;
    resendInFlightRef.current = false;
    const resolve = resolveRef.current;
    resolveRef.current = null;
    pendingPromiseRef.current = null;
    if (resolve) resolve(result);
  }, []);

  const handleVerified = useCallback(async () => {
    try {
      await onVerified?.();
    } catch {
      // Best-effort local refresh only; the original request retry is the source of truth.
    }
    if (!autoFinishOnVerified) {
      setCodeState('');
      return;
    }
    finish(true);
  }, [autoFinishOnVerified, finish, onVerified]);

  const resend = useCallback(async () => {
    if (loading || resendInFlightRef.current || resendCooldown > 0) return;
    resendInFlightRef.current = true;
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const response = await requestCode();
      onRequestSuccess?.(response);
      if (response?.already_verified) {
        await handleVerified();
        return;
      }
      const requestState = getRequestSuccessState?.(response);
      if (typeof requestState?.error === 'string' && requestState.error.length > 0) {
        setError(requestState.error);
      } else if (typeof requestState?.info === 'string') {
        setInfo(requestState.info);
      } else {
        setInfo('We sent a 6-digit code to your email.');
      }
      setResendCooldown(requestState?.cooldownSeconds ?? resendCooldownSeconds);
    } catch (requestError: any) {
      onRequestError?.(requestError);
      setError(
        getRequestErrorMessage?.(requestError) ?? defaultRequestErrorMessage(requestError)
      );
      if (requestError?.status === 429) {
        setResendCooldown(resendCooldownSeconds);
      }
    } finally {
      resendInFlightRef.current = false;
      setLoading(false);
    }
  }, [
    getRequestErrorMessage,
    getRequestSuccessState,
    handleVerified,
    loading,
    onRequestError,
    onRequestSuccess,
    requestCode,
    resendCooldown,
    resendCooldownSeconds,
  ]);

  const verify = useCallback(async () => {
    if (loading || verifyInFlightRef.current || code.trim().length !== 6) return;
    verifyInFlightRef.current = true;
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const response = await confirmCode(code.trim());
      if (response?.already_verified || response?.ok) {
        await handleVerified();
        return;
      }
      await handleVerified();
    } catch (confirmError: any) {
      onConfirmError?.(confirmError);
      setError(
        getConfirmErrorMessage?.(confirmError) ?? defaultConfirmErrorMessage(confirmError)
      );
    } finally {
      verifyInFlightRef.current = false;
      setLoading(false);
    }
  }, [
    code,
    confirmCode,
    getConfirmErrorMessage,
    handleVerified,
    loading,
    onConfirmError,
  ]);

  const cancel = useCallback(() => {
    finish(false);
  }, [finish]);

  const setCode = useCallback((value: string) => {
    setCodeState(value.replace(/[^0-9]/g, '').slice(0, 6));
  }, []);

  const open = useCallback(
    async (options?: VerificationGateOpenOptions) => {
      const nextEmail = options?.email ?? getDefaultEmail?.() ?? null;
      setEmail(nextEmail || null);

      if (pendingPromiseRef.current) {
        setVisible(true);
        return pendingPromiseRef.current;
      }

      setVisible(true);
      setCodeState('');
      setError(null);
      setInfo(null);
      setResendCooldown(0);

      const promise = new Promise<boolean>((resolve) => {
        resolveRef.current = resolve;
      });
      pendingPromiseRef.current = promise;

      void resend();

      return promise;
    },
    [getDefaultEmail, resend]
  );

  useEffect(() => {
    setGateOpener(open);
    return () => {
      if (gateOpener === open) {
        setGateOpener(null);
      }
    };
  }, [open]);

  return {
    visible,
    email,
    code,
    loading,
    error,
    info,
    resendCooldown,
    setCode,
    verify,
    resend,
    cancel,
  };
}
