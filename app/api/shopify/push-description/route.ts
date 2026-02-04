import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import {
  getShopifyConfig,
  updateShopifyProduct,
  getShopifyProduct,
  shopifyProductToData,
} from '@/lib/shopify';

/**
 * POST /api/shopify/push-description
 * Push a custom/edited description to Shopify
 * Body: {
 *   posterId: number,
 *   description: string (HTML content),
 *   tone?: string (optional - for logging which tone was used)
 * }
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
    const { posterId, description, tone } = body;

    if (!posterId) {
      return NextResponse.json(
        { error: 'posterId is required' },
        { status: 400 }
      );
    }

    if (!description) {
      return NextResponse.json(
        { error: 'description is required' },
        { status: 400 }
      );
    }

    // Get item from database
    const result = await sql`
      SELECT id, shopify_product_id FROM posters WHERE id = ${posterId}
    `;

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    const item = result.rows[0];

    if (!item.shopify_product_id) {
      return NextResponse.json(
        { error: 'Item is not linked to Shopify' },
        { status: 400 }
      );
    }

    // Push description to Shopify
    await updateShopifyProduct(item.shopify_product_id, {
      bodyHtml: description,
    });

    // Refresh Shopify data after push
    try {
      const product = await getShopifyProduct(item.shopify_product_id);
      const shopifyData = shopifyProductToData(product);

      await sql`
        UPDATE posters
        SET
          shopify_synced_at = NOW(),
          shopify_data = ${JSON.stringify(shopifyData)},
          last_modified = NOW()
        WHERE id = ${posterId}
      `;
    } catch (refreshError) {
      console.error('Error refreshing Shopify data after push:', refreshError);
    }

    return NextResponse.json({
      success: true,
      pushed: 'description',
      tone: tone || 'custom',
    });
  } catch (error) {
    console.error('Shopify push description error:', error);
    return NextResponse.json(
      {
        error: 'Failed to push description to Shopify',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
