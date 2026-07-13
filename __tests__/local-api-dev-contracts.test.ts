import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd());
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

const packageJson = read('package.json');
const appConfig = read('app.config.js');
const httpTransport = read('api/http.ts');
const envConfig = read('config/env.ts');

describe('local api dev contracts', () => {
  it('native dev scripts pin the app to the local backend', () => {
    expect(packageJson).toContain('EXPO_PUBLIC_API_URL=http://localhost:4000');
    expect(packageJson).toContain('EXPO_PUBLIC_FORCE_REMOTE_API=0');
    expect(packageJson).toContain('EXPO_PUBLIC_USE_LOCAL_API=1');
  });

  it('app config and runtime honor EXPO_PUBLIC_USE_LOCAL_API for dev builds', () => {
    expect(appConfig).toContain(
      "const useLocalApi = isTruthy(process.env.EXPO_PUBLIC_USE_LOCAL_API || '0');"
    );
    expect(appConfig).toContain(
      "EXPO_PUBLIC_USE_LOCAL_API: useLocalApi ? '1' : process.env.EXPO_PUBLIC_USE_LOCAL_API || '0',"
    );

    expect(httpTransport).toContain(
      'const processUseLocalApi = processEnv.EXPO_PUBLIC_USE_LOCAL_API;'
    );
    expect(httpTransport).toContain('if (__DEV__ && useLocalApi) {');
    expect(httpTransport).toContain("Platform.OS === 'android'");

    expect(envConfig).toContain("| 'EXPO_PUBLIC_USE_LOCAL_API'");
    expect(envConfig).toContain(
      "const useLocalApi = readBoolean('EXPO_PUBLIC_USE_LOCAL_API', false);"
    );
    expect(envConfig).toContain('if (__DEV__ && useLocalApi) {');
  });
});
