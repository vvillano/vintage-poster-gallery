export interface IndexProduct {
  id: number;
  shopifyProductId: number;
  shopifyGid: string;
  handle: string | null;
  title: string;
  status: 'active' | 'draft' | 'archived';
  productType: string | null;
  tags: string | null;
  sku: string | null;
  price: number | null;
  compareAtPrice: number | null;
  inventoryQuantity: number | null;
  thumbnailUrl: string | null;
  year: string | null;
  artist: string | null;
  countryOfOrigin: string | null;
  sourcePlatform: string | null;
  purchasePrice: number | null;
  totalCogs: number | null;
  localPosterId: number | null;
  shopifyCreatedAt: string;
  shopifyUpdatedAt: string;
}

export type ColumnKey =
  | 'thumbnail'
  | 'title'
  | 'status'
  | 'sku'
  | 'productType'
  | 'year'
  | 'artist'
  | 'country'
  | 'platform'
  | 'purchasePrice'
  | 'totalCogs'
  | 'price'
  | 'compareAtPrice'
  | 'inventory'
  | 'createdAt'
  | 'updatedAt';

export interface ColumnConfig {
  key: ColumnKey;
  label: string;
  sortKey?: string;
  alwaysVisible?: boolean;
  defaultVisible?: boolean;
  align?: 'left' | 'right' | 'center';
}

export const COLUMNS: ColumnConfig[] = [
  { key: 'thumbnail', label: '', alwaysVisible: true },
  { key: 'title', label: 'Title', sortKey: 'title', alwaysVisible: true },
  { key: 'status', label: 'Status', sortKey: 'status', defaultVisible: true },
  { key: 'sku', label: 'SKU', sortKey: 'sku', defaultVisible: true },
  { key: 'productType', label: 'Product Type', sortKey: 'product_type', defaultVisible: true },
  { key: 'year', label: 'Year', sortKey: 'year' },
  { key: 'artist', label: 'Artist', sortKey: 'artist' },
  { key: 'country', label: 'Country', sortKey: 'country_of_origin' },
  { key: 'platform', label: 'Platform/Venue', sortKey: 'source_platform' },
  { key: 'purchasePrice', label: 'Purchase Price', sortKey: 'purchase_price', align: 'right' },
  { key: 'totalCogs', label: 'Total COGS', sortKey: 'total_cogs', align: 'right' },
  { key: 'price', label: 'Price', sortKey: 'price', defaultVisible: true, align: 'right' },
  { key: 'compareAtPrice', label: 'Compare At', sortKey: 'compare_at_price', align: 'right' },
  { key: 'inventory', label: 'Inventory', sortKey: 'inventory_quantity', defaultVisible: true, align: 'right' },
  { key: 'createdAt', label: 'Created', sortKey: 'shopify_created_at' },
  { key: 'updatedAt', label: 'Updated', sortKey: 'shopify_updated_at' },
];

export const DEFAULT_VISIBLE_COLUMNS: ColumnKey[] = COLUMNS
  .filter((c) => c.alwaysVisible || c.defaultVisible)
  .map((c) => c.key);

export interface FilterState {
  status: string;
  productType: string;
  artist: string;
  country: string;
  platform: string;
  tags: string;
}

export interface FilterOptions {
  productTypes: string[];
  artists: string[];
  countries: string[];
  platforms: string[];
  tags: string[];
}

export interface SortState {
  column: string;
  order: 'asc' | 'desc';
}

export interface IndexPagination {
  page: number;
  pageSize: number;
  totalResults: number;
  totalPages: number;
}

export interface IndexBrowseResponse {
  products: IndexProduct[];
  pagination: IndexPagination;
}

export interface SyncStatus {
  lastSyncedAt: string | null;
  totalProducts: number;
  isEmpty: boolean;
}
