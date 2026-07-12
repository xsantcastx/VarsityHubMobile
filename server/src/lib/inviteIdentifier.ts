import type { PrismaClient } from '@prisma/client';

type InviteIdentifierResolution =
  | {
      email: string;
      inputType: 'email';
      resolvedUserId: null;
    }
  | {
      email: string;
      inputType: 'username';
      resolvedUserId: string;
    };

export class InviteIdentifierError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode = 400, code = 'INVALID_IDENTIFIER') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeInviteIdentifier(rawIdentifier: string): string {
  return rawIdentifier.trim();
}

export async function resolveInviteIdentifier(
  prisma: PrismaClient,
  rawIdentifier: string
): Promise<InviteIdentifierResolution> {
  const identifier = normalizeInviteIdentifier(rawIdentifier);
  if (!identifier) {
    throw new InviteIdentifierError('Enter a username or email address.');
  }

  if (EMAIL_PATTERN.test(identifier)) {
    return {
      email: identifier.toLowerCase(),
      inputType: 'email',
      resolvedUserId: null,
    };
  }

  const username = identifier.replace(/^@+/, '').trim();
  if (!username) {
    throw new InviteIdentifierError('Enter a valid username or email address.');
  }

  const user = await prisma.user.findFirst({
    where: {
      username: { equals: username, mode: 'insensitive' },
    },
    select: {
      id: true,
      email: true,
    },
  });

  if (!user?.email) {
    throw new InviteIdentifierError(
      'No VarsityHub account matches that username yet. Enter an email instead.',
      404,
      'USERNAME_NOT_FOUND'
    );
  }

  return {
    email: user.email.toLowerCase(),
    inputType: 'username',
    resolvedUserId: user.id,
  };
}
