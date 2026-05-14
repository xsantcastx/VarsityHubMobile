import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const DEVICE_ID_KEY = 'vh_device_id';

let deviceIdPromise: Promise<string | null> | null = null;

function getWebStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function generateDeviceId(): string {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.randomUUID === 'function') {
    return cryptoApi.randomUUID().replace(/-/g, '');
  }

  if (typeof cryptoApi?.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    cryptoApi.getRandomValues(bytes);
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}${Math.random()
    .toString(16)
    .slice(2)}`;
}

async function loadOrCreateNativeDeviceId(): Promise<string | null> {
  try {
    const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
    if (existing) return existing;

    const created = generateDeviceId();
    await SecureStore.setItemAsync(DEVICE_ID_KEY, created);
    return created;
  } catch {
    return null;
  }
}

async function loadOrCreateWebDeviceId(): Promise<string | null> {
  try {
    const storage = getWebStorage();
    const existing = storage?.getItem(DEVICE_ID_KEY) ?? null;
    if (existing) return existing;

    const created = generateDeviceId();
    storage?.setItem(DEVICE_ID_KEY, created);
    return created;
  } catch {
    return null;
  }
}

export async function getClientDeviceId(): Promise<string | null> {
  if (!deviceIdPromise) {
    deviceIdPromise =
      Platform.OS === 'web' ? loadOrCreateWebDeviceId() : loadOrCreateNativeDeviceId();
  }
  return deviceIdPromise;
}
