// Supplemental image for additional analysis context
export interface SupplementalImage {
  url: string;
  blobId: string;
  fileName: string;
  description?: string;  // Optional description of what this image shows
  uploadDate: Date;
}

// Tag for item categorization
export interface Tag {
  id: number;
  name: string;
  createdAt: Date;
}

// Comparable sale record for market research
export interface ComparableSale {
  id: string;           // UUID for unique identification
  date: string;         // ISO date string (YYYY-MM-DD)
  price: number;        // Sale price
  currency: string;     // Currency code (default "USD")
  source: string;       // Where found: "Worthpoint", "Invaluable", "Heritage Auctions", etc.
  condition?: string;   // Condition of the sold item
  notes?: string;       // Additional notes about the sale
  url?: string;         // Link to the sale/listing
  createdAt: string;    // ISO timestamp when record was added
}

// Research site for price research (legacy interface - kept for compatibility)
export interface ResearchSite {
  id: number;
  name: string;
  urlTemplate: string;          // URL with optional {search} placeholder
  requiresSubscription: boolean;
  username?: string | null;     // Login credentials (optional)
  password?: string | null;
  displayOrder: number;
  createdAt: Date;
}

// Unified Platform - consolidates acquisition platforms and research sites
export interface Platform {
  id: number;
  name: string;                        // Platform name (eBay, Invaluable, WorthPoint, etc.)
  url?: string | null;                 // Main platform URL
  searchUrlTemplate?: string | null;   // Search URL with {search} placeholder
  isAcquisitionPlatform: boolean;      // Used for buying (syncs to Shopify)
  isResearchSite: boolean;             // Used for price research (shows in research buttons)
  requiresSubscription: boolean;       // Requires paid subscription
  username?: string | null;            // Login credentials
  password?: string | null;
  displayOrder: number;                // Order for research buttons
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Research link sources for price research (legacy - will be replaced by database)
export const RESEARCH_SOURCES = [
  { name: 'Worthpoint', urlTemplate: 'https://www.worthpoint.com/search?query={search}', requiresSubscription: true },
  { name: 'Invaluable', urlTemplate: 'https://www.invaluable.com/search?query={search}', requiresSubscription: true },
  { name: 'Heritage Auctions', urlTemplate: 'https://historical.ha.com/c/search-results.zx?N=51&Ntt={search}', requiresSubscription: false },
  { name: 'LiveAuctioneers', urlTemplate: 'https://www.liveauctioneers.com/search/?keyword={search}&sort=-sale_date', requiresSubscription: false },
  { name: 'eBay Sold', urlTemplate: 'https://www.ebay.com/sch/i.html?_nkw={search}&LH_Complete=1&LH_Sold=1&_sop=13', requiresSubscription: false },
] as const;

// =====================
// Managed Lists Types
// =====================

// Media Type (Printing Technique)
export interface MediaType {
  id: number;
  name: string;
  displayOrder: number;
  createdAt: Date;
}

// Artist with aliases for name matching
export interface Artist {
  id: number;
  name: string;              // Canonical name
  aliases: string[];         // Alternative spellings/forms
  nationality?: string | null;
  birthYear?: number | null;
  deathYear?: number | null;
  notes?: string | null;
  wikipediaUrl?: string | null;  // Wikipedia page URL
  bio?: string | null;           // Biographical summary
  imageUrl?: string | null;      // Artist portrait/photo URL
  verified: boolean;             // Is this a verified artist profile?
  createdAt: Date;
  updatedAt: Date;
}

// Printer with verification fields
export interface Printer {
  id: number;
  name: string;              // Canonical name: "DAN", "Imprimerie Chaix"
  aliases: string[];         // Variations: ["Danesi", "DAN Roma"]
  location?: string | null;  // "Rome, Italy"
  country?: string | null;   // "Italy"
  foundedYear?: number | null;
  closedYear?: number | null;
  notes?: string | null;
  wikipediaUrl?: string | null;
  bio?: string | null;
  imageUrl?: string | null;
  verified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Publisher (magazines, newspapers, publishing houses)
export interface Publisher {
  id: number;
  name: string;              // Canonical name: "The New Yorker", "Fortune"
  aliases: string[];         // Variations: ["New Yorker", "The New-Yorker"]
  publicationType?: string | null;  // "Magazine", "Newspaper", "Book Publisher"
  country?: string | null;   // "United States"
  foundedYear?: number | null;
  ceasedYear?: number | null;
  notes?: string | null;
  wikipediaUrl?: string | null;
  bio?: string | null;       // Editorial focus, notable artists
  imageUrl?: string | null;  // Logo or cover image
  verified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Linked printer data for display in poster detail
export interface LinkedPrinter {
  id: number;
  name: string;
  location?: string | null;
  country?: string | null;
  foundedYear?: number | null;
  closedYear?: number | null;
  wikipediaUrl?: string | null;
  bio?: string | null;
  imageUrl?: string | null;
  verified: boolean;
}

// Linked publisher data for display in poster detail
export interface LinkedPublisher {
  id: number;
  name: string;
  publicationType?: string | null;
  country?: string | null;
  foundedYear?: number | null;
  ceasedYear?: number | null;
  wikipediaUrl?: string | null;
  bio?: string | null;
  imageUrl?: string | null;
  verified: boolean;
}

// Book (source publication for antique prints/plates)
export interface Book {
  id: number;
  title: string;                    // "Birds of Pennsylvania"
  author?: string | null;           // "Dr. B.H. Warren"
  publicationYear?: number | null;  // 1890
  publisherId?: number | null;      // FK to publishers table (publishing house)
  contributors?: string | null;     // "Illustrated by John James Audubon, engraved by Robert Havell"
  country?: string | null;          // "United States"
  edition?: string | null;          // "Second Edition"
  volumeInfo?: string | null;       // "Volume II"
  notes?: string | null;            // Research notes
  wikipediaUrl?: string | null;
  bio?: string | null;              // Description of the book
  imageUrl?: string | null;         // Cover image
  verified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Linked book data for display in poster detail
export interface LinkedBook {
  id: number;
  title: string;
  author?: string | null;
  publicationYear?: number | null;
  publisherId?: number | null;
  contributors?: string | null;
  country?: string | null;
  edition?: string | null;
  volumeInfo?: string | null;
  wikipediaUrl?: string | null;
  bio?: string | null;
  imageUrl?: string | null;
  verified: boolean;
}

// Printer verification checklist for rigorous identification
export interface PrinterVerification {
  marksReadable: boolean;        // Are printer marks/stamps visible?
  marksText: string;             // Exact text: "Imp. DAN", "Stamperia..."
  historyVerified: boolean;      // Did this printer exist in that era?
  locationMatches: boolean;      // Printer location matches poster origin?
  styleMatches: boolean;         // Printing style consistent with known works?
  verificationNotes: string;     // Explanation
}

// Internal Tag (separate from public item tags)
export interface InternalTag {
  id: number;
  name: string;
  color: string;             // Hex color for UI display
  displayOrder: number;
  createdAt: Date;
}

// Source Platform (acquisition source)
export interface SourcePlatform {
  id: number;
  name: string;
  urlTemplate?: string | null;
  displayOrder: number;
  createdAt: Date;
}

// Physical Location (storage)
export interface Location {
  id: number;
  name: string;
  description?: string | null;
  displayOrder: number;
  createdAt: Date;
}

// Country of Origin
export interface Country {
  id: number;
  name: string;
  code?: string | null;      // ISO country code
  displayOrder: number;
  createdAt: Date;
}

// =====================
// Research Enhancement Types
// =====================

// Research data for platforms (augments Shopify's source/platform values)
// Legacy interface - use Platform instead (consolidated platforms table)
export interface PlatformResearchData {
  id: number;
  platformName: string;         // Links to Shopify's source_platform value
  url?: string | null;
  username?: string | null;     // Login credentials for research
  password?: string | null;
  isResearchSite: boolean;      // Also usable for price research
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Private Seller - actual person/business in seller directory
export type SellerType = 'individual' | 'dealer' | 'auction_house' | 'gallery' | 'bookstore' | 'other';

export interface PrivateSeller {
  id: number;
  name: string;                 // Actual business/person name
  sellerType: SellerType;
  email?: string | null;
  phone?: string | null;
  url?: string | null;
  username?: string | null;     // Login credentials for their site
  password?: string | null;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
  // Linked platform identities (for display)
  platformIdentities?: PlatformIdentity[];
}

// Platform Identity - username on a specific platform, optionally linked to a seller
export interface PlatformIdentity {
  id: number;
  platformName: string;         // eBay, Invaluable, etc.
  platformUsername: string;     // vintageposterking, jsmith-posters
  sellerId?: number | null;     // FK to private_sellers (null if unknown)
  seller?: PrivateSeller | null;// Joined seller data for display
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Research image type classification
export type ResearchImageType = 'signature' | 'title_page' | 'printer_mark' | 'detail' | 'other';

// Research images (stored locally, not synced to Shopify)
export interface ResearchImage {
  url: string;
  blobId: string;
  fileName: string;
  imageType: ResearchImageType;
  description?: string;
  uploadDate: Date;
}

// Metafield data from Shopify
export interface ShopifyMetafieldData {
  namespace: string;
  key: string;
  value: string;
  type: string;
}

// Shopify data snapshot stored with poster (defined before Poster for reference)
export interface ShopifyData {
  price: string | null;
  compareAtPrice: string | null;
  inventoryQuantity: number | null;
  cost: string | null; // Variant cost (COGS)
  productType: string | null;
  shopifyTags: string[];
  bodyHtml: string | null;
  createdAt: string;
  updatedAt: string;
  // All metafields stored for reference
  metafields?: ShopifyMetafieldData[];
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

