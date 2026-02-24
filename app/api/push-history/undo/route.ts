import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import {
  getShopifyConfig,
  getShopifyProduct,
  shopifyProductToData,
} from '@/lib/shopify';
import {
  pushSingleField,
  getShopifyValueForField,
  PUSH_FIELD_KEYS,
} from '@/lib/push-helpers';

/**
 * POST /api/push-history/undo
 * Undo the last push for a specific field by reverting to the previous value.
 * Body: { posterId: number, fieldKey: string }
 *
 * Pushes the previous_value back to Shopify and records the undo as a new history entry.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const config = await getShopifyConfig();
    if (!config) {
      return NextResponse.json({ error: 'Shopify not configured' }, { status: 400 });
    }

    const body = await request.json();
    const { posterId, fieldKey } = body;

    if (!posterId || !fieldKey) {
      return NextResponse.json(
        { error: 'posterId and fieldKey are required' },
        { status: 400 }
      );
    }

    // Get the latest history entry for this poster + field
    const historyResult = await sql`
      SELECT * FROM push_history
      WHERE poster_id = ${posterId} AND field_key = ${fieldKey}
      ORDER BY pushed_at DESC
      LIMIT 1
    `;

    if (historyResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'No push history found for this field' },
        { status: 404 }
      );
    }

    const lastPush = historyResult.rows[0];
    const previousValue = lastPush.previous_value;

    // Get the poster to find the Shopify product ID
    const posterResult = await sql`
      SELECT shopify_product_id, shopify_data FROM posters WHERE id = ${posterId}
    `;

    if (posterResult.rows.length === 0) {
      return NextResponse.json({ error: 'Poster not found' }, { status: 404 });
    }

    const poster = posterResult.rows[0];
    if (!poster.shopify_product_id) {
      return NextResponse.json({ error: 'Poster not linked to Shopify' }, { status: 400 });
    }

    // Get current Shopify value (what we're about to overwrite)
    const currentShopifyValue = getShopifyValueForField(poster.shopify_data, fieldKey);

    // Build a fake item with the previous value so pushSingleField can push it
    // For product-level fields, we create a minimal item object
    // For metafields, pushSingleField handles the namespace.key parsing directly
    const fakeItem = buildUndoItem(poster, fieldKey, previousValue);

    // Push the previous value back to Shopify
    await pushSingleField(poster.shopify_product_id, fakeItem, fieldKey);

    // Record the undo as a new history entry
    await sql`
      INSERT INTO push_history (poster_id, field_key, previous_value, new_value, pushed_by)
      VALUES (${posterId}, ${fieldKey}, ${currentShopifyValue}, ${previousValue}, ${session.user.name || 'unknown'})
    `;

    // Refresh Shopify data snapshot
    try {
      const product = await getShopifyProduct(poster.shopify_product_id);
      const shopifyData = shopifyProductToData(product);
      await sql`
        UPDATE posters
        SET shopify_synced_at = NOW(), shopify_data = ${JSON.stringify(shopifyData)}, last_modified = NOW()
        WHERE id = ${posterId}
      `;
    } catch (refreshErr) {
      console.error('Error refreshing Shopify data after undo:', refreshErr);
    }

    return NextResponse.json({
      success: true,
      field: fieldKey,
      revertedTo: previousValue,
    });
  } catch (error) {
    console.error('Push undo error:', error);
    return NextResponse.json(
      { error: 'Failed to undo push', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

/**
 * Build a minimal item object that getLocalValueForField / pushSingleField can use
 * to push the undo value back to Shopify.
 */
function buildUndoItem(poster: any, fieldKey: string, undoValue: string | null): any {
  // Start with a minimal item that has the Shopify product ID
  const item: any = {
    shopify_product_id: poster.shopify_product_id,
  };

  switch (fieldKey) {
    case PUSH_FIELD_KEYS.title:
      item.title = undoValue;
      break;
    case PUSH_FIELD_KEYS.description:
      // For description undo, push the raw HTML directly (no re-appending)
      item.product_description = undoValue;
      item.raw_ai_response = { productDescriptions: { standard: undoValue } };
      break;
    case PUSH_FIELD_KEYS.tags:
      item.item_tags = undoValue ? undoValue.split(', ') : [];
      break;
    case PUSH_FIELD_KEYS.customArtist:
      item.artist = undoValue;
      break;
    case PUSH_FIELD_KEYS.customDate:
      item.estimated_date = undoValue;
      break;
    case PUSH_FIELD_KEYS.customTechnique:
      item.printing_technique = undoValue;
      break;
    case PUSH_FIELD_KEYS.customHistory:
      item.historical_context = undoValue;
      break;
    case PUSH_FIELD_KEYS.customTalkingPoints:
      item.raw_ai_response = { talkingPoints: undoValue ? JSON.parse(undoValue) : [] };
      break;
    case PUSH_FIELD_KEYS.color:
      item.colors = undoValue ? undoValue.split(', ') : [];
      break;
    case PUSH_FIELD_KEYS.medium:
      item.printing_technique = undoValue;
      break;
    case PUSH_FIELD_KEYS.countryOfOrigin:
      item.country_of_origin = undoValue;
      break;
    default:
      // For linked-entity fields (publisher, printer, publication, artist_bio, concise_description)
      // we override getLocalValueForField by setting the value directly
      // pushSingleField will parse the metafield key and push the value
      item._directValue = undoValue;
      break;
  }

  return item;
}
