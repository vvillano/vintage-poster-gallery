import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { analyzePoster, flattenAnalysis, ShopifyAnalysisContext } from '@/lib/claude';
import { getPosterById, updatePosterAnalysis } from '@/lib/db';
import { autoLinkPosterEntities } from '@/lib/auto-link';

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

    // Build Shopify context from existing metafield data
    // This provides Claude with existing catalog information to verify and build upon
    // When forceReanalyze is true, exclude analysis-derived fields (artist, date, technique)
    // to allow fresh analysis without confirmation bias
    const shopifyContext: ShopifyAnalysisContext | undefined = poster.shopifyProductId ? {
      // Only include analysis-derived fields if NOT force re-analyzing
      // This prevents confirmation bias when user wants a fresh look
      artist: forceReanalyze ? undefined : poster.artist,
      estimatedDate: forceReanalyze ? undefined : poster.estimatedDate,
      printingTechnique: forceReanalyze ? undefined : poster.printingTechnique,
      // Always include factual/user-provided context (not AI-derived)
      dimensions: poster.dimensionsEstimate,
      condition: poster.condition,
      conditionDetails: poster.conditionDetails,
      title: poster.title,
      // userNotes may contain auction descriptions - valuable context
      auctionDescription: poster.userNotes,
    } : undefined;

    // Analyze with Claude (including any supplemental images and Shopify context)
    const analysis = await analyzePoster(
      poster.imageUrl,
      combinedInfo || undefined,
      poster.productType || undefined,
      poster.supplementalImages || undefined,
      shopifyContext
    );

    console.log('Analysis completed successfully');

    // Flatten analysis for database storage
    const flattenedAnalysis = flattenAnalysis(analysis);

    // Update poster with analysis results
    const updatedPoster = await updatePosterAnalysis(posterId, {
      ...flattenedAnalysis,
      rawAiResponse: analysis,
    });

    // Auto-link to artist, printer, and publisher records
    // Creates new records if needed, fetching Wikipedia data automatically
    const linkResults = await autoLinkPosterEntities(posterId, {
      artist: flattenedAnalysis.artist,
      artistConfidence: flattenedAnalysis.artistConfidence,
      printer: flattenedAnalysis.printer,
      printerConfidence: flattenedAnalysis.printerConfidence,
      publication: analysis.historicalContext?.publication,
    });

    if (linkResults.artistLinked || linkResults.printerLinked || linkResults.publisherLinked) {
      console.log('Auto-linked entities:', {
        artist: linkResults.artistLinked ? `ID ${linkResults.artistLinked.id}${linkResults.artistLinked.isNew ? ' (new)' : ''}` : null,
        printer: linkResults.printerLinked ? `ID ${linkResults.printerLinked.id}${linkResults.printerLinked.isNew ? ' (new)' : ''}` : null,
        publisher: linkResults.publisherLinked ? `ID ${linkResults.publisherLinked.id}${linkResults.publisherLinked.isNew ? ' (new)' : ''}` : null,
      });
    }

    return NextResponse.json({
      success: true,
      posterId: updatedPoster.id,
      analysis,
      linkedEntities: linkResults,
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
