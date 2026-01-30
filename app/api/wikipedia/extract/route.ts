import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

interface WikipediaExtractedData {
  title?: string;
  description?: string;
  location?: string;
  country?: string;
  foundedYear?: number;
  closedYear?: number;
  // For artists
  nationality?: string;
  birthYear?: number;
  deathYear?: number;
  // For publishers
  publicationType?: string;
  ceasedYear?: number;
}

/**
 * POST /api/wikipedia/extract
 * Extract structured data from a Wikipedia page
 * Body: { url: string, type: 'printer' | 'publisher' | 'artist' }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { url, type } = body;

    if (!url) {
      return NextResponse.json(
        { error: 'Wikipedia URL is required' },
        { status: 400 }
      );
    }

    // Extract the page title from the Wikipedia URL
    const wikiMatch = url.match(/wikipedia\.org\/wiki\/([^#?]+)/);
    if (!wikiMatch) {
      return NextResponse.json(
        { error: 'Invalid Wikipedia URL format' },
        { status: 400 }
      );
    }

    const pageTitle = decodeURIComponent(wikiMatch[1].replace(/_/g, ' '));

    // Fetch page content from Wikipedia API
    const apiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`;
    const summaryResponse = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'VintagePosterGallery/1.0 (https://vintage-poster-gallery.vercel.app)',
      },
    });

    if (!summaryResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch Wikipedia page' },
        { status: 404 }
      );
    }

    const summaryData = await summaryResponse.json();

    // Also fetch the full page content to extract infobox data
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

    // Build the extracted data based on type
    const extractedData: WikipediaExtractedData = {
      title: summaryData.title,
      description: summaryData.extract,
    };

    // Extract type-specific fields
    if (type === 'printer') {
      extractPrinterData(extractedData, infoboxData, summaryData.extract);
    } else if (type === 'publisher') {
      extractPublisherData(extractedData, infoboxData, summaryData.extract);
    } else if (type === 'artist') {
      extractArtistData(extractedData, infoboxData, summaryData.extract);
    }

    return NextResponse.json({
      success: true,
      data: extractedData,
      rawInfobox: infoboxData, // Include for debugging
    });
  } catch (error) {
    console.error('Wikipedia extract error:', error);
    return NextResponse.json(
      { error: 'Failed to extract Wikipedia data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Extract key-value pairs from Wikipedia infobox
 */
function extractInfoboxData(wikitext: string): Record<string, string> {
  const data: Record<string, string> = {};

  // Match infobox content - handles various infobox types
  const infoboxMatch = wikitext.match(/\{\{Infobox[^}]*\n([\s\S]*?)\n\}\}/i);
  if (!infoboxMatch) {
    // Try alternative infobox patterns
    const altMatch = wikitext.match(/\{\{[^}]*box[^}]*\n([\s\S]*?)\n\}\}/i);
    if (!altMatch) return data;
  }

  const infoboxContent = infoboxMatch ? infoboxMatch[1] : '';

  // Extract key-value pairs from infobox
  const lines = infoboxContent.split('\n');
  for (const line of lines) {
    const match = line.match(/\|\s*([^=]+?)\s*=\s*(.+)/);
    if (match) {
      const key = match[1].trim().toLowerCase().replace(/\s+/g, '_');
      let value = match[2].trim();
      // Clean up wiki markup
      value = cleanWikiMarkup(value);
      if (value) {
        data[key] = value;
      }
    }
  }

  return data;
}

/**
 * Clean wiki markup from text
 */
function cleanWikiMarkup(text: string): string {
  return text
    // Remove [[link|display]] -> display, [[link]] -> link
    .replace(/\[\[([^|\]]*\|)?([^\]]+)\]\]/g, '$2')
    // Remove {{templates}}
    .replace(/\{\{[^}]+\}\}/g, '')
    // Remove HTML tags
    .replace(/<[^>]+>/g, '')
    // Remove ref tags and content
    .replace(/<ref[^>]*>.*?<\/ref>/g, '')
    .replace(/<ref[^>]*\/>/g, '')
    // Clean up extra whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract a year from text
 */
function extractYear(text: string): number | undefined {
  if (!text) return undefined;
  // Match 4-digit year
  const yearMatch = text.match(/\b(1[5-9]\d{2}|20[0-2]\d)\b/);
  return yearMatch ? parseInt(yearMatch[1]) : undefined;
}

/**
 * Extract printer-specific data
 */
function extractPrinterData(
  data: WikipediaExtractedData,
  infobox: Record<string, string>,
  extract: string
): void {
  // Location fields (various possible names in infoboxes)
  const locationFields = ['location', 'headquarters', 'location_city', 'city', 'hq_location', 'place'];
  for (const field of locationFields) {
    if (infobox[field]) {
      data.location = infobox[field];
      break;
    }
  }

  // Country fields
  const countryFields = ['country', 'location_country', 'hq_country', 'nation'];
  for (const field of countryFields) {
    if (infobox[field]) {
      data.country = infobox[field];
      break;
    }
  }

  // Founded year
  const foundedFields = ['founded', 'foundation', 'established', 'formed', 'opened'];
  for (const field of foundedFields) {
    if (infobox[field]) {
      data.foundedYear = extractYear(infobox[field]);
      if (data.foundedYear) break;
    }
  }

  // Closed year (for defunct companies)
  const closedFields = ['defunct', 'closed', 'dissolved', 'fate'];
  for (const field of closedFields) {
    if (infobox[field]) {
      data.closedYear = extractYear(infobox[field]);
      if (data.closedYear) break;
    }
  }

  // Try to extract from text if not in infobox
  if (!data.foundedYear) {
    const foundedMatch = extract.match(/(?:founded|established|opened)\s+(?:in\s+)?(\d{4})/i);
    if (foundedMatch) {
      data.foundedYear = parseInt(foundedMatch[1]);
    }
  }

  // Extract location from text if not in infobox
  if (!data.location && !data.country) {
    // Common patterns like "based in Rome, Italy" or "a French printing company"
    const locationMatch = extract.match(/(?:based in|located in|in)\s+([^,\.]+(?:,\s*[^,\.]+)?)/i);
    if (locationMatch) {
      const parts = locationMatch[1].split(',').map(s => s.trim());
      if (parts.length >= 2) {
        data.location = parts[0];
        data.country = parts[1];
      } else {
        data.location = parts[0];
      }
    }

    // Try nationality patterns
    const nationalityMatch = extract.match(/(?:was\s+)?(?:an?\s+)?(Italian|French|German|American|British|Spanish|Dutch|Belgian|Swiss|Austrian|Japanese|Chinese)\s+(?:printing|lithograph|poster)/i);
    if (nationalityMatch && !data.country) {
      data.country = nationalityMatch[1];
    }
  }
}

