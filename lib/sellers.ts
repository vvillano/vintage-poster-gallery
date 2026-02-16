import { sql } from '@vercel/postgres';
import type {
  Seller,
  CreateSellerInput,
  UpdateSellerInput,
  SellerType,
  SellerRegion,
  SellerSpecialization,
} from '@/types/seller';
import { generateSellerSlug } from '@/types/seller';

/**
 * Convert a database row to a Seller object
 */
function dbRowToSeller(row: Record<string, unknown>): Seller {
  const type = row.type as SellerType;
  const seller: Seller = {
    id: row.id as number,
    name: row.name as string,
    slug: row.slug as string,
    type,
    website: row.website as string | null,
    platformId: row.platform_id as number | null,
    linkedSellerId: row.linked_seller_id as number | null,
    country: row.country as string | null,
    city: row.city as string | null,
    region: row.region as SellerRegion | null,
    email: row.email as string | null,
    phone: row.phone as string | null,
    reliabilityTier: row.reliability_tier as number,
    attributionWeight: parseFloat(row.attribution_weight as string) || 0.7,
    pricingWeight: parseFloat(row.pricing_weight as string) || 0.7,
    canResearchAt: row.can_research_at as boolean,
    // Legacy capability flags for backward compatibility
    canResearch: row.can_research as boolean | undefined,
    canPrice: row.can_price as boolean | undefined,
    canProcure: row.can_procure as boolean | undefined,
    canBeSource: row.can_be_source as boolean | undefined,
    excludeFromResults: row.exclude_from_results as boolean | undefined,
    searchUrlTemplate: row.search_url_template as string | null,
    searchSoldUrlTemplate: row.search_sold_url_template as string | null,
    specializations: (row.specializations as SellerSpecialization[]) || [],
    username: row.username as string | null,
    password: row.password as string | null,
    notes: row.notes as string | null,
    isActive: row.is_active as boolean,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
    shopifyMetaobjectId: row.shopify_metaobject_id as string | null,
  };

  // Add joined platform data if present (from JOIN queries)
  if (row.platform_name !== undefined) {
    seller.platform = row.platform_name ? {
      id: row.platform_id as number,
      name: row.platform_name as string,
      platformType: row.platform_type as string | undefined,
    } : null;
  }

  // Add joined linked seller data if present
  if (row.linked_seller_name !== undefined) {
    seller.linkedSeller = row.linked_seller_name ? {
      id: row.linked_seller_id as number,
      name: row.linked_seller_name as string,
      type: row.linked_seller_type as SellerType,
    } : null;
  }

  return seller;
}

/**
 * Create a new seller
 */
export async function createSeller(input: CreateSellerInput): Promise<Seller> {
  const slug = generateSellerSlug(input.name);

  const result = await sql`
    INSERT INTO sellers (
      name,
      slug,
      type,
      website,
      platform_id,
      linked_seller_id,
      country,
      city,
      region,
      email,
      phone,
      reliability_tier,
      attribution_weight,
      pricing_weight,
      can_research_at,
      search_url_template,
      search_sold_url_template,
      specializations,
      username,
      password,
      notes,
      is_active,
      shopify_metaobject_id
    )
    VALUES (
      ${input.name},
      ${slug},
      ${input.type},
      ${input.website || null},
      ${input.platformId || null},
      ${input.linkedSellerId || null},
      ${input.country || null},
      ${input.city || null},
      ${input.region || null},
      ${input.email || null},
      ${input.phone || null},
      ${input.reliabilityTier ?? 3},
      ${input.attributionWeight ?? 0.7},
      ${input.pricingWeight ?? 0.7},
      ${input.canResearchAt ?? false},
      ${input.searchUrlTemplate || null},
      ${input.searchSoldUrlTemplate || null},
      ${JSON.stringify(input.specializations || [])},
      ${input.username || null},
      ${input.password || null},
      ${input.notes || null},
      ${input.isActive ?? true},
      ${input.shopifyMetaobjectId || null}
    )
    RETURNING *
  `;

  return dbRowToSeller(result.rows[0]);
}

/**
 * Get a seller by ID
 */
