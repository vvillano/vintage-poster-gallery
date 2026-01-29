import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  getShopifyProducts,
  getImportedShopifyProductIds,
  getShopifyConfig,
} from '@/lib/shopify';

/**
 * GET /api/shopify/products
 * Get products from Shopify for import
 * Query params:
 *   - q: search query (title)
 *   - limit: max products to return (default 20)
 *   - status: filter by status (active, draft, archived)
 *   - since_id: pagination cursor
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if Shopify is configured
    const config = await getShopifyConfig();
    if (!config) {
      return NextResponse.json(
        { error: 'Shopify not configured' },
        { status: 400 }
      );
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || undefined;
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const status = searchParams.get('status') as
      | 'active'
      | 'draft'
      | 'archived'
      | undefined;
    const sinceId = searchParams.get('since_id') || undefined;

    // Get products from Shopify
    const products = await getShopifyProducts({
      query,
      limit: Math.min(limit, 50), // Cap at 50
      status,
      sinceId,
    });

    // Get already-imported product IDs
    const importedIds = await getImportedShopifyProductIds();

    // Mark products as imported
    const productsWithStatus = products.map((product) => ({
      ...product,
      alreadyImported: importedIds.has(product.id),
    }));

    return NextResponse.json({
      products: productsWithStatus,
      count: products.length,
    });
  } catch (error) {
    console.error('Get Shopify products error:', error);
    return NextResponse.json(
      {
        error: 'Failed to get products from Shopify',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
