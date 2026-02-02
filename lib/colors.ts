import { sql } from '@vercel/postgres';

export interface Color {
  id: number;
  name: string;
  hexCode: string | null;
  displayOrder: number;
  createdAt: Date;
}

/**
 * Get all colors from the database, ordered by display order
 */
export async function getAllColors(): Promise<Color[]> {
  try {
    const result = await sql`
      SELECT * FROM colors ORDER BY display_order ASC, name ASC
    `;
    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      hexCode: row.hex_code,
      displayOrder: row.display_order || 0,
      createdAt: new Date(row.created_at),
    }));
  } catch (error) {
    // Table might not exist yet
    console.warn('[getAllColors] Could not fetch colors:', error);
    return [];
  }
}

/**
 * Get just the color names (for prompt injection)
 */
export async function getColorNames(): Promise<string[]> {
  try {
    const result = await sql`
      SELECT name FROM colors ORDER BY display_order ASC, name ASC
    `;
    return result.rows.map(row => row.name);
  } catch (error) {
    // Table might not exist yet
    console.warn('[getColorNames] Could not fetch colors:', error);
    return [];
  }
}

/**
 * Create a new color
 */
export async function createColor(name: string, hexCode?: string, displayOrder?: number): Promise<Color> {
  const result = await sql`
    INSERT INTO colors (name, hex_code, display_order)
    VALUES (${name.trim()}, ${hexCode || null}, ${displayOrder || 0})
    RETURNING *
  `;
  return {
    id: result.rows[0].id,
    name: result.rows[0].name,
    hexCode: result.rows[0].hex_code,
    displayOrder: result.rows[0].display_order || 0,
    createdAt: new Date(result.rows[0].created_at),
  };
}

/**
 * Delete a color by ID
 */
export async function deleteColor(id: number): Promise<void> {
  await sql`DELETE FROM colors WHERE id = ${id}`;
}

/**
 * Check if a color name already exists (case-insensitive)
 */
export async function colorExists(name: string): Promise<boolean> {
  try {
    const result = await sql`
      SELECT COUNT(*) as count FROM colors WHERE LOWER(name) = LOWER(${name.trim()})
    `;
    return parseInt(result.rows[0].count) > 0;
  } catch {
    return false;
  }
}

/**
 * Get a single color by ID
 */
export async function getColorById(id: number): Promise<Color | null> {
  const result = await sql`
    SELECT * FROM colors WHERE id = ${id}
  `;
  if (result.rows.length === 0) {
    return null;
  }
  return {
    id: result.rows[0].id,
    name: result.rows[0].name,
    hexCode: result.rows[0].hex_code,
    displayOrder: result.rows[0].display_order || 0,
    createdAt: new Date(result.rows[0].created_at),
  };
}
