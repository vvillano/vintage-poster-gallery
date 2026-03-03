import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';

/**
 * POST /api/auth/change-password
 * Self-service password change for any authenticated user.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.name) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { currentPassword, newPassword } = await req.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Current and new password are required' }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'New password must be at least 6 characters' }, { status: 400 });
    }

    const username = session.user.name.toLowerCase();

    // Look up user in DB
    const result = await sql`
      SELECT id, password_hash FROM users WHERE username = ${username} AND active = true
    `;

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'User not found in database. Run the users migration first.' }, { status: 404 });
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!isValid) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 403 });
    }

    // Hash and update new password
    const newHash = await bcrypt.hash(newPassword, 10);
    await sql`
      UPDATE users SET password_hash = ${newHash}, updated_at = NOW()
      WHERE id = ${result.rows[0].id}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Change password error:', error);
    return NextResponse.json({ error: 'Failed to change password' }, { status: 500 });
  }
}
