import { sql } from '@vercel/postgres';
import Anthropic from '@anthropic-ai/sdk';

// Common country name to ISO code mapping
const COUNTRY_CODES: Record<string, string> = {
  'argentina': 'AR',
  'australia': 'AU',
  'austria': 'AT',
  'azerbaijan': 'AZ',
  'belgium': 'BE',
  'brazil': 'BR',
  'canada': 'CA',
  'chile': 'CL',
  'china': 'CN',
  'cuba': 'CU',
  'czechoslovakia': 'CS',
  'czech republic': 'CZ',
  'czechia': 'CZ',
  'denmark': 'DK',
  'east germany': 'DD',
  'egypt': 'EG',
  'finland': 'FI',
  'france': 'FR',
  'germany': 'DE',
  'greece': 'GR',
  'holland': 'NL',
  'hungary': 'HU',
  'india': 'IN',
  'ireland': 'IE',
  'israel': 'IL',
  'italy': 'IT',
  'japan': 'JP',
  'mexico': 'MX',
  'netherlands': 'NL',
  'norway': 'NO',
  'peru': 'PE',
  'poland': 'PL',
  'portugal': 'PT',
  'romania': 'RO',
  'russia': 'RU',
  'soviet union': 'SU',
  'ussr': 'SU',
  'u.s.s.r.': 'SU',
  'scotland': 'GB',
  'spain': 'ES',
  'sweden': 'SE',
  'switzerland': 'CH',
  'turkey': 'TR',
  'ukraine': 'UA',
  'united kingdom': 'GB',
  'uk': 'GB',
  'britain': 'GB',
  'great britain': 'GB',
  'england': 'GB',
  'wales': 'GB',
  'united states': 'US',
  'usa': 'US',
  'america': 'US',
  'u.s.': 'US',
  'u.s.a.': 'US',
  'vietnam': 'VN',
  'yugoslavia': 'YU',
};

// Positive keywords for profession matching in Wikipedia searches
const ARTIST_KEYWORDS = [
  'artist', 'illustrator', 'painter', 'designer', 'graphic designer',
  'cartoonist', 'lithographer', 'engraver', 'poster artist', 'commercial artist',
  'printmaker', 'art director', 'caricaturist', 'draftsman', 'draughtsman',
  'watercolorist', 'etcher', 'woodcut', 'silkscreen'
];

const PRINTER_KEYWORDS = [
  'print', 'lithograph', 'typography', 'printing company', 'printing house',
  'lithography', 'press', 'engraving'
];

const PUBLISHER_KEYWORDS = [
  'magazine', 'newspaper', 'publication', 'journal', 'periodical',
  'publishing', 'media company', 'publisher'
];

const ORGANIZATION_KEYWORDS = [
  'agency', 'studio', 'design firm', 'advertising', 'firm', 'company',
  'inc', 'incorporated', 'llc', 'corporation', 'corp', 'co.'
];

// Negative keywords - professions that indicate wrong match
const NEGATIVE_KEYWORDS = [
  'astrophysicist', 'physicist', 'mathematician', 'astronomer', 'scientist',
  'chemist', 'biologist', 'geologist', 'politician', 'senator', 'congressman',
  'lawyer', 'attorney', 'judge', 'actor', 'actress', 'musician', 'singer',
  'composer', 'athlete', 'footballer', 'baseball', 'basketball', 'general',
  'admiral', 'colonel', 'professor', 'economist', 'physician', 'surgeon'
];

/**
 * Find or create a country record by name
 * Returns the country name (normalized) for consistency
 */
