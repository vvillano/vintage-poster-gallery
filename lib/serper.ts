/**
 * Serper.dev API Integration
 *
 * Provides Google Search and Google Lens (image search) capabilities.
 * Replaces Google Custom Search with a more affordable, feature-rich API.
 *
 * Features:
 * - Web search (Google search results)
 * - Image search (Google Lens - visual search)
 * - Reverse image search
 *
 * Pricing: ~$0.30-1.00 per 1000 searches (10x cheaper than Google CSE)
 * Free tier: 2,500 credits to start
 */

// Re-export types that are compatible with existing code
export interface SerperSearchResult {
  title: string;
  url: string;
  snippet: string;
  domain: string;
  displayLink: string;
  // Additional fields from Serper
  position?: number;
  date?: string; // Publication date if available
  sitelinks?: { title: string; link: string }[];
}

export interface SerperImageResult {
  title: string;
  imageUrl: string;
  thumbnailUrl?: string;
  sourceUrl: string;
  source: string; // Domain/site name
  width?: number;
  height?: number;
}

export interface SerperLensResult {
  title: string;
  url: string;
  source: string;
  thumbnail?: string;
  price?: string; // Some results include price
}

export interface SerperSearchResponse {
  results: SerperSearchResult[];
  totalResults: number;
  searchTime: number;
  creditsUsed: number;
  error?: string;
  // Additional metadata
  searchParameters?: {
    query: string;
    type: string;
    page: number;
  };
}

export interface SerperImageSearchResponse {
  results: SerperImageResult[];
  searchTime: number;
  creditsUsed: number;
  error?: string;
}

export interface SerperLensResponse {
  results: SerperLensResult[];
  searchTime: number;
  creditsUsed: number;
  error?: string;
  // Visual matches - items that look similar
  visualMatches?: SerperLensResult[];
  // Knowledge graph if identified
  knowledgeGraph?: {
    title?: string;
    type?: string;
    description?: string;
    imageUrl?: string;
  };
}

/**
 * Check if Serper is configured
 */
export function isSerperConfigured(): boolean {
  return !!process.env.SERPER_API_KEY;
}

/**
 * Get configuration status for display in UI
 */
export function getSerperStatus(): {
  configured: boolean;
  apiKeySet: boolean;
} {
  return {
    configured: isSerperConfigured(),
    apiKeySet: !!process.env.SERPER_API_KEY,
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
 * Web search using Serper API
 *
 * @param query - Search query
 * @param options - Search options
 * @returns Search results
 */
export async function serperWebSearch(
  query: string,
  options: {
    domains?: string[]; // Restrict to specific domains (using site: operator)
    maxResults?: number; // Number of results (default 10, max 100)
    page?: number; // Page number for pagination
    country?: string; // Country code (e.g., 'us', 'uk')
  } = {}
): Promise<SerperSearchResponse> {
  const { domains = [], maxResults = 10, page = 1, country = 'us' } = options;

  if (!isSerperConfigured()) {
    return {
      results: [],
      totalResults: 0,
      searchTime: 0,
      creditsUsed: 0,
      error: 'Serper API is not configured. Add SERPER_API_KEY to environment variables.',
    };
  }

  const apiKey = process.env.SERPER_API_KEY!;

  // Build query with site restrictions if provided
  let fullQuery = query;
  if (domains.length > 0) {
    const siteRestriction = domains.map((d) => `site:${d}`).join(' OR ');
    fullQuery = `${query} (${siteRestriction})`;
  }

  console.log('[serper] Web search:', { query: fullQuery.substring(0, 100), num: maxResults });

  try {
    const startTime = Date.now();

    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: fullQuery,
        num: Math.min(maxResults, 100),
        page,
        gl: country,
      }),
    });

    const searchTime = (Date.now() - startTime) / 1000;

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.message || `API error: ${response.status}`;

      if (response.status === 401) {
        return {
          results: [],
          totalResults: 0,
          searchTime,
          creditsUsed: 0,
          error: 'Invalid Serper API key. Check your SERPER_API_KEY.',
        };
      }

      if (response.status === 429) {
        return {
          results: [],
          totalResults: 0,
          searchTime,
          creditsUsed: 0,
          error: 'API rate limit exceeded. Try again later.',
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

    console.log('[serper] Web search response:', {
      organic: data.organic?.length || 0,
      credits: data.credits,
      searchTime,
    });

    // Parse organic results
    const results: SerperSearchResult[] = (data.organic || []).map(
      (item: any, index: number) => ({
        title: item.title || '',
        url: item.link || '',
        snippet: item.snippet || '',
        domain: extractDomain(item.link || ''),
        displayLink: extractDomain(item.link || ''),
        position: item.position || index + 1,
        date: item.date,
        sitelinks: item.sitelinks,
      })
    );

    return {
      results,
      totalResults: data.searchParameters?.totalResults || results.length,
      searchTime,
      creditsUsed: 1,
      searchParameters: {
        query: fullQuery,
        type: 'web',
        page,
      },
    };
  } catch (error) {
    console.error('[serper] Web search error:', error);
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
 * Image search using Serper API (text query -> find images)
 *
 * @param query - Search query for images
 * @param options - Search options
 * @returns Image search results
 */
export async function serperImageSearch(
  query: string,
  options: {
    maxResults?: number;
    country?: string;
  } = {}
): Promise<SerperImageSearchResponse> {
  const { maxResults = 20, country = 'us' } = options;

  if (!isSerperConfigured()) {
    return {
      results: [],
      searchTime: 0,
      creditsUsed: 0,
      error: 'Serper API is not configured. Add SERPER_API_KEY to environment variables.',
    };
  }

  const apiKey = process.env.SERPER_API_KEY!;

  console.log('[serper] Image search:', { query: query.substring(0, 100), num: maxResults });

  try {
    const startTime = Date.now();

    const response = await fetch('https://google.serper.dev/images', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: query,
        num: Math.min(maxResults, 100),
        gl: country,
      }),
    });

    const searchTime = (Date.now() - startTime) / 1000;

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        results: [],
        searchTime,
        creditsUsed: response.status === 401 ? 0 : 1,
        error: errorData.message || `API error: ${response.status}`,
      };
    }

    const data = await response.json();

    console.log('[serper] Image search response:', {
      images: data.images?.length || 0,
      searchTime,
    });

    // Parse image results
    const results: SerperImageResult[] = (data.images || []).map((item: any) => ({
      title: item.title || '',
      imageUrl: item.imageUrl || '',
      thumbnailUrl: item.thumbnailUrl,
      sourceUrl: item.link || '',
      source: extractDomain(item.link || ''),
      width: item.imageWidth,
      height: item.imageHeight,
    }));

    return {
      results,
      searchTime,
      creditsUsed: 1,
    };
  } catch (error) {
    console.error('[serper] Image search error:', error);
    return {
      results: [],
      searchTime: 0,
      creditsUsed: 0,
      error: error instanceof Error ? error.message : 'Image search failed',
    };
  }
}

