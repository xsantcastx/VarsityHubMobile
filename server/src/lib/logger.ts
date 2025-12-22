/**
 * Centralized logging utility
 * Provides structured logging with levels and consistent formatting
 * Replaces ad-hoc console.log/warn/error calls throughout routes
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: any;
}

class Logger {
  private moduleName: string;
  private level: LogLevel = 'info';

  constructor(moduleName: string) {
    this.moduleName = moduleName;
    // Override level from env if set
    const envLevel = process.env.LOG_LEVEL as LogLevel | undefined;
    if (envLevel) this.level = envLevel;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
    return levels[level] >= levels[this.level];
  }

  private format(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const levelStr = level.toUpperCase().padEnd(5);
    const contextStr = context ? ` | ${JSON.stringify(context)}` : '';
    return `[${timestamp}] [${levelStr}] [${this.moduleName}] ${message}${contextStr}`;
  }

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog('debug')) console.log(this.format('debug', message, context));
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog('info')) console.log(this.format('info', message, context));
  }

  warn(message: string, context?: LogContext): void {
    if (this.shouldLog('warn')) console.warn(this.format('warn', message, context));
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    if (this.shouldLog('error')) {
      const errorStr = error instanceof Error ? error.message : String(error);
      const fullContext = context ? { ...context, error: errorStr } : { error: errorStr };
      console.error(this.format('error', message, fullContext));
    }
  }
}

/**
 * Create a logger instance for a specific module
 * @param moduleName - Name of the module (e.g., 'payments', 'auth', 'organizations')
 * @returns Logger instance
 */
export function createLogger(moduleName: string): Logger {
  return new Logger(moduleName);
}

/**
 * Re-export for direct use
 */
export default createLogger;
