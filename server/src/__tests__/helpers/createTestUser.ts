type CreateTestUserArgs = {
  prisma: any;
  signJwt: (payload: { id: string }) => string;
  password: string;
  email: string;
  displayName: string;
  role: 'fan' | 'coach';
  plan?: 'rookie' | 'veteran' | 'legend';
  username?: string;
  extras?: Record<string, any>;
};

export async function createTestUser({
  prisma,
  signJwt,
  password,
  email,
  displayName,
  role,
  plan,
  username,
  extras,
}: CreateTestUserArgs) {
  const bcrypt = (await import('bcrypt')).default;
  const hash = await bcrypt.hash(password, 10);
  const preferences: any = { role, onboarding_completed: true };
  if (plan) preferences.plan = plan;
  if (role === 'coach') {
    preferences.coach_agreement_accepted_at = new Date().toISOString();
  }

  const user = await prisma.user.create({
    data: {
      email,
      password_hash: hash,
      display_name: displayName,
      username,
      email_verified: true,
      // Mirror canonical role + onboarding columns; runtime readers prefer
      // columns over preferences JSON and the column defaults can misread
      // prefs-only fixtures.
      role,
      onboarding_completed: true,
      ...(role === 'coach' ? { approval_status: 'APPROVED' } : {}),
      preferences,
      ...extras,
    },
  });

  return { id: user.id as string, token: signJwt({ id: user.id }) as string };
}
