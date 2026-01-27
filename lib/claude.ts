import Anthropic from '@anthropic-ai/sdk';
import type { PosterAnalysis, SourceCitation, SimilarProduct, ProductDescriptions, SupplementalImage } from '@/types/poster';
import { getTagNames } from '@/lib/tags';

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
      model: 'claude-opus-4-5-20251101',
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


// Construct analysis prompt with optional initial information, research context, product type, and tag list
function buildAnalysisPrompt(initialInfo?: string, researchContext?: string, productType?: string, hasSupplementalImages?: boolean, tagList?: string[]): string {
  const imageNote = hasSupplementalImages
    ? `\n\nIMPORTANT: Multiple images have been provided. The FIRST image is the primary item being analyzed. Additional images are supplemental reference photos that may show:
- Different angles or details (back, close-ups of signatures, condition issues)
- Related items or context (original advertisements, book/magazine it was published in)
- Provenance documentation (auction records, gallery labels, certificates)
Use ALL provided images to inform your analysis, cross-referencing details visible in different photos.`
    : '';

  const basePrompt = `Analyze this ${productType || 'vintage item'} as JSON.${imageNote}

CRITICAL - ARTIST IDENTIFICATION:
1. SYSTEMATICALLY examine ALL FOUR CORNERS of the image for signatures:
   - Lower LEFT corner (very common location for signatures)
   - Lower RIGHT corner (also very common)
   - Upper left and upper right corners
   - Along bottom edge, in margins, or integrated into the design
2. READ SIGNATURES CAREFULLY letter by letter - do not guess or assume names
   - If you see "Bade" do NOT assume it says "Paul" or another common name
   - Transcribe EXACTLY what is written, then research the full artist name
3. Look for printed artist credits near the title or in small text
4. CROSS-VERIFY the artist using multiple indicators:
   - Does the signature match the art style?
   - Is the publication/era consistent with when this artist was active?
   - Do other visible text elements (printer, date, publication) support this identification?
5. Research the exact transcribed name to find the artist's full name and career details
6. Set artistConfidence: "confirmed" ONLY if clearly signed AND verified through style/context, "likely" if strong evidence, "uncertain" if conflicting indicators, "unknown" if cannot determine
7. Set artistSource: describe EXACTLY where you found the name (e.g., "signature lower left corner reads 'Bade'", "printed credit below image")

DATE IDENTIFICATION:
1. Look for dates printed on the piece (often near printer info or copyright)
2. Check for exhibition dates, event dates, or publication years
3. Use style/technique to estimate period if no date visible
4. Set dateConfidence and dateSource similarly to artist

PRINTER/PUBLISHER:
- Look for printer marks, typically at bottom: "Imp.", "Imprimerie", "Printed by", etc.
- Common printers: Chaix, Lemercier, Verneau, etc.

PUBLICATION & CLIENT (when applicable):
- For cover art/illustrations: Identify the publication (The New Yorker, Fortune, La Vie Parisienne, Vogue, Saturday Evening Post, Popular Mechanics, etc.)
- For advertising: Identify the advertiser/client (e.g., Cognac Briand, Campari, Air France)
- IMPORTANT: The "publication" field should contain ONLY the publication name (e.g., "Popular Mechanics", "The New Yorker"), NOT a description
- Put any context about the publication (founding date, editorial focus, notable artists) in the eraContext field instead
- Use publication history to help verify artist identification and date

NOTABLE FIGURES - CRITICAL for historical context:
- Look for names of PEOPLE mentioned anywhere in the image text (corners, margins, captions, body text)
- Scientists, inventors, politicians, celebrities, historical figures - anyone named or depicted
- Check lower corners especially - credits, dedications, and subject identifications often appear there
- For portraits or depictions: identify who is being shown
- For scientific/educational prints: identify scientists, inventors, or researchers credited
- For political prints: identify politicians, rulers, or historical figures
- Include their role and why they're relevant to the piece
- This adds significant historical and educational value for collectors

ERA CONTEXT:
- Describe the historical/cultural moment when this was created
- How would contemporary audiences have perceived this piece?
- What social, political, or cultural currents does it reflect?

CROSS-VERIFICATION (CRITICAL):
- BEFORE finalizing artist identification, verify using MULTIPLE independent indicators:
  1. Signature/printed name (read EXACTLY, letter by letter)
  2. Art style and technique (does it match known works by this artist?)
  3. Publication/printer (who did this artist typically work with?)
  4. Time period (was this artist active during this era?)
  5. Subject matter (is this typical of the artist's oeuvre?)
- If indicators conflict, note the discrepancy and set lower confidence
- When artist is unknown, describe distinctive style elements that could aid identification

PRINTING TECHNIQUE - Be precise:
- Stone lithograph (litho from limestone, often visible texture)
- Chromolithograph (multi-color litho, typically 5+ color runs)
- Offset lithograph (modern, smoother appearance)
- Photolithograph, screenprint, etc.
- Look for registration marks, dot patterns, stone texture
${initialInfo ? `\nUSER CONTEXT: "${initialInfo}" - validate this against what you see in the image.` : ''}

PRODUCT DESCRIPTIONS: Write 4 versions (each 150-200 words, 2-3 paragraphs):
- "standard": ${BRAND_VOICE_GUIDELINES.replace(/\n\n/g, ' ').replace(/\n/g, ' ')}
- "scholarly": Academic tone - formal language, detailed provenance, art-historical analysis, museum-quality descriptions
- "concise": Just the facts - bullet-point style in prose, key details only, no flowery language, focus on: artist, date, technique, subject
- "enthusiastic": Collector-focused - energetic but not cheesy, highlights appeal and rarity, why someone would want this piece

TALKING POINTS: Write 6-8 bullet points for in-gallery storytelling. These help gallery staff engage customers with interesting facts and context. Include:
- Artist and date (if known)
- Notable visual elements or techniques (e.g., "Droste effect with the cats", "Bold Art Deco geometric forms")
- Interesting details visible in the image (e.g., "Tax stamp visible lower left", "Signed in the stone")
- CRITICAL - Named individuals: If any scientists, inventors, politicians, or historical figures are mentioned or depicted, include a talking point about who they were and why they're significant
- IMPORTANT: Historical/cultural context that tells a story:
  * What was happening in this region/country at this time?
  * If it's for an event (festival, exhibition, etc.), explain what that event was
  * What social, political, or cultural movements influenced this piece?
  * How would people at the time have experienced or used this item?
- Why collectors find this piece interesting
- Any fun facts, anecdotes, or surprising details about the artist, subject, or era
Keep each point 15-30 words - enough context to spark a conversation.

LISTINGS: Find THIS EXACT item only (same title/artist/date). Empty array if none found.
${tagList && tagList.length > 0 ? `
TAG SUGGESTIONS:
From the following master list of tags, select 3-8 tags that best describe this item.
Choose tags based on: subject matter, art style/movement, time period, publication type, and themes.
Only use tags from this exact list - do not create new tags.

AVAILABLE TAGS:
${tagList.join(', ')}
` : ''}
JSON:
{
  "identification": {
    "artist": "",
    "artistConfidence": "confirmed|likely|uncertain|unknown",
    "artistSource": "",
    "title": "",
    "estimatedDate": "",
    "dateConfidence": "confirmed|likely|uncertain|unknown",
    "dateSource": "",
    "estimatedDimensions": ""
  },
  "historicalContext": {"periodMovement": "", "culturalSignificance": "", "originalPurpose": "", "publication": "", "advertiser": "", "eraContext": ""},
  "technicalAnalysis": {
    "printingTechnique": "",
    "printer": "",
    "colorPalette": "",
    "typography": "",
    "composition": ""
  },
  "conditionAuthenticity": {"ageIndicators": [], "conditionIssues": []},
  "rarityValue": {"rarityAssessment": "", "valueFactors": [], "comparableExamples": "", "collectorInterest": ""}${initialInfo ? `,\n  "validationNotes": ""` : ''},
  "productDescriptions": {"standard": "", "scholarly": "", "concise": "", "enthusiastic": ""},
  "talkingPoints": ["point 1", "point 2", "..."],
  "notableFigures": [{"name": "Full Name", "role": "Scientist/Politician/etc", "context": "Why they appear in this piece", "wikiSearch": "search term for Wikipedia"}],
  "sourceCitations": [{"claim": "", "source": "", "url": "", "reliability": "high|medium|low"}],
  "similarProducts": [{"title": "", "site": "", "url": "", "price": "", "condition": ""}]${tagList && tagList.length > 0 ? `,
  "suggestedTags": ["tag1", "tag2", "..."]` : ''}
}`;

  return basePrompt;
}

