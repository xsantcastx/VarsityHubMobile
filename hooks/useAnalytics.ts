export function useAnalytics() {
  return {
    track: (_name: string, _props?: Record<string, unknown>) => {},
    identify: (_id: string, _traits?: Record<string, unknown>) => {},
  };
}
