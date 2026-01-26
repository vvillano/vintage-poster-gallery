import { sql } from '@vercel/postgres';
import type {
  Poster,
  CreatePosterInput,
  UpdatePosterInput,
} from '@/types/poster';

/**
 * Create a new poster record in the database
 */
export async function createPoster(
  input: CreatePosterInput
): Promise<Poster> {
  const result = await sql`
    INSERT INTO posters (
      image_url,
      image_blob_id,
      file_name,
      file_size,
      uploaded_by,
      initial_information,
      analysis_completed
    )
    VALUES (
      ${input.imageUrl},
      ${input.imageBlobId},
      ${input.fileName},
      ${input.fileSize},
      ${input.uploadedBy},
      ${input.initialInformation || null},
      false
    )
    RETURNING *
  `;

  return dbRowToPoster(result.rows[0]);
}

/**
 * Get a poster by ID
 */
export async function getPosterById(id: number): Promise<Poster | null> {
  const result = await sql`
    SELECT * FROM posters WHERE id = ${id}
  `;

  if (result.rows.length === 0) {
    return null;
  }

  return dbRowToPoster(result.rows[0]);
}

/**
 * Get all posters, optionally filtered
 */
export async function getAllPosters(options?: {
  limit?: number;
  offset?: number;
  onlyAnalyzed?: boolean;
}): Promise<Poster[]> {
  const { limit = 50, offset = 0, onlyAnalyzed = false } = options || {};

  let result;

  if (onlyAnalyzed) {
    result = await sql`
      SELECT * FROM posters
      WHERE analysis_completed = true
      ORDER BY upload_date DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
  } else {
    result = await sql`
      SELECT * FROM posters
      ORDER BY upload_date DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
  }

  return result.rows.map(dbRowToPoster);
}

/**
 * Update a poster's analysis results
 */
export async function updatePosterAnalysis(
  id: number,
  analysis: UpdatePosterInput & { rawAiResponse?: any }
): Promise<Poster> {
  const result = await sql`
    UPDATE posters
    SET
      artist = ${analysis.artist || null},
      title = ${analysis.title || null},
      estimated_date = ${analysis.estimatedDate || null},
      dimensions_estimate = ${analysis.dimensionsEstimate || null},
      historical_context = ${analysis.historicalContext || null},
      significance = ${analysis.significance || null},
      printing_technique = ${analysis.printingTechnique || null},
      rarity_analysis = ${analysis.rarityAnalysis || null},
      value_insights = ${analysis.valueInsights || null},
      validation_notes = ${analysis.validationNotes || null},
      analysis_completed = true,
      analysis_date = NOW(),
      raw_ai_response = ${analysis.rawAiResponse ? JSON.stringify(analysis.rawAiResponse) : null},
      last_modified = NOW()
    WHERE id = ${id}
    RETURNING *
  `;

  if (result.rows.length === 0) {
    throw new Error(`Poster with ID ${id} not found`);
  }

  return dbRowToPoster(result.rows[0]);
}

/**
 * Update poster user notes and manual edits
 */
export async function updatePosterFields(
  id: number,
  updates: Partial<UpdatePosterInput>
): Promise<Poster> {
  const setClauses: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  // Build dynamic SET clause
  Object.entries(updates).forEach(([key, value]) => {
    if (value !== undefined) {
      // Convert camelCase to snake_case for database columns
      const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      setClauses.push(`${dbKey} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }
  });

  if (setClauses.length === 0) {
    const poster = await getPosterById(id);
    if (!poster) {
      throw new Error(`Poster with ID ${id} not found`);
    }
    return poster;
  }

  // Add last_modified
  setClauses.push(`last_modified = NOW()`);

  // Add ID parameter
  values.push(id);

  const query = `
    UPDATE posters
    SET ${setClauses.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING *
  `;

  const result = await sql.query(query, values);

  if (result.rows.length === 0) {
    throw new Error(`Poster with ID ${id} not found`);
  }

  return dbRowToPoster(result.rows[0]);
}

/**
 * Delete a poster
 */
export async function deletePoster(id: number): Promise<void> {
  await sql`DELETE FROM posters WHERE id = ${id}`;
}

/**
 * Search posters by artist, title, or other text fields
 */
export async function searchPosters(query: string): Promise<Poster[]> {
  const searchTerm = `%${query}%`;

  const result = await sql`
    SELECT * FROM posters
    WHERE
      artist ILIKE ${searchTerm} OR
      title ILIKE ${searchTerm} OR
      estimated_date ILIKE ${searchTerm} OR
      printing_technique ILIKE ${searchTerm}
    ORDER BY upload_date DESC
    LIMIT 50
  `;

  return result.rows.map(dbRowToPoster);
}

/**
 * Get statistics about the poster collection
 */
export async function getPosterStats(): Promise<{
  total: number;
  analyzed: number;
  pending: number;
}> {
  const result = await sql`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE analysis_completed = true) as analyzed,
      COUNT(*) FILTER (WHERE analysis_completed = false) as pending
    FROM posters
  `;

  return {
    total: parseInt(result.rows[0].total),
    analyzed: parseInt(result.rows[0].analyzed),
    pending: parseInt(result.rows[0].pending),
  };
}

/**
 * Convert database row to Poster type
 */
function dbRowToPoster(row: any): Poster {
  return {
    id: row.id,
    imageUrl: row.image_url,
    imageBlobId: row.image_blob_id,
    fileName: row.file_name,
    fileSize: row.file_size,
    uploadDate: new Date(row.upload_date),
    uploadedBy: row.uploaded_by,
    initialInformation: row.initial_information,
    artist: row.artist,
    title: row.title,
    estimatedDate: row.estimated_date,
    dimensionsEstimate: row.dimensions_estimate,
    historicalContext: row.historical_context,
    significance: row.significance,
    printingTechnique: row.printing_technique,
    rarityAnalysis: row.rarity_analysis,
    valueInsights: row.value_insights,
    validationNotes: row.validation_notes,
    analysisCompleted: row.analysis_completed,
    analysisDate: row.analysis_date ? new Date(row.analysis_date) : null,
    rawAiResponse: row.raw_ai_response,
    userNotes: row.user_notes,
    lastModified: new Date(row.last_modified),
  };
}
