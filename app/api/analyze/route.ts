import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { analyzePoster, flattenAnalysis } from '@/lib/claude';
import { getPosterById, updatePosterAnalysis } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { posterId } = body;

    if (!posterId) {
      return NextResponse.json(
        { error: 'Poster ID is required' },
        { status: 400 }
      );
    }

    // Get poster from database
    const poster = await getPosterById(posterId);
    if (!poster) {
      return NextResponse.json({ error: 'Poster not found' }, { status: 404 });
    }

    // Check if already analyzed
    if (poster.analysisCompleted) {
      return NextResponse.json(
        { error: 'Poster has already been analyzed' },
        { status: 400 }
      );
    }

    // Analyze with Claude
    const analysis = await analyzePoster(
      poster.imageUrl,
      poster.initialInformation || undefined
    );

    // Flatten analysis for database storage
    const flattenedAnalysis = flattenAnalysis(analysis);

    // Update poster with analysis results
    const updatedPoster = await updatePosterAnalysis(posterId, {
      ...flattenedAnalysis,
      rawAiResponse: analysis,
    });

    return NextResponse.json({
      success: true,
      posterId: updatedPoster.id,
      analysis,
    });
  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      {
        error: 'Failed to analyze poster',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
