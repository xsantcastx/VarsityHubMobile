// No-op for web and Android where the tab bar is generally opaque.
// iOS uses TabBarBackground.ios.tsx for the real component.
export default function TabBarBackground() {
  return null;
}

export function useBottomTabOverflow() {
  return 0;
}
