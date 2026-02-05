/**
 * AI Result Parser
 *
 * Uses Claude to parse search results and extract structured data:
 * - Artist attributions from dealer listings
 * - Price information (current listings vs sold items)
 * - "Out of Stock" detection (indicates actual sale)
 * - Item matching confidence
 */

import Anthropic from '@anthropic-ai/sdk';
import type { UnifiedSearchResult } from './multi-stage-search';

/**
 * Parsed result with extracted structured data
 */
export interface ParsedResult {
  // Original result reference
  url: string;
  title: string;
  domain: string;

  // Extracted data
  extractedArtist?: string;
  extractedDate?: string;
  extractedDimensions?: string;
  extractedTechnique?: string;

  // Price data
  price?: number;
  currency?: string;
  priceText?: string;

  // Sale status (critical for detecting "out of stock with price")
  status: 'for_sale' | 'out_of_stock' | 'sold' | 'auction_result' | 'unknown';
  statusConfidence: number; // 0-1

  // Match confidence (how confident we are this is the same item)
  matchConfidence: number; // 0-1
  matchReason?: string;

  // Source info
  dealerId?: number;
  dealerName?: string;
  reliabilityTier?: number;
}

/**
 * Consensus calculation for attributions
 */
export interface AttributionConsensus {
  artist?: {
    value: string;
    sources: string[];
    weightedConfidence: number;
    agreementCount: number;
  };
  date?: {
    value: string;
    sources: string[];
    weightedConfidence: number;
  };
  technique?: {
    value: string;
    sources: string[];
    weightedConfidence: number;
  };
}

/**
 * Price summary from parsed results
 */
export interface PriceSummary {
  // Current asking prices
  currentListings: {
    low: number;
    high: number;
    average: number;
    count: number;
    currency: string;
  } | null;

  // Sold/out-of-stock prices (actual transaction data)
  soldPrices: {
    low: number;
    high: number;
    average: number;
    count: number;
    currency: string;
    sources: string[];
  } | null;

  // All price data points
  allPrices: {
    price: number;
    currency: string;
    status: string;
    source: string;
    url: string;
  }[];
}

/**
 * AI parsing response
 */
export interface ParsedResultsResponse {
  results: ParsedResult[];
  consensus: AttributionConsensus;
  priceSummary: PriceSummary;
  tokensUsed: number;
}

/**
 * Context about the poster being researched
 */
export interface PosterContext {
  title: string;
  artist?: string;
  date?: string;
  dimensions?: string;
  technique?: string;
  imageUrl?: string;
}

/**
 * Parse search results with AI to extract structured data
 */
export async function parseResultsWithAI(
  results: UnifiedSearchResult[],
  posterContext: PosterContext
): Promise<ParsedResultsResponse> {
  if (results.length === 0) {
    return {
      results: [],
      consensus: {},
      priceSummary: {
        currentListings: null,
        soldPrices: null,
        allPrices: [],
      },
      tokensUsed: 0,
    };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn('[result-parser] ANTHROPIC_API_KEY not configured, using basic parsing');
    return { ...basicParsing(results, posterContext), tokensUsed: 0 };
  }

  const anthropic = new Anthropic({ apiKey });

  // Build prompt for Claude
  const prompt = buildParsingPrompt(results, posterContext);

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const textContent = response.content.find((c) => c.type === 'text');
    const responseText = textContent?.type === 'text' ? textContent.text : '';

    // Parse JSON response from Claude
    const parsed = parseClaudeResponse(responseText, results, posterContext);

    return {
      ...parsed,
      tokensUsed: response.usage?.input_tokens || 0,
    };
  } catch (error) {
    console.error('[result-parser] AI parsing error:', error);
    return { ...basicParsing(results, posterContext), tokensUsed: 0 };
  }
}

/**
 * Build prompt for Claude to parse search results
 */
