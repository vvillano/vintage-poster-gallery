import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getPosterById, updatePosterAnalysis } from '@/lib/db';
import { getTagNames } from '@/lib/tags';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const posterId = parseInt(id);
    if (isNaN(posterId)) {
      return NextResponse.json({ error: 'Invalid poster ID' }, { status: 400 });
    }

    const poster = await getPosterById(posterId);
    if (!poster) {
      return NextResponse.json({ error: 'Poster not found' }, { status: 404 });
    }

    // Get current tag list
    const tagList = await getTagNames();
    if (tagList.length === 0) {
      return NextResponse.json({ error: 'No tags configured' }, { status: 400 });
    }

    // Build context from existing analysis
    const context = [
      poster.title && `Title: ${poster.title}`,
      poster.artist && `Artist: ${poster.artist}`,
      poster.estimatedDate && `Date: ${poster.estimatedDate}`,
      poster.productType && `Type: ${poster.productType}`,
      poster.printingTechnique && `Technique: ${poster.printingTechnique}`,
      poster.historicalContext && `Context: ${poster.historicalContext}`,
      poster.rawAiResponse?.historicalContext?.periodMovement &&
        `Style/Movement: ${poster.rawAiResponse.historicalContext.periodMovement}`,
      poster.rawAiResponse?.historicalContext?.publication &&
        `Publication: ${poster.rawAiResponse.historicalContext.publication}`,
    ].filter(Boolean).join('\n');

    // Call Haiku for tag suggestions (much cheaper than Opus)
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'url',
                url: poster.imageUrl,
              },
            },
            {
              type: 'text',
              text: `Based on this vintage item image and the following details, select 3-8 tags that best categorize it.

ITEM DETAILS:
${context || 'No details available - analyze the image directly.'}

AVAILABLE TAGS (only use tags from this exact list):
${tagList.join(', ')}

Choose tags based on: subject matter, art style/movement, time period, publication type, and themes.

Respond with ONLY a JSON array of tag names, nothing else. Example: ["Art Deco", "Travel & Destinations", "Aviation"]`,
            },
          ],
        },
      ],
    });

    // Extract tags from response
    const textContent = response.content.find(block => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No response from Claude');
    }

    // Parse the JSON array
    let suggestedTags: string[] = [];
    try {
      // Find JSON array in response
      const match = textContent.text.match(/\[[\s\S]*\]/);
      if (match) {
        suggestedTags = JSON.parse(match[0]);
        // Filter to only valid tags from our list
        suggestedTags = suggestedTags.filter(tag => tagList.includes(tag));
      }
    } catch (parseError) {
      console.error('Failed to parse tag response:', textContent.text);
      throw new Error('Failed to parse tag suggestions');
    }

    // Update the poster's rawAiResponse with new suggested tags
    const updatedRawResponse = {
      ...poster.rawAiResponse,
      suggestedTags,
    };

    await updatePosterAnalysis(posterId, {
      rawAiResponse: updatedRawResponse,
    });

    return NextResponse.json({
      success: true,
      suggestedTags,
    });
  } catch (error) {
    console.error('Refresh tags error:', error);
    return NextResponse.json(
      {
        error: 'Failed to refresh tags',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
