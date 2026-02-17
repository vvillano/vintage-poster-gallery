import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import { getShopifyConfig } from '@/lib/shopify';
import {
  isPMAppConfigured,
  fetchPMAppManagedLists,
  normalizeForComparison,
} from '@/lib/pm-app';

type ListType = 'sources' | 'artists' | 'medium' | 'colors' | 'countries' | 'otherTags';

interface PushResult {
  listType: string;
  pushed: number;
  skipped: number;
  failed: number;
  errors: string[];
}

/**
 * Helper to make GraphQL calls to Shopify Admin API
 */
async function shopifyGraphQL(
  config: { shopDomain: string; accessToken: string; apiVersion: string },
  query: string,
  variables?: Record<string, unknown>
): Promise<any> {
  const url = `https://${config.shopDomain}/admin/api/${config.apiVersion}/graphql.json`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': config.accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Shopify GraphQL error: ${response.status} ${errorText}`);
  }

  return response.json();
}

/**
 * POST /api/pm-app/push
 *
 * Push local managed list items to Shopify metaobjects.
 * PM App reads from Shopify, so this effectively syncs to PM App.
 *
 * Body: {
 *   listTypes: ListType[] - Which lists to push
 * }
 *
 * Note: This is a simplified implementation. Full implementation would need:
 * 1. Create metaobject definitions in Shopify first
 * 2. Handle metaobject creation/updates
 * 3. Track which items have been pushed
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check Shopify config
    const shopifyConfig = await getShopifyConfig();
    if (!shopifyConfig) {
      return NextResponse.json(
        { error: 'Shopify not configured' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const listTypes: ListType[] = body.listTypes || [];

    if (listTypes.length === 0) {
      return NextResponse.json(
        { error: 'No list types specified' },
        { status: 400 }
      );
    }

    // Get PM App data to compare
    let pmAppNames: Set<string> = new Set();
    if (isPMAppConfigured()) {
      try {
        const pmAppData = await fetchPMAppManagedLists();
        // Collect all PM App names (normalized) to check what's already there
        const allPMAppItems = [
          ...pmAppData.managedLists.sources,
          ...pmAppData.managedLists.artists,
          ...pmAppData.managedLists.medium,
          ...pmAppData.managedLists.colors,
          ...pmAppData.managedLists.countries,
          ...pmAppData.managedLists.otherTags,
        ];
        pmAppNames = new Set(allPMAppItems.map(normalizeForComparison));
      } catch (err) {
        console.warn('Could not fetch PM App data for comparison:', err);
      }
    }

    const results: PushResult[] = [];

    // Note: For now, we'll just identify what WOULD be pushed
    // Full implementation requires Shopify metaobject setup
    for (const listType of listTypes) {
      const result = await identifyPushItems(listType, pmAppNames);
      results.push(result);
    }

    const totalToPush = results.reduce((sum, r) => sum + r.pushed, 0);

    return NextResponse.json({
      ok: true,
      message:
        totalToPush > 0
          ? `Found ${totalToPush} items to push. Shopify metaobject creation not yet implemented.`
          : 'All items already exist in PM App.',
      results,
      note: 'Full push implementation requires Shopify metaobject definitions to be created first.',
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
 * Identify items that would be pushed (not in PM App yet)
 */
async function identifyPushItems(
  listType: ListType,
  pmAppNames: Set<string>
): Promise<PushResult> {
  const result: PushResult = {
    listType,
    pushed: 0, // Items that would be pushed
    skipped: 0, // Already in PM App
    failed: 0,
    errors: [],
  };

  let localItems: string[] = [];

  try {
    switch (listType) {
      case 'sources': {
        const data = await sql`
          SELECT name FROM platforms
          WHERE is_acquisition_platform = true AND is_active = true
        `;
        localItems = data.rows.map((r) => r.name);
        break;
      }
      case 'artists': {
        const data = await sql`SELECT name FROM artists`;
        localItems = data.rows.map((r) => r.name);
        break;
      }
      case 'medium': {
        const data = await sql`SELECT name FROM media_types`;
        localItems = data.rows.map((r) => r.name);
        break;
      }
      case 'colors': {
        const data = await sql`SELECT name FROM colors`;
        localItems = data.rows.map((r) => r.name);
        break;
      }
      case 'countries': {
        const data = await sql`SELECT name FROM countries`;
        localItems = data.rows.map((r) => r.name);
        break;
      }
      case 'otherTags': {
        const data = await sql`SELECT name FROM tags`;
        localItems = data.rows.map((r) => r.name);
        break;
      }
    }
  } catch (err) {
    result.errors.push(`Failed to fetch local ${listType}: ${err}`);
    return result;
  }

  for (const name of localItems) {
    const normalized = normalizeForComparison(name);
    if (pmAppNames.has(normalized)) {
      result.skipped++;
    } else {
      result.pushed++; // Would be pushed
    }
  }

  return result;
}

/**
 * GET /api/pm-app/push
 *
 * Get info about what would be pushed
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({
      ok: true,
      message: 'Use POST to push items. Push creates Shopify metaobjects that PM App can read.',
      supportedListTypes: ['sources', 'artists', 'medium', 'colors', 'countries', 'otherTags'],
      note: 'PM App API is read-only. Push works by creating Shopify metaobjects.',
    });
  } catch (error) {
    console.error('PM App push GET error:', error);
    return NextResponse.json(
      {
        error: 'Failed to get push info',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
