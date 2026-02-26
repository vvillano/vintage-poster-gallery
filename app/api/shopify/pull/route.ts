import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import {
  getShopifyProduct,
  getShopifyConfig,
  shopifyProductToData,
  getProductMetafields,
} from '@/lib/shopify';

/**
 * POST /api/shopify/pull
 * Pull latest data from Shopify for linked item(s)
 * Body: { posterId: number } or { all: true }
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { posterId, all } = body;

    if (!posterId && !all) {
      return NextResponse.json(
        { error: 'Either posterId or all:true is required' },
        { status: 400 }
      );
    }

    // Get items to update
    let items;
    if (all) {
      items = await sql`
        SELECT id, shopify_product_id FROM posters
        WHERE shopify_product_id IS NOT NULL
      `;
    } else {
      items = await sql`
        SELECT id, shopify_product_id FROM posters
        WHERE id = ${posterId} AND shopify_product_id IS NOT NULL
      `;
    }

    if (items.rows.length === 0) {
      return NextResponse.json(
        { error: posterId ? 'Item not found or not linked to Shopify' : 'No Shopify-linked items found' },
        { status: 404 }
      );
    }

    const results: {
      posterId: number;
      success: boolean;
      error?: string;
    }[] = [];

    for (const row of items.rows) {
      try {
        // Get latest data from Shopify
        const product = await getShopifyProduct(row.shopify_product_id);

        // Fetch metafields
        let metafields: Awaited<ReturnType<typeof getProductMetafields>> = [];
        try {
          metafields = await getProductMetafields(row.shopify_product_id);
        } catch (mfErr) {
          console.warn(`Could not fetch metafields for ${row.shopify_product_id}:`, mfErr);
        }

        // Prepare shopify data with metafields
        const shopifyData = shopifyProductToData(product, metafields);
        const firstVariant = product.variants[0];

        // Update Shopify-specific metadata only.
        // shopify_data is always fully overwritten with the current Shopify state.
        // shopify_title records the Shopify title at sync time (for reference/undo).
        // poster.title (the local/research title) is NOT overwritten — it is set at import
        // and can be updated by AI analysis or manual entry, just like other research fields.
        await sql`
          UPDATE posters
          SET
            shopify_title = ${product.title},
            product_type = ${product.productType || null},
            sku = ${firstVariant?.sku || null},
            shopify_status = ${product.status},
            shopify_synced_at = NOW(),
            shopify_data = ${JSON.stringify(shopifyData)},
            last_modified = NOW()
          WHERE id = ${row.id}
        `;

        results.push({ posterId: row.id, success: true });
      } catch (error) {
        console.error(`Error pulling data for item ${row.id}:`, error);
        results.push({
          posterId: row.id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const errorCount = results.filter((r) => !r.success).length;

    return NextResponse.json({
      success: errorCount === 0,
      updated: successCount,
      errors: errorCount,
      results,
    });
  } catch (error) {
    console.error('Shopify pull error:', error);
    return NextResponse.json(
      {
        error: 'Failed to pull data from Shopify',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
