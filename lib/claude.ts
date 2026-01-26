import Anthropic from '@anthropic-ai/sdk';
import type { PosterAnalysis, SourceCitation, SimilarProduct } from '@/types/poster';

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

/**
 * Perform web research on the poster to gather context and sources
 */
async function researchPoster(imageAnalysisPreview: string): Promise<string> {
  console.log('[researchPoster] Starting web research');

  try {
    // First, do a quick visual analysis to identify key search terms
    const quickAnalysis = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `Analyze this poster and extract: artist name (if visible/identifiable), title/subject, approximate era, and any visible text. Format as: Artist: X, Subject: Y, Era: Z, Text: W. Be concise.

${imageAnalysisPreview}`
      }]
    });

    const analysisText = quickAnalysis.content.find(b => b.type === 'text');
    if (!analysisText || analysisText.type !== 'text') {
      return '';
    }

    // Extract search terms from the quick analysis
    const searchContext = analysisText.text;
    console.log('[researchPoster] Quick analysis:', searchContext);

    // Note: The WebSearch tool would be called here in the actual implementation
    // For now, we'll return the context to be used by Claude
    return searchContext;
  } catch (error) {
    console.error('[researchPoster] Research error:', error);
    return '';
  }
}

// Brand voice - Concise guidelines based on 500+ product analysis (2024-2026)
const BRAND_VOICE_GUIDELINES = `
BRAND VOICE: Gallery-quality, art-historically grounded, adapts by product type.

STRUCTURE: Start with scene-setting or direct authority → Technical/historical details → Significance → Curatorial closing.

KEY VOCABULARY: "marked a turning point", "golden era", "captures the spirit", "transforms", "bridges", "embodies", "A standout piece for..."

ADAPT BY TYPE:
- Posters: Most sophisticated, art-historical depth, printing techniques
- Cover Art: Playful but informed, publication context
- Antique Prints: Scholarly, provenance-focused, scientific accuracy
- Illustrations: Witty, culturally observant, narrative freedom

AVOID: Exclamation points, generic phrases ("perfect for your wall"), casual language ("Wow!", "Amazing!"), size/condition details.

EXAMPLES: "marked a turning point in modern design", "turns political graphics into something sharp and unforgettable", "captures the spirit of the era with bold geometric forms"
`;


// Construct analysis prompt with optional initial information, research context, and product type
function buildAnalysisPrompt(initialInfo?: string, researchContext?: string, productType?: string): string {
  const basePrompt = `Analyze this ${productType || 'vintage item'} as JSON.

ACCURACY: Artist name EXACTLY as visible. Use "likely/appears" for uncertain printing technique. Only cite specific pages, no generic collections.

SEARCH: "${productType || 'item'} [Artist] [Title] [Year] original" to find exact listings.${initialInfo ? `\nUSER INFO: "${initialInfo}" - validate.` : ''}

DESCRIPTION (150-175 words, 1 para): ${BRAND_VOICE_GUIDELINES.replace(/\n\n/g, ' ')}

LISTINGS: THIS EXACT item only (same title/artist/date). Empty array if none.

JSON:
{
  "identification": {"artist": "", "title": "", "estimatedDate": "", "estimatedDimensions": ""},
  "historicalContext": {"periodMovement": "", "culturalSignificance": "", "originalPurpose": ""},
  "technicalAnalysis": {"printingTechnique": "", "colorPalette": "", "typography": "", "composition": ""},
  "conditionAuthenticity": {"ageIndicators": [], "conditionIssues": []},
  "rarityValue": {"rarityAssessment": "", "valueFactors": [], "comparableExamples": "", "collectorInterest": ""}${initialInfo ? `,\n  "validationNotes": ""` : ''},
  "productDescription": "",
  "sourceCitations": [{"claim": "", "source": "", "url": "", "reliability": "high|medium|low"}],
  "similarProducts": [{"title": "", "site": "", "url": "", "price": "", "condition": ""}]
}`;

  return basePrompt;
}

/**
 * Analyze a vintage poster image using Claude's vision capabilities
 * @param imageUrl - Public URL to the poster image (from Vercel Blob)
 * @param initialInformation - Optional user-provided information to validate
 * @returns Structured poster analysis
 */
