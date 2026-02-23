import { isValidZipCode } from './zipCodeUtils';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateZipCode(zip: string): ValidationResult {
  if (!zip?.trim()) return { valid: true };
  if (!isValidZipCode(zip)) {
    return { valid: false, error: 'Please enter a valid zip code.' };
  }
  return { valid: true };
}

export function validateYear(
  value: string,
  opts?: { min?: number; max?: number }
): ValidationResult {
  if (!value?.trim()) return { valid: true };
  const year = parseInt(value, 10);
  if (isNaN(year) || year < 1900 || year > 2100) {
    return { valid: false, error: 'Please enter a valid year.' };
  }
  if (opts?.min != null && year < opts.min) {
    return { valid: false, error: `Year must be at least ${opts.min}.` };
  }
  if (opts?.max != null && year > opts.max) {
    return { valid: false, error: `Year must be at most ${opts.max}.` };
  }
  return { valid: true };
}
