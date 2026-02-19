import Anthropic from '@anthropic-ai/sdk';
import { getAllDealers } from './dealers';
import type { Dealer } from '@/types/dealer';
import type { Poster } from '@/types/poster';
import type {
  DealerFinding,
  IdentificationResearchResults,
  IdentificationResearchOptions,
  AttributionConsensus,
} from '@/types/research';

/**
 * Build a search query from poster data
 */
export function buildSearchQuery(poster: Poster): string {
  const parts: string[] = [];

  // Use title as primary search term
  if (poster.title) {
    // Clean up title - remove common suffixes like "poster" if already implied
    let title = poster.title;
    parts.push(title);
  }

  // Add artist if known and confident
  if (poster.artist && poster.artist !== 'Unknown' && (poster.artistConfidenceScore ?? 0) > 50) {
    parts.push(poster.artist);
  }

  // Add date if known
  if (poster.estimatedDate) {
    parts.push(poster.estimatedDate);
  }

  // Add "poster" if not already in title
  if (poster.title && !poster.title.toLowerCase().includes('poster')) {
    parts.push('poster');
  }

  return parts.join(' ');
}

/**
 * Generate a search URL for a dealer using their template
 */
export function generateDealerSearchUrl(dealer: Dealer, query: string): string | null {
  if (!dealer.searchUrlTemplate) {
    return null;
  }

  const encodedQuery = encodeURIComponent(query);
  return dealer.searchUrlTemplate.replace('{query}', encodedQuery);
}

/**
 * Generate search URLs for all applicable dealers
 */
export async function generateSearchUrls(
  poster: Poster,
  options?: IdentificationResearchOptions
): Promise<{ dealer: Dealer; searchUrl: string | null; query: string }[]> {
  const query = options?.customQuery || buildSearchQuery(poster);

  // Get dealers that can be used for research
  const allDealers = await getAllDealers({
    canResearch: true,
    isActive: true,
    limit: 10000,
  });

  // Filter by options
  let dealers = allDealers;

  if (options?.dealerIds?.length) {
    dealers = dealers.filter(d => options.dealerIds!.includes(d.id));
  }

  if (options?.maxTier) {
    dealers = dealers.filter(d => d.reliabilityTier <= options.maxTier!);
  }

  if (options?.specializations?.length) {
    dealers = dealers.filter(d =>
      d.specializations.some(s => options.specializations!.includes(s))
    );
  }

  // Generate URLs
  return dealers.map(dealer => ({
    dealer,
    searchUrl: generateDealerSearchUrl(dealer, query),
    query,
  }));
}

/**
 * Parse search results using Claude to extract structured data
 */
