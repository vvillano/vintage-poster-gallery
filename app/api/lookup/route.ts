import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { findPosterBySku } from '@/lib/db';
import { searchShopifyBySku } from '@/lib/shopify';

/**
 * GET /api/lookup?sku=XXX
 *
 * Unified lookup endpoint for finding products by SKU.
 * First checks local database, then searches Shopify if not found.
 *
 * Response:
 * - { found: true, source: 'local', posterId: 123 } - exists locally
 * - { found: true, source: 'shopify', shopifyProduct: {...} } - found in Shopify, not imported
 * - { found: false } - not found anywhere
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const sku = searchParams.get('sku');

    if (!sku) {
      return NextResponse.json(
        { error: 'SKU parameter is required' },
        { status: 400 }
      );
    }

    // Step 1: Check local database first
    const localPoster = await findPosterBySku(sku);

    if (localPoster) {
      return NextResponse.json({
        found: true,
        source: 'local',
        posterId: localPoster.id,
        poster: {
          id: localPoster.id,
          title: localPoster.title,
          artist: localPoster.artist,
          sku: localPoster.sku,
          imageUrl: localPoster.imageUrl,
          shopifyProductId: localPoster.shopifyProductId,
        },
      });
    }

    // Step 2: Search Shopify
    try {
      const shopifyProduct = await searchShopifyBySku(sku);

      if (shopifyProduct) {
        // Extract first variant's SKU to confirm match
        const variant = shopifyProduct.variants.find(
          v => v.sku?.toLowerCase() === sku.toLowerCase()
        );

        return NextResponse.json({
          found: true,
          source: 'shopify',
          shopifyProduct: {
            id: shopifyProduct.id,
            title: shopifyProduct.title,
            handle: shopifyProduct.handle,
            status: shopifyProduct.status,
            sku: variant?.sku || sku,
            price: variant?.price,
            imageUrl: shopifyProduct.images[0]?.src,
          },
        });
      }
    } catch (shopifyError) {
      // If Shopify is not configured or fails, still return not found
      console.warn('Shopify lookup failed:', shopifyError);
    }

    // Step 3: Not found anywhere
    return NextResponse.json({
      found: false,
      sku: sku,
    });
  } catch (error) {
    console.error('Lookup error:', error);
    return NextResponse.json(
      {
        error: 'Lookup failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
