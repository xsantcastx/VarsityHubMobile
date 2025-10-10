/**
 * Accessibility constants following WCAG 2.1 AA guidelines
 */

// Minimum tap target size (44x44 points per Apple/Android guidelines)
export const MIN_TAP_TARGET_SIZE = 44;

// Minimum contrast ratios for WCAG 2.1 AA
export const CONTRAST_RATIOS = {
  NORMAL_TEXT: 4.5,      // Normal text (< 18pt or < 14pt bold)
  LARGE_TEXT: 3,         // Large text (≥ 18pt or ≥ 14pt bold)
  UI_COMPONENTS: 3,      // Interactive UI components and graphics
};

// Common accessible tap target styles
export const TapTarget = {
  minimum: {
    minWidth: MIN_TAP_TARGET_SIZE,
    minHeight: MIN_TAP_TARGET_SIZE,
  },
  
  // For small visual elements that need larger hit areas
  expandedHitSlop: {
    top: 8,
    bottom: 8,
    left: 8,
    right: 8,
  },
  
  // Standard padding to achieve 44pt target
  standardPadding: 12, // 44pt - 20pt icon = 24pt / 2 = 12pt per side
};

// High contrast color pairs (WCAG AA compliant)
export const AccessibleColors = {
  // Dark text on light backgrounds
  darkOnLight: {
    text: '#111827',      // Gray 900
    background: '#FFFFFF',
    contrast: 16.1,       // Exceeds AA (4.5:1)
  },
  
  // Light text on dark backgrounds
  lightOnDark: {
    text: '#FFFFFF',
    background: '#111827',
    contrast: 16.1,
  },
  
  // Primary blue (accessible on white)
  primaryOnLight: {
    text: '#1E40AF',      // Blue 800
    background: '#FFFFFF',
    contrast: 8.6,        // Exceeds AA
  },
  
  // Error red (accessible on white)
  errorOnLight: {
    text: '#991B1B',      // Red 800
    background: '#FFFFFF',
    contrast: 8.3,        // Exceeds AA
  },
  
  // Success green (accessible on white)
  successOnLight: {
    text: '#065F46',      // Green 800
    background: '#FFFFFF',
    contrast: 7.8,        // Exceeds AA
  },
  
  // Muted text (still meets AA for normal text)
  mutedOnLight: {
    text: '#4B5563',      // Gray 600
    background: '#FFFFFF',
    contrast: 7.5,        // Exceeds AA (4.5:1)
  },
};

// Helper to ensure minimum dimensions
export const ensureTapTarget = (size: number): number => {
  return Math.max(size, MIN_TAP_TARGET_SIZE);
};

// Accessibility labels for common actions
export const AccessibilityLabels = {
  back: 'Go back',
  close: 'Close',
  menu: 'Open menu',
  search: 'Search',
  filter: 'Filter results',
  sort: 'Sort options',
  share: 'Share',
  like: 'Like',
  comment: 'Comment',
  save: 'Save',
  delete: 'Delete',
  edit: 'Edit',
  settings: 'Settings',
  notifications: 'Notifications',
  profile: 'Profile',
  messages: 'Messages',
  refresh: 'Refresh',
  loadMore: 'Load more',
};
