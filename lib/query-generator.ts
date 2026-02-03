/**
 * Smart Query Generator
 *
 * Generates multiple search query variations from poster data,
 * ranging from broad (more matches) to specific (exact matches).
 */

import type { Poster } from '@/types/poster';

export interface QueryVariation {
  query: string;
  label: string;
  description: string;
  priority: number;  // 1 = highest priority (broad), higher = more specific
}

/**
 * Extract the main title from a poster title
 * Removes common suffixes like "poster", "vintage", "original", etc.
 */
export function extractMainTitle(fullTitle: string | null | undefined): string {
  if (!fullTitle) return '';

  let title = fullTitle.trim();

  // Remove common suffixes (case insensitive)
  const suffixesToRemove = [
    /\s*[-–]\s*original\s*poster\s*$/i,
    /\s*[-–]\s*vintage\s*poster\s*$/i,
    /\s*[-–]\s*poster\s*$/i,
    /\s*original\s*poster\s*$/i,
    /\s*vintage\s*poster\s*$/i,
    /\s*poster\s*$/i,
    /\s*linen\s*backed\s*$/i,
    /\s*linen-backed\s*$/i,
    /\s*paper\s*backed\s*$/i,
  ];

  for (const suffix of suffixesToRemove) {
    title = title.replace(suffix, '');
  }

  // Remove trailing punctuation
  title = title.replace(/[,.\-–:;]+$/, '').trim();

  return title;
}

/**
 * Extract year from a date string
 * Handles various formats: "1933", "c. 1933", "1930s", "circa 1933", etc.
 */
export function extractYear(dateString: string | null | undefined): string | null {
  if (!dateString) return null;

  // Match 4-digit year
  const yearMatch = dateString.match(/\b(1[89]\d{2}|20[0-2]\d)\b/);
  if (yearMatch) {
    return yearMatch[1];
  }

  // Match decade (e.g., "1930s")
  const decadeMatch = dateString.match(/\b(1[89]\d{1}|20[0-2])0s\b/i);
  if (decadeMatch) {
    return `${decadeMatch[1]}0s`;
  }

  return null;
}

/**
 * Clean artist name for search
 * Removes parenthetical info, normalizes spacing
 */
export function cleanArtistName(artist: string | null | undefined): string | null {
  if (!artist || artist === 'Unknown') return null;

  let name = artist.trim();

  // Remove parenthetical info like "(attributed)" or "(1890-1965)"
  name = name.replace(/\s*\([^)]*\)\s*/g, ' ').trim();

  // Normalize spacing
  name = name.replace(/\s+/g, ' ');

  return name || null;
}

/**
 * Generate search query variations from poster data
 *
 * Returns queries from broad (likely to match) to specific (exact match):
 * 1. Title only (broad)
 * 2. Title + artist
 * 3. Title + date
 * 4. Title + artist + date
 * 5. Full original title (exact)
 */
export function generateQueryVariations(poster: Poster): QueryVariation[] {
  const variations: QueryVariation[] = [];

  const mainTitle = extractMainTitle(poster.title);
  const artist = cleanArtistName(poster.artist);
  const year = extractYear(poster.estimatedDate);

  if (!mainTitle) {
    // Fallback to full title if we can't extract main title
    if (poster.title) {
      variations.push({
        query: `"${poster.title}" poster`,
        label: 'Full Title',
        description: 'Search with complete title',
        priority: 1,
      });
    }
    return variations;
  }

  // 1. Broad: Title only with "poster"
  variations.push({
    query: `"${mainTitle}" poster`,
    label: 'Broad',
    description: 'Title only - most likely to find matches',
    priority: 1,
  });

  // 2. Title + Artist (if known)
  if (artist) {
    variations.push({
      query: `"${mainTitle}" ${artist} poster`,
      label: 'With Artist',
      description: `Include artist: ${artist}`,
      priority: 2,
    });
  }

  // 3. Title + Date (if known)
  if (year) {
    variations.push({
      query: `"${mainTitle}" ${year} poster`,
      label: 'With Date',
      description: `Include date: ${year}`,
      priority: 3,
    });
  }

  // 4. Title + Artist + Date (if both known)
  if (artist && year) {
    variations.push({
      query: `"${mainTitle}" ${artist} ${year} poster`,
      label: 'Artist + Date',
      description: `Full context: ${artist}, ${year}`,
      priority: 4,
    });
  }

  // 5. Exact: Full original title (if different from main title)
  if (poster.title && poster.title !== mainTitle) {
    variations.push({
      query: `"${poster.title}"`,
      label: 'Exact Title',
      description: 'Exact title match - most specific',
      priority: 5,
    });
  }

  return variations;
}

/**
 * Generate a single optimized query for broad search
 * Used when we want just one query (e.g., for API efficiency)
 */
export function generateOptimalQuery(poster: Poster): string {
  const mainTitle = extractMainTitle(poster.title);

  if (!mainTitle && poster.title) {
    return `"${poster.title}" poster`;
  }

  if (!mainTitle) {
    return 'vintage poster';
  }

  // Use title + artist if artist is known with confidence
  const artist = cleanArtistName(poster.artist);
  if (artist && (poster.artistConfidenceScore ?? 0) >= 70) {
    return `"${mainTitle}" ${artist} poster`;
  }

  // Default to title only
  return `"${mainTitle}" poster`;
}

/**
 * Language templates for dealer discovery searches
 */
