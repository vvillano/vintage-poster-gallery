export interface BrowseProduct {
  id: string;           // Shopify numeric ID (e.g., "1234567890")
  gid: string;          // Shopify GID (e.g., "gid://shopify/Product/1234567890")
  title: string;
  handle: string;
  status: 'active' | 'draft' | 'archived';
  productType: string | null;
  sku: string | null;
  price: string | null;
  inventoryQuantity: number | null;
  thumbnailUrl: string | null;
  isImported: boolean;
  localPosterId: number | null;
}

export interface BrowsePagination {
  nextCursor: string | null;
  prevCursor: string | null;
  hasNext: boolean;
  hasPrev: boolean;
  pageSize: number;
}

export interface BrowseResponse {
  products: BrowseProduct[];
  pagination: BrowsePagination;
}
