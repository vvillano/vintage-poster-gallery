/**
 * Shared constants for the push queue system.
 * This file has no server-side dependencies and can be imported by both
 * server (API routes) and client (React components) code.
 */

/**
 * Standardized field keys used across push_queue, push_history, and push operations.
 */
export const PUSH_FIELD_KEYS = {
  // Product-level
  title: 'title',
  description: 'description',
  tags: 'tags',
  // Custom namespace
  customArtist: 'metafield:custom.artist',
  customDate: 'metafield:custom.date',
  customTechnique: 'metafield:custom.technique',
  customHistory: 'metafield:custom.history',
  customTalkingPoints: 'metafield:custom.talking_points',
  // Jadepuma namespace
  conciseDescription: 'metafield:jadepuma.concise_description',
  bookTitleSource: 'metafield:jadepuma.book_title_source',
  publisher: 'metafield:jadepuma.publisher',
  printer: 'metafield:jadepuma.printer',
  color: 'metafield:jadepuma.color',
  artistBio: 'metafield:jadepuma.artist_bio',
  countryOfOrigin: 'metafield:jadepuma.country_of_origin',
  medium: 'metafield:jadepuma.medium',
} as const;

// All valid field keys
export const ALL_FIELD_KEYS = Object.values(PUSH_FIELD_KEYS);

// Field keys that map to legacy bulk push groups
export const BULK_FIELD_MAP: Record<string, string[]> = {
  metafields: [
    PUSH_FIELD_KEYS.customArtist,
    PUSH_FIELD_KEYS.customDate,
    PUSH_FIELD_KEYS.customTechnique,
    PUSH_FIELD_KEYS.customHistory,
    PUSH_FIELD_KEYS.customTalkingPoints,
  ],
  research_metafields: [
    PUSH_FIELD_KEYS.conciseDescription,
    PUSH_FIELD_KEYS.bookTitleSource,
    PUSH_FIELD_KEYS.publisher,
    PUSH_FIELD_KEYS.printer,
    PUSH_FIELD_KEYS.color,
    PUSH_FIELD_KEYS.artistBio,
    PUSH_FIELD_KEYS.countryOfOrigin,
    PUSH_FIELD_KEYS.medium,
  ],
};

// Human-readable labels for field keys
export const FIELD_LABELS: Record<string, string> = {
  title: 'Title',
  description: 'Description',
  tags: 'Tags',
  'metafield:custom.artist': 'Artist',
  'metafield:custom.date': 'Date',
  'metafield:custom.technique': 'Technique',
  'metafield:custom.history': 'History',
  'metafield:custom.talking_points': 'Talking Points',
  'metafield:jadepuma.concise_description': 'Concise Description',
  'metafield:jadepuma.book_title_source': 'Publication',
  'metafield:jadepuma.publisher': 'Publisher',
  'metafield:jadepuma.printer': 'Printer',
  'metafield:jadepuma.color': 'Colors',
  'metafield:jadepuma.artist_bio': 'Artist Bio',
  'metafield:jadepuma.country_of_origin': 'Country of Origin',
  'metafield:jadepuma.medium': 'Medium',
};

/**
 * Expand legacy bulk field names into granular field keys.
 */
export function expandFieldKeys(fields: string[]): string[] {
  const expanded: string[] = [];
  for (const field of fields) {
    if (BULK_FIELD_MAP[field]) {
      expanded.push(...BULK_FIELD_MAP[field]);
    } else {
      expanded.push(field);
    }
  }
  return [...new Set(expanded)];
}
