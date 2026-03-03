import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';

/**
 * POST /api/migrate/users-table
 * Create the users table and seed existing env-var users.
 * The first user seeded becomes admin.
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results: string[] = [];

    // Create users table
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'member',
        active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    results.push('Created users table');

    // Check if table already has users
    const existing = await sql`SELECT COUNT(*) as count FROM users`;
    if (parseInt(existing.rows[0].count) > 0) {
      results.push(`Users table already has ${existing.rows[0].count} users, skipping seed`);
      return NextResponse.json({ success: true, results });
    }

    // Seed from environment variables
    let seeded = 0;
    let firstUser = true;

    for (let i = 1; i <= 10; i++) {
      const envVar = process.env[`TEAM_USER_${i}`];
      if (envVar) {
        const [username, passwordHash] = envVar.split(':');
        if (username && passwordHash) {
          const role = firstUser ? 'admin' : 'member';
          await sql`
            INSERT INTO users (username, password_hash, role)
            VALUES (${username.toLowerCase()}, ${passwordHash}, ${role})
            ON CONFLICT (username) DO NOTHING
          `;
          results.push(`Seeded user: ${username.toLowerCase()} (${role})`);
          seeded++;
          firstUser = false;
        }
      }
    }

    // If no env var users found, create a default admin
    if (seeded === 0) {
      const defaultHash = await bcrypt.hash('changeme', 10);
      await sql`
        INSERT INTO users (username, password_hash, role)
        VALUES ('admin', ${defaultHash}, 'admin')
        ON CONFLICT (username) DO NOTHING
      `;
      results.push('Created default admin user (password: changeme) - CHANGE THIS IMMEDIATELY');
    }

    results.push(`Seeded ${seeded} users from environment variables`);

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('Users migration error:', error);
    return NextResponse.json(
      { error: 'Migration failed', details: String(error) },
      { status: 500 }
    );
  }
}
