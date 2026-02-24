import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';

/**
 * GET /api/push-history?posterId=N[&fieldKey=X]
 * Fetch push history for a poster, optionally filtered by field.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const posterId = request.nextUrl.searchParams.get('posterId');
    const fieldKey = request.nextUrl.searchParams.get('fieldKey');

    if (!posterId) {
      return NextResponse.json(
        { error: 'posterId parameter is required' },
        { status: 400 }
      );
    }

    let result;
    if (fieldKey) {
      result = await sql`
        SELECT * FROM push_history
        WHERE poster_id = ${parseInt(posterId)} AND field_key = ${fieldKey}
        ORDER BY pushed_at DESC
        LIMIT 50
      `;
    } else {
      result = await sql`
        SELECT * FROM push_history
        WHERE poster_id = ${parseInt(posterId)}
        ORDER BY pushed_at DESC
        LIMIT 50
      `;
    }

    return NextResponse.json({ history: result.rows });
  } catch (error) {
    console.error('Push history GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch push history', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
