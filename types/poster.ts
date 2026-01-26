// Core Poster type matching database schema
export interface Poster {
  id: number;
  imageUrl: string;
  imageBlobId: string;
  fileName: string;
  fileSize: number;
  uploadDate: Date;
  uploadedBy: string;

  // Initial information provided at upload (optional)
  initialInformation?: string | null;

  // Product classification
  productType?: string | null;

  // AI Analysis Results
  artist?: string | null;
  title?: string | null;
  estimatedDate?: string | null;
  dimensionsEstimate?: string | null;
  historicalContext?: string | null;
  significance?: string | null;
  printingTechnique?: string | null;
  rarityAnalysis?: string | null;
  valueInsights?: string | null;
  validationNotes?: string | null;  // AI notes on validating initial information
  productDescription?: string | null;  // Marketing-ready description for website
  sourceCitations?: any | null;  // JSON array of source links with descriptions
  similarProducts?: any | null;  // JSON array of similar products on other sites

  // Metadata
  analysisCompleted: boolean;
  analysisDate?: Date | null;
  rawAiResponse?: any | null;
  userNotes?: string | null;
  lastModified: Date;
}

// Product type classifications from Product Classification Guide - 2025
export const PRODUCT_TYPES = [
  'Poster',
  'Window Card',
  'Product Label',
  'Illustration',
  'Antique Print',
  'Cover Art',
  'Vintage Ad',
  'Map',
  'Postcard',
  'Trade Card',
  'Victorian Trade Card',
  'Magazine/Book',
  'Merchandise',
  'Ephemera',
] as const;

export type ProductType = typeof PRODUCT_TYPES[number];

// Source citation with link
export interface SourceCitation {
  claim: string;  // The specific claim being cited (e.g., "Artist: Leonetto Cappiello")
  source: string;  // Name of source (e.g., "Museum of Modern Art")
  url: string;  // URL to source
  reliability: 'high' | 'medium' | 'low';  // Confidence in source
}

// Similar product listing on external site
export interface SimilarProduct {
  title: string;  // Product title
  site: string;  // Site name (e.g., "eBay", "Heritage Auctions")
  url: string;  // Direct link to listing
  price?: string;  // Price if available
  condition?: string;  // Condition note if available
}

// Structured analysis response from Claude
export interface PosterAnalysis {
  identification: {
    artist: string;
    title: string;
    estimatedDate: string;
    estimatedDimensions: string;
  };
  historicalContext: {
    periodMovement: string;
    culturalSignificance: string;
    originalPurpose: string;
  };
  technicalAnalysis: {
    printingTechnique: string;
    colorPalette: string;
    typography: string;
    composition: string;
  };
  conditionAuthenticity: {
    ageIndicators: string[];
    conditionIssues: string[];
  };
  rarityValue: {
    rarityAssessment: string;
    valueFactors: string[];
    comparableExamples: string;
    collectorInterest: string;
  };
  validationNotes?: string;  // Present when initial information was provided
  productDescription: string;  // Marketing-ready product description
  sourceCitations: SourceCitation[];  // Citations for key claims
  similarProducts: SimilarProduct[];  // Similar products found on other sites
}

// Request/Response types for API routes
export interface AnalysisRequest {
  posterId: number;
  imageUrl: string;
  initialInformation?: string;
}

export interface AnalysisResponse {
  success: boolean;
  posterId: number;
  analysis?: PosterAnalysis;
  error?: string;
}

export interface UploadRequest {
  file: File;
  initialInformation?: string;
  productType: string;  // Required: Product classification
}

export interface UploadResponse {
  success: boolean;
  posterId?: number;
  imageUrl?: string;
  error?: string;
}

// For creating/updating posters
export interface CreatePosterInput {
  imageUrl: string;
  imageBlobId: string;
  fileName: string;
  fileSize: number;
  uploadedBy: string;
  initialInformation?: string;
  productType?: string;
}

export interface UpdatePosterInput {
  artist?: string;
  title?: string;
  estimatedDate?: string;
  dimensionsEstimate?: string;
  historicalContext?: string;
  significance?: string;
  printingTechnique?: string;
  rarityAnalysis?: string;
  valueInsights?: string;
  validationNotes?: string;
  productDescription?: string;
  sourceCitations?: any;
  similarProducts?: any;
  userNotes?: string;
}
