import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';

/**
 * POST /api/artists/merge
 * Merge a duplicate artist into a canonical artist record.
 * Re-links all posters from duplicate to canonical, then deletes the duplicate.
 *
 * Body: { duplicateId: number, canonicalId: number }
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { duplicateId, canonicalId } = await request.json();

    if (!duplicateId || !canonicalId || duplicateId === canonicalId) {
      return NextResponse.json(
        { error: 'Invalid merge request: duplicateId and canonicalId must be different' },
        { status: 400 }
      );
    }

    // Verify both records exist
    const [dupeResult, canonicalResult] = await Promise.all([
      sql`SELECT id, name FROM artists WHERE id = ${duplicateId}`,
      sql`SELECT id, name FROM artists WHERE id = ${canonicalId}`,
    ]);

    if (dupeResult.rows.length === 0) {
      return NextResponse.json({ error: 'Duplicate artist not found' }, { status: 404 });
    }
    if (canonicalResult.rows.length === 0) {
      return NextResponse.json({ error: 'Canonical artist not found' }, { status: 404 });
    }

    const dupeName = dupeResult.rows[0].name;
    const canonicalName = canonicalResult.rows[0].name;

    // Re-link all posters from duplicate to canonical
    const relinked = await sql`
      UPDATE posters
      SET artist_id = ${canonicalId}, last_modified = NOW()
      WHERE artist_id = ${duplicateId}
      RETURNING id
    `;

    // Delete the duplicate record
    await sql`DELETE FROM artists WHERE id = ${duplicateId}`;

    return NextResponse.json({
      success: true,
      merged: {
        from: { id: duplicateId, name: dupeName },
        into: { id: canonicalId, name: canonicalName },
        postersRelinked: relinked.rows.length,
      },
    });
  } catch (error) {
    console.error('Merge artists error:', error);
    return NextResponse.json(
      { error: 'Failed to merge artists', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
