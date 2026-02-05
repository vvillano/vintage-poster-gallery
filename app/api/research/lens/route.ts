import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  serperLensSearch,
  isSerperConfigured,
  extractDomain,
} from '@/lib/serper';
import { getAllDealers } from '@/lib/dealers';

/**
 * POST /api/research/lens
 * Google Lens (visual search) - find visually similar items
 *
 * This is the primary entry point for the visual-first research workflow.
 * Upload an image URL and get back similar items found across the web.
 *
 * Body: {
 *   imageUrl: string,           // URL of the image to search
 *   includeKnownDealers?: boolean, // Match results to known dealers (default: true)
 * }
 *
 * Returns:
 * - Visual matches (similar items found online)
 * - Knowledge graph (if item is identified)
 * - Dealer matching (which results are from known dealers)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { imageUrl, includeKnownDealers = true } = body;

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'imageUrl is required' },
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

    console.log('[lens] Starting visual search for:', imageUrl.substring(0, 80) + '...');

    // Perform Lens search
    const lensResult = await serperLensSearch(imageUrl);

    if (lensResult.error) {
      return NextResponse.json({
        success: false,
        configured: true,
        error: lensResult.error,
        results: [],
        creditsUsed: lensResult.creditsUsed,
      });
    }

    // Get dealers for domain matching if requested
    let dealerDomainMap = new Map<string, { id: number; name: string; reliabilityTier: number }>();

    if (includeKnownDealers) {
      const dealers = await getAllDealers({ isActive: true });
      for (const dealer of dealers) {
        if (dealer.website) {
          const domain = extractDomain(dealer.website);
          dealerDomainMap.set(domain, {
            id: dealer.id,
            name: dealer.name,
            reliabilityTier: dealer.reliabilityTier,
          });
        }
      }
    }

    // Match results to dealers and identify unknowns
    const unknownDomains = new Set<string>();
    const resultsWithDealerInfo = (lensResult.visualMatches || lensResult.results).map(result => {
      const domain = extractDomain(result.url);
      const dealer = dealerDomainMap.get(domain);

      if (!dealer && includeKnownDealers) {
        unknownDomains.add(domain);
      }

      return {
        title: result.title,
        url: result.url,
        source: result.source,
        thumbnail: result.thumbnail,
        price: result.price,
        domain,
        dealerId: dealer?.id,
        dealerName: dealer?.name,
        reliabilityTier: dealer?.reliabilityTier,
        isKnownDealer: !!dealer,
      };
    });

    // Extract titles from results for potential text search follow-up
    const extractedTitles = resultsWithDealerInfo
      .filter(r => r.title && r.title.length > 10)
      .map(r => r.title)
      .slice(0, 5); // Top 5 unique titles for text search

    console.log('[lens] Found:', {
      visualMatches: resultsWithDealerInfo.length,
      knowledgeGraph: !!lensResult.knowledgeGraph,
      knownDealers: resultsWithDealerInfo.filter(r => r.isKnownDealer).length,
      unknownDomains: unknownDomains.size,
      extractedTitles: extractedTitles.length,
    });

    return NextResponse.json({
      success: true,
      configured: true,
      results: resultsWithDealerInfo,
      knowledgeGraph: lensResult.knowledgeGraph,
      extractedTitles,
      unknownDomains: Array.from(unknownDomains),
      totalResults: resultsWithDealerInfo.length,
      creditsUsed: lensResult.creditsUsed,
      searchTime: lensResult.searchTime,
    });
  } catch (error) {
    console.error('Lens search error:', error);
    return NextResponse.json(
      { error: 'Lens search failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/research/lens/status
 * Check if Serper Lens is available
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
      feature: 'google-lens',
      message: configured
        ? 'Google Lens (visual search) is available via Serper API'
        : 'Serper API is not configured. Add SERPER_API_KEY to enable visual search.',
    });
  } catch (error) {
    console.error('Lens status error:', error);
    return NextResponse.json(
      { error: 'Failed to check Lens status' },
      { status: 500 }
    );
  }
}