  // Item tags for categorization
  itemTags?: string[] | null;

  // Colors identified in the image
  colors?: string[] | null;

  // Comparable sales for market research
  comparableSales?: ComparableSale[] | null;

  // Initial information provided at upload (optional)
  initialInformation?: string | null;

  // Product classification
  productType?: string | null;

  // AI Analysis Results
  artist?: string | null;
  artistConfidence?: string | null;  // confirmed, likely, uncertain, unknown
  artistConfidenceScore?: number | null;  // 0-100 percentage
  artistSource?: string | null;  // Where the artist name was found
  artistSignatureText?: string | null;  // Exact signature text (e.g., "P. Verger")
  artistVerification?: ArtistVerification | null;  // Verification checklist
  artistId?: number | null;  // FK to artists table for confirmed attributions
  title?: string | null;
  estimatedDate?: string | null;
  dateConfidence?: string | null;  // confirmed, likely, uncertain, unknown
  dateSource?: string | null;  // Where the date was found
  dimensionsEstimate?: string | null;
  historicalContext?: string | null;
  significance?: string | null;
  printingTechnique?: string | null;
  printingTechniqueIds?: number[] | null;  // FK array to media_types table
  printer?: string | null;  // Printer/publisher if known
  printerId?: number | null;  // FK to printers table
  printerConfidence?: string | null;  // confirmed, likely, uncertain, unknown
  printerSource?: string | null;  // Where the printer was found
  printerVerification?: PrinterVerification | null;  // Verification checklist
  publisherId?: number | null;  // FK to publishers table
  publisherConfidence?: string | null;  // confirmed, likely, uncertain, unknown
  publisherSource?: string | null;  // Where the publisher was found

