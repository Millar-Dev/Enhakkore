import { USERNAME_PATTERN } from '@enhakkore/shared';
import { prisma } from '../lib/prisma';

/** Usernames that could be mistaken for the team. */
const RESERVED = new Set(['admin', 'enhakkore', 'support', 'help', 'team', 'staff', 'official', 'moderator', 'wsc']);
export async function usernameProblem(username: string, userId?: string): Promise<string | null> {
  if (!USERNAME_PATTERN.test(username)) return 'Use 3–20 letters, numbers, dots or underscores.';
  if (RESERVED.has(username) || username.startsWith('enhakkore')) return 'That username is reserved.';
  const taken = await prisma.user.findFirst({ where: { username, ...(userId ? { id: { not: userId } } : {}) }, select: { id: true } });
  return taken ? 'That username is taken.' : null;
}

