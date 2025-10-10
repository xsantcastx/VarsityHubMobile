import { CONTRAST_RATIOS, MIN_TAP_TARGET_SIZE } from '../constants/Accessibility';

/**
 * Validates if a button/tap target meets accessibility guidelines
 */
export interface TapTargetDimensions {
  width: number;
  height: number;
}

export interface AccessibilityAudit {
  meetsMinimumSize: boolean;
  actualWidth: number;
  actualHeight: number;
  suggestedPadding?: {
    horizontal: number;
    vertical: number;
  };
}

/**
 * Audits a tap target size against WCAG/platform guidelines
 * @param dimensions - Current width and height of the tap target
 * @returns Audit result with recommendations
 */
export function auditTapTarget(dimensions: TapTargetDimensions): AccessibilityAudit {
  const { width, height } = dimensions;
  const meetsMinimumSize = width >= MIN_TAP_TARGET_SIZE && height >= MIN_TAP_TARGET_SIZE;
  
  const audit: AccessibilityAudit = {
    meetsMinimumSize,
    actualWidth: width,
    actualHeight: height,
  };
  
  if (!meetsMinimumSize) {
    const widthShortfall = MIN_TAP_TARGET_SIZE - width;
    const heightShortfall = MIN_TAP_TARGET_SIZE - height;
    
    audit.suggestedPadding = {
      horizontal: widthShortfall > 0 ? Math.ceil(widthShortfall / 2) : 0,
      vertical: heightShortfall > 0 ? Math.ceil(heightShortfall / 2) : 0,
    };
  }
  
  return audit;
}

/**
 * Calculates required padding to achieve minimum tap target size
 * @param currentSize - Current dimension (width or height)
 * @returns Required padding per side
 */
export function calculateRequiredPadding(currentSize: number): number {
  if (currentSize >= MIN_TAP_TARGET_SIZE) return 0;
  return Math.ceil((MIN_TAP_TARGET_SIZE - currentSize) / 2);
}

/**
 * Converts hex color to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * Calculates relative luminance of a color
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
function getRelativeLuminance(rgb: { r: number; g: number; b: number }): number {
  const rsRGB = rgb.r / 255;
  const gsRGB = rgb.g / 255;
  const bsRGB = rgb.b / 255;

  const r = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4);
  const g = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4);
  const b = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4);

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Calculates contrast ratio between two colors
 * https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
 */
export function calculateContrastRatio(color1: string, color2: string): number | null {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);

  if (!rgb1 || !rgb2) return null;

  const lum1 = getRelativeLuminance(rgb1);
  const lum2 = getRelativeLuminance(rgb2);

  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Checks if color contrast meets WCAG AA standard
 */
export function meetsContrastRequirement(
  foreground: string,
  background: string,
  isLargeText: boolean = false
): { passes: boolean; ratio: number | null; required: number } {
  const ratio = calculateContrastRatio(foreground, background);
  const required = isLargeText ? CONTRAST_RATIOS.LARGE_TEXT : CONTRAST_RATIOS.NORMAL_TEXT;

  return {
    passes: ratio !== null && ratio >= required,
    ratio,
    required,
  };
}

/**
 * Generates an accessibility audit report for a button
 */
export interface ButtonAccessibilityAudit {
  tapTarget: AccessibilityAudit;
  contrast?: {
    passes: boolean;
    ratio: number | null;
    required: number;
  };
  hasAccessibilityLabel: boolean;
  recommendations: string[];
}

export function auditButton(params: {
  dimensions: TapTargetDimensions;
  foreground?: string;
  background?: string;
  isLargeText?: boolean;
  accessibilityLabel?: string;
}): ButtonAccessibilityAudit {
  const { dimensions, foreground, background, isLargeText, accessibilityLabel } = params;

  const tapTargetAudit = auditTapTarget(dimensions);
  const recommendations: string[] = [];

  let contrastResult;
  if (foreground && background) {
    contrastResult = meetsContrastRequirement(foreground, background, isLargeText);
    if (!contrastResult.passes) {
      recommendations.push(
        `Increase color contrast. Current: ${contrastResult.ratio?.toFixed(2)}, Required: ${contrastResult.required}:1`
      );
    }
  }

  if (!tapTargetAudit.meetsMinimumSize) {
    recommendations.push(
      `Increase tap target size to ${MIN_TAP_TARGET_SIZE}x${MIN_TAP_TARGET_SIZE}pt minimum. ` +
        `Add padding: horizontal ${tapTargetAudit.suggestedPadding?.horizontal}pt, vertical ${tapTargetAudit.suggestedPadding?.vertical}pt`
    );
  }

  const hasLabel = !!accessibilityLabel && accessibilityLabel.trim().length > 0;
  if (!hasLabel) {
    recommendations.push('Add accessibilityLabel for screen reader support');
  }

  return {
    tapTarget: tapTargetAudit,
    contrast: contrastResult,
    hasAccessibilityLabel: hasLabel,
    recommendations,
  };
}
