import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getProductMetafields } from '@/lib/shopify';

/**
 * GET /api/shopify/metafields/[productId]
 * Get all metafields for a Shopify product
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { productId } = await params;

    if (!productId) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      );
    }

    const metafields = await getProductMetafields(productId);

    return NextResponse.json({
      productId,
      metafields,
      count: metafields.length,
    });
  } catch (error) {
    console.error('Get metafields error:', error);
    return NextResponse.json(
      {
        error: 'Failed to get metafields',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
