/**
 * Design System Tokens
 * Centralized spacing, typography, and style constants
 */
import { Platform } from 'react-native';

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const typography = {
  caption: {
    fontSize: 12,
    lineHeight: 16,
  },
  captionBold: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600' as const,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
  },
  bodyBold: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600' as const,
  },
  bodyLarge: {
    fontSize: 16,
    lineHeight: 24,
  },
  bodyLargeBold: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600' as const,
  },
  heading: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '700' as const,
  },
  title: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '800' as const,
  },
  display: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '800' as const,
  },
} as const;

export const radius = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export const shadows = {
  none: {
    ...(Platform.OS === 'web'
      ? { boxShadow: 'none' }
      : {
          shadowColor: 'transparent',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0,
          shadowRadius: 0,
        }),
    elevation: 0,
  },
  sm: {
    ...(Platform.OS === 'web'
      ? { boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.05)' }
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 2,
        }),
    elevation: 1,
  },
  md: {
    ...(Platform.OS === 'web'
      ? { boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)' }
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        }),
    elevation: 3,
  },
  lg: {
    ...(Platform.OS === 'web'
      ? { boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.15)' }
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 8,
        }),
    elevation: 5,
  },
  xl: {
    ...(Platform.OS === 'web'
      ? { boxShadow: '0px 6px 12px rgba(0, 0, 0, 0.2)' }
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.2,
          shadowRadius: 12,
        }),
    elevation: 8,
  },
} as const;

/** Use for consistent workflow boundaries: thin = list/section dividers, medium = major section/card boundaries */
export const borderWidth = {
  thin: 1,
  medium: 2,
  thick: 3,
} as const;