  // Publication identification (for periodicals - magazines, newspapers, weeklies)
  publication?: string | null;  // Normalized publication name (e.g., "Harper's Weekly")
  publicationConfidence?: string | null;  // confirmed, likely, uncertain, unknown
  publicationSource?: string | null;  // How the publication was identified

  // Book source (for antique prints/plates from books)
  bookId?: number | null;  // FK to books table
  linkedBook?: LinkedBook | null;  // Joined book data for display

  rarityAnalysis?: string | null;
  valueInsights?: string | null;
  validationNotes?: string | null;  // AI notes on validating initial information
  productDescription?: string | null;  // Marketing-ready description for website (backwards compat)
  productDescriptions?: ProductDescriptions | null;  // All description tones
  sourceCitations?: any | null;  // JSON array of source links with descriptions
  similarProducts?: any | null;  // JSON array of similar products on other sites

  // Condition (from Shopify metafields or manual entry)
  condition?: string | null;
  conditionDetails?: string | null;

  // Metadata
  analysisCompleted: boolean;
  analysisDate?: Date | null;
  rawAiResponse?: any | null;
  userNotes?: string | null;
  lastModified: Date;

  // Shopify Integration
  shopifyProductId?: string | null;
  sku?: string | null;
  shopifyStatus?: 'draft' | 'active' | 'archived' | null;
  shopifySyncedAt?: Date | null;
  shopifyData?: ShopifyData | null;

