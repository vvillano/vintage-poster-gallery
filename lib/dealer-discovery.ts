/**
 * AI-Assisted Dealer Discovery
 *
 * Helps discover new dealers internationally using:
 * 1. Localized search queries in native languages
 * 2. AI extraction of dealer information from search results
 * 3. Automatic search URL template detection
 */

import Anthropic from '@anthropic-ai/sdk';
import { generateDealerDiscoveryQuery, DEALER_DISCOVERY_TEMPLATES, REGION_NAMES } from './query-generator';
import type { Dealer, DealerType, DealerSpecialization } from '@/types/dealer';

export interface DiscoveredDealer {
  name: string;
  website: string;
  country: string;
  city?: string;
  region: string;
  type: DealerType;
  specializations: DealerSpecialization[];
  searchUrlTemplate?: string;
  confidence: number;
  description?: string;
  alreadyExists?: boolean;
}

export interface DiscoverySearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface DiscoveryOptions {
  region: string;
  dealerType: DealerType;
  language: string;
  maxResults?: number;
}

export interface DiscoveryResponse {
  query: string;
  suggestions: DiscoveredDealer[];
  errors?: string[];
}

/**
 * Get available regions for discovery
 */
export function getAvailableRegions(): { value: string; label: string }[] {
  return Object.keys(REGION_NAMES).map(key => ({
    value: key,
    label: REGION_NAMES[key].en,
  }));
}

/**
 * Get available dealer types for discovery
 */
export function getAvailableDealerTypes(): { value: string; label: string }[] {
  return Object.keys(DEALER_DISCOVERY_TEMPLATES).map(key => ({
    value: key,
    label: key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
  }));
}

/**
 * Get available languages for discovery
 */
export function getAvailableLanguages(): { value: string; label: string }[] {
  return [
    { value: 'en', label: 'English' },
    { value: 'fr', label: 'French' },
    { value: 'de', label: 'German' },
    { value: 'it', label: 'Italian' },
    { value: 'es', label: 'Spanish' },
    { value: 'nl', label: 'Dutch' },
    { value: 'ja', label: 'Japanese' },
    { value: 'zh', label: 'Chinese' },
  ];
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * Use AI to extract dealer information from search results
 */
export async function extractDealersFromSearchResults(
  searchResults: DiscoverySearchResult[],
  options: DiscoveryOptions,
  existingDomains: Set<string>
): Promise<DiscoveredDealer[]> {
  if (searchResults.length === 0) {
    return [];
  }

  const anthropic = new Anthropic();

  const dealerTypeLabel = options.dealerType.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  const regionLabel = REGION_NAMES[options.region.toLowerCase()]?.en || options.region;

  const prompt = `You are analyzing search results to identify legitimate vintage/antique dealers and galleries.

SEARCH CONTEXT:
- Looking for: ${dealerTypeLabel}s
- Region: ${regionLabel}
- Language used: ${options.language}

SEARCH RESULTS:
${searchResults.map((r, i) => `
[Result ${i + 1}]
Title: ${r.title}
URL: ${r.url}
Snippet: ${r.snippet}
`).join('\n')}

For each result that appears to be a legitimate dealer/gallery business (NOT a marketplace listing, news article, or directory page), extract:
1. Business name
2. Website domain
3. City (if mentioned)
4. Business type (one of: auction_house, poster_dealer, book_dealer, print_dealer, map_dealer, ephemera_dealer, photography_dealer, gallery, marketplace, aggregator, museum)
5. Specializations (any of: movie_posters, travel, advertising, circus, theater, music, sports, art_deco, art_nouveau, modernist, victorian, wwi, wwii, propaganda, civil_war, belle_epoque, french, italian, american, british, german, japanese, swiss, lithography, chromolithography, screenprint, offset, woodcut, engraving, natural_history, botanical, ornithology, maps, atlases, illustrated_books)
6. Confidence (0-100) that this is a legitimate dealer

Return a JSON array:
[
  {
    "name": "Dealer Name",
    "website": "https://example.com",
    "city": "Paris" or null,
    "type": "poster_dealer",
    "specializations": ["french", "art_nouveau"],
    "confidence": 85,
    "description": "Brief description of what they sell"
  }
]

Only include businesses that appear to be actual dealers/galleries. Skip:
- General marketplace listings (eBay, Etsy individual listings)
- News articles or blog posts
- Directory pages listing multiple dealers
- Social media pages
- Results that don't have a clear business website`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      return [];
    }

    // Find JSON array in response
    const jsonMatch = textContent.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      name: string;
      website: string;
      city?: string;
      type: string;
      specializations: string[];
      confidence: number;
      description?: string;
    }[];

    // Map to DiscoveredDealer format
    return parsed.map(p => {
      const domain = extractDomain(p.website);
      return {
        name: p.name,
        website: p.website.startsWith('http') ? p.website : `https://${p.website}`,
        country: REGION_NAMES[options.region.toLowerCase()]?.en || options.region,
        city: p.city,
        region: mapRegionToCategory(options.region),
        type: p.type as DealerType,
        specializations: p.specializations as DealerSpecialization[],
        confidence: p.confidence,
        description: p.description,
        alreadyExists: existingDomains.has(domain),
      };
    });
  } catch (error) {
    console.error('Error extracting dealers with AI:', error);
    return [];
  }
}

/**
 * Map country/region name to geographic category
 */
function mapRegionToCategory(region: string): string {
  const regionLower = region.toLowerCase();

  const northAmerica = ['usa', 'canada', 'mexico'];
  const europe = ['france', 'germany', 'italy', 'spain', 'uk', 'netherlands', 'switzerland', 'belgium', 'austria'];
  const asia = ['japan', 'china', 'korea', 'taiwan', 'singapore'];

  if (northAmerica.includes(regionLower)) return 'North America';
  if (europe.includes(regionLower)) return 'Europe';
  if (asia.includes(regionLower)) return 'Asia';

  return 'Global';
}

/**
 * Try to discover the search URL template for a dealer website
 */
export async function discoverSearchUrlTemplate(website: string): Promise<string | null> {
  // Common search URL patterns to try
  const patterns = [
    '/search?q={query}',
    '/search?query={query}',
    '/search?s={query}',
    '/?s={query}',
    '/recherche?q={query}',
    '/suche?q={query}',
    '/cerca?q={query}',
    '/buscar?q={query}',
  ];

  // For now, return common pattern - in production would actually test URLs
  // This is a placeholder for future implementation that would:
  // 1. Fetch the website homepage
  // 2. Look for search form
  // 3. Extract the search URL pattern

  return null; // Will need manual entry or future enhancement
}

/**
 * Check which domains already exist in the dealer database
 */
export function checkExistingDealers(
  discoveredDealers: DiscoveredDealer[],
  existingDealers: { website: string | null }[]
): DiscoveredDealer[] {
  const existingDomains = new Set(
    existingDealers
      .filter(d => d.website)
      .map(d => extractDomain(d.website!))
  );

  return discoveredDealers.map(d => ({
    ...d,
    alreadyExists: existingDomains.has(extractDomain(d.website)),
  }));
}

/**
 * Generate discovery query preview
 */
export function generateDiscoveryQueryPreview(options: DiscoveryOptions): string {
  return generateDealerDiscoveryQuery(options.dealerType, options.region, options.language);
}
