import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import {
  getShopifyConfig,
  updateShopifyProduct,
  setProductMetafield,
  getShopifyProduct,
  shopifyProductToData,
} from '@/lib/shopify';

/**
 * POST /api/shopify/push
 * Push data to Shopify
 * Body: {
 *   posterId: number,
 *   fields: ['description', 'tags', 'metafields']
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
    const { posterId, fields } = body;

    if (!posterId) {
      return NextResponse.json(
        { error: 'posterId is required' },
        { status: 400 }
      );
    }

    if (!fields || !Array.isArray(fields) || fields.length === 0) {
      return NextResponse.json(
        { error: 'fields array is required (e.g., ["description", "tags", "metafields"])' },
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

    const updates: string[] = [];
    const errors: string[] = [];

    // Push description
    if (fields.includes('description')) {
      try {
        // Get description from raw_ai_response or product_description
        let description = '';
        if (item.raw_ai_response?.productDescriptions?.standard) {
          description = item.raw_ai_response.productDescriptions.standard;
        } else if (item.product_description) {
          description = item.product_description;
        }

        if (description) {
          // Convert to HTML paragraphs
          const htmlDescription = description
            .split('\n\n')
            .map((p: string) => `<p>${p.trim()}</p>`)
            .join('\n');

          await updateShopifyProduct(item.shopify_product_id, {
            bodyHtml: htmlDescription,
          });
          updates.push('description');
        } else {
          errors.push('No description available to push');
        }
      } catch (error) {
        errors.push(`description: ${error instanceof Error ? error.message : 'Failed'}`);
      }
    }

    // Push tags
    if (fields.includes('tags')) {
      try {
        // Get tags from item_tags JSONB field
        const itemTags = item.item_tags || [];

        if (itemTags.length > 0) {
          await updateShopifyProduct(item.shopify_product_id, {
            tags: itemTags,
          });
          updates.push('tags');
        } else {
          errors.push('No tags available to push');
        }
      } catch (error) {
        errors.push(`tags: ${error instanceof Error ? error.message : 'Failed'}`);
      }
    }

    // Push metafields
    if (fields.includes('metafields')) {
      const metafieldsToSet = [
        { key: 'artist', value: item.artist },
        { key: 'date', value: item.estimated_date },
        { key: 'technique', value: item.printing_technique },
        { key: 'history', value: item.historical_context },
      ];

      // Add talking points if available
      if (item.raw_ai_response?.talkingPoints) {
        metafieldsToSet.push({
          key: 'talking_points',
          value: JSON.stringify(item.raw_ai_response.talkingPoints),
        });
      }

      for (const mf of metafieldsToSet) {
        if (mf.value) {
          try {
            await setProductMetafield(item.shopify_product_id, {
              namespace: 'custom',
              key: mf.key,
              value: mf.value,
              type: mf.key === 'talking_points' ? 'json' : 'multi_line_text_field',
            });
          } catch (error) {
            // Metafield errors are not critical
            console.error(`Error setting metafield ${mf.key}:`, error);
          }
        }
      }
      updates.push('metafields');
    }

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
      success: errors.length === 0,
      updated: updates,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Shopify push error:', error);
    return NextResponse.json(
      {
        error: 'Failed to push data to Shopify',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
