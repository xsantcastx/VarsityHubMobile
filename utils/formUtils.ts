/**
 * Form utilities for validation, sanitization, and state management
 */

// ============================================
// INPUT SANITIZATION
// ============================================

/**
 * Sanitize text input to prevent XSS and clean up whitespace
 */
export function sanitizeText(input: string): string {
  if (!input) return '';
  return input
    .replace(/[<>]/g, '') // Remove angle brackets (basic XSS prevention)
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove inline event handlers
    .trim();
}

/**
 * Sanitize and normalize email
 */
export function sanitizeEmail(email: string): string {
  if (!email) return '';
  return email.toLowerCase().trim();
}

/**
 * Sanitize username - only allow alphanumeric, underscores, dots
 */
export function sanitizeUsername(username: string): string {
  if (!username) return '';
  return username
    .toLowerCase()
    .replace(/[^a-z0-9_.]/g, '')
    .substring(0, 20);
}

// ============================================
// VALIDATION RULES
// ============================================

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export const DISPLAY_NAME_MAX_LENGTH = 120;
export const BIO_MAX_LENGTH = 300;

/**
 * Validate email format
 */
export function validateEmail(email: string): ValidationResult {
  if (!email) return { valid: false, error: 'Email is required' };
  // Stricter regex aligned with backend Zod z.string().email() (RFC 5322 subset)
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Please enter a valid email address' };
  }
  return { valid: true };
}

/**
 * Validate password strength with comprehensive requirements
 */
export function validatePassword(password: string, minLength = 8, requireStrong = true): ValidationResult {
  if (!password) return { valid: false, error: 'Password is required' };
  if (password.length < minLength) {
    return { valid: false, error: `Password must be at least ${minLength} characters` };
  }

  if (requireStrong) {
    // Must match backend: at least one letter and one number
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /\d/.test(password);

    const requirements: string[] = [];
    if (!hasLetter) requirements.push('one letter');
    if (!hasNumber) requirements.push('one number');

    if (requirements.length > 0) {
      return {
        valid: false,
        error: `Password must contain ${requirements.join(' and ')}`,
      };
    }
  }

  return { valid: true };
}

/**
 * Calculate password strength score (0-4)
 * 0 = very weak, 1 = weak, 2 = fair, 3 = good, 4 = strong
 */
export function calculatePasswordStrength(password: string): { score: number; feedback: string } {
  if (!password) return { score: 0, feedback: 'Very weak' };
  
  let score = 0;
  
  // Length check
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  
  // Character diversity
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score++;
  
  // Cap at 4
  score = Math.min(4, score);
  
  const feedback = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'][score];
  return { score, feedback };
}

/**
 * Validate username format
 */
export function validateUsername(username: string): ValidationResult {
  if (!username) return { valid: false, error: 'Username is required' };
  if (username.length < 3) {
    return { valid: false, error: 'Username must be at least 3 characters' };
  }
  if (username.length > 20) {
    return { valid: false, error: 'Username must be 20 characters or less' };
  }
  if (!/^[a-z0-9_.]+$/.test(username)) {
    return { valid: false, error: 'Username can only contain lowercase letters, numbers, dots, and underscores' };
  }
  return { valid: true };
}

/**
 * Validate display name against backend limits.
 */
export function validateDisplayName(displayName: string): ValidationResult {
  if (!displayName?.trim()) return { valid: true };
  return validateTextField(displayName.trim(), 'Display name', {
    required: false,
    minLength: 1,
    maxLength: DISPLAY_NAME_MAX_LENGTH,
  });
}

/**
 * Validate bio against backend limits.
 */
export function validateBio(bio: string): ValidationResult {
  if (!bio?.trim()) return { valid: true };
  return validateTextField(bio, 'Bio', {
    required: false,
    maxLength: BIO_MAX_LENGTH,
  });
}

/**
 * Validate required text field with min/max length
 */
