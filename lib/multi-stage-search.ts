/**
 * Multi-Stage Search Engine
 *
 * Implements the visual-first research workflow:
 * 1. IMAGE SEARCH: Google Lens finds visually similar items
 * 2. AUTO-GENERATED TEXT SEARCHES: Uses titles/subjects found in image results
 * 3. UNIFIED RESULTS: Combined, deduplicated, categorized findings
 *
 * This is the core orchestration logic for comprehensive research.
 */

import {
  serperLensSearch,
  serperWebSearch,
  serperSearchMultiple,
  isSerperConfigured,
  extractDomain,
  type SerperLensResult,
  type SerperSearchResult,
} from './serper';
import { getAllDealers } from './dealers';
import { batchCompareImages, type VisualMatchResult } from './visual-match';
import type { Dealer } from '@/types/dealer';

/**
 * Unified search result combining image and text search findings
 */
export interface UnifiedSearchResult {
  // Core fields
  title: string;
  url: string;
  snippet?: string;
  domain: string;

  // Source tracking
  source: 'lens' | 'web';
  originalSource?: string; // e.g., dealer name from Lens result

  // Price info (extracted from Lens or snippet)
  price?: string;
  priceValue?: number;
  currency?: string;

  // Dealer matching
  dealerId?: number;
  dealerName?: string;
  reliabilityTier?: number;
  isKnownDealer: boolean;

  // Thumbnail/image
  thumbnail?: string;

  // Match confidence (0-1)
  confidence?: number;

  // Visual verification (optional - only populated if visual verification is enabled)
  visualMatch?: number;        // 0-100 visual similarity score
  sameImage?: boolean;         // High confidence this is the same poster
  sameArtist?: boolean;        // Same artist/style but different work
  visuallyVerified: boolean;   // Whether visual verification was performed
  visualExplanation?: string;  // Brief explanation from Claude
}

/**
 * Extracted title/subject from Lens results for text search
 */
export interface ExtractedTitle {
  title: string;
  source: string; // Which result it came from
  confidence: number;
}

/**
 * Multi-stage search response
 */
export interface MultiStageSearchResponse {
  success: boolean;
  error?: string;

  // Configuration
  configured: boolean;
  imageUrl?: string;

  // Stage results
  lensResults?: UnifiedSearchResult[];
  webResults?: UnifiedSearchResult[];

  // Combined results (deduplicated)
  results: UnifiedSearchResult[];

  // Extracted info
  extractedTitles: ExtractedTitle[];
  knowledgeGraph?: {
    title?: string;
    type?: string;
    description?: string;
    imageUrl?: string;
  };

  // Unknown dealers found
  unknownDomains: string[];

  // Visual verification stats (if enabled)
  visualVerification?: {
    enabled: boolean;
    resultsVerified: number;
    confirmedMatches: number;
    highMatchCount: number;
  };

  // Stats
  totalResults: number;
  creditsUsed: number;
  searchTime: number;
}

/**
 * Search options for multi-stage search
 */
export interface MultiStageSearchOptions {
  // Image search
  imageUrl?: string;

  // Text search (if no image, or in addition)
  query?: string;
  queryVariations?: string[];

  // Options
  maxLensResults?: number;
  maxWebResults?: number;
  maxWebQueries?: number;
  includeWebSearch?: boolean; // Default: true if image provided

  // Visual verification
  enableVisualVerification?: boolean; // Enable Claude Vision comparison
  maxVisualVerifications?: number;    // Max results to verify (default: 10)
  visualVerificationThreshold?: number; // Min visual match to include (default: 0 = include all)

  // Filtering
  dealerIds?: number[];
}

/**
 * Build dealer domain map for result matching
 */
async function buildDealerDomainMap(
  dealerIds?: number[]
): Promise<Map<string, { id: number; name: string; reliabilityTier: number }>> {
  const dealers = await getAllDealers({ isActive: true });
  const dealerDomainMap = new Map<string, { id: number; name: string; reliabilityTier: number }>();

  const filteredDealers = dealerIds?.length
    ? dealers.filter((d) => dealerIds.includes(d.id))
    : dealers;

  for (const dealer of filteredDealers) {
    if (dealer.website) {
      const domain = extractDomain(dealer.website);
      dealerDomainMap.set(domain, {
        id: dealer.id,
        name: dealer.name,
        reliabilityTier: dealer.reliabilityTier,
      });
    }
  }

  return dealerDomainMap;
}

