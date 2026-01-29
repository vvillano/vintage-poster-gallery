import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';

/**
 * GET /api/shopify/lookup?shopifyProductId=gid://shopify/Product/123
 * Check if a poster exists for a given Shopify product ID
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const shopifyProductId = request.nextUrl.searchParams.get('shopifyProductId');

    if (!shopifyProductId) {
      return NextResponse.json(
        { error: 'shopifyProductId parameter is required' },
        { status: 400 }
      );
    }

    const result = await sql`
      SELECT id FROM posters WHERE shopify_product_id = ${shopifyProductId}
    `;

    if (result.rows.length > 0) {
      return NextResponse.json({
        exists: true,
        posterId: result.rows[0].id,
      });
    }

    return NextResponse.json({
      exists: false,
      posterId: null,
    });
  } catch (error) {
    console.error('Shopify lookup error:', error);
    return NextResponse.json(
      {
        error: 'Failed to lookup product',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
