export const Color = {
  // Global tones
  primary: '#2563EB',
  primaryAlt: '#1D4ED8',
  primaryText: '#FFFFFF',
  text: '#111827',
  subtext: '#6B7280',
  line: '#E5E7EB',
  surface: '#FFFFFF',
  surfaceAlt: '#F9FAFB',
  success: '#16A34A',
  accentPill: '#1D4ED8',

  // Discover page extras
  pageBg: '#F8FAFC',
  placeholder: '#9CA3AF',
  border: '#E5E7EB',
  borderMuted: '#D1D5DB',
  tabBg: '#F3F4F6',
  infoTile: '#EEF2FF',
};

export const Radius = { sm: 10, md: 12, lg: 16, pill: 999 } as const;
export const Spacing = { xs: 6, sm: 8, md: 12, lg: 16, xl: 20 } as const;

export const Type = {
  // Titles
  h0: { fontSize: 34, fontWeight: '800' as const },
  h1: { fontSize: 28, fontWeight: '800' as const },
  h2: { fontSize: 24, fontWeight: '800' as const },
  // Text
  body: { fontSize: 16, fontWeight: '600' as const },
  sub: { fontSize: 14, color: Color.subtext },
  button: { fontSize: 16, fontWeight: '800' as const },
};