/**
 * Match a result to known dealers
 */
function matchToDealer(
  url: string,
  dealerMap: Map<string, { id: number; name: string; reliabilityTier: number }>
): { dealerId?: number; dealerName?: string; reliabilityTier?: number; isKnownDealer: boolean } {
  const domain = extractDomain(url);
  const dealer = dealerMap.get(domain);

  return {
    dealerId: dealer?.id,
    dealerName: dealer?.name,
    reliabilityTier: dealer?.reliabilityTier,
    isKnownDealer: !!dealer,
  };
}

/**
 * Extract price from text (e.g., "$1,200" or "€950")
 */
function extractPrice(text: string): { price: string; value: number; currency: string } | null {
  // Match common price patterns
  const patterns = [
    /\$\s*([\d,]+(?:\.\d{2})?)/,  // USD: $1,200 or $1,200.00
    /€\s*([\d,]+(?:\.\d{2})?)/,   // EUR: €950
    /£\s*([\d,]+(?:\.\d{2})?)/,   // GBP: £800
    /([\d,]+(?:\.\d{2})?)\s*USD/, // 1200 USD
    /([\d,]+(?:\.\d{2})?)\s*EUR/, // 950 EUR
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const valueStr = match[1].replace(/,/g, '');
      const value = parseFloat(valueStr);
      if (!isNaN(value)) {
        let currency = 'USD';
        if (text.includes('€') || text.includes('EUR')) currency = 'EUR';
        if (text.includes('£') || text.includes('GBP')) currency = 'GBP';

        return {
          price: match[0],
          value,
          currency,
        };
      }
    }
  }

  return null;
}

/**
 * Convert Lens result to unified format
 */
function lensToUnified(
  result: SerperLensResult,
  dealerMap: Map<string, { id: number; name: string; reliabilityTier: number }>
): UnifiedSearchResult {
  const dealerMatch = matchToDealer(result.url, dealerMap);
  const priceInfo = result.price ? extractPrice(result.price) : null;

  return {
    title: result.title,
    url: result.url,
    domain: extractDomain(result.url),
    source: 'lens',
    originalSource: result.source,
    price: result.price || priceInfo?.price,
    priceValue: priceInfo?.value,
    currency: priceInfo?.currency,
    thumbnail: result.thumbnail,
    visuallyVerified: false, // Not verified until visual verification runs
    ...dealerMatch,
  };
}

/**
 * Convert web search result to unified format
 */
function webToUnified(
  result: SerperSearchResult,
  dealerMap: Map<string, { id: number; name: string; reliabilityTier: number }>
): UnifiedSearchResult {
  const dealerMatch = matchToDealer(result.url, dealerMap);
  const priceInfo = result.snippet ? extractPrice(result.snippet) : null;

  return {
    title: result.title,
    url: result.url,
    snippet: result.snippet,
    domain: result.domain,
    source: 'web',
    price: priceInfo?.price,
    priceValue: priceInfo?.value,
    currency: priceInfo?.currency,
    thumbnail: result.imageUrl, // Rich snippet image from Serper (if available)
    visuallyVerified: false, // Not verified until visual verification runs
    ...dealerMatch,
  };
}

/**
 * Extract meaningful titles from Lens results for text search
 */
function extractTitlesFromLensResults(results: UnifiedSearchResult[]): ExtractedTitle[] {
  const titles: ExtractedTitle[] = [];
  const seenTitles = new Set<string>();

  for (const result of results) {
    // Skip very short or generic titles
    if (!result.title || result.title.length < 10) continue;

    // Normalize title for deduplication
    const normalized = result.title.toLowerCase().trim();
    if (seenTitles.has(normalized)) continue;

    // Skip titles that are just website names
    if (normalized.includes('ebay') || normalized.includes('etsy') || normalized.includes('search results')) {
      continue;
    }

    seenTitles.add(normalized);

    // Calculate confidence based on source reliability
    let confidence = 0.5;
    if (result.isKnownDealer) {
      confidence += 0.2;
      if (result.reliabilityTier && result.reliabilityTier <= 2) {
        confidence += 0.2; // Higher tier dealers get more weight
      }
    }

    titles.push({
      title: result.title,
      source: result.originalSource || result.domain,
      confidence,
    });
  }

  // Sort by confidence and return top titles
  return titles.sort((a, b) => b.confidence - a.confidence).slice(0, 10);
}

