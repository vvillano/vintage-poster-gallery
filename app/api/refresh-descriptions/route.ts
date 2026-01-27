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

    // Generate new descriptions using Haiku (cheaper for text generation)
    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: `Based on this vintage item analysis, write 4 product descriptions in different tones. Each should be 150-200 words (2-3 paragraphs).

ITEM DETAILS:
${context}

TONE GUIDELINES:
- "standard": ${BRAND_VOICE}
- "scholarly": Academic tone - formal language, detailed provenance, art-historical analysis, museum-quality descriptions
- "concise": Just the facts - bullet-point style in prose, key details only, no flowery language
- "enthusiastic": Collector-focused - energetic but not cheesy, highlights appeal and rarity

Return ONLY valid JSON:
{"standard": "...", "scholarly": "...", "concise": "...", "enthusiastic": "..."}`
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
    const descriptions: ProductDescriptions = JSON.parse(jsonString);

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
