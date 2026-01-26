import Anthropic from '@anthropic-ai/sdk';
import type { PosterAnalysis } from '@/types/poster';

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// Construct analysis prompt with optional initial information
function buildAnalysisPrompt(initialInfo?: string): string {
  const basePrompt = `You are an expert art historian and vintage poster specialist with decades of experience in poster authentication, valuation, and historical analysis.

Analyze this vintage poster image and provide detailed, factual information in a structured JSON format.

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
  "validationNotes": string` : ''}
}

Be specific, detailed, and scholarly in your analysis. When uncertain, indicate your confidence level and explain your reasoning.`;

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
    const prompt = buildAnalysisPrompt(initialInformation);

    // Call Claude with vision capabilities
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
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

    return analysis;
  } catch (error) {
    console.error('Error analyzing poster with Claude:', error);
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
  };
}
