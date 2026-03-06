import { sql } from '@vercel/postgres';
import { shopifyGraphQL } from '@/lib/shopify';

// GraphQL query for fetching products (full sync -- no query filter)
export const PRODUCTS_QUERY = `
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

// GraphQL query with query parameter for incremental sync (filter by updated_at)
export const PRODUCTS_QUERY_WITH_FILTER = `
  query getProductsForIndex($first: Int!, $after: String, $query: String) {
    products(first: $first, after: $after, query: $query) {
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

export interface GQLProduct {
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

export interface ProductsPageResult {
  products: GQLProduct[];
  hasNextPage: boolean;
  endCursor: string | null;
}

export function parsePrice(value: string | null | undefined): number | null {
  if (!value) return null;
  const cleaned = value.replace(/[^0-9.\-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

export function getMetafieldValue(product: GQLProduct, namespaceKey: string): string | null {
  const edge = product.metafields.edges.find((e) => {
    const fullKey = e.node.key.includes('.') ? e.node.key : `${e.node.namespace}.${e.node.key}`;
    return fullKey === namespaceKey;
  });
  return edge?.node.value || null;
}

/** Strip JSON array brackets from list-type metafield values: '["USA"]' -> 'USA' */
export function cleanListValue(value: string | null): string | null {
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
 * Fetch a page of products from Shopify GraphQL.
 * Optionally pass a query filter for incremental sync.
 */
export async function fetchProductsPage(
  cursor: string | null,
  pageSize: number = 50,
  queryFilter?: string
): Promise<ProductsPageResult> {
  const variables: Record<string, unknown> = { first: pageSize };
  if (cursor) variables.after = cursor;
  if (queryFilter) variables.query = queryFilter;

  const query = queryFilter ? PRODUCTS_QUERY_WITH_FILTER : PRODUCTS_QUERY;

  const data = await shopifyGraphQL<{
    products: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      edges: { node: GQLProduct }[];
    };
  }>(query, variables, { timeoutMs: 30000 });

  return {
    products: data.products.edges.map((e) => e.node),
    hasNextPage: data.products.pageInfo.hasNextPage,
    endCursor: data.products.pageInfo.endCursor || null,
  };
}

/**
 * Upsert an array of GQLProduct into products_index.
 * Returns the number of products upserted.
 */
export async function upsertProducts(products: GQLProduct[], syncTimestamp: string): Promise<number> {
  if (products.length === 0) return 0;

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

  await sql.query(insertQuery, insertValues);
  return products.length;
}

/** Delete stale rows after a full sync completes */
export async function deleteStaleRows(syncTimestamp: string): Promise<void> {
  await sql`DELETE FROM products_index WHERE synced_at < ${syncTimestamp}`;
}

/** Link products_index rows to local posters table */
export async function linkLocalPosters(): Promise<void> {
  await sql`
    UPDATE products_index pi
    SET local_poster_id = p.id
    FROM posters p
    WHERE pi.shopify_product_id = CAST(p.shopify_product_id AS BIGINT)
      AND p.shopify_product_id IS NOT NULL
  `;
}
