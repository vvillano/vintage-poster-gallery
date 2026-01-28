import { sql } from '@vercel/postgres';
import type { ResearchSite } from '@/types/poster';

/**
 * Get all research sites from the database, ordered by display_order then name
 */
export async function getAllResearchSites(): Promise<ResearchSite[]> {
  const result = await sql`
    SELECT * FROM research_sites ORDER BY display_order ASC, name ASC
  `;
  return result.rows.map(dbRowToResearchSite);
}

/**
 * Get just the research site names (for dropdowns, etc.)
 */
export async function getResearchSiteNames(): Promise<string[]> {
  const result = await sql`
    SELECT name FROM research_sites ORDER BY display_order ASC, name ASC
  `;
  return result.rows.map(row => row.name);
}

/**
 * Get a single research site by ID
 */
export async function getResearchSiteById(id: number): Promise<ResearchSite | null> {
  const result = await sql`
    SELECT * FROM research_sites WHERE id = ${id}
  `;
  if (result.rows.length === 0) {
    return null;
  }
  return dbRowToResearchSite(result.rows[0]);
}

/**
 * Create a new research site
 */
export async function createResearchSite(data: {
  name: string;
  urlTemplate: string;
  requiresSubscription?: boolean;
  username?: string | null;
  password?: string | null;
  displayOrder?: number;
}): Promise<ResearchSite> {
  const result = await sql`
    INSERT INTO research_sites (name, url_template, requires_subscription, username, password, display_order)
    VALUES (
      ${data.name.trim()},
      ${data.urlTemplate.trim()},
      ${data.requiresSubscription || false},
      ${data.username || null},
      ${data.password || null},
      ${data.displayOrder || 0}
    )
    RETURNING *
  `;
  return dbRowToResearchSite(result.rows[0]);
}

/**
 * Update a research site by ID
 */
export async function updateResearchSite(
  id: number,
  data: Partial<{
    name: string;
    urlTemplate: string;
    requiresSubscription: boolean;
    username: string | null;
    password: string | null;
    displayOrder: number;
  }>
): Promise<ResearchSite> {
  // Build dynamic update - only update provided fields
  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (data.name !== undefined) {
    updates.push(`name = $${paramIndex}`);
    values.push(data.name.trim());
    paramIndex++;
  }
  if (data.urlTemplate !== undefined) {
    updates.push(`url_template = $${paramIndex}`);
    values.push(data.urlTemplate.trim());
    paramIndex++;
  }
  if (data.requiresSubscription !== undefined) {
    updates.push(`requires_subscription = $${paramIndex}`);
    values.push(data.requiresSubscription);
    paramIndex++;
  }
  if (data.username !== undefined) {
    updates.push(`username = $${paramIndex}`);
    values.push(data.username);
    paramIndex++;
  }
  if (data.password !== undefined) {
    updates.push(`password = $${paramIndex}`);
    values.push(data.password);
    paramIndex++;
  }
  if (data.displayOrder !== undefined) {
    updates.push(`display_order = $${paramIndex}`);
    values.push(data.displayOrder);
    paramIndex++;
  }

  if (updates.length === 0) {
    // No updates, just return existing
    const existing = await getResearchSiteById(id);
    if (!existing) {
      throw new Error(`Research site with ID ${id} not found`);
    }
    return existing;
  }

  values.push(id);
  const query = `
    UPDATE research_sites
    SET ${updates.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING *
  `;

  const result = await sql.query(query, values);
  if (result.rows.length === 0) {
    throw new Error(`Research site with ID ${id} not found`);
  }
  return dbRowToResearchSite(result.rows[0]);
}

/**
 * Delete a research site by ID
 */
export async function deleteResearchSite(id: number): Promise<void> {
  await sql`DELETE FROM research_sites WHERE id = ${id}`;
}

/**
 * Check if a research site name already exists (case-insensitive)
 */
export async function researchSiteExists(name: string): Promise<boolean> {
  const result = await sql`
    SELECT COUNT(*) as count FROM research_sites WHERE LOWER(name) = LOWER(${name.trim()})
  `;
  return parseInt(result.rows[0].count) > 0;
}

/**
 * Convert database row to ResearchSite type
 */
function dbRowToResearchSite(row: any): ResearchSite {
  return {
    id: row.id,
    name: row.name,
    urlTemplate: row.url_template,
    requiresSubscription: row.requires_subscription,
    username: row.username,
    password: row.password,
    displayOrder: row.display_order,
    createdAt: new Date(row.created_at),
  };
}
