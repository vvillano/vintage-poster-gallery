import { sql } from '@vercel/postgres';
import type {
  Poster,
  CreatePosterInput,
  UpdatePosterInput,
  SupplementalImage,
  ResearchImage,
  ComparableSale,
  ShopifyData,
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
      product_type,
      supplemental_images,
      analysis_completed
    )
    VALUES (
      ${input.imageUrl},
      ${input.imageBlobId},
      ${input.fileName},
      ${input.fileSize},
      ${input.uploadedBy},
      ${input.initialInformation || null},
      ${input.productType || null},
      ${input.supplementalImages ? JSON.stringify(input.supplementalImages) : null},
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
      artist_confidence = ${analysis.artistConfidence || null},
      artist_confidence_score = ${analysis.artistConfidenceScore || null},
      artist_source = ${analysis.artistSource || null},
      attribution_basis = ${analysis.attributionBasis || null},
      artist_signature_text = ${analysis.artistSignatureText || null},
      artist_verification = ${analysis.artistVerification ? JSON.stringify(analysis.artistVerification) : null},
      title = ${analysis.title || null},
      estimated_date = ${analysis.estimatedDate || null},
      date_confidence = ${analysis.dateConfidence || null},
      date_source = ${analysis.dateSource || null},
      dimensions_estimate = ${analysis.dimensionsEstimate || null},
      historical_context = ${analysis.historicalContext || null},
      significance = ${analysis.significance || null},
      printing_technique = ${analysis.printingTechnique || null},
      printer = ${analysis.printer || null},
      printer_confidence = ${analysis.printerConfidence || null},
      printer_source = ${analysis.printerSource || null},
      printer_verification = ${analysis.printerVerification ? JSON.stringify(analysis.printerVerification) : null},
      publisher_confidence = ${analysis.publisherConfidence || null},
      publisher_source = ${analysis.publisherSource || null},
      publication = ${analysis.publication || null},
      publication_confidence = ${analysis.publicationConfidence || null},
      publication_source = ${analysis.publicationSource || null},
      rarity_analysis = ${analysis.rarityAnalysis || null},
      value_insights = ${analysis.valueInsights || null},
      validation_notes = ${analysis.validationNotes || null},
      product_description = ${analysis.productDescription || null},
      source_citations = ${analysis.sourceCitations ? JSON.stringify(analysis.sourceCitations) : null},
      similar_products = ${analysis.similarProducts ? JSON.stringify(analysis.similarProducts) : null},
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
 * Update only the rawAiResponse field (for partial updates like tag refresh)
 */
export async function updatePosterRawAiResponse(
  id: number,
  rawAiResponse: any
): Promise<Poster> {
  const result = await sql`
    UPDATE posters
    SET
      raw_ai_response = ${JSON.stringify(rawAiResponse)},
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
 * Update product descriptions and talking points in rawAiResponse
 */
export async function updatePosterDescriptions(
  id: number,
  data: any
): Promise<Poster> {
  // Get current rawAiResponse
  const poster = await getPosterById(id);
  if (!poster) {
    throw new Error(`Poster with ID ${id} not found`);
  }

  // Extract descriptions and talking points
  const { talkingPoints, ...descriptions } = data;

  // Merge new data into rawAiResponse
  const updatedRawResponse = {
    ...poster.rawAiResponse,
    productDescriptions: descriptions,
    ...(talkingPoints ? { talkingPoints } : {})
  };

  const result = await sql`
    UPDATE posters
    SET
      product_description = ${descriptions.standard || null},
      raw_ai_response = ${JSON.stringify(updatedRawResponse)},
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
 * Search posters by artist, title, SKU, or other text fields
 */
export async function searchPosters(query: string): Promise<Poster[]> {
  const searchTerm = `%${query}%`;

  const result = await sql`
    SELECT * FROM posters
    WHERE
      artist ILIKE ${searchTerm} OR
      title ILIKE ${searchTerm} OR
      estimated_date ILIKE ${searchTerm} OR
      printing_technique ILIKE ${searchTerm} OR
      sku ILIKE ${searchTerm}
    ORDER BY upload_date DESC
    LIMIT 50
  `;

  return result.rows.map(dbRowToPoster);
}

/**
 * Find a poster by SKU (case-insensitive exact match)
 */
export async function findPosterBySku(sku: string): Promise<Poster | null> {
  const result = await sql`
    SELECT * FROM posters
    WHERE LOWER(sku) = LOWER(${sku})
    LIMIT 1
  `;

  if (result.rows.length === 0) {
    return null;
  }

  return dbRowToPoster(result.rows[0]);
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
 * Add or update supplemental images for a poster
 */
export async function updateSupplementalImages(
  id: number,
  images: SupplementalImage[]
): Promise<Poster> {
  const result = await sql`
    UPDATE posters
    SET
      supplemental_images = ${JSON.stringify(images)},
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
 * Add a supplemental image to an existing poster
 */
export async function addSupplementalImage(
  id: number,
  image: SupplementalImage
): Promise<Poster> {
  // Get current poster
  const poster = await getPosterById(id);
  if (!poster) {
    throw new Error(`Poster with ID ${id} not found`);
  }

  // Add new image to array
  const currentImages = poster.supplementalImages || [];
  const updatedImages = [...currentImages, image];

  return updateSupplementalImages(id, updatedImages);
}

/**
 * Remove a supplemental image from a poster
 */
export async function removeSupplementalImage(
  id: number,
  imageUrl: string
): Promise<Poster> {
  // Get current poster
  const poster = await getPosterById(id);
  if (!poster) {
    throw new Error(`Poster with ID ${id} not found`);
  }

  // Remove image from array
  const currentImages = poster.supplementalImages || [];
  const updatedImages = currentImages.filter(img => img.url !== imageUrl);

  return updateSupplementalImages(id, updatedImages);
}

/**
 * Update the selected tags for a poster
 */
export async function updatePosterTags(
  id: number,
  tags: string[]
): Promise<Poster> {
  const result = await sql`
    UPDATE posters
    SET
      item_tags = ${JSON.stringify(tags)},
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
 * Update the selected colors for a poster
 */
export async function updatePosterColors(
  id: number,
  colors: string[]
): Promise<Poster> {
  // Convert to PostgreSQL array literal
  const colorsLiteral = colors.length > 0
    ? `{${colors.map(c => `"${c.replace(/"/g, '\\"')}"`).join(',')}}`
    : null;

  const result = await sql`
    UPDATE posters
    SET
      colors = ${colorsLiteral}::TEXT[],
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
 * Update the selected printing techniques for a poster
 */
export async function updatePosterPrintingTechniques(
  id: number,
  techniqueIds: number[]
): Promise<Poster> {
  const result = await sql`
    UPDATE posters
    SET
      printing_technique_ids = ${JSON.stringify(techniqueIds)},
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
 * Get comparable sales for a poster
 */
export async function getComparableSales(posterId: number): Promise<ComparableSale[]> {
  const poster = await getPosterById(posterId);
  if (!poster) {
    throw new Error(`Poster with ID ${posterId} not found`);
  }
  return poster.comparableSales || [];
}

/**
 * Add a comparable sale to a poster
 */
export async function addComparableSale(
  posterId: number,
  sale: Omit<ComparableSale, 'id' | 'createdAt'>
): Promise<Poster> {
  const poster = await getPosterById(posterId);
  if (!poster) {
    throw new Error(`Poster with ID ${posterId} not found`);
  }

  const currentSales = poster.comparableSales || [];
  const newSale: ComparableSale = {
    ...sale,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  const updatedSales = [...currentSales, newSale];

  const result = await sql`
    UPDATE posters
    SET
      comparable_sales = ${JSON.stringify(updatedSales)},
      last_modified = NOW()
    WHERE id = ${posterId}
    RETURNING *
  `;

  return dbRowToPoster(result.rows[0]);
}

/**
 * Update a comparable sale for a poster
 */
export async function updateComparableSale(
  posterId: number,
  saleId: string,
  updates: Partial<Omit<ComparableSale, 'id' | 'createdAt'>>
): Promise<Poster> {
  const poster = await getPosterById(posterId);
  if (!poster) {
    throw new Error(`Poster with ID ${posterId} not found`);
  }

  const currentSales = poster.comparableSales || [];
  const updatedSales = currentSales.map(sale =>
    sale.id === saleId ? { ...sale, ...updates } : sale
  );

  const result = await sql`
    UPDATE posters
    SET
      comparable_sales = ${JSON.stringify(updatedSales)},
      last_modified = NOW()
    WHERE id = ${posterId}
    RETURNING *
  `;

  return dbRowToPoster(result.rows[0]);
}

/**
 * Delete a comparable sale from a poster
 */
export async function deleteComparableSale(
  posterId: number,
  saleId: string
): Promise<Poster> {
  const poster = await getPosterById(posterId);
  if (!poster) {
    throw new Error(`Poster with ID ${posterId} not found`);
  }

  const currentSales = poster.comparableSales || [];
  const updatedSales = currentSales.filter(sale => sale.id !== saleId);

  const result = await sql`
    UPDATE posters
    SET
      comparable_sales = ${JSON.stringify(updatedSales)},
      last_modified = NOW()
    WHERE id = ${posterId}
    RETURNING *
  `;

  return dbRowToPoster(result.rows[0]);
}

/**
 * Update research images for a poster
 */
export async function updateResearchImages(
  id: number,
  images: ResearchImage[]
): Promise<Poster> {
  const result = await sql`
    UPDATE posters
    SET
      research_images = ${JSON.stringify(images)},
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
 * Add a research image to an existing poster
 */
export async function addResearchImage(
  id: number,
  image: ResearchImage
): Promise<Poster> {
  // Get current poster
  const poster = await getPosterById(id);
  if (!poster) {
    throw new Error(`Poster with ID ${id} not found`);
  }

  // Add new image to array
  const currentImages = poster.researchImages || [];
  const updatedImages = [...currentImages, image];

  return updateResearchImages(id, updatedImages);
}

/**
 * Remove a research image from a poster
 */
export async function removeResearchImage(
  id: number,
  imageUrl: string
): Promise<Poster> {
  // Get current poster
  const poster = await getPosterById(id);
  if (!poster) {
    throw new Error(`Poster with ID ${id} not found`);
  }

  // Remove image from array
  const currentImages = poster.researchImages || [];
  const updatedImages = currentImages.filter(img => img.url !== imageUrl);

  return updateResearchImages(id, updatedImages);
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
    supplementalImages: row.supplemental_images,
    itemTags: row.item_tags,
    colors: row.colors,
    comparableSales: row.comparable_sales,
    initialInformation: row.initial_information,
    productType: row.product_type,
    artist: row.artist,
    artistConfidence: row.artist_confidence,
    artistConfidenceScore: row.artist_confidence_score,
    artistSource: row.artist_source,
    attributionBasis: row.attribution_basis,
    artistSignatureText: row.artist_signature_text,
    artistVerification: row.artist_verification,
    artistId: row.artist_id,
    title: row.title,
    estimatedDate: row.estimated_date,
    dateConfidence: row.date_confidence,
    dateSource: row.date_source,
    dimensionsEstimate: row.dimensions_estimate,
    historicalContext: row.historical_context,
    significance: row.significance,
    printingTechnique: row.printing_technique,
    printingTechniqueIds: row.printing_technique_ids,
    printer: row.printer,
    printerId: row.printer_id,
    printerConfidence: row.printer_confidence,
    printerSource: row.printer_source,
    printerVerification: row.printer_verification,
    publisherId: row.publisher_id,
    publisherConfidence: row.publisher_confidence,
    publisherSource: row.publisher_source,
    // Publication (periodicals) fields
    publication: row.publication,
    publicationConfidence: row.publication_confidence,
    publicationSource: row.publication_source,
    // Book source fields
    bookId: row.book_id,
    rarityAnalysis: row.rarity_analysis,
    valueInsights: row.value_insights,
    validationNotes: row.validation_notes,
    productDescription: row.product_description,
    sourceCitations: row.source_citations,
    similarProducts: row.similar_products,
    analysisCompleted: row.analysis_completed,
    analysisDate: row.analysis_date ? new Date(row.analysis_date) : null,
    rawAiResponse: row.raw_ai_response,
    userNotes: row.user_notes,
    lastModified: new Date(row.last_modified),
    // Shopify integration fields
    shopifyProductId: row.shopify_product_id,
    sku: row.sku,
    shopifyStatus: row.shopify_status,
    shopifySyncedAt: row.shopify_synced_at ? new Date(row.shopify_synced_at) : null,
    shopifyData: row.shopify_data,
    // Research-specific fields
    shopifyTitle: row.shopify_title,
    researchImages: row.research_images,
  };
}
