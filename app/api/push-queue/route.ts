import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';

export const dynamic = 'force-dynamic';

/**
 * GET /api/push-queue?posterId=N
 * Fetch queued push fields for a poster.
 *
 * GET /api/push-queue?all=true
 * Fetch all pending queue entries (for future bulk page).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const posterId = request.nextUrl.searchParams.get('posterId');
    const all = request.nextUrl.searchParams.get('all');

    if (all === 'true') {
      const result = await sql`
        SELECT pq.*, p.title as poster_title
        FROM push_queue pq
        JOIN posters p ON p.id = pq.poster_id
        ORDER BY pq.queued_at DESC
        LIMIT 500
      `;
      return NextResponse.json({ queue: result.rows });
    }

    if (!posterId) {
      return NextResponse.json(
        { error: 'posterId parameter is required' },
        { status: 400 }
      );
    }

    const result = await sql`
      SELECT * FROM push_queue
      WHERE poster_id = ${parseInt(posterId)}
      ORDER BY queued_at ASC
    `;

    return NextResponse.json({ queue: result.rows });
  } catch (error) {
    console.error('Push queue GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch push queue', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/push-queue
 * Add field(s) to the push queue for a poster.
 * Body: { posterId: number, fieldKeys: string[], autoEligible?: boolean }
 *
 * Uses ON CONFLICT to upsert — re-queuing updates the timestamp.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { posterId, fieldKeys, autoEligible = false } = body;

    if (!posterId || !fieldKeys || !Array.isArray(fieldKeys) || fieldKeys.length === 0) {
      return NextResponse.json(
        { error: 'posterId and fieldKeys[] are required' },
        { status: 400 }
      );
    }

    const added: string[] = [];
    for (const fieldKey of fieldKeys) {
      await sql`
        INSERT INTO push_queue (poster_id, field_key, auto_eligible, queued_at)
        VALUES (${posterId}, ${fieldKey}, ${autoEligible}, NOW())
        ON CONFLICT (poster_id, field_key)
        DO UPDATE SET queued_at = NOW(), auto_eligible = ${autoEligible}
      `;
      added.push(fieldKey);
    }

    return NextResponse.json({ success: true, added });
  } catch (error) {
    console.error('Push queue POST error:', error);
    return NextResponse.json(
      { error: 'Failed to add to push queue', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/push-queue
 * Remove field(s) from the push queue.
 * Body: { posterId: number, fieldKeys: string[] }
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { posterId, fieldKeys } = body;

    if (!posterId || !fieldKeys || !Array.isArray(fieldKeys) || fieldKeys.length === 0) {
      return NextResponse.json(
        { error: 'posterId and fieldKeys[] are required' },
        { status: 400 }
      );
    }

    for (const fieldKey of fieldKeys) {
      await sql`
        DELETE FROM push_queue
        WHERE poster_id = ${posterId} AND field_key = ${fieldKey}
      `;
    }

    return NextResponse.json({ success: true, removed: fieldKeys });
  } catch (error) {
    console.error('Push queue DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to remove from push queue', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
