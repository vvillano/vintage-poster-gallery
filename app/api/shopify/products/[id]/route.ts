import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import {
  getProductDetailGraphQL,
  updateShopifyProductGraphQL,
  updateVariantPriceGraphQL,
  updateInventoryItemGraphQL,
  setInventoryQuantityGraphQL,
  deleteShopifyProductGraphQL,
} from '@/lib/shopify';
import type { ProductUpdatePayload } from '@/types/shopify-product-detail';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const product = await getProductDetailGraphQL(id);
    return NextResponse.json(product);
  } catch (error) {
    console.error('Get product detail error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch product', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = (await request.json()) as ProductUpdatePayload;

    // Fetch current product to get variant/inventory IDs
    const current = await getProductDetailGraphQL(id);

    // Update core product fields if any changed
    const hasProductChanges = body.title !== undefined || body.bodyHtml !== undefined ||
      body.productType !== undefined || body.status !== undefined || body.tags !== undefined;
    if (hasProductChanges) {
      await updateShopifyProductGraphQL(current.gid, body);
    }

    // Update variant price if changed
    if (body.price !== undefined || body.compareAtPrice !== undefined) {
      await updateVariantPriceGraphQL(
        current.gid,
        current.variantGid,
        body.price ?? current.price,
        body.compareAtPrice !== undefined ? body.compareAtPrice : current.compareAtPrice
      );
    }

    // Update SKU if changed
    if (body.sku !== undefined && current.inventoryItemGid) {
      await updateInventoryItemGraphQL(current.inventoryItemGid, body.sku);
    }

    // Update inventory quantity if changed
    if (body.inventoryQuantity !== undefined && current.inventoryItemGid && current.locationGid) {
      await setInventoryQuantityGraphQL(
        current.inventoryItemGid,
        current.locationGid,
        body.inventoryQuantity
      );
    }

    // Re-fetch updated product
    const updated = await getProductDetailGraphQL(id);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Update product error:', error);
    return NextResponse.json(
      { error: 'Failed to update product', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const gid = id.startsWith('gid://') ? id : `gid://shopify/Product/${id}`;

    const deletedId = await deleteShopifyProductGraphQL(gid);

    // Unlink any local poster referencing this product
    await sql`
      UPDATE posters SET shopify_product_id = NULL
      WHERE shopify_product_id = ${gid}
    `;

    return NextResponse.json({ success: true, deletedProductId: deletedId });
  } catch (error) {
    console.error('Delete product error:', error);
    return NextResponse.json(
      { error: 'Failed to delete product', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
