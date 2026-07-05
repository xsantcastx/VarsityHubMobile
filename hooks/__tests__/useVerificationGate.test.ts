/**
 * useVerificationGate
 *
 * Pins:
 *   - resend() dedups near-simultaneous duplicate sends (two live gate
 *     instances, or a remount, both auto-firing on open()) into one network
 *     call, without blocking a legitimate resend after the dedup window
 *   - verify() does NOT wipe the user's typed code on an explicit failure
 *     payload (a resolved, non-throwing response that isn't a recognized
 *     success shape) — only `ok`/`already_verified` finish the gate
 */

import { act, renderHook } from '@testing-library/react-native';
import { useVerificationGate } from '@/hooks/useVerificationGate';

describe('useVerificationGate', () => {
  describe('resend() duplicate-send guard', () => {
    it('collapses a second near-simultaneous resend() into a no-op', async () => {
      const requestCode = jest.fn().mockResolvedValue({ ok: true });
      const { result } = renderHook(() =>
        useVerificationGate({
          requestCode,
          confirmCode: jest.fn(),
        })
      );

      await act(async () => {
        await result.current.resend();
      });
      expect(requestCode).toHaveBeenCalledTimes(1);

      // Simulate a second call site (e.g. the other live gate instance, or a
      // remount) firing resend() moments later — well within the dedup
      // window and before the real resendCooldown would even apply.
      await act(async () => {
        await result.current.resend();
      });
      expect(requestCode).toHaveBeenCalledTimes(1);
    });

    it('allows a later legitimate resend once the dedup window has elapsed', async () => {
      const nowSpy = jest.spyOn(Date, 'now');
      try {
        // Start from the real current time (offset forward) so this test's
        // module-level dedup timestamp isn't accidentally "in the past"
        // relative to a real Date.now() call left over from a prior test.
        let mockedNow = Date.now() + 60_000;
        nowSpy.mockImplementation(() => mockedNow);

        const requestCode = jest.fn().mockResolvedValue({ ok: true });
        const { result } = renderHook(() =>
          useVerificationGate({
            requestCode,
            confirmCode: jest.fn(),
            resendCooldownSeconds: 0,
          })
        );

        await act(async () => {
          await result.current.resend();
        });
        expect(requestCode).toHaveBeenCalledTimes(1);

        // Advance the clock past the 3s dedup window (cooldown is 0, so the
        // real resendCooldown state doesn't block this second call either).
        mockedNow += 3500;

        await act(async () => {
          await result.current.resend();
        });
        expect(requestCode).toHaveBeenCalledTimes(2);
      } finally {
        nowSpy.mockRestore();
      }
    });

    it('collapses two truly-concurrent resend() calls across two hook instances (TOCTOU) into a single requestCode() call', async () => {
      // Reproduces the real trigger: multiple concurrent API calls each get a
      // 403 "email verification required" and independently call
      // openVerificationGate() near app startup, which fires resend() on two
      // *separate* useVerificationGate instances (e.g. the global
      // VerificationGateHost gate and a standalone screen's own gate).
      // Each instance has its own resendInFlightRef, so the per-instance ref
      // can't dedup across them. Neither call has resolved when the second
      // starts, so the timestamp-based guard (only written after
      // requestCode() resolves) can't see the first call yet either — both
      // read the same stale lastSuccessfulResendAtMs. Only the synchronous
      // module-level in-flight flag can close this race.
      const nowSpy = jest.spyOn(Date, 'now');
      try {
        // Move further forward than any prior test in this file's mocked
        // timeline, past the 3s dedup window, so an earlier test's
        // lastSuccessfulResendAtMs write doesn't itself block this test.
        const mockedNow = Date.now() + 120_000;
        nowSpy.mockImplementation(() => mockedNow);

        let resolveRequestCode: (value: { ok: true }) => void;
        const requestCode = jest.fn().mockImplementation(
          () =>
            new Promise(resolve => {
              resolveRequestCode = resolve;
            })
        );

        const first = renderHook(() =>
          useVerificationGate({
            requestCode,
            confirmCode: jest.fn(),
          })
        );
        const second = renderHook(() =>
          useVerificationGate({
            requestCode,
            confirmCode: jest.fn(),
          })
        );

        await act(async () => {
          const firstResend = first.result.current.resend();
          const secondResend = second.result.current.resend();
          resolveRequestCode!({ ok: true });
          await Promise.all([firstResend, secondResend]);
        });

        expect(requestCode).toHaveBeenCalledTimes(1);
      } finally {
        nowSpy.mockRestore();
      }
    });
  });

  describe('verify() non-ok fallthrough', () => {
    it('does not clear the code when confirmCode resolves with an explicit error payload', async () => {
      const confirmCode = jest.fn().mockResolvedValue({ error: 'Invalid code' });
      const onVerified = jest.fn();
      const { result } = renderHook(() =>
        useVerificationGate({
          requestCode: jest.fn(),
          confirmCode,
          onVerified,
        })
      );

      act(() => {
        result.current.setCode('123456');
      });

      await act(async () => {
        await result.current.verify();
      });

      expect(onVerified).not.toHaveBeenCalled();
      expect(result.current.code).toBe('123456');
      expect(result.current.error).toBeTruthy();
    });

    it('does not clear the code for an unrecognized (non-ok, non-error) response shape', async () => {
      const confirmCode = jest.fn().mockResolvedValue({ something: 'unexpected' });
      const onVerified = jest.fn();
      const { result } = renderHook(() =>
        useVerificationGate({
          requestCode: jest.fn(),
          confirmCode,
          onVerified,
        })
      );

      act(() => {
        result.current.setCode('654321');
      });

      await act(async () => {
        await result.current.verify();
      });

      expect(onVerified).not.toHaveBeenCalled();
      expect(result.current.code).toBe('654321');
    });

    it('still finishes normally for a recognized `ok` success response', async () => {
      const confirmCode = jest.fn().mockResolvedValue({ ok: true });
      const onVerified = jest.fn();
      const { result } = renderHook(() =>
        useVerificationGate({
          requestCode: jest.fn(),
          confirmCode,
          onVerified,
        })
      );

      act(() => {
        result.current.setCode('111111');
      });

      await act(async () => {
        await result.current.verify();
      });

      expect(onVerified).toHaveBeenCalledTimes(1);
    });

    it('still finishes normally for `already_verified`', async () => {
      const confirmCode = jest.fn().mockResolvedValue({ already_verified: true });
      const onVerified = jest.fn();
      const { result } = renderHook(() =>
        useVerificationGate({
          requestCode: jest.fn(),
          confirmCode,
          onVerified,
        })
      );

      act(() => {
        result.current.setCode('222222');
      });

      await act(async () => {
        await result.current.verify();
      });

      expect(onVerified).toHaveBeenCalledTimes(1);
    });
  });
});
