import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import { shopifyGraphQL } from '@/lib/shopify';
import { getSyncStatus } from '@/lib/products-index';

export const dynamic = 'force-dynamic';

// Max pages per chunk -- keeps each function call well under timeout
const PAGES_PER_CHUNK = 5;

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
 *
 * Chunked sync: processes PAGES_PER_CHUNK pages per call.
 * Body (optional): { cursor?: string, syncTimestamp?: string, totalSynced?: number }
 * Returns: { done: false, cursor, syncTimestamp, synced, chunkSynced }
 *       or { done: true, synced, elapsed }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse continuation state from body (if resuming)
    let body: { cursor?: string; syncTimestamp?: string; totalSynced?: number } = {};
    try {
      body = await request.json();
    } catch { /* first call has no body */ }

    const isFirstChunk = !body.cursor;
    const syncTimestamp = body.syncTimestamp || new Date().toISOString();
    let totalSynced = body.totalSynced || 0;
    let cursor: string | null = body.cursor || null;
    const startTime = Date.now();

    console.log(`[sync] Chunk start: isFirst=${isFirstChunk}, cursor=${cursor ? 'yes' : 'no'}, totalSynced=${totalSynced}, pagesPerChunk=${PAGES_PER_CHUNK}`);

    // First chunk: ensure columns exist
    if (isFirstChunk) {
      const alterStart = Date.now();
      try {
        await sql`ALTER TABLE products_index ADD COLUMN IF NOT EXISTS internal_tags TEXT`;
        await sql`ALTER TABLE products_index ADD COLUMN IF NOT EXISTS sales_channels TEXT`;
        console.log(`[sync] ALTER TABLE took ${Date.now() - alterStart}ms`);
      } catch {
        console.log(`[sync] ALTER TABLE skipped (${Date.now() - alterStart}ms)`);
      }
    }

    let hasNextPage = true;
    let pagesThisChunk = 0;

    while (hasNextPage && pagesThisChunk < PAGES_PER_CHUNK) {
      pagesThisChunk++;
      const variables: Record<string, unknown> = { first: 50 };
      if (cursor) variables.after = cursor;

      let data;
      console.log(`[sync] Page ${pagesThisChunk}: starting Shopify call...`);
      const shopifyStart = Date.now();
      // Retry up to 2 times for transient Shopify errors (502, 503, 429, timeout)
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          data = await shopifyGraphQL<{
            products: {
              pageInfo: { hasNextPage: boolean; endCursor: string | null };
              edges: { node: GQLProduct }[];
            };
          }>(PRODUCTS_QUERY, variables, { timeoutMs: 30000 });
          break;
        } catch (err) {
          console.log(`[sync] Page ${pagesThisChunk}: attempt ${attempt + 1} failed: ${String(err).slice(0, 200)}`);
          const errStr = String(err);
          const isRetryable = errStr.includes('502') || errStr.includes('503') || errStr.includes('429') || errStr.includes('timeout');
          if (isRetryable && attempt < 2) {
            await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
            continue;
          }
          return NextResponse.json(
            { error: 'Sync failed', details: `Shopify GraphQL error (${totalSynced} synced so far): ${String(err)}` },
            { status: 500 }
          );
        }
      }

      if (!data) {
        return NextResponse.json(
          { error: 'Sync failed', details: `No data returned (${totalSynced} synced so far)` },
          { status: 500 }
        );
      }

      console.log(`[sync] Page ${pagesThisChunk}: Shopify call took ${Date.now() - shopifyStart}ms, got ${data.products.edges.length} products`);

      const products = data.products.edges.map((e) => e.node);

      if (products.length > 0) {
        try {
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
              numericId, p.id, p.handle, p.title, p.status.toLowerCase(),
              p.productType || null, p.tags.join(', ') || null,
              variant?.sku || null, parsePrice(variant?.price) ?? null,
              parsePrice(variant?.compareAtPrice) ?? null,
              variant?.inventoryQuantity ?? null, p.featuredImage?.url || null,
              getMetafieldValue(p, 'specs.year') || null,
              cleanListValue(getMetafieldValue(p, 'jadepuma.artist')) || null,
              cleanListValue(getMetafieldValue(p, 'jadepuma.country_of_origin')) || null,
              cleanListValue(getMetafieldValue(p, 'jadepuma.source_platform')) || null,
              purchasePrice, shipping, restoration,
              totalCogs > 0 ? totalCogs : null,
              internalTagsStr, salesChannelsStr,
              p.createdAt, p.updatedAt, syncTimestamp,
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
              title = EXCLUDED.title, status = EXCLUDED.status,
              product_type = EXCLUDED.product_type, tags = EXCLUDED.tags,
              sku = EXCLUDED.sku, price = EXCLUDED.price,
              compare_at_price = EXCLUDED.compare_at_price,
              inventory_quantity = EXCLUDED.inventory_quantity,
              thumbnail_url = EXCLUDED.thumbnail_url, year = EXCLUDED.year,
              artist = EXCLUDED.artist,
              country_of_origin = EXCLUDED.country_of_origin,
              source_platform = EXCLUDED.source_platform,
              purchase_price = EXCLUDED.purchase_price,
              shipping = EXCLUDED.shipping, restoration = EXCLUDED.restoration,
              total_cogs = EXCLUDED.total_cogs,
              internal_tags = EXCLUDED.internal_tags,
              sales_channels = EXCLUDED.sales_channels,
              shopify_created_at = EXCLUDED.shopify_created_at,
              shopify_updated_at = EXCLUDED.shopify_updated_at,
              synced_at = EXCLUDED.synced_at
          `;

          const dbStart = Date.now();
          await sql.query(insertQuery, insertValues);
          console.log(`[sync] Page ${pagesThisChunk}: DB insert took ${Date.now() - dbStart}ms for ${products.length} products`);
          totalSynced += products.length;
        } catch (err) {
          return NextResponse.json(
            { error: 'Sync failed', details: `Database insert failed (${totalSynced} synced so far, batch of ${products.length}): ${String(err)}` },
            { status: 500 }
          );
        }
      }

      hasNextPage = data.products.pageInfo.hasNextPage;
      cursor = data.products.pageInfo.endCursor || null;
    }

    // If more pages remain, return continuation state
    if (hasNextPage && cursor) {
      return NextResponse.json({
        done: false,
        cursor,
        syncTimestamp,
        synced: totalSynced,
        chunkSynced: pagesThisChunk * 50,
      });
    }

    // Final chunk: clean up stale rows and link posters
    try {
      await sql`DELETE FROM products_index WHERE synced_at < ${syncTimestamp}`;
    } catch {
      // Non-fatal
    }

    try {
      await sql`
        UPDATE products_index pi
        SET local_poster_id = p.id
        FROM posters p
        WHERE pi.shopify_product_id = CAST(p.shopify_product_id AS BIGINT)
          AND p.shopify_product_id IS NOT NULL
      `;
    } catch (err) {
      console.error('Failed to link local posters:', err);
    }

    const elapsed = Date.now() - startTime;

    return NextResponse.json({
      done: true,
      success: true,
      synced: totalSynced,
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
    return NextResponse.json({ ...status, _syncVersion: 'chunked-v2' });
  } catch (error) {
    console.error('Sync status error:', error);
    return NextResponse.json(
      { error: 'Failed to get sync status', details: String(error) },
      { status: 500 }
    );
  }
}