async function findOrCreateCountry(countryName: string): Promise<string | null> {
  if (!countryName) return null;

  const normalized = countryName.trim();
  const lowerName = normalized.toLowerCase();

  // Get the ISO code if we know it
  const code = COUNTRY_CODES[lowerName];

  try {
    // Check if country already exists
    const existing = await sql`
      SELECT name FROM countries
      WHERE LOWER(name) = ${lowerName}
         OR LOWER(code) = ${lowerName}
         OR code = ${code || ''}
      LIMIT 1
    `;

    if (existing.rows.length > 0) {
      return existing.rows[0].name;
    }

    // Country doesn't exist - create it
    console.log(`Creating new country: ${normalized} (${code || 'no code'})`);

    // Get the next display order
    const orderResult = await sql`SELECT COALESCE(MAX(display_order), 0) + 1 as next_order FROM countries`;
    const nextOrder = orderResult.rows[0].next_order;

    await sql`
      INSERT INTO countries (name, code, display_order)
      VALUES (${normalized}, ${code || null}, ${nextOrder})
    `;

    return normalized;
  } catch (error) {
    console.error('Error finding/creating country:', error);
    return normalized; // Return the name even if DB operation fails
  }
}

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

interface WikipediaCandidate {
  title: string;
  url: string;
  description?: string;
  score: number;
}

/**
 * Calculate match score for a Wikipedia candidate based on profession keywords
 * Returns { score, hasProfessionMatch } to enable requiring positive validation
 */
function calculateMatchScore(
  candidate: WikipediaCandidate,
  searchName: string,
  type: 'printer' | 'publisher' | 'artist'
): { score: number; hasProfessionMatch: boolean } {
  let score = 0;
  const titleLower = candidate.title.toLowerCase();
  const nameLower = searchName.toLowerCase();
  const descLower = (candidate.description || '').toLowerCase();

  // Get relevant positive keywords based on type
  const positiveKeywords = type === 'artist' ? ARTIST_KEYWORDS
    : type === 'printer' ? PRINTER_KEYWORDS : PUBLISHER_KEYWORDS;

  // Track if we found any profession-related keywords
  let hasProfessionMatch = false;

  // 1. Exact name match (+100)
  if (titleLower === nameLower) {
    score += 100;
  } else if (titleLower.includes(nameLower) || nameLower.includes(titleLower)) {
    score += 50;
  }

  // 2. Profession keywords in title (+30)
  if (positiveKeywords.some(kw => titleLower.includes(kw))) {
    score += 30;
    hasProfessionMatch = true;
  }

  // 3. Profession keywords in description (+15 each, max 45)
  const descMatches = positiveKeywords.filter(kw => descLower.includes(kw)).length;
  if (descMatches > 0) {
    score += Math.min(descMatches * 15, 45);
    hasProfessionMatch = true;
  }

  // 4. Organization keywords (+10) - helps match agencies, studios, etc.
  if (ORGANIZATION_KEYWORDS.some(kw => titleLower.includes(kw) || descLower.includes(kw))) {
    score += 10;
    hasProfessionMatch = true; // Organizations count as valid matches
  }

  // 5. Negative keywords (-200, effectively disqualifies)
  // Keep as additional safeguard even with positive validation
  if (NEGATIVE_KEYWORDS.some(kw => descLower.includes(kw))) {
    score -= 200;
  }

  return { score, hasProfessionMatch };
}

/**
 * Fetch page summaries for multiple Wikipedia titles using batch API
 */
