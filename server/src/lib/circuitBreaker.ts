/**
 * Circuit breaker for outbound third-party calls (SendGrid, Cloudinary, Stripe,
 * Apple/Google verify). A slow or flaky upstream can otherwise pile up BullMQ
 * workers and Express handlers — on game day a single degraded provider can
 * cascade into API-wide latency. Each upstream gets its own breaker: once an
 * upstream trips the failure threshold, calls fail fast (CircuitOpenError)
 * instead of hanging, then a half-open trial probes for recovery.
 *
 * Usage:
 *   await runWithBreaker('sendgrid', () => emailProvider.send(mailData));
 *
 * Callers that surface HTTP should map CircuitOpenError -> 503 so clients retry.
 */
import CircuitBreaker from 'opossum';
import { captureMessage } from './sentry.js';

/** Thrown when a breaker is open. `isCircuitOpen` lets callers map this to 503. */
export class CircuitOpenError extends Error {
  readonly circuit: string;
  readonly isCircuitOpen = true;
  constructor(name: string) {
    super(`Circuit "${name}" is open — upstream unavailable, failing fast`);
    this.name = 'CircuitOpenError';
    this.circuit = name;
  }
}

export interface BreakerOptions {
  /** ms before a call is considered failed (and counts toward tripping). */
  timeout?: number;
  /** % of failures in the rolling window that trips the breaker. */
  errorThresholdPercentage?: number;
  /** ms the breaker stays open before allowing a half-open trial. */
  resetTimeout?: number;
  /** min number of calls in the window before the breaker can trip. */
  volumeThreshold?: number;
  /**
   * Return true for errors that are EXPECTED business failures (declined card,
   * invalid recipient, 4xx) so they do NOT count toward tripping the breaker.
   * Only infra failures (timeouts, 5xx, network) should open the circuit.
   */
  errorFilter?: (err: any) => boolean;
}

const DEFAULTS: Required<Omit<BreakerOptions, 'errorFilter'>> = {
  timeout: 10000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
  volumeThreshold: 5,
};

// One breaker per named upstream, created lazily and reused across calls so the
// rolling failure stats actually accumulate.
const breakers = new Map<string, CircuitBreaker<[() => Promise<unknown>], unknown>>();

function getBreaker(name: string, options?: BreakerOptions): CircuitBreaker<[() => Promise<unknown>], unknown> {
  const existing = breakers.get(name);
  if (existing) return existing;

  const opts = { ...DEFAULTS, ...options };
  // The breaker's action is a pass-through that invokes the caller-supplied fn.
  // This lets one breaker front many distinct call sites for the same upstream.
  const breaker = new CircuitBreaker<[() => Promise<unknown>], unknown>(
    (fn: () => Promise<unknown>) => fn(),
    {
      name,
      timeout: opts.timeout,
      errorThresholdPercentage: opts.errorThresholdPercentage,
      resetTimeout: opts.resetTimeout,
      volumeThreshold: opts.volumeThreshold,
      ...(options?.errorFilter ? { errorFilter: options.errorFilter } : {}),
    }
  );

  breaker.on('open', () => {
    console.warn(`[circuitBreaker] "${name}" OPEN — failing fast for ${opts.resetTimeout}ms`);
    captureMessage(`Circuit breaker opened: ${name}`, 'warning', { circuit: name });
  });
  breaker.on('halfOpen', () => {
    console.warn(`[circuitBreaker] "${name}" HALF-OPEN — sending trial request`);
    captureMessage(`Circuit breaker half-open: ${name}`, 'info', { circuit: name });
  });
  breaker.on('close', () => {
    console.info(`[circuitBreaker] "${name}" CLOSED — upstream recovered`);
    captureMessage(`Circuit breaker recovered (closed): ${name}`, 'info', { circuit: name });
  });

  breakers.set(name, breaker);
  return breaker;
}

/**
 * Run `fn` behind the named circuit breaker. Rejects with CircuitOpenError when
 * the breaker is open; otherwise propagates the underlying error (or a timeout).
 */
export async function runWithBreaker<T>(
  name: string,
  fn: () => Promise<T>,
  options?: BreakerOptions
): Promise<T> {
  const breaker = getBreaker(name, options);
  try {
    return (await breaker.fire(fn)) as T;
  } catch (err: any) {
    // opossum sets code 'EOPENBREAKER' when the circuit is open.
    if (err?.code === 'EOPENBREAKER') {
      throw new CircuitOpenError(name);
    }
    throw err;
  }
}

/** Snapshot of breaker states for health/diagnostics endpoints. */
export function getCircuitStats(): Array<{ name: string; open: boolean; halfOpen: boolean; closed: boolean }> {
  return Array.from(breakers.entries()).map(([name, b]) => ({
    name,
    open: b.opened,
    halfOpen: b.halfOpen,
    closed: b.closed,
  }));
}

/** Test-only: clear all breakers so each test starts from a clean state. */
export function __resetCircuitBreakersForTest(): void {
  for (const b of breakers.values()) b.shutdown();
  breakers.clear();
}
