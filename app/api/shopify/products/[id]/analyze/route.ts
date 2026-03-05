import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import { getProductDetailGraphQL } from '@/lib/shopify';
import { analyzePoster, flattenAnalysis, ShopifyAnalysisContext } from '@/lib/claude';
import { updatePosterAnalysis } from '@/lib/db';
import { autoLinkPosterEntities } from '@/lib/auto-link';

/**
 * POST /api/shopify/products/[id]/analyze
 *
 * Run AI analysis on a product. Auto-creates a poster record if none exists.
 * Body: { additionalContext?: string, skepticalMode?: boolean, forceReanalyze?: boolean }
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

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Analysis service not configured', details: 'ANTHROPIC_API_KEY is missing' },
        { status: 500 }
      );
    }

    const { id } = await params;
    const { additionalContext, skepticalMode, forceReanalyze } = await request.json();

    // Fetch product from Shopify
    const product = await getProductDetailGraphQL(id);
    if (!product.images || product.images.length === 0) {
      return NextResponse.json(
        { error: 'Product has no images. Upload at least one image before running analysis.' },
        { status: 400 }
      );
    }

    const imageUrl = product.images[0].url;
    const gid = product.gid;

    // Look up or create poster record
    let posterId: number;
    let alreadyAnalyzed = false;

    const existing = await sql`
      SELECT id, analysis_completed FROM posters
      WHERE shopify_product_id = ${gid}
      LIMIT 1
    `;

    if (existing.rows.length > 0) {
      posterId = existing.rows[0].id;
      alreadyAnalyzed = !!existing.rows[0].analysis_completed;
    } else {
      // Auto-create poster record from Shopify product data
      const result = await sql`
        INSERT INTO posters (
          image_url, image_blob_id, file_name, file_size,
          uploaded_by, title, shopify_product_id, sku,
          shopify_status, shopify_synced_at, analysis_completed,
          product_type, condition, condition_details, item_notes,
          record_source
        ) VALUES (
          ${imageUrl}, ${imageUrl}, ${product.handle || 'product'}, 0,
          ${session.user.email || 'unknown'}, ${product.title}, ${gid},
          ${product.sku || null}, ${product.status}, NOW(), false,
          ${product.productType || null},
          ${product.metafields.condition || null},
          ${product.metafields.conditionDetails || null},
          ${product.metafields.itemNotes || null},
          'shopify_import'
        )
        RETURNING id
      `;
      posterId = result.rows[0].id;
    }

    if (alreadyAnalyzed && !forceReanalyze) {
      return NextResponse.json(
        { error: 'Already analyzed. Click Re-analyze to run again.' },
        { status: 400 }
      );
    }

    console.log(`[product-analyze] Starting analysis for product ${id} (poster ${posterId})`);
    if (skepticalMode) {
      console.log('[product-analyze] SKEPTICAL MODE enabled');
    }

    // Build context from product metafields
    // Exclude condition/conditionDetails/bodyHtml -- condition is about physical
    // state (relevant to valuation, not identification), and bodyHtml is often
    // just boilerplate condition text that could mislead the AI.
    const shopifyContext: ShopifyAnalysisContext | undefined =
      skepticalMode ? undefined : {
        artist: forceReanalyze ? undefined : product.metafields.artist,
        estimatedDate: forceReanalyze ? undefined : product.metafields.year,
        title: product.title,
        itemNotes: product.metafields.itemNotes,
        printingTechnique: forceReanalyze ? undefined : product.metafields.medium,
      };

    // Parse reference images from metafield (if any)
    let shopifyRefImages;
    if (product.metafields.referenceImages) {
      try {
        const parsed = JSON.parse(product.metafields.referenceImages);
        if (Array.isArray(parsed)) {
          shopifyRefImages = parsed;
        }
      } catch { /* ignore parse errors */ }
    }

    // Run Claude analysis
    const analysis = await analyzePoster(
      imageUrl,
      additionalContext || undefined,
      product.productType || undefined,
      undefined, // no supplemental images from Research App
      shopifyRefImages,
      shopifyContext,
      skepticalMode
    );

    console.log('[product-analyze] Analysis completed');

    // Save results
    const flattenedAnalysis = flattenAnalysis(analysis);
    await updatePosterAnalysis(posterId, {
      ...flattenedAnalysis,
      rawAiResponse: analysis,
    });

    // Auto-link entities
    const linkResults = await autoLinkPosterEntities(posterId, {
      artist: flattenedAnalysis.artist,
      artistConfidence: flattenedAnalysis.artistConfidence,
      printer: flattenedAnalysis.printer,
      printerConfidence: flattenedAnalysis.printerConfidence,
      publication: analysis.historicalContext?.publication,
    });

    return NextResponse.json({
      success: true,
      posterId,
      analysis,
      linkedEntities: linkResults,
    });
  } catch (error) {
    console.error('[product-analyze] Error:', error);

    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('rate limit') ? 429
      : message.includes('too large') ? 413
      : 500;

    return NextResponse.json(
      { error: 'Analysis failed', details: message },
      { status }
    );
  }
}
