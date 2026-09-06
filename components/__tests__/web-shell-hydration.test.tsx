/** @jest-environment jsdom */
import React, { act } from 'react';
import { ThemeProvider } from '@/hooks/useCustomColorScheme';
import { WebInstallCta } from '../WebInstallCta';
import { WebThemeToggle } from '../WebThemeToggle';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

// React DOM is a runtime dependency; this native repository has no @types/react-dom.
const { renderToString } = require('react-dom/server.node');
const { hydrateRoot } = require('react-dom/client');
type Root = { render(children: React.ReactNode): void; unmount(): void };

let mockWidth = 0;
let mockSystemTheme: 'light' | 'dark' = 'light';
jest.mock('react-native', () => ({
  ...jest.requireActual('react-native-web'),
  useWindowDimensions: () => ({ width: mockWidth, height: 844, scale: 1, fontScale: 1 }),
  useColorScheme: () => mockSystemTheme,
}));
jest.mock('@/context/AuthProvider', () => ({ useAuth: () => ({ user: null }) }));
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn() }));
jest.mock('@expo/vector-icons/MaterialIcons', () => ({
  __esModule: true,
  default: () => null,
}));

function ShellControls() {
  return (
    <ThemeProvider>
      <WebThemeToggle />
      <WebInstallCta />
      <Button variant="outline">Continue with email</Button>
      <Input placeholder="name@school.edu" />
    </ThemeProvider>
  );
}

describe('static web shell hydration', () => {
  let container: HTMLDivElement;
  let root: Root | undefined;
  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.clear();
    mockWidth = 0;
    mockSystemTheme = 'light';
    container = document.createElement('div');
    document.body.appendChild(container);
  });
  afterEach(async () => {
    if (root) await act(async () => root?.unmount());
    root = undefined;
    container.remove();
    jest.restoreAllMocks();
  });

  it.each([
    [1440, 'light', null],
    [1440, 'dark', null],
    [390, 'dark', null],
    [1440, 'light', 'dark'],
  ] as const)('hydrates at width %i with system %s and stored %s', async (width, system, saved) => {
    const errors: unknown[] = [];
    const consoleError = jest.spyOn(console, 'error').mockImplementation((...args) => {
      errors.push(args);
    });
    container.innerHTML = renderToString(<ShellControls />);
    expect(container.textContent).toContain('Get VarsityHub on the App Store');
    mockWidth = width;
    mockSystemTheme = system;
    if (saved) localStorage.setItem('vh_theme_preference_global', saved);
    await act(async () => {
      root = hydrateRoot(container, <ShellControls />, {
        onRecoverableError: (error: unknown) => errors.push(error),
      });
    });
    expect(errors).toEqual([]);
    consoleError.mockRestore();
    if (width >= 1200) {
      expect(container.textContent).toContain('Download on the App Store');
      expect(container.textContent).toContain((saved ?? system) === 'dark' ? 'Dark' : 'Light');
      // The hydrated controls must still respond to later viewport changes.
      mockWidth = 390;
      await act(async () => root?.render(<ShellControls />));
    }
    expect(container.textContent).toContain('Get VarsityHub on the App Store');
    expect(container.querySelector('[aria-label="Expand theme controls"]')).toBeNull();
  });
});
