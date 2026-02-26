import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import {
  getShopifyConfig,
  getShopifyProduct,
  getProductMetafields,
  shopifyProductToData,
} from '@/lib/shopify';
import {
  expandFieldKeys,
  getLocalValueForField,
  getShopifyValueForField,
  pushSingleField,
  recordPushAndCleanQueue,
  PUSH_FIELD_KEYS,
  FIELD_LABELS,
} from '@/lib/push-helpers';

/**
 * POST /api/shopify/push
 * Push data to Shopify with history recording and queue cleanup.
 *
 * Body: {
 *   posterId: number,
 *   fields: string[],  // Accepts both legacy bulk keys and granular field keys
 *   customConciseDescription?: string  // Optional override for concise description
 * }
 *
 * Legacy bulk keys (backward compatible):
 *   'description', 'tags', 'title', 'metafields', 'research_metafields'
 *
 * Granular field keys (new):
 *   'metafield:custom.artist', 'metafield:jadepuma.medium', etc.
 *
 * For each field pushed:
 *   1. Snapshots the current Shopify value into push_history
 *   2. Pushes the new value to Shopify
 *   3. Removes the field from push_queue
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
    const { posterId, fields, customConciseDescription } = body;

    if (!posterId) {
      return NextResponse.json(
        { error: 'posterId is required' },
        { status: 400 }
      );
    }

    if (!fields || !Array.isArray(fields) || fields.length === 0) {
      return NextResponse.json(
        { error: 'fields array is required' },
        { status: 400 }
      );
    }

    // Get item from database
    const result = await sql`
      SELECT * FROM posters WHERE id = ${posterId}
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

    const shopifyData = item.shopify_data;
    const pushedBy = session.user.name || 'unknown';

    // Expand legacy bulk keys into granular field keys
    const granularFields = expandFieldKeys(fields);

    const updates: string[] = [];
    const errors: string[] = [];

    // Push each field individually with history recording
    for (const fieldKey of granularFields) {
      try {
        // Get current values for history
        const previousValue = getShopifyValueForField(shopifyData, fieldKey);
        const newValue = await getLocalValueForField(item, fieldKey, { customConciseDescription });

        if (!newValue) {
          // Skip fields with no local value (don't error, just skip)
          continue;
        }

        // Push to Shopify
        await pushSingleField(item.shopify_product_id, item, fieldKey, { customConciseDescription });

        // Record in history and clean queue
        try {
          await recordPushAndCleanQueue(posterId, fieldKey, previousValue, newValue, pushedBy);
        } catch (historyErr) {
          // History/queue errors are not critical — don't fail the push
          console.error(`Error recording push history for ${fieldKey}:`, historyErr);
        }

        const label = FIELD_LABELS[fieldKey] || fieldKey;
        if (!updates.includes(label)) {
          updates.push(label);
        }
      } catch (error) {
        const label = FIELD_LABELS[fieldKey] || fieldKey;
        errors.push(`${label}: ${error instanceof Error ? error.message : 'Failed'}`);
      }
    }

    // Refresh Shopify data after push (include metafields so acquisition/COGS data is preserved)
    try {
      const product = await getShopifyProduct(item.shopify_product_id);
      let refreshedMetafields: Awaited<ReturnType<typeof getProductMetafields>> = [];
      try {
        refreshedMetafields = await getProductMetafields(item.shopify_product_id);
      } catch (mfErr) {
        console.warn('Could not fetch metafields for post-push refresh:', mfErr);
      }
      const refreshedData = shopifyProductToData(product, refreshedMetafields);

      await sql`
        UPDATE posters
        SET
          shopify_synced_at = NOW(),
          shopify_data = ${JSON.stringify(refreshedData)},
          last_modified = NOW()
        WHERE id = ${posterId}
      `;
    } catch (refreshError) {
      console.error('Error refreshing Shopify data after push:', refreshError);
    }

    return NextResponse.json({
      success: errors.length === 0,
      updated: updates,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Shopify push error:', error);
    const details = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: `Failed to push to Shopify: ${details}`,
        details,
      },
      { status: 500 }
    );
  }
}
