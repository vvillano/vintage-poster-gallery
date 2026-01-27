import { sql } from '@vercel/postgres';
import type { Tag } from '@/types/poster';

/**
 * Get all tags from the database, alphabetized
 */
export async function getAllTags(): Promise<Tag[]> {
  const result = await sql`
    SELECT * FROM tags ORDER BY name ASC
  `;
  return result.rows.map(row => ({
    id: row.id,
    name: row.name,
    createdAt: new Date(row.created_at),
  }));
}

/**
 * Get just the tag names (for prompt injection)
 */
export async function getTagNames(): Promise<string[]> {
  const result = await sql`
    SELECT name FROM tags ORDER BY name ASC
  `;
  return result.rows.map(row => row.name);
}

/**
 * Create a new tag
 */
export async function createTag(name: string): Promise<Tag> {
  const result = await sql`
    INSERT INTO tags (name) VALUES (${name.trim()})
    RETURNING *
  `;
  return {
    id: result.rows[0].id,
    name: result.rows[0].name,
    createdAt: new Date(result.rows[0].created_at),
  };
}

/**
 * Delete a tag by ID
 */
export async function deleteTag(id: number): Promise<void> {
  await sql`DELETE FROM tags WHERE id = ${id}`;
}

/**
 * Check if a tag name already exists (case-insensitive)
 */
export async function tagExists(name: string): Promise<boolean> {
  const result = await sql`
    SELECT COUNT(*) as count FROM tags WHERE LOWER(name) = LOWER(${name.trim()})
  `;
  return parseInt(result.rows[0].count) > 0;
}

/**
 * Get a single tag by ID
 */
export async function getTagById(id: number): Promise<Tag | null> {
  const result = await sql`
    SELECT * FROM tags WHERE id = ${id}
  `;
  if (result.rows.length === 0) {
    return null;
  }
  return {
    id: result.rows[0].id,
    name: result.rows[0].name,
    createdAt: new Date(result.rows[0].created_at),
  };
}