/**
 * Generate search queries from extracted titles
 */
function generateQueriesFromTitles(titles: ExtractedTitle[], maxQueries: number = 3): string[] {
  const queries: string[] = [];

  for (const title of titles.slice(0, maxQueries)) {
    // Clean up title for search
    let query = title.title
      .replace(/\s+/g, ' ')  // Normalize whitespace
      .replace(/[^\w\s-]/g, '') // Remove special chars
      .trim();

    // Add "poster" if not present
    if (!query.toLowerCase().includes('poster')) {
      query = `${query} poster`;
    }

    if (query.length > 10) {
      queries.push(query);
    }
  }

  return queries;
}

/**
 * Deduplicate results by URL
 */
function deduplicateResults(results: UnifiedSearchResult[]): UnifiedSearchResult[] {
  const seen = new Map<string, UnifiedSearchResult>();

  for (const result of results) {
    const key = result.url.toLowerCase().replace(/\/+$/, ''); // Normalize URL

    if (!seen.has(key)) {
      seen.set(key, result);
    } else {
      // Prefer lens results over web results (they have thumbnails and prices)
      const existing = seen.get(key)!;
      if (result.source === 'lens' && existing.source === 'web') {
        seen.set(key, { ...existing, ...result, source: 'lens' });
      }
      // Merge price info if available
      if (result.priceValue && !existing.priceValue) {
        seen.set(key, { ...existing, priceValue: result.priceValue, price: result.price, currency: result.currency });
      }
      // Preserve visual verification data (prefer verified over unverified)
      if (result.visuallyVerified && !existing.visuallyVerified) {
        const merged = seen.get(key)!;
        merged.visuallyVerified = true;
        merged.visualMatch = result.visualMatch;
        merged.sameImage = result.sameImage;
        merged.sameArtist = result.sameArtist;
        merged.visualExplanation = result.visualExplanation;
      }
    }
  }

  return Array.from(seen.values());
}

/**
 * Sort results by relevance
 * Priority order:
 * 1. Visually verified same-image results first
 * 2. High visual match scores (>= 60)
 * 3. Known dealers with good reliability tier
 * 4. Results with price info
 * 5. Lens results before web
 */
function sortResults(results: UnifiedSearchResult[]): UnifiedSearchResult[] {
  return results.sort((a, b) => {
    // 1. Visually verified same-image results first
    if (a.sameImage && !b.sameImage) return -1;
    if (!a.sameImage && b.sameImage) return 1;

    // 2. High visual match scores (both verified)
    if (a.visuallyVerified && b.visuallyVerified) {
      const aMatch = a.visualMatch ?? 0;
      const bMatch = b.visualMatch ?? 0;
      if (aMatch !== bMatch) {
        return bMatch - aMatch; // Higher match first
      }
    } else if (a.visuallyVerified && (a.visualMatch ?? 0) >= 60) {
      return -1; // Verified high-match before unverified
    } else if (b.visuallyVerified && (b.visualMatch ?? 0) >= 60) {
      return 1;
    }

    // 3. Known dealers first
    if (a.isKnownDealer && !b.isKnownDealer) return -1;
    if (!a.isKnownDealer && b.isKnownDealer) return 1;

    // 4. Higher reliability tier first (lower number = higher tier)
    if (a.reliabilityTier && b.reliabilityTier) {
      if (a.reliabilityTier !== b.reliabilityTier) {
        return a.reliabilityTier - b.reliabilityTier;
      }
    } else if (a.reliabilityTier) {
      return -1;
    } else if (b.reliabilityTier) {
      return 1;
    }

    // 5. With price first
    if (a.priceValue && !b.priceValue) return -1;
    if (!a.priceValue && b.priceValue) return 1;

    // 6. Lens results first
    if (a.source === 'lens' && b.source === 'web') return -1;
    if (a.source === 'web' && b.source === 'lens') return 1;

    return 0;
  });
}

