import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import {
  isPMAppConfigured,
  fetchPMAppManagedLists,
  pushPMAppValues,
  normalizeForComparison,
  PM_APP_FIELD_MAPPINGS,
} from '@/lib/pm-app';

type ListType = 'artists' | 'medium' | 'colors' | 'countries' | 'otherTags';

// Fields that can be pushed to PM App (matches PM App writable fields)
const PUSHABLE_LIST_TYPES: ListType[] = ['artists', 'medium', 'colors', 'countries', 'otherTags'];

interface PushResult {
  listType: string;
  pushed: number;
  skipped: number;
  failed: number;
  errors: string[];
}

/**
 * POST /api/pm-app/push
 *
 * Push local managed list items to PM App via POST /managed-lists/values.
 * Only pushes items that don't already exist in PM App (comparison done locally).
 *
 * Body: {
 *   listTypes: ListType[]  — which lists to push (omit for all pushable lists)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isPMAppConfigured()) {
      return NextResponse.json(
        { error: 'PM App API key not configured' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const requestedTypes: string[] = body.listTypes || [];

    // Determine which list types to push
    const listTypes: ListType[] =
      requestedTypes.length === 0 || requestedTypes.includes('all')
        ? PUSHABLE_LIST_TYPES
        : (requestedTypes.filter((t) => PUSHABLE_LIST_TYPES.includes(t as ListType)) as ListType[]);

    if (listTypes.length === 0) {
      return NextResponse.json(
        { error: `No valid pushable list types. Allowed: ${PUSHABLE_LIST_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    // Fetch current PM App state once for comparison
    let pmAppData;
    try {
      pmAppData = await fetchPMAppManagedLists();
    } catch (err) {
      return NextResponse.json(
        { error: 'Failed to fetch current PM App data', details: err instanceof Error ? err.message : 'Unknown' },
        { status: 502 }
      );
    }

    const results: PushResult[] = [];

    for (const listType of listTypes) {
      const result = await pushListType(listType, pmAppData.managedLists);
      results.push(result);
    }

    const totalPushed = results.reduce((sum, r) => sum + r.pushed, 0);
    const totalSkipped = results.reduce((sum, r) => sum + r.skipped, 0);
    const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);

    return NextResponse.json({
      ok: true,
      message: `Push complete: ${totalPushed} added, ${totalSkipped} already existed, ${totalFailed} failed`,
      results,
    });
  } catch (error) {
    console.error('PM App push error:', error);
    return NextResponse.json(
      {
        error: 'Failed to push to PM App',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Push a single list type: fetch local items, find new ones, call PM App API.
 */
async function pushListType(
  listType: ListType,
  pmAppLists: { [key: string]: string[] | unknown }
): Promise<PushResult> {
  const result: PushResult = {
    listType,
    pushed: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  // Get local items
  let localItems: string[] = [];
  try {
    localItems = await getLocalItems(listType);
  } catch (err) {
    result.errors.push(`Failed to fetch local ${listType}: ${err instanceof Error ? err.message : String(err)}`);
    result.failed++;
    return result;
  }

  if (localItems.length === 0) {
    return result;
  }

  // Find items not already in PM App (case-insensitive)
  const rawPMAppItems = pmAppLists[listType];
  const pmAppItems: string[] = Array.isArray(rawPMAppItems) ? rawPMAppItems.filter((v): v is string => typeof v === 'string') : [];
  const pmAppNormalized = new Set(pmAppItems.map(normalizeForComparison));

  const toAdd = localItems.filter((item) => !pmAppNormalized.has(normalizeForComparison(item)));
  result.skipped = localItems.length - toAdd.length;

  if (toAdd.length === 0) {
    return result;
  }

  // Push to PM App in a single batch
  try {
    const response = await pushPMAppValues(listType, toAdd);
    result.pushed = response.added.length;
    // Items PM App marked as skipped (already existed by its own dedup check)
    result.skipped += response.skipped.length;
  } catch (err) {
    result.errors.push(`PM App API error: ${err instanceof Error ? err.message : String(err)}`);
    result.failed = toAdd.length;
  }

  return result;
}

/**
 * Fetch local items for a list type from the database.
 */
async function getLocalItems(listType: ListType): Promise<string[]> {
  const mapping = PM_APP_FIELD_MAPPINGS[listType];
  if (!mapping) throw new Error(`No mapping for list type: ${listType}`);

  const table = mapping.researchAppTable;

  switch (listType) {
    case 'artists': {
      const data = await sql`SELECT name FROM artists ORDER BY name`;
      return data.rows.map((r) => r.name).filter(Boolean);
    }
    case 'medium': {
      const data = await sql`SELECT name FROM media_types ORDER BY name`;
      return data.rows.map((r) => r.name).filter(Boolean);
    }
    case 'colors': {
      const data = await sql`SELECT name FROM colors ORDER BY name`;
      return data.rows.map((r) => r.name).filter(Boolean);
    }
    case 'countries': {
      const data = await sql`SELECT name FROM countries ORDER BY name`;
      return data.rows.map((r) => r.name).filter(Boolean);
    }
    case 'otherTags': {
      const data = await sql`SELECT name FROM tags ORDER BY name`;
      return data.rows.map((r) => r.name).filter(Boolean);
    }
    default:
      throw new Error(`Unhandled list type: ${table}`);
  }
}

/**
 * GET /api/pm-app/push
 * Returns info about pushable lists and their current status.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({
      ok: true,
      pushableListTypes: PUSHABLE_LIST_TYPES,
      description: 'POST with { listTypes: [...] } to push local items to PM App. Omit listTypes to push all.',
    });
  } catch (error) {
    console.error('PM App push GET error:', error);
    return NextResponse.json(
      { error: 'Failed to get push info', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