/**
 * Analyze a vintage poster image using Claude's vision capabilities
 * @param imageUrl - Public URL to the poster image (from Vercel Blob)
 * @param initialInformation - Optional user-provided information to validate
 * @param productType - The type of product being analyzed
 * @param supplementalImages - Optional array of additional images for context
 * @returns Structured poster analysis
 */
export async function analyzePoster(
  imageUrl: string,
  initialInformation?: string,
  productType?: string,
  supplementalImages?: SupplementalImage[]
): Promise<PosterAnalysis> {
  try {
    console.log('[analyzePoster] Starting analysis for image:', imageUrl);
    console.log('[analyzePoster] Supplemental images:', supplementalImages?.length || 0);

    // Verify API key is configured
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not configured');
    }

    // Fetch current tag list for suggestions
    let tagList: string[] = [];
    try {
      tagList = await getTagNames();
      console.log('[analyzePoster] Fetched', tagList.length, 'tags for suggestions');
    } catch (tagError) {
      console.warn('[analyzePoster] Could not fetch tags, skipping tag suggestions:', tagError);
    }

    const hasSupplementalImages = supplementalImages && supplementalImages.length > 0;
    const prompt = buildAnalysisPrompt(initialInformation, undefined, productType, hasSupplementalImages, tagList);
    console.log('[analyzePoster] Prompt length:', prompt.length, 'characters');
    console.log('[analyzePoster] Initial information:', initialInformation ? initialInformation.substring(0, 100) : 'none');
    console.log('[analyzePoster] Product type:', productType);
    console.log('[analyzePoster] Image URL:', imageUrl);
    console.log('[analyzePoster] Calling Claude API...');

    // Build content array with primary image first, then supplemental images
    const contentArray: Array<{ type: 'image'; source: { type: 'url'; url: string } } | { type: 'text'; text: string }> = [
      {
        type: 'image',
        source: {
          type: 'url',
          url: imageUrl,
        },
      },
    ];

    // Add supplemental images with optional descriptions
    if (supplementalImages && supplementalImages.length > 0) {
      for (const img of supplementalImages) {
        // Add description text before each supplemental image if provided
        if (img.description) {
          contentArray.push({
            type: 'text',
            text: `[Supplemental image: ${img.description}]`,
          });
        }
        contentArray.push({
          type: 'image',
          source: {
            type: 'url',
            url: img.url,
          },
        });
      }
    }

    // Add the analysis prompt at the end
    contentArray.push({
      type: 'text',
      text: prompt,
    });

    // Call Claude with vision capabilities
    // Using Claude Opus 4.5 for maximum accuracy in artist/date identification
    let response;
    try {
      response = await anthropic.messages.create({
        model: 'claude-opus-4-5-20251101',
        max_tokens: 8000,
        messages: [
          {
            role: 'user',
            content: contentArray,
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

      // Check for specific error types
      if (apiError.status === 413 || apiError.message?.includes('too large') || apiError.message?.includes('size')) {
        throw new Error('Image file is too large for analysis. Claude API accepts images up to 5MB. Please upload a smaller image.');
      }

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
    if (!analysis.productDescriptions) {
      analysis.productDescriptions = {
        standard: '',
        scholarly: '',
        concise: '',
        enthusiastic: ''
      };
    }
    if (!analysis.talkingPoints) {
      analysis.talkingPoints = [];
    }
    if (!analysis.notableFigures) {
      analysis.notableFigures = [];
    }
    if (!analysis.sourceCitations) {
      analysis.sourceCitations = [];
    }
    if (!analysis.similarProducts) {
      analysis.similarProducts = [];
    }
    if (!analysis.suggestedTags) {
      analysis.suggestedTags = [];
    }

    console.log('[analyzePoster] Analysis parsed successfully');
    console.log('[analyzePoster] Suggested tags:', analysis.suggestedTags);
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
    artistConfidence: analysis.identification.artistConfidence,
    artistSource: analysis.identification.artistSource,
    title: analysis.identification.title,
    estimatedDate: analysis.identification.estimatedDate,
    dateConfidence: analysis.identification.dateConfidence,
    dateSource: analysis.identification.dateSource,
    dimensionsEstimate: analysis.identification.estimatedDimensions,
    historicalContext: `${analysis.historicalContext.periodMovement}\n\n${analysis.historicalContext.culturalSignificance}\n\nOriginal Purpose: ${analysis.historicalContext.originalPurpose}`,
    significance: analysis.historicalContext.culturalSignificance,
    printingTechnique: analysis.technicalAnalysis.printingTechnique,
    printer: analysis.technicalAnalysis.printer || undefined,
    rarityAnalysis: `${analysis.rarityValue.rarityAssessment}\n\n${analysis.rarityValue.comparableExamples}`,
    valueInsights: `Collector Interest: ${analysis.rarityValue.collectorInterest}\n\nValue Factors:\n${analysis.rarityValue.valueFactors.map((f) => `- ${f}`).join('\n')}`,
    validationNotes: analysis.validationNotes || undefined,
    productDescription: analysis.productDescriptions.standard,  // Default for backwards compat
    productDescriptions: analysis.productDescriptions,
    talkingPoints: analysis.talkingPoints,
    notableFigures: analysis.notableFigures,
    sourceCitations: analysis.sourceCitations,
    similarProducts: analysis.similarProducts,
    suggestedTags: analysis.suggestedTags,
  };
}
