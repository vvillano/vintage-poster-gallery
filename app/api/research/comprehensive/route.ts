import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { multiStageSearch, type MultiStageSearchOptions } from '@/lib/multi-stage-search';
import { parseResultsWithAI, type PosterContext } from '@/lib/result-parser';
import { isSerperConfigured } from '@/lib/serper';

/**
 * POST /api/research/comprehensive
 * Multi-stage search: Image (Lens) → Text → Combined Results → AI Parsing
 *
 * This is the main entry point for the visual-first research workflow.
 *
 * Body: {
 *   // Image search (primary)
 *   imageUrl?: string,           // URL of image to search (runs Google Lens)
 *
 *   // Text search (secondary or standalone)
 *   query?: string,              // Primary search query
 *   queryVariations?: string[],  // Additional query variations
 *
 *   // Options
 *   maxLensResults?: number,     // Max Lens results (default: 20)
 *   maxWebResults?: number,      // Max web results (default: 20)
 *   maxWebQueries?: number,      // Max web queries to run (default: 3)
 *   includeWebSearch?: boolean,  // Auto-run web search after Lens (default: true)
 *   dealerIds?: number[],        // Limit to specific dealers
 *
 *   // AI parsing (optional)
 *   parseWithAI?: boolean,       // Use AI to extract structured data (default: false)
 *   posterContext?: {            // Context for AI parsing
 *     title: string,
 *     artist?: string,
 *     date?: string,
 *     dimensions?: string,
 *     technique?: string,
 *   }
 * }
 *
 * Returns:
 * - Combined, deduplicated results from both image and text search
 * - Extracted titles (for follow-up searches)
 * - Knowledge graph (if item identified)
 * - Unknown dealers (for discovery)
 * - Parsed results with attribution/price data (if parseWithAI=true)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      imageUrl,
      query,
      queryVariations,
      maxLensResults = 20,
      maxWebResults = 20,
      maxWebQueries = 3,
      includeWebSearch = true,
      dealerIds,
      parseWithAI = false,
      posterContext,
    } = body;

    // Validate input
    if (!imageUrl && !query && (!queryVariations || queryVariations.length === 0)) {
      return NextResponse.json(
        { error: 'Either imageUrl, query, or queryVariations is required' },
        { status: 400 }
      );
    }

    // Check configuration
    if (!isSerperConfigured()) {
      return NextResponse.json({
        success: false,
        configured: false,
        error: 'Serper API is not configured. Add SERPER_API_KEY to environment variables.',
        results: [],
      });
    }

    console.log('[comprehensive] Starting multi-stage search:', {
      hasImage: !!imageUrl,
      hasQuery: !!query,
      queryVariations: queryVariations?.length || 0,
      includeWebSearch,
    });

    // Run multi-stage search
    const searchOptions: MultiStageSearchOptions = {
      imageUrl,
      query,
      queryVariations,
      maxLensResults,
      maxWebResults,
      maxWebQueries,
      includeWebSearch,
      dealerIds,
    };

    const result = await multiStageSearch(searchOptions);

    // Optionally parse results with AI
    let parsedResults;
    if (parseWithAI && posterContext && result.results.length > 0) {
      console.log('[comprehensive] Running AI parsing on', result.results.length, 'results');

      const ctx: PosterContext = {
        title: posterContext.title || query || '',
        artist: posterContext.artist,
        date: posterContext.date,
        dimensions: posterContext.dimensions,
        technique: posterContext.technique,
        imageUrl,
      };

      parsedResults = await parseResultsWithAI(result.results, ctx);
    }

    return NextResponse.json({
      ...result,
      parsedResults,
    });
  } catch (error) {
    console.error('[comprehensive] Search error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Comprehensive search failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/research/comprehensive/status
 * Check if comprehensive search is available
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
      features: {
        lens: configured,      // Google Lens (visual search)
        web: configured,       // Web search
        multiStage: configured, // Automated multi-stage search
      },
      message: configured
        ? 'Comprehensive search is available (Google Lens + Web Search)'
        : 'Serper API is not configured. Add SERPER_API_KEY to enable comprehensive search.',
    });
  } catch (error) {
    console.error('[comprehensive] Status check error:', error);
    return NextResponse.json(
      { error: 'Failed to check comprehensive search status' },
      { status: 500 }
    );
  }
}
