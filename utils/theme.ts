/**
 * Theme utilities for managing color gradients and theming
 * Centralized theme logic for reuse across components
 */

export const THEME_COLOR_GRADIENTS: { [key: string]: string[] } = {
  '#3B82F6': ['#1e3a8a', '#3b82f6', '#60a5fa'], // VarsityHub Blue
  '#DC2626': ['#7f1d1d', '#dc2626', '#ef4444'], // Championship Red
  '#10B981': ['#065f46', '#10b981', '#34d399'], // Victory Green
  '#F59E0B': ['#78350f', '#f59e0b', '#fbbf24'], // Gold Medal
  '#8B5CF6': ['#4c1d95', '#8b5cf6', '#a78bfa'], // Royal Purple
  '#6B7280': ['#1f2937', '#6b7280', '#9ca3af'], // Classic Gray
};

export const DEFAULT_THEME_COLOR = '#3B82F6';
export const DEFAULT_GRADIENT = THEME_COLOR_GRADIENTS[DEFAULT_THEME_COLOR];

/**
 * Get gradient colors for a given theme color
 * Returns default gradient if color not found
 */
export function getGradientForColor(color: string): string[] {
  return THEME_COLOR_GRADIENTS[color] || DEFAULT_GRADIENT;
}

/**
 * Validate if a color is a supported theme color
 */
export function isValidThemeColor(color: string): boolean {
  return color in THEME_COLOR_GRADIENTS;
}

/**
 * Get all available theme colors
 */
export function getAvailableThemeColors(): string[] {
  return Object.keys(THEME_COLOR_GRADIENTS);
}

/**
 * Get theme color name for display
 */
export function getThemeColorName(color: string): string {
  const names: { [key: string]: string } = {
    '#3B82F6': 'VarsityHub Blue',
    '#DC2626': 'Championship Red',
    '#10B981': 'Victory Green',
    '#F59E0B': 'Gold Medal',
    '#8B5CF6': 'Royal Purple',
    '#6B7280': 'Classic Gray',
  };
  return names[color] || 'Custom';
}
