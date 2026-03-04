import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isPMAppConfigured, removePMAppValues } from '@/lib/pm-app';

// Maps local list page keys to PM App field names (writable only)
const LOCAL_TO_PM_APP: Record<string, string> = {
  'available-tags': 'otherTags',
  colors: 'colors',
  'media-types': 'medium',
  artists: 'artists',
  countries: 'countries',
};

/**
 * POST /api/pm-app/remove
 *
 * Remove specific values from a PM App managed list field.
 * Only applicable to writable PM App fields.
 *
 * Body: {
 *   listType: string  — local list page key (e.g. "artists", "available-tags")
 *   values: string[]  — exact values to remove (case-insensitive match in PM App)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isPMAppConfigured()) {
      return NextResponse.json({ error: 'PM App API key not configured' }, { status: 400 });
    }

    const body = await request.json();
    const { listType, values } = body;

    if (!listType || !LOCAL_TO_PM_APP[listType]) {
      return NextResponse.json(
        {
          error: `Invalid list type. Removable types: ${Object.keys(LOCAL_TO_PM_APP).join(', ')}`,
        },
        { status: 400 }
      );
    }

    if (!Array.isArray(values) || values.length === 0) {
      return NextResponse.json({ error: 'values array is required and must not be empty' }, { status: 400 });
    }

    const pmAppField = LOCAL_TO_PM_APP[listType];
    const result = await removePMAppValues(pmAppField, values);

    return NextResponse.json({
      ok: true,
      field: pmAppField,
      removed: result.removed,
      notFound: result.notFound,
      totalValues: result.totalValues,
    });
  } catch (error) {
    console.error('PM App remove error:', error);
    return NextResponse.json(
      {
        error: 'Failed to remove from PM App',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/pm-app/remove
 * Returns info about which list types support removal.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({
      ok: true,
      removableListTypes: Object.keys(LOCAL_TO_PM_APP),
      pmAppFields: LOCAL_TO_PM_APP,
      description: 'POST with { listType, values } to remove values from PM App managed lists.',
    });
  } catch (error) {
    console.error('PM App remove GET error:', error);
    return NextResponse.json(
      { error: 'Failed to get remove info', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
