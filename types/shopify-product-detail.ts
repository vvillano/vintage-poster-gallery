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
  bookSource?: string;
  artistBio?: string;
  referenceImages?: string;
  restorationCandidate?: string;
  primaryCollection?: string;
  internalTags?: string;
  // custom namespace
  talkingPoints?: string;
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
  // Linked poster data from research database
  linkedPoster: LinkedPosterData | null;
}

/** Linked poster data from the research database */
export interface LinkedPosterData {
  posterId: number;
  talkingPoints: string[];
  designProfile: {
    periodMovement: string | null;
    publication: string | null;
    advertiser: string | null;
    eraContext: string | null;
    composition: string | null;
    colorPalette: string | null;
    typography: string | null;
  };
  timeAndPlace: {
    world: string | null;
    regional: string | null;
    local: string | null;
  };
  rarityValue: {
    rarityAssessment: string | null;
    valueInsights: string | null;
    collectorInterest: string | null;
  };
  comparableSales: {
    id: string;
    date: string;
    price: number;
    currency: string;
    source: string;
    condition?: string;
    notes?: string;
    url?: string;
    createdAt: string;
  }[];
  artistConfidence: string | null;
  artistConfidenceScore: number | null;
  attributionBasis: string | null;
  sourceCitations: {
    claim: string;
    source: string;
    url: string;
    reliability: string;
  }[];
  suggestedTags?: string[];
  suggestedColors?: string[];
}

/** A single metafield write operation */
export interface MetafieldWrite {
  namespace: string;
  key: string;
  value: string;
  type: 'single_line_text_field' | 'multi_line_text_field' | 'json' | 'list.single_line_text_field' | 'boolean';
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
  metafields?: MetafieldWrite[];
  categoryId?: string;
}

/** Payload for creating a product */
export interface ProductCreatePayload {
  title: string;
  bodyHtml?: string;
  productType?: string;
  status?: string;
  tags?: string[];
}