function buildParsingPrompt(
  results: UnifiedSearchResult[],
  posterContext: PosterContext
): string {
  // Format results for the prompt
  const resultsForPrompt = results.slice(0, 30).map((r, i) => ({
    index: i,
    title: r.title,
    snippet: r.snippet || '',
    url: r.url,
    domain: r.domain,
    price: r.price || '',
    dealerName: r.dealerName || r.originalSource || r.domain,
    reliabilityTier: r.reliabilityTier,
  }));

  return `You are analyzing search results for a vintage poster research tool. Your task is to extract structured data from these search results.

POSTER BEING RESEARCHED:
Title: ${posterContext.title}
${posterContext.artist ? `Known Artist: ${posterContext.artist}` : 'Artist: Unknown'}
${posterContext.date ? `Date: ${posterContext.date}` : ''}
${posterContext.dimensions ? `Dimensions: ${posterContext.dimensions}` : ''}

SEARCH RESULTS TO ANALYZE:
${JSON.stringify(resultsForPrompt, null, 2)}

For each result, analyze:
1. Does this appear to be the SAME item as the poster being researched?
2. What artist/date/technique information can be extracted?
3. What is the sale status (for_sale, out_of_stock, sold, auction_result, unknown)?
   - IMPORTANT: "out of stock" with a price visible = valuable SOLD data
   - Look for: "sold", "out of stock", "no longer available", "unavailable"
4. What is the price (if any)?

CRITICAL: Detection of "out of stock" items WITH prices is very valuable - it indicates actual transaction prices.

Respond with valid JSON in this exact format:
{
  "results": [
    {
      "index": 0,
      "matchConfidence": 0.85,
      "matchReason": "Title matches, same artist attribution",
      "extractedArtist": "John Doe",
      "extractedDate": "1945",
      "extractedDimensions": null,
      "extractedTechnique": "lithograph",
      "price": 1200,
      "currency": "USD",
      "priceText": "$1,200",
      "status": "for_sale",
      "statusConfidence": 0.95
    }
  ],
  "consensus": {
    "artist": {
      "value": "John Doe",
      "sources": ["Heritage Auctions", "Golden Age Posters"],
      "weightedConfidence": 0.88,
      "agreementCount": 2
    }
  }
}

Only include results that appear to match the poster (matchConfidence > 0.5).
Return empty arrays if no matches found.`;
}

/**
 * Parse Claude's JSON response
 */
function parseClaudeResponse(
  responseText: string,
  originalResults: UnifiedSearchResult[],
  posterContext: PosterContext
): Omit<ParsedResultsResponse, 'tokensUsed'> {
  try {
    // Extract JSON from response (Claude sometimes adds explanation text)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('[result-parser] No JSON found in response');
      return basicParsing(originalResults, posterContext);
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Map parsed results back to full data
    const mappedResults: ParsedResult[] = (parsed.results || []).map((r: any) => {
      const original = originalResults[r.index];
      return {
        url: original?.url || '',
        title: original?.title || '',
        domain: original?.domain || '',
        extractedArtist: r.extractedArtist || undefined,
        extractedDate: r.extractedDate || undefined,
        extractedDimensions: r.extractedDimensions || undefined,
        extractedTechnique: r.extractedTechnique || undefined,
        price: r.price || undefined,
        currency: r.currency || 'USD',
        priceText: r.priceText || undefined,
        status: r.status || 'unknown',
        statusConfidence: r.statusConfidence || 0.5,
        matchConfidence: r.matchConfidence || 0.5,
        matchReason: r.matchReason || undefined,
        dealerId: original?.dealerId,
        dealerName: original?.dealerName || original?.originalSource,
        reliabilityTier: original?.reliabilityTier,
      };
    });

    // Calculate price summary
    const priceSummary = calculatePriceSummary(mappedResults);

    return {
      results: mappedResults,
      consensus: parsed.consensus || {},
      priceSummary,
    };
  } catch (error) {
    console.error('[result-parser] JSON parsing error:', error);
    return basicParsing(originalResults, posterContext);
  }
}

/**
 * Basic parsing without AI (fallback)
 */
function basicParsing(
  results: UnifiedSearchResult[],
  posterContext: PosterContext
): Omit<ParsedResultsResponse, 'tokensUsed'> {
  const parsed: ParsedResult[] = results.map((r) => {
    // Basic status detection from text
    const lowerSnippet = (r.snippet || '').toLowerCase();
    const lowerTitle = r.title.toLowerCase();
    const combined = `${lowerTitle} ${lowerSnippet}`;

    let status: ParsedResult['status'] = 'unknown';
    let statusConfidence = 0.5;

    if (combined.includes('sold') || combined.includes('no longer available')) {
      status = 'sold';
      statusConfidence = 0.8;
    } else if (combined.includes('out of stock') || combined.includes('unavailable')) {
      status = 'out_of_stock';
      statusConfidence = 0.8;
    } else if (combined.includes('hammer price') || combined.includes('realized')) {
      status = 'auction_result';
      statusConfidence = 0.9;
    } else if (
      combined.includes('add to cart') ||
      combined.includes('buy now') ||
      combined.includes('in stock')
    ) {
      status = 'for_sale';
      statusConfidence = 0.8;
    }

    return {
      url: r.url,
      title: r.title,
      domain: r.domain,
      price: r.priceValue,
      currency: r.currency || 'USD',
      priceText: r.price,
      status,
      statusConfidence,
      matchConfidence: 0.5, // Without AI, we can't determine match confidence
      dealerId: r.dealerId,
      dealerName: r.dealerName || r.originalSource,
      reliabilityTier: r.reliabilityTier,
    };
  });

  return {
    results: parsed,
    consensus: {},
    priceSummary: calculatePriceSummary(parsed),
  };
}

/**
 * Calculate price summary from parsed results
 */
