import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getPosterById, updatePosterFields } from '@/lib/db';
import {
  generateSearchUrls,
  runIdentificationResearch,
  getDealersForResearch,
  buildSearchQuery,
} from '@/lib/identification-research';
import type { IdentificationResearchOptions } from '@/types/research';

/**
 * POST /api/research/identification
 * Run identification research for a poster
 *
 * Body: {
 *   posterId: number,
 *   options?: IdentificationResearchOptions,
 *   prefetchedResults?: { dealerId: number; url: string; title: string; snippet: string }[]
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { posterId, options, prefetchedResults } = body;

    if (!posterId) {
      return NextResponse.json({ error: 'posterId is required' }, { status: 400 });
    }

    // Get the poster
    const poster = await getPosterById(posterId);
    if (!poster) {
      return NextResponse.json({ error: 'Poster not found' }, { status: 404 });
    }

    // Run research
    const results = await runIdentificationResearch(poster, options, prefetchedResults);

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error('Identification research error:', error);
    return NextResponse.json(
      { error: 'Research failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/research/identification?posterId=123
 * Get search URLs for a poster without running full research
 *
 * Query params:
 * - posterId: number (required)
 * - maxTier: number (optional) - Only include dealers up to this tier
 * - specializations: string (optional) - Comma-separated list of specializations
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const posterId = searchParams.get('posterId');

    if (!posterId) {
      return NextResponse.json({ error: 'posterId is required' }, { status: 400 });
    }

    // Get the poster
    const poster = await getPosterById(parseInt(posterId));
    if (!poster) {
      return NextResponse.json({ error: 'Poster not found' }, { status: 404 });
    }

    // Build options
    const options: IdentificationResearchOptions = {};

    const maxTier = searchParams.get('maxTier');
    if (maxTier) {
      options.maxTier = parseInt(maxTier);
    }

    const specializations = searchParams.get('specializations');
    if (specializations) {
      options.specializations = specializations.split(',') as any;
    }

    // Generate search URLs
    const searchUrls = await generateSearchUrls(poster, options);
    const query = buildSearchQuery(poster);

    // Get dealers organized by tier
    const dealersByTier = await getDealersForResearch(options);

    // Convert Map to object for JSON serialization
    const dealersByTierObject: Record<number, typeof searchUrls[0]['dealer'][]> = {};
    for (const [tier, dealers] of dealersByTier) {
      dealersByTierObject[tier] = dealers;
    }

    return NextResponse.json({
      posterId: poster.id,
      posterTitle: poster.title,
      query,
      searchUrls: searchUrls.map(s => ({
        dealerId: s.dealer.id,
        dealerName: s.dealer.name,
        dealerType: s.dealer.type,
        reliabilityTier: s.dealer.reliabilityTier,
        searchUrl: s.searchUrl,
        website: s.dealer.website,
      })),
      dealersByTier: dealersByTierObject,
      totalDealers: searchUrls.length,
      dealersWithSearchUrl: searchUrls.filter(s => s.searchUrl).length,
    });
  } catch (error) {
    console.error('Get search URLs error:', error);
    return NextResponse.json(
      { error: 'Failed to get search URLs', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/research/identification
 * Apply a dealer attribution to a poster
 *
 * Body: {
 *   posterId: number,
 *   artist: string,
 *   confidence: number,
 *   sources: string[],
 *   attributionBasis: 'external_research'
 * }
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { posterId, artist, confidence, sources } = body;

    if (!posterId || !artist) {
      return NextResponse.json({ error: 'posterId and artist are required' }, { status: 400 });
    }

    // Get current poster
    const poster = await getPosterById(posterId);
    if (!poster) {
      return NextResponse.json({ error: 'Poster not found' }, { status: 404 });
    }

    const previousArtist = poster.artist;
    const previousConfidence = poster.artistConfidenceScore ?? 0;

    // Update poster with new attribution
    await updatePosterFields(posterId, {
      artist,
      artistConfidenceScore: confidence,
      attributionBasis: 'external_research',
      artistSource: `Dealer research: ${sources.join(', ')}`,
    });

    return NextResponse.json({
      success: true,
      previousArtist,
      previousConfidence,
      newArtist: artist,
      newConfidence: confidence,
      sources,
    });
  } catch (error) {
    console.error('Apply attribution error:', error);
    return NextResponse.json(
      { error: 'Failed to apply attribution', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
