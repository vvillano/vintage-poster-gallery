import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  getProductDetailGraphQL,
  publishProductToChannels,
  unpublishProductFromChannels,
} from '@/lib/shopify';

/**
 * POST /api/shopify/products/[id]/publications
 *
 * Toggle a product's publication status on a sales channel.
 * Body: { publicationId: string, publish: boolean }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { publicationId, publish } = await request.json();

    if (!publicationId) {
      return NextResponse.json({ error: 'publicationId is required' }, { status: 400 });
    }

    const gid = id.startsWith('gid://') ? id : `gid://shopify/Product/${id}`;

    if (publish) {
      await publishProductToChannels(gid, [publicationId]);
    } else {
      await unpublishProductFromChannels(gid, [publicationId]);
    }

    // Re-fetch to get updated publication status
    const updated = await getProductDetailGraphQL(id);

    return NextResponse.json({
      ok: true,
      salesChannels: updated.salesChannels,
    });
  } catch (error) {
    console.error('Toggle publication error:', error);
    return NextResponse.json(
      { error: 'Failed to update sales channel', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
