import { sql } from '@vercel/postgres';
import type { ShopifyConfig, ShopifyProduct, ShopifyData, ShopifyMetafieldData } from '@/types/poster';

// =====================
// Configuration Functions
// =====================

/**
 * Get Shopify configuration from database
 */
export async function getShopifyConfig(): Promise<ShopifyConfig | null> {
  const result = await sql`
    SELECT * FROM shopify_config LIMIT 1
  `;

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    shopDomain: row.shop_domain,
    accessToken: row.access_token,
    apiVersion: row.api_version,
    clientId: row.client_id || undefined,
    clientSecret: row.client_secret || undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * Save or update Shopify configuration
 */
export async function saveShopifyConfig(config: {
  shopDomain: string;
  accessToken: string;
  apiVersion?: string;
  clientId?: string;
  clientSecret?: string;
}): Promise<ShopifyConfig> {
  // Use upsert pattern - delete existing and insert new
  await sql`DELETE FROM shopify_config`;

  const result = await sql`
    INSERT INTO shopify_config (shop_domain, access_token, api_version, client_id, client_secret)
    VALUES (
      ${config.shopDomain},
      ${config.accessToken},
      ${config.apiVersion || '2025-01'},
      ${config.clientId || null},
      ${config.clientSecret || null}
    )
    RETURNING *
  `;

  const row = result.rows[0];
  return {
    id: row.id,
    shopDomain: row.shop_domain,
    accessToken: row.access_token,
    apiVersion: row.api_version,
    clientId: row.client_id || undefined,
    clientSecret: row.client_secret || undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * Save OAuth credentials (before OAuth flow completes)
 */
export async function saveShopifyOAuthCredentials(config: {
  shopDomain: string;
  clientId: string;
  clientSecret: string;
  apiVersion?: string;
}): Promise<void> {
  // Use upsert pattern - delete existing and insert new
  await sql`DELETE FROM shopify_config`;

  await sql`
    INSERT INTO shopify_config (shop_domain, access_token, api_version, client_id, client_secret)
    VALUES (
      ${config.shopDomain},
      '',
      ${config.apiVersion || '2025-01'},
      ${config.clientId},
      ${config.clientSecret}
    )
  `;
}

/**
 * Update access token after OAuth callback
 */
export async function updateShopifyAccessToken(accessToken: string): Promise<void> {
  await sql`
    UPDATE shopify_config
    SET access_token = ${accessToken}, updated_at = NOW()
  `;
}

/**
 * Delete Shopify configuration
 */
export async function deleteShopifyConfig(): Promise<void> {
  await sql`DELETE FROM shopify_config`;
}

// =====================
// Shopify API Functions
// =====================

/**
 * Make authenticated request to Shopify Admin API
 */
export async function shopifyFetch<T>(
  endpoint: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: unknown;
  } = {}
): Promise<T> {
  const config = await getShopifyConfig();

  if (!config) {
    throw new Error('Shopify not configured');
  }

  const url = `https://${config.shopDomain}/admin/api/${config.apiVersion}${endpoint}`;

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': config.accessToken,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Shopify API error: ${response.status} ${errorText}`);
  }

  return response.json();
}

/**
 * Test Shopify connection
 */
export async function testShopifyConnection(): Promise<{
  success: boolean;
  shopName?: string;
  error?: string;
}> {
  try {
    const config = await getShopifyConfig();
    if (!config) {
      return { success: false, error: 'Shopify not configured' };
    }

    const data = await shopifyFetch<{ shop: { name: string } }>('/shop.json');
    return { success: true, shopName: data.shop.name };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get products from Shopify
 */
export async function getShopifyProducts(options?: {
  query?: string;
  limit?: number;
  sinceId?: string;
  status?: 'active' | 'draft' | 'archived';
}): Promise<ShopifyProduct[]> {
  const params = new URLSearchParams();

  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.sinceId) params.set('since_id', options.sinceId);
  if (options?.status) params.set('status', options.status);
  if (options?.query) params.set('title', options.query); // Search by title

  const queryString = params.toString();
  const endpoint = `/products.json${queryString ? `?${queryString}` : ''}`;

  const data = await shopifyFetch<{ products: ShopifyApiProduct[] }>(endpoint);

  return data.products.map((p) => mapShopifyProduct(p));
}

/**
 * Get inventory item cost from Shopify
 */
async function getInventoryItemCost(inventoryItemId: number): Promise<string | null> {
  try {
    const data = await shopifyFetch<{ inventory_item: ShopifyApiInventoryItem }>(
      `/inventory_items/${inventoryItemId}.json`
    );
    return data.inventory_item.cost;
  } catch (error) {
    console.warn(`Could not fetch inventory item ${inventoryItemId}:`, error);
    return null;
  }
}

/**
 * Get a single product from Shopify (with variant costs)
 */
export async function getShopifyProduct(
  productId: string
): Promise<ShopifyProduct> {
  // Extract numeric ID from gid if needed
  const numericId = productId.replace('gid://shopify/Product/', '');

  const data = await shopifyFetch<{ product: ShopifyApiProduct }>(
    `/products/${numericId}.json`
  );

  // Fetch cost for each variant from inventory items
  const variantCosts = new Map<number, string | null>();
  for (const variant of data.product.variants) {
    if (variant.inventory_item_id) {
      const cost = await getInventoryItemCost(variant.inventory_item_id);
      variantCosts.set(variant.id, cost);
    }
  }

  return mapShopifyProduct(data.product, variantCosts);
}

/**
 * Update product in Shopify
 */
export async function updateShopifyProduct(
  productId: string,
  updates: {
    title?: string;
    bodyHtml?: string;
    tags?: string[];
  }
): Promise<ShopifyProduct> {
  const numericId = productId.replace('gid://shopify/Product/', '');

  const data = await shopifyFetch<{ product: ShopifyApiProduct }>(
    `/products/${numericId}.json`,
    {
      method: 'PUT',
      body: {
        product: {
          id: numericId,
          ...(updates.title && { title: updates.title }),
          ...(updates.bodyHtml && { body_html: updates.bodyHtml }),
          ...(updates.tags && { tags: updates.tags.join(', ') }),
        },
      },
    }
  );

  return mapShopifyProduct(data.product);
}

/**
 * Create or update metafield on a product
 */
export async function setProductMetafield(
  productId: string,
  metafield: {
    namespace: string;
    key: string;
    value: string;
    type: 'single_line_text_field' | 'multi_line_text_field' | 'json';
  }
): Promise<void> {
  const numericId = productId.replace('gid://shopify/Product/', '');

  await shopifyFetch(`/products/${numericId}/metafields.json`, {
    method: 'POST',
    body: {
      metafield: {
        namespace: metafield.namespace,
        key: metafield.key,
        value: metafield.value,
        type: metafield.type,
      },
    },
  });
}

/**
 * Get all metafields for a product
 */
export async function getProductMetafields(
  productId: string
): Promise<ShopifyMetafield[]> {
  const numericId = productId.replace('gid://shopify/Product/', '');

  const data = await shopifyFetch<{ metafields: ShopifyMetafield[] }>(
    `/products/${numericId}/metafields.json`
  );

  return data.metafields;
}

// =====================
// Helper Functions
// =====================

// Raw Shopify API product shape
interface ShopifyApiProduct {
  id: number;
  title: string;
  handle: string;
  status: 'active' | 'draft' | 'archived';
  product_type: string | null;
  tags: string;
  body_html: string | null;
  variants: ShopifyApiVariant[];
  images: ShopifyApiImage[];
  created_at: string;
  updated_at: string;
}

interface ShopifyApiVariant {
  id: number;
  sku: string | null;
  price: string;
  compare_at_price: string | null;
  inventory_quantity: number | null;
  inventory_item_id: number; // Used to fetch cost from InventoryItem
}

interface ShopifyApiInventoryItem {
  id: number;
  cost: string | null;
}

interface ShopifyApiImage {
  id: number;
  src: string;
  alt: string | null;
  width: number;
  height: number;
}

interface ShopifyMetafield {
  id: number;
  namespace: string;
  key: string;
  value: string;
  type: string;
}

/**
 * Map Shopify API product to our ShopifyProduct type
 */
function mapShopifyProduct(
  product: ShopifyApiProduct,
  variantCosts?: Map<number, string | null>
): ShopifyProduct {
  return {
    id: `gid://shopify/Product/${product.id}`,
    title: product.title,
    handle: product.handle,
    status: product.status,
    productType: product.product_type,
    tags: product.tags ? product.tags.split(', ').filter(Boolean) : [],
    bodyHtml: product.body_html,
    variants: product.variants.map((v) => ({
      id: `gid://shopify/ProductVariant/${v.id}`,
      sku: v.sku,
      price: v.price,
      compareAtPrice: v.compare_at_price,
      inventoryQuantity: v.inventory_quantity,
      cost: variantCosts?.get(v.id) ?? null,
    })),
    images: product.images.map((img) => ({
      id: `gid://shopify/ProductImage/${img.id}`,
      src: img.src,
      altText: img.alt,
      width: img.width,
      height: img.height,
    })),
    createdAt: product.created_at,
    updatedAt: product.updated_at,
  };
}

/**
 * Convert ShopifyProduct to ShopifyData for storage
 */
export function shopifyProductToData(
  product: ShopifyProduct,
  metafields?: ShopifyMetafield[]
): ShopifyData {
  const firstVariant = product.variants[0];

  return {
    price: firstVariant?.price || null,
    compareAtPrice: firstVariant?.compareAtPrice || null,
    inventoryQuantity: firstVariant?.inventoryQuantity ?? null,
    cost: firstVariant?.cost || null,
    productType: product.productType,
    shopifyTags: product.tags,
    bodyHtml: product.bodyHtml,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    metafields: metafields?.map(mf => ({
      namespace: mf.namespace,
      key: mf.key,
      value: mf.value,
      type: mf.type,
    })),
  };
}

/**
 * Mapped poster fields from Shopify metafields
 */
export interface MappedMetafields {
  artist?: string;
  estimatedDate?: string;
  dimensionsEstimate?: string;
  condition?: string;
  conditionDetails?: string;
  userNotes?: string;
  printingTechnique?: string;
}

/**
 * Map Shopify metafields to poster fields
 * Uses namespace.key format for mapping:
 * - jadepuma.artist → artist
 * - specs.year → estimatedDate
 * - specs.height + specs.width → dimensionsEstimate
 * - jadepuma.condition → condition
 * - jadepuma.condition_details → conditionDetails
 * - jadepuma.internal_notes → userNotes
 * - jadepuma.medium → printingTechnique
 */
export function mapMetafieldsToPosterFields(
  metafields: ShopifyMetafield[]
): MappedMetafields {
  const result: MappedMetafields = {};

  // Create a map for easier lookup
  const mfMap = new Map<string, string>();
  for (const mf of metafields) {
    const key = `${mf.namespace}.${mf.key}`;
    mfMap.set(key, mf.value);
  }

  // Map artist
  const artist = mfMap.get('jadepuma.artist');
  if (artist) result.artist = artist;

  // Map year to estimatedDate
  const year = mfMap.get('specs.year');
  if (year) result.estimatedDate = year;

  // Map dimensions (combine height and width)
  const height = mfMap.get('specs.height');
  const width = mfMap.get('specs.width');
  if (height || width) {
    const parts: string[] = [];
    if (height) parts.push(`${height}" H`);
    if (width) parts.push(`${width}" W`);
    result.dimensionsEstimate = parts.join(' x ');
  }

  // Map condition
  const condition = mfMap.get('jadepuma.condition');
  if (condition) result.condition = condition;

  // Map condition details
  const conditionDetails = mfMap.get('jadepuma.condition_details');
  if (conditionDetails) result.conditionDetails = conditionDetails;

  // Map internal notes to userNotes
  const internalNotes = mfMap.get('jadepuma.internal_notes');
  if (internalNotes) result.userNotes = internalNotes;

  // Map medium to printingTechnique
  const medium = mfMap.get('jadepuma.medium');
  if (medium) result.printingTechnique = medium;

  return result;
}

/**
 * Get already-imported Shopify product IDs from database
 */
export async function getImportedShopifyProductIds(): Promise<Set<string>> {
  const result = await sql`
    SELECT shopify_product_id FROM posters
    WHERE shopify_product_id IS NOT NULL
  `;

  return new Set(result.rows.map((row) => row.shopify_product_id));
}

// =====================
// OAuth Functions
// =====================

const SHOPIFY_SCOPES = 'read_products,read_inventory';

/**
 * Generate OAuth authorization URL
 */
export function getShopifyOAuthUrl(
  shopDomain: string,
  clientId: string,
  redirectUri: string,
  state: string
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    scope: SHOPIFY_SCOPES,
    redirect_uri: redirectUri,
    state: state,
  });

  return `https://${shopDomain}/admin/oauth/authorize?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(
  shopDomain: string,
  clientId: string,
  clientSecret: string,
  code: string
): Promise<{ accessToken: string; scope: string }> {
  const response = await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code: code,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OAuth token exchange failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    scope: data.scope,
  };
}
