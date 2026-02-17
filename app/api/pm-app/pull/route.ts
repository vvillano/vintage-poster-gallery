import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import {
  fetchPMAppManagedLists,
  isPMAppConfigured,
  normalizeForComparison,
} from '@/lib/pm-app';

type ListType =
  | 'sources'
  | 'artists'
  | 'medium'
  | 'colors'
  | 'internalTags'
  | 'locations'
  | 'countries'
  | 'otherTags'
  | 'all';

interface PullResult {
  listType: string;
  created: number;
  skipped: number;
  failed: number;
  errors: string[];
}

/**
 * POST /api/pm-app/pull
 *
 * Pull managed lists from PM App and sync to local tables.
 *
 * Body: {
 *   listTypes: ListType[] - Which lists to pull ('all' for everything)
 *   mode: 'add-only' | 'merge' - add-only: only add new items, merge: update existing too
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
    const listTypes: ListType[] = body.listTypes || ['all'];
    const mode: 'add-only' | 'merge' = body.mode || 'add-only';

    // Fetch PM App data
    const pmAppData = await fetchPMAppManagedLists();

    const results: PullResult[] = [];
    const shouldPull = (type: ListType) =>
      listTypes.includes('all') || listTypes.includes(type);

    // Pull Sources -> Platforms
    if (shouldPull('sources')) {
      const result = await pullSources(pmAppData.managedLists.sources, mode);
      results.push(result);
    }

    // Pull Artists
    if (shouldPull('artists')) {
      const result = await pullArtists(pmAppData.managedLists.artists, mode);
      results.push(result);
    }

    // Pull Medium -> Media Types
    if (shouldPull('medium')) {
      const result = await pullMediaTypes(pmAppData.managedLists.medium, mode);
      results.push(result);
    }

    // Pull Colors
    if (shouldPull('colors')) {
      const result = await pullColors(pmAppData.managedLists.colors, mode);
      results.push(result);
    }

    // Pull Internal Tags
    if (shouldPull('internalTags')) {
      const result = await pullInternalTags(pmAppData.managedLists.internalTags, mode);
      results.push(result);
    }

    // Pull Locations
    if (shouldPull('locations')) {
      const result = await pullLocations(pmAppData.managedLists.locations, mode);
      results.push(result);
    }

    // Pull Countries
    if (shouldPull('countries')) {
      const result = await pullCountries(pmAppData.managedLists.countries, mode);
      results.push(result);
    }

    // Pull Other Tags -> Tags
    if (shouldPull('otherTags')) {
      const result = await pullTags(pmAppData.managedLists.otherTags, mode);
      results.push(result);
    }

    // Calculate totals
    const totalCreated = results.reduce((sum, r) => sum + r.created, 0);
    const totalSkipped = results.reduce((sum, r) => sum + r.skipped, 0);
    const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);

    return NextResponse.json({
      ok: true,
      mode,
      results,
      summary: {
        totalCreated,
        totalSkipped,
        totalFailed,
      },
    });
  } catch (error) {
    console.error('PM App pull error:', error);
    return NextResponse.json(
      {
        error: 'Failed to pull from PM App',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Pull sources into platforms table
 */
