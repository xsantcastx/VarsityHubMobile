import { Platform } from 'react-native';

type Theme = 'light' | 'dark';
type Variant = 'full' | 'compact';

type TeamPaletteInput = {
  id?: string;
  name?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
};

type PaletteOverrides = {
  backgroundGradient?: [string, string];
  streakGradient?: [string, string, string];
  rimGlow?: string;
  glassTint?: string;
};

type ResolvePaletteInput = {
  home?: TeamPaletteInput | null;
  away?: TeamPaletteInput | null;
  appearance?: 'classic' | 'sparkle' | 'sporty';
  theme?: Theme;
  variant?: Variant;
  overrides?: PaletteOverrides & { leftColor?: string | null; rightColor?: string | null };
};

type MotionConfig = {
  glowIntensity: number;
  sweepDuration: number;
};

type MatchBannerPalette = {
  backgroundGradient: [string, string];
  streakGradient: { colors: string[]; locations: number[] };
  rimGlow: string;
  glassTint: string;
  accent: string;
  text: { primary: string; secondary: string };
  motion: MotionConfig;
  isFallback: boolean;
};

type GradientFamily = {
  light: {
    background: [string, string];
    streak: [string, string];
    rimGlow: string;
    glassTint: string;
  };
  dark: {
    background: [string, string];
    streak: [string, string];
    rimGlow: string;
    glassTint: string;
  };
};

const GRADIENT_FAMILIES: Record<string, GradientFamily> = {
  blaze: {
    light: {
      background: ['#ff6b3d', '#f43f5e'],
      streak: ['#ffd29d', '#f97316'],
      rimGlow: '#ffd29d',
      glassTint: 'rgba(255,255,255,0.08)',
    },
    dark: {
      background: ['#8b1d3b', '#ef4444'],
      streak: ['#ff8ba4', '#f97316'],
      rimGlow: '#ff8ba4',
      glassTint: 'rgba(255,255,255,0.06)',
    },
  },
  midnight: {
    light: {
      background: ['#1d4ed8', '#312e81'],
      streak: ['#60a5fa', '#93c5fd'],
      rimGlow: '#60a5fa',
      glassTint: 'rgba(255,255,255,0.05)',
    },
    dark: {
      background: ['#020617', '#1d1b4b'],
      streak: ['#5b21b6', '#2563eb'],
      rimGlow: '#5b21b6',
      glassTint: 'rgba(0,0,0,0.24)',
    },
  },
  neon: {
    light: {
      background: ['#22d3ee', '#a855f7'],
      streak: ['#cffafe', '#f0abfc'],
      rimGlow: '#cffafe',
      glassTint: 'rgba(255,255,255,0.05)',
    },
    dark: {
      background: ['#0f172a', '#4c1d95'],
      streak: ['#38bdf8', '#fb7185'],
      rimGlow: '#38bdf8',
      glassTint: 'rgba(0,0,0,0.32)',
    },
  },
  frost: {
    light: {
      background: ['#f8fafc', '#e0f2fe'],
      streak: ['#bae6fd', '#e2e8f0'],
      rimGlow: '#bae6fd',
      glassTint: 'rgba(255,255,255,0.12)',
    },
    dark: {
      background: ['#111827', '#1f2937'],
      streak: ['#38bdf8', '#94a3b8'],
      rimGlow: '#38bdf8',
      glassTint: 'rgba(0,0,0,0.28)',
    },
  },
};

const FAMILY_KEYWORDS: Record<string, string[]> = {
  blaze: ['flame', 'heat', 'fire', 'tiger', 'red', 'lava'],
  midnight: ['knight', 'royal', 'midnight', 'moon', 'storm'],
  neon: ['neon', 'spark', 'lightning', 'glow', 'electric'],
  frost: ['polar', 'ice', 'bear', 'frost', 'snow', 'glacier'],
};

const DEFAULT_FAMILY_ORDER = ['blaze', 'midnight', 'neon', 'frost'] as const;

