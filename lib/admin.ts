import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * Get the current session and check if the user is an admin.
 * Throws an error string if not authorized.
 */
export async function requireAdmin(): Promise<{ username: string; role: string }> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.name) {
    throw new Error('Unauthorized');
  }

  const role = (session as unknown as { user: { role?: string } }).user.role || 'member';
  if (role !== 'admin') {
    throw new Error('Admin access required');
  }

  return { username: session.user.name, role };
}

/**
 * Check if the current session user is an admin.
 */
export async function isAdmin(): Promise<boolean> {
  try {
    await requireAdmin();
    return true;
  } catch {
    return false;
  }
}
