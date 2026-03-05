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
          metafields(first: 10, keys: [
            "specs.year",
            "jadepuma.artist",
            "jadepuma.country_of_origin",
            "jadepuma.source_platform",
            "jadepuma.purchase_price",
            "jadepuma.avp_shipping",
            "jadepuma.avp_restoration",
            "jadepuma.internal_tags"
          ]) {
            edges {
              node {
                namespace
                key
                value
              }
            }
          }
          resourcePublicationsV2(first: 20) {
            edges {
              node {
                isPublished
                publication {
                  name
                }
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
  metafields: { edges: { node: { namespace: string; key: string; value: string } }[] };
  resourcePublicationsV2: { edges: { node: { isPublished: boolean; publication: { name: string } } }[] };
}

function parsePrice(value: string | null | undefined): number | null {
  if (!value) return null;
  const cleaned = value.replace(/[^0-9.\-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function getMetafieldValue(product: GQLProduct, namespaceKey: string): string | null {
  // Shopify 2025-01 API returns key as "namespace.key" (e.g. "jadepuma.internal_tags")
  // Handle both formats: full "namespace.key" or just "key"
  const edge = product.metafields.edges.find((e) => {
    const fullKey = e.node.key.includes('.') ? e.node.key : `${e.node.namespace}.${e.node.key}`;
    return fullKey === namespaceKey;
  });
  return edge?.node.value || null;
}

/** Strip JSON array brackets from list-type metafield values: '["USA"]' -> 'USA' */
function cleanListValue(value: string | null): string | null {
  if (!value) return null;
  if (value.startsWith('[')) {
    try {
      const arr = JSON.parse(value);
      if (Array.isArray(arr)) return arr.join(', ');
    } catch { /* not JSON */ }
  }
  return value;
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
    const syncTimestamp = new Date().toISOString();
    let totalSynced = 0;
    let pageNumber = 0;
    let hasNextPage = true;
    let cursor: string | null = null;

    // Ensure columns exist (added after initial migration)
    try {
      await sql`ALTER TABLE products_index ADD COLUMN IF NOT EXISTS internal_tags TEXT`;
      await sql`ALTER TABLE products_index ADD COLUMN IF NOT EXISTS sales_channels TEXT`;
    } catch {
      // Columns may already exist; ignore
    }

    // Paginate through all Shopify products (100 per page to avoid 502s with resourcePublicationsV2)
    while (hasNextPage) {
      pageNumber++;
      const variables: Record<string, unknown> = { first: 100 };
      if (cursor) variables.after = cursor;

      let data;
      // Retry up to 2 times for transient Shopify errors (502, 503, 429)
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          data = await shopifyGraphQL<{
            products: {
              pageInfo: { hasNextPage: boolean; endCursor: string | null };
              edges: { node: GQLProduct }[];
            };
          }>(PRODUCTS_QUERY, variables);
          break; // success
        } catch (err) {
          const isRetryable = String(err).includes('502') || String(err).includes('503') || String(err).includes('429');
          if (isRetryable && attempt < 2) {
            await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
            continue;
          }
          return NextResponse.json(
            { error: 'Sync failed', details: `Shopify GraphQL error on page ${pageNumber} (${totalSynced} synced so far): ${String(err)}` },
            { status: 500 }
          );
        }
      }

      if (!data) {
        return NextResponse.json(
          { error: 'Sync failed', details: `No data returned on page ${pageNumber} (${totalSynced} synced so far)` },
          { status: 500 }
        );
      }
      const products = data.products.edges.map((e) => e.node);

      if (products.length > 0) {
        try {
          // Batch insert using multi-row VALUES
          const valuePlaceholders: string[] = [];
          const insertValues: unknown[] = [];
          let paramIdx = 1;

          for (const p of products) {
            const numericId = p.id.replace('gid://shopify/Product/', '');
            const variant = p.variants.edges[0]?.node;
            const purchasePrice = parsePrice(getMetafieldValue(p, 'jadepuma.purchase_price'));
            const shipping = parsePrice(getMetafieldValue(p, 'jadepuma.avp_shipping'));
            const restoration = parsePrice(getMetafieldValue(p, 'jadepuma.avp_restoration'));
            const totalCogs = (purchasePrice || 0) + (shipping || 0) + (restoration || 0);

            // Parse internal_tags metafield (JSON array like '["INV 2026","Ready to List"]')
            const rawInternalTags = getMetafieldValue(p, 'jadepuma.internal_tags');
            let internalTagsStr: string | null = null;
            if (rawInternalTags) {
              try {
                const parsed = JSON.parse(rawInternalTags);
                if (Array.isArray(parsed)) internalTagsStr = parsed.join(', ');
              } catch {
                internalTagsStr = rawInternalTags;
              }
            }

            // Extract published sales channels (graceful if field absent)
            let salesChannelsStr: string | null = null;
            try {
              if (p.resourcePublicationsV2?.edges) {
                salesChannelsStr = p.resourcePublicationsV2.edges
                  .filter(e => e.node.isPublished)
                  .map(e => e.node.publication.name)
                  .join(', ') || null;
              }
            } catch { /* field may not be available */ }

            const placeholders = [];
            for (let i = 0; i < 25; i++) {
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
              getMetafieldValue(p, 'specs.year') || null,                        // year
              cleanListValue(getMetafieldValue(p, 'jadepuma.artist')) || null,             // artist
              cleanListValue(getMetafieldValue(p, 'jadepuma.country_of_origin')) || null,  // country_of_origin
              cleanListValue(getMetafieldValue(p, 'jadepuma.source_platform')) || null,    // source_platform
              purchasePrice,                                      // purchase_price
              shipping,                                           // shipping
              restoration,                                        // restoration
              totalCogs > 0 ? totalCogs : null,                   // total_cogs
              internalTagsStr,                                    // internal_tags
              salesChannelsStr,                                   // sales_channels
              p.createdAt,                                        // shopify_created_at
              p.updatedAt,                                        // shopify_updated_at
              syncTimestamp,                                       // synced_at
            );
          }

          const insertQuery = `
            INSERT INTO products_index (
              shopify_product_id, shopify_gid, handle, title, status,
              product_type, tags, sku, price, compare_at_price,
              inventory_quantity, thumbnail_url, year, artist,
              country_of_origin, source_platform, purchase_price,
              shipping, restoration, total_cogs, internal_tags,
              sales_channels, shopify_created_at, shopify_updated_at,
              synced_at
            ) VALUES ${valuePlaceholders.join(', ')}
            ON CONFLICT (shopify_product_id) DO UPDATE SET
              title = EXCLUDED.title,
              status = EXCLUDED.status,
              product_type = EXCLUDED.product_type,
              tags = EXCLUDED.tags,
              sku = EXCLUDED.sku,
              price = EXCLUDED.price,
              compare_at_price = EXCLUDED.compare_at_price,
              inventory_quantity = EXCLUDED.inventory_quantity,
              thumbnail_url = EXCLUDED.thumbnail_url,
              year = EXCLUDED.year,
              artist = EXCLUDED.artist,
              country_of_origin = EXCLUDED.country_of_origin,
              source_platform = EXCLUDED.source_platform,
              purchase_price = EXCLUDED.purchase_price,
              shipping = EXCLUDED.shipping,
              restoration = EXCLUDED.restoration,
              total_cogs = EXCLUDED.total_cogs,
              internal_tags = EXCLUDED.internal_tags,
              sales_channels = EXCLUDED.sales_channels,
              shopify_created_at = EXCLUDED.shopify_created_at,
              shopify_updated_at = EXCLUDED.shopify_updated_at,
              synced_at = EXCLUDED.synced_at
          `;

          await sql.query(insertQuery, insertValues);
          totalSynced += products.length;
        } catch (err) {
          return NextResponse.json(
            { error: 'Sync failed', details: `Database insert failed on page ${pageNumber} (${totalSynced} synced so far, batch of ${products.length}): ${String(err)}` },
            { status: 500 }
          );
        }
      }

      hasNextPage = data.products.pageInfo.hasNextPage;
      cursor = data.products.pageInfo.endCursor || null;
    }

    // Remove products that no longer exist in Shopify (not touched by this sync)
    try {
      await sql`DELETE FROM products_index WHERE synced_at < ${syncTimestamp}`;
    } catch {
      // Non-fatal: stale rows remain but won't affect correctness
    }

    // Link to local posters
    try {
      await sql`
        UPDATE products_index pi
        SET local_poster_id = p.id
        FROM posters p
        WHERE pi.shopify_product_id = CAST(p.shopify_product_id AS BIGINT)
          AND p.shopify_product_id IS NOT NULL
      `;
    } catch (err) {
      // Non-fatal: products are synced, just linkage failed
      console.error('Failed to link local posters:', err);
    }

    const elapsed = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      synced: totalSynced,
      pages: pageNumber,
      elapsed: `${(elapsed / 1000).toFixed(1)}s`,
    });
  } catch (error) {
    console.error('Products index sync error:', error);
    return NextResponse.json(
      { error: 'Sync failed', details: `Unexpected error: ${String(error)}` },
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
