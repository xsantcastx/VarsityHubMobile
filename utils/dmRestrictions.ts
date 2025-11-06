/**
 * DM Restrictions Utility
 * Handles age-based messaging restrictions per Safe Zone Policy
 */

export type DMRestrictionResult = {
  allowed: boolean;
  reason?: 'adult_to_minor' | 'coach_verified' | 'both_minors' | 'admin_bypass' | 'allowed';
  showWarning?: boolean;
  warningMessage?: string;
};

/**
 * Calculate age from date of birth
 */
export function calculateAge(dateOfBirth: string | Date | null | undefined): number | null {
  if (!dateOfBirth) return null;
  
  try {
    const dob = typeof dateOfBirth === 'string' ? new Date(dateOfBirth) : dateOfBirth;
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    
    return age;
  } catch {
    return null;
  }
}

/**
 * Check if user is a minor (under 18)
 */
export function isMinor(dateOfBirth: string | Date | null | undefined): boolean {
  const age = calculateAge(dateOfBirth);
  return age !== null && age < 18;
}

/**
 * Check if user is verified coach
 */
export function isVerifiedCoach(user: any): boolean {
  const role = user?.preferences?.role || user?.role || '';
  const isCoach = String(role).toLowerCase() === 'coach';
  const isVerified = user?.is_verified || user?.coach_verified || false;
  return isCoach && isVerified;
}

/**
 * Check if user is admin
 */
export function isAdmin(user: any): boolean {
  return user?.is_admin === true || user?.role === 'admin';
}

/**
 * Check if DM is allowed between sender and recipient
 * Returns detailed result for UI handling
 */
export function checkDMRestriction(
  sender: any,
  recipient: any
): DMRestrictionResult {
  // Admin bypass - admins can message anyone
  if (isAdmin(sender) || isAdmin(recipient)) {
    return { allowed: true, reason: 'admin_bypass' };
  }

  const senderAge = calculateAge(sender?.date_of_birth || sender?.preferences?.date_of_birth || sender?.dob);
  const recipientAge = calculateAge(recipient?.date_of_birth || recipient?.preferences?.date_of_birth || recipient?.dob);

  // If we can't determine ages, allow (fallback to backend validation)
  if (senderAge === null || recipientAge === null) {
    return { allowed: true, reason: 'allowed' };
  }

  const senderIsMinor = senderAge < 18;
  const recipientIsMinor = recipientAge < 18;

  // Both minors - allowed
  if (senderIsMinor && recipientIsMinor) {
    return { allowed: true, reason: 'both_minors' };
  }

  // Adult to adult - allowed
  if (!senderIsMinor && !recipientIsMinor) {
    return { allowed: true, reason: 'allowed' };
  }

  // Adult trying to message minor
  if (!senderIsMinor && recipientIsMinor) {
    // Check if sender is verified coach
    if (isVerifiedCoach(sender)) {
      return { allowed: true, reason: 'coach_verified' };
    }

    // Block with warning
    return {
      allowed: false,
      reason: 'adult_to_minor',
      showWarning: true,
      warningMessage: `You cannot message users under 18. Direct messaging between adults and minors is restricted for safety reasons.${
        sender?.preferences?.role === 'coach' ? '\n\nIf you are a coach, please verify your account to message your team members.' : ''
      }`,
    };
  }

  // Minor trying to message adult - also restricted for consistency
  if (senderIsMinor && !recipientIsMinor) {
    // Allow if recipient is verified coach
    if (isVerifiedCoach(recipient)) {
      return { allowed: true, reason: 'coach_verified' };
    }

    return {
      allowed: false,
      reason: 'adult_to_minor',
      showWarning: true,
      warningMessage: 'For your safety, direct messaging with adults is restricted. You can message verified coaches and team staff.',
    };
  }

  // Default fallback
  return { allowed: true, reason: 'allowed' };
}
