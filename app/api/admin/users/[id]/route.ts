import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';
import { requireAdmin } from '@/lib/admin';

/**
 * PUT /api/admin/users/[id] - Update user (admin only)
 * Supports: role change, active toggle, password reset
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { username: adminUsername } = await requireAdmin();
    const { id } = await params;
    const userId = parseInt(id);

    if (isNaN(userId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    const body = await req.json();
    const updates: string[] = [];

    // Check if user exists
    const existing = await sql`SELECT username FROM users WHERE id = ${userId}`;
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const targetUsername = existing.rows[0].username;

    // Prevent self-deactivation
    if (body.active === false && targetUsername === adminUsername.toLowerCase()) {
      return NextResponse.json({ error: 'Cannot deactivate your own account' }, { status: 400 });
    }

    // Prevent removing own admin role
    if (body.role && body.role !== 'admin' && targetUsername === adminUsername.toLowerCase()) {
      return NextResponse.json({ error: 'Cannot remove your own admin role' }, { status: 400 });
    }

    // Update role
    if (body.role !== undefined) {
      const validRoles = ['admin', 'member'];
      if (!validRoles.includes(body.role)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
      }
      await sql`UPDATE users SET role = ${body.role}, updated_at = NOW() WHERE id = ${userId}`;
      updates.push(`role set to ${body.role}`);
    }

    // Update active status
    if (body.active !== undefined) {
      await sql`UPDATE users SET active = ${body.active}, updated_at = NOW() WHERE id = ${userId}`;
      updates.push(`active set to ${body.active}`);
    }

    // Reset password
    if (body.newPassword) {
      if (body.newPassword.length < 6) {
        return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
      }
      const hash = await bcrypt.hash(body.newPassword, 10);
      await sql`UPDATE users SET password_hash = ${hash}, updated_at = NOW() WHERE id = ${userId}`;
      updates.push('password reset');
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    }

    // Return updated user
    const result = await sql`
      SELECT id, username, role, active, created_at, updated_at
      FROM users WHERE id = ${userId}
    `;

    return NextResponse.json({ user: result.rows[0], updates });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update user';
    const status = message === 'Unauthorized' ? 401 : message === 'Admin access required' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * DELETE /api/admin/users/[id] - Soft-delete (deactivate) user (admin only)
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { username: adminUsername } = await requireAdmin();
    const { id } = await params;
    const userId = parseInt(id);

    if (isNaN(userId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    // Check if trying to deactivate self
    const existing = await sql`SELECT username FROM users WHERE id = ${userId}`;
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (existing.rows[0].username === adminUsername.toLowerCase()) {
      return NextResponse.json({ error: 'Cannot deactivate your own account' }, { status: 400 });
    }

    await sql`UPDATE users SET active = false, updated_at = NOW() WHERE id = ${userId}`;

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to deactivate user';
    const status = message === 'Unauthorized' ? 401 : message === 'Admin access required' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
