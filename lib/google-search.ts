/**
 * Google Custom Search API Integration
 *
 * Enables searching across multiple dealer sites in a single API call.
 * Falls back gracefully if API credentials are not configured.
 */

export interface GoogleSearchResult {
  title: string;
  url: string;
  snippet: string;
  domain: string;
  displayLink: string;
}

export interface GoogleSearchResponse {
  results: GoogleSearchResult[];
  totalResults: number;
  searchTime: number;
  creditsUsed: number;
  error?: string;
}

/**
 * Check if Google Custom Search is configured
 */
export function isGoogleSearchConfigured(): boolean {
  return !!(
    process.env.GOOGLE_CSE_API_KEY &&
    process.env.GOOGLE_CSE_ID
  );
}

/**
 * Get configuration status for display in UI
 */
export function getGoogleSearchStatus(): {
  configured: boolean;
  apiKeySet: boolean;
  searchEngineIdSet: boolean;
} {
  return {
    configured: isGoogleSearchConfigured(),
    apiKeySet: !!process.env.GOOGLE_CSE_API_KEY,
    searchEngineIdSet: !!process.env.GOOGLE_CSE_ID,
  };
}

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * Build site restriction string for Google search
 * Example: "site:ha.com OR site:christies.com OR site:sothebys.com"
 */
export function buildSiteRestriction(domains: string[]): string {
  if (domains.length === 0) return '';
  return domains.map(d => `site:${d}`).join(' OR ');
}

/**
 * Search using Google Custom Search API
 *
 * @param query - Search query
 * @param options - Search options
 * @returns Search results
 */
export async function googleSearch(
  query: string,
  options: {
    domains?: string[];  // Restrict to specific domains
    maxResults?: number; // Max 10 per request (API limit)
    startIndex?: number; // For pagination (1-based)
  } = {}
): Promise<GoogleSearchResponse> {
  const { domains = [], maxResults = 10, startIndex = 1 } = options;

  // Check configuration
  if (!isGoogleSearchConfigured()) {
    return {
      results: [],
      totalResults: 0,
      searchTime: 0,
      creditsUsed: 0,
      error: 'Google Custom Search is not configured. Add GOOGLE_CSE_API_KEY and GOOGLE_CSE_ID to environment variables.',
    };
  }

  const apiKey = process.env.GOOGLE_CSE_API_KEY!;
  const searchEngineId = process.env.GOOGLE_CSE_ID!;

  // Build query with site restrictions
  let fullQuery = query;
  if (domains.length > 0) {
    const siteRestriction = buildSiteRestriction(domains);
    fullQuery = `${query} (${siteRestriction})`;
  }

  // Build API URL
  const params = new URLSearchParams({
    key: apiKey,
    cx: searchEngineId,
    q: fullQuery,
    num: Math.min(maxResults, 10).toString(), // API max is 10
    start: startIndex.toString(),
  });

  const apiUrl = `https://www.googleapis.com/customsearch/v1?${params}`;

  try {
    const startTime = Date.now();
    const response = await fetch(apiUrl);
    const searchTime = (Date.now() - startTime) / 1000;

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || `API error: ${response.status}`;

      // Check for quota exceeded
      if (response.status === 429 || errorMessage.includes('quota')) {
        return {
          results: [],
          totalResults: 0,
          searchTime,
          creditsUsed: 0,
          error: 'Daily API quota exceeded. Try again tomorrow or upgrade your plan.',
        };
      }

      return {
        results: [],
        totalResults: 0,
        searchTime,
        creditsUsed: 1,
        error: errorMessage,
      };
    }

    const data = await response.json();

    // Parse results
    const results: GoogleSearchResult[] = (data.items || []).map((item: any) => ({
      title: item.title || '',
      url: item.link || '',
      snippet: item.snippet || '',
      domain: extractDomain(item.link || ''),
      displayLink: item.displayLink || '',
    }));

    return {
      results,
      totalResults: parseInt(data.searchInformation?.totalResults || '0'),
      searchTime: parseFloat(data.searchInformation?.searchTime || '0'),
      creditsUsed: 1,
    };
  } catch (error) {
    console.error('Google Search API error:', error);
    return {
      results: [],
      totalResults: 0,
      searchTime: 0,
      creditsUsed: 0,
      error: error instanceof Error ? error.message : 'Search failed',
    };
  }
}

/**
 * Search with multiple queries and combine results
 * Useful for searching with query variations
 */
export async function googleSearchMultiple(
  queries: string[],
  options: {
    domains?: string[];
    maxResultsPerQuery?: number;
  } = {}
): Promise<{
  results: GoogleSearchResult[];
  totalCreditsUsed: number;
  errors: string[];
}> {
  const { domains = [], maxResultsPerQuery = 10 } = options;
  const allResults: GoogleSearchResult[] = [];
  const seenUrls = new Set<string>();
  const errors: string[] = [];
  let totalCreditsUsed = 0;

  for (const query of queries) {
    const response = await googleSearch(query, {
      domains,
      maxResults: maxResultsPerQuery,
    });

    totalCreditsUsed += response.creditsUsed;

    if (response.error) {
      errors.push(`Query "${query}": ${response.error}`);
      continue;
    }

    // Deduplicate by URL
    for (const result of response.results) {
      if (!seenUrls.has(result.url)) {
        seenUrls.add(result.url);
        allResults.push(result);
      }
    }
  }

  return {
    results: allResults,
    totalCreditsUsed,
    errors,
  };
}

/**
 * Get dealer domains from database for search restriction
 */
export async function getDealerDomains(): Promise<string[]> {
  // This will be implemented to fetch from dealers table
  // For now, return a static list of known dealer domains
  const knownDomains = [
    // Tier 1: Major Auction Houses
    'ha.com',
    'sothebys.com',
    'christies.com',
    'swanngalleries.com',
    'bonhams.com',
    // Tier 2: Poster Dealers
    'goldenageposters.com',
    'posteritati.com',
    'rennertsgallery.com',
    'internationalposter.com',
    'filmartgallery.com',
    'rossartgroup.com',
    'laffichiste.com',
    'galerie123.com',
    // Tier 2: Print/Book Dealers
    'baumanrarebooks.com',
    'peterharrington.co.uk',
    'oldprintshop.com',
    'aradergalleries.com',
    // Tier 4: Marketplaces
    'rubylane.com',
    '1stdibs.com',
    // Tier 5: Aggregators
    'liveauctioneers.com',
    'invaluable.com',
    'barnebys.com',
    'abebooks.com',
  ];

  return knownDomains;
}
