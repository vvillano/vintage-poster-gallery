/**
 * PM App API Client
 *
 * Handles communication with the PM App (Product Management App) external API
 * for syncing managed lists between Research App and PM App.
 *
 * PM App Base URL: https://avp-product-management-6ded0b52f729.herokuapp.com/
 * API is READ-ONLY - to push data, we create Shopify metaobjects that PM App reads.
 */

const PM_APP_SHOP = 'authentic-vintage-posters.myshopify.com';

// Read env vars at runtime, not module load time (important for serverless)
function getPMAppBaseUrl(): string {
  return process.env.PM_APP_BASE_URL || 'https://avp-product-management-6ded0b52f729.herokuapp.com';
}

function getPMAppApiKey(): string | undefined {
  return process.env.PM_APP_API_KEY;
}

/**
 * PM App Managed Lists Response
 */
export interface PMAppManagedLists {
  ok: boolean;
  shop: string;
  managedLists: {
    productTypes: string[];
    dateTags: string[];
    sizeTags: string[];
    conditions: string[];
    artists: string[];
    medium: string[];
    colors: string[];
    sources: string[];
    otherTags: string[];
    locations: string[];
    countries: string[];
    internalTags: string[];
    customManagedLists: PMAppCustomList[];
  };
}

export interface PMAppCustomList {
  _id: string;
  title: string;
  type: 'tag' | 'metafield';
  values: string[];
}

/**
 * PM App Schema Response
 */
export interface PMAppSchema {
  ok: boolean;
  version: string;
  description: string;
  fields: Record<
    string,
    {
      type: string;
      items?: string | object;
      description: string;
    }
  >;
}

/**
 * PM App Error Response
 */
export interface PMAppError {
  ok: false;
  error: string;
  reason: string;
}

/**
 * Check if PM App API is configured
 */
export function isPMAppConfigured(): boolean {
  return !!getPMAppApiKey();
}

/**
 * Get PM App configuration (for display, not secrets)
 */
export function getPMAppConfig(): { baseUrl: string; shop: string; configured: boolean } {
  return {
    baseUrl: getPMAppBaseUrl(),
    shop: PM_APP_SHOP,
    configured: isPMAppConfigured(),
  };
}

/**
 * Fetch all managed lists from PM App
 */
export async function fetchPMAppManagedLists(): Promise<PMAppManagedLists> {
  const apiKey = getPMAppApiKey();
  if (!apiKey) {
    throw new Error('PM_APP_API_KEY is not configured');
  }

  const url = `${getPMAppBaseUrl()}/managed-lists?shop=${encodeURIComponent(PM_APP_SHOP)}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    // Cache for 5 minutes as recommended in API docs
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as PMAppError;
    throw new Error(
      `PM App API error: ${response.status} - ${errorData.error || 'Unknown error'} (${errorData.reason || 'no reason'})`
    );
  }

  const data = await response.json();

  if (!data.ok) {
    throw new Error(`PM App returned error: ${data.error} - ${data.reason}`);
  }

  return data as PMAppManagedLists;
}

/**
 * Fetch PM App schema (field definitions)
 */
export async function fetchPMAppSchema(): Promise<PMAppSchema> {
  const apiKey = getPMAppApiKey();
  if (!apiKey) {
    throw new Error('PM_APP_API_KEY is not configured');
  }

  const url = `${getPMAppBaseUrl()}/managed-lists/schema`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    next: { revalidate: 3600 }, // Cache schema for 1 hour
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as PMAppError;
    throw new Error(
      `PM App API error: ${response.status} - ${errorData.error || 'Unknown error'}`
    );
  }

  return response.json();
}

/**
 * Mapping between PM App fields and Research App tables
 */
export const PM_APP_FIELD_MAPPINGS: Record<
  string,
  {
    researchAppTable: string;
    description: string;
    nameField: string;
    canPush: boolean; // Whether we can push to Shopify for PM App to read
  }
> = {
  sources: {
    researchAppTable: 'platforms',
    description: 'Acquisition sources (WHERE you buy)',
    nameField: 'name',
    canPush: true,
  },
  artists: {
    researchAppTable: 'artists',
    description: 'Artist names with aliases',
    nameField: 'name',
    canPush: true,
  },
  medium: {
    researchAppTable: 'media_types',
    description: 'Printing techniques',
    nameField: 'name',
    canPush: true,
  },
  colors: {
    researchAppTable: 'colors',
    description: 'Color values',
    nameField: 'name',
    canPush: true,
  },
  internalTags: {
    researchAppTable: 'internal_tags',
    description: 'Internal organization tags',
    nameField: 'name',
    canPush: false, // Internal only
  },
  locations: {
    researchAppTable: 'locations',
    description: 'Physical storage locations',
    nameField: 'name',
    canPush: false, // Internal only
  },
  countries: {
    researchAppTable: 'countries',
    description: 'Country of origin',
    nameField: 'name',
    canPush: true,
  },
  otherTags: {
    researchAppTable: 'tags',
    description: 'General purpose tags',
    nameField: 'name',
    canPush: true,
  },
};

/**
 * Normalize a name for comparison (case-insensitive, trimmed, normalized unicode)
 */
export function normalizeForComparison(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Remove diacritics
}

/**
 * Find matching item by name or alias
 */
export function findMatchByNameOrAlias<T extends { name: string; aliases?: string[] }>(
  searchName: string,
  items: T[]
): T | null {
  const normalized = normalizeForComparison(searchName);

  return (
    items.find(
      (item) =>
        normalizeForComparison(item.name) === normalized ||
        item.aliases?.some((alias) => normalizeForComparison(alias) === normalized)
    ) || null
  );
}

/**
 * Compare PM App list with local list and identify differences
 */
export interface SyncComparison {
  pmAppItems: string[];
  localItems: string[];
  onlyInPMApp: string[]; // Items to pull
  onlyInLocal: string[]; // Items to push
  inBoth: string[]; // Already synced
}

export function compareLists(pmAppItems: string[], localItems: string[]): SyncComparison {
  const normalizedPMApp = new Map(pmAppItems.map((item) => [normalizeForComparison(item), item]));
  const normalizedLocal = new Map(localItems.map((item) => [normalizeForComparison(item), item]));

  const onlyInPMApp: string[] = [];
  const onlyInLocal: string[] = [];
  const inBoth: string[] = [];

  // Find items only in PM App
  for (const [normalized, original] of normalizedPMApp) {
    if (normalizedLocal.has(normalized)) {
      inBoth.push(original);
    } else {
      onlyInPMApp.push(original);
    }
  }

  // Find items only in local
  for (const [normalized, original] of normalizedLocal) {
    if (!normalizedPMApp.has(normalized)) {
      onlyInLocal.push(original);
    }
  }

  return {
    pmAppItems,
    localItems,
    onlyInPMApp,
    onlyInLocal,
    inBoth,
  };
}