export async function analyzePoster(
  imageUrl: string,
  initialInformation?: string,
  productType?: string
): Promise<PosterAnalysis> {
  try {
    console.log('[analyzePoster] Starting analysis for image:', imageUrl);

    // Verify API key is configured
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not configured');
    }

    const prompt = buildAnalysisPrompt(initialInformation, undefined, productType);
    console.log('[analyzePoster] Prompt length:', prompt.length, 'characters');
    console.log('[analyzePoster] Initial information:', initialInformation ? initialInformation.substring(0, 100) : 'none');
    console.log('[analyzePoster] Product type:', productType);
    console.log('[analyzePoster] Image URL:', imageUrl);
    console.log('[analyzePoster] Calling Claude API...');

    // Call Claude with vision capabilities
    // Using Claude Sonnet 4.5 (current model as of 2026)
    let response;
    try {
      response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 8000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'url',
                  url: imageUrl,
                },
              },
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
      });
    } catch (apiError: any) {
      console.error('[analyzePoster] Claude API call failed:', apiError);
      console.error('[analyzePoster] Error details:', {
        message: apiError.message,
        status: apiError.status,
        type: apiError.type,
        error: apiError.error,
      });
      throw new Error(`Claude API error: ${apiError.message || 'Unknown API error'}`);
    }

    console.log('[analyzePoster] Claude API response received');
    console.log('[analyzePoster] Response object:', JSON.stringify(response, null, 2).substring(0, 1000));

    // Check if response has the expected structure
    if (!response.content || !Array.isArray(response.content)) {
      console.error('[analyzePoster] Unexpected response structure:', response);
      throw new Error('Unexpected response structure from Claude API');
    }

    // Extract the text response
    const textContent = response.content.find((block) => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      console.error('[analyzePoster] No text block in response:', response.content);
      throw new Error('No text response from Claude');
    }

    console.log('[analyzePoster] Raw response preview (first 500 chars):', textContent.text.substring(0, 500));
    console.log('[analyzePoster] Response length:', textContent.text.length);

    // Trim whitespace for error checking
    const trimmedText = textContent.text.trim();

    // Check if response looks like an error message (with various patterns)
    const errorPatterns = ['Request', 'Error', 'Exception', 'Failed', 'Invalid'];
    const startsWithError = errorPatterns.some(pattern => trimmedText.startsWith(pattern));

    if (startsWithError || trimmedText.length < 100) {
      console.error('[analyzePoster] Response appears to be an error message or too short:', trimmedText);
      throw new Error(`Claude API returned an error: ${trimmedText.substring(0, 200)}`);
    }

    // Parse the JSON response - find the first { and last } to extract clean JSON
    const firstBrace = textContent.text.indexOf('{');
    const lastBrace = textContent.text.lastIndexOf('}');

    if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
      console.error('[analyzePoster] No valid JSON structure found in response');
      console.error('[analyzePoster] Full response (first 2000 chars):', textContent.text.substring(0, 2000));
      console.error('[analyzePoster] Response length:', textContent.text.length);
      console.error('[analyzePoster] First 200 chars (raw):', JSON.stringify(textContent.text.substring(0, 200)));
      throw new Error('No valid JSON found in Claude response. Response may be truncated or malformed. Check logs for details.');
    }

    const jsonString = textContent.text.substring(firstBrace, lastBrace + 1);
    console.log('[analyzePoster] Extracted JSON preview (first 300 chars):', jsonString.substring(0, 300));
    console.log('[analyzePoster] JSON string length:', jsonString.length);

    // Validate JSON string looks reasonable
    if (jsonString.length < 500) {
      console.warn('[analyzePoster] JSON string suspiciously short:', jsonString.length, 'chars');
      console.warn('[analyzePoster] Full extracted JSON:', jsonString);
    }

    let analysis: PosterAnalysis;
    try {
      analysis = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('[analyzePoster] JSON parse error:', parseError);
      console.error('[analyzePoster] Attempted to parse (first 1500 chars):', jsonString.substring(0, 1500));
      console.error('[analyzePoster] Last 500 chars:', jsonString.substring(Math.max(0, jsonString.length - 500)));
      throw new Error(`Failed to parse JSON response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}. Check logs for full response.`);
    }

    // Validate the structure
    if (!analysis.identification || !analysis.historicalContext) {
      throw new Error('Invalid analysis structure returned from Claude');
    }

    // Ensure new fields have defaults if missing
    if (!analysis.productDescription) {
      analysis.productDescription = '';
    }
    if (!analysis.sourceCitations) {
      analysis.sourceCitations = [];
    }
    if (!analysis.similarProducts) {
      analysis.similarProducts = [];
    }

    console.log('[analyzePoster] Analysis parsed successfully');
    return analysis;
  } catch (error) {
    console.error('[analyzePoster] Error analyzing poster with Claude:', error);

    // Log detailed error information
    if (error && typeof error === 'object') {
      console.error('[analyzePoster] Error details:', JSON.stringify(error, null, 2));
    }

    throw new Error(
      `Failed to analyze poster: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Convert analysis object to flattened format for database storage
 */
export function flattenAnalysis(analysis: PosterAnalysis) {
  return {
    artist: analysis.identification.artist,
    title: analysis.identification.title,
    estimatedDate: analysis.identification.estimatedDate,
    dimensionsEstimate: analysis.identification.estimatedDimensions,
    historicalContext: `${analysis.historicalContext.periodMovement}\n\n${analysis.historicalContext.culturalSignificance}\n\nOriginal Purpose: ${analysis.historicalContext.originalPurpose}`,
    significance: analysis.historicalContext.culturalSignificance,
    printingTechnique: analysis.technicalAnalysis.printingTechnique,
    rarityAnalysis: `${analysis.rarityValue.rarityAssessment}\n\n${analysis.rarityValue.comparableExamples}`,
    valueInsights: `Collector Interest: ${analysis.rarityValue.collectorInterest}\n\nValue Factors:\n${analysis.rarityValue.valueFactors.map((f) => `- ${f}`).join('\n')}`,
    validationNotes: analysis.validationNotes || undefined,
    productDescription: analysis.productDescription,
    sourceCitations: analysis.sourceCitations,
    similarProducts: analysis.similarProducts,
  };
}
