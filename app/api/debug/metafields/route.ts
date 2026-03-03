import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getShopifyConfig } from '@/lib/shopify';

export const dynamic = 'force-dynamic';

/**
 * GET /api/debug/metafields?id=7294148444275
 * Raw diagnostic: fetch metafields for a product and return the raw Shopify response
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const config = await getShopifyConfig();
  if (!config) {
    return NextResponse.json({ error: 'Shopify not configured' }, { status: 500 });
  }

  const id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Missing id param' }, { status: 400 });
  }

  const gid = id.startsWith('gid://') ? id : `gid://shopify/Product/${id}`;

  // Minimal query: just metafields with a few keys
  const smallQuery = `
    query testMetafields($id: ID!) {
      product(id: $id) {
        id
        title
        metafields(first: 5, keys: [
          "jadepuma.artist",
          "jadepuma.internal_tags",
          "specs.year"
        ]) {
          edges {
            node { namespace key value type }
          }
          nodes { namespace key value type }
        }
      }
    }
  `;

  // Full query: all 30 keys (same as PRODUCT_DETAIL_QUERY)
  const fullQuery = `
    query testMetafieldsFull($id: ID!) {
      product(id: $id) {
        id
        title
        metafields(first: 35, keys: [
          "jadepuma.artist", "jadepuma.date", "jadepuma.condition",
          "jadepuma.condition_details", "jadepuma.color", "jadepuma.medium",
          "jadepuma.country_of_origin", "jadepuma.location",
          "jadepuma.internal_notes", "jadepuma.item_notes",
          "jadepuma.purchase_price", "jadepuma.avp_shipping",
          "jadepuma.avp_restoration", "jadepuma.dealer",
          "jadepuma.source_platform", "jadepuma.platform_identity",
          "jadepuma.private_seller_name", "jadepuma.concise_description",
          "jadepuma.printer", "jadepuma.publisher",
          "jadepuma.book_title_source", "jadepuma.book_source",
          "jadepuma.artist_bio",
          "jadepuma.reference_images", "jadepuma.restoration_candidate",
          "jadepuma.primary_collection", "jadepuma.internal_tags",
          "specs.year", "specs.height", "specs.width"
        ]) {
          edges {
            node { namespace key value type }
          }
          nodes { namespace key value type }
        }
      }
    }
  `;

  const url = `https://${config.shopDomain.trim()}/admin/api/${config.apiVersion}/graphql.json`;

  const results: Record<string, unknown> = {
    apiVersion: config.apiVersion,
    productGid: gid,
  };

  // Test 1: Small query (3 keys)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': config.accessToken,
      },
      body: JSON.stringify({ query: smallQuery, variables: { id: gid } }),
      cache: 'no-store',
    });
    const raw = await res.json();
    results.smallQuery = {
      status: res.status,
      errors: raw.errors || null,
      product: raw.data?.product ? {
        id: raw.data.product.id,
        title: raw.data.product.title,
        metafieldsEdgesCount: raw.data.product.metafields?.edges?.length ?? 'edges is null/undefined',
        metafieldsNodesCount: raw.data.product.metafields?.nodes?.length ?? 'nodes is null/undefined',
        metafieldsRaw: raw.data.product.metafields,
      } : 'product is null',
    };
  } catch (err) {
    results.smallQuery = { error: String(err) };
  }

  // Test 2: Full query (30 keys)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': config.accessToken,
      },
      body: JSON.stringify({ query: fullQuery, variables: { id: gid } }),
      cache: 'no-store',
    });
    const raw = await res.json();
    results.fullQuery = {
      status: res.status,
      errors: raw.errors || null,
      product: raw.data?.product ? {
        id: raw.data.product.id,
        title: raw.data.product.title,
        metafieldsEdgesCount: raw.data.product.metafields?.edges?.length ?? 'edges is null/undefined',
        metafieldsNodesCount: raw.data.product.metafields?.nodes?.length ?? 'nodes is null/undefined',
        metafieldsRaw: raw.data.product.metafields,
      } : 'product is null',
    };
  } catch (err) {
    results.fullQuery = { error: String(err) };
  }

  return NextResponse.json(results);
}
