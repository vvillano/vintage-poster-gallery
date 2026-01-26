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

// Brand voice - Comprehensive analysis of 500+ products across all categories (2024-2026)
const BRAND_VOICE_GUIDELINES = `
BRAND VOICE: Authentic Vintage Posters (Comprehensive Style Guide)

CORE SOPHISTICATION:
- Gallery-quality writing with narrative confidence
- Art-historically grounded yet accessible storytelling
- Adapts tone by product type while maintaining authority
- Educational without being academic or stuffy
- Positions items as cultural artifacts and visual history

OPENING STRATEGIES (vary by impact):
1. Scene-setting: "Somewhere between slapstick and noir..." / "Step back in time..."
2. Direct authority: "This original poster was created for..." / "Published in 1900..."
3. Confident statement: "Victor Moscoso's Neon Rose posters defined the look..."
4. Evocative framing: "This bold 1973 Cuban silkscreen turns political graphics into..."
5. Time-travel invitation: "Travel to a moment of American economic ambition..."

MIDDLE SECTION ARCHITECTURE:
- Technical details: printing methods (steel engraving, chromolithograph, silkscreen)
- Historical context: movements, periods, cultural moments
- Artist/publisher biography: "One of France's most respected cartographers..."
- Significance: "marked a turning point", "defined the visual identity", "golden era"
- Use "bridges", "captures", "transforms", "distills", "embodies"

CLOSING FORMULAS (sophisticated positioning):
- "A standout piece for [specific collectors]..."
- "A must-have for collectors of [categories]..."
- "Perfect for anyone drawn to [aesthetic/era/genre]..."
- End with curatorial framing, not generic appeals

SOPHISTICATED VOCABULARY PATTERNS:
- TRANSFORMATIVE: "transforms", "distills", "reimagines", "turns [X] into [Y]"
- CULTURAL: "emblems of", "spirit of", "defined the look of", "embodied"
- ARTISTIC: "rendered with", "captures", "showcases", "reflects"
- HISTORICAL: "marked a turning point", "golden era", "landmark", "revolutionary"
- DESCRIPTIVE: "charged with", "infused with", "dripping in", "saturated"

PRODUCT TYPE ADAPTATIONS:

VINTAGE POSTERS (most sophisticated):
- Art-historical depth, movement analysis
- "signature mastery of", "deliberately played with limits"
- Technical printing details emphasized
- Cultural/political context when relevant

COVER ART (playful but informed):
- More personality: "dripping in vintage decorum", "cheeky sophistication"
- Magazine/publication context always included
- Balance wit with historical grounding
- "Experience the charm of..." / "Established in 1925..."

ANTIQUE PRINTS (scholarly, provenance-focused):
- Formal tone with scientific accuracy
- Publication details, artist credits, engraving methods
- "exquisite botanical print", "exceptional skill", "finest examples"
- Emphasize rarity and historical significance

ILLUSTRATIONS (witty, culturally observant):
- More narrative freedom, scene descriptions
- Political/social commentary welcome
- "Step back in time...", "where wit and artistry collide"
- Cultural treasures framing

AVOID COMPLETELY:
- Excessive exclamation points in formal descriptions
- Generic phrases: "perfect for your wall", "great conversation starter"
- Size/condition details (handled separately in product specs)
- Overly casual: "Wow!", "How cool!", "Amazing!"
- Corporate/stiff language

SIGNATURE PHRASES (use often):
- "A standout piece for..."
- "Golden era of..."
- "Marked a turning point in..."
- "Defined the visual identity of..."
- "Embodies the spirit of..."
- "Bridges [X] and [Y]"
- "Equal parts [X] and [Y]"
- "Capturing the [quality] at the heart of..."

REAL EXAMPLES FROM YOUR CATALOG:

Olympic Poster: "marked a turning point in modern design...influenced international design standards for decades"
Cuban Poster: "turns political graphics into something sharp, symbolic, and unforgettable"
Travel Poster: "captures the spirit of the era with bold geometric forms, saturated color, and playful modernist figures"
Egyptian Poster: "captures the chaos at the heart of one of cinema's most inventive hybrids"
Blues Project: "The design showcases Moscoso's signature mastery of vibrating colors..."
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
