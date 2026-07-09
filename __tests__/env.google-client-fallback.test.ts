import { describe, expect, it, jest } from '@jest/globals';

describe('config/env Google client fallback', () => {
  it('replaces deleted Google client IDs from runtime config with the canonical production set', () => {
    jest.isolateModules(() => {
      jest.doMock('expo-constants', () => ({
        __esModule: true,
        default: {
          expoConfig: {
            extra: {
              EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID:
                '316424000000-deletedandroidclient.apps.googleusercontent.com',
              EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID:
                '316424000000-deletediosclient.apps.googleusercontent.com',
              EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID:
                '316424000000-deletedwebclient.apps.googleusercontent.com',
              EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID:
                '316424000000-deletedexpoclient.apps.googleusercontent.com',
            },
          },
        },
      }));
      jest.doMock('react-native', () => ({
        Platform: { OS: 'ios' },
      }));

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const env = require('@/config/env') as typeof import('@/config/env');
      const config = env.getConfig();

      expect(config.google.androidClientId).toBe(
        '814866365020-ia09lnm6he2prvaivrp8sblh7oeh9ic0.apps.googleusercontent.com'
      );
      expect(config.google.iosClientId).toBe(
        '514463516787-dm665i3u3a6un7eties8q73eik17vcs3.apps.googleusercontent.com'
      );
      expect(config.google.webClientId).toBe(
        '514463516787-rqdc3es1n5ofr3v7dn1l1gpj6r8kauqu.apps.googleusercontent.com'
      );
      expect(config.google.expoClientId).toBe(
        '514463516787-rqdc3es1n5ofr3v7dn1l1gpj6r8kauqu.apps.googleusercontent.com'
      );
    });
  });
});
