import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

// The server and the first hydration render share a snapshot. React then
// switches to the browser snapshot, including when a Suspense subtree hydrates
// later; a parent mount effect cannot guarantee that ordering.
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
}
