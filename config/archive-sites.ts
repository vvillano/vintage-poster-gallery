/**
 * Archive and Reference Sites Configuration
 *
 * These are pure research/reference sites that you cannot acquire items from.
 * They are used for:
 * - Historical/academic research (identifying items)
 * - Attribution verification
 * - Contextual information
 *
 * Unlike Platforms (WHERE you buy) and Sellers (WHO you buy from),
 * these are simple config entries, not managed database entities.
 */

export type ArchiveSiteCategory = 'academic' | 'reference' | 'museum';

export interface ArchiveSite {
  id: string;
  name: string;
  url: string;
  searchUrlTemplate?: string; // URL with {search} placeholder
  category: ArchiveSiteCategory;
  description?: string;
  displayOrder: number;
}

/**
 * Academic and museum archives for historical/identification research
 */
export const ACADEMIC_ARCHIVES: ArchiveSite[] = [
  {
    id: 'loc',
    name: 'Library of Congress',
    url: 'https://www.loc.gov',
    searchUrlTemplate: 'https://www.loc.gov/search/?q={search}&fa=online-format:image',
    category: 'academic',
    description: 'US national library with extensive poster and print collections',
    displayOrder: 1,
  },
  {
    id: 'moma',
    name: 'MoMA Collection',
    url: 'https://www.moma.org/collection/',
    searchUrlTemplate: 'https://www.moma.org/collection/?q={search}&classifications=any&date_begin=Pre-1850&date_end=2025',
    category: 'museum',
    description: 'Museum of Modern Art collection database',
    displayOrder: 2,
  },
  {
    id: 'smithsonian',
    name: 'Smithsonian',
    url: 'https://www.si.edu/collections',
    searchUrlTemplate: 'https://www.si.edu/search/collection-images?edan_q={search}',
    category: 'museum',
    description: 'Smithsonian Institution collections',
    displayOrder: 3,
  },
  {
    id: 'gallica',
    name: 'BnF Gallica',
    url: 'https://gallica.bnf.fr',
    searchUrlTemplate: 'https://gallica.bnf.fr/services/engine/search/sru?operation=searchRetrieve&query={search}',
    category: 'academic',
    description: 'French National Library digital collections',
    displayOrder: 4,
  },
  {
    id: 'met',
    name: 'The Met Collection',
    url: 'https://www.metmuseum.org/art/collection',
    searchUrlTemplate: 'https://www.metmuseum.org/art/collection/search?q={search}',
    category: 'museum',
    description: 'Metropolitan Museum of Art collection',
    displayOrder: 5,
  },
  {
    id: 'nga',
    name: 'National Gallery of Art',
    url: 'https://www.nga.gov/collection.html',
    searchUrlTemplate: 'https://www.nga.gov/collection-search-result.html?artobj_keywords={search}',
    category: 'museum',
    description: 'US National Gallery of Art collection',
    displayOrder: 6,
  },
  {
    id: 'lacma',
    name: 'LACMA Collections',
    url: 'https://collections.lacma.org',
    searchUrlTemplate: 'https://collections.lacma.org/search/site/{search}',
    category: 'museum',
    description: 'Los Angeles County Museum of Art',
    displayOrder: 7,
  },
];

/**
 * Reference sites for contextual information
 */
export const REFERENCE_SITES: ArchiveSite[] = [
  {
    id: 'wikipedia',
    name: 'Wikipedia',
    url: 'https://en.wikipedia.org',
    searchUrlTemplate: 'https://en.wikipedia.org/w/index.php?search={search}',
    category: 'reference',
    description: 'General encyclopedia for artist bios, films, events',
    displayOrder: 10,
  },
  {
    id: 'imdb',
    name: 'IMDb',
    url: 'https://www.imdb.com',
    searchUrlTemplate: 'https://www.imdb.com/find?q={search}',
    category: 'reference',
    description: 'Movie database for film poster identification',
    displayOrder: 11,
  },
  {
    id: 'discogs',
    name: 'Discogs',
    url: 'https://www.discogs.com',
    searchUrlTemplate: 'https://www.discogs.com/search/?q={search}&type=all',
    category: 'reference',
    description: 'Music database for concert poster identification',
    displayOrder: 12,
  },
  {
    id: 'allmovie',
    name: 'AllMovie',
    url: 'https://www.allmovie.com',
    searchUrlTemplate: 'https://www.allmovie.com/search/all/{search}',
    category: 'reference',
    description: 'Movie database with production details',
    displayOrder: 13,
  },
  {
    id: 'artnet',
    name: 'Artnet',
    url: 'https://www.artnet.com',
    searchUrlTemplate: 'https://www.artnet.com/search/?q={search}',
    category: 'reference',
    description: 'Art market information and artist details',
    displayOrder: 14,
  },
];

/**
 * All archive sites combined, sorted by display order
 */
export const ALL_ARCHIVE_SITES: ArchiveSite[] = [
  ...ACADEMIC_ARCHIVES,
  ...REFERENCE_SITES,
].sort((a, b) => a.displayOrder - b.displayOrder);

/**
 * Get archive sites by category
 */
export function getArchiveSitesByCategory(category: ArchiveSiteCategory): ArchiveSite[] {
  return ALL_ARCHIVE_SITES.filter(site => site.category === category);
}

/**
 * Get an archive site by ID
 */
export function getArchiveSiteById(id: string): ArchiveSite | undefined {
  return ALL_ARCHIVE_SITES.find(site => site.id === id);
}

/**
 * Build a search URL for an archive site
 */
export function buildArchiveSearchUrl(site: ArchiveSite, searchTerm: string): string | null {
  if (!site.searchUrlTemplate) return null;
  return site.searchUrlTemplate.replace('{search}', encodeURIComponent(searchTerm));
}

/**
 * Category labels for UI
 */
export const ARCHIVE_CATEGORY_LABELS: Record<ArchiveSiteCategory, string> = {
  academic: 'Academic Archives',
  museum: 'Museum Collections',
  reference: 'Reference Sites',
};
