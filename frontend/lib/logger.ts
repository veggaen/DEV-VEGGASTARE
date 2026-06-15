/**
 * @fileOverview Structured logger for VeggaStare — clean, secure, copy-friendly output.
 * @stability stable
 *
 * Usage:
 *   import { createLogger } from '@/lib/logger';
 *   const log = createLogger('MyComponent');
 *   log.info('Something happened', { key: 'value' });
 *   log.warn('Watch out');
 *   log.error('Failed', error);
 *   log.debug('Verbose detail'); // Only in development
 *
 * Output (browser console):
 *   [MyComponent] ℹ Something happened  { key: "value" }
 *   [MyComponent] ⚠ Watch out
 *   [MyComponent] ✖ Failed  Error: ...
 *   [MyComponent] … Verbose detail
 *
 * Output (server / Node):
 *   [HH:MM:SS] [MyComponent] INFO  Something happened  { key: "value" }
 */

const isDev = process.env.NODE_ENV === 'development';
const isServer = typeof window === 'undefined';

/** Levels gated by environment */
const enum Level {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/** Minimum level: DEBUG in dev, INFO in prod */
const MIN_LEVEL: Level = isDev ? Level.DEBUG : Level.INFO;

function ts(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

/**
 * Keys that should NEVER be logged in the browser.
 * Server-side error logs may include them for debugging — but never in client bundles.
 */
const REDACT_KEYS = new Set([
  'password', 'secret', 'token', 'accessToken', 'refreshToken',
  'apiKey', 'authorization', 'cookie', 'sessionToken',
  'creditCard', 'cardNumber', 'cvv', 'ssn',
]);

/** Shallow-redact sensitive keys from an object (1 level deep). */
function redact<T>(obj: T): T {
  if (!obj || typeof obj !== 'object' || obj instanceof Error) return obj;
  if (Array.isArray(obj)) return obj as T;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    out[k] = REDACT_KEYS.has(k) ? '[REDACTED]' : v;
  }
  return out as T;
}

export interface Logger {
  debug(msg: string, ...data: unknown[]): void;
  info(msg: string, ...data: unknown[]): void;
  warn(msg: string, ...data: unknown[]): void;
  error(msg: string, ...data: unknown[]): void;
}

/**
 * Create a scoped logger.
 * @param scope Component or module name — shows in every line.
 */
export function createLogger(scope: string): Logger {
  const tag = `[${scope}]`;

  function emit(level: Level, icon: string, label: string, msg: string, data: unknown[]) {
    if (level < MIN_LEVEL) return;

    // Redact in browser (server keeps full data for debugging)
    const safeData = isServer ? data : data.map(redact);

    if (isServer) {
      // Server: timestamp + label  — easy to grep
      const prefix = `[${ts()}] ${tag} ${label}`;
      const fn = level >= Level.ERROR ? console.error
        : level >= Level.WARN ? console.warn
        : console.log;
      fn(prefix, msg, ...safeData);
    } else {
      // Browser: compact, icon-prefixed — easy to scan
      const prefix = `${tag} ${icon}`;
      const fn = level >= Level.ERROR ? console.error
        : level >= Level.WARN ? console.warn
        : level >= Level.INFO ? console.info
        : console.debug;
      fn(prefix, msg, ...safeData);
    }
  }

  return {
    debug: (msg, ...data) => emit(Level.DEBUG, '…', 'DEBUG', msg, data),
    info:  (msg, ...data) => emit(Level.INFO,  'ℹ', 'INFO ', msg, data),
    warn:  (msg, ...data) => emit(Level.WARN,  '⚠', 'WARN ', msg, data),
    error: (msg, ...data) => emit(Level.ERROR, '✖', 'ERROR', msg, data),
  };
}
