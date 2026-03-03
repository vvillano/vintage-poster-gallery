import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { shopifyFetchWithPagination, getImportedProductMap } from '@/lib/shopify';
import type { BrowseProduct, BrowsePagination, BrowseResponse } from '@/types/browse-product';

interface ShopifyProductsResponse {
  products: Array<{
    id: number;
    title: string;
    handle: string;
    status: 'active' | 'draft' | 'archived';
    product_type: string | null;
    variants: Array<{
      sku: string | null;
      price: string;
      inventory_quantity: number | null;
    }>;
    images: Array<{
      src: string;
    }>;
  }>;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 250);
    const pageInfo = searchParams.get('page_info');
    const query = searchParams.get('q');
    const status = searchParams.get('status');

    // Build Shopify endpoint
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    params.set('fields', 'id,title,handle,status,product_type,variants,images');

    if (pageInfo) {
      // When using page_info cursor, only limit is allowed as additional param
      const cursorParams = new URLSearchParams();
      cursorParams.set('limit', String(limit));
      cursorParams.set('page_info', pageInfo);
      const endpoint = `/products.json?${cursorParams.toString()}`;

      const { data, cursors } = await shopifyFetchWithPagination<ShopifyProductsResponse>(endpoint);
      const importedMap = await getImportedProductMap();
      const products = mapProducts(data.products, importedMap);
      const pagination = buildPagination(cursors, limit);

      return NextResponse.json({ products, pagination } satisfies BrowseResponse);
    }

    // First page: can use filters
    if (query) params.set('title', query);
    if (status && status !== 'all') params.set('status', status);

    const endpoint = `/products.json?${params.toString()}`;
    const { data, cursors } = await shopifyFetchWithPagination<ShopifyProductsResponse>(endpoint);
    const importedMap = await getImportedProductMap();
    const products = mapProducts(data.products, importedMap);
    const pagination = buildPagination(cursors, limit);

    return NextResponse.json({ products, pagination } satisfies BrowseResponse);
  } catch (error) {
    console.error('Browse products error:', error);
    return NextResponse.json(
      { error: 'Failed to browse products', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

function mapProducts(
  products: ShopifyProductsResponse['products'],
  importedMap: Map<string, number>
): BrowseProduct[] {
  return products.map((p) => {
    const gid = `gid://shopify/Product/${p.id}`;
    const firstVariant = p.variants[0];
    const localPosterId = importedMap.get(gid) ?? null;

    return {
      id: String(p.id),
      gid,
      title: p.title,
      handle: p.handle,
      status: p.status,
      productType: p.product_type,
      sku: firstVariant?.sku ?? null,
      price: firstVariant?.price ?? null,
      inventoryQuantity: firstVariant?.inventory_quantity ?? null,
      thumbnailUrl: p.images[0]?.src ?? null,
      isImported: localPosterId !== null,
      localPosterId,
    };
  });
}

function buildPagination(
  cursors: { next: string | null; previous: string | null },
  pageSize: number
): BrowsePagination {
  return {
    nextCursor: cursors.next,
    prevCursor: cursors.previous,
    hasNext: cursors.next !== null,
    hasPrev: cursors.previous !== null,
    pageSize,
  };
}
