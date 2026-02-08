/**
 * Web Testing Error Monitor
 * Captures and logs all errors, warnings, and console messages during testing
 */

interface ErrorLog {
  timestamp: string;
  type: 'error' | 'warning' | 'info' | 'network';
  message: string;
  stack?: string;
  url?: string;
  line?: number;
  column?: number;
  component?: string;
}

class TestingMonitor {
  private errors: ErrorLog[] = [];
  private originalConsoleError: typeof console.error;
  private originalConsoleWarn: typeof console.warn;
  private isMonitoring = false;

  constructor() {
    this.originalConsoleError = console.error;
    this.originalConsoleWarn = console.warn;
  }

  start() {
    if (typeof window === 'undefined') {
      console.log('🔍 Testing Monitor: Skipping (no window object)');
      return;
    }
    
    if (this.isMonitoring) return;
    this.isMonitoring = true;

    // Capture console errors
    console.error = (...args: any[]) => {
      this.log({
        timestamp: new Date().toISOString(),
        type: 'error',
        message: args.map(a => String(a)).join(' '),
      });
      this.originalConsoleError.apply(console, args);
    };

    // Capture console warnings
    console.warn = (...args: any[]) => {
      this.log({
        timestamp: new Date().toISOString(),
        type: 'warning',
        message: args.map(a => String(a)).join(' '),
      });
      this.originalConsoleWarn.apply(console, args);
    };

    // Capture unhandled errors
    window.addEventListener('error', (event) => {
      this.log({
        timestamp: new Date().toISOString(),
        type: 'error',
        message: event.message,
        stack: event.error?.stack,
        url: event.filename,
        line: event.lineno,
        column: event.colno,
      });
    });

    // Capture unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.log({
        timestamp: new Date().toISOString(),
        type: 'error',
        message: `Unhandled Promise Rejection: ${event.reason}`,
        stack: event.reason?.stack,
      });
    });

    // Capture network errors
    const originalFetch = window.fetch.bind(window);
    window.fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      try {
        const response = await originalFetch(input, init);
        if (!response.ok) {
          this.log({
            timestamp: new Date().toISOString(),
            type: 'network',
            message: `Network error: ${response.status} ${response.statusText}`,
            url: String(input),
          });
        }
        return response;
      } catch (error: any) {
        this.log({
          timestamp: new Date().toISOString(),
          type: 'network',
          message: `Network request failed: ${error.message}`,
          url: String(input),
          stack: error.stack,
        });
        throw error;
      }
    }) as typeof window.fetch;

    console.log('🔍 Testing Monitor Started - All errors will be logged');
  }

  private log(error: ErrorLog) {
    this.errors.push(error);
    
    // Also send to console for immediate visibility
    const emoji = error.type === 'error' ? '❌' : error.type === 'warning' ? '⚠️' : 'ℹ️';
    console.log(`${emoji} [${error.type.toUpperCase()}] ${error.message}`);
    
    // Store in localStorage for persistence
    try {
      localStorage.setItem('testing-errors', JSON.stringify(this.errors));
    } catch (e) {
      // Ignore storage errors
    }
  }

  getErrors() {
    return [...this.errors];
  }

  getErrorReport() {
    const grouped = this.errors.reduce((acc, error) => {
      if (!acc[error.type]) acc[error.type] = [];
      acc[error.type].push(error);
      return acc;
    }, {} as Record<string, ErrorLog[]>);

    return {
      total: this.errors.length,
      byType: Object.entries(grouped).map(([type, errors]) => ({
        type,
        count: errors.length,
        errors,
      })),
      summary: `${this.errors.length} total issues: ${grouped.error?.length || 0} errors, ${grouped.warning?.length || 0} warnings`,
    };
  }

  clear() {
    this.errors = [];
    try {
      localStorage.removeItem('testing-errors');
    } catch (e) {
      // Ignore
    }
  }

  stop() {
    if (!this.isMonitoring) return;
    this.isMonitoring = false;
    console.error = this.originalConsoleError;
    console.warn = this.originalConsoleWarn;
    console.log('🛑 Testing Monitor Stopped');
  }
}

// Export singleton instance
export const testingMonitor = new TestingMonitor();

// Auto-start in web development mode
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  testingMonitor.start();
}

// Make it globally accessible for debugging
if (typeof window !== 'undefined') {
  (window as any).testingMonitor = testingMonitor;
}
