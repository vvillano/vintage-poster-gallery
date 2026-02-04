import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { put, del } from '@vercel/blob';
import { sql } from '@vercel/postgres';
import {
  getShopifyProduct,
  getShopifyConfig,
  shopifyProductToData,
  getProductMetafields,
  mapMetafieldsToPosterFields,
  downloadAndHostImage,
} from '@/lib/shopify';
import { getPosterById } from '@/lib/db';
import type { ShopifyReferenceImage } from '@/types/poster';

/**
 * POST /api/shopify/refresh
 * Full refresh from Shopify - pulls updated images, metafields, and reference images
 * Body: {
 *   posterId: number,
 *   options?: {
 *     refreshPrimaryImage?: boolean,    // Default: true - re-download primary image
 *     refreshReferenceImages?: boolean, // Default: true - sync reference images from Shopify
 *     triggerReanalysis?: boolean,      // Default: false - trigger AI analysis after refresh
 *     analysisMode?: 'normal' | 'skeptical' // Default: 'normal'
 *   }
 * }
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
    const { posterId, options = {} } = body;
    const {
      refreshPrimaryImage = true,
      refreshReferenceImages = true,
      triggerReanalysis = false,
      analysisMode = 'normal',
    } = options;

    if (!posterId) {
      return NextResponse.json({ error: 'posterId is required' }, { status: 400 });
    }

    // Get existing poster
    const poster = await getPosterById(posterId);
    if (!poster || !poster.shopifyProductId) {
      return NextResponse.json(
        { error: 'Poster not found or not linked to Shopify' },
        { status: 404 }
      );
    }

    console.log(`[refresh] Starting refresh for poster ${posterId} from Shopify`);

    // Get latest data from Shopify
    const product = await getShopifyProduct(poster.shopifyProductId);

    // Fetch metafields
    let metafields: Awaited<ReturnType<typeof getProductMetafields>> = [];
    try {
      metafields = await getProductMetafields(poster.shopifyProductId);
    } catch (mfErr) {
      console.warn(`[refresh] Could not fetch metafields:`, mfErr);
    }

    const mappedFields = mapMetafieldsToPosterFields(metafields);
    const shopifyData = shopifyProductToData(product, metafields);
    const firstVariant = product.variants[0];

    const updateResult: {
      primaryImage: boolean;
      metafields: boolean;
      referenceImages: { added: number; removed: number; unchanged: number };
    } = {
      primaryImage: false,
      metafields: true,
      referenceImages: { added: 0, removed: 0, unchanged: 0 },
    };

    let newImageUrl = poster.imageUrl;
    let newBlobId = poster.imageBlobId;

    // Refresh primary image
    if (refreshPrimaryImage && product.images[0]) {
      const primaryImage = product.images[0];
      console.log(`[refresh] Downloading new primary image from Shopify`);

      try {
        const imageResponse = await fetch(primaryImage.src);
        if (imageResponse.ok) {
          const imageBlob = await imageResponse.blob();
          const extension = new URL(primaryImage.src).pathname.split('.').pop() || 'jpg';
          const fileName = `${product.handle}-${Date.now()}.${extension}`;

          const blob = await put(fileName, imageBlob, {
            access: 'public',
            contentType: imageBlob.type || `image/${extension}`,
          });

          // Optionally delete old blob (if different)
          if (poster.imageBlobId && poster.imageBlobId !== blob.url) {
            try {
              await del(poster.imageBlobId);
              console.log(`[refresh] Deleted old primary image blob`);
            } catch (delErr) {
              console.warn(`[refresh] Could not delete old blob:`, delErr);
            }
          }

          newImageUrl = blob.url;
          newBlobId = blob.url;
          updateResult.primaryImage = true;
          console.log(`[refresh] Primary image updated`);
        }
      } catch (imgErr) {
        console.error(`[refresh] Failed to download primary image:`, imgErr);
      }
    }

    // Refresh reference images from Shopify
    let shopifyRefImages: ShopifyReferenceImage[] = poster.shopifyReferenceImages || [];

    if (refreshReferenceImages && mappedFields.referenceImageUrls) {
      console.log(`[refresh] Processing ${mappedFields.referenceImageUrls.length} reference image URLs from Shopify`);

      // Track existing URLs (from previously imported Shopify images)
      const existingUrls = new Set(shopifyRefImages.map(img => img.url));
      const newUrls = new Set(mappedFields.referenceImageUrls);

      // Find images to remove (no longer in Shopify)
      const toRemove = shopifyRefImages.filter(img => {
        // Check if this was originally from one of the URLs we know about
        // Since we re-host images, we can't directly compare URLs
        // For now, we keep all existing images and just add new ones
        return false; // Don't remove any for now - user can manually remove
      });
      updateResult.referenceImages.removed = toRemove.length;

      // Download and host new images
      const newImages: ShopifyReferenceImage[] = [];
      for (const url of mappedFields.referenceImageUrls) {
        // Check if we already have this URL hosted (compare against original source)
        // For simplicity, we re-download all URLs that aren't already in our hosted list
        const alreadyHosted = shopifyRefImages.some(img =>
          img.url.includes(url.split('/').pop() || 'never-match')
        );

        if (!alreadyHosted) {
          console.log(`[refresh] Downloading reference image: ${url.substring(0, 80)}...`);
          const hosted = await downloadAndHostImage(url, `poster-${posterId}-shopify-ref`);
          if (hosted) {
            newImages.push({
              url: hosted.url,
              blobId: hosted.blobId,
              fileName: hosted.fileName,
              source: 'shopify',
              importDate: new Date(),
            });
          }
        }
      }

      updateResult.referenceImages.added = newImages.length;
      updateResult.referenceImages.unchanged = shopifyRefImages.length;

      // Merge: keep existing Shopify images + add new ones
      shopifyRefImages = [...shopifyRefImages, ...newImages];
      console.log(`[refresh] Total Shopify reference images: ${shopifyRefImages.length}`);
    }

    // Prepare colors array for PostgreSQL
    const colorsLiteral = mappedFields.colors && mappedFields.colors.length > 0
      ? `{${mappedFields.colors.map(c => `"${c.replace(/"/g, '\\"')}"`).join(',')}}`
      : null;

    // Update database with all refreshed data
    await sql`
      UPDATE posters
      SET
        image_url = ${newImageUrl},
        image_blob_id = ${newBlobId},
        title = ${product.title},
        shopify_title = ${product.title},
        product_type = ${product.productType || null},
        sku = ${firstVariant?.sku || null},
        shopify_status = ${product.status},
        shopify_synced_at = NOW(),
        shopify_data = ${JSON.stringify(shopifyData)},
        artist = COALESCE(${mappedFields.artist || null}, artist),
        estimated_date = COALESCE(${mappedFields.estimatedDate || null}, estimated_date),
        dimensions_estimate = COALESCE(${mappedFields.dimensionsEstimate || null}, dimensions_estimate),
        condition = COALESCE(${mappedFields.condition || null}, condition),
        condition_details = COALESCE(${mappedFields.conditionDetails || null}, condition_details),
        user_notes = COALESCE(${mappedFields.userNotes || null}, user_notes),
        item_notes = ${mappedFields.itemNotes || null},
        printing_technique = COALESCE(${mappedFields.printingTechnique || null}, printing_technique),
        colors = COALESCE(${colorsLiteral}::TEXT[], colors),
        shopify_reference_images = ${JSON.stringify(shopifyRefImages)},
        dealer_name = ${mappedFields.dealerName || null},
        last_modified = NOW()
      WHERE id = ${posterId}
    `;

    console.log(`[refresh] Database updated for poster ${posterId}`);

    // Optionally trigger re-analysis
    let analysisTriggered = false;
    if (triggerReanalysis) {
      console.log(`[refresh] Re-analysis requested (mode: ${analysisMode})`);
      // Return flag for client to handle - or could call analyze endpoint internally
      analysisTriggered = true;
    }

    return NextResponse.json({
      success: true,
      posterId,
      updated: updateResult,
      analysisTriggered,
      analysisMode: triggerReanalysis ? analysisMode : undefined,
    });
  } catch (error) {
    console.error('[refresh] Shopify refresh error:', error);
    return NextResponse.json(
      {
        error: 'Failed to refresh from Shopify',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
