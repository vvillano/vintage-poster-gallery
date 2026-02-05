// Dealer types for the comprehensive dealer database

export type DealerType =
  | 'auction_house'
  | 'poster_dealer'
  | 'book_dealer'
  | 'print_dealer'
  | 'map_dealer'
  | 'ephemera_dealer'
  | 'photography_dealer'
  | 'gallery'
  | 'marketplace'
  | 'aggregator'
  | 'museum';

// Category for filtering by purpose (Research vs Valuation)
export type DealerCategory = 'dealer' | 'research' | 'platform';

export type DealerRegion =
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

// Specialization categories
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

export type DealerSpecialization =
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
  3: { label: 'Tier 3', description: 'Museums/institutions - academic reliability' },
  4: { label: 'Tier 4', description: 'General marketplaces - medium reliability' },
  5: { label: 'Tier 5', description: 'Aggregators - variable reliability' },
  6: { label: 'Tier 6', description: 'General sites - lower reliability' },
};

// Dealer type labels for UI
export const DEALER_TYPE_LABELS: Record<DealerType, string> = {
  auction_house: 'Auction House',
  poster_dealer: 'Poster Dealer',
  book_dealer: 'Book Dealer',
  print_dealer: 'Print Dealer',
  map_dealer: 'Map Dealer',
  ephemera_dealer: 'Ephemera Dealer',
  photography_dealer: 'Photography Dealer',
  gallery: 'Gallery',
  marketplace: 'Marketplace',
  aggregator: 'Aggregator',
  museum: 'Museum/Institution',
};

// Category labels for UI
export const DEALER_CATEGORY_LABELS: Record<DealerCategory, string> = {
  dealer: 'Dealer',
  research: 'Research Institution',
  platform: 'Platform',
};

// Map dealer types to their default category
export const DEALER_TYPE_TO_CATEGORY: Record<DealerType, DealerCategory> = {
  auction_house: 'dealer',
  poster_dealer: 'dealer',
  book_dealer: 'dealer',
  print_dealer: 'dealer',
  map_dealer: 'dealer',
  ephemera_dealer: 'dealer',
  photography_dealer: 'dealer',
  gallery: 'dealer',
  marketplace: 'platform',
  aggregator: 'platform',
  museum: 'research',
};

// Specialization categories for UI grouping
export const SPECIALIZATION_CATEGORIES: Record<string, { label: string; options: DealerSpecialization[] }> = {
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
export const SPECIALIZATION_LABELS: Record<DealerSpecialization, string> = {
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

// Main Dealer interface
export interface Dealer {
  id: number;
  name: string;
  slug: string;
  type: DealerType;
  category: DealerCategory; // dealer, research, or platform
  website?: string | null;

  // Location
  country?: string | null;
  city?: string | null;
  region?: DealerRegion | null;

  // Contact
  email?: string | null;
  phone?: string | null;

  // Reliability & Capabilities
  reliabilityTier: number; // 1-6
  attributionWeight: number; // 0.50 - 0.95
  pricingWeight: number; // 0.50 - 0.95

  // Capabilities
  canResearch: boolean;
  canPrice: boolean;
  canProcure: boolean;
  canBeSource: boolean;

  // Search Integration
  searchUrlTemplate?: string | null;
  searchSoldUrlTemplate?: string | null;

  // Specializations
  specializations: DealerSpecialization[];

  // Link to Sellers
  linkedSellerId?: number | null;

  // Metadata
  notes?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// For creating a new dealer
export interface CreateDealerInput {
  name: string;
  type: DealerType;
  category?: DealerCategory; // Defaults based on type if not provided
  website?: string | null;
  country?: string | null;
  city?: string | null;
  region?: DealerRegion | null;
  email?: string | null;
  phone?: string | null;
  reliabilityTier?: number;
  attributionWeight?: number;
  pricingWeight?: number;
  canResearch?: boolean;
  canPrice?: boolean;
  canProcure?: boolean;
  canBeSource?: boolean;
  searchUrlTemplate?: string | null;
  searchSoldUrlTemplate?: string | null;
  specializations?: DealerSpecialization[];
  linkedSellerId?: number | null;
  notes?: string | null;
  isActive?: boolean;
}

// For updating a dealer
export interface UpdateDealerInput extends Partial<CreateDealerInput> {
  id: number;
}

// Default values for new dealers based on type
export function getDefaultsForDealerType(type: DealerType): Partial<CreateDealerInput> {
  // Get category from type mapping
  const category = DEALER_TYPE_TO_CATEGORY[type] || 'dealer';

  switch (type) {
    case 'auction_house':
      return {
        category,
        reliabilityTier: 1,
        attributionWeight: 0.9,
        pricingWeight: 0.9,
        canResearch: true,
        canPrice: true,
        canProcure: true,
        canBeSource: true,
      };
    case 'poster_dealer':
    case 'book_dealer':
    case 'print_dealer':
    case 'map_dealer':
    case 'ephemera_dealer':
    case 'photography_dealer':
      return {
        category,
        reliabilityTier: 2,
        attributionWeight: 0.85,
        pricingWeight: 0.85,
        canResearch: true,
        canPrice: true,
        canProcure: true,
        canBeSource: true,
      };
    case 'gallery':
      return {
        category,
        reliabilityTier: 2,
        attributionWeight: 0.8,
        pricingWeight: 0.8,
        canResearch: true,
        canPrice: true,
        canProcure: true,
        canBeSource: true,
      };
    case 'museum':
      return {
        category,
        reliabilityTier: 3,
        attributionWeight: 0.9,
        pricingWeight: 0.5,
        canResearch: true,
        canPrice: false,
        canProcure: false,
        canBeSource: false,
      };
    case 'marketplace':
      return {
        category,
        reliabilityTier: 4,
        attributionWeight: 0.7,
        pricingWeight: 0.7,
        canResearch: true,
        canPrice: true,
        canProcure: true,
        canBeSource: true,
      };
    case 'aggregator':
      return {
        category,
        reliabilityTier: 5,
        attributionWeight: 0.65,
        pricingWeight: 0.7,
        canResearch: true,
        canPrice: true,
        canProcure: true,
        canBeSource: true,
      };
    default:
      return {
        category: 'dealer',
        reliabilityTier: 3,
        attributionWeight: 0.7,
        pricingWeight: 0.7,
        canResearch: true,
        canPrice: true,
        canProcure: false,
        canBeSource: true,
      };
  }
}

// Helper to generate slug from name
export function generateDealerSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
