/**
 * Seller types for the acquisition tracking system
 *
 * Sellers = WHO you buy from (auction houses, dealers, galleries, individuals)
 * This replaces the old "dealers" table/types with clearer naming.
 */

// Seller types - WHO you can buy from
export type SellerType =
  | 'auction_house'
  | 'dealer'        // Generic dealer (posters, books, prints, etc.)
  | 'gallery'
  | 'bookstore'
  | 'individual'    // Private seller
  | 'other';

// Legacy dealer types that map to seller types
export type LegacyDealerType =
  | 'auction_house'
  | 'poster_dealer'
  | 'book_dealer'
  | 'print_dealer'
  | 'map_dealer'
  | 'ephemera_dealer'
  | 'photography_dealer'
  | 'gallery'
  | 'marketplace'   // Should be in platforms, not sellers
  | 'aggregator'    // Should be in platforms, not sellers
  | 'museum'        // Should be in archive config, not sellers
  | 'reproduction'; // Should be excluded

// Map legacy dealer types to seller types
export const LEGACY_TYPE_TO_SELLER_TYPE: Record<LegacyDealerType, SellerType | null> = {
  auction_house: 'auction_house',
  poster_dealer: 'dealer',
  book_dealer: 'dealer',
  print_dealer: 'dealer',
  map_dealer: 'dealer',
  ephemera_dealer: 'dealer',
  photography_dealer: 'dealer',
  gallery: 'gallery',
  marketplace: null,    // Not a seller - goes to platforms
  aggregator: null,     // Not a seller - goes to platforms
  museum: null,         // Not a seller - goes to archive config
  reproduction: null,   // Excluded
};

export type SellerRegion =
  | 'North America'
  | 'Europe'
  | 'Asia'
  | 'Global'
  | 'UK'
  | 'France'
  | 'Germany'
  | 'Italy'
  | 'Japan'
  | 'Other';

// Specialization categories (kept from dealer.ts)
export type PosterSpecialization =
  | 'movie_posters'
  | 'travel'
  | 'advertising'
  | 'circus'
  | 'theater'
  | 'music'
  | 'sports'
  | 'all_posters';

export type ArtMovementSpecialization =
  | 'art_deco'
  | 'art_nouveau'
  | 'modernist'
  | 'victorian';

export type HistoricalPeriodSpecialization =
  | 'wwi'
  | 'wwii'
  | 'propaganda'
  | 'civil_war'
  | 'belle_epoque';

export type GeographicSpecialization =
  | 'french'
  | 'italian'
  | 'american'
  | 'british'
  | 'german'
  | 'japanese'
  | 'swiss';

export type TechniqueSpecialization =
  | 'lithography'
  | 'chromolithography'
  | 'screenprint'
  | 'offset'
  | 'woodcut'
  | 'engraving';

export type BookPrintSpecialization =
  | 'natural_history'
  | 'botanical'
  | 'ornithology'
  | 'maps'
  | 'atlases'
  | 'illustrated_books'
  | 'rare_books'
  | 'miniature_books';

export type GeneralSpecialization =
  | 'fine_art'
  | 'decorative'
  | 'entertainment'
  | 'illustration'
  | 'general_vintage'
  | 'all'
  | 'all_auctions'
  | 'books'
  | 'prints'
  | 'ephemera';

export type SellerSpecialization =
  | PosterSpecialization
  | ArtMovementSpecialization
  | HistoricalPeriodSpecialization
  | GeographicSpecialization
  | TechniqueSpecialization
  | BookPrintSpecialization
  | GeneralSpecialization;

// Reliability tiers with descriptions
export const RELIABILITY_TIERS: Record<number, { label: string; description: string }> = {
  1: { label: 'Tier 1', description: 'Major auction houses - highest reliability' },
  2: { label: 'Tier 2', description: 'Specialized dealers - high expertise' },
  3: { label: 'Tier 3', description: 'Established dealers - good reliability' },
  4: { label: 'Tier 4', description: 'General dealers - medium reliability' },
  5: { label: 'Tier 5', description: 'Newer/smaller dealers - variable reliability' },
  6: { label: 'Tier 6', description: 'Individual sellers - lower reliability' },
};

// Seller type labels for UI
export const SELLER_TYPE_LABELS: Record<SellerType, string> = {
  auction_house: 'Auction House',
  dealer: 'Dealer',
  gallery: 'Gallery',
  bookstore: 'Bookstore',
  individual: 'Individual Seller',
  other: 'Other',
};

// Specialization categories for UI grouping
export const SPECIALIZATION_CATEGORIES: Record<string, { label: string; options: SellerSpecialization[] }> = {
  poster: {
    label: 'Poster Types',
    options: ['movie_posters', 'travel', 'advertising', 'circus', 'theater', 'music', 'sports', 'all_posters'],
  },
  art_movement: {
    label: 'Art Movements',
    options: ['art_deco', 'art_nouveau', 'modernist', 'victorian'],
  },
  historical: {
    label: 'Historical Periods',
    options: ['wwi', 'wwii', 'propaganda', 'civil_war', 'belle_epoque'],
  },
  geographic: {
    label: 'Geographic',
    options: ['french', 'italian', 'american', 'british', 'german', 'japanese', 'swiss'],
  },
  technique: {
    label: 'Techniques',
    options: ['lithography', 'chromolithography', 'screenprint', 'offset', 'woodcut', 'engraving'],
  },
  book_print: {
    label: 'Books & Prints',
    options: ['natural_history', 'botanical', 'ornithology', 'maps', 'atlases', 'illustrated_books', 'rare_books', 'miniature_books'],
  },
  general: {
    label: 'General',
    options: ['fine_art', 'decorative', 'entertainment', 'illustration', 'general_vintage', 'all', 'all_auctions', 'books', 'prints', 'ephemera'],
  },
};