export async function getSellerById(id: number): Promise<Seller | null> {
  const result = await sql`
    SELECT * FROM sellers WHERE id = ${id}
  `;

  if (result.rows.length === 0) {
    return null;
  }

  return dbRowToSeller(result.rows[0]);
}

/**
 * Get a seller by slug
 */
export async function getSellerBySlug(slug: string): Promise<Seller | null> {
  const result = await sql`
    SELECT * FROM sellers WHERE slug = ${slug}
  `;

  if (result.rows.length === 0) {
    return null;
  }

  return dbRowToSeller(result.rows[0]);
}

/**
 * Get all sellers with optional filters
 */
export async function getAllSellers(options?: {
  type?: SellerType;
  region?: SellerRegion;
  specialization?: SellerSpecialization;
  canResearchAt?: boolean;
  isActive?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<Seller[]> {
  const {
    type,
    region,
    specialization,
    canResearchAt,
    isActive,
    search,
    limit = 100,
    offset = 0,
  } = options || {};

  let result;

  if (type) {
    result = await sql`
      SELECT * FROM sellers
      WHERE type = ${type}
      AND (${isActive === undefined} OR is_active = ${isActive ?? true})
      ORDER BY reliability_tier ASC, name ASC
      LIMIT ${limit} OFFSET ${offset}
    `;
  } else if (region) {
    result = await sql`
      SELECT * FROM sellers
      WHERE region = ${region}
      AND (${isActive === undefined} OR is_active = ${isActive ?? true})
      ORDER BY reliability_tier ASC, name ASC
      LIMIT ${limit} OFFSET ${offset}
    `;
  } else if (search) {
    const searchPattern = `%${search}%`;
    result = await sql`
      SELECT * FROM sellers
      WHERE (name ILIKE ${searchPattern} OR notes ILIKE ${searchPattern})
      AND (${isActive === undefined} OR is_active = ${isActive ?? true})
      ORDER BY reliability_tier ASC, name ASC
      LIMIT ${limit} OFFSET ${offset}
    `;
  } else {
    result = await sql`
      SELECT * FROM sellers
      WHERE (${isActive === undefined} OR is_active = ${isActive ?? true})
      ORDER BY reliability_tier ASC, name ASC
      LIMIT ${limit} OFFSET ${offset}
    `;
  }

  let sellers = result.rows.map(dbRowToSeller);

  // Apply additional client-side filters for complex conditions
  if (specialization) {
    sellers = sellers.filter(s => s.specializations.includes(specialization));
  }
  if (canResearchAt !== undefined) {
    sellers = sellers.filter(s => s.canResearchAt === canResearchAt);
  }

  return sellers;
}

/**
 * Get seller count
 */
export async function getSellerCount(isActive?: boolean): Promise<number> {
  let result;

  if (isActive !== undefined) {
    result = await sql`
      SELECT COUNT(*) as count FROM sellers WHERE is_active = ${isActive}
    `;
  } else {
    result = await sql`
      SELECT COUNT(*) as count FROM sellers
    `;
  }

  return parseInt(result.rows[0].count as string) || 0;
}

/**
 * Update a seller
 */
export async function updateSeller(input: UpdateSellerInput): Promise<Seller> {
  const { id, ...updates } = input;

  // Get current seller to merge with updates
  const current = await getSellerById(id);
  if (!current) {
    throw new Error(`Seller with ID ${id} not found`);
  }

  // Generate new slug if name changed
  const slug = updates.name ? generateSellerSlug(updates.name) : current.slug;

  const result = await sql`
    UPDATE sellers
    SET
      name = ${updates.name ?? current.name},
      slug = ${slug},
      type = ${updates.type ?? current.type},
      website = ${updates.website !== undefined ? updates.website : current.website},
      platform_id = ${updates.platformId !== undefined ? updates.platformId : current.platformId},
      linked_seller_id = ${updates.linkedSellerId !== undefined ? updates.linkedSellerId : current.linkedSellerId},
      country = ${updates.country !== undefined ? updates.country : current.country},
      city = ${updates.city !== undefined ? updates.city : current.city},
      region = ${updates.region !== undefined ? updates.region : current.region},
      email = ${updates.email !== undefined ? updates.email : current.email},
      phone = ${updates.phone !== undefined ? updates.phone : current.phone},
      reliability_tier = ${updates.reliabilityTier ?? current.reliabilityTier},
      attribution_weight = ${updates.attributionWeight ?? current.attributionWeight},
      pricing_weight = ${updates.pricingWeight ?? current.pricingWeight},
      can_research_at = ${updates.canResearchAt ?? current.canResearchAt},
      search_url_template = ${updates.searchUrlTemplate !== undefined ? updates.searchUrlTemplate : current.searchUrlTemplate},
      search_sold_url_template = ${updates.searchSoldUrlTemplate !== undefined ? updates.searchSoldUrlTemplate : current.searchSoldUrlTemplate},
      specializations = ${JSON.stringify(updates.specializations ?? current.specializations)},
      username = ${updates.username !== undefined ? updates.username : current.username},
      password = ${updates.password !== undefined ? updates.password : current.password},
      notes = ${updates.notes !== undefined ? updates.notes : current.notes},
      is_active = ${updates.isActive ?? current.isActive},
      shopify_metaobject_id = ${updates.shopifyMetaobjectId !== undefined ? updates.shopifyMetaobjectId : current.shopifyMetaobjectId},
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;

  return dbRowToSeller(result.rows[0]);
}

/**
 * Delete a seller
 */
export async function deleteSeller(id: number): Promise<boolean> {
  const result = await sql`
    DELETE FROM sellers WHERE id = ${id}
    RETURNING id
  `;

  return result.rows.length > 0;
}

/**
 * Check if a seller with the given name exists
 */
export async function sellerExistsByName(name: string): Promise<boolean> {
  const slug = generateSellerSlug(name);
  const result = await sql`
    SELECT id FROM sellers WHERE slug = ${slug}
  `;
  return result.rows.length > 0;
}

/**
 * Extract the root/registrable domain from a hostname
 */
function extractRootDomain(hostname: string): string {
  let domain = hostname.replace(/^www\./, '');
  const parts = domain.split('.');
  const compoundTLDs = ['co.uk', 'com.au', 'co.nz', 'co.jp', 'com.br', 'co.za'];
  const lastTwo = parts.slice(-2).join('.');

  if (compoundTLDs.includes(lastTwo) && parts.length > 2) {
    return parts.slice(-3).join('.');
  } else if (parts.length > 2) {
    return parts.slice(-2).join('.');
  }

  return domain;
}

/**
 * Find existing seller by name or website domain
 */
export async function findExistingSeller(name: string, website?: string | null): Promise<{ id: number; name: string; matchedBy: 'name' | 'website' } | null> {
  const slug = generateSellerSlug(name);

  // Check by name/slug first
  const byName = await sql`
    SELECT id, name FROM sellers WHERE slug = ${slug}
  `;
  if (byName.rows.length > 0) {
    return { id: byName.rows[0].id as number, name: byName.rows[0].name as string, matchedBy: 'name' };
  }

  // Check by website domain if provided
  if (website) {
    let rootDomain: string;
    try {
      const url = new URL(website.startsWith('http') ? website : `https://${website}`);
      rootDomain = extractRootDomain(url.hostname);
    } catch {
      const cleanedUrl = website.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
      rootDomain = extractRootDomain(cleanedUrl);
    }

    const byWebsite = await sql`
      SELECT id, name FROM sellers
      WHERE website ILIKE ${`%${rootDomain}%`}
    `;
    if (byWebsite.rows.length > 0) {
      return { id: byWebsite.rows[0].id as number, name: byWebsite.rows[0].name as string, matchedBy: 'website' };
    }
  }

  return null;
}