export function validateTextField(
  value: string,
  fieldName: string,
  options: { required?: boolean; minLength?: number; maxLength?: number } = {}
): ValidationResult {
  const { required = true, minLength, maxLength } = options;

  if (required && !value?.trim()) {
    return { valid: false, error: `${fieldName} is required` };
  }

  if (minLength && value && value.trim().length < minLength) {
    return { valid: false, error: `${fieldName} must be at least ${minLength} characters` };
  }

  if (maxLength && value && value.length > maxLength) {
    return { valid: false, error: `${fieldName} must be ${maxLength} characters or less` };
  }

  return { valid: true };
}

/**
 * Validate ZIP code (US format)
 */
export function validateZipCode(zip: string): ValidationResult {
  if (!zip) return { valid: true }; // Optional field
  const zipRegex = /^\d{5}$/;
  if (!zipRegex.test(zip)) {
    return { valid: false, error: 'Please enter a valid 5-digit ZIP code (e.g., 12345)' };
  }
  return { valid: true };
}

/**
 * Validate phone number (flexible format)
 */
export function validatePhone(phone: string): ValidationResult {
  if (!phone) return { valid: true }; // Optional field
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 11) {
    return { valid: false, error: 'Please enter a valid phone number' };
  }
  return { valid: true };
}

/**
 * Validate year (e.g., graduation year)
 */
export function validateYear(
  year: string,
  options: { min?: number; max?: number } = {}
): ValidationResult {
  if (!year) return { valid: true }; // Optional
  const { min = 1900, max = 2100 } = options;
  const yearNum = parseInt(year, 10);
  if (isNaN(yearNum) || yearNum < min || yearNum > max) {
    return { valid: false, error: `Please enter a valid year between ${min} and ${max}` };
  }
  return { valid: true };
}

/**
 * Validate URL format
 */
export function validateUrl(url: string): ValidationResult {
  if (!url) return { valid: true }; // Optional
  try {
    new URL(url);
    return { valid: true };
  } catch {
    return { valid: false, error: 'Please enter a valid URL' };
  }
}

// ============================================
// FORM STATE HELPERS
// ============================================

export interface FormErrors {
  [key: string]: string | undefined;
}

/**
 * Check if form has any errors
 */
export function hasErrors(errors: FormErrors): boolean {
  return Object.values(errors).some(error => !!error);
}

/**
 * Clear specific field error
 */
export function clearFieldError(errors: FormErrors, field: string): FormErrors {
  const { [field]: _, ...rest } = errors;
  return rest;
}

/**
 * Create a debounced validation function
 */
export function createDebouncedValidator<T>(
  validator: (value: T) => ValidationResult,
  delayMs: number = 300
): (value: T, callback: (result: ValidationResult) => void) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (value: T, callback: (result: ValidationResult) => void) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      callback(validator(value));
    }, delayMs);
  };
}

// ============================================
// NUMBER VALIDATION
// ============================================

/**
 * Validate numeric input
 */
export function validateNumber(
  value: string,
  options: { min?: number; max?: number; integer?: boolean } = {}
): ValidationResult {
  if (!value) return { valid: true }; // Optional

  const { min, max, integer = false } = options;
  const num = parseFloat(value);

  if (isNaN(num)) {
    return { valid: false, error: 'Please enter a valid number' };
  }

  if (integer && !Number.isInteger(num)) {
    return { valid: false, error: 'Please enter a whole number' };
  }

  if (min !== undefined && num < min) {
    return { valid: false, error: `Value must be at least ${min}` };
  }

  if (max !== undefined && num > max) {
    return { valid: false, error: `Value must be at most ${max}` };
  }

  return { valid: true };
}

/**
 * Prevent negative numbers in input
 */
export function preventNegative(value: string): string {
  const num = parseFloat(value);
  if (!isNaN(num) && num < 0) {
    return '0';
  }
  return value;
}
