export function initSentry() {}

export function setUserContext(_user: { id: string; email?: string; username?: string } | null) {}

export function captureException(_error: Error | unknown, _context?: Record<string, any>) {}

export function captureBreadcrumb(_message: string, _category: string, _data?: Record<string, any>) {}

const Sentry = {
  init: initSentry,
  setUser: setUserContext,
  captureException,
  addBreadcrumb: captureBreadcrumb,
};

export default Sentry;