async function fetchWikipediaSummaries(
  titles: string[]
): Promise<Map<string, string>> {
  const summaries = new Map<string, string>();
  if (titles.length === 0) return summaries;

  try {
    // Use Wikipedia API to fetch extracts for multiple pages at once
    const titlesParam = titles.slice(0, 5).join('|');
    const batchUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(titlesParam)}&prop=extracts|description&exintro=true&explaintext=true&format=json&origin=*`;

    const response = await fetch(batchUrl, {
      headers: {
        'User-Agent': 'VintagePosterGallery/1.0 (https://vintage-poster-gallery.vercel.app)',
      },
    });

    if (response.ok) {
      const data = await response.json();
      const pages = data.query?.pages || {};

      for (const pageId in pages) {
        const page = pages[pageId];
        if (page.title && (page.extract || page.description)) {
          const description = [
            page.description || '',
            page.extract || ''
          ].filter(Boolean).join(' ');
          summaries.set(page.title, description);
        }
      }
    }
  } catch (error) {
    console.log('Failed to batch fetch Wikipedia summaries:', error);
  }

  return summaries;
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

    // Fetch summaries for all candidates to enable description-based scoring
    const summaries = await fetchWikipediaSummaries(titles);

    // Build candidates with descriptions
    const candidates: WikipediaCandidate[] = titles.map((title, index) => ({
      title,
      url: urls[index],
      description: summaries.get(title),
      score: 0,
    }));

    // Score all candidates and find the best match
    // REQUIRE positive profession keywords - don't accept matches without them
    let bestCandidate: WikipediaCandidate | null = null;
    let bestScore = -Infinity;
    let bestHasProfessionMatch = false;

    for (const candidate of candidates) {
      // Skip disambiguation pages
      if (candidate.title.toLowerCase().includes('(disambiguation)')) {
        continue;
      }

      const result = calculateMatchScore(candidate, name, type);
      candidate.score = result.score;

      // Only consider candidates with profession keywords OR better score than current best
      if (result.score > bestScore) {
        bestScore = result.score;
        bestCandidate = candidate;
        bestHasProfessionMatch = result.hasProfessionMatch;
      }
    }

    // REQUIRE: Must have positive profession match AND positive score
    // This prevents matching astrophysicists, politicians, etc. even with name matches
    if (!bestCandidate || bestScore < 0 || !bestHasProfessionMatch) {
      console.log(`No suitable Wikipedia match for "${name}" (score: ${bestScore}, hasProfessionMatch: ${bestHasProfessionMatch})`);
      return null;
    }

    const wikipediaUrl = bestCandidate.url;
    const pageTitle = bestCandidate.title;
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

interface ClaudeResearchData {
  location?: string;
  country?: string;
  foundedYear?: number;
  closedYear?: number;
  bio?: string;
  publicationType?: string;
  ceasedYear?: number;
  nationality?: string;
  birthYear?: number;
  deathYear?: number;
}

/**
 * Use Claude AI to research an entity when Wikipedia search fails
 * Uses Haiku for fast, cheap research queries
 */
async function researchWithClaude(
  name: string,
  type: 'printer' | 'publisher' | 'artist'
): Promise<ClaudeResearchData | null> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('No Anthropic API key - skipping Claude research');
    return null;
  }

  try {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    let prompt = '';
    if (type === 'printer') {
      prompt = `Research this historical printing company: "${name}"

Provide information about this lithography/printing company. If the name includes a location (e.g., "Company, Cleveland, Ohio"), extract that location.

Return ONLY valid JSON with these fields (use null for unknown):
{
  "location": "city or city, state",
  "country": "country name",
  "foundedYear": year as number or null,
  "closedYear": year as number or null if still operating or unknown,
  "bio": "1-2 sentence description of the company and what they printed"
}

If you don't have specific information about this company, still try to extract location from the name and provide a generic description based on the company type.`;
    } else if (type === 'publisher') {
      prompt = `Research this publication/publisher: "${name}"

Provide information about this magazine, newspaper, or publishing company.

Return ONLY valid JSON with these fields (use null for unknown):
{
  "publicationType": "Magazine" or "Newspaper" or "Journal" or "Book Publisher",
  "country": "country name",
  "foundedYear": year as number or null,
  "ceasedYear": year as number or null if still publishing,
  "bio": "1-2 sentence description of the publication"
}`;
    } else {
      prompt = `Research this artist/illustrator: "${name}"

Provide information about this artist, particularly if they were a poster artist, illustrator, or commercial artist.

Return ONLY valid JSON with these fields (use null for unknown):
{
  "nationality": "nationality",
  "birthYear": year as number or null,
  "deathYear": year as number or null if still living or unknown,
  "bio": "1-2 sentence description of the artist and their work"
}`;
    }

    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });

    const textContent = response.content.find(block => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      return null;
    }

    // Extract JSON from response
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.log('No JSON found in Claude response');
      return null;
    }

    const data = JSON.parse(jsonMatch[0]) as ClaudeResearchData;
    console.log(`Claude research for ${type} "${name}":`, data);
    return data;
  } catch (error) {
    console.error('Claude research error:', error);
    return null;
  }
}

