import { sql } from '@vercel/postgres';

interface WikipediaData {
  title?: string;
  description?: string;
  location?: string;
  country?: string;
  foundedYear?: number;
  closedYear?: number;
  ceasedYear?: number;
  publicationType?: string;
  nationality?: string;
  birthYear?: number;
  deathYear?: number;
  imageUrl?: string;
  wikipediaUrl?: string;
}

/**
 * Search Wikipedia for a page matching the given name
 * Returns the Wikipedia URL and extracted data if found
 */
async function searchWikipedia(
  name: string,
  type: 'printer' | 'publisher' | 'artist'
): Promise<WikipediaData | null> {
  try {
    // Search Wikipedia for the name
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(name)}&limit=5&format=json&origin=*`;
    const searchResponse = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'VintagePosterGallery/1.0 (https://vintage-poster-gallery.vercel.app)',
      },
    });

    if (!searchResponse.ok) return null;

    const searchData = await searchResponse.json();
    const titles: string[] = searchData[1] || [];
    const urls: string[] = searchData[3] || [];

    if (titles.length === 0) return null;

    // Try to find the best match
    // For printers, look for printing/lithograph/typography related pages
    // For publishers, look for magazine/newspaper/publishing related pages
    let bestMatch = 0;
    const nameLower = name.toLowerCase();

    for (let i = 0; i < titles.length; i++) {
      const titleLower = titles[i].toLowerCase();
      // Exact match is best
      if (titleLower === nameLower) {
        bestMatch = i;
        break;
      }
      // Partial match with relevant keywords
      if (type === 'printer' && (titleLower.includes('print') || titleLower.includes('lithograph'))) {
        bestMatch = i;
      }
      if (type === 'publisher' && (titleLower.includes('magazine') || titleLower.includes('newspaper') || titleLower.includes('publication'))) {
        bestMatch = i;
      }
    }

    const wikipediaUrl = urls[bestMatch];
    if (!wikipediaUrl) return null;

    // Now fetch the page data
    const pageTitle = titles[bestMatch];
    const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`;
    const summaryResponse = await fetch(summaryUrl, {
      headers: {
        'User-Agent': 'VintagePosterGallery/1.0 (https://vintage-poster-gallery.vercel.app)',
      },
    });

    if (!summaryResponse.ok) return null;

    const summaryData = await summaryResponse.json();

    // Fetch infobox data for structured info
    const parseUrl = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(pageTitle)}&prop=wikitext&format=json&origin=*`;
    const parseResponse = await fetch(parseUrl, {
      headers: {
        'User-Agent': 'VintagePosterGallery/1.0 (https://vintage-poster-gallery.vercel.app)',
      },
    });

    let infoboxData: Record<string, string> = {};
    if (parseResponse.ok) {
      const parseData = await parseResponse.json();
      const wikitext = parseData?.parse?.wikitext?.['*'] || '';
      infoboxData = extractInfoboxData(wikitext);
    }

    // Build result based on type
    const result: WikipediaData = {
      wikipediaUrl,
      description: summaryData.extract,
      imageUrl: summaryData.thumbnail?.source,
    };

    if (type === 'printer') {
      extractPrinterFields(result, infoboxData, summaryData.extract);
    } else if (type === 'publisher') {
      extractPublisherFields(result, infoboxData, summaryData.extract);
    } else if (type === 'artist') {
      extractArtistFields(result, infoboxData, summaryData.extract);
    }

    return result;
  } catch (error) {
    console.error('Wikipedia search error:', error);
    return null;
  }
}

function extractInfoboxData(wikitext: string): Record<string, string> {
  const data: Record<string, string> = {};
  const infoboxMatch = wikitext.match(/\{\{Infobox[^}]*\n([\s\S]*?)\n\}\}/i);
  if (!infoboxMatch) return data;

  const lines = infoboxMatch[1].split('\n');
  for (const line of lines) {
    const match = line.match(/\|\s*([^=]+?)\s*=\s*(.+)/);
    if (match) {
      const key = match[1].trim().toLowerCase().replace(/\s+/g, '_');
      let value = match[2].trim()
        .replace(/\[\[([^|\]]*\|)?([^\]]+)\]\]/g, '$2')
        .replace(/\{\{[^}]+\}\}/g, '')
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (value) data[key] = value;
    }
  }
  return data;
}

function extractYear(text: string): number | undefined {
  const match = text?.match(/\b(1[5-9]\d{2}|20[0-2]\d)\b/);
  return match ? parseInt(match[1]) : undefined;
}

function extractPrinterFields(data: WikipediaData, infobox: Record<string, string>, extract: string): void {
  const locationFields = ['location', 'headquarters', 'city', 'hq_location'];
  for (const field of locationFields) {
    if (infobox[field]) { data.location = infobox[field]; break; }
  }

  const countryFields = ['country', 'location_country', 'nation'];
  for (const field of countryFields) {
    if (infobox[field]) { data.country = infobox[field]; break; }
  }

  const foundedFields = ['founded', 'established', 'formed'];
  for (const field of foundedFields) {
    if (infobox[field]) { data.foundedYear = extractYear(infobox[field]); if (data.foundedYear) break; }
  }

  const closedFields = ['defunct', 'closed', 'dissolved'];
  for (const field of closedFields) {
    if (infobox[field]) { data.closedYear = extractYear(infobox[field]); if (data.closedYear) break; }
  }

  // Try extract from text
  if (!data.foundedYear) {
    const match = extract?.match(/(?:founded|established)\s+(?:in\s+)?(\d{4})/i);
    if (match) data.foundedYear = parseInt(match[1]);
  }
}

function extractPublisherFields(data: WikipediaData, infobox: Record<string, string>, extract: string): void {
  const typeFields = ['type', 'format', 'category'];
  for (const field of typeFields) {
    if (infobox[field]) { data.publicationType = infobox[field]; break; }
  }

  const countryFields = ['country', 'location_country', 'based'];
  for (const field of countryFields) {
    if (infobox[field]) { data.country = infobox[field]; break; }
  }

  const foundedFields = ['founded', 'first_issue', 'established'];
  for (const field of foundedFields) {
    if (infobox[field]) { data.foundedYear = extractYear(infobox[field]); if (data.foundedYear) break; }
  }

  const ceasedFields = ['final_issue', 'ceased_publication', 'defunct'];
  for (const field of ceasedFields) {
    if (infobox[field]) { data.ceasedYear = extractYear(infobox[field]); if (data.ceasedYear) break; }
  }

  // Infer type from extract
  if (!data.publicationType) {
    if (extract?.match(/\bmagazine\b/i)) data.publicationType = 'Magazine';
    else if (extract?.match(/\bnewspaper\b/i)) data.publicationType = 'Newspaper';
    else if (extract?.match(/\bjournal\b/i)) data.publicationType = 'Journal';
  }
}

function extractArtistFields(data: WikipediaData, infobox: Record<string, string>, extract: string): void {
  const nationalityFields = ['nationality', 'citizenship', 'birth_place'];
  for (const field of nationalityFields) {
    if (infobox[field]) { data.nationality = infobox[field]; break; }
  }

  const birthFields = ['birth_date', 'born', 'birth_year'];
  for (const field of birthFields) {
    if (infobox[field]) { data.birthYear = extractYear(infobox[field]); if (data.birthYear) break; }
  }

  const deathFields = ['death_date', 'died', 'death_year'];
  for (const field of deathFields) {
    if (infobox[field]) { data.deathYear = extractYear(infobox[field]); if (data.deathYear) break; }
  }

  // Try extract from text (1875-1942)
  if (!data.birthYear || !data.deathYear) {
    const match = extract?.match(/\((\d{4})\s*[-–—]\s*(\d{4})\)/);
    if (match) {
      if (!data.birthYear) data.birthYear = parseInt(match[1]);
      if (!data.deathYear) data.deathYear = parseInt(match[2]);
    }
  }
}

/**
 * Find or create a printer record, auto-fetching Wikipedia data if creating new
 * Returns the printer ID for linking
 */
export async function findOrCreatePrinter(
  printerName: string,
  confidence: string
): Promise<{ printerId: number; isNew: boolean } | null> {
  if (!printerName || confidence !== 'confirmed') {
    return null;
  }

  try {
    // First, check if printer already exists (by name or alias)
    const existingResult = await sql`
      SELECT id, name FROM printers
      WHERE LOWER(name) = LOWER(${printerName})
         OR ${printerName} = ANY(aliases)
      LIMIT 1
    `;

    if (existingResult.rows.length > 0) {
      return {
        printerId: existingResult.rows[0].id,
        isNew: false,
      };
    }

    // Not found - create new printer with Wikipedia data
    console.log(`Creating new printer: ${printerName}`);

    // Search Wikipedia for data
    const wikiData = await searchWikipedia(printerName, 'printer');

    // Insert new printer
    const insertResult = await sql`
      INSERT INTO printers (name, location, country, founded_year, closed_year, wikipedia_url, bio, image_url, verified)
      VALUES (
        ${printerName},
        ${wikiData?.location || null},
        ${wikiData?.country || null},
        ${wikiData?.foundedYear || null},
        ${wikiData?.closedYear || null},
        ${wikiData?.wikipediaUrl || null},
        ${wikiData?.description || null},
        ${wikiData?.imageUrl || null},
        ${wikiData?.wikipediaUrl ? true : false}
      )
      RETURNING id
    `;

    return {
      printerId: insertResult.rows[0].id,
      isNew: true,
    };
  } catch (error) {
    console.error('Error finding/creating printer:', error);
    return null;
  }
}

/**
 * Find or create a publisher record, auto-fetching Wikipedia data if creating new
 * Returns the publisher ID for linking
 */
export async function findOrCreatePublisher(
  publicationName: string
): Promise<{ publisherId: number; isNew: boolean } | null> {
  if (!publicationName) {
    return null;
  }

  try {
    // First, check if publisher already exists (by name or alias)
    const existingResult = await sql`
      SELECT id, name FROM publishers
      WHERE LOWER(name) = LOWER(${publicationName})
         OR ${publicationName} = ANY(aliases)
      LIMIT 1
    `;

    if (existingResult.rows.length > 0) {
      return {
        publisherId: existingResult.rows[0].id,
        isNew: false,
      };
    }

    // Not found - create new publisher with Wikipedia data
    console.log(`Creating new publisher: ${publicationName}`);

    // Search Wikipedia for data
    const wikiData = await searchWikipedia(publicationName, 'publisher');

    // Insert new publisher
    const insertResult = await sql`
      INSERT INTO publishers (name, publication_type, country, founded_year, ceased_year, wikipedia_url, bio, image_url, verified)
      VALUES (
        ${publicationName},
        ${wikiData?.publicationType || null},
        ${wikiData?.country || null},
        ${wikiData?.foundedYear || null},
        ${wikiData?.ceasedYear || null},
        ${wikiData?.wikipediaUrl || null},
        ${wikiData?.description || null},
        ${wikiData?.imageUrl || null},
        ${wikiData?.wikipediaUrl ? true : false}
      )
      RETURNING id
    `;

    return {
      publisherId: insertResult.rows[0].id,
      isNew: true,
    };
  } catch (error) {
    console.error('Error finding/creating publisher:', error);
    return null;
  }
}

/**
 * Find or create an artist record, auto-fetching Wikipedia data if creating new
 * Returns the artist ID for linking
 */
export async function findOrCreateArtist(
  artistName: string,
  confidence: string
): Promise<{ artistId: number; isNew: boolean } | null> {
  if (!artistName || confidence !== 'confirmed') {
    return null;
  }

  try {
    // First, check if artist already exists (by name or alias)
    const existingResult = await sql`
      SELECT id, name FROM artists
      WHERE LOWER(name) = LOWER(${artistName})
         OR ${artistName} = ANY(aliases)
      LIMIT 1
    `;

    if (existingResult.rows.length > 0) {
      return {
        artistId: existingResult.rows[0].id,
        isNew: false,
      };
    }

    // Not found - create new artist with Wikipedia data
    console.log(`Creating new artist: ${artistName}`);

    // Search Wikipedia for data
    const wikiData = await searchWikipedia(artistName, 'artist');

    // Insert new artist
    const insertResult = await sql`
      INSERT INTO artists (name, nationality, birth_year, death_year, wikipedia_url, bio, image_url, verified)
      VALUES (
        ${artistName},
        ${wikiData?.nationality || null},
        ${wikiData?.birthYear || null},
        ${wikiData?.deathYear || null},
        ${wikiData?.wikipediaUrl || null},
        ${wikiData?.description || null},
        ${wikiData?.imageUrl || null},
        ${wikiData?.wikipediaUrl ? true : false}
      )
      RETURNING id
    `;

    return {
      artistId: insertResult.rows[0].id,
      isNew: true,
    };
  } catch (error) {
    console.error('Error finding/creating artist:', error);
    return null;
  }
}

/**
 * Auto-link a poster to printer, publisher, and artist based on analysis results
 * Call this after updatePosterAnalysis to set the foreign key links
 */
export async function autoLinkPosterEntities(
  posterId: number,
  analysis: {
    artist?: string;
    artistConfidence?: string;
    printer?: string;
    printerConfidence?: string;
    publication?: string;
  }
): Promise<{
  artistLinked?: { id: number; isNew: boolean };
  printerLinked?: { id: number; isNew: boolean };
  publisherLinked?: { id: number; isNew: boolean };
}> {
  const result: {
    artistLinked?: { id: number; isNew: boolean };
    printerLinked?: { id: number; isNew: boolean };
    publisherLinked?: { id: number; isNew: boolean };
  } = {};

  // Auto-link artist if confirmed
  if (analysis.artist && analysis.artistConfidence === 'confirmed') {
    const artistResult = await findOrCreateArtist(analysis.artist, analysis.artistConfidence);
    if (artistResult) {
      await sql`
        UPDATE posters SET artist_id = ${artistResult.artistId}, last_modified = NOW()
        WHERE id = ${posterId}
      `;
      result.artistLinked = { id: artistResult.artistId, isNew: artistResult.isNew };
    }
  }

  // Auto-link printer if confirmed
  if (analysis.printer && analysis.printerConfidence === 'confirmed') {
    const printerResult = await findOrCreatePrinter(analysis.printer, analysis.printerConfidence);
    if (printerResult) {
      await sql`
        UPDATE posters SET printer_id = ${printerResult.printerId}, last_modified = NOW()
        WHERE id = ${posterId}
      `;
      result.printerLinked = { id: printerResult.printerId, isNew: printerResult.isNew };
    }
  }

  // Auto-link publisher if publication is identified (no confidence threshold for publications)
  if (analysis.publication) {
    const publisherResult = await findOrCreatePublisher(analysis.publication);
    if (publisherResult) {
      await sql`
        UPDATE posters SET publisher_id = ${publisherResult.publisherId}, last_modified = NOW()
        WHERE id = ${posterId}
      `;
      result.publisherLinked = { id: publisherResult.publisherId, isNew: publisherResult.isNew };
    }
  }

  return result;
}
