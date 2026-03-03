/** All metafield values for a product, keyed by namespace.key */
export interface ProductMetafields {
  // jadepuma namespace
  artist?: string;
  date?: string;
  condition?: string;
  conditionDetails?: string;
  color?: string;
  medium?: string;
  countryOfOrigin?: string;
  location?: string;
  internalNotes?: string;
  itemNotes?: string;
  purchasePrice?: string;
  shipping?: string;
  restoration?: string;
  dealer?: string;
  sourcePlatform?: string;
  platformIdentity?: string;
  privateSellerName?: string;
  conciseDescription?: string;
  printer?: string;
  publisher?: string;
  bookTitleSource?: string;
  artistBio?: string;
  referenceImages?: string;
  restorationCandidate?: string;
  primaryCollection?: string;
  // specs namespace
  year?: string;
  height?: string;
  width?: string;
}

export interface ProductDetailImage {
  id: string;
  url: string;
  altText: string | null;
  width: number;
  height: number;
}

/** Full product detail for the detail/edit page */
export interface ProductDetail {
  id: string;
  gid: string;
  title: string;
  handle: string;
  status: 'active' | 'draft' | 'archived';
  productType: string | null;
  tags: string[];
  bodyHtml: string | null;
  createdAt: string;
  updatedAt: string;
  seoTitle: string | null;
  seoDescription: string | null;
  images: ProductDetailImage[];
  // First variant fields
  variantGid: string;
  sku: string | null;
  price: string;
  compareAtPrice: string | null;
  inventoryQuantity: number | null;
  unitCost: string | null;
  inventoryItemGid: string;
  locationGid: string | null;
  // Metafields
  metafields: ProductMetafields;
}

/** Payload for updating a product */
export interface ProductUpdatePayload {
  title?: string;
  bodyHtml?: string;
  productType?: string;
  status?: string;
  tags?: string[];
  price?: string;
  compareAtPrice?: string | null;
  sku?: string;
  inventoryQuantity?: number;
}

/** Payload for creating a product */
export interface ProductCreatePayload {
  title: string;
  bodyHtml?: string;
  productType?: string;
  status?: string;
  tags?: string[];
}
