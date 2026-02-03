import Anthropic from '@anthropic-ai/sdk';
import type { PosterAnalysis, SourceCitation, SimilarProduct, ProductDescriptions, SupplementalImage, ShopifyReferenceImage } from '@/types/poster';
import { getTagNames } from '@/lib/tags';
import { getColorNames } from '@/lib/colors';

/**
 * Existing data from Shopify metafields to provide as context for analysis
 * This helps Claude verify and build upon existing catalog information
 */
export interface ShopifyAnalysisContext {
  artist?: string | null;
  estimatedDate?: string | null;
  dimensions?: string | null;
  condition?: string | null;
  conditionDetails?: string | null;
  printingTechnique?: string | null;
  title?: string | null;
  // Research-relevant notes (from jadepuma.item_notes) - provenance, auction catalog info
  // These are passed to AI analysis for verification
  itemNotes?: string | null;
  // Internal business notes (from jadepuma.internal_notes) - NOT passed to AI
  // Kept for backwards compatibility but should not be used for analysis
  auctionDescription?: string | null;  // @deprecated - use itemNotes instead
}

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

/**
 * Build a context section from Shopify metafield data
 * This data should be used to verify and enhance the analysis
 * @param context - Existing catalog data
 * @param skepticalMode - If true, exclude auction descriptions to prevent confirmation bias
 */
function buildShopifyContextSection(context: ShopifyAnalysisContext, skepticalMode: boolean = false): string {
  const parts: string[] = [];

  // In skeptical mode, we exclude previous AI-derived attributions entirely
  // Only include factual context that doesn't bias analysis
  if (!skepticalMode) {
    if (context.artist) {
      parts.push(`- Artist: "${context.artist}"`);
    }
    if (context.estimatedDate) {
      parts.push(`- Date: "${context.estimatedDate}"`);
    }
    if (context.printingTechnique) {
      parts.push(`- Medium/Technique: "${context.printingTechnique}"`);
    }
  }

  // Include dimensions if provided (note: may be AI-derived from previous analysis)
  // Caller should exclude this on re-analysis to allow fresh estimation
  if (context.dimensions) {
    parts.push(`- Dimensions: "${context.dimensions}" (verify against standard formats)`);
  }
  if (context.condition) {
    parts.push(`- Condition: "${context.condition}"`);
  }
  if (context.conditionDetails) {
    parts.push(`- Condition Details: "${context.conditionDetails}"`);
  }

  // In skeptical mode, EXCLUDE all research notes to prevent confirmation bias
  // In normal mode, use itemNotes (research-relevant) but NOT auctionDescription (business notes)
  const hasItemNotes = !skepticalMode && context.itemNotes && context.itemNotes.length > 30;
  if (hasItemNotes) {
    parts.push(`- Research Notes: "${context.itemNotes}"`);
  }

  // NOTE: auctionDescription (internal business notes) is intentionally NOT included
  // It may contain seller/transaction info that shouldn't influence AI analysis

  if (parts.length === 0) {
    return '';
  }

  // Different framing based on mode
  let contextSection: string;

  if (skepticalMode) {
    contextSection = `

FACTUAL CONTEXT (Physical attributes only - no previous attributions):
${parts.join('\n')}

NOTE: Previous artist/date/technique attributions have been EXCLUDED to allow fresh analysis.
Make your own independent determination based solely on visual evidence.
`;
  } else {
    contextSection = `

EXISTING CATALOG DATA & PROVENANCE:
The following information comes from auction catalogs, dealer notes, or prior research. Treat this as VALUABLE INTELLIGENCE - not gospel, but informed context worth considering and building upon.

${parts.join('\n')}
`;

    // Add specific instructions for handling research notes (only in normal mode)
    if (hasItemNotes) {
      contextSection += `
IMPORTANT - Verify claims in the research notes against visual evidence:
- Attribution claims ("attributed to...", "by...", "signed...", "manner of...")
- Publication sources ("from Harper's Weekly", "New Yorker cover", "Fortune magazine")
- Date claims ("circa 1890", "published March 1925", "early 20th century")
- Provenance ("from the collection of...", "estate of...", "ex-library")
- Historical context the AI might not independently know

For each claim found:
1. If visual evidence supports it → confirm with high confidence
2. If visual evidence contradicts it → note the discrepancy in validationNotes
3. If cannot verify but plausible → accept as likely and note "per research notes"
`;
    }
  }

  return contextSection;
}

