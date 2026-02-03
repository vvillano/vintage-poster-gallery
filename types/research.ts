// Types for dealer research and attribution verification

import type { Dealer, DealerSpecialization } from './dealer';

/**
 * A finding from a dealer source during research
 */
export interface DealerFinding {
  // Source information
  dealerId: number;
  dealerName: string;
  dealerType: Dealer['type'];
  reliabilityTier: number;
  attributionWeight: number;

  // Finding details
  url: string;
  title: string;
  snippet: string; // Raw search result snippet

  // Extracted data (may be partial)
  extractedArtist?: string;
  extractedDate?: string;
  extractedPrice?: {
    amount: number;
    currency: string;
    type: 'asking' | 'sold' | 'estimate';
  };
  extractedDimensions?: string;
  extractedTechnique?: string;

  // Confidence that this result matches our poster
  matchConfidence: number; // 0-100

  // When this finding was retrieved
  retrievedAt: string;
}

/**
 * Consensus attribution from multiple dealer findings
 */
export interface AttributionConsensus {
  artist: string;
  normalizedArtist: string; // Lowercase, trimmed for comparison
  sources: {
    dealerName: string;
    dealerId: number;
    reliabilityTier: number;
    url: string;
  }[];
  weightedConfidence: number; // 0-100, weighted by dealer reliability
  agreementCount: number; // How many dealers agree
}

/**
 * Price consensus from multiple findings
 */
export interface PriceConsensus {
  lowEstimate: number;
  highEstimate: number;
  averagePrice: number;
  currency: string;
  sampleCount: number;
  sources: {
    dealerName: string;
    dealerId: number;
    price: number;
    priceType: 'asking' | 'sold' | 'estimate';
    url: string;
  }[];
}

/**
 * Complete results from an identification research session
 */
export interface IdentificationResearchResults {
  // Search metadata
  posterId: number;
  query: string;
  searchedAt: string;
  dealersSearched: number;
  totalFindings: number;

  // Raw findings
  findings: DealerFinding[];

  // Processed consensus (if any)
  attributionConsensus?: AttributionConsensus;
  dateConsensus?: {
    date: string;
    sources: string[];
    confidence: number;
  };

  // AI's current attribution vs dealer findings
  comparison?: {
    aiArtist: string | null;
    aiConfidence: number;
    dealerArtist: string | null;
    dealerConfidence: number;
    agreement: 'match' | 'conflict' | 'ai_only' | 'dealer_only' | 'neither';
  };
}

/**
 * Options for running identification research
 */
export interface IdentificationResearchOptions {
  // Which dealers to search (if not specified, uses all with canResearch=true)
  dealerIds?: number[];

  // Filter by specialization
  specializations?: DealerSpecialization[];

  // Maximum reliability tier to include (1=highest, 6=lowest)
  maxTier?: number;

  // Search query override (if not specified, builds from poster data)
  customQuery?: string;

  // Maximum number of results to return
  maxResults?: number;

  // Whether to include price data in the search
  includePricing?: boolean;
}

/**
 * Request body for the identification research API
 */
export interface IdentificationResearchRequest {
  posterId: number;
  options?: IdentificationResearchOptions;
}

/**
 * Response from the identification research API
 */
export interface IdentificationResearchResponse {
  success: boolean;
  results?: IdentificationResearchResults;
  error?: string;
}

/**
 * Result of applying a dealer attribution to a poster
 */
export interface ApplyAttributionResult {
  success: boolean;
  previousArtist: string | null;
  previousConfidence: number;
  newArtist: string;
  newConfidence: number;
  sources: string[];
  error?: string;
}
