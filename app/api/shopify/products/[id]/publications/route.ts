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

    let mutationResult;
    if (publish) {
      mutationResult = await publishProductToChannels(gid, [publicationId]);
    } else {
      mutationResult = await unpublishProductFromChannels(gid, [publicationId]);
    }

    // If publishable is null, Shopify didn't find the resource or app lacks access
    if (!mutationResult.publishable) {
      console.warn(`publishable was null for ${gid}. The app may lack access to this publication.`);
    }

    // Re-fetch to get updated publication status
    const updated = await getProductDetailGraphQL(id);

    // Check if the toggle actually took effect
    const channel = updated.salesChannels.find((ch: any) => ch.id === publicationId);
    // For publish: the channel MUST be in the list and marked published
    // For unpublish: the channel should be absent or marked unpublished
    const toggleWorked = publish
      ? (channel?.published === true)
      : (!channel || channel.published === false);

    if (!toggleWorked) {
      const detail = `publish=${publish}, publishable=${JSON.stringify(mutationResult.publishable)}, channelFound=${!!channel}, channelPublished=${channel?.published}`;
      console.warn(`Sales channel toggle failed silently for ${gid}. ${detail}`);
    }

    return NextResponse.json({
      ok: true,
      salesChannels: updated.salesChannels,
      ...(toggleWorked ? {} : { warning: 'Toggle did not take effect. Check Vercel logs for details.' }),
    });
  } catch (error) {
    console.error('Toggle publication error:', error);
    return NextResponse.json(
      { error: 'Failed to update sales channel', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