/**
 * Extract publisher-specific data
 */
function extractPublisherData(
  data: WikipediaExtractedData,
  infobox: Record<string, string>,
  extract: string
): void {
  // Publication type
  const typeFields = ['type', 'format', 'category'];
  for (const field of typeFields) {
    if (infobox[field]) {
      data.publicationType = infobox[field];
      break;
    }
  }

  // Country
  const countryFields = ['country', 'location_country', 'hq_country', 'based'];
  for (const field of countryFields) {
    if (infobox[field]) {
      data.country = infobox[field];
      break;
    }
  }

  // Founded year
  const foundedFields = ['founded', 'first_issue', 'firstdate', 'publication_date', 'established'];
  for (const field of foundedFields) {
    if (infobox[field]) {
      data.foundedYear = extractYear(infobox[field]);
      if (data.foundedYear) break;
    }
  }

  // Ceased year
  const ceasedFields = ['final_issue', 'finaldate', 'ceased_publication', 'defunct', 'last_issue'];
  for (const field of ceasedFields) {
    if (infobox[field]) {
      data.ceasedYear = extractYear(infobox[field]);
      if (data.ceasedYear) break;
    }
  }

  // Infer publication type from extract if not found
  if (!data.publicationType) {
    if (extract.match(/\bmagazine\b/i)) {
      data.publicationType = 'Magazine';
    } else if (extract.match(/\bnewspaper\b/i)) {
      data.publicationType = 'Newspaper';
    } else if (extract.match(/\bjournal\b/i)) {
      data.publicationType = 'Journal';
    } else if (extract.match(/\bbook publisher\b/i)) {
      data.publicationType = 'Book Publisher';
    }
  }

  // Try to extract country from text
  if (!data.country) {
    const countryMatch = extract.match(/(?:American|United States|US|British|French|German|Italian|Japanese)\s+(?:magazine|newspaper|publication)/i);
    if (countryMatch) {
      const countryMap: Record<string, string> = {
        'american': 'United States',
        'united states': 'United States',
        'us': 'United States',
        'british': 'United Kingdom',
        'french': 'France',
        'german': 'Germany',
        'italian': 'Italy',
        'japanese': 'Japan',
      };
      const match = countryMatch[0].toLowerCase();
      for (const [key, value] of Object.entries(countryMap)) {
        if (match.includes(key)) {
          data.country = value;
          break;
        }
      }
    }
  }
}

/**
 * Extract artist-specific data
 */
function extractArtistData(
  data: WikipediaExtractedData,
  infobox: Record<string, string>,
  extract: string
): void {
  // Nationality
  const nationalityFields = ['nationality', 'citizenship', 'birth_place', 'country'];
  for (const field of nationalityFields) {
    if (infobox[field]) {
      data.nationality = infobox[field];
      break;
    }
  }

  // Birth year
  const birthFields = ['birth_date', 'born', 'birth_year'];
  for (const field of birthFields) {
    if (infobox[field]) {
      data.birthYear = extractYear(infobox[field]);
      if (data.birthYear) break;
    }
  }

  // Death year
  const deathFields = ['death_date', 'died', 'death_year'];
  for (const field of deathFields) {
    if (infobox[field]) {
      data.deathYear = extractYear(infobox[field]);
      if (data.deathYear) break;
    }
  }

  // Extract from text if not in infobox
  if (!data.birthYear || !data.deathYear) {
    // Pattern like "(1875-1942)" or "(born 1875, died 1942)"
    const datesMatch = extract.match(/\((\d{4})\s*[-–—]\s*(\d{4})\)/);
    if (datesMatch) {
      if (!data.birthYear) data.birthYear = parseInt(datesMatch[1]);
      if (!data.deathYear) data.deathYear = parseInt(datesMatch[2]);
    }
  }

  // Extract nationality from text
  if (!data.nationality) {
    const nationalityMatch = extract.match(/(?:was\s+)?(?:an?\s+)?(Italian|French|German|American|British|Spanish|Dutch|Belgian|Swiss|Austrian|Polish|Czech|Hungarian|Russian|Japanese|Chinese|Mexican|Brazilian|Argentine|Australian|Canadian|Irish|Scottish|Welsh|Swedish|Norwegian|Danish|Finnish|Portuguese|Greek|Turkish|Indian|Korean|Vietnamese|Thai|Indonesian|Filipino|Egyptian|South African|Nigerian|Kenyan|New Zealand|Cuban|Colombian|Venezuelan|Chilean|Peruvian|Uruguayan)\b/i);
    if (nationalityMatch) {
      data.nationality = nationalityMatch[1];
    }
  }
}