/**
 * Seed multiple sellers (for initial setup)
 */
export async function seedSellers(sellers: CreateSellerInput[]): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;

  for (const seller of sellers) {
    try {
      const exists = await sellerExistsByName(seller.name);
      if (exists) {
        skipped++;
        continue;
      }
      await createSeller(seller);
      created++;
    } catch (error) {
      console.error(`Error creating seller ${seller.name}:`, error);
      skipped++;
    }
  }

  return { created, skipped };
}

/**
 * Get sellers that have searchable archives (for research)
 */
export async function getResearchSellers(): Promise<Seller[]> {
  return getAllSellers({ canResearchAt: true, isActive: true });
}

/**
 * Get sellers by specialization
 */
export async function getSellersBySpecialization(specialization: SellerSpecialization): Promise<Seller[]> {
  return getAllSellers({ specialization, isActive: true });
}

/**
 * Get sellers by type
 */
export async function getSellersByType(type: SellerType): Promise<Seller[]> {
  return getAllSellers({ type, isActive: true });
}

/**
 * Get high-reliability sellers (tiers 1-2)
 */
export async function getHighReliabilitySellers(): Promise<Seller[]> {
  const sellers = await getAllSellers({ isActive: true });
  return sellers.filter(s => s.reliabilityTier <= 2);
}