// Comprehensive format reference for dimension estimation
const FORMAT_REFERENCE = `
STANDARD FORMATS BY PRODUCT TYPE (use for dimension estimation):

═══ MOVIE POSTERS ═══

US FORMATS (1909-present):
- One Sheet: 27" x 41" (most common, 1909-1985) → 27" x 40" (1985-present)
- Insert: 14" x 36" (tall/narrow, lobby display)
- Half Sheet: 22" x 28" (horizontal, 1920s-1980s)
- Window Card: 14" x 22" (blank top for theater info)
- Lobby Card: 11" x 14" (scene stills, sets of 8)
- Three Sheet: 41" x 81" (two pieces joined)
- Six Sheet: 81" x 81" (billboard size)

FRENCH FORMATS:
- Petite: 15.75" x 23.5" (40 x 60 cm)
- Moyenne: 23.5" x 31.5" (60 x 80 cm)
- Grande: 47" x 63" (120 x 160 cm) - NOTE: This is NOT 30x40!
- Double Grande: 63" x 94" (160 x 240 cm)

ITALIAN FORMATS:
- Locandina: 13" x 27" (33 x 70 cm) - door panel
- 2-Foglio: 39" x 55" (100 x 140 cm)
- 4-Foglio: 55" x 78" (140 x 200 cm)
- Fotobusta: 13" x 18" (Italian lobby card)

BRITISH FORMATS:
- Quad: 30" x 40" (76 x 102 cm) - HORIZONTAL ONLY (this is the only 30x40 format!)
- Double Crown: 20" x 30" (51 x 76 cm)
- One Sheet (UK): 27" x 40"

GERMAN FORMATS:
- A1: 23.4" x 33.1" (594 x 841 mm)
- A0: 33.1" x 46.8" (841 x 1189 mm)

JAPANESE FORMATS:
- B2: 20" x 29" (515 x 728 mm)
- B1: 29" x 41" (728 x 1030 mm)

AUSTRALIAN FORMATS:
- Daybill: 13" x 30" (1960s-present) or 15" x 40" (earlier)

═══ MAGAZINE COVERS & ILLUSTRATIONS ═══

THE NEW YORKER (1925-present):
- Cover/Page: 8.5" x 11" (standard magazine)
- Original artwork: typically 11" x 15" to 14" x 20"

LA VIE PARISIENNE (1863-1970):
- Standard: approximately 9" x 12"
- Cover plates often trimmed or mounted

SATURDAY EVENING POST (1897-1969):
- Cover: 10.75" x 13.75" (varied by era)

HARPER'S WEEKLY (1857-1916):
- Full page: 10.5" x 15.5"

FORTUNE MAGAZINE (1930-present):
- Cover: 11" x 14"

VOGUE/VANITY FAIR:
- Cover: approximately 10" x 13"

═══ ANTIQUE PRINTS & ENGRAVINGS ═══

AUDUBON PRINTS:
- Double Elephant Folio: 26.5" x 39.5" (Havell edition, 1827-1838)
- Royal Octavo: 6.5" x 10.25" (later editions, 1840-1844)
- Imperial Folio: 21" x 27" (Bien edition, 1860)

BOTANICAL/NATURAL HISTORY:
- Quarto: 9" x 12" typical
- Folio: 12" x 19" typical
- Small quarto: 7" x 10"
- Large quarto: 10" x 13"
- Imperial folio: 15" x 22"

═══ MAPS ═══
- Small atlas: 10" x 14"
- Standard atlas: 15" x 20" to 18" x 24"
- Large folio: 24" x 30"
- Wall map: 30" x 40" or larger

═══ PRODUCT LABELS ═══

FRUIT CRATE LABELS:
- Standard crate end: 10" x 11"
- Lug box: 7" x 11"
- Half crate: 6" x 9"

CIGAR BOX LABELS:
- Inner lid: typically 6" x 9"
- Outer: varies

═══ ADVERTISING POSTERS ═══

FRENCH COMMERCIAL (Belle Époque/Art Nouveau):
- Standard: 31" x 47" (80 x 120 cm)
- Grande: 47" x 63" (120 x 160 cm)
- Smaller: 24" x 32" (60 x 80 cm)

TRAVEL POSTERS:
- Standard: 24" x 36" or 25" x 39"
- European: often 24" x 39" or 27" x 39"

═══ WINDOW CARDS ═══
- Standard US: 14" x 22"
- Jumbo Window Card: 22" x 28"
`;

