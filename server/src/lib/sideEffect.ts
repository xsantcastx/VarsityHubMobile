import { captureException } from './sentry.js';

type SideEffectContext = Record<string, unknown>;

function toError(error: unknown, label: string): Error {
  if (error instanceof Error) return error;
  return new Error(`${label} failed: ${String(error)}`);
}

function logFailure(label: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`[side-effect] ${label} failed:`, message);
}

export async function bestEffort<T>(
  label: string,
  context: SideEffectContext,
  fn: () => Promise<T>
): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    captureException(toError(error, label), {
      context: 'side_effect_best_effort',
      tags: { side_effect: label },
      ...context,
    });
    logFailure(label, error);
    return null;
  }
}

export async function mustSucceed<T>(
  label: string,
  context: SideEffectContext,
  fn: () => Promise<T>
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    captureException(toError(error, label), {
      context: 'side_effect_must_succeed',
      tags: { side_effect: label },
      ...context,
    });
    logFailure(label, error);
    throw error;
  }
}