async function pullSources(
  items: string[],
  _mode: 'add-only' | 'merge'
): Promise<PullResult> {
  const result: PullResult = {
    listType: 'sources',
    created: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  // Get existing platforms
  const existing = await sql`
    SELECT name FROM platforms WHERE is_acquisition_platform = true
  `;
  const existingNames = new Set(
    existing.rows.map((r) => normalizeForComparison(r.name))
  );

  for (const name of items) {
    const normalized = normalizeForComparison(name);
    if (existingNames.has(normalized)) {
      result.skipped++;
      continue;
    }

    try {
      await sql`
        INSERT INTO platforms (name, platform_type, is_acquisition_platform, is_active, display_order)
        VALUES (${name}, 'marketplace', true, true, 100)
        ON CONFLICT (name) DO NOTHING
      `;
      result.created++;
      existingNames.add(normalized);
    } catch (err) {
      result.failed++;
      result.errors.push(`Failed to create platform "${name}": ${err}`);
    }
  }

  return result;
}

/**
 * Pull artists into artists table
 */
async function pullArtists(
  items: string[],
  _mode: 'add-only' | 'merge'
): Promise<PullResult> {
  const result: PullResult = {
    listType: 'artists',
    created: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  // Get existing artists (including aliases)
  const existing = await sql`
    SELECT name, aliases FROM artists
  `;
  const existingNames = new Set<string>();
  for (const row of existing.rows) {
    existingNames.add(normalizeForComparison(row.name));
    if (row.aliases) {
      for (const alias of row.aliases) {
        existingNames.add(normalizeForComparison(alias));
      }
    }
  }

  for (const name of items) {
    const normalized = normalizeForComparison(name);
    if (existingNames.has(normalized)) {
      result.skipped++;
      continue;
    }

    try {
      await sql`
        INSERT INTO artists (name, verified, created_at, updated_at)
        VALUES (${name}, false, NOW(), NOW())
        ON CONFLICT (name) DO NOTHING
      `;
      result.created++;
      existingNames.add(normalized);
    } catch (err) {
      result.failed++;
      result.errors.push(`Failed to create artist "${name}": ${err}`);
    }
  }

  return result;
}

/**
 * Pull medium into media_types table
 */
async function pullMediaTypes(
  items: string[],
  _mode: 'add-only' | 'merge'
): Promise<PullResult> {
  const result: PullResult = {
    listType: 'medium',
    created: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  const existing = await sql`SELECT name FROM media_types`;
  const existingNames = new Set(
    existing.rows.map((r) => normalizeForComparison(r.name))
  );

  for (const name of items) {
    const normalized = normalizeForComparison(name);
    if (existingNames.has(normalized)) {
      result.skipped++;
      continue;
    }

    try {
      await sql`
        INSERT INTO media_types (name, display_order, created_at)
        VALUES (${name}, 100, NOW())
        ON CONFLICT (name) DO NOTHING
      `;
      result.created++;
      existingNames.add(normalized);
    } catch (err) {
      result.failed++;
      result.errors.push(`Failed to create media type "${name}": ${err}`);
    }
  }

  return result;
}

/**
 * Pull colors into colors table
 */
async function pullColors(
  items: string[],
  _mode: 'add-only' | 'merge'
): Promise<PullResult> {
  const result: PullResult = {
    listType: 'colors',
    created: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  // Check if colors table exists
  let existingNames = new Set<string>();
  try {
    const existing = await sql`SELECT name FROM colors`;
    existingNames = new Set(existing.rows.map((r) => normalizeForComparison(r.name)));
  } catch {
    // Table may not exist - will fail on insert
    result.errors.push('Colors table may not exist. Run the migration first.');
    return result;
  }

  for (const name of items) {
    const normalized = normalizeForComparison(name);
    if (existingNames.has(normalized)) {
      result.skipped++;
      continue;
    }

    try {
      await sql`
        INSERT INTO colors (name, display_order, created_at)
        VALUES (${name}, 100, NOW())
        ON CONFLICT (name) DO NOTHING
      `;
      result.created++;
      existingNames.add(normalized);
    } catch (err) {
      result.failed++;
      result.errors.push(`Failed to create color "${name}": ${err}`);
    }
  }

  return result;
}

/**
 * Pull internal tags into internal_tags table
 */
async function pullInternalTags(
  items: string[],
  _mode: 'add-only' | 'merge'
): Promise<PullResult> {
  const result: PullResult = {
    listType: 'internalTags',
    created: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  const existing = await sql`SELECT name FROM internal_tags`;
  const existingNames = new Set(
    existing.rows.map((r) => normalizeForComparison(r.name))
  );

  for (const name of items) {
    const normalized = normalizeForComparison(name);
    if (existingNames.has(normalized)) {
      result.skipped++;
      continue;
    }

    try {
      await sql`
        INSERT INTO internal_tags (name, color, display_order, created_at)
        VALUES (${name}, '#6B7280', 100, NOW())
        ON CONFLICT (name) DO NOTHING
      `;
      result.created++;
      existingNames.add(normalized);
    } catch (err) {
      result.failed++;
      result.errors.push(`Failed to create internal tag "${name}": ${err}`);
    }
  }

  return result;
}

/**
 * Pull locations into locations table
 */
async function pullLocations(
  items: string[],
  _mode: 'add-only' | 'merge'
): Promise<PullResult> {
  const result: PullResult = {
    listType: 'locations',
    created: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  const existing = await sql`SELECT name FROM locations`;
  const existingNames = new Set(
    existing.rows.map((r) => normalizeForComparison(r.name))
  );

  for (const name of items) {
    const normalized = normalizeForComparison(name);
    if (existingNames.has(normalized)) {
      result.skipped++;
      continue;
    }

    try {
      await sql`
        INSERT INTO locations (name, display_order, created_at)
        VALUES (${name}, 100, NOW())
        ON CONFLICT (name) DO NOTHING
      `;
      result.created++;
      existingNames.add(normalized);
    } catch (err) {
      result.failed++;
      result.errors.push(`Failed to create location "${name}": ${err}`);
    }
  }

  return result;
}

/**
 * Pull countries into countries table
 */
async function pullCountries(
  items: string[],
  _mode: 'add-only' | 'merge'
): Promise<PullResult> {
  const result: PullResult = {
    listType: 'countries',
    created: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  const existing = await sql`SELECT name FROM countries`;
  const existingNames = new Set(
    existing.rows.map((r) => normalizeForComparison(r.name))
  );

  for (const name of items) {
    const normalized = normalizeForComparison(name);
    if (existingNames.has(normalized)) {
      result.skipped++;
      continue;
    }

    try {
      // Generate a simple code from the country name
      const code = name.substring(0, 2).toUpperCase();
      await sql`
        INSERT INTO countries (name, code, display_order, created_at)
        VALUES (${name}, ${code}, 100, NOW())
        ON CONFLICT (name) DO NOTHING
      `;
      result.created++;
      existingNames.add(normalized);
    } catch (err) {
      result.failed++;
      result.errors.push(`Failed to create country "${name}": ${err}`);
    }
  }

  return result;
}

/**
 * Pull other tags into tags table
 */
async function pullTags(
  items: string[],
  _mode: 'add-only' | 'merge'
): Promise<PullResult> {
  const result: PullResult = {
    listType: 'otherTags',
    created: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  const existing = await sql`SELECT name FROM tags`;
  const existingNames = new Set(
    existing.rows.map((r) => normalizeForComparison(r.name))
  );

  for (const name of items) {
    const normalized = normalizeForComparison(name);
    if (existingNames.has(normalized)) {
      result.skipped++;
      continue;
    }

    try {
      await sql`
        INSERT INTO tags (name, created_at)
        VALUES (${name}, NOW())
        ON CONFLICT (name) DO NOTHING
      `;
      result.created++;
      existingNames.add(normalized);
    } catch (err) {
      result.failed++;
      result.errors.push(`Failed to create tag "${name}": ${err}`);
    }
  }

  return result;
}