// Human-readable labels for specializations
export const SPECIALIZATION_LABELS: Record<SellerSpecialization, string> = {
  // Poster types
  movie_posters: 'Movie Posters',
  travel: 'Travel',
  advertising: 'Advertising',
  circus: 'Circus',
  theater: 'Theater',
  music: 'Music',
  sports: 'Sports',
  all_posters: 'All Posters',
  // Art movements
  art_deco: 'Art Deco',
  art_nouveau: 'Art Nouveau',
  modernist: 'Modernist',
  victorian: 'Victorian',
  // Historical periods
  wwi: 'WWI',
  wwii: 'WWII',
  propaganda: 'Propaganda',
  civil_war: 'Civil War',
  belle_epoque: 'Belle Époque',
  // Geographic
  french: 'French',
  italian: 'Italian',
  american: 'American',
  british: 'British',
  german: 'German',
  japanese: 'Japanese',
  swiss: 'Swiss',
  // Techniques
  lithography: 'Lithography',
  chromolithography: 'Chromolithography',
  screenprint: 'Screenprint',
  offset: 'Offset',
  woodcut: 'Woodcut',
  engraving: 'Engraving',
  // Book/print specific
  natural_history: 'Natural History',
  botanical: 'Botanical',
  ornithology: 'Ornithology',
  maps: 'Maps',
  atlases: 'Atlases',
  illustrated_books: 'Illustrated Books',
  rare_books: 'Rare Books',
  miniature_books: 'Miniature Books',
  // General
  fine_art: 'Fine Art',
  decorative: 'Decorative',
  entertainment: 'Entertainment',
  illustration: 'Illustration',
  general_vintage: 'General Vintage',
  all: 'All',
  all_auctions: 'All Auctions',
  books: 'Books',
  prints: 'Prints',
  ephemera: 'Ephemera',
};

/**
 * Main Seller interface
 * Represents WHO you buy from
 */
export interface Seller {
  id: number;
  name: string;
  slug: string;
  type: SellerType;
  website?: string | null;

  // Location
  country?: string | null;
  city?: string | null;
  region?: SellerRegion | null;

  // Contact
  email?: string | null;
  phone?: string | null;

  // Reliability & Capabilities
  reliabilityTier: number; // 1-6
  attributionWeight: number; // 0.50 - 0.95 (confidence in their attributions)
  pricingWeight: number; // 0.50 - 0.95 (confidence in their pricing)

  // Research capability - can this seller's archives be searched?
  canResearchAt: boolean;

  // Legacy capability flags (for backward compatibility)
  canResearch?: boolean;
  canPrice?: boolean;
  canProcure?: boolean;
  canBeSource?: boolean;
  excludeFromResults?: boolean;

  // Search Integration
  searchUrlTemplate?: string | null;
  searchSoldUrlTemplate?: string | null;

  // Specializations
  specializations: SellerSpecialization[];

  // Credentials (for their website login)
  username?: string | null;
  password?: string | null;

  // Metadata
  notes?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// For creating a new seller
export interface CreateSellerInput {
  name: string;
  type: SellerType;
  website?: string | null;
  country?: string | null;
  city?: string | null;
  region?: SellerRegion | null;
  email?: string | null;
  phone?: string | null;
  reliabilityTier?: number;
  attributionWeight?: number;
  pricingWeight?: number;
  canResearchAt?: boolean;
  searchUrlTemplate?: string | null;
  searchSoldUrlTemplate?: string | null;
  specializations?: SellerSpecialization[];
  username?: string | null;
  password?: string | null;
  notes?: string | null;
  isActive?: boolean;
}

// For updating a seller
export interface UpdateSellerInput extends Partial<CreateSellerInput> {
  id: number;
}

// Default values for new sellers based on type
export function getDefaultsForSellerType(type: SellerType): Partial<CreateSellerInput> {
  switch (type) {
    case 'auction_house':
      return {
        reliabilityTier: 1,
        attributionWeight: 0.9,
        pricingWeight: 0.9,
        canResearchAt: true,
      };
    case 'dealer':
      return {
        reliabilityTier: 2,
        attributionWeight: 0.85,
        pricingWeight: 0.85,
        canResearchAt: true,
      };
    case 'gallery':
      return {
        reliabilityTier: 2,
        attributionWeight: 0.8,
        pricingWeight: 0.8,
        canResearchAt: true,
      };
    case 'bookstore':
      return {
        reliabilityTier: 3,
        attributionWeight: 0.75,
        pricingWeight: 0.75,
        canResearchAt: false,
      };
    case 'individual':
      return {
        reliabilityTier: 5,
        attributionWeight: 0.6,
        pricingWeight: 0.6,
        canResearchAt: false,
      };
    default:
      return {
        reliabilityTier: 4,
        attributionWeight: 0.7,
        pricingWeight: 0.7,
        canResearchAt: false,
      };
  }
}

// Helper to generate slug from name
export function generateSellerSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Get tier badge color for UI
export function getSellerTierBadgeColor(tier: number): string {
  switch (tier) {
    case 1:
      return 'emerald'; // Major auction houses
    case 2:
      return 'blue';    // Specialized dealers
    case 3:
      return 'violet';  // Established dealers
    case 4:
      return 'amber';   // General dealers
    case 5:
      return 'orange';  // Newer dealers
    case 6:
      return 'slate';   // Individual sellers
    default:
      return 'slate';
  }
}
