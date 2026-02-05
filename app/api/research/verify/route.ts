import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { compareImages, batchCompareImages } from '@/lib/visual-match';
import type { VisualMatchResult } from '@/types/poster';

/**
 * POST /api/research/verify
 * Visually verify search results against a poster image
 *
 * Body: {
 *   posterImageUrl: string,      // User's poster image URL
 *   thumbnailUrl?: string,       // Single thumbnail to verify
 *   thumbnailUrls?: string[],    // Multiple thumbnails to verify (batch)
 *   maxConcurrent?: number,      // Max parallel comparisons (default: 5)
 * }
 *
 * Returns: {
 *   success: boolean,
 *   results?: { [thumbnailUrl: string]: VisualMatchResult },
 *   result?: VisualMatchResult,  // For single thumbnail
 *   error?: string,
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
      posterImageUrl,
      thumbnailUrl,
      thumbnailUrls,
      maxConcurrent = 5,
    } = body;

    if (!posterImageUrl) {
      return NextResponse.json(
        { error: 'posterImageUrl is required' },
        { status: 400 }
      );
    }

    if (!thumbnailUrl && (!thumbnailUrls || thumbnailUrls.length === 0)) {
      return NextResponse.json(
        { error: 'thumbnailUrl or thumbnailUrls is required' },
        { status: 400 }
      );
    }

    // Single comparison
    if (thumbnailUrl && !thumbnailUrls) {
      const result = await compareImages(posterImageUrl, thumbnailUrl);
      return NextResponse.json({
        success: true,
        result,
      });
    }

    // Batch comparison
    if (thumbnailUrls && thumbnailUrls.length > 0) {
      // Limit batch size to prevent abuse
      const limitedUrls = thumbnailUrls.slice(0, 20);

      const resultsMap = await batchCompareImages(
        posterImageUrl,
        limitedUrls,
        Math.min(maxConcurrent, 10)
      );

      // Convert Map to object for JSON serialization
      const results: Record<string, VisualMatchResult> = {};
      resultsMap.forEach((value, key) => {
        results[key] = value;
      });

      return NextResponse.json({
        success: true,
        results,
        totalVerified: limitedUrls.length,
      });
    }

    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Visual verification error:', error);
    return NextResponse.json(
      {
        error: 'Verification failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/research/verify
 * Check if visual verification is available
 */
export async function GET() {
  try {
    // Check if Anthropic API key is configured
    const configured = !!process.env.ANTHROPIC_API_KEY;

    return NextResponse.json({
      configured,
      message: configured
        ? 'Visual verification is available'
        : 'ANTHROPIC_API_KEY not configured',
    });
  } catch (error) {
    console.error('Visual verification status error:', error);
    return NextResponse.json(
      { error: 'Failed to check verification status' },
      { status: 500 }
    );
  }
}
