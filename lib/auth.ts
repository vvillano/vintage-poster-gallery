import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';

// Parse team credentials from environment variables
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

        const teamCredentials = getTeamCredentials();
        const username = credentials.username.toLowerCase();
        const storedHash = teamCredentials.get(username);

        if (!storedHash) {
          return null;
        }

        // Verify password
        const isValid = await bcrypt.compare(credentials.password, storedHash);

        if (!isValid) {
          return null;
        }

        // Return user object
        return {
          id: username,
          name: credentials.username,
          email: `${username}@gallery.local`,
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
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.name = token.name as string;
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
