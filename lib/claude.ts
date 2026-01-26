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

// Brand voice guidelines - Based on Authentic Vintage Posters' current evolved style (2024-2026)
const BRAND_VOICE_GUIDELINES = `
BRAND VOICE: Authentic Vintage Posters (Current Style)

EVOLVED TONE & SOPHISTICATION:
- Gallery-quality writing with accessible intelligence
- Measured enthusiasm - sophisticated rather than exclamatory
- Art-historically grounded with deep contextual research
- Educational storytelling that positions pieces as cultural artifacts
- Bridge fine art and popular culture through informed analysis

STRUCTURE (2-3 tight paragraphs):
1. OPENING: Punchy, confident statement establishing significance
   - Short, powerful opening sentences: "Truth, justice, and pure graphic power."
   - Or sophisticated framing: "A striking blend of spectacle and satire..."
   - Immediately identify artist, date, and cultural context
   - Use "Titled [Name]" or "Created in [Year]" for formal grounding

2. MIDDLE: Deep dive into artistic/historical significance
   - Technical art details: printing methods, artistic techniques, composition
   - Historical provenance and cultural context
   - Artist biography and career context when relevant
   - Explain WHY it matters - movement, influence, innovation
   - Use phrases like "bridges X and Y", "equal parts X and Y"

3. CLOSING: Sophisticated collector positioning
   - "A must-have for collectors of..." (not "perfect addition")
   - "A bold addition to any collection of..."
   - Position within collecting categories (genre, artist, movement)
   - End with curatorial framing, not emotional appeals

CURRENT LANGUAGE PATTERNS:
- "expressive language of", "painterly compositions", "pure visual energy"
- "theatrical stillness", "pageantry and absurdity", "cultural document"
- "bridges the classical tradition", "equal parts X and contemporary Y"
- "instantly recognizable style", "signature [element]"
- Technical terms: "stone lithography", "offset printing", "caricatural flair"
- Art movements: cite specific styles, periods, influences

SOPHISTICATED VOCABULARY TO USE:
- "rendered with", "formed through", "emerges from"
- "charged with drama", "rooted in", "vehicle for"
- "captures the transformation", "honors creators"
- "distinct vibrancy", "landmark of", "groundbreaking blend"

AVOID:
- Excessive exclamation points (use sparingly, if at all)
- Overly casual language ("Wow!", "What a work of art!")
- Size and condition details (handled separately)
- Generic collector appeals ("perfect for your wall")
- Cutesy or overly enthusiastic phrasing

STRUCTURE EXAMPLES FROM RECENT WORK:
Opening: "Truth, justice, and pure graphic power. Issued in 1988..."
Opening: "A striking blend of spectacle and satire, this original 1999..."
Opening: "Created in 1967, this poster by LeRoy Neiman presents the matador through his signature expressive language..."

Closing: "A must-have for collectors of superhero history, DC Comics memorabilia, or vintage comic-inspired poster art."
Closing: "A bold addition to any collection of bullfighting ephemera, Spanish art, or Botero originals."
Closing: "Equal parts cultural document and contemporary art, this poster bridges the classical tradition..."
`;

// Construct analysis prompt with optional initial information and research context
function buildAnalysisPrompt(initialInfo?: string, researchContext?: string): string {
  const basePrompt = `You are an expert art historian and vintage poster specialist with decades of experience in poster authentication, valuation, and historical analysis.

Analyze this vintage poster image and provide detailed, factual information in a structured JSON format.

${researchContext ? `RESEARCH CONTEXT:\n${researchContext}\n\n` : ''}

Your analysis should include:

1. IDENTIFICATION
   - Artist/Designer: Provide the artist's name if identifiable, or "Unknown" if uncertain
   - Title: The poster's title or a clear description of the subject matter
   - Estimated Date: Year or decade of creation
   - Estimated Dimensions: Based on visual proportions and typical poster sizes of the period

2. HISTORICAL CONTEXT
   - Period/Movement: Art movement, historical period, or style (Art Nouveau, Art Deco, Constructivism, etc.)
   - Cultural Significance: Why this poster matters historically or culturally
   - Original Purpose: Advertising, propaganda, event promotion, political campaign, etc.

3. TECHNICAL ANALYSIS
   - Printing Technique: Lithography, screen printing, offset printing, letterpress, etc. - be specific
   - Color Palette: Notable color choices, number of colors, and what they suggest about the printing process
   - Typography: Font styles, hand-lettering, and their significance to the period
   - Composition: Layout principles, visual hierarchy, artistic techniques employed

4. CONDITION & AUTHENTICITY
   - Age Indicators: What visual elements suggest this is period-original vs. a reproduction
   - Condition Issues: Typical wear patterns, fading, creasing, restoration to look for

5. RARITY & VALUE
   - Rarity Assessment: Common, Scarce, Rare, or Very Rare - with reasoning
   - Value Factors: What affects this poster's market value
   - Comparable Examples: Reference similar posters or artists for context
   - Collector Interest: Current market demand and collector appeal

${initialInfo ? `
IMPORTANT VALIDATION TASK:
The user has provided the following preliminary information about this poster:

"${initialInfo}"

Please cross-reference this information with what you observe in the image:
- Validate the accuracy of any claims made in the preliminary information
- Correct any inaccuracies you identify with clear reasoning
- Add context or clarification where the information is incomplete or vague
- Indicate your confidence level (High/Medium/Low) in any corrections you make
- Note specific discrepancies between the provided info and your visual analysis

Include a "VALIDATION NOTES" section specifically addressing how the provided information compares to your analysis.
` : ''}

6. PRODUCT DESCRIPTION
   ${BRAND_VOICE_GUIDELINES}
   - Write a 2-3 paragraph marketing description suitable for an e-commerce listing
   - Emphasize historical significance, artistic merit, and collectability
   - Make it engaging and informative while maintaining authenticity

7. SOURCE CITATIONS
   - For each major claim (artist attribution, date, historical facts), provide sources
   - Include museum websites, auction records, art history references, or scholarly sources
   - Rate reliability: high (museums, academic), medium (established dealers), low (unverified)
   - Format: Array of {claim, source, url, reliability}

8. SIMILAR PRODUCTS
   - Identify where collectors might find similar posters online
   - Search terms for eBay, Heritage Auctions, other galleries
   - Include specific recommendations with reasoning
   - Format: Array of {title, site, url, price, condition} where available

RESPONSE FORMAT:
Provide your analysis as a valid JSON object with this exact structure:
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

Be specific, detailed, and scholarly in your analysis. When uncertain, indicate your confidence level and explain your reasoning. Provide real, verifiable URLs for citations and similar products.`;

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
  initialInformation?: string
): Promise<PosterAnalysis> {
  try {
    console.log('[analyzePoster] Starting analysis for image:', imageUrl);

    // Verify API key is configured
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not configured');
    }

    const prompt = buildAnalysisPrompt(initialInformation);
    console.log('[analyzePoster] Calling Claude API...');

    // Call Claude with vision capabilities
    // Using Claude Sonnet 4.5 (current model as of 2026)
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
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

    console.log('[analyzePoster] Claude API response received');

    // Extract the text response
    const textContent = response.content.find((block) => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    // Parse the JSON response
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No valid JSON found in Claude response');
    }

    const analysis: PosterAnalysis = JSON.parse(jsonMatch[0]);

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