  // Research-specific fields
  shopifyTitle?: string | null;           // Original Shopify title for revert option
  researchImages?: ResearchImage[] | null; // Local research images (signatures, title pages, etc.)
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
export const DESCRIPTION_TONES = ['standard', 'scholarly', 'concise', 'enthusiastic', 'immersive'] as const;
export type DescriptionTone = typeof DESCRIPTION_TONES[number];

// Product descriptions in multiple tones
export interface ProductDescriptions {
  standard: string;      // Gallery voice - sophisticated, art-historically grounded
  scholarly: string;     // Academic tone - more formal, detailed provenance focus
  concise: string;       // Just the facts - minimal prose, key details only
  enthusiastic: string;  // Collector-focused - energetic, highlights appeal
  immersive: string;     // Narrative storytelling - transports reader to the historical moment
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

// Linked artist data for display in poster detail
export interface LinkedArtist {
  id: number;
  name: string;
  nationality?: string | null;
  birthYear?: number | null;
  deathYear?: number | null;
  wikipediaUrl?: string | null;
  bio?: string | null;
  imageUrl?: string | null;
  verified: boolean;
}

// Artist verification checklist for rigorous identification
export interface ArtistVerification {
  signatureReadable: boolean;      // Is there a clear signature?
  signatureText: string;           // Exact text of signature (e.g., "P. Verger")
  professionVerified: boolean;     // Was this person actually an illustrator/poster artist?
  eraMatches: boolean;             // Was artist active during the estimated date?
  styleMatches: boolean;           // Is the style consistent with known works?
  multipleArtistsWithName: boolean; // Are there other artists with similar names?
  verificationNotes: string;       // Explanation of verification process and any concerns
}

// Structured analysis response from Claude
export interface PosterAnalysis {
  identification: {
    artist: string;                 // Full attributed name (e.g., "Pierre Verger")
    artistConfidence: 'confirmed' | 'likely' | 'uncertain' | 'unknown';  // Categorical confidence
    artistConfidenceScore: number;  // 0-100 percentage for granular confidence
    artistSource: string;           // Where the artist name was found
    artistVerification: ArtistVerification;  // Detailed verification checklist
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
    // For periodicals (magazines, newspapers, illustrated weeklies)
    publication?: string;  // Publication name: "Harper's Weekly", "The New Yorker", etc.
    publicationConfidence?: 'confirmed' | 'likely' | 'uncertain' | 'unknown';
    publicationSource?: string;  // How publication was identified
    // For book plates/prints
    bookTitle?: string;     // Book title if from a book source
    bookAuthor?: string;    // Book author if known
    bookYear?: number;      // Book publication year if known
    advertiser?: string;    // For advertising: Cognac Briand, Campari, etc.
    eraContext?: string;    // How contemporary audiences perceived it, cultural moment
    timeAndPlace?: {
      world?: string;      // US perspective: What Americans experienced, global events in US news
      regional?: string;   // Country of origin: Politics, economy, social movements
      local?: string;      // City/industry: Who commissioned this, local context
    };
  };
  technicalAnalysis: {
    printingTechnique: string;
    printer?: string;  // Printer name if identified
    printerConfidence?: 'confirmed' | 'likely' | 'uncertain' | 'unknown';
    printerSource?: string;  // Where printer was found
    printerVerification?: PrinterVerification;
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
  suggestedTags?: string[];  // AI-suggested tags from master list
  suggestedPrintingTechniques?: string[];  // AI-suggested techniques from media_types list
  suggestedColors?: string[];  // AI-suggested colors from colors managed list
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
  artistConfidenceScore?: number;
  artistSource?: string;
  artistSignatureText?: string;
  artistVerification?: ArtistVerification;
  artistId?: number | null;  // FK to artists table for confirmed attributions
  title?: string;
  estimatedDate?: string;
  dateConfidence?: string;
  dateSource?: string;
  dimensionsEstimate?: string;
  historicalContext?: string;
  significance?: string;
  printingTechnique?: string;
  printingTechniqueIds?: number[] | null;
  printer?: string;
  printerId?: number | null;
  printerConfidence?: string;
  printerSource?: string;
  printerVerification?: PrinterVerification;
  publisherId?: number | null;
  publisherConfidence?: string;
  publisherSource?: string;
  // Publication (periodicals) fields
  publication?: string;
  publicationConfidence?: string;
  publicationSource?: string;
  // Book source fields
  bookId?: number | null;
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

// =====================
// Shopify Integration Types
// =====================

// Shopify store configuration
export interface ShopifyConfig {
  id: number;
  shopDomain: string;
  accessToken: string;
  apiVersion: string;
  // OAuth credentials (for Dev Dashboard apps)
  clientId?: string;
  clientSecret?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Shopify product from API
export interface ShopifyProduct {
  id: string;
  title: string;
  handle: string;
  status: 'draft' | 'active' | 'archived';
  productType: string | null;
  tags: string[];
  bodyHtml: string | null;
  variants: ShopifyVariant[];
  images: ShopifyImage[];
  createdAt: string;
  updatedAt: string;
}

// Shopify product variant
export interface ShopifyVariant {
  id: string;
  sku: string | null;
  price: string;
  compareAtPrice: string | null;
  inventoryQuantity: number | null;
  cost: string | null; // Variant cost (COGS)
}

// Shopify product image
export interface ShopifyImage {
  id: string;
  src: string;
  altText: string | null;
  width: number;
  height: number;
}