function calculatePriceSummary(results: ParsedResult[]): PriceSummary {
  const allPrices: PriceSummary['allPrices'] = [];
  const currentPrices: number[] = [];
  const soldPrices: number[] = [];
  const soldSources: string[] = [];

  for (const r of results) {
    if (r.price && r.price > 0) {
      allPrices.push({
        price: r.price,
        currency: r.currency || 'USD',
        status: r.status,
        source: r.dealerName || r.domain,
        url: r.url,
      });

      if (r.status === 'for_sale') {
        currentPrices.push(r.price);
      } else if (r.status === 'sold' || r.status === 'out_of_stock' || r.status === 'auction_result') {
        soldPrices.push(r.price);
        if (r.dealerName || r.domain) {
          soldSources.push(r.dealerName || r.domain);
        }
      }
    }
  }

  return {
    currentListings:
      currentPrices.length > 0
        ? {
            low: Math.min(...currentPrices),
            high: Math.max(...currentPrices),
            average: currentPrices.reduce((a, b) => a + b, 0) / currentPrices.length,
            count: currentPrices.length,
            currency: 'USD',
          }
        : null,
    soldPrices:
      soldPrices.length > 0
        ? {
            low: Math.min(...soldPrices),
            high: Math.max(...soldPrices),
            average: soldPrices.reduce((a, b) => a + b, 0) / soldPrices.length,
            count: soldPrices.length,
            currency: 'USD',
            sources: [...new Set(soldSources)],
          }
        : null,
    allPrices,
  };
}

/**
 * Calculate attribution consensus from parsed results
 * Weights results by dealer reliability tier
 */
export function calculateAttributionConsensus(
  results: ParsedResult[]
): AttributionConsensus {
  const artistVotes: Map<string, { sources: string[]; weight: number }> = new Map();
  const dateVotes: Map<string, { sources: string[]; weight: number }> = new Map();
  const techniqueVotes: Map<string, { sources: string[]; weight: number }> = new Map();

  for (const result of results) {
    // Calculate weight based on reliability tier (1 = highest weight)
    const tierWeight = result.reliabilityTier
      ? 1 - (result.reliabilityTier - 1) * 0.15 // Tier 1 = 1.0, Tier 6 = 0.25
      : 0.5;

    const weight = tierWeight * result.matchConfidence;
    const source = result.dealerName || result.domain;

    // Artist votes
    if (result.extractedArtist) {
      const normalized = result.extractedArtist.toLowerCase().trim();
      const existing = artistVotes.get(normalized);
      if (existing) {
        existing.sources.push(source);
        existing.weight += weight;
      } else {
        artistVotes.set(normalized, { sources: [source], weight });
      }
    }

    // Date votes
    if (result.extractedDate) {
      const normalized = result.extractedDate.toLowerCase().trim();
      const existing = dateVotes.get(normalized);
      if (existing) {
        existing.sources.push(source);
        existing.weight += weight;
      } else {
        dateVotes.set(normalized, { sources: [source], weight });
      }
    }

    // Technique votes
    if (result.extractedTechnique) {
      const normalized = result.extractedTechnique.toLowerCase().trim();
      const existing = techniqueVotes.get(normalized);
      if (existing) {
        existing.sources.push(source);
        existing.weight += weight;
      } else {
        techniqueVotes.set(normalized, { sources: [source], weight });
      }
    }
  }

  // Find consensus (highest weighted vote)
  const consensus: AttributionConsensus = {};

  if (artistVotes.size > 0) {
    const sorted = [...artistVotes.entries()].sort((a, b) => b[1].weight - a[1].weight);
    const [value, data] = sorted[0];
    const totalWeight = [...artistVotes.values()].reduce((sum, v) => sum + v.weight, 0);
    consensus.artist = {
      value,
      sources: [...new Set(data.sources)],
      weightedConfidence: Math.min(data.weight / totalWeight, 0.95),
      agreementCount: data.sources.length,
    };
  }

  if (dateVotes.size > 0) {
    const sorted = [...dateVotes.entries()].sort((a, b) => b[1].weight - a[1].weight);
    const [value, data] = sorted[0];
    const totalWeight = [...dateVotes.values()].reduce((sum, v) => sum + v.weight, 0);
    consensus.date = {
      value,
      sources: [...new Set(data.sources)],
      weightedConfidence: Math.min(data.weight / totalWeight, 0.95),
    };
  }

  if (techniqueVotes.size > 0) {
    const sorted = [...techniqueVotes.entries()].sort((a, b) => b[1].weight - a[1].weight);
    const [value, data] = sorted[0];
    const totalWeight = [...techniqueVotes.values()].reduce((sum, v) => sum + v.weight, 0);
    consensus.technique = {
      value,
      sources: [...new Set(data.sources)],
      weightedConfidence: Math.min(data.weight / totalWeight, 0.95),
    };
  }

  return consensus;
}
