import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';
import { requireAdmin } from '@/lib/admin';

/**
 * GET /api/admin/users - List all users (admin only)
 */
export async function GET() {
  try {
    await requireAdmin();

    const result = await sql`
      SELECT id, username, role, active, created_at, updated_at
      FROM users
      ORDER BY created_at ASC
    `;

    return NextResponse.json({ users: result.rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list users';
    const status = message === 'Unauthorized' ? 401 : message === 'Admin access required' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * POST /api/admin/users - Create a new user (admin only)
 */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();

    const { username, password, role } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const validRoles = ['admin', 'member'];
    const userRole = validRoles.includes(role) ? role : 'member';

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await sql`
      INSERT INTO users (username, password_hash, role)
      VALUES (${username.toLowerCase().trim()}, ${passwordHash}, ${userRole})
      RETURNING id, username, role, active, created_at, updated_at
    `;

    return NextResponse.json({ user: result.rows[0] }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create user';
    if (message.includes('duplicate key') || message.includes('unique constraint')) {
      return NextResponse.json({ error: 'Username already exists' }, { status: 409 });
    }
    const status = message === 'Unauthorized' ? 401 : message === 'Admin access required' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