/**
 * Main multi-stage search function
 *
 * Orchestrates the visual-first research workflow:
 * 1. Run Google Lens on image (if provided)
 * 2. Extract titles from Lens results
 * 3. Run text searches on extracted titles
 * 4. Combine and deduplicate results
 * 5. Match to known dealers
 */
export async function multiStageSearch(
  options: MultiStageSearchOptions
): Promise<MultiStageSearchResponse> {
  const startTime = Date.now();
  let creditsUsed = 0;

  // Check configuration
  if (!isSerperConfigured()) {
    return {
      success: false,
      configured: false,
      error: 'Serper API is not configured. Add SERPER_API_KEY to environment variables.',
      results: [],
      extractedTitles: [],
      unknownDomains: [],
      totalResults: 0,
      creditsUsed: 0,
      searchTime: 0,
    };
  }

  const {
    imageUrl,
    query,
    queryVariations,
    maxLensResults = 20,
    maxWebResults = 20,
    maxWebQueries = 3,
    includeWebSearch = true,
    enableVisualVerification = false,
    maxVisualVerifications = 10,
    visualVerificationThreshold = 0,
    dealerIds,
  } = options;

  // Build dealer domain map
  const dealerMap = await buildDealerDomainMap(dealerIds);

  const allResults: UnifiedSearchResult[] = [];
  const unknownDomains = new Set<string>();
  let lensResults: UnifiedSearchResult[] = [];
  let webResults: UnifiedSearchResult[] = [];
  let extractedTitles: ExtractedTitle[] = [];
  let knowledgeGraph: MultiStageSearchResponse['knowledgeGraph'];

  // STAGE 1: Image Search (Google Lens)
  if (imageUrl) {
    console.log('[multi-stage] Stage 1: Running Google Lens search');

    const lensResponse = await serperLensSearch(imageUrl);
    creditsUsed += lensResponse.creditsUsed;

    if (lensResponse.error) {
      console.warn('[multi-stage] Lens search error:', lensResponse.error);
    } else {
      // Store knowledge graph if available
      knowledgeGraph = lensResponse.knowledgeGraph;

      // Convert to unified format
      lensResults = (lensResponse.visualMatches || lensResponse.results)
        .slice(0, maxLensResults)
        .map((r) => lensToUnified(r, dealerMap));

      // Track unknown domains
      for (const result of lensResults) {
        if (!result.isKnownDealer) {
          unknownDomains.add(result.domain);
        }
      }

      allResults.push(...lensResults);

      // Extract titles for text search
      extractedTitles = extractTitlesFromLensResults(lensResults);

      console.log('[multi-stage] Lens found:', {
        visualMatches: lensResults.length,
        knownDealers: lensResults.filter((r) => r.isKnownDealer).length,
        extractedTitles: extractedTitles.length,
      });
    }
  }

  // STAGE 2: Text Search
  if (includeWebSearch) {
    console.log('[multi-stage] Stage 2: Running web searches');

    // Build queries: user-provided or auto-generated from Lens results
    const queries: string[] = [];

    // Use provided query/variations first
    if (query) {
      queries.push(query);
    }
    if (queryVariations?.length) {
      queries.push(...queryVariations);
    }

    // Add auto-generated queries from Lens results
    if (extractedTitles.length > 0 && queries.length < maxWebQueries) {
      const autoQueries = generateQueriesFromTitles(
        extractedTitles,
        maxWebQueries - queries.length
      );
      queries.push(...autoQueries);
    }

    // Deduplicate queries
    const uniqueQueries = [...new Set(queries)].slice(0, maxWebQueries);

    if (uniqueQueries.length > 0) {
      console.log('[multi-stage] Running web searches:', uniqueQueries);

      const webResponse = await serperSearchMultiple(uniqueQueries, {
        maxResultsPerQuery: Math.ceil(maxWebResults / uniqueQueries.length),
      });
      creditsUsed += webResponse.totalCreditsUsed;

      // Convert to unified format
      webResults = webResponse.results
        .slice(0, maxWebResults)
        .map((r) => webToUnified(r, dealerMap));

      // Track unknown domains
      for (const result of webResults) {
        if (!result.isKnownDealer) {
          unknownDomains.add(result.domain);
        }
      }

      allResults.push(...webResults);

      console.log('[multi-stage] Web search found:', {
        results: webResults.length,
        knownDealers: webResults.filter((r) => r.isKnownDealer).length,
      });
    }
  }

  // STAGE 3: Combine and sort results
  const dedupedResults = deduplicateResults(allResults);
  let sortedResults = sortResults(dedupedResults);

  // STAGE 4: Visual Verification (optional)
  // Uses Claude Vision to verify that search results show the same poster
  if (enableVisualVerification && imageUrl) {
    console.log('[multi-stage] Stage 4: Running visual verification');

    // Get results with thumbnails to verify
    const resultsWithThumbnails = sortedResults.filter(r => r.thumbnail);
    const toVerify = resultsWithThumbnails.slice(0, maxVisualVerifications);

    if (toVerify.length > 0) {
      console.log(`[multi-stage] Verifying ${toVerify.length} results with thumbnails`);

      try {
        // Get thumbnail URLs
        const thumbnailUrls = toVerify.map(r => r.thumbnail!);

        // Batch compare with poster image
        const verificationResults = await batchCompareImages(
          imageUrl,
          thumbnailUrls,
          5 // Max concurrent comparisons
        );

        // Apply verification results to search results
        for (const result of sortedResults) {
          if (result.thumbnail && verificationResults.has(result.thumbnail)) {
            const verification = verificationResults.get(result.thumbnail)!;
            result.visuallyVerified = true;
            result.visualMatch = verification.visualMatch;
            result.sameImage = verification.sameImage;
            result.sameArtist = verification.sameArtist;
            result.visualExplanation = verification.explanation;
          }
        }

        // Re-sort with visual verification data
        sortedResults = sortResults(sortedResults);

        // Optionally filter by threshold
        if (visualVerificationThreshold > 0) {
          sortedResults = sortedResults.filter(r => {
            // Keep unverified results and results above threshold
            if (!r.visuallyVerified) return true;
            return (r.visualMatch ?? 0) >= visualVerificationThreshold;
          });
        }

        console.log('[multi-stage] Visual verification complete:', {
          verified: toVerify.length,
          confirmedMatches: sortedResults.filter(r => r.sameImage).length,
          highMatches: sortedResults.filter(r => (r.visualMatch ?? 0) >= 60).length,
        });
      } catch (verifyError) {
        console.error('[multi-stage] Visual verification error:', verifyError);
        // Continue without verification - don't fail the search
      }
    } else {
      console.log('[multi-stage] No thumbnails available for visual verification');
    }
  }

  const searchTime = (Date.now() - startTime) / 1000;

  // Calculate visual verification stats
  const verifiedResults = sortedResults.filter(r => r.visuallyVerified);
  const confirmedMatches = sortedResults.filter(r => r.sameImage);
  const highVisualMatches = sortedResults.filter(r => (r.visualMatch ?? 0) >= 60);

  console.log('[multi-stage] Search complete:', {
    totalResults: sortedResults.length,
    lensResults: lensResults.length,
    webResults: webResults.length,
    unknownDomains: unknownDomains.size,
    visualVerification: enableVisualVerification ? {
      verified: verifiedResults.length,
      confirmed: confirmedMatches.length,
      highMatch: highVisualMatches.length,
    } : 'disabled',
    creditsUsed,
    searchTime,
  });

  return {
    success: true,
    configured: true,
    imageUrl,
    lensResults,
    webResults,
    results: sortedResults,
    extractedTitles,
    knowledgeGraph,
    unknownDomains: Array.from(unknownDomains),
    visualVerification: enableVisualVerification ? {
      enabled: true,
      resultsVerified: verifiedResults.length,
      confirmedMatches: confirmedMatches.length,
      highMatchCount: highVisualMatches.length,
    } : undefined,
    totalResults: sortedResults.length,
    creditsUsed,
    searchTime,
  };
}