/**
 * Find or create a printer record, auto-fetching Wikipedia data if creating new
 * Also updates existing records if they have incomplete data (no Wikipedia URL)
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
    // First, check for exact name match (prioritize over alias match)
    let existingResult = await sql`
      SELECT id, name, location, country, founded_year, wikipedia_url, bio, image_url FROM printers
      WHERE LOWER(name) = LOWER(${printerName})
      LIMIT 1
    `;

    // If no exact name match, check aliases
    if (existingResult.rows.length === 0) {
      existingResult = await sql`
        SELECT id, name, location, country, founded_year, wikipedia_url, bio, image_url FROM printers
        WHERE ${printerName} = ANY(aliases)
        LIMIT 1
      `;
    }

    if (existingResult.rows.length > 0) {
      const existing = existingResult.rows[0];

      // Check if the existing record is incomplete (no Wikipedia data)
      const isIncomplete = !existing.wikipedia_url &&
                          !existing.location &&
                          !existing.country &&
                          !existing.founded_year &&
                          !existing.bio;

      // Check if the existing record has SUSPICIOUS data (wrong profession in bio)
      const bioLower = (existing.bio || '').toLowerCase();
      const hasSuspiciousProfession = NEGATIVE_KEYWORDS.some(kw => bioLower.includes(kw));

      if (isIncomplete || hasSuspiciousProfession) {
        if (hasSuspiciousProfession) {
          console.log(`Existing printer "${printerName}" has suspicious profession in bio, re-validating...`);
        } else {
          console.log(`Existing printer "${printerName}" has incomplete data, fetching Wikipedia...`);
        }

        // Try to fetch Wikipedia data with the NEW stricter validation
        const wikiData = await searchWikipedia(printerName, 'printer');

        let location = wikiData?.location;
        let country = wikiData?.country;
        let foundedYear = wikiData?.foundedYear;
        let closedYear = wikiData?.closedYear;
        let bio = wikiData?.description;
        let wikipediaUrl = wikiData?.wikipediaUrl;
        let imageUrl = wikiData?.imageUrl;

        // If Wikipedia didn't find a VALID match, try Claude AI research
        if (!wikiData || (!wikiData.location && !wikiData.country && !wikiData.foundedYear)) {
          console.log(`Wikipedia search failed for "${printerName}", trying Claude research...`);
          const claudeData = await researchWithClaude(printerName, 'printer');
          if (claudeData) {
            location = location || claudeData.location;
            country = country || claudeData.country;
            foundedYear = foundedYear || claudeData.foundedYear;
            closedYear = closedYear || claudeData.closedYear;
            bio = bio || claudeData.bio;
          }
        }

        // Auto-create country in managed list if found
        if (country) {
          country = await findOrCreateCountry(country) || country;
        }

        // If suspicious record and no valid Wikipedia match found, CLEAR the bad data
        if (hasSuspiciousProfession && !wikiData) {
          console.log(`Clearing suspicious Wikipedia data for printer "${printerName}"`);
          await sql`
            UPDATE printers SET
              wikipedia_url = NULL,
              bio = ${bio || null},
              location = ${location || null},
              country = ${country || null},
              founded_year = ${foundedYear || null},
              closed_year = ${closedYear || null},
              image_url = NULL,
              verified = false,
              updated_at = NOW()
            WHERE id = ${existing.id}
          `;
        } else if (location || country || foundedYear || bio || wikipediaUrl) {
          // Update the existing record with the fetched data
          await sql`
            UPDATE printers SET
              location = COALESCE(${location || null}, location),
              country = COALESCE(${country || null}, country),
              founded_year = COALESCE(${foundedYear || null}, founded_year),
              closed_year = COALESCE(${closedYear || null}, closed_year),
              wikipedia_url = COALESCE(${wikipediaUrl || null}, wikipedia_url),
              bio = COALESCE(${bio || null}, bio),
              image_url = COALESCE(${imageUrl || null}, image_url),
              verified = ${wikipediaUrl ? true : false} OR verified,
              updated_at = NOW()
            WHERE id = ${existing.id}
          `;
          console.log(`Updated printer "${printerName}" with Wikipedia/Claude data`);
        }
      }

      return {
        printerId: existing.id,
        isNew: false,
      };
    }

    // Not found - create new printer
    console.log(`Creating new printer: ${printerName}`);

    // First try Wikipedia
    const wikiData = await searchWikipedia(printerName, 'printer');

    let location = wikiData?.location;
    let country = wikiData?.country;
    let foundedYear = wikiData?.foundedYear;
    let closedYear = wikiData?.closedYear;
    let bio = wikiData?.description;
    let wikipediaUrl = wikiData?.wikipediaUrl;
    let imageUrl = wikiData?.imageUrl;

    // If Wikipedia didn't find data, try Claude AI research
    if (!wikiData || (!wikiData.location && !wikiData.country && !wikiData.foundedYear)) {
      console.log(`Wikipedia search failed for "${printerName}", trying Claude research...`);
      const claudeData = await researchWithClaude(printerName, 'printer');
      if (claudeData) {
        location = location || claudeData.location;
        country = country || claudeData.country;
        foundedYear = foundedYear || claudeData.foundedYear;
        closedYear = closedYear || claudeData.closedYear;
        bio = bio || claudeData.bio;
      }
    }

    // Auto-create country in managed list if found
    if (country) {
      country = await findOrCreateCountry(country) || country;
    }

    // Insert new printer
    const insertResult = await sql`
      INSERT INTO printers (name, location, country, founded_year, closed_year, wikipedia_url, bio, image_url, verified)
      VALUES (
        ${printerName},
        ${location || null},
        ${country || null},
        ${foundedYear || null},
        ${closedYear || null},
        ${wikipediaUrl || null},
        ${bio || null},
        ${imageUrl || null},
        ${wikipediaUrl ? true : false}
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
 * Also updates existing records if they have incomplete data (no Wikipedia URL)
 * Returns the publisher ID for linking
 */
