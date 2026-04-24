export type AvailableAuthMethod = 'password' | 'google' | 'apple';

type ProviderLinkedUserLike = {
  email?: string | null;
  password_hash?: string | null;
  google_id?: string | null;
  apple_id?: string | null;
};

export function getAvailableAuthMethods(
  user: ProviderLinkedUserLike | null | undefined
): AvailableAuthMethod[] {
  if (!user) return [];

  const methods: AvailableAuthMethod[] = [];
  if (user.password_hash) methods.push('password');
  if (user.google_id) methods.push('google');
  if (user.apple_id) methods.push('apple');
  return methods;
}

export function getLinkedProviders(user: ProviderLinkedUserLike | null | undefined): {
  password: boolean;
  google: boolean;
  apple: boolean;
} {
  return {
    password: !!user?.password_hash,
    google: !!user?.google_id,
    apple: !!user?.apple_id,
  };
}

export function buildOAuthExistingAccountConflict(params: {
  email: string;
  user: ProviderLinkedUserLike | null | undefined;
  providerLabel: 'Google' | 'Apple';
}) {
  return {
    code: 'OAUTH_EXISTING_ACCOUNT_MATCH' as const,
    email: params.email,
    available_methods: getAvailableAuthMethods(params.user),
    error: `An account already exists for ${params.email}. Sign in to that account first, then connect ${params.providerLabel} from Settings.`,
  };
}