export const DEALER_DISCOVERY_TEMPLATES: Record<string, Record<string, string>> = {
  poster_dealer: {
    en: 'vintage poster dealers {region}',
    fr: "marchands d'affiches anciennes {region}",
    de: 'Vintage Plakat Händler {region}',
    it: "commercianti di manifesti d'epoca {region}",
    es: 'distribuidores de carteles vintage {region}',
    nl: 'vintage poster handelaren {region}',
    ja: 'ヴィンテージポスター ディーラー {region}',
    zh: '复古海报经销商 {region}',
  },
  auction_house: {
    en: 'auction house vintage posters prints {region}',
    fr: "maison de vente aux enchères affiches {region}",
    de: 'Auktionshaus Plakate Drucke {region}',
    it: "casa d'aste manifesti stampe {region}",
    es: 'casa de subastas carteles grabados {region}',
    nl: 'veilinghuis posters prenten {region}',
    ja: 'オークションハウス ポスター 版画 {region}',
    zh: '拍卖行 海报 版画 {region}',
  },
  print_dealer: {
    en: 'antique print dealers {region}',
    fr: "marchands d'estampes anciennes {region}",
    de: 'Antiquarische Drucke Händler {region}',
    it: 'commercianti stampe antiche {region}',
    es: 'distribuidores de grabados antiguos {region}',
    nl: 'antieke prenten handelaren {region}',
    ja: 'アンティークプリント ディーラー {region}',
    zh: '古董版画经销商 {region}',
  },
  book_dealer: {
    en: 'antiquarian book dealers rare books {region}',
    fr: 'libraires antiquaires livres rares {region}',
    de: 'Antiquarische Buchhandlung seltene Bücher {region}',
    it: 'librai antiquari libri rari {region}',
    es: 'libreros anticuarios libros raros {region}',
    nl: 'antiquariaat zeldzame boeken {region}',
    ja: '古書店 稀覯本 {region}',
    zh: '古董书商 珍本书籍 {region}',
  },
  gallery: {
    en: 'vintage art gallery posters prints {region}',
    fr: "galerie d'art affiches estampes {region}",
    de: 'Kunstgalerie Plakate Drucke {region}',
    it: "galleria d'arte manifesti stampe {region}",
    es: 'galería de arte carteles grabados {region}',
    nl: 'kunstgalerie posters prenten {region}',
    ja: 'アートギャラリー ポスター 版画 {region}',
    zh: '艺术画廊 海报 版画 {region}',
  },
  map_dealer: {
    en: 'antique map dealers {region}',
    fr: 'marchands de cartes anciennes {region}',
    de: 'Antike Landkarten Händler {region}',
    it: 'commercianti mappe antiche {region}',
    es: 'distribuidores de mapas antiguos {region}',
    nl: 'antieke kaarten handelaren {region}',
    ja: 'アンティーク地図 ディーラー {region}',
    zh: '古董地图经销商 {region}',
  },
};

/**
 * Region names in different languages
 */
export const REGION_NAMES: Record<string, Record<string, string>> = {
  france: {
    en: 'France',
    fr: 'France',
    de: 'Frankreich',
    it: 'Francia',
    es: 'Francia',
  },
  germany: {
    en: 'Germany',
    fr: 'Allemagne',
    de: 'Deutschland',
    it: 'Germania',
    es: 'Alemania',
  },
  italy: {
    en: 'Italy',
    fr: 'Italie',
    de: 'Italien',
    it: 'Italia',
    es: 'Italia',
  },
  spain: {
    en: 'Spain',
    fr: 'Espagne',
    de: 'Spanien',
    it: 'Spagna',
    es: 'España',
  },
  uk: {
    en: 'United Kingdom',
    fr: 'Royaume-Uni',
    de: 'Vereinigtes Königreich',
    it: 'Regno Unito',
    es: 'Reino Unido',
  },
  netherlands: {
    en: 'Netherlands',
    fr: 'Pays-Bas',
    de: 'Niederlande',
    it: 'Paesi Bassi',
    es: 'Países Bajos',
  },
  japan: {
    en: 'Japan',
    fr: 'Japon',
    de: 'Japan',
    it: 'Giappone',
    es: 'Japón',
    ja: '日本',
  },
  usa: {
    en: 'United States',
    fr: 'États-Unis',
    de: 'Vereinigte Staaten',
    it: 'Stati Uniti',
    es: 'Estados Unidos',
  },
  switzerland: {
    en: 'Switzerland',
    fr: 'Suisse',
    de: 'Schweiz',
    it: 'Svizzera',
    es: 'Suiza',
  },
  belgium: {
    en: 'Belgium',
    fr: 'Belgique',
    de: 'Belgien',
    it: 'Belgio',
    es: 'Bélgica',
  },
  austria: {
    en: 'Austria',
    fr: 'Autriche',
    de: 'Österreich',
    it: 'Austria',
    es: 'Austria',
  },
};

/**
 * Generate a dealer discovery search query
 */
export function generateDealerDiscoveryQuery(
  dealerType: string,
  region: string,
  language: string
): string {
  const templates = DEALER_DISCOVERY_TEMPLATES[dealerType] || DEALER_DISCOVERY_TEMPLATES.poster_dealer;
  const template = templates[language] || templates.en;

  const regionName = REGION_NAMES[region.toLowerCase()]?.[language] ||
    REGION_NAMES[region.toLowerCase()]?.en ||
    region;

  return template.replace('{region}', regionName);
}
