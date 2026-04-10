// Centralized role helpers to avoid accidental inclusion of plan tiers as roles.
export type UserRole = 'fan' | 'coach';

export function isCoach(role?: string | null): boolean {
  return role === 'coach';
}

export function isFan(role?: string | null): boolean {
  return role === 'fan';
}

export function assertCoach(role?: string | null): void {
  if (!isCoach(role)) {
    throw new Error('COACH_ROLE_REQUIRED');
  }
}
