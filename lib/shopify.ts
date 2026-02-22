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
      ${config.shopDomain.trim()},
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
      ${config.shopDomain.trim()},
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

  const url = `https://${config.shopDomain.trim()}/admin/api/${config.apiVersion}${endpoint}`;

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
    title: product.title,
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
  userNotes?: string;           // Business/internal notes (jadepuma.internal_notes) - NOT passed to AI
  itemNotes?: string;           // Research-relevant notes (jadepuma.item_notes) - passed to AI
  printingTechnique?: string;
  colors?: string[];            // Array of color names
  countryOfOrigin?: string;     // Country of origin (jadepuma.country_of_origin)
  referenceImageUrls?: string[]; // Reference image URLs from Shopify (jadepuma.reference_images)
  dealerName?: string;          // WHO you bought from (jadepuma.dealer) - for acquisition tracking
  sourcePlatform?: string;      // WHERE you bought (jadepuma.source_platform) - for acquisition tracking
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

  // Map color to colors array
  // Shopify may store as comma-separated string OR JSON array string
  const color = mfMap.get('jadepuma.color');
  if (color) {
    // Try to parse as JSON array first (e.g., '["Red", "Brown"]')
    if (color.trim().startsWith('[')) {
      try {
        const parsed = JSON.parse(color);
        if (Array.isArray(parsed)) {
          result.colors = parsed.map(c => String(c).trim()).filter(c => c.length > 0);
        }
      } catch {
        // Not valid JSON, fall through to comma-separated parsing
        result.colors = color.split(',').map(c => c.trim()).filter(c => c.length > 0);
      }
    } else {
      // Simple comma-separated format (e.g., 'Red, Brown')
      result.colors = color.split(',').map(c => c.trim()).filter(c => c.length > 0);
    }
  }

  // Map country_of_origin
  const countryOfOrigin = mfMap.get('jadepuma.country_of_origin');
  if (countryOfOrigin) result.countryOfOrigin = countryOfOrigin;

  // Map item_notes (research-relevant notes) - passed to AI analysis
  // This is separate from internal_notes which is for business/transaction notes
  const itemNotes = mfMap.get('jadepuma.item_notes');
  if (itemNotes) result.itemNotes = itemNotes;

  // Map reference_images (URLs for context images)
  // May be stored as JSON array or comma-separated string
  const referenceImages = mfMap.get('jadepuma.reference_images');
  if (referenceImages) {
    // Try to parse as JSON array first (e.g., '["url1", "url2"]')
    if (referenceImages.trim().startsWith('[')) {
      try {
        const parsed = JSON.parse(referenceImages);
        if (Array.isArray(parsed)) {
          result.referenceImageUrls = parsed
            .map(url => String(url).trim())
            .filter(url => url.length > 0 && (url.startsWith('http://') || url.startsWith('https://')));
        }
      } catch {
        // Not valid JSON, fall through to comma-separated parsing
        result.referenceImageUrls = referenceImages
          .split(',')
          .map(url => url.trim())
          .filter(url => url.length > 0 && (url.startsWith('http://') || url.startsWith('https://')));
      }
    } else {
      // Simple comma-separated format
      result.referenceImageUrls = referenceImages
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0 && (url.startsWith('http://') || url.startsWith('https://')));
    }
  }

  // Map dealer (WHO you bought from) - for acquisition tracking
  const dealer = mfMap.get('jadepuma.dealer');
  if (dealer) result.dealerName = dealer;

  // Map source_platform (WHERE you bought) - for acquisition tracking
  const sourcePlatform = mfMap.get('jadepuma.source_platform');
  if (sourcePlatform) result.sourcePlatform = sourcePlatform;

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

