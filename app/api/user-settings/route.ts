import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';

/**
 * GET /api/user-settings
 * Fetch the current user's settings (auto-push preferences, etc.)
 * Returns default settings if no row exists yet.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const username = session.user.name || 'default';

    const result = await sql`
      SELECT auto_push_settings FROM user_settings
      WHERE username = ${username}
    `;

    if (result.rows.length === 0) {
      // Return defaults — safe fields ON, judgment fields OFF
      return NextResponse.json({
        settings: {
          autoPush: {
            tags: false,
            'metafield:jadepuma.color': false,
            'metafield:jadepuma.medium': false,
            'metafield:jadepuma.country_of_origin': false,
            'metafield:jadepuma.printer': false,
            'metafield:jadepuma.publisher': false,
            'metafield:jadepuma.book_title_source': false,
            'metafield:jadepuma.artist_bio': false,
            'metafield:custom.artist': false,
            title: false,
            'metafield:custom.date': false,
            description: false,
            'metafield:jadepuma.concise_description': false,
            'metafield:custom.talking_points': false,
          },
          confidenceThresholds: {
            'metafield:custom.artist': 85,
            'metafield:custom.date': 80,
            'metafield:jadepuma.printer': 80,
            'metafield:jadepuma.publisher': 80,
            'metafield:jadepuma.book_title_source': 80,
          },
        },
      });
    }

    return NextResponse.json({ settings: result.rows[0].auto_push_settings });
  } catch (error) {
    console.error('User settings GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user settings', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/user-settings
 * Update the current user's settings.
 * Body: { settings: { autoPush: {...}, confidenceThresholds: {...} } }
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { settings } = body;

    if (!settings) {
      return NextResponse.json(
        { error: 'settings object is required' },
        { status: 400 }
      );
    }

    const username = session.user.name || 'default';

    await sql`
      INSERT INTO user_settings (username, auto_push_settings, updated_at)
      VALUES (${username}, ${JSON.stringify(settings)}, NOW())
      ON CONFLICT (username)
      DO UPDATE SET auto_push_settings = ${JSON.stringify(settings)}, updated_at = NOW()
    `;

    return NextResponse.json({ success: true, settings });
  } catch (error) {
    console.error('User settings PUT error:', error);
    return NextResponse.json(
      { error: 'Failed to update user settings', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