export async function parseSearchResultsWithAI(
  searchSnippets: { dealerId: number; dealerName: string; url: string; title: string; snippet: string }[],
  posterContext: { title: string; artist?: string | null; date?: string | null }
): Promise<Omit<DealerFinding, 'dealerType' | 'reliabilityTier' | 'attributionWeight' | 'retrievedAt'>[]> {
  if (searchSnippets.length === 0) {
    return [];
  }

  const anthropic = new Anthropic();

  const prompt = `You are analyzing search results from antique dealers and auction houses to extract attribution information for a vintage poster.

POSTER WE'RE RESEARCHING:
Title: ${posterContext.title}
${posterContext.artist ? `Current Artist Attribution: ${posterContext.artist}` : 'Artist: Unknown'}
${posterContext.date ? `Date: ${posterContext.date}` : ''}

SEARCH RESULTS TO ANALYZE:
${searchSnippets.map((s, i) => `
[Result ${i + 1}]
Dealer: ${s.dealerName}
URL: ${s.url}
Title: ${s.title}
Snippet: ${s.snippet}
`).join('\n')}

For each search result, determine:
1. Does this result appear to be about the SAME poster we're researching? (matchConfidence 0-100)
2. What artist name is mentioned, if any?
3. What date/year is mentioned, if any?
4. What price is mentioned, if any? (include currency and whether it's asking/sold/estimate)
5. What dimensions are mentioned, if any?
6. What printing technique is mentioned, if any?

Return a JSON array with one object per result:
[
  {
    "resultIndex": 0,
    "matchConfidence": 85,
    "extractedArtist": "Artist Name" or null,
    "extractedDate": "1925" or null,
    "extractedPrice": { "amount": 1500, "currency": "USD", "type": "sold" } or null,
    "extractedDimensions": "24 x 36 inches" or null,
    "extractedTechnique": "lithograph" or null
  }
]

Only include fields where you found clear information. Set matchConfidence to 0 if the result is clearly about a different item.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    // Extract JSON from response
    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      return [];
    }

    // Find JSON array in response
    const jsonMatch = textContent.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      resultIndex: number;
      matchConfidence: number;
      extractedArtist?: string;
      extractedDate?: string;
      extractedPrice?: { amount: number; currency: string; type: 'asking' | 'sold' | 'estimate' };
      extractedDimensions?: string;
      extractedTechnique?: string;
    }[];

    // Map back to findings
    return parsed.map(p => {
      const original = searchSnippets[p.resultIndex];
      return {
        dealerId: original.dealerId,
        dealerName: original.dealerName,
        url: original.url,
        title: original.title,
        snippet: original.snippet,
        matchConfidence: p.matchConfidence,
        extractedArtist: p.extractedArtist,
        extractedDate: p.extractedDate,
        extractedPrice: p.extractedPrice,
        extractedDimensions: p.extractedDimensions,
        extractedTechnique: p.extractedTechnique,
      };
    });
  } catch (error) {
    console.error('Error parsing search results with AI:', error);
    return [];
  }
}

/**
 * Calculate attribution consensus from multiple findings
 */
export function calculateAttributionConsensus(
  findings: DealerFinding[],
  minMatchConfidence: number = 50
): AttributionConsensus | undefined {
  // Filter to high-confidence matches with artist data
  const relevantFindings = findings.filter(
    f => f.matchConfidence >= minMatchConfidence && f.extractedArtist
  );

  if (relevantFindings.length === 0) {
    return undefined;
  }

  // Group by normalized artist name
  const artistGroups = new Map<string, DealerFinding[]>();
  for (const finding of relevantFindings) {
    const normalized = finding.extractedArtist!.toLowerCase().trim();
    if (!artistGroups.has(normalized)) {
      artistGroups.set(normalized, []);
    }
    artistGroups.get(normalized)!.push(finding);
  }

  // Find the artist with highest weighted confidence
  let bestArtist: string | null = null;
  let bestNormalized: string | null = null;
  let bestFindings: DealerFinding[] = [];
  let bestScore = 0;

  for (const [normalized, groupFindings] of artistGroups) {
    // Calculate weighted score based on reliability tiers
    // Lower tier = higher weight (tier 1 = 1.0, tier 6 = 0.5)
    let weightedScore = 0;
    for (const f of groupFindings) {
      const tierWeight = 1 - (f.reliabilityTier - 1) * 0.1; // 1.0 for tier 1, 0.5 for tier 6
      weightedScore += f.attributionWeight * tierWeight * (f.matchConfidence / 100);
    }

    if (weightedScore > bestScore) {
      bestScore = weightedScore;
      bestNormalized = normalized;
      bestFindings = groupFindings;
      // Use the artist name from the highest-tier source
      const sortedByTier = [...groupFindings].sort((a, b) => a.reliabilityTier - b.reliabilityTier);
      bestArtist = sortedByTier[0].extractedArtist!;
    }
  }

  if (!bestArtist || !bestNormalized) {
    return undefined;
  }

  // Calculate final weighted confidence (0-100)
  const maxPossibleScore = bestFindings.length; // If all were tier 1 with 100% match
  const weightedConfidence = Math.min(100, Math.round((bestScore / Math.max(1, bestFindings.length * 0.5)) * 100));

  return {
    artist: bestArtist,
    normalizedArtist: bestNormalized,
    sources: bestFindings.map(f => ({
      dealerName: f.dealerName,
      dealerId: f.dealerId,
      reliabilityTier: f.reliabilityTier,
      url: f.url,
    })),
    weightedConfidence,
    agreementCount: bestFindings.length,
  };
}

/**
 * Compare AI attribution with dealer findings
 */
export function compareAttributions(
  aiArtist: string | null,
  aiConfidence: number,
  dealerConsensus: AttributionConsensus | undefined
): IdentificationResearchResults['comparison'] {
  const hasAi = aiArtist && aiArtist !== 'Unknown' && aiConfidence > 0;
  const hasDealer = dealerConsensus && dealerConsensus.weightedConfidence > 0;

  if (!hasAi && !hasDealer) {
    return {
      aiArtist: null,
      aiConfidence: 0,
      dealerArtist: null,
      dealerConfidence: 0,
      agreement: 'neither',
    };
  }

  if (hasAi && !hasDealer) {
    return {
      aiArtist,
      aiConfidence,
      dealerArtist: null,
      dealerConfidence: 0,
      agreement: 'ai_only',
    };
  }

  if (!hasAi && hasDealer) {
    return {
      aiArtist: null,
      aiConfidence: 0,
      dealerArtist: dealerConsensus!.artist,
      dealerConfidence: dealerConsensus!.weightedConfidence,
      agreement: 'dealer_only',
    };
  }

  // Both have attributions - check if they match
  const aiNormalized = aiArtist!.toLowerCase().trim();
  const dealerNormalized = dealerConsensus!.normalizedArtist;

  // Check for match (allowing for slight variations)
  const isMatch =
    aiNormalized === dealerNormalized ||
    aiNormalized.includes(dealerNormalized) ||
    dealerNormalized.includes(aiNormalized);

  return {
    aiArtist,
    aiConfidence,
    dealerArtist: dealerConsensus!.artist,
    dealerConfidence: dealerConsensus!.weightedConfidence,
    agreement: isMatch ? 'match' : 'conflict',
  };
}

/**
 * Run a complete identification research session
 * Note: This generates search URLs and can parse pre-fetched results
 * For actual web searching, use a search API integration
 */
export async function runIdentificationResearch(
  poster: Poster,
  options?: IdentificationResearchOptions,
  prefetchedResults?: { dealerId: number; url: string; title: string; snippet: string }[]
): Promise<IdentificationResearchResults> {
  const query = options?.customQuery || buildSearchQuery(poster);
  const searchUrls = await generateSearchUrls(poster, options);

  // If we have prefetched results, parse them
  let findings: DealerFinding[] = [];

  if (prefetchedResults && prefetchedResults.length > 0) {
    // Map dealer info to results
    const dealerMap = new Map(searchUrls.map(s => [s.dealer.id, s.dealer]));

    const snippetsWithDealerInfo = prefetchedResults
      .filter(r => dealerMap.has(r.dealerId))
      .map(r => ({
        ...r,
        dealerName: dealerMap.get(r.dealerId)!.name,
      }));

    // Parse with AI
    const parsedFindings = await parseSearchResultsWithAI(snippetsWithDealerInfo, {
      title: poster.title || 'Unknown',
      artist: poster.artist,
      date: poster.estimatedDate,
    });

    // Add dealer metadata
    findings = parsedFindings.map(f => {
      const dealer = dealerMap.get(f.dealerId)!;
      return {
        ...f,
        dealerType: dealer.type,
        reliabilityTier: dealer.reliabilityTier,
        attributionWeight: dealer.attributionWeight,
        retrievedAt: new Date().toISOString(),
      };
    });
  }

  // Calculate consensus
  const attributionConsensus = calculateAttributionConsensus(findings);

  // Compare with AI attribution
  const comparison = compareAttributions(
    poster.artist ?? null,
    poster.artistConfidenceScore ?? 0,
    attributionConsensus
  );

  return {
    posterId: poster.id,
    query,
    searchedAt: new Date().toISOString(),
    dealersSearched: searchUrls.length,
    totalFindings: findings.length,
    findings,
    attributionConsensus,
    comparison,
  };
}

/**
 * Get dealers organized by tier for display
 */
export async function getDealersForResearch(
  options?: IdentificationResearchOptions
): Promise<Map<number, Dealer[]>> {
  const dealers = await getAllDealers({
    canResearch: true,
    isActive: true,
    limit: 10000,
  });

  // Filter by options
  let filtered = dealers;

  if (options?.dealerIds?.length) {
    filtered = filtered.filter(d => options.dealerIds!.includes(d.id));
  }

  if (options?.maxTier) {
    filtered = filtered.filter(d => d.reliabilityTier <= options.maxTier!);
  }

  if (options?.specializations?.length) {
    filtered = filtered.filter(d =>
      d.specializations.some(s => options.specializations!.includes(s))
    );
  }

  // Group by tier
  const byTier = new Map<number, Dealer[]>();
  for (const dealer of filtered) {
    if (!byTier.has(dealer.reliabilityTier)) {
      byTier.set(dealer.reliabilityTier, []);
    }
    byTier.get(dealer.reliabilityTier)!.push(dealer);
  }

  return byTier;
}