/**
 * Get auction houses
 */
export async function getAuctionHouses(): Promise<Seller[]> {
  return getAllSellers({ type: 'auction_house', isActive: true });
}

/**
 * Get all sellers with platform and linked seller data joined
 * Used for display in the UI where we need platform context
 */
export async function getSellersWithPlatforms(options?: {
  type?: SellerType;
  isActive?: boolean;
  platformId?: number;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<Seller[]> {
  const {
    type,
    isActive,
    platformId,
    search,
    limit = 100,
    offset = 0,
  } = options || {};

  let result;

  if (search) {
    const searchPattern = `%${search}%`;
    result = await sql`
      SELECT
        s.*,
        p.name as platform_name,
        p.platform_type as platform_type,
        ls.name as linked_seller_name,
        ls.type as linked_seller_type
      FROM sellers s
      LEFT JOIN platforms p ON s.platform_id = p.id
      LEFT JOIN sellers ls ON s.linked_seller_id = ls.id
      WHERE (s.name ILIKE ${searchPattern} OR s.notes ILIKE ${searchPattern})
      AND (${isActive === undefined} OR s.is_active = ${isActive ?? true})
      AND (${type === undefined} OR s.type = ${type})
      AND (${platformId === undefined} OR s.platform_id = ${platformId})
      ORDER BY s.reliability_tier ASC, s.name ASC
      LIMIT ${limit} OFFSET ${offset}
    `;
  } else {
    result = await sql`
      SELECT
        s.*,
        p.name as platform_name,
        p.platform_type as platform_type,
        ls.name as linked_seller_name,
        ls.type as linked_seller_type
      FROM sellers s
      LEFT JOIN platforms p ON s.platform_id = p.id
      LEFT JOIN sellers ls ON s.linked_seller_id = ls.id
      WHERE (${isActive === undefined} OR s.is_active = ${isActive ?? true})
      AND (${type === undefined} OR s.type = ${type})
      AND (${platformId === undefined} OR s.platform_id = ${platformId})
      ORDER BY s.reliability_tier ASC, s.name ASC
      LIMIT ${limit} OFFSET ${offset}
    `;
  }

  return result.rows.map(dbRowToSeller);
}

/**
 * Get a single seller with platform data joined
 */
export async function getSellerByIdWithPlatform(id: number): Promise<Seller | null> {
  const result = await sql`
    SELECT
      s.*,
      p.name as platform_name,
      p.platform_type as platform_type,
      ls.name as linked_seller_name,
      ls.type as linked_seller_type
    FROM sellers s
    LEFT JOIN platforms p ON s.platform_id = p.id
    LEFT JOIN sellers ls ON s.linked_seller_id = ls.id
    WHERE s.id = ${id}
  `;

  if (result.rows.length === 0) {
    return null;
  }

  return dbRowToSeller(result.rows[0]);
}

/**
 * Get sellers that are platform users (type='individual' with platform_id)
 * These are sellers identified by their username on a specific platform
 */
export async function getPlatformUsers(platformId?: number): Promise<Seller[]> {
  const result = await sql`
    SELECT
      s.*,
      p.name as platform_name,
      p.platform_type as platform_type,
      ls.name as linked_seller_name,
      ls.type as linked_seller_type
    FROM sellers s
    LEFT JOIN platforms p ON s.platform_id = p.id
    LEFT JOIN sellers ls ON s.linked_seller_id = ls.id
    WHERE s.type = 'individual'
    AND s.platform_id IS NOT NULL
    AND (${platformId === undefined} OR s.platform_id = ${platformId})
    AND s.is_active = true
    ORDER BY p.name ASC, s.name ASC
  `;

  return result.rows.map(dbRowToSeller);
}
