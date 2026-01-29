import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getShopifyProducts, getProductMetafields } from '@/lib/shopify';

/**
 * GET /api/shopify/metafields/discover
 * Discover all metafield namespaces and keys across products
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get a sample of products
    const products = await getShopifyProducts({ limit: 10 });

    if (products.length === 0) {
      return NextResponse.json({
        error: 'No products found',
        metafields: [],
      });
    }

    // Collect all unique metafields across products
    const metafieldMap = new Map<string, {
      namespace: string;
      key: string;
      type: string;
      sampleValue: string;
      productCount: number;
    }>();

    for (const product of products) {
      try {
        const metafields = await getProductMetafields(product.id);

        for (const mf of metafields) {
          const fullKey = `${mf.namespace}.${mf.key}`;
          const existing = metafieldMap.get(fullKey);

          if (existing) {
            existing.productCount++;
            // Keep a non-empty sample value if we have one
            if (!existing.sampleValue && mf.value) {
              existing.sampleValue = mf.value.substring(0, 100);
            }
          } else {
            metafieldMap.set(fullKey, {
              namespace: mf.namespace,
              key: mf.key,
              type: mf.type,
              sampleValue: mf.value ? mf.value.substring(0, 100) : '',
              productCount: 1,
            });
          }
        }
      } catch (err) {
        // Skip products that fail
        console.error(`Failed to get metafields for ${product.id}:`, err);
      }
    }

    // Convert to array and sort by namespace, then key
    const discovered = Array.from(metafieldMap.values())
      .sort((a, b) => {
        if (a.namespace !== b.namespace) {
          return a.namespace.localeCompare(b.namespace);
        }
        return a.key.localeCompare(b.key);
      });

    return NextResponse.json({
      sampledProducts: products.length,
      metafields: discovered,
      count: discovered.length,
    });
  } catch (error) {
    console.error('Discover metafields error:', error);
    return NextResponse.json(
      {
        error: 'Failed to discover metafields',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