export async function findOrCreatePublisher(
  publicationName: string
): Promise<{ publisherId: number; isNew: boolean } | null> {
  if (!publicationName) {
    return null;
  }

  try {
    // First, check for exact name match (prioritize over alias match)
    let existingResult = await sql`
      SELECT id, name, publication_type, country, founded_year, wikipedia_url, bio, image_url FROM publishers
      WHERE LOWER(name) = LOWER(${publicationName})
      LIMIT 1
    `;

    // If no exact name match, check aliases
    if (existingResult.rows.length === 0) {
      existingResult = await sql`
        SELECT id, name, publication_type, country, founded_year, wikipedia_url, bio, image_url FROM publishers
        WHERE ${publicationName} = ANY(aliases)
        LIMIT 1
      `;
    }

    if (existingResult.rows.length > 0) {
      const existing = existingResult.rows[0];

      // Check if the existing record is incomplete (no Wikipedia data)
      const isIncomplete = !existing.wikipedia_url &&
                          !existing.publication_type &&
                          !existing.country &&
                          !existing.founded_year &&
                          !existing.bio;

      if (isIncomplete) {
        console.log(`Existing publisher "${publicationName}" has incomplete data, fetching Wikipedia...`);

        // Try to fetch Wikipedia data for the existing incomplete record
        const wikiData = await searchWikipedia(publicationName, 'publisher');

        let publicationType = wikiData?.publicationType;
        let country = wikiData?.country;
        let foundedYear = wikiData?.foundedYear;
        let ceasedYear = wikiData?.ceasedYear;
        let bio = wikiData?.description;
        let wikipediaUrl = wikiData?.wikipediaUrl;
        let imageUrl = wikiData?.imageUrl;

        // If Wikipedia didn't find data, try Claude AI research
        if (!wikiData || (!wikiData.publicationType && !wikiData.country && !wikiData.foundedYear)) {
          console.log(`Wikipedia search failed for "${publicationName}", trying Claude research...`);
          const claudeData = await researchWithClaude(publicationName, 'publisher');
          if (claudeData) {
            publicationType = publicationType || claudeData.publicationType;
            country = country || claudeData.country;
            foundedYear = foundedYear || claudeData.foundedYear;
            ceasedYear = ceasedYear || claudeData.ceasedYear;
            bio = bio || claudeData.bio;
          }
        }

        // Auto-create country in managed list if found
        if (country) {
          country = await findOrCreateCountry(country) || country;
        }

        // Update the existing record with the fetched data
        if (publicationType || country || foundedYear || bio || wikipediaUrl) {
          await sql`
            UPDATE publishers SET
              publication_type = COALESCE(${publicationType || null}, publication_type),
              country = COALESCE(${country || null}, country),
              founded_year = COALESCE(${foundedYear || null}, founded_year),
              ceased_year = COALESCE(${ceasedYear || null}, ceased_year),
              wikipedia_url = COALESCE(${wikipediaUrl || null}, wikipedia_url),
              bio = COALESCE(${bio || null}, bio),
              image_url = COALESCE(${imageUrl || null}, image_url),
              verified = ${wikipediaUrl ? true : false} OR verified,
              updated_at = NOW()
            WHERE id = ${existing.id}
          `;
          console.log(`Updated publisher "${publicationName}" with Wikipedia/Claude data`);
        }
      }

      return {
        publisherId: existing.id,
        isNew: false,
      };
    }

    // Not found - create new publisher
    console.log(`Creating new publisher: ${publicationName}`);

    // First try Wikipedia
    const wikiData = await searchWikipedia(publicationName, 'publisher');

    let publicationType = wikiData?.publicationType;
    let country = wikiData?.country;
    let foundedYear = wikiData?.foundedYear;
    let ceasedYear = wikiData?.ceasedYear;
    let bio = wikiData?.description;
    let wikipediaUrl = wikiData?.wikipediaUrl;
    let imageUrl = wikiData?.imageUrl;

    // If Wikipedia didn't find data, try Claude AI research
    if (!wikiData || (!wikiData.publicationType && !wikiData.country && !wikiData.foundedYear)) {
      console.log(`Wikipedia search failed for "${publicationName}", trying Claude research...`);
      const claudeData = await researchWithClaude(publicationName, 'publisher');
      if (claudeData) {
        publicationType = publicationType || claudeData.publicationType;
        country = country || claudeData.country;
        foundedYear = foundedYear || claudeData.foundedYear;
        ceasedYear = ceasedYear || claudeData.ceasedYear;
        bio = bio || claudeData.bio;
      }
    }

    // Auto-create country in managed list if found
    if (country) {
      country = await findOrCreateCountry(country) || country;
    }

    // Insert new publisher
    const insertResult = await sql`
      INSERT INTO publishers (name, publication_type, country, founded_year, ceased_year, wikipedia_url, bio, image_url, verified)
      VALUES (
        ${publicationName},
        ${publicationType || null},
        ${country || null},
        ${foundedYear || null},
        ${ceasedYear || null},
        ${wikipediaUrl || null},
        ${bio || null},
        ${imageUrl || null},
        ${wikipediaUrl ? true : false}
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
 * Also updates existing records if they have incomplete data (no Wikipedia URL)
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
    // First, check for exact name match (prioritize over alias match)
    let existingResult = await sql`
      SELECT id, name, nationality, birth_year, death_year, wikipedia_url, bio, image_url FROM artists
      WHERE LOWER(name) = LOWER(${artistName})
      LIMIT 1
    `;

    // If no exact name match, check aliases
    if (existingResult.rows.length === 0) {
      existingResult = await sql`
        SELECT id, name, nationality, birth_year, death_year, wikipedia_url, bio, image_url FROM artists
        WHERE ${artistName} = ANY(aliases)
        LIMIT 1
      `;
    }

    if (existingResult.rows.length > 0) {
      const existing = existingResult.rows[0];

      // Check if the existing record is incomplete (no Wikipedia data)
      const isIncomplete = !existing.wikipedia_url &&
                          !existing.nationality &&
                          !existing.birth_year &&
                          !existing.bio;

      // Check if the existing record has SUSPICIOUS data (wrong profession in bio)
      // This catches cases like an astrophysicist being linked to a publisher name
      const bioLower = (existing.bio || '').toLowerCase();
      const hasSuspiciousProfession = NEGATIVE_KEYWORDS.some(kw => bioLower.includes(kw));

      if (isIncomplete || hasSuspiciousProfession) {
        if (hasSuspiciousProfession) {
          console.log(`Existing artist "${artistName}" has suspicious profession in bio, re-validating...`);
        } else {
          console.log(`Existing artist "${artistName}" has incomplete data, fetching Wikipedia...`);
        }

        // Try to fetch Wikipedia data with the NEW stricter validation
        const wikiData = await searchWikipedia(artistName, 'artist');

        let nationality = wikiData?.nationality;
        let birthYear = wikiData?.birthYear;
        let deathYear = wikiData?.deathYear;
        let bio = wikiData?.description;
        let wikipediaUrl = wikiData?.wikipediaUrl;
        let imageUrl = wikiData?.imageUrl;

        // If Wikipedia didn't find a VALID match (profession validated), try Claude AI research
        if (!wikiData || (!wikiData.nationality && !wikiData.birthYear)) {
          console.log(`Wikipedia search failed for "${artistName}", trying Claude research...`);
          const claudeData = await researchWithClaude(artistName, 'artist');
          if (claudeData) {
            nationality = nationality || claudeData.nationality;
            birthYear = birthYear || claudeData.birthYear;
            deathYear = deathYear || claudeData.deathYear;
            bio = bio || claudeData.bio;
          }
        }

        // If suspicious record and no valid Wikipedia match found, CLEAR the bad data
        if (hasSuspiciousProfession && !wikiData) {
          console.log(`Clearing suspicious Wikipedia data for "${artistName}"`);
          await sql`
            UPDATE artists SET
              wikipedia_url = NULL,
              bio = ${bio || null},
              nationality = ${nationality || null},
              birth_year = ${birthYear || null},
              death_year = ${deathYear || null},
              image_url = NULL,
              verified = false,
              updated_at = NOW()
            WHERE id = ${existing.id}
          `;
        } else if (nationality || birthYear || bio || wikipediaUrl) {
          // Update the existing record with the fetched data
          await sql`
            UPDATE artists SET
              nationality = COALESCE(${nationality || null}, nationality),
              birth_year = COALESCE(${birthYear || null}, birth_year),
              death_year = COALESCE(${deathYear || null}, death_year),
              wikipedia_url = COALESCE(${wikipediaUrl || null}, wikipedia_url),
              bio = COALESCE(${bio || null}, bio),
              image_url = COALESCE(${imageUrl || null}, image_url),
              verified = ${wikipediaUrl ? true : false} OR verified,
              updated_at = NOW()
            WHERE id = ${existing.id}
          `;
          console.log(`Updated artist "${artistName}" with Wikipedia/Claude data`);
        }
      }

      return {
        artistId: existing.id,
        isNew: false,
      };
    }

    // Not found - create new artist
    console.log(`Creating new artist: ${artistName}`);

    // First try Wikipedia
    const wikiData = await searchWikipedia(artistName, 'artist');

    let nationality = wikiData?.nationality;
    let birthYear = wikiData?.birthYear;
    let deathYear = wikiData?.deathYear;
    let bio = wikiData?.description;
    let wikipediaUrl = wikiData?.wikipediaUrl;
    let imageUrl = wikiData?.imageUrl;

    // If Wikipedia didn't find data, try Claude AI research
    if (!wikiData || (!wikiData.nationality && !wikiData.birthYear)) {
      console.log(`Wikipedia search failed for "${artistName}", trying Claude research...`);
      const claudeData = await researchWithClaude(artistName, 'artist');
      if (claudeData) {
        nationality = nationality || claudeData.nationality;
        birthYear = birthYear || claudeData.birthYear;
        deathYear = deathYear || claudeData.deathYear;
        bio = bio || claudeData.bio;
      }
    }

    // Insert new artist
    const insertResult = await sql`
      INSERT INTO artists (name, nationality, birth_year, death_year, wikipedia_url, bio, image_url, verified)
      VALUES (
        ${artistName},
        ${nationality || null},
        ${birthYear || null},
        ${deathYear || null},
        ${wikipediaUrl || null},
        ${bio || null},
        ${imageUrl || null},
        ${wikipediaUrl ? true : false}
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
 * Find or create a book record for antique prints/plates
 * Returns the book ID for linking
 */
export async function findOrCreateBook(
  bookTitle: string,
  bookAuthor?: string,
  bookYear?: number
): Promise<{ bookId: number; isNew: boolean } | null> {
  if (!bookTitle) {
    return null;
  }

  try {
    // First, check if book already exists by title (case-insensitive)
    const existingResult = await sql`
      SELECT id, title, author, publication_year, wikipedia_url, bio FROM books
      WHERE LOWER(title) = LOWER(${bookTitle})
      LIMIT 1
    `;

    if (existingResult.rows.length > 0) {
      const existing = existingResult.rows[0];

      // Check if the existing record is incomplete (no Wikipedia data and missing author/year)
      const isIncomplete = !existing.wikipedia_url &&
                          !existing.bio &&
                          (!existing.author && bookAuthor) ||
                          (!existing.publication_year && bookYear);

      if (isIncomplete) {
        console.log(`Existing book "${bookTitle}" has incomplete data, updating...`);

        // Update with any new data we have
        await sql`
          UPDATE books SET
            author = COALESCE(${bookAuthor || null}, author),
            publication_year = COALESCE(${bookYear || null}, publication_year),
            updated_at = NOW()
          WHERE id = ${existing.id}
        `;
        console.log(`Updated book "${bookTitle}" with additional data`);
      }

      return {
        bookId: existing.id,
        isNew: false,
      };
    }

    // Not found - create new book
    console.log(`Creating new book: ${bookTitle}`);

    // Insert new book with what we have
    const insertResult = await sql`
      INSERT INTO books (title, author, publication_year, verified)
      VALUES (
        ${bookTitle},
        ${bookAuthor || null},
        ${bookYear || null},
        false
      )
      RETURNING id
    `;

    return {
      bookId: insertResult.rows[0].id,
      isNew: true,
    };
  } catch (error) {
    console.error('Error finding/creating book:', error);
    return null;
  }
}

/**
 * Auto-link a poster to printer, publisher, artist, and book based on analysis results
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
    bookTitle?: string;
    bookAuthor?: string;
    bookYear?: number;
  }
): Promise<{
  artistLinked?: { id: number; isNew: boolean };
  printerLinked?: { id: number; isNew: boolean };
  publisherLinked?: { id: number; isNew: boolean };
  bookLinked?: { id: number; isNew: boolean };
}> {
  const result: {
    artistLinked?: { id: number; isNew: boolean };
    printerLinked?: { id: number; isNew: boolean };
    publisherLinked?: { id: number; isNew: boolean };
    bookLinked?: { id: number; isNew: boolean };
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

  // Auto-link book if book title is identified (for antique prints/plates)
  if (analysis.bookTitle) {
    const bookResult = await findOrCreateBook(
      analysis.bookTitle,
      analysis.bookAuthor,
      analysis.bookYear
    );
    if (bookResult) {
      await sql`
        UPDATE posters SET book_id = ${bookResult.bookId}, last_modified = NOW()
        WHERE id = ${posterId}
      `;
      result.bookLinked = { id: bookResult.bookId, isNew: bookResult.isNew };
    }
  }

  return result;
}
