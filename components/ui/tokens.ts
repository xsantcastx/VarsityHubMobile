// Design tokens for typography, colors, and spacing

export const Type = {
  h0: {
    fontSize: 32,
    fontWeight: '800' as const,
    lineHeight: 40,
  },
  h1: {
    fontSize: 28,
    fontWeight: '700' as const,
    lineHeight: 36,
  },
  h2: {
    fontSize: 24,
    fontWeight: '700' as const,
    lineHeight: 32,
  },
  h3: {
    fontSize: 20,
    fontWeight: '600' as const,
    lineHeight: 28,
  },
  heading: {
    fontSize: 24,
    fontWeight: '700' as const,
    lineHeight: 32,
  },
  subheading: {
    fontSize: 20,
    fontWeight: '600' as const,
    lineHeight: 28,
  },
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '500' as const,
    lineHeight: 20,
  },
  caption: {
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 16,
  },
  sub: {
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 20,
    color: '#6B7280',
  },
};

export const Color = {
  primary: '#2563EB',
  secondary: '#64748B',
  accent: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  success: '#10B981',
  text: '#111827',
  textMuted: '#6B7280',
  background: '#FFFFFF',
  surface: '#F9FAFB',
  border: '#D1D5DB',
  placeholder: '#9CA3AF',
  pageBg: '#F3F4F6',
  tabBg: '#D1D5DB',
  infoTile: '#DBEAFE',
  borderMuted: '#D1D5DB',
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};