// Construct analysis prompt with optional initial information, research context, product type, tag list, and color list
function buildAnalysisPrompt(
  initialInfo?: string,
  researchContext?: string,
  productType?: string,
  hasSupplementalImages?: boolean,
  tagList?: string[],
  shopifyContext?: ShopifyAnalysisContext,
  colorList?: string[],
  skepticalMode?: boolean
): string {
  const imageNote = hasSupplementalImages
    ? `\n\nIMPORTANT: Multiple images have been provided. The FIRST image is the primary item being analyzed. Additional images are supplemental reference photos that may show:
- Different angles or details (back, close-ups of signatures, condition issues)
- Related items or context (original advertisements, book/magazine it was published in)
- Provenance documentation (auction records, gallery labels, certificates)
Use ALL provided images to inform your analysis, cross-referencing details visible in different photos.`
    : '';

  const skepticalModeNote = skepticalMode
    ? `\n\n⚠️ SKEPTICAL RE-ANALYSIS MODE ACTIVE ⚠️
You are being asked to RE-ANALYZE this item because previous analysis may be incorrect.
CRITICAL INSTRUCTIONS:
1. DO NOT simply confirm previous attributions - approach with completely fresh eyes
2. Actively look for ALTERNATIVE possibilities for any previous artist/date claims
3. Previous confidence scores are IRRELEVANT - make your own independent assessment
4. If you cannot INDEPENDENTLY verify an attribution from visual evidence, say so clearly
5. Look for evidence that might CONTRADICT previous analysis
6. It is BETTER to say "uncertain" or "unknown" than to repeat a potentially wrong attribution
7. READ SIGNATURES LETTER BY LETTER - do not assume you know what they say
8. Question whether the artist was actually an illustrator/poster artist (profession verification)`
    : '';

  const basePrompt = `Analyze this ${productType || 'vintage item'} as JSON.${imageNote}${skepticalModeNote}

DIMENSION ESTIMATION - Cross-reference with standard formats:
${FORMAT_REFERENCE}
When estimating dimensions, match to the closest standard format for this product type.
If dimensions conflict with a claimed format name, note the discrepancy.
Example: "30 x 40 French Grande" is WRONG - French Grande is 47x63. A 30x40 poster is likely a British Quad (horizontal).

CRITICAL - ARTIST IDENTIFICATION (Two-Step Process):

STEP 1: SIGNATURE READING (What is LITERALLY VISIBLE on the poster?)
1. SYSTEMATICALLY examine ALL FOUR CORNERS of the image for signatures:
   - Lower LEFT corner (very common location for signatures)
   - Lower RIGHT corner (also very common)
   - Upper left and upper right corners
   - Along bottom edge, in margins, or integrated into the design
2. READ SIGNATURES CAREFULLY letter by letter - do not guess or assume names
   - If you see "P. Verger" record EXACTLY "P. Verger" - do not expand to a full name yet
   - Transcribe EXACTLY what is written in signatureText field
3. Look for printed artist credits near the title or in small text
4. Set signatureReadable: true if there's a clear signature, false if none or illegible

CRITICAL - If NO signature is visible:
- Set signatureReadable: false
- Set signatureText: "" (empty string)
- Do NOT fabricate or infer a signature based on what you "think" the artist is
- Do NOT claim to see a name that is not actually written on the poster
- You may still attempt attribution via other means (STEP 2), but attribution WITHOUT visible signature must be flagged appropriately in attributionBasis

STEP 2: ARTIST ATTRIBUTION (Who do we think this is?)
After recording the exact signature (or noting none was found), determine attribution:

ATTRIBUTION BASIS - Select ONE and record in attributionBasis field:
- "visible_signature": Clear signature visible on the piece (must have signatureReadable: true)
- "printed_credit": Artist name printed in text (not handwritten)
- "stylistic_analysis": Attribution based purely on recognizable artistic style
- "external_knowledge": Attribution based on art historical knowledge (REQUIRES citation - see below)
- "none": Cannot determine artist from any source

FOR EXTERNAL KNOWLEDGE ATTRIBUTIONS (CRITICAL):
If you are attributing to an artist based on your training knowledge (auction records, art history books, museum catalogs), you MUST:
1. Set attributionBasis: "external_knowledge"
2. Explain in artistSource WHAT source this knowledge comes from (e.g., "Disney promotional art catalogs identify this as Wenzel's work")
3. Add a sourceCitation entry with the claim and source
4. If you CANNOT cite a specific verifiable source, you MUST either:
   - Set artistConfidence to "uncertain" or lower, OR
   - State "unverifiable knowledge-based attribution" in verificationNotes
5. NEVER claim to see a signature that doesn't exist just because you "know" who the artist is

VERIFICATION STEPS:
1. Research the signature/name to find possible matching artists
2. VERIFY THE PROFESSION: Was this person actually an illustrator, poster artist, or commercial artist?
   - If "Pierre Verger" was a photographer/ethnographer, NOT an illustrator, set professionVerified: false
   - Many names match famous people who were NOT artists - this is a red flag
3. VERIFY THE ERA: Was this artist active during the estimated date of the piece?
4. VERIFY THE STYLE: Is this consistent with the artist's known body of work?
5. CHECK FOR DUPLICATES: Are there multiple artists with similar names? (e.g., multiple "P. Verger"s)

CONFIDENCE SCORING (0-100%):
- 90-100% (confirmed): Clear visible signature OR printed credit + profession verified + era matches + style matches
- 70-89% (likely): Strong visible evidence but one verification check failed or uncertain
- 40-69% (uncertain): Weak visual evidence, OR external_knowledge attribution with unverifiable source
- 0-39% (unknown): Cannot determine or major verification failures

ATTRIBUTION BASIS AFFECTS CONFIDENCE:
- visible_signature with all checks passing: Can be "confirmed" (90-100%)
- printed_credit with all checks passing: Can be "confirmed" (90-100%)
- stylistic_analysis alone: Maximum "likely" (70-89%) - style is subjective
- external_knowledge WITH HIGH reliability source (Wikipedia, museum records, major auction house catalogs): "likely" (80-89%)
- external_knowledge WITH MEDIUM reliability source (collector resources, fan sites): "likely" (70-79%)
- external_knowledge WITHOUT citable source: Maximum "uncertain" (40-69%)
- none: Must be "unknown" (0-39%)

IMPORTANT: "visible_signature" MUST ONLY be used when you can actually SEE handwritten text on the poster.
- If there's no signature but you know who the artist is from other sources, use "external_knowledge" NOT "visible_signature"
- Do NOT claim to see a signature just because external sources tell you who the artist is

IMPORTANT: If professionVerified is false (the person wasn't an illustrator), confidence should be "uncertain" or lower, even with a clear signature. Example: "P. Verger" might be signed, but if Pierre Verger was a photographer, there may be a DIFFERENT P. Verger who was the actual illustrator.

CRITICAL: Do NOT inflate confidence based on knowledge you cannot cite. If you "know" who created a piece but cannot point to a specific verifiable source (auction catalog, museum record, art history book), the attribution is UNCERTAIN.

Set artistSource: describe EXACTLY where you found the name:
- For visible_signature: "signature [location] reads '[exact text]'" (e.g., "signature lower left corner reads 'P. Verger'")
- For printed_credit: "printed credit [location]" (e.g., "printed credit below image")
- For external_knowledge: "per [source name]" or "[specific source] identifies this as [artist] work" (e.g., "Wikipedia identifies Paul Wenzel as Disney promotional artist for this film")
- NEVER say "signature visible" if attributionBasis is external_knowledge - that would be a contradiction

VERIFICATION NOTES - Write appropriate to confidence level:
- If confidence >= 90%: Can include brief factual artist biography
- If confidence 70-89%: Focus on what WAS verified and what remains uncertain. Example: "Signature 'P. Franco' is clearly readable. Style matches Italian cinema posters of this era. However, multiple artists may have used this name, so specific biographical details cannot be confirmed."
- If confidence < 70%: Only describe what you observed, no biographical claims. Example: "Signature appears to read 'P. Franco' but artist identity could not be verified."
- NEVER include confident biographical claims (e.g., "was an Italian movie poster artist known for...") unless confidence >= 90%

DATE IDENTIFICATION:
1. Look for dates printed on the piece (often near printer info or copyright)
2. Check for exhibition dates, event dates, or publication years
3. Use style/technique to estimate period if no date visible
4. Set dateConfidence and dateSource similarly to artist

PRINTER IDENTIFICATION:
- Look for printer marks, typically at bottom: "Imp.", "Imprimerie", "Printed by", "Stampato da", etc.
- Common printers: Chaix, Lemercier, Verneau (French); DAN, IFI, Staderini (Italian); etc.
- Set printerConfidence based on how clearly the printer is identified:
  * confirmed (90-100%): Clear printer marks with known printer name
  * likely (70-89%): Partial marks or style strongly suggests specific printer
  * uncertain (50-69%): Marks visible but unclear, or multiple possible printers
  * unknown (<50%): No printer marks found
- Set printerSource: describe WHERE you found the printer info (e.g., "Imp. DAN at bottom right", "style matches Italian theatrical printers")
- Complete printerVerification checklist for rigorous identification

PUBLICATION/BOOK IDENTIFICATION (when applicable):
Identify the SOURCE of this piece - could be a periodical OR a book:

FOR PERIODICALS (magazines, newspapers, illustrated weeklies):
- Examples: The New Yorker, Fortune, Harper's Weekly, Leslie's Illustrated, La Vie Parisienne, Vogue, Saturday Evening Post, Popular Mechanics, Le Petit Journal
- Set publication: ONLY the publication name (e.g., "Harper's Weekly")
- Set publicationConfidence:
  * confirmed (90-100%): Masthead/title visible, or unmistakable signature style
  * likely (70-89%): Strong stylistic match, period-appropriate, typical subject matter
  * uncertain (50-69%): Could be from this publication but not definitive
  * unknown (<50%): Cannot determine source publication
- Set publicationSource: How you identified it (e.g., "masthead visible", "typography matches", "illustration style")

FOR BOOK PLATES/PRINTS (natural history, atlases, encyclopedias):
- Examples: "Birds of America" (Audubon), "Birds of Pennsylvania" (Warren), atlas plates, encyclopedia illustrations
- Set bookTitle: The book title if identifiable
- Set bookAuthor: The author if known
- Set bookYear: Publication year if visible/known
- Look for: title pages, plate captions, typical natural history/atlas formatting
- Use same confidence tiers as periodicals

FOR ADVERTISING:
- Set advertiser: The client (e.g., Cognac Briand, Campari, Air France)

Put context about the publication/book (founding date, editorial focus, notable artists) in the eraContext field.
Use publication/book history to help verify artist identification and date.

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
${shopifyContext ? buildShopifyContextSection(shopifyContext, skepticalMode) : ''}
PRODUCT DESCRIPTIONS: Write 5 versions (each 150-200 words):

IMPORTANT - ARTIST ATTRIBUTION IN DESCRIPTIONS:
- If artistConfidenceScore >= 80%: Use the artist name directly ("by Leonetto Cappiello", "Cappiello's masterful...")
- If artistConfidenceScore 50-79%: Use hedged language ("attributed to...", "bearing the signature of...")
- If artistConfidenceScore < 50%: DO NOT name the artist in descriptions. Instead use "signed [signatureText]" or describe the style without attribution
- If professionVerified is false: Always use hedged language regardless of signature clarity

Examples:
- High confidence: "This striking poster by Jules Chéret showcases his signature style..."
- Medium confidence: "Attributed to P. Verger based on the signature, this illustration..."
- Low confidence: "Signed 'P. Verger' in the lower left, this charming illustration features..."
- Unknown: "This unsigned Art Deco poster captures the energy of 1920s Paris..."

- "standard": ${BRAND_VOICE_GUIDELINES.replace(/\n\n/g, ' ').replace(/\n/g, ' ')} Write in 2-3 flowing paragraphs separated by double newlines.
- "scholarly": Academic tone - formal language, detailed provenance, art-historical analysis, museum-quality descriptions. Write in 2-3 paragraphs separated by double newlines.
- "concise": Short, factual sentences - each sentence states ONE key detail (artist, date, technique, subject, etc.). Write as plain sentences ending with periods. Do NOT use bullet point characters or dashes. Focus on: artist, date, technique, subject, significance.
- "enthusiastic": Collector-focused - energetic but not cheesy, highlights appeal and rarity, why someone would want this piece. Write in 2-3 paragraphs separated by double newlines.
- "immersive": Transport the reader to the moment this piece existed. Describe what someone in the original time and place would see, feel, and experience. Weave in world events (from a US perspective), the cultural climate, and daily life of the era. Use sensory details and present-tense perspective shifts to create a vivid sense of "being there."

TALKING POINTS: Write 6-8 bullet points for in-gallery storytelling. These help gallery staff engage customers with interesting facts and context. Include:
- Artist and date (if known) - BUT follow hedging rules below
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

IMPORTANT - ARTIST ATTRIBUTION IN TALKING POINTS:
- If artistConfidenceScore >= 90%: Use factual statements about the artist ("By Leonetto Cappiello, the father of modern advertising")
- If artistConfidenceScore 70-89%: Use signature-focused language ("Signed 'P. Franco' in the lower right", "Attributed to P. Franco")
- If artistConfidenceScore < 70%: Only reference the signature text, do NOT make claims about the artist's career or biography
- NEVER include biographical claims (e.g., "known for dynamic compositions", "Italian movie poster artist") unless artistConfidenceScore >= 90% AND professionVerified is true
- When uncertain, focus talking points on the artwork itself (subject, technique, era, visual elements) rather than the artist

NOTABLE FIGURES RESEARCH: Carefully examine the item for any named individuals or recognizable faces.
- Look for: names in text, portraits, caricatures, photographs of people
- For EACH person identified, research who they were: scientists, inventors, politicians, artists, performers, business figures, etc.
- Include historical figures even if they seem obscure - Victorian-era doctors, 19th century industrialists, early scientists
- Provide enough context for gallery staff to explain why this person matters
- Include a Wikipedia search term that would find their article
- If text mentions someone like "Dr. Gully" or "Prof. Smith", research their full identity
- Empty array ONLY if genuinely no named/depicted individuals

TIME & PLACE: Research what was happening when this piece was created. Frame for a US audience.
- World (US perspective): What were Americans experiencing in [year]? Major US and global events that would be in American newspapers. How did world events affect American daily life? Cultural moments Americans would recognize. Connect foreign pieces to how they reached or influenced American culture.
- Regional: What was happening in [country of origin] at this time? Politics, economy, social movements that influenced this piece. What was life like there?
- Local: City-specific or industry context. Who commissioned this? What was the advertising/entertainment/publishing landscape? Who was the intended audience?
Focus on context that helps tell THIS piece's story. Not every tier needs content - prioritize what's most relevant and interesting.

LISTINGS: Find THIS EXACT item only (same title/artist/date). Empty array if none found.
${tagList && tagList.length > 0 ? `
TAG SUGGESTIONS:
From the following master list of tags, select 3-8 tags that best describe this item.
Choose tags based on: subject matter, art style/movement, time period, publication type, and themes.
Only use tags from this exact list - do not create new tags.

AVAILABLE TAGS:
${tagList.join(', ')}
` : ''}${colorList && colorList.length > 0 ? `
COLOR SUGGESTIONS:
Analyze the dominant colors visible in this image and select 2-5 colors from the following list.
Focus on the PRIMARY colors that define the artwork's visual impact - not background or minor accent colors.
Only use colors from this exact list - do not suggest colors not in the list.

AVAILABLE COLORS:
${colorList.join(', ')}
` : ''}
JSON:
{
  "identification": {
    "artist": "",
    "artistConfidence": "confirmed|likely|uncertain|unknown",
    "artistConfidenceScore": 0,
    "artistSource": "",
    "attributionBasis": "visible_signature|printed_credit|stylistic_analysis|external_knowledge|none",
    "artistVerification": {
      "signatureReadable": true,
      "signatureText": "",
      "professionVerified": true,
      "eraMatches": true,
      "styleMatches": true,
      "multipleArtistsWithName": false,
      "verificationNotes": ""
    },
    "title": "",
    "estimatedDate": "",
    "dateConfidence": "confirmed|likely|uncertain|unknown",
    "dateSource": "",
    "estimatedDimensions": ""
  },
  "historicalContext": {"periodMovement": "", "culturalSignificance": "", "originalPurpose": "", "publication": "", "publicationConfidence": "confirmed|likely|uncertain|unknown", "publicationSource": "", "bookTitle": "", "bookAuthor": "", "bookYear": null, "advertiser": "", "eraContext": "", "timeAndPlace": {"world": "", "regional": "", "local": ""}},
  "technicalAnalysis": {
    "printingTechnique": "",
    "printer": "",
    "printerConfidence": "confirmed|likely|uncertain|unknown",
    "printerSource": "",
    "printerVerification": {
      "marksReadable": false,
      "marksText": "",
      "historyVerified": false,
      "locationMatches": false,
      "styleMatches": false,
      "verificationNotes": ""
    },
    "colorPalette": "",
    "typography": "",
    "composition": ""
  },
  "conditionAuthenticity": {"ageIndicators": [], "conditionIssues": []},
  "rarityValue": {"rarityAssessment": "", "valueFactors": [], "comparableExamples": "", "collectorInterest": ""}${initialInfo ? `,\n  "validationNotes": ""` : ''},
  "productDescriptions": {"standard": "", "scholarly": "", "concise": "", "enthusiastic": "", "immersive": ""},
  "talkingPoints": ["point 1", "point 2", "..."],
  "notableFigures": [{"name": "Full Name", "role": "Scientist/Politician/etc", "context": "Why they appear in this piece", "wikiSearch": "search term for Wikipedia"}],
  "sourceCitations": [{"claim": "", "source": "", "url": "", "reliability": "high|medium|low"}],
  "similarProducts": [{"title": "", "site": "", "url": "", "price": "", "condition": ""}]${tagList && tagList.length > 0 ? `,
  "suggestedTags": ["tag1", "tag2", "..."]` : ''}${colorList && colorList.length > 0 ? `,
  "suggestedColors": ["color1", "color2", "..."]` : ''}
}`;

  return basePrompt;
}

