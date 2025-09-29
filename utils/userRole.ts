export function normalizeUserRole(role?: string | null, plan?: string | null): 'coach' | 'fan' {
  const raw = typeof role === 'string' ? role.trim().toLowerCase() : '';
  const planValue = typeof plan === 'string' ? plan.trim().toLowerCase() : '';
  const coachPlan = planValue === 'veteran' || planValue === 'legend';

  if (!raw) {
    return coachPlan ? 'coach' : 'fan';
  }

  if (raw === 'fan' || raw === 'supporter') {
    return 'fan';
  }

  if (raw === 'coach') {
    return 'coach';
  }

  const coachKeywords = ['coach', 'organizer', 'manager', 'staff', 'owner', 'director', 'admin'];
  if (coachKeywords.some((keyword) => raw.includes(keyword))) {
    return 'coach';
  }

  if (coachPlan) {
    return 'coach';
  }

  return 'fan';
}

export function isCoachRole(role?: string | null, plan?: string | null): boolean {
  return normalizeUserRole(role, plan) === 'coach';
}
