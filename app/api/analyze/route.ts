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
    const { posterId, additionalContext, forceReanalyze } = body;

    if (!posterId) {
      return NextResponse.json(
        { error: 'Poster ID is required' },
        { status: 400 }
      );
    }

    // Verify Anthropic API key is configured
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('ANTHROPIC_API_KEY is not configured');
      return NextResponse.json(
        {
          error: 'Analysis service not configured',
          details: 'ANTHROPIC_API_KEY environment variable is missing',
        },
        { status: 500 }
      );
    }

    // Get poster from database
    const poster = await getPosterById(posterId);
    if (!poster) {
      return NextResponse.json({ error: 'Poster not found' }, { status: 404 });
    }

    // Check if already analyzed (unless forceReanalyze is true)
    if (poster.analysisCompleted && !forceReanalyze) {
      return NextResponse.json(
        { error: 'Poster has already been analyzed. Use forceReanalyze to re-analyze with new context.' },
        { status: 400 }
      );
    }

    console.log(`Starting analysis for poster ${posterId}, image URL: ${poster.imageUrl}`);

    // Combine initial information with any additional context
    let combinedInfo = poster.initialInformation || '';
    if (additionalContext) {
      combinedInfo = combinedInfo
        ? `${combinedInfo}\n\nADDITIONAL CONTEXT PROVIDED BY USER:\n${additionalContext}`
        : additionalContext;
    }

    // Analyze with Claude
    const analysis = await analyzePoster(
      poster.imageUrl,
      combinedInfo || undefined,
      poster.productType || undefined
    );

    console.log('Analysis completed successfully');

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

    // Provide more specific error messages
    let errorMessage = 'Failed to analyze poster';
    let errorDetails = error instanceof Error ? error.message : 'Unknown error';

    // Check for specific error types
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        errorMessage = 'Invalid API key';
        errorDetails = 'The Anthropic API key is invalid or expired';
      } else if (error.message.includes('rate limit')) {
        errorMessage = 'Rate limit exceeded';
        errorDetails = 'Too many requests to the analysis service';
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Analysis timeout';
        errorDetails = 'The analysis took too long to complete';
      }
    }

    return NextResponse.json(
      {
        error: errorMessage,
        details: errorDetails,
      },
      { status: 500 }
    );
  }
}
