import { useCallback, useEffect } from 'react';

type UseVerificationScreenActionsOptions = {
  devCodeParam?: string;
  setGateCode: (code: string) => void;
  setDevCode?: (code: string | null) => void;
  clearMessages: () => void;
  verify: () => Promise<void>;
  resend: () => Promise<void>;
};

export function useVerificationScreenActions({
  devCodeParam,
  setGateCode,
  setDevCode,
  clearMessages,
  verify,
  resend,
}: UseVerificationScreenActionsOptions) {
  useEffect(() => {
    if (!devCodeParam) return;
    setDevCode?.(devCodeParam);
    setGateCode(devCodeParam);
  }, [devCodeParam, setDevCode, setGateCode]);

  const onVerify = useCallback(async () => {
    clearMessages();
    await verify();
  }, [clearMessages, verify]);

  const onResend = useCallback(async () => {
    clearMessages();
    await resend();
  }, [clearMessages, resend]);

  return {
    onVerify,
    onResend,
  };
}
