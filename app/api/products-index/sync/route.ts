import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import { shopifyGraphQL } from '@/lib/shopify';
import { getSyncStatus } from '@/lib/products-index';

export const dynamic = 'force-dynamic';

const PRODUCTS_QUERY = `
  query getProductsForIndex($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          title
          handle
          status
          productType
          tags
          createdAt
          updatedAt
          featuredImage {
            url
          }
          variants(first: 1) {
            edges {
              node {
                sku
                price
                compareAtPrice
                inventoryQuantity
              }
            }
          }
          metafields(keys: [
            "specs.year",
            "jadepuma.artist",
            "jadepuma.country_of_origin",
            "jadepuma.source_platform",
            "jadepuma.purchase_price",
            "jadepuma.avp_shipping",
            "jadepuma.avp_restoration"
          ]) {
            edges {
              node {
                key
                value
              }
            }
          }
        }
      }
    }
  }
`;

interface GQLProduct {
  id: string;
  title: string;
  handle: string;
  status: string;
  productType: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  featuredImage: { url: string } | null;
  variants: { edges: { node: { sku: string | null; price: string; compareAtPrice: string | null; inventoryQuantity: number | null } }[] };
  metafields: { edges: { node: { key: string; value: string } }[] };
}

function parsePrice(value: string | null | undefined): number | null {
  if (!value) return null;
  const cleaned = value.replace(/[^0-9.\-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function getMetafieldValue(product: GQLProduct, key: string): string | null {
  const edge = product.metafields.edges.find((e) => e.node.key === key);
  return edge?.node.value || null;
}

/**
 * POST /api/products-index/sync
 * Full sync of all Shopify products into products_index table
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const startTime = Date.now();
    let totalSynced = 0;
    let hasNextPage = true;
    let cursor: string | null = null;

    // Clear existing data
    await sql`DELETE FROM products_index`;

    // Paginate through all Shopify products
    while (hasNextPage) {
      const variables: Record<string, unknown> = { first: 250 };
      if (cursor) variables.after = cursor;

      const data = await shopifyGraphQL<{
        products: {
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
          edges: { node: GQLProduct }[];
        };
      }>(PRODUCTS_QUERY, variables);

      const products = data.products.edges.map((e) => e.node);

      if (products.length > 0) {
        // Batch insert using multi-row VALUES
        const valuePlaceholders: string[] = [];
        const insertValues: unknown[] = [];
        let paramIdx = 1;

        for (const p of products) {
          const numericId = p.id.replace('gid://shopify/Product/', '');
          const variant = p.variants.edges[0]?.node;
          const purchasePrice = parsePrice(getMetafieldValue(p, 'purchase_price'));
          const shipping = parsePrice(getMetafieldValue(p, 'avp_shipping'));
          const restoration = parsePrice(getMetafieldValue(p, 'avp_restoration'));
          const totalCogs = (purchasePrice || 0) + (shipping || 0) + (restoration || 0);

          const placeholders = [];
          for (let i = 0; i < 22; i++) {
            placeholders.push(`$${paramIdx++}`);
          }
          valuePlaceholders.push(`(${placeholders.join(', ')})`);

          insertValues.push(
            numericId,                                          // shopify_product_id
            p.id,                                               // shopify_gid
            p.handle,                                           // handle
            p.title,                                            // title
            p.status.toLowerCase(),                             // status
            p.productType || null,                              // product_type
            p.tags.join(', ') || null,                          // tags
            variant?.sku || null,                                // sku
            parsePrice(variant?.price) ?? null,                 // price
            parsePrice(variant?.compareAtPrice) ?? null,        // compare_at_price
            variant?.inventoryQuantity ?? null,                 // inventory_quantity
            p.featuredImage?.url || null,                       // thumbnail_url
            getMetafieldValue(p, 'year') || null,               // year
            getMetafieldValue(p, 'artist') || null,             // artist
            getMetafieldValue(p, 'country_of_origin') || null,  // country_of_origin
            getMetafieldValue(p, 'source_platform') || null,    // source_platform
            purchasePrice,                                      // purchase_price
            shipping,                                           // shipping
            restoration,                                        // restoration
            totalCogs > 0 ? totalCogs : null,                   // total_cogs
            p.createdAt,                                        // shopify_created_at
            p.updatedAt,                                        // shopify_updated_at
          );
        }

        const insertQuery = `
          INSERT INTO products_index (
            shopify_product_id, shopify_gid, handle, title, status,
            product_type, tags, sku, price, compare_at_price,
            inventory_quantity, thumbnail_url, year, artist,
            country_of_origin, source_platform, purchase_price,
            shipping, restoration, total_cogs,
            shopify_created_at, shopify_updated_at
          ) VALUES ${valuePlaceholders.join(', ')}
        `;

        await sql.query(insertQuery, insertValues);
        totalSynced += products.length;
      }

      hasNextPage = data.products.pageInfo.hasNextPage;
      cursor = data.products.pageInfo.endCursor || null;
    }

    // Link to local posters
    await sql`
      UPDATE products_index pi
      SET local_poster_id = p.id
      FROM posters p
      WHERE pi.shopify_product_id = CAST(p.shopify_product_id AS BIGINT)
        AND p.shopify_product_id IS NOT NULL
    `;

    const elapsed = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      synced: totalSynced,
      elapsed: `${(elapsed / 1000).toFixed(1)}s`,
    });
  } catch (error) {
    console.error('Products index sync error:', error);
    return NextResponse.json(
      { error: 'Sync failed', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/products-index/sync
 * Get sync status
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const status = await getSyncStatus();
    return NextResponse.json(status);
  } catch (error) {
    console.error('Sync status error:', error);
    return NextResponse.json(
      { error: 'Failed to get sync status', details: String(error) },
      { status: 500 }
    );
  }
}
