import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  serperWebSearch,
  serperSearchMultiple,
  isSerperConfigured,
  extractDomain,
} from '@/lib/serper';
import { getAllDealers } from '@/lib/dealers';
import { parseSearchResultsWithAI } from '@/lib/identification-research';
import type { DealerCategory } from '@/types/dealer';

/**
 * POST /api/research/search
 * Aggregated search across dealer sites using Serper API (Google Search)
 *
 * Body: {
 *   query: string,              // Primary search query
 *   queryVariations?: string[], // Optional: multiple queries to run
 *   dealerIds?: number[],       // Optional: limit to specific dealers
 *   excludeCategories?: DealerCategory[], // Optional: exclude certain dealer categories
 *                                         // e.g., ['research'] for valuation mode
 *   maxResults?: number,        // Max results (default: 20)
 *   parseWithAI?: boolean,      // Whether to parse results with AI (default: false)
 *   posterContext?: {           // Context for AI parsing
 *     title: string,
 *     artist?: string,
 *     date?: string,
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      query,
      queryVariations,
      dealerIds,
      excludeCategories,  // e.g., ['research'] for valuation mode
      maxResults = 20,
      parseWithAI = false,
      posterContext,
    } = body;

    if (!query && (!queryVariations || queryVariations.length === 0)) {
      return NextResponse.json(
        { error: 'query or queryVariations is required' },
        { status: 400 }
      );
    }

    // Check if Serper is configured
    if (!isSerperConfigured()) {
      return NextResponse.json({
        success: false,
        configured: false,
        error: 'Serper API is not configured. Add SERPER_API_KEY to environment variables.',
        results: [],
      });
    }

    // Get dealers for domain matching (with optional category filter)
    const dealers = await getAllDealers({
      isActive: true,
      excludeCategories: excludeCategories as DealerCategory[] | undefined,
    });
    const dealerDomainMap = new Map<string, { id: number; name: string; reliabilityTier: number; category: string }>();

    // Filter dealers if specific IDs requested
    const filteredDealers = dealerIds?.length
      ? dealers.filter(d => dealerIds.includes(d.id))
      : dealers;

    // Build domain map (but don't restrict search to these domains)
    for (const dealer of filteredDealers) {
      if (dealer.website) {
        const domain = extractDomain(dealer.website);
        dealerDomainMap.set(domain, {
          id: dealer.id,
          name: dealer.name,
          reliabilityTier: dealer.reliabilityTier,
          category: dealer.category,
        });
      }
    }

    // Perform search WITHOUT domain restrictions (search entire web)
    // Results will be matched to dealers after the fact
    let searchResults;
    let creditsUsed = 0;
    const errors: string[] = [];

    console.log('Search request:', { query, queryVariations, maxResults });

    if (queryVariations && queryVariations.length > 0) {
      // Multiple query search
      const multiResult = await serperSearchMultiple(queryVariations, {
        // No domain restriction - search whole web
        maxResultsPerQuery: Math.ceil(maxResults / queryVariations.length),
      });
      searchResults = multiResult.results.slice(0, maxResults);
      creditsUsed = multiResult.totalCreditsUsed;
      errors.push(...multiResult.errors);
    } else {
      // Single query search
      const singleResult = await serperWebSearch(query, {
        // No domain restriction - search whole web
        maxResults,
      });

      console.log('Serper search result:', {
        resultCount: singleResult.results.length,
        totalResults: singleResult.totalResults,
        error: singleResult.error,
        creditsUsed: singleResult.creditsUsed,
      });

      if (singleResult.error) {
        errors.push(singleResult.error);
      }

      searchResults = singleResult.results;
      creditsUsed = singleResult.creditsUsed;
    }

    // Match results to dealers and identify unknowns
    const unknownDomains = new Set<string>();
    const resultsWithDealerInfo = searchResults.map(result => {
      const domain = result.domain;
      const dealer = dealerDomainMap.get(domain);

      if (!dealer) {
        unknownDomains.add(domain);
      }

      return {
        ...result,
        dealerId: dealer?.id,
        dealerName: dealer?.name,
        reliabilityTier: dealer?.reliabilityTier,
        dealerCategory: dealer?.category,
        isKnownDealer: !!dealer,
      };
    });

    // Optionally parse results with AI
    let parsedResults;
    if (parseWithAI && posterContext && resultsWithDealerInfo.length > 0) {
      try {
        const snippetsForParsing = resultsWithDealerInfo
          .filter(r => r.dealerId)
          .map(r => ({
            dealerId: r.dealerId!,
            dealerName: r.dealerName || 'Unknown',
            url: r.url,
            title: r.title,
            snippet: r.snippet,
          }));

        if (snippetsForParsing.length > 0) {
          parsedResults = await parseSearchResultsWithAI(snippetsForParsing, posterContext);
        }
      } catch (parseError) {
        console.error('AI parsing error:', parseError);
        errors.push('AI parsing failed: ' + (parseError instanceof Error ? parseError.message : 'Unknown error'));
      }
    }

    return NextResponse.json({
      success: true,
      configured: true,
      query: queryVariations?.join(' | ') || query,
      results: resultsWithDealerInfo,
      parsedResults,
      unknownDomains: Array.from(unknownDomains),
      totalResults: searchResults.length,
      creditsUsed,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Research search error:', error);
    return NextResponse.json(
      { error: 'Search failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/research/search/status
 * Check if Serper API is configured
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const configured = isSerperConfigured();

    return NextResponse.json({
      configured,
      provider: 'serper',
      message: configured
        ? 'Serper API is configured and ready (Google Search + Lens)'
        : 'Serper API is not configured. Add SERPER_API_KEY to environment variables.',
    });
  } catch (error) {
    console.error('Search status error:', error);
    return NextResponse.json(
      { error: 'Failed to check search status' },
      { status: 500 }
    );
  }
}
