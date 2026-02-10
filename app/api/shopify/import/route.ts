import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { put } from '@vercel/blob';
import { sql } from '@vercel/postgres';
import {
  getShopifyProduct,
  getShopifyConfig,
  shopifyProductToData,
  getProductMetafields,
  mapMetafieldsToPosterFields,
} from '@/lib/shopify';

/**
 * POST /api/shopify/import
 * Import product(s) from Shopify as poster(s)
 * Body: { shopifyProductIds: ['gid://shopify/Product/123', ...] }
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
    const { shopifyProductIds } = body;

    if (
      !shopifyProductIds ||
      !Array.isArray(shopifyProductIds) ||
      shopifyProductIds.length === 0
    ) {
      return NextResponse.json(
        { error: 'shopifyProductIds array is required' },
        { status: 400 }
      );
    }

    // Limit batch size
    if (shopifyProductIds.length > 10) {
      return NextResponse.json(
        { error: 'Maximum 10 products can be imported at once' },
        { status: 400 }
      );
    }

    const results: {
      shopifyProductId: string;
      posterId?: number;
      error?: string;
    }[] = [];

    for (const shopifyProductId of shopifyProductIds) {
      try {
        // Check if already imported
        const existing = await sql`
          SELECT id FROM posters WHERE shopify_product_id = ${shopifyProductId}
        `;

        if (existing.rows.length > 0) {
          results.push({
            shopifyProductId,
            posterId: existing.rows[0].id,
            error: 'Already imported',
          });
          continue;
        }

        // Get product from Shopify
        const product = await getShopifyProduct(shopifyProductId);

        // Fetch metafields for this product
        let metafields: Awaited<ReturnType<typeof getProductMetafields>> = [];
        try {
          metafields = await getProductMetafields(shopifyProductId);
        } catch (mfErr) {
          console.warn(`Could not fetch metafields for ${shopifyProductId}:`, mfErr);
        }

        // Map metafields to poster fields
        const mappedFields = mapMetafieldsToPosterFields(metafields);

        // Get first image
        const primaryImage = product.images[0];
        if (!primaryImage) {
          results.push({
            shopifyProductId,
            error: 'Product has no images',
          });
          continue;
        }

        // Download image from Shopify
        const imageResponse = await fetch(primaryImage.src);
        if (!imageResponse.ok) {
          results.push({
            shopifyProductId,
            error: 'Failed to download image',
          });
          continue;
        }

        const imageBlob = await imageResponse.blob();

        // Determine file extension from URL
        const urlPath = new URL(primaryImage.src).pathname;
        const extension = urlPath.split('.').pop() || 'jpg';
        const fileName = `${product.handle}.${extension}`;

        // Upload to Vercel Blob
        const blob = await put(fileName, imageBlob, {
          access: 'public',
          contentType: imageBlob.type || `image/${extension}`,
        });

        // Prepare Shopify data snapshot (including metafields)
        const shopifyData = shopifyProductToData(product, metafields);
        const firstVariant = product.variants[0];

        // Create poster record with mapped metafield values
        const result = await sql`
          INSERT INTO posters (
            image_url,
            image_blob_id,
            file_name,
            file_size,
            uploaded_by,
            title,
            shopify_product_id,
            sku,
            shopify_status,
            shopify_synced_at,
            shopify_data,
            analysis_completed,
            product_type,
            artist,
            estimated_date,
            dimensions_estimate,
            condition,
            condition_details,
            user_notes,
            printing_technique,
            dealer_name,
            record_source
          )
          VALUES (
            ${blob.url},
            ${blob.url},
            ${fileName},
            ${imageBlob.size},
            ${session.user.email || 'unknown'},
            ${product.title},
            ${shopifyProductId},
            ${firstVariant?.sku || null},
            ${product.status},
            NOW(),
            ${JSON.stringify(shopifyData)},
            false,
            ${product.productType || null},
            ${mappedFields.artist || null},
            ${mappedFields.estimatedDate || null},
            ${mappedFields.dimensionsEstimate || null},
            ${mappedFields.condition || null},
            ${mappedFields.conditionDetails || null},
            ${mappedFields.userNotes || null},
            ${mappedFields.printingTechnique || null},
            ${mappedFields.dealerName || null},
            'shopify_import'
          )
          RETURNING id
        `;

        results.push({
          shopifyProductId,
          posterId: result.rows[0].id,
        });
      } catch (error) {
        console.error(`Error importing ${shopifyProductId}:`, error);
        results.push({
          shopifyProductId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const successCount = results.filter((r) => r.posterId && !r.error).length;
    const errorCount = results.filter((r) => r.error).length;

    return NextResponse.json({
      success: true,
      imported: successCount,
      errors: errorCount,
      results,
    });
  } catch (error) {
    console.error('Shopify import error:', error);
    return NextResponse.json(
      {
        error: 'Failed to import from Shopify',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
