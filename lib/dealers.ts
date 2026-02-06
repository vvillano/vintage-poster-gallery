import { sql } from '@vercel/postgres';
import type {
  Dealer,
  CreateDealerInput,
  UpdateDealerInput,
  DealerType,
  DealerCategory,
  DealerRegion,
  DealerSpecialization,
} from '@/types/dealer';
import { generateDealerSlug, DEALER_TYPE_TO_CATEGORY } from '@/types/dealer';

/**
 * Convert a database row to a Dealer object
 */
function dbRowToDealer(row: Record<string, unknown>): Dealer {
  const type = row.type as DealerType;
  return {
    id: row.id as number,
    name: row.name as string,
    slug: row.slug as string,
    type,
    // Use stored category or derive from type for backwards compatibility
    category: (row.category as DealerCategory) || DEALER_TYPE_TO_CATEGORY[type] || 'dealer',
    website: row.website as string | null,
    country: row.country as string | null,
    city: row.city as string | null,
    region: row.region as DealerRegion | null,
    email: row.email as string | null,
    phone: row.phone as string | null,
    reliabilityTier: row.reliability_tier as number,
    attributionWeight: parseFloat(row.attribution_weight as string) || 0.7,
    pricingWeight: parseFloat(row.pricing_weight as string) || 0.7,
    canResearch: row.can_research as boolean,
    canPrice: row.can_price as boolean,
    canProcure: row.can_procure as boolean,
    canBeSource: row.can_be_source as boolean,
    searchUrlTemplate: row.search_url_template as string | null,
    searchSoldUrlTemplate: row.search_sold_url_template as string | null,
    specializations: (row.specializations as DealerSpecialization[]) || [],
    linkedSellerId: row.linked_seller_id as number | null,
    notes: row.notes as string | null,
    isActive: row.is_active as boolean,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

/**
 * Create a new dealer
 */
export async function createDealer(input: CreateDealerInput): Promise<Dealer> {
  const slug = generateDealerSlug(input.name);

  // Default category based on type if not provided
  const category = input.category || DEALER_TYPE_TO_CATEGORY[input.type] || 'dealer';

  const result = await sql`
    INSERT INTO dealers (
      name,
      slug,
      type,
      category,
      website,
      country,
      city,
      region,
      email,
      phone,
      reliability_tier,
      attribution_weight,
      pricing_weight,
      can_research,
      can_price,
      can_procure,
      can_be_source,
      search_url_template,
      search_sold_url_template,
      specializations,
      linked_seller_id,
      notes,
      is_active
    )
    VALUES (
      ${input.name},
      ${slug},
      ${input.type},
      ${category},
      ${input.website || null},
      ${input.country || null},
      ${input.city || null},
      ${input.region || null},
      ${input.email || null},
      ${input.phone || null},
      ${input.reliabilityTier ?? 3},
      ${input.attributionWeight ?? 0.7},
      ${input.pricingWeight ?? 0.7},
      ${input.canResearch ?? true},
      ${input.canPrice ?? true},
      ${input.canProcure ?? false},
      ${input.canBeSource ?? true},
      ${input.searchUrlTemplate || null},
      ${input.searchSoldUrlTemplate || null},
      ${JSON.stringify(input.specializations || [])},
      ${input.linkedSellerId || null},
      ${input.notes || null},
      ${input.isActive ?? true}
    )
    RETURNING *
  `;

  return dbRowToDealer(result.rows[0]);
}

/**
 * Get a dealer by ID
 */
export async function getDealerById(id: number): Promise<Dealer | null> {
  const result = await sql`
    SELECT * FROM dealers WHERE id = ${id}
  `;

  if (result.rows.length === 0) {
    return null;
  }

  return dbRowToDealer(result.rows[0]);
}

/**
 * Get a dealer by slug
 */
export async function getDealerBySlug(slug: string): Promise<Dealer | null> {
  const result = await sql`
    SELECT * FROM dealers WHERE slug = ${slug}
  `;

  if (result.rows.length === 0) {
    return null;
  }

  return dbRowToDealer(result.rows[0]);
}

/**
 * Get all dealers with optional filters
 */
export async function getAllDealers(options?: {
  type?: DealerType;
  category?: DealerCategory;
  categories?: DealerCategory[];  // Include only these categories
  excludeCategories?: DealerCategory[];  // Exclude these categories
  region?: DealerRegion;
  specialization?: DealerSpecialization;
  canResearch?: boolean;
  canPrice?: boolean;
  canProcure?: boolean;
  canBeSource?: boolean;
  isActive?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<Dealer[]> {
  const {
    type,
    category,
    categories,
    excludeCategories,
    region,
    specialization,
    canResearch,
    canPrice,
    canProcure,
    canBeSource,
    isActive,
    search,
    limit = 100,
    offset = 0,
  } = options || {};

  // Build dynamic query based on filters
  // Using simple query for now, can optimize later
  let result;

  if (type) {
    result = await sql`
      SELECT * FROM dealers
      WHERE type = ${type}
      AND (${isActive === undefined} OR is_active = ${isActive ?? true})
      ORDER BY reliability_tier ASC, name ASC
      LIMIT ${limit} OFFSET ${offset}
    `;
  } else if (region) {
    result = await sql`
      SELECT * FROM dealers
      WHERE region = ${region}
      AND (${isActive === undefined} OR is_active = ${isActive ?? true})
      ORDER BY reliability_tier ASC, name ASC
      LIMIT ${limit} OFFSET ${offset}
    `;
  } else if (search) {
    const searchPattern = `%${search}%`;
    result = await sql`
      SELECT * FROM dealers
      WHERE (name ILIKE ${searchPattern} OR notes ILIKE ${searchPattern})
      AND (${isActive === undefined} OR is_active = ${isActive ?? true})
      ORDER BY reliability_tier ASC, name ASC
      LIMIT ${limit} OFFSET ${offset}
    `;
  } else {
    result = await sql`
      SELECT * FROM dealers
      WHERE (${isActive === undefined} OR is_active = ${isActive ?? true})
      ORDER BY reliability_tier ASC, name ASC
      LIMIT ${limit} OFFSET ${offset}
    `;
  }

  let dealers = result.rows.map(dbRowToDealer);

  // Apply additional client-side filters for complex conditions
  if (category) {
    dealers = dealers.filter(d => d.category === category);
  }
  if (categories && categories.length > 0) {
    dealers = dealers.filter(d => categories.includes(d.category));
  }
  if (excludeCategories && excludeCategories.length > 0) {
    dealers = dealers.filter(d => !excludeCategories.includes(d.category));
  }
  if (specialization) {
    dealers = dealers.filter(d => d.specializations.includes(specialization));
  }
  if (canResearch !== undefined) {
    dealers = dealers.filter(d => d.canResearch === canResearch);
  }
  if (canPrice !== undefined) {
    dealers = dealers.filter(d => d.canPrice === canPrice);
  }
  if (canProcure !== undefined) {
    dealers = dealers.filter(d => d.canProcure === canProcure);
  }
  if (canBeSource !== undefined) {
    dealers = dealers.filter(d => d.canBeSource === canBeSource);
  }

  return dealers;
}

/**
 * Get dealer count
 */
export async function getDealerCount(isActive?: boolean): Promise<number> {
  let result;

  if (isActive !== undefined) {
    result = await sql`
      SELECT COUNT(*) as count FROM dealers WHERE is_active = ${isActive}
    `;
  } else {
    result = await sql`
      SELECT COUNT(*) as count FROM dealers
    `;
  }

  return parseInt(result.rows[0].count as string) || 0;
}

/**
 * Update a dealer
 */
export async function updateDealer(input: UpdateDealerInput): Promise<Dealer> {
  const { id, ...updates } = input;

  // Get current dealer to merge with updates
  const current = await getDealerById(id);
  if (!current) {
    throw new Error(`Dealer with ID ${id} not found`);
  }

  // Generate new slug if name changed
  const slug = updates.name ? generateDealerSlug(updates.name) : current.slug;

  // If type changes and category not explicitly set, update category to match new type
  const newType = updates.type ?? current.type;
  const newCategory = updates.category !== undefined
    ? updates.category
    : (updates.type ? DEALER_TYPE_TO_CATEGORY[updates.type] : current.category);

  const result = await sql`
    UPDATE dealers
    SET
      name = ${updates.name ?? current.name},
      slug = ${slug},
      type = ${newType},
      category = ${newCategory},
      website = ${updates.website !== undefined ? updates.website : current.website},
      country = ${updates.country !== undefined ? updates.country : current.country},
      city = ${updates.city !== undefined ? updates.city : current.city},
      region = ${updates.region !== undefined ? updates.region : current.region},
      email = ${updates.email !== undefined ? updates.email : current.email},
      phone = ${updates.phone !== undefined ? updates.phone : current.phone},
      reliability_tier = ${updates.reliabilityTier ?? current.reliabilityTier},
      attribution_weight = ${updates.attributionWeight ?? current.attributionWeight},
      pricing_weight = ${updates.pricingWeight ?? current.pricingWeight},
      can_research = ${updates.canResearch ?? current.canResearch},
      can_price = ${updates.canPrice ?? current.canPrice},
      can_procure = ${updates.canProcure ?? current.canProcure},
      can_be_source = ${updates.canBeSource ?? current.canBeSource},
      search_url_template = ${updates.searchUrlTemplate !== undefined ? updates.searchUrlTemplate : current.searchUrlTemplate},
      search_sold_url_template = ${updates.searchSoldUrlTemplate !== undefined ? updates.searchSoldUrlTemplate : current.searchSoldUrlTemplate},
      specializations = ${JSON.stringify(updates.specializations ?? current.specializations)},
      linked_seller_id = ${updates.linkedSellerId !== undefined ? updates.linkedSellerId : current.linkedSellerId},
      notes = ${updates.notes !== undefined ? updates.notes : current.notes},
      is_active = ${updates.isActive ?? current.isActive},
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;

  return dbRowToDealer(result.rows[0]);
}

/**
 * Delete a dealer
 */
export async function deleteDealer(id: number): Promise<boolean> {
  const result = await sql`
    DELETE FROM dealers WHERE id = ${id}
    RETURNING id
  `;

  return result.rows.length > 0;
}

/**
 * Check if a dealer with the given name exists
 */
export async function dealerExistsByName(name: string): Promise<boolean> {
  const slug = generateDealerSlug(name);
  const result = await sql`
    SELECT id FROM dealers WHERE slug = ${slug}
  `;
  return result.rows.length > 0;
}

/**
 * Extract the root/registrable domain from a hostname
 * e.g., "auctions.potterauctions.com" -> "potterauctions.com"
 *       "www.ha.com" -> "ha.com"
 *       "comics.ha.com" -> "ha.com"
 */
function extractRootDomain(hostname: string): string {
  // Remove common prefixes
  let domain = hostname.replace(/^www\./, '');

  // Split into parts
  const parts = domain.split('.');

  // Handle common compound TLDs - keep last 3 parts for compound TLDs
  const compoundTLDs = ['co.uk', 'com.au', 'co.nz', 'co.jp', 'com.br', 'co.za'];
  const lastTwo = parts.slice(-2).join('.');

  if (compoundTLDs.includes(lastTwo) && parts.length > 2) {
    // e.g., "auctions.example.co.uk" -> "example.co.uk"
    return parts.slice(-3).join('.');
  } else if (parts.length > 2) {
    // e.g., "auctions.potterauctions.com" -> "potterauctions.com"
    return parts.slice(-2).join('.');
  }

  return domain;
}

/**
 * Find existing dealer by name or website domain
 * Returns the dealer info if found, null otherwise
 */
export async function findExistingDealer(name: string, website?: string | null): Promise<{ id: number; name: string; matchedBy: 'name' | 'website' } | null> {
  const slug = generateDealerSlug(name);

  // Check by name/slug first
  const byName = await sql`
    SELECT id, name FROM dealers WHERE slug = ${slug}
  `;
  if (byName.rows.length > 0) {
    return { id: byName.rows[0].id as number, name: byName.rows[0].name as string, matchedBy: 'name' };
  }

  // Check by website domain if provided
  if (website) {
    // Extract root domain from website URL (handles subdomains)
    let rootDomain: string;
    try {
      const url = new URL(website.startsWith('http') ? website : `https://${website}`);
      rootDomain = extractRootDomain(url.hostname);
    } catch {
      const cleanedUrl = website.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
      rootDomain = extractRootDomain(cleanedUrl);
    }

    // Search for any dealer whose website contains this root domain
    // This catches both potterauctions.com and auctions.potterauctions.com
    const byWebsite = await sql`
      SELECT id, name FROM dealers
      WHERE website ILIKE ${`%${rootDomain}%`}
    `;
    if (byWebsite.rows.length > 0) {
      return { id: byWebsite.rows[0].id as number, name: byWebsite.rows[0].name as string, matchedBy: 'website' };
    }
  }

  return null;
}

/**
 * Seed multiple dealers (for initial setup)
 */
export async function seedDealers(dealers: CreateDealerInput[]): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;

  for (const dealer of dealers) {
    try {
      const exists = await dealerExistsByName(dealer.name);
      if (exists) {
        skipped++;
        continue;
      }
      await createDealer(dealer);
      created++;
    } catch (error) {
      console.error(`Error creating dealer ${dealer.name}:`, error);
      skipped++;
    }
  }

  return { created, skipped };
}

/**
 * Get dealers that can be used as acquisition sources
 */
export async function getAcquisitionSources(): Promise<Dealer[]> {
  return getAllDealers({ canBeSource: true, isActive: true });
}

/**
 * Get dealers suitable for research (high reliability)
 */
export async function getResearchDealers(): Promise<Dealer[]> {
  const dealers = await getAllDealers({ canResearch: true, isActive: true });
  // Return only tiers 1-3 for research
  return dealers.filter(d => d.reliabilityTier <= 3);
}

/**
 * Get dealers by specialization
 */
export async function getDealersBySpecialization(specialization: DealerSpecialization): Promise<Dealer[]> {
  return getAllDealers({ specialization, isActive: true });
}

/**
 * Get dealers by category
 */
export async function getDealersByCategory(category: DealerCategory): Promise<Dealer[]> {
  return getAllDealers({ category, isActive: true });
}

/**
 * Get dealers for valuation (excludes research institutions)
 */
export async function getValuationDealers(): Promise<Dealer[]> {
  return getAllDealers({
    excludeCategories: ['research'],
    canPrice: true,
    isActive: true,
  });
}
