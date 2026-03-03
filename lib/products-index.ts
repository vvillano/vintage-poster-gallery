import { sql } from '@vercel/postgres';
import type { IndexProduct, IndexBrowseResponse } from '@/types/product-index';

// Valid sort columns - maps API param to SQL column name
const VALID_SORT_COLUMNS: Record<string, string> = {
  title: 'title',
  status: 'status',
  sku: 'sku',
  product_type: 'product_type',
  year: 'year',
  artist: 'artist',
  country_of_origin: 'country_of_origin',
  source_platform: 'source_platform',
  purchase_price: 'purchase_price',
  total_cogs: 'total_cogs',
  price: 'price',
  compare_at_price: 'compare_at_price',
  inventory_quantity: 'inventory_quantity',
  shopify_created_at: 'shopify_created_at',
  shopify_updated_at: 'shopify_updated_at',
};

export interface BrowseParams {
  q?: string;
  status?: string;
  productType?: string;
  artist?: string;
  country?: string;
  platform?: string;
  tags?: string;
  hasImage?: string;
  sort?: string;
  order?: string;
  page?: number;
  pageSize?: number;
}

function rowToIndexProduct(row: Record<string, unknown>): IndexProduct {
  return {
    id: row.id as number,
    shopifyProductId: Number(row.shopify_product_id),
    shopifyGid: row.shopify_gid as string,
    handle: (row.handle as string) || null,
    title: row.title as string,
    status: row.status as 'active' | 'draft' | 'archived',
    productType: (row.product_type as string) || null,
    tags: (row.tags as string) || null,
    sku: (row.sku as string) || null,
    price: row.price != null ? Number(row.price) : null,
    compareAtPrice: row.compare_at_price != null ? Number(row.compare_at_price) : null,
    inventoryQuantity: row.inventory_quantity != null ? Number(row.inventory_quantity) : null,
    thumbnailUrl: (row.thumbnail_url as string) || null,
    year: (row.year as string) || null,
    artist: (row.artist as string) || null,
    countryOfOrigin: (row.country_of_origin as string) || null,
    sourcePlatform: (row.source_platform as string) || null,
    purchasePrice: row.purchase_price != null ? Number(row.purchase_price) : null,
    totalCogs: row.total_cogs != null ? Number(row.total_cogs) : null,
    localPosterId: row.local_poster_id != null ? Number(row.local_poster_id) : null,
    shopifyCreatedAt: row.shopify_created_at ? new Date(row.shopify_created_at as string).toISOString() : '',
    shopifyUpdatedAt: row.shopify_updated_at ? new Date(row.shopify_updated_at as string).toISOString() : '',
  };
}

export async function browseProductsIndex(params: BrowseParams): Promise<IndexBrowseResponse> {
  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  // Search across title + SKU
  if (params.q) {
    conditions.push(`(title ILIKE $${paramIndex} OR sku ILIKE $${paramIndex})`);
    values.push(`%${params.q}%`);
    paramIndex++;
  }

  // Status filter
  if (params.status && params.status !== 'all') {
    conditions.push(`status = $${paramIndex}`);
    values.push(params.status);
    paramIndex++;
  }

  // Product type filter
  if (params.productType) {
    conditions.push(`product_type = $${paramIndex}`);
    values.push(params.productType);
    paramIndex++;
  }

  // Artist filter
  if (params.artist) {
    conditions.push(`artist = $${paramIndex}`);
    values.push(params.artist);
    paramIndex++;
  }

  // Country filter
  if (params.country) {
    conditions.push(`country_of_origin = $${paramIndex}`);
    values.push(params.country);
    paramIndex++;
  }

  // Platform filter
  if (params.platform) {
    conditions.push(`source_platform = $${paramIndex}`);
    values.push(params.platform);
    paramIndex++;
  }

  // Tags filter (contains match on comma-separated string)
  if (params.tags) {
    conditions.push(`tags ILIKE $${paramIndex}`);
    values.push(`%${params.tags}%`);
    paramIndex++;
  }

  // Image filter
  if (params.hasImage === 'yes') {
    conditions.push(`thumbnail_url IS NOT NULL AND thumbnail_url != ''`);
  } else if (params.hasImage === 'no') {
    conditions.push(`(thumbnail_url IS NULL OR thumbnail_url = '')`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Sorting
  const sortCol = VALID_SORT_COLUMNS[params.sort || ''] || 'shopify_updated_at';
  const sortOrder = params.order === 'asc' ? 'ASC' : 'DESC';

  // Pagination
  const pageSize = Math.min(Math.max(params.pageSize || 50, 1), 250);
  const page = Math.max(params.page || 1, 1);
  const offset = (page - 1) * pageSize;

  // Count query
  const countQuery = `SELECT COUNT(*) as total FROM products_index ${where}`;
  const countResult = await sql.query(countQuery, values);
  const totalResults = parseInt(countResult.rows[0].total || '0');

  // Data query
  const dataQuery = `
    SELECT * FROM products_index
    ${where}
    ORDER BY ${sortCol} ${sortOrder} NULLS LAST
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;
  const dataResult = await sql.query(dataQuery, [...values, pageSize, offset]);

  return {
    products: dataResult.rows.map(rowToIndexProduct),
    pagination: {
      page,
      pageSize,
      totalResults,
      totalPages: Math.ceil(totalResults / pageSize),
    },
  };
}

export async function getFilterOptions() {
  const [productTypes, artists, countries, platforms, tags] = await Promise.all([
    sql`SELECT DISTINCT product_type FROM products_index WHERE product_type IS NOT NULL AND product_type != '' ORDER BY product_type`,
    sql`SELECT DISTINCT artist FROM products_index WHERE artist IS NOT NULL AND artist != '' ORDER BY artist`,
    sql`SELECT DISTINCT country_of_origin FROM products_index WHERE country_of_origin IS NOT NULL AND country_of_origin != '' ORDER BY country_of_origin`,
    sql`SELECT DISTINCT source_platform FROM products_index WHERE source_platform IS NOT NULL AND source_platform != '' ORDER BY source_platform`,
    sql`SELECT DISTINCT TRIM(tag) as tag FROM products_index, unnest(string_to_array(tags, ',')) as tag WHERE tags IS NOT NULL AND TRIM(tag) != '' ORDER BY tag`,
  ]);

  return {
    productTypes: productTypes.rows.map((r) => r.product_type as string),
    artists: artists.rows.map((r) => r.artist as string),
    countries: countries.rows.map((r) => r.country_of_origin as string),
    platforms: platforms.rows.map((r) => r.source_platform as string),
    tags: tags.rows.map((r) => r.tag as string),
  };
}

export async function getSyncStatus() {
  try {
    const result = await sql`
      SELECT COUNT(*) as total, MAX(synced_at) as last_synced
      FROM products_index
    `;
    const total = parseInt(result.rows[0].total || '0');
    return {
      lastSyncedAt: result.rows[0].last_synced ? new Date(result.rows[0].last_synced).toISOString() : null,
      totalProducts: total,
      isEmpty: total === 0,
    };
  } catch {
    return { lastSyncedAt: null, totalProducts: 0, isEmpty: true };
  }
}
