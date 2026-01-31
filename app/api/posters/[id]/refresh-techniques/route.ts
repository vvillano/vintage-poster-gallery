import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getPosterById, updatePosterRawAiResponse } from '@/lib/db';
import { sql } from '@vercel/postgres';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// Get all media type names for AI prompt
async function getMediaTypeNames(): Promise<string[]> {
  const result = await sql`
    SELECT name FROM media_types ORDER BY display_order, name
  `;
  return result.rows.map(row => row.name);
}

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

    // Get current media types list
    const techniqueList = await getMediaTypeNames();
    if (techniqueList.length === 0) {
      return NextResponse.json({ error: 'No printing techniques configured' }, { status: 400 });
    }

    // Build context from existing analysis
    const context = [
      poster.title && `Title: ${poster.title}`,
      poster.artist && `Artist: ${poster.artist}`,
      poster.estimatedDate && `Date: ${poster.estimatedDate}`,
      poster.productType && `Type: ${poster.productType}`,
      poster.printingTechnique && `Current technique (from initial analysis): ${poster.printingTechnique}`,
      poster.historicalContext && `Context: ${poster.historicalContext}`,
    ].filter(Boolean).join('\n');

    // Call Sonnet for technique suggestions (cost-efficient)
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
              text: `Based on this vintage item image and the following details, identify the printing technique(s) used.

ITEM DETAILS:
${context || 'No details available - analyze the image directly.'}

AVAILABLE TECHNIQUES (only use techniques from this exact list):
${techniqueList.join(', ')}

Look for visual indicators:
- Dot patterns (lithography vs offset lithography)
- Color registration and layering (chromolithograph)
- Hand-applied color evidence (hand colored)
- Engraving line characteristics (copper/steel engraving)
- Screen texture (screen print)
- Paper texture and ink absorption
- Pochoir stencil edges
- Woodcut textures and grain patterns

Select 1-3 techniques that best describe how this item was printed. Items may use multiple techniques (e.g., "Chromolithograph" + "Hand Colored").

Respond with ONLY a JSON array of technique names, nothing else. Example: ["Chromolithograph", "Hand Colored"]`,
            },
          ],
        },
      ],
    });

    // Extract techniques from response
    const textContent = response.content.find(block => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No response from Claude');
    }

    // Parse the JSON array
    let suggestedTechniques: string[] = [];
    try {
      // Find JSON array in response
      const match = textContent.text.match(/\[[\s\S]*\]/);
      if (match) {
        suggestedTechniques = JSON.parse(match[0]);
        // Filter to only valid techniques from our list
        suggestedTechniques = suggestedTechniques.filter(tech => techniqueList.includes(tech));
      }
    } catch (parseError) {
      console.error('Failed to parse technique response:', textContent.text);
      throw new Error('Failed to parse technique suggestions');
    }

    // Update only the rawAiResponse with new suggested techniques (preserves all other fields)
    const updatedRawResponse = {
      ...poster.rawAiResponse,
      suggestedPrintingTechniques: suggestedTechniques,
    };

    await updatePosterRawAiResponse(posterId, updatedRawResponse);

    return NextResponse.json({
      success: true,
      suggestedPrintingTechniques: suggestedTechniques,
    });
  } catch (error) {
    console.error('Refresh techniques error:', error);
    return NextResponse.json(
      {
        error: 'Failed to refresh printing techniques',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
