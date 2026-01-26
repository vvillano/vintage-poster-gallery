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
      model: 'claude-sonnet-4-5',
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
  const basePrompt = `Expert art historian: Analyze this ${productType || 'vintage item'} and provide detailed JSON.

${researchContext ? `CONTEXT: ${researchContext}\n\n` : ''}

${productType ? `PRODUCT TYPE: ${productType}
Use this to guide your search strategy and analysis focus. Different product types require different approaches:
- Posters: Focus on artist, printing method, promotional context
- Window Cards: Note card stock material, display purpose
- Cover Art: Identify publication name and date
- Illustration: Determine if magazine/book illustration
- Antique Print: Check if book plate or portfolio print (100+ years)
- Product Label: Identify product and packaging context
` : ''}

ACCURACY REQUIREMENTS:
- ARTIST NAME: Use EXACTLY what's visible. "Frank Horr" ≠ "Frank Horrabin" unless you cite a source proving the connection.
- PRINTING TECHNIQUE: Be conservative. Use "likely offset lithography" or "appears to be screen-printed" unless definitively visible.
- CITATIONS: Every specific claim MUST have a source. No generic collection pages or broken links.

SEARCH STRATEGY FOR FINDING EXACT MATCHES:
Construct a Google Image search query: "${productType || 'vintage item'} [Artist Name] [Title/Subject] [Year] original"
Examples:
- Poster: "poster Raymond Savignac Verigoud 1955 original"
- Window Card: "window card Bataan 1943 Jacques Kapralik original"
- Cover Art: "cover art Fortune magazine October 1952 original"

Use this search strategy to find EXACT LISTINGS of THIS specific item currently for sale.

SECTIONS:
1. IDENTIFICATION: Artist (exactly as shown), title, date, dimensions
2. HISTORICAL CONTEXT: Period/movement, significance, original purpose
3. TECHNICAL: Printing (with qualifiers), color palette, typography, composition
4. CONDITION & AUTHENTICITY: Age indicators, condition issues
5. RARITY & VALUE: Assessment, value factors, comparables, collector interest

${initialInfo ? `
6. VALIDATION: User provided: "${initialInfo}"
   Cross-check with image. Note discrepancies with confidence levels (High/Medium/Low).
` : ''}

7. PRODUCT DESCRIPTION - CRITICAL REQUIREMENTS:
   ${BRAND_VOICE_GUIDELINES}

   LENGTH: Single paragraph, 150-175 words (NOT 2-3 paragraphs!)
   STRUCTURE: Opening hook → Technical/historical details → Significance → Curatorial closing
   VOICE: ${productType ? `Use ${productType} voice adaptation from guidelines above` : 'Gallery-quality, sophisticated'}

8. SOURCE CITATIONS - STRICT REQUIREMENTS:
   - Only cite SPECIFIC pages about THIS artist/work/series
   - NO homepage URLs, NO search pages, NO collection indexes
   - NO broken links - verify URLs work
   - Each citation must prove a specific claim
   - Format: {claim: "specific fact", source: "Source Name", url: "https://...", reliability: "high/medium/low"}
   - If you cannot find a verifiable source, mark reliability as "low" or omit the claim

9. AVAILABLE LISTINGS - EXACT MATCHES ONLY:
   - Find THIS EXACT item (same title, artist, date) currently for sale
   - Search: eBay active + sold listings, Invaluable, Heritage Auctions, poster dealers
   - Include ONLY direct links to THIS specific piece
   - NO generic searches, NO similar items, NO stylistically related works
   - If no exact matches found, return EMPTY array []
   - Format: {title: "Full title", site: "eBay/Invaluable/etc", url: "direct link", price: "if available", condition: "if noted"}

JSON FORMAT:
{
  "identification": {
    "artist": string,
    "title": string,
    "estimatedDate": string,
    "estimatedDimensions": string
  },
  "historicalContext": {
    "periodMovement": string,
    "culturalSignificance": string,
    "originalPurpose": string
  },
  "technicalAnalysis": {
    "printingTechnique": string,
    "colorPalette": string,
    "typography": string,
    "composition": string
  },
  "conditionAuthenticity": {
    "ageIndicators": string[],
    "conditionIssues": string[]
  },
  "rarityValue": {
    "rarityAssessment": string,
    "valueFactors": string[],
    "comparableExamples": string,
    "collectorInterest": string
  }${initialInfo ? `,
  "validationNotes": string` : ''},
  "productDescription": string,
  "sourceCitations": [
    {
      "claim": string,
      "source": string,
      "url": string,
      "reliability": "high" | "medium" | "low"
    }
  ],
  "similarProducts": [
    {
      "title": string,
      "site": string,
      "url": string,
      "price": string (optional),
      "condition": string (optional)
    }
  ]
}

Be specific and scholarly. Indicate confidence levels when uncertain. Use real, verifiable URLs.`;

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
    console.log('[analyzePoster] Calling Claude API...');

    // Call Claude with vision capabilities
    // Using Claude Sonnet 4.5 (current model as of 2026)
    let response;
    try {
      response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 6000,
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

    // Check if response looks like an error message
    if (textContent.text.startsWith('Request') || textContent.text.startsWith('Error')) {
      console.error('[analyzePoster] Response appears to be an error message:', textContent.text);
      throw new Error(`Claude API returned an error: ${textContent.text.substring(0, 200)}`);
    }

    // Parse the JSON response - find the first { and last } to extract clean JSON
    const firstBrace = textContent.text.indexOf('{');
    const lastBrace = textContent.text.lastIndexOf('}');

    if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
      console.error('[analyzePoster] No valid JSON structure found in response');
      console.error('[analyzePoster] Full response:', textContent.text.substring(0, 2000));
      throw new Error('No valid JSON found in Claude response. Response may be truncated or malformed.');
    }

    const jsonString = textContent.text.substring(firstBrace, lastBrace + 1);
    console.log('[analyzePoster] Extracted JSON preview (first 300 chars):', jsonString.substring(0, 300));
    console.log('[analyzePoster] JSON string length:', jsonString.length);

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