const DEFAULT_TEXT: Record<Theme, { primary: string; secondary: string }> = {
  light: { primary: '#0f172a', secondary: 'rgba(15,23,42,0.75)' },
  dark: { primary: '#ffffff', secondary: 'rgba(255,255,255,0.7)' },
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const toRgb = (color?: string | null): { r: number; g: number; b: number } | null => {
  if (!color) return null;
  const hex = color.trim();
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex);
  if (!match) return null;
  let value = match[1];
  if (value.length === 3) {
    value = value.split('').map((c) => c + c).join('');
  }
  const num = parseInt(value, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
};

const rgba = (color: string, alpha: number) => {
  const rgb = toRgb(color);
  if (!rgb) return color;
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${clamp(alpha, 0, 1).toFixed(3)})`;
};

const adjustColor = (color: string | null | undefined, amount: number) => {
  const rgb = toRgb(color);
  if (!rgb) return null;
  const adjust = (c: number) => clamp(Math.round(c + (amount * 255)), 0, 255);
  const r = adjust(rgb.r);
  const g = adjust(rgb.g);
  const b = adjust(rgb.b);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
};

const hashString = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const pickFamily = (home?: TeamPaletteInput | null, away?: TeamPaletteInput | null, fallbackSeed?: string) => {
  const names = [home?.name ?? '', away?.name ?? ''].join(' ').toLowerCase();
  for (const [family, keywords] of Object.entries(FAMILY_KEYWORDS)) {
    if (keywords.some((keyword) => names.includes(keyword))) {
      return family as keyof typeof GRADIENT_FAMILIES;
    }
  }
  const seed = fallbackSeed ?? (names || `${Date.now()}`);
  const index = hashString(seed) % DEFAULT_FAMILY_ORDER.length;
  return DEFAULT_FAMILY_ORDER[index];
};

const pickFromOverrides = (overrides?: PaletteOverrides): Partial<MatchBannerPalette> => {
  if (!overrides) return {};
  return {
    backgroundGradient: overrides.backgroundGradient,
    streakGradient: overrides.streakGradient
      ? { colors: overrides.streakGradient, locations: [0, 0.48, 1] }
      : undefined,
    rimGlow: overrides.rimGlow,
    glassTint: overrides.glassTint,
  };
};

const combineGradients = (base: [string, string], primary?: string | null, secondary?: string | null): [string, string] => {
  if (primary && secondary) return [primary, secondary];
  if (primary) {
    const shifted = adjustColor(primary, 0.12) ?? primary;
    return [shifted, primary];
  }
  if (secondary) {
    const shifted = adjustColor(secondary, -0.12) ?? secondary;
    return [secondary, shifted];
  }
  return base;
};

export const resolveMatchBannerPalette = (input: ResolvePaletteInput): MatchBannerPalette => {
  const theme: Theme = input.theme ?? 'light';
  const variant: Variant = input.variant ?? 'full';
  const home = input.home ?? null;
  const away = input.away ?? null;
  const overrides = pickFromOverrides(input.overrides);

  const familyKey = pickFamily(home, away, `${home?.id ?? ''}:${away?.id ?? ''}`);
  const family = GRADIENT_FAMILIES[familyKey];
  const familyTheme = family[theme];

  const backgroundGradient = (overrides.backgroundGradient ??
    combineGradients(familyTheme.background, home?.primaryColor ?? input.overrides?.leftColor, away?.primaryColor ?? input.overrides?.rightColor)) as [string, string];

  const streakCore = overrides.streakGradient ?? {
    colors: [rgba(familyTheme.streak[0], 0.0), rgba(familyTheme.streak[0], 0.75), rgba(familyTheme.streak[1], 0.0)],
    locations: [0, 0.52, 1],
  };

  const rimGlow = overrides.rimGlow ?? familyTheme.rimGlow;
  const glassTint = overrides.glassTint ?? familyTheme.glassTint;

  const accent = adjustColor(rimGlow, theme === 'light' ? -0.1 : 0.1) ?? rimGlow;
  const text = DEFAULT_TEXT[theme];

  const motion: MotionConfig = {
    glowIntensity: input.appearance === 'sparkle' ? 0.95 : variant === 'full' ? 0.8 : 0.6,
    sweepDuration: Platform.OS === 'ios' ? 2800 : 3200,
  };

  return {
    backgroundGradient,
    streakGradient: streakCore,
    rimGlow,
    glassTint,
    accent,
    text,
    motion,
    isFallback: !home?.primaryColor && !away?.primaryColor && !input.overrides?.backgroundGradient,
  };
};

export type { MatchBannerPalette, ResolvePaletteInput };
