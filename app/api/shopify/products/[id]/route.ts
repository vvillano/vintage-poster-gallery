import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import {
  getProductDetailGraphQL,
  updateShopifyProductGraphQL,
  updateVariantPriceGraphQL,
  updateInventoryItemGraphQL,
  setInventoryQuantityGraphQL,
  deleteShopifyProductGraphQL,
  setProductMetafield,
} from '@/lib/shopify';
import type { ProductUpdatePayload, LinkedPosterData } from '@/types/shopify-product-detail';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const product = await getProductDetailGraphQL(id);

    // Enrich with linked poster data from research database
    const posterResult = await sql`
      SELECT p.id, p.raw_ai_response, p.comparable_sales, p.artist_confidence,
             p.artist_confidence_score, p.attribution_basis, p.source_citations,
             p.rarity_analysis, p.value_insights, p.analysis_completed,
             p.artist, p.estimated_date, p.date_confidence, p.date_source,
             p.artist_source, p.printing_technique, p.printer,
             p.printer_confidence, p.publisher_confidence,
             p.historical_context, p.significance, p.validation_notes,
             p.artist_verification, p.artist_id,
             a.id as linked_artist_id, a.name as linked_artist_name,
             a.aliases as linked_artist_aliases, a.nationality as linked_artist_nationality,
             a.birth_year as linked_artist_birth_year, a.death_year as linked_artist_death_year,
             a.wikipedia_url as linked_artist_wikipedia_url, a.bio as linked_artist_bio,
             a.image_url as linked_artist_image_url, a.verified as linked_artist_verified
      FROM posters p
      LEFT JOIN artists a ON p.artist_id = a.id
      WHERE p.shopify_product_id = ${product.gid}
      LIMIT 1
    `;

    if (posterResult.rows.length > 0) {
      const poster = posterResult.rows[0];
      const raw = typeof poster.raw_ai_response === 'string'
        ? JSON.parse(poster.raw_ai_response)
        : poster.raw_ai_response;

      const linkedPoster: LinkedPosterData = {
        posterId: poster.id,
        talkingPoints: raw?.talkingPoints || [],
        designProfile: {
          periodMovement: raw?.historicalContext?.periodMovement || null,
          publication: raw?.historicalContext?.publication || null,
          advertiser: raw?.historicalContext?.advertiser || null,
          eraContext: raw?.historicalContext?.eraContext || null,
          composition: raw?.technicalAnalysis?.composition || null,
          colorPalette: raw?.technicalAnalysis?.colorPalette || null,
          typography: raw?.technicalAnalysis?.typography || null,
        },
        timeAndPlace: {
          world: raw?.historicalContext?.timeAndPlace?.world || null,
          regional: raw?.historicalContext?.timeAndPlace?.regional || null,
          local: raw?.historicalContext?.timeAndPlace?.local || null,
        },
        rarityValue: {
          rarityAssessment: poster.rarity_analysis || null,
          valueInsights: poster.value_insights || null,
          collectorInterest: null,
        },
        comparableSales: Array.isArray(poster.comparable_sales)
          ? poster.comparable_sales
          : (typeof poster.comparable_sales === 'string'
              ? JSON.parse(poster.comparable_sales)
              : []),
        artistConfidence: poster.artist_confidence || null,
        artistConfidenceScore: poster.artist_confidence_score || null,
        attributionBasis: poster.attribution_basis || null,
        sourceCitations: Array.isArray(poster.source_citations)
          ? poster.source_citations
          : (typeof poster.source_citations === 'string'
              ? JSON.parse(poster.source_citations)
              : []),
        suggestedTags: raw?.suggestedTags || [],
        suggestedColors: raw?.suggestedColors || [],
        // Analysis results for Research tab
        analysisCompleted: !!poster.analysis_completed,
        artist: poster.artist || null,
        estimatedDate: poster.estimated_date || null,
        dateConfidence: poster.date_confidence || null,
        dateSource: poster.date_source || null,
        artistSource: poster.artist_source || null,
        printingTechnique: poster.printing_technique || null,
        printer: poster.printer || null,
        printerConfidence: poster.printer_confidence || null,
        publisher: raw?.technicalAnalysis?.publisher || null,
        publisherConfidence: poster.publisher_confidence || null,
        historicalContext: poster.historical_context || null,
        culturalSignificance: poster.significance || null,
        productDescriptions: raw?.productDescriptions || null,
        validationNotes: raw?.validationNotes || null,
        artistVerification: raw?.identification?.artistVerification || null,
        linkedArtist: poster.linked_artist_id ? {
          id: poster.linked_artist_id,
          name: poster.linked_artist_name,
          aliases: poster.linked_artist_aliases || [],
          nationality: poster.linked_artist_nationality || null,
          birthYear: poster.linked_artist_birth_year || null,
          deathYear: poster.linked_artist_death_year || null,
          wikipediaUrl: poster.linked_artist_wikipedia_url || null,
          bio: poster.linked_artist_bio || null,
          imageUrl: poster.linked_artist_image_url || null,
          verified: !!poster.linked_artist_verified,
        } : null,
      };

      product.linkedPoster = linkedPoster;
    }

    return NextResponse.json(product);
  } catch (error) {
    console.error('Get product detail error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch product', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = (await request.json()) as ProductUpdatePayload;

    // Fetch current product to get variant/inventory IDs
    const current = await getProductDetailGraphQL(id);

    // Update core product fields if any changed
    const hasProductChanges = body.title !== undefined || body.bodyHtml !== undefined ||
      body.productType !== undefined || body.status !== undefined || body.tags !== undefined;
    if (hasProductChanges) {
      await updateShopifyProductGraphQL(current.gid, body);
    }

    // Update variant price if changed
    if (body.price !== undefined || body.compareAtPrice !== undefined) {
      await updateVariantPriceGraphQL(
        current.gid,
        current.variantGid,
        body.price ?? current.price,
        body.compareAtPrice !== undefined ? body.compareAtPrice : current.compareAtPrice
      );
    }

    // Update SKU if changed
    if (body.sku !== undefined && current.inventoryItemGid) {
      await updateInventoryItemGraphQL(current.inventoryItemGid, body.sku);
    }

    // Update inventory quantity if changed
    if (body.inventoryQuantity !== undefined && current.inventoryItemGid && current.locationGid) {
      await setInventoryQuantityGraphQL(
        current.inventoryItemGid,
        current.locationGid,
        body.inventoryQuantity
      );
    }

    // Write metafields if any
    if (body.metafields && body.metafields.length > 0) {
      for (const mf of body.metafields) {
        await setProductMetafield(id, mf);
      }
    }

    // Re-fetch updated product
    const updated = await getProductDetailGraphQL(id);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Update product error:', error);
    return NextResponse.json(
      { error: 'Failed to update product', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const gid = id.startsWith('gid://') ? id : `gid://shopify/Product/${id}`;

    const deletedId = await deleteShopifyProductGraphQL(gid);

    // Unlink any local poster referencing this product
    await sql`
      UPDATE posters SET shopify_product_id = NULL
      WHERE shopify_product_id = ${gid}
    `;

    return NextResponse.json({ success: true, deletedProductId: deletedId });
  } catch (error) {
    console.error('Delete product error:', error);
    return NextResponse.json(
      { error: 'Failed to delete product', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
