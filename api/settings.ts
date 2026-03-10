import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const prefix = 'vh_settings_';

async function setItem(key: string, value: string) {
  try {
    if (Platform.OS === 'web') {
      window.localStorage.setItem(prefix + key, value);
    } else {
      await AsyncStorage.setItem(prefix + key, value);
    }
  } catch (error) {
    if (__DEV__) console.warn('[settings] Failed to save setting:', key, error);
  }
}

async function getItem(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      return window.localStorage.getItem(prefix + key);
    } else {
      return await AsyncStorage.getItem(prefix + key);
    }
  } catch (error) {
    if (__DEV__) console.warn('[settings] Failed to read setting:', key, error);
    return null;
  }
}

export async function getBool(key: string, fallback = false): Promise<boolean> {
  const v = await getItem(key);
  if (v == null) return fallback;
  return v === '1' || v === 'true';
}

export async function setBool(key: string, value: boolean): Promise<void> {
  await setItem(key, value ? '1' : '0');
}

export async function getJson<T = any>(key: string, fallback: T): Promise<T> {
  const v = await getItem(key);
  if (!v) return fallback;
  try { return JSON.parse(v) as T; } catch (error) {
    if (__DEV__) console.warn('[settings] JSON parse failed for key:', key, error);
    return fallback;
  }
}

export async function setJson(key: string, value: any): Promise<void> {
  await setItem(key, JSON.stringify(value));
}

export async function getString(key: string, fallback: string = ''): Promise<string> {
  const v = await getItem(key);
  return v ?? fallback;
}

export async function setString(key: string, value: string): Promise<void> {
  await setItem(key, value);
}

export const SETTINGS_KEYS = {
  PRIVATE_ACCOUNT: 'private_account',
  DM_POLICY: 'dm_policy', // 'everyone' | 'following' | 'no_one'
  BLOCKED_USERS: 'blocked_users', // string[] emails or ids
  NOTIFY_MSG: 'notify_messages',
  NOTIFY_FOLLOW: 'notify_followers',
  LOCAL_ADS: 'local_ads', // stored drafts of submitted local ads
  POST_DRAFT: 'post_draft', // draft for create post
  SAMPLE_EVENT_POSTS: 'sample_event_posts', // local cache for sample event posts
};

export default {
  getBool, setBool, getJson, setJson, getString, setString, SETTINGS_KEYS,
};