/**
 * Analyze a vintage poster image using Claude's vision capabilities
 * @param imageUrl - Public URL to the poster image (from Vercel Blob)
 * @param initialInformation - Optional user-provided information to validate
 * @param productType - The type of product being analyzed
 * @param supplementalImages - Optional array of additional images from Research App
 * @param shopifyReferenceImages - Optional array of reference images from Shopify
 * @param shopifyContext - Optional existing data from Shopify to verify/use
 * @param skepticalMode - If true, exclude previous attributions for fresh analysis
 * @returns Structured poster analysis
 */
export async function analyzePoster(
  imageUrl: string,
  initialInformation?: string,
  productType?: string,
  supplementalImages?: SupplementalImage[],
  shopifyReferenceImages?: ShopifyReferenceImage[],
  shopifyContext?: ShopifyAnalysisContext,
  skepticalMode?: boolean
): Promise<PosterAnalysis> {
  try {
    console.log('[analyzePoster] Starting analysis for image:', imageUrl);
    console.log('[analyzePoster] Supplemental images (Research App):', supplementalImages?.length || 0);
    console.log('[analyzePoster] Reference images (Shopify):', shopifyReferenceImages?.length || 0);

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

    // Fetch current color list for suggestions
    let colorList: string[] = [];
    try {
      colorList = await getColorNames();
      console.log('[analyzePoster] Fetched', colorList.length, 'colors for suggestions');
    } catch (colorError) {
      console.warn('[analyzePoster] Could not fetch colors, skipping color suggestions:', colorError);
    }

    // Merge reference images from both sources (Shopify and Research App), max 5 total
    const allReferenceImages: Array<{ url: string; description?: string; source: string }> = [];

    // Add Shopify reference images first (they come from the product listing)
    if (shopifyReferenceImages && shopifyReferenceImages.length > 0) {
      for (const img of shopifyReferenceImages) {
        if (allReferenceImages.length < 5) {
          allReferenceImages.push({
            url: img.url,
            description: 'Reference image from Shopify',
            source: 'shopify',
          });
        }
      }
    }

    // Add Research App supplemental images (max 5 total combined)
    if (supplementalImages && supplementalImages.length > 0) {
      for (const img of supplementalImages) {
        if (allReferenceImages.length < 5) {
          allReferenceImages.push({
            url: img.url,
            description: img.description,
            source: 'research_app',
          });
        }
      }
    }

    const hasReferenceImages = allReferenceImages.length > 0;
    console.log('[analyzePoster] Total reference images for analysis:', allReferenceImages.length);

    const prompt = buildAnalysisPrompt(initialInformation, undefined, productType, hasReferenceImages, tagList, shopifyContext, colorList, skepticalMode);
    console.log('[analyzePoster] Prompt length:', prompt.length, 'characters');
    console.log('[analyzePoster] Skeptical mode:', skepticalMode ? 'ENABLED' : 'disabled');
    console.log('[analyzePoster] Initial information:', initialInformation ? initialInformation.substring(0, 100) : 'none');
    console.log('[analyzePoster] Product type:', productType);
    console.log('[analyzePoster] Image URL:', imageUrl);
    console.log('[analyzePoster] Calling Claude API...');

    // Build content array with primary image first, then reference images
    const contentArray: Array<{ type: 'image'; source: { type: 'url'; url: string } } | { type: 'text'; text: string }> = [
      {
        type: 'image',
        source: {
          type: 'url',
          url: imageUrl,
        },
      },
    ];

    // Add merged reference images with descriptions
    for (const img of allReferenceImages) {
      // Add description text before each image if provided
      if (img.description) {
        contentArray.push({
          type: 'text',
          text: `[Reference image: ${img.description}]`,
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
        enthusiastic: '',
        immersive: ''
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
    if (!analysis.suggestedColors) {
      analysis.suggestedColors = [];
    }

    console.log('[analyzePoster] Analysis parsed successfully');
    console.log('[analyzePoster] Suggested tags:', analysis.suggestedTags);
    console.log('[analyzePoster] Suggested colors:', analysis.suggestedColors);
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
    artistConfidenceScore: analysis.identification.artistConfidenceScore,
    artistSource: analysis.identification.artistSource,
    attributionBasis: analysis.identification.attributionBasis,
    artistSignatureText: analysis.identification.artistVerification?.signatureText,
    artistVerification: analysis.identification.artistVerification,
    title: analysis.identification.title,
    estimatedDate: analysis.identification.estimatedDate,
    dateConfidence: analysis.identification.dateConfidence,
    dateSource: analysis.identification.dateSource,
    dimensionsEstimate: analysis.identification.estimatedDimensions,
    historicalContext: `${analysis.historicalContext.periodMovement}\n\n${analysis.historicalContext.culturalSignificance}\n\nOriginal Purpose: ${analysis.historicalContext.originalPurpose}`,
    significance: analysis.historicalContext.culturalSignificance,
    printingTechnique: analysis.technicalAnalysis.printingTechnique,
    printer: analysis.technicalAnalysis.printer || undefined,
    printerConfidence: analysis.technicalAnalysis.printerConfidence || undefined,
    printerSource: analysis.technicalAnalysis.printerSource || undefined,
    printerVerification: analysis.technicalAnalysis.printerVerification || undefined,
    // Publication (periodical) identification
    publication: analysis.historicalContext.publication || undefined,
    publicationConfidence: analysis.historicalContext.publicationConfidence || undefined,
    publicationSource: analysis.historicalContext.publicationSource || undefined,
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
