import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getShopifyConfig } from '@/lib/shopify';
import { sql } from '@vercel/postgres';

/**
 * Managed list types:
 * - tags: Item tags for categorization
 * - colors: Color palette options
 * - sources: Legacy - now split into platforms and sellers
 * - platforms: WHERE you buy (marketplaces, venues, aggregators) - syncs to Shopify "Source"
 * - sellers: WHO you buy from (auction houses, dealers, individuals) - syncs to Shopify "Seller"
 */
const VALID_LIST_TYPES = ['tags', 'colors', 'sources', 'platforms', 'sellers'];

/**
 * GET /api/shopify/managed-lists?type=tags|colors|platforms|sellers
 *
 * Fetch managed lists from local database or Shopify.
 * - platforms: Syncs to Shopify as "Source" dropdown (WHERE you buy)
 * - sellers: Syncs to Shopify as "Seller" dropdown (WHO you buy from)
 *
 * Bidirectional sync: New entries created in PM app (Shopify) can be pulled here,
 * and entries created here can be pushed to Shopify.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const config = await getShopifyConfig();
    if (!config) {
      return NextResponse.json(
        { error: 'Shopify not configured' },
        { status: 400 }
      );
    }

    const listType = request.nextUrl.searchParams.get('type');

    if (!listType || !VALID_LIST_TYPES.includes(listType)) {
      return NextResponse.json(
        { error: `type parameter required (${VALID_LIST_TYPES.join(', ')})` },
        { status: 400 }
      );
    }

    // Handle platforms - fetch from local database
    if (listType === 'platforms') {
      const result = await sql`
        SELECT id, name, url, platform_type, is_acquisition_platform, can_research_prices
        FROM platforms
        WHERE is_acquisition_platform = true
        ORDER BY display_order ASC, name ASC
      `;

      return NextResponse.json({
        status: 'success',
        listType: 'platforms',
        items: result.rows.map(row => ({
          id: row.id,
          name: row.name,
          url: row.url,
          platformType: row.platform_type,
          canResearchPrices: row.can_research_prices,
        })),
        total: result.rows.length,
        shopifyField: 'Source', // This list maps to Shopify's "Source" dropdown
      });
    }

    // Handle sellers - fetch from local database
    if (listType === 'sellers') {
      const result = await sql`
        SELECT id, name, type, website, can_research_at, reliability_tier
        FROM sellers
        WHERE is_active = true
        ORDER BY reliability_tier ASC, name ASC
      `;

      return NextResponse.json({
        status: 'success',
        listType: 'sellers',
        items: result.rows.map(row => ({
          id: row.id,
          name: row.name,
          type: row.type,
          website: row.website,
          canResearchAt: row.can_research_at,
          reliabilityTier: row.reliability_tier,
        })),
        total: result.rows.length,
        shopifyField: 'Seller', // This list maps to Shopify's "Seller" dropdown
      });
    }

    // Other list types - return placeholder
    return NextResponse.json({
      status: 'not_implemented',
      message: `Shopify ${listType} sync not yet implemented`,
      details: {
        listType,
        shopDomain: config.shopDomain,
        implementation_notes: [
          'Need to determine how AVP Product Management app stores managed lists',
          'Options: metaobjects, shop metafields, or custom AVP API',
          'Once determined, add fetch/sync logic here',
        ],
      },
    });
  } catch (error) {
    console.error('Shopify managed lists error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch managed lists',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/shopify/managed-lists
 *
 * Sync a managed list to local database (pull from Shopify)
 * or create new entries that can be pushed to Shopify.
 *
 * Body: {
 *   type: 'platforms' | 'sellers' | 'tags' | 'colors',
 *   action: 'create' | 'sync',  // create = add new entry, sync = pull from Shopify
 *   items: [{ name: string, ...otherFields }]
 * }
 *
 * For platforms: creates with name only, defaults to type='other', can be enriched later
 * For sellers: creates with name only, defaults to type='other', can be enriched later
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const config = await getShopifyConfig();
    if (!config) {
      return NextResponse.json(
        { error: 'Shopify not configured' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { type, action = 'create', items } = body;

    if (!type || !VALID_LIST_TYPES.includes(type)) {
      return NextResponse.json(
        { error: `type required (${VALID_LIST_TYPES.join(', ')})` },
        { status: 400 }
      );
    }

    // Handle platforms - create minimal entries (name only required)
    if (type === 'platforms' && action === 'create') {
      if (!Array.isArray(items) || items.length === 0) {
        return NextResponse.json(
          { error: 'items array required with at least one platform' },
          { status: 400 }
        );
      }

      const results = { created: 0, skipped: 0, errors: [] as string[] };

      for (const item of items) {
        if (!item.name) {
          results.errors.push('Missing name for platform');
          continue;
        }

        try {
          // Check if platform already exists
          const existing = await sql`
            SELECT id FROM platforms WHERE LOWER(name) = LOWER(${item.name})
          `;

          if (existing.rows.length > 0) {
            results.skipped++;
            continue;
          }

          // Create with minimal data - type defaults to 'other' for enrichment later
          await sql`
            INSERT INTO platforms (name, platform_type, is_acquisition_platform, display_order)
            VALUES (${item.name}, 'marketplace', true, 999)
          `;
          results.created++;
        } catch (err) {
          results.errors.push(`Failed to create platform "${item.name}": ${err instanceof Error ? err.message : 'Unknown'}`);
        }
      }

      return NextResponse.json({
        status: 'success',
        action: 'create',
        listType: 'platforms',
        ...results,
      });
    }

    // Handle sellers - create minimal entries (name only required)
    if (type === 'sellers' && action === 'create') {
      if (!Array.isArray(items) || items.length === 0) {
        return NextResponse.json(
          { error: 'items array required with at least one seller' },
          { status: 400 }
        );
      }

      const results = { created: 0, skipped: 0, errors: [] as string[] };

      for (const item of items) {
        if (!item.name) {
          results.errors.push('Missing name for seller');
          continue;
        }

        try {
          // Check if seller already exists (by slug)
          const slug = item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
          const existing = await sql`
            SELECT id FROM sellers WHERE slug = ${slug}
          `;

          if (existing.rows.length > 0) {
            results.skipped++;
            continue;
          }

          // Create with minimal data - type defaults to 'other' for enrichment later
          await sql`
            INSERT INTO sellers (name, slug, type, reliability_tier, attribution_weight, pricing_weight, is_active)
            VALUES (${item.name}, ${slug}, 'other', 4, 0.7, 0.7, true)
          `;
          results.created++;
        } catch (err) {
          results.errors.push(`Failed to create seller "${item.name}": ${err instanceof Error ? err.message : 'Unknown'}`);
        }
      }

      return NextResponse.json({
        status: 'success',
        action: 'create',
        listType: 'sellers',
        ...results,
      });
    }

    // Other list types - return placeholder
    return NextResponse.json({
      status: 'not_implemented',
      message: `Shopify ${type} sync not yet implemented`,
      received: {
        type,
        action,
        itemCount: items?.length || 0,
      },
    });
  } catch (error) {
    console.error('Shopify managed lists sync error:', error);
    return NextResponse.json(
      {
        error: 'Failed to sync managed list',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
