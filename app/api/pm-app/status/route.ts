import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import {
  fetchPMAppManagedLists,
  getPMAppConfig,
  isPMAppConfigured,
  PM_APP_FIELD_MAPPINGS,
  compareLists,
} from '@/lib/pm-app';

// Force dynamic to read env vars at runtime
export const dynamic = 'force-dynamic';

/**
 * GET /api/pm-app/status
 *
 * Get sync status between PM App and Research App managed lists.
 * Returns counts for each list type and identifies what needs syncing.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const config = getPMAppConfig();

    if (!isPMAppConfigured()) {
      return NextResponse.json({
        ok: false,
        configured: false,
        error: 'PM App API key not configured',
        config,
      });
    }

    // Fetch PM App managed lists
    let pmAppData;
    try {
      pmAppData = await fetchPMAppManagedLists();
    } catch (err) {
      return NextResponse.json({
        ok: false,
        configured: true,
        error: `Failed to fetch from PM App: ${err instanceof Error ? err.message : 'Unknown error'}`,
        config,
      });
    }

    // Get local counts for each list type
    const listStatus: Record<
      string,
      {
        pmAppCount: number;
        localCount: number;
        onlyInPMApp: number;
        onlyInLocal: number;
        inBoth: number;
        lastSynced: string | null;
      }
    > = {};

    // Sources -> Platforms
    const platformsResult = await sql`
      SELECT name FROM platforms WHERE is_acquisition_platform = true AND is_active = true
    `;
    const platformNames = platformsResult.rows.map((r) => r.name);
    const sourcesComparison = compareLists(pmAppData.managedLists.sources, platformNames);
    listStatus.sources = {
      pmAppCount: pmAppData.managedLists.sources.length,
      localCount: platformNames.length,
      onlyInPMApp: sourcesComparison.onlyInPMApp.length,
      onlyInLocal: sourcesComparison.onlyInLocal.length,
      inBoth: sourcesComparison.inBoth.length,
      lastSynced: null, // TODO: Track this
    };

    // Artists
    const artistsResult = await sql`SELECT name FROM artists WHERE verified = true OR verified IS NULL`;
    const artistNames = artistsResult.rows.map((r) => r.name);
    const artistsComparison = compareLists(pmAppData.managedLists.artists, artistNames);
    listStatus.artists = {
      pmAppCount: pmAppData.managedLists.artists.length,
      localCount: artistNames.length,
      onlyInPMApp: artistsComparison.onlyInPMApp.length,
      onlyInLocal: artistsComparison.onlyInLocal.length,
      inBoth: artistsComparison.inBoth.length,
      lastSynced: null,
    };

    // Medium -> Media Types
    const mediaTypesResult = await sql`SELECT name FROM media_types`;
    const mediaTypeNames = mediaTypesResult.rows.map((r) => r.name);
    const mediumComparison = compareLists(pmAppData.managedLists.medium, mediaTypeNames);
    listStatus.medium = {
      pmAppCount: pmAppData.managedLists.medium.length,
      localCount: mediaTypeNames.length,
      onlyInPMApp: mediumComparison.onlyInPMApp.length,
      onlyInLocal: mediumComparison.onlyInLocal.length,
      inBoth: mediumComparison.inBoth.length,
      lastSynced: null,
    };

    // Colors
    let colorsLocalCount = 0;
    let colorsComparison;
    try {
      const colorsResult = await sql`SELECT name FROM colors`;
      const colorNames = colorsResult.rows.map((r) => r.name);
      colorsLocalCount = colorNames.length;
      colorsComparison = compareLists(pmAppData.managedLists.colors, colorNames);
    } catch {
      // Colors table may not exist yet
      colorsComparison = compareLists(pmAppData.managedLists.colors, []);
    }
    listStatus.colors = {
      pmAppCount: pmAppData.managedLists.colors.length,
      localCount: colorsLocalCount,
      onlyInPMApp: colorsComparison.onlyInPMApp.length,
      onlyInLocal: colorsComparison.onlyInLocal.length,
      inBoth: colorsComparison.inBoth.length,
      lastSynced: null,
    };

    // Internal Tags
    const internalTagsResult = await sql`SELECT name FROM internal_tags`;
    const internalTagNames = internalTagsResult.rows.map((r) => r.name);
    const internalTagsComparison = compareLists(
      pmAppData.managedLists.internalTags,
      internalTagNames
    );
    listStatus.internalTags = {
      pmAppCount: pmAppData.managedLists.internalTags.length,
      localCount: internalTagNames.length,
      onlyInPMApp: internalTagsComparison.onlyInPMApp.length,
      onlyInLocal: internalTagsComparison.onlyInLocal.length,
      inBoth: internalTagsComparison.inBoth.length,
      lastSynced: null,
    };

    // Locations
    const locationsResult = await sql`SELECT name FROM locations`;
    const locationNames = locationsResult.rows.map((r) => r.name);
    const locationsComparison = compareLists(pmAppData.managedLists.locations, locationNames);
    listStatus.locations = {
      pmAppCount: pmAppData.managedLists.locations.length,
      localCount: locationNames.length,
      onlyInPMApp: locationsComparison.onlyInPMApp.length,
      onlyInLocal: locationsComparison.onlyInLocal.length,
      inBoth: locationsComparison.inBoth.length,
      lastSynced: null,
    };

    // Countries
    const countriesResult = await sql`SELECT name FROM countries`;
    const countryNames = countriesResult.rows.map((r) => r.name);
    const countriesComparison = compareLists(pmAppData.managedLists.countries, countryNames);
    listStatus.countries = {
      pmAppCount: pmAppData.managedLists.countries.length,
      localCount: countryNames.length,
      onlyInPMApp: countriesComparison.onlyInPMApp.length,
      onlyInLocal: countriesComparison.onlyInLocal.length,
      inBoth: countriesComparison.inBoth.length,
      lastSynced: null,
    };

    // Other Tags -> Tags
    const tagsResult = await sql`SELECT name FROM tags`;
    const tagNames = tagsResult.rows.map((r) => r.name);
    const otherTagsComparison = compareLists(pmAppData.managedLists.otherTags, tagNames);
    listStatus.otherTags = {
      pmAppCount: pmAppData.managedLists.otherTags.length,
      localCount: tagNames.length,
      onlyInPMApp: otherTagsComparison.onlyInPMApp.length,
      onlyInLocal: otherTagsComparison.onlyInLocal.length,
      inBoth: otherTagsComparison.inBoth.length,
      lastSynced: null,
    };

    // Calculate totals
    const totalPMApp = Object.values(listStatus).reduce((sum, s) => sum + s.pmAppCount, 0);
    const totalLocal = Object.values(listStatus).reduce((sum, s) => sum + s.localCount, 0);
    const totalOnlyInPMApp = Object.values(listStatus).reduce((sum, s) => sum + s.onlyInPMApp, 0);
    const totalOnlyInLocal = Object.values(listStatus).reduce((sum, s) => sum + s.onlyInLocal, 0);

    return NextResponse.json({
      ok: true,
      configured: true,
      config,
      lists: listStatus,
      fieldMappings: PM_APP_FIELD_MAPPINGS,
      summary: {
        totalPMApp,
        totalLocal,
        totalOnlyInPMApp,
        totalOnlyInLocal,
        needsPull: totalOnlyInPMApp > 0,
        needsPush: totalOnlyInLocal > 0,
      },
      // Include custom lists info
      customLists: pmAppData.managedLists.customManagedLists.map((cl) => ({
        id: cl._id,
        title: cl.title,
        type: cl.type,
        count: cl.values.length,
      })),
    });
  } catch (error) {
    console.error('PM App status error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to get PM App status',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
