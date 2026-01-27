// Supplemental image for additional analysis context
export interface SupplementalImage {
  url: string;
  blobId: string;
  fileName: string;
  description?: string;  // Optional description of what this image shows
  uploadDate: Date;
}

// Core Poster type matching database schema
export interface Poster {
  id: number;
  imageUrl: string;
  imageBlobId: string;
  fileName: string;
  fileSize: number;
  uploadDate: Date;
  uploadedBy: string;

  // Supplemental images for additional analysis context
  supplementalImages?: SupplementalImage[] | null;

  // Initial information provided at upload (optional)
  initialInformation?: string | null;

  // Product classification
  productType?: string | null;

  // AI Analysis Results
  artist?: string | null;
  artistConfidence?: string | null;  // confirmed, likely, uncertain, unknown
  artistSource?: string | null;  // Where the artist name was found
  title?: string | null;
  estimatedDate?: string | null;
  dateConfidence?: string | null;  // confirmed, likely, uncertain, unknown
  dateSource?: string | null;  // Where the date was found
  dimensionsEstimate?: string | null;
  historicalContext?: string | null;
  significance?: string | null;
  printingTechnique?: string | null;
  printer?: string | null;  // Printer/publisher if known
  rarityAnalysis?: string | null;
  valueInsights?: string | null;
  validationNotes?: string | null;  // AI notes on validating initial information
  productDescription?: string | null;  // Marketing-ready description for website (backwards compat)
  productDescriptions?: ProductDescriptions | null;  // All description tones
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

// Description tone options
export const DESCRIPTION_TONES = ['standard', 'scholarly', 'concise', 'enthusiastic'] as const;
export type DescriptionTone = typeof DESCRIPTION_TONES[number];

// Product descriptions in multiple tones
export interface ProductDescriptions {
  standard: string;      // Gallery voice - sophisticated, art-historically grounded
  scholarly: string;     // Academic tone - more formal, detailed provenance focus
  concise: string;       // Just the facts - minimal prose, key details only
  enthusiastic: string;  // Collector-focused - energetic, highlights appeal
}

// Notable figure mentioned or depicted in the item
export interface NotableFigure {
  name: string;           // Full name of the person
  role: string;           // Brief description: "Scientist", "Politician", "Artist depicted", etc.
  context: string;        // Why they appear / their connection to the piece
  wikiSearch?: string;    // Optional search term for Wikipedia lookup
}

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
    artistConfidence: 'confirmed' | 'likely' | 'uncertain' | 'unknown';  // How confident is the identification
    artistSource: string;  // Where the artist name was found (e.g., "signed bottom right", "visible in image", "research")
    title: string;
    estimatedDate: string;
    dateConfidence: 'confirmed' | 'likely' | 'uncertain' | 'unknown';  // How confident is the date
    dateSource: string;  // Where the date was found (e.g., "printed on piece", "research", "style analysis")
    estimatedDimensions: string;
  };
  historicalContext: {
    periodMovement: string;
    culturalSignificance: string;
    originalPurpose: string;
    publication?: string;  // For cover art/illustrations: The New Yorker, Fortune, etc.
    advertiser?: string;   // For advertising: Cognac Briand, Campari, etc.
    eraContext?: string;   // How contemporary audiences perceived it, cultural moment
  };
  technicalAnalysis: {
    printingTechnique: string;
    printer?: string;  // Printer/publisher if visible or known
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
  productDescriptions: ProductDescriptions;  // Marketing descriptions in multiple tones
  talkingPoints: string[];  // Brief bullet points for in-gallery conversations
  notableFigures: NotableFigure[];  // People mentioned/depicted in the item
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
  supplementalImages?: SupplementalImage[];
}

export interface UpdatePosterInput {
  artist?: string;
  artistConfidence?: string;
  artistSource?: string;
  title?: string;
  estimatedDate?: string;
  dateConfidence?: string;
  dateSource?: string;
  dimensionsEstimate?: string;
  historicalContext?: string;
  significance?: string;
  printingTechnique?: string;
  printer?: string;
  rarityAnalysis?: string;
  valueInsights?: string;
  validationNotes?: string;
  productDescription?: string;
  productDescriptions?: ProductDescriptions;
  sourceCitations?: any;
  similarProducts?: any;
  userNotes?: string;
  supplementalImages?: SupplementalImage[];
}
