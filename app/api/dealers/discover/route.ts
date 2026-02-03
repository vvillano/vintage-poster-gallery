import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { googleSearch, isGoogleSearchConfigured, extractDomain } from '@/lib/google-search';
import { getAllDealers } from '@/lib/dealers';
import {
  extractDealersFromSearchResults,
  generateDiscoveryQueryPreview,
  getAvailableRegions,
  getAvailableDealerTypes,
  getAvailableLanguages,
  type DiscoveryOptions,
} from '@/lib/dealer-discovery';
import type { DealerType } from '@/types/dealer';

/**
 * POST /api/dealers/discover
 * Search for and discover new dealers using AI-assisted extraction
 *
 * Body: {
 *   region: string,      // Country/region to search in
 *   dealerType: string,  // Type of dealer to find
 *   language: string,    // Language for search query
 *   maxResults?: number, // Max results to process (default: 10)
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
      region,
      dealerType,
      language,
      maxResults = 10,
    } = body;

    if (!region || !dealerType || !language) {
      return NextResponse.json(
        { error: 'region, dealerType, and language are required' },
        { status: 400 }
      );
    }

    // Check if Google Search is configured
    if (!isGoogleSearchConfigured()) {
      return NextResponse.json({
        success: false,
        configured: false,
        error: 'Google Custom Search is not configured. Add GOOGLE_CSE_API_KEY and GOOGLE_CSE_ID to environment variables.',
        suggestions: [],
      });
    }

    const options: DiscoveryOptions = {
      region,
      dealerType: dealerType as DealerType,
      language,
      maxResults,
    };

    // Generate the localized search query
    const query = generateDiscoveryQueryPreview(options);

    // Get existing dealers to check for duplicates
    const existingDealers = await getAllDealers({ isActive: true });
    const existingDomains = new Set(
      existingDealers
        .filter(d => d.website)
        .map(d => extractDomain(d.website!))
    );

    // Perform web search
    const searchResponse = await googleSearch(query, {
      maxResults: Math.min(maxResults, 10),
    });

    if (searchResponse.error) {
      return NextResponse.json({
        success: false,
        configured: true,
        query,
        error: searchResponse.error,
        suggestions: [],
        creditsUsed: searchResponse.creditsUsed,
      });
    }

    // Use AI to extract dealer information from search results
    const searchResults = searchResponse.results.map(r => ({
      title: r.title,
      url: r.url,
      snippet: r.snippet,
    }));

    const suggestions = await extractDealersFromSearchResults(
      searchResults,
      options,
      existingDomains
    );

    return NextResponse.json({
      success: true,
      configured: true,
      query,
      suggestions,
      totalSearchResults: searchResponse.results.length,
      creditsUsed: searchResponse.creditsUsed,
    });
  } catch (error) {
    console.error('Dealer discovery error:', error);
    return NextResponse.json(
      { error: 'Discovery failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/dealers/discover/options
 * Get available options for dealer discovery (regions, types, languages)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const configured = isGoogleSearchConfigured();

    return NextResponse.json({
      configured,
      regions: getAvailableRegions(),
      dealerTypes: getAvailableDealerTypes(),
      languages: getAvailableLanguages(),
    });
  } catch (error) {
    console.error('Discovery options error:', error);
    return NextResponse.json(
      { error: 'Failed to get discovery options' },
      { status: 500 }
    );
  }
}
