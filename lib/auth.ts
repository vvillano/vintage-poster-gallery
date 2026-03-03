import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { sql } from '@vercel/postgres';

// Parse team credentials from environment variables (fallback)
function getTeamCredentials(): Map<string, string> {
  const credentials = new Map<string, string>();

  // Parse TEAM_USER_1, TEAM_USER_2, etc. from environment
  for (let i = 1; i <= 10; i++) {
    const envVar = process.env[`TEAM_USER_${i}`];
    if (envVar) {
      const [username, passwordHash] = envVar.split(':');
      if (username && passwordHash) {
        credentials.set(username.toLowerCase(), passwordHash);
      }
    }
  }

  return credentials;
}

// Try DB lookup first, fall back to env vars
async function findUser(username: string): Promise<{ id: string; name: string; role: string; passwordHash: string } | null> {
  const normalizedUsername = username.toLowerCase();

  // 1. Try database first
  try {
    const result = await sql`
      SELECT id, username, password_hash, role FROM users
      WHERE username = ${normalizedUsername} AND active = true
    `;
    if (result.rows.length > 0) {
      const row = result.rows[0];
      return {
        id: String(row.id),
        name: row.username,
        role: row.role,
        passwordHash: row.password_hash,
      };
    }
  } catch {
    // Table might not exist yet (pre-migration). Fall through to env vars.
  }

  // 2. Fall back to environment variables
  const teamCredentials = getTeamCredentials();
  const storedHash = teamCredentials.get(normalizedUsername);
  if (storedHash) {
    return {
      id: normalizedUsername,
      name: username,
      role: 'admin', // Env var users get admin by default (legacy behavior)
      passwordHash: storedHash,
    };
  }

  return null;
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }

        const user = await findUser(credentials.username);
        if (!user) return null;

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!isValid) return null;

        return {
          id: user.id,
          name: user.name,
          email: `${user.name.toLowerCase()}@gallery.local`,
          role: user.role,
        };
      },
    }),
  ],
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.role = (user as { role?: string }).role || 'member';
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.name = token.name as string;
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
};