const SHOPIFY_SCOPES = 'read_products,write_products,read_inventory,write_inventory,read_metaobjects,write_metaobjects';

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

  return `https://${shopDomain.trim()}/admin/oauth/authorize?${params.toString()}`;
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
  const response = await fetch(`https://${shopDomain.trim()}/admin/oauth/access_token`, {
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

// =====================
// SKU Search Functions
// =====================

/**
 * Search Shopify products by SKU using GraphQL (more efficient than REST)
 * Returns the product if found, null otherwise
 */
export async function searchShopifyBySku(
  sku: string
): Promise<ShopifyProduct | null> {
  const config = await getShopifyConfig();

  if (!config) {
    throw new Error('Shopify not configured');
  }

  // GraphQL query to find product variant by SKU
  const query = `
    query getProductBySku($sku: String!) {
      productVariants(first: 1, query: $sku) {
        edges {
          node {
            id
            sku
            product {
              id
              title
              handle
              status
              productType
              tags
              descriptionHtml
              createdAt
              updatedAt
              images(first: 10) {
                edges {
                  node {
                    id
                    url
                    altText
                    width
                    height
                  }
                }
              }
              variants(first: 10) {
                edges {
                  node {
                    id
                    sku
                    price
                    compareAtPrice
                    inventoryQuantity
                    inventoryItem {
                      unitCost {
                        amount
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  const url = `https://${config.shopDomain.trim()}/admin/api/${config.apiVersion}/graphql.json`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': config.accessToken,
    },
    body: JSON.stringify({
      query,
      variables: { sku: `sku:${sku}` },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Shopify GraphQL error: ${response.status} ${errorText}`);
  }

  const result = await response.json();

  if (result.errors) {
    throw new Error(`Shopify GraphQL error: ${JSON.stringify(result.errors)}`);
  }

  const edges = result.data?.productVariants?.edges;
  if (!edges || edges.length === 0) {
    return null;
  }

  // Find the variant that exactly matches the SKU (GraphQL query is case-insensitive)
  const matchingEdge = edges.find(
    (edge: any) => edge.node.sku?.toLowerCase() === sku.toLowerCase()
  );

  if (!matchingEdge) {
    return null;
  }

  const product = matchingEdge.node.product;

  // Map GraphQL response to ShopifyProduct format
  return mapGraphQLProductToShopifyProduct(product);
}

/**
 * Map GraphQL product response to ShopifyProduct type
 */
function mapGraphQLProductToShopifyProduct(product: any): ShopifyProduct {
  return {
    id: product.id, // Already in gid format
    title: product.title,
    handle: product.handle,
    status: product.status.toLowerCase() as 'active' | 'draft' | 'archived',
    productType: product.productType,
    tags: product.tags || [],
    bodyHtml: product.descriptionHtml,
    variants: product.variants.edges.map((edge: any) => ({
      id: edge.node.id,
      sku: edge.node.sku,
      price: edge.node.price,
      compareAtPrice: edge.node.compareAtPrice,
      inventoryQuantity: edge.node.inventoryQuantity,
      cost: edge.node.inventoryItem?.unitCost?.amount || null,
    })),
    images: product.images.edges.map((edge: any) => ({
      id: edge.node.id,
      src: edge.node.url,
      altText: edge.node.altText,
      width: edge.node.width,
      height: edge.node.height,
    })),
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

// =====================
// Image Download Functions
// =====================

import { put } from '@vercel/blob';

/**
 * Download an image from a URL and upload to Vercel Blob
 * Used for re-hosting Shopify reference images
 * @param imageUrl - The URL to download from
 * @param prefix - Prefix for the filename (default: 'shopify-ref')
 * @returns Object with url, blobId, fileName or null if failed
 */
export async function downloadAndHostImage(
  imageUrl: string,
  prefix: string = 'shopify-ref'
): Promise<{ url: string; blobId: string; fileName: string } | null> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.warn(`Failed to download image from ${imageUrl}: ${response.status}`);
      return null;
    }

    const blob = await response.blob();

    // Extract extension from URL or content-type
    let extension = 'jpg';
    try {
      const urlPath = new URL(imageUrl).pathname;
      const urlExt = urlPath.split('.').pop()?.toLowerCase();
      if (urlExt && ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(urlExt)) {
        extension = urlExt === 'jpeg' ? 'jpg' : urlExt;
      }
    } catch {
      // If URL parsing fails, try content-type
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('png')) extension = 'png';
      else if (contentType?.includes('gif')) extension = 'gif';
      else if (contentType?.includes('webp')) extension = 'webp';
    }

    const fileName = `${prefix}-${Date.now()}.${extension}`;

    const result = await put(fileName, blob, {
      access: 'public',
      contentType: blob.type || `image/${extension}`,
    });

    return {
      url: result.url,
      blobId: result.url,
      fileName,
    };
  } catch (error) {
    console.error(`Failed to download and host image from ${imageUrl}:`, error);
    return null;
  }
}
