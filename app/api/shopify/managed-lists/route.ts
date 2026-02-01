import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getShopifyConfig } from '@/lib/shopify';

/**
 * GET /api/shopify/managed-lists?type=tags|colors
 *
 * Fetch managed lists from Shopify (Available Tags, Colors).
 * These are stored as metaobjects in Shopify's AVP Product Management app.
 *
 * TODO: Implement actual Shopify API calls once we understand
 * how the AVP app stores managed lists (likely as metaobjects).
 *
 * For now, returns information about what needs to be implemented.
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

    if (!listType || !['tags', 'colors', 'sources'].includes(listType)) {
      return NextResponse.json(
        { error: 'type parameter required (tags, colors, or sources)' },
        { status: 400 }
      );
    }

    // TODO: Implement actual fetching from Shopify
    // This requires understanding how the AVP Product Management app stores these lists.
    // Options:
    // 1. Shop-level metaobjects (Shopify's recommended approach for structured data)
    // 2. Shop-level metafields (simpler but less flexible)
    // 3. Custom API endpoint in the AVP app
    //
    // For now, return a placeholder response indicating this needs implementation.

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
 * Sync a managed list to Shopify.
 * Body: {
 *   type: 'tags' | 'colors',
 *   items: string[]
 * }
 *
 * TODO: Implement once we understand the Shopify data model.
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
    const { type, items } = body;

    if (!type || !['tags', 'colors'].includes(type)) {
      return NextResponse.json(
        { error: 'type required (tags or colors)' },
        { status: 400 }
      );
    }

    // TODO: Implement actual sync to Shopify
    return NextResponse.json({
      status: 'not_implemented',
      message: `Shopify ${type} sync not yet implemented`,
      received: {
        type,
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
