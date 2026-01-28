import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getPosterById, updatePosterDescriptions } from '@/lib/db';
import Anthropic from '@anthropic-ai/sdk';
import type { ProductDescriptions } from '@/types/poster';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// Brand voice guidelines for descriptions
const BRAND_VOICE = `Gallery-quality, art-historically grounded, adapts by product type. Start with scene-setting or direct authority, then technical/historical details, significance, and curatorial closing. Use vocabulary like "marked a turning point", "golden era", "captures the spirit", "transforms", "embodies". Avoid exclamation points, generic phrases, casual language.`;

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { posterId } = body;

    if (!posterId) {
      return NextResponse.json({ error: 'Poster ID is required' }, { status: 400 });
    }

    // Get poster from database
    const poster = await getPosterById(posterId);
    if (!poster) {
      return NextResponse.json({ error: 'Poster not found' }, { status: 404 });
    }

    if (!poster.analysisCompleted) {
      return NextResponse.json(
        { error: 'Poster must be analyzed before refreshing descriptions' },
        { status: 400 }
      );
    }

    // Build context from existing analysis - support both rawAiResponse and legacy fields
    const analysis = poster.rawAiResponse || {};
    const context = `
Product Type: ${poster.productType || 'Vintage item'}
Artist: ${poster.artist || 'Unknown'}${poster.artistConfidence ? ` (${poster.artistConfidence})` : ''}
Title: ${poster.title || 'Untitled'}
Date: ${poster.estimatedDate || 'Unknown'}
Printing Technique: ${poster.printingTechnique || 'Unknown'}
Period/Movement: ${analysis.historicalContext?.periodMovement || 'Unknown'}
Cultural Significance: ${analysis.historicalContext?.culturalSignificance || poster.significance || ''}
Historical Context: ${poster.historicalContext || ''}
Publication: ${analysis.historicalContext?.publication || ''}
Advertiser: ${analysis.historicalContext?.advertiser || ''}
Rarity: ${analysis.rarityValue?.rarityAssessment || poster.rarityAnalysis || ''}
Collector Interest: ${analysis.rarityValue?.collectorInterest || poster.valueInsights || ''}
`.trim();

    // Generate new descriptions and talking points using Haiku (cheaper for text generation)
    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 2500,
      messages: [
        {
          role: 'user',
          content: `Based on this vintage item analysis, write 4 product descriptions in different tones plus talking points for in-gallery conversations.

ITEM DETAILS:
${context}

DESCRIPTIONS (150-200 words each):
- "standard": ${BRAND_VOICE} Write in 2-3 flowing paragraphs separated by double newlines.
- "scholarly": Academic tone - formal language, detailed provenance, art-historical analysis, museum-quality descriptions. Write in 2-3 paragraphs separated by double newlines.
- "concise": Short, factual sentences - each sentence states ONE key detail (artist, date, technique, subject, etc.). Write as plain sentences ending with periods. Do NOT use bullet point characters (•) or dashes. Example format: "1970 Italian film poster for The Wild Racers. Designed by artist P. Franco. Printed using offset lithography in Eastmancolor."
- "enthusiastic": Collector-focused - energetic but not cheesy, highlights appeal and rarity. Write in 2-3 paragraphs separated by double newlines.

TALKING POINTS (6-8 bullet points for in-gallery storytelling):
- Artist and date if known
- Notable visual elements or techniques
- IMPORTANT: Historical/cultural context that tells a story:
  * What was happening in this region/country at this time?
  * If it's for an event (festival, exhibition, etc.), explain what that event was
  * What social, political, or cultural movements influenced this piece?
- Why collectors find this piece interesting
- Any fun facts or surprising details about the artist, subject, or era
Keep each point 15-30 words - enough context to spark a conversation.

Return ONLY valid JSON:
{"standard": "...", "scholarly": "...", "concise": "...", "enthusiastic": "...", "talkingPoints": ["...", "..."]}`
        }
      ]
    });

    // Extract text response
    const textContent = response.content.find((block) => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    // Parse JSON
    const firstBrace = textContent.text.indexOf('{');
    const lastBrace = textContent.text.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1) {
      throw new Error('Invalid JSON response');
    }

    const jsonString = textContent.text.substring(firstBrace, lastBrace + 1);

    // Try to parse JSON, with fallback sanitization for control characters in strings
    let descriptions;
    try {
      descriptions = JSON.parse(jsonString);
    } catch (parseError) {
      // If parsing failed, escape control characters ONLY inside quoted strings
      // This preserves structural whitespace while fixing literal newlines in values
      const sanitized = jsonString.replace(
        /"(?:[^"\\]|\\.)*"/g,
        (match) => match.replace(/[\x00-\x1F\x7F]/g, (char) => {
          if (char === '\n') return '\\n';
          if (char === '\r') return '\\r';
          if (char === '\t') return '\\t';
          return '';
        })
      );
      descriptions = JSON.parse(sanitized);
    }

    // Update poster with new descriptions (updates both productDescription and rawAiResponse)
    await updatePosterDescriptions(posterId, descriptions);

    return NextResponse.json({
      success: true,
      descriptions,
    });
  } catch (error) {
    console.error('Refresh descriptions error:', error);
    return NextResponse.json(
      {
        error: 'Failed to refresh descriptions',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