/**
 * Google Lens search (visual/reverse image search)
 *
 * Upload an image URL to find visually similar items.
 * This is the key feature for visual-first research workflow.
 *
 * @param imageUrl - URL of the image to search
 * @param options - Search options
 * @returns Lens search results with visual matches
 */
export async function serperLensSearch(
  imageUrl: string,
  options: {
    country?: string;
  } = {}
): Promise<SerperLensResponse> {
  const { country = 'us' } = options;

  if (!isSerperConfigured()) {
    return {
      results: [],
      searchTime: 0,
      creditsUsed: 0,
      error: 'Serper API is not configured. Add SERPER_API_KEY to environment variables.',
    };
  }

  const apiKey = process.env.SERPER_API_KEY!;

  console.log('[serper] Lens search:', { imageUrl: imageUrl.substring(0, 80) + '...' });

  try {
    const startTime = Date.now();

    const response = await fetch('https://google.serper.dev/lens', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: imageUrl,
        gl: country,
      }),
    });

    const searchTime = (Date.now() - startTime) / 1000;

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        results: [],
        searchTime,
        creditsUsed: response.status === 401 ? 0 : 1,
        error: errorData.message || `API error: ${response.status}`,
      };
    }

    const data = await response.json();

    console.log('[serper] Lens search response:', {
      visualMatches: data.visual_matches?.length || 0,
      knowledgeGraph: !!data.knowledge_graph,
      searchTime,
    });

    // Parse visual matches (items that look similar)
    const visualMatches: SerperLensResult[] = (data.visual_matches || []).map(
      (item: any) => ({
        title: item.title || '',
        url: item.link || '',
        source: item.source || extractDomain(item.link || ''),
        thumbnail: item.thumbnail,
        price: item.price?.extracted,
      })
    );

    // Parse knowledge graph if available (identifies the item)
    const knowledgeGraph = data.knowledge_graph
      ? {
          title: data.knowledge_graph.title,
          type: data.knowledge_graph.type,
          description: data.knowledge_graph.description,
          imageUrl: data.knowledge_graph.images?.[0],
        }
      : undefined;

    return {
      results: visualMatches,
      visualMatches,
      knowledgeGraph,
      searchTime,
      creditsUsed: 1,
    };
  } catch (error) {
    console.error('[serper] Lens search error:', error);
    return {
      results: [],
      searchTime: 0,
      creditsUsed: 0,
      error: error instanceof Error ? error.message : 'Lens search failed',
    };
  }
}

/**
 * Search with multiple queries and combine results (web search)
 * Useful for searching with query variations
 */
export async function serperSearchMultiple(
  queries: string[],
  options: {
    domains?: string[];
    maxResultsPerQuery?: number;
  } = {}
): Promise<{
  results: SerperSearchResult[];
  totalCreditsUsed: number;
  errors: string[];
}> {
  const { domains = [], maxResultsPerQuery = 10 } = options;
  const allResults: SerperSearchResult[] = [];
  const seenUrls = new Set<string>();
  const errors: string[] = [];
  let totalCreditsUsed = 0;

  for (const query of queries) {
    const response = await serperWebSearch(query, {
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

// Alias exports for compatibility with existing code that uses google-search.ts
export type { SerperSearchResult as GoogleSearchResult };
export type { SerperSearchResponse as GoogleSearchResponse };
export { serperWebSearch as googleSearch, serperSearchMultiple as googleSearchMultiple };

// Re-export the isConfigured check with legacy name for compatibility
export function isGoogleSearchConfigured(): boolean {
  return isSerperConfigured();
}

export function getGoogleSearchStatus() {
  const status = getSerperStatus();
  return {
    configured: status.configured,
    apiKeySet: status.apiKeySet,
    searchEngineIdSet: true, // Not needed for Serper
  };
}
