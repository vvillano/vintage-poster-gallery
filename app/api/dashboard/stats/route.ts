import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import { getShopifyConfig } from '@/lib/shopify';
import { getPosterStats } from '@/lib/db';

async function getShopifyProductCount(
  shopDomain: string,
  accessToken: string,
  apiVersion: string,
  status: string
): Promise<number> {
  const res = await fetch(
    `https://${shopDomain}/admin/api/${apiVersion}/products/count.json?status=${status}`,
    { headers: { 'X-Shopify-Access-Token': accessToken } }
  );
  if (!res.ok) return 0;
  const data = await res.json();
  return data.count ?? 0;
}

async function getRecentShopifyProducts(
  shopDomain: string,
  accessToken: string,
  apiVersion: string
): Promise<{ id: string; title: string; status: string; updatedAt: string; imageUrl: string | null }[]> {
  const res = await fetch(
    `https://${shopDomain}/admin/api/${apiVersion}/products.json?limit=5&order=updated_at+desc&fields=id,title,status,updated_at,image`,
    { headers: { 'X-Shopify-Access-Token': accessToken } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data.products || []).map((p: { id: number; title: string; status: string; updated_at: string; image: { src: string } | null }) => ({
    id: String(p.id),
    title: p.title,
    status: p.status,
    updatedAt: p.updated_at,
    imageUrl: p.image?.src || null,
  }));
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const config = await getShopifyConfig();

    // Fetch everything in parallel
    const [researchStats, recentResearchResult, ...shopifyResults] = await Promise.all([
      getPosterStats(),
      sql`
        SELECT id, title, artist, created_at, image_url
        FROM posters
        ORDER BY created_at DESC
        LIMIT 5
      `,
      // Shopify calls (only if configured)
      ...(config
        ? [
            getShopifyProductCount(config.shopDomain, config.accessToken, config.apiVersion, 'active'),
            getShopifyProductCount(config.shopDomain, config.accessToken, config.apiVersion, 'draft'),
            getShopifyProductCount(config.shopDomain, config.accessToken, config.apiVersion, 'archived'),
            getRecentShopifyProducts(config.shopDomain, config.accessToken, config.apiVersion),
          ]
        : [Promise.resolve(0), Promise.resolve(0), Promise.resolve(0), Promise.resolve([])]),
    ]);

    const [activeCount, draftCount, archivedCount, recentProducts] = shopifyResults as [number, number, number, { id: string; title: string; status: string; updatedAt: string; imageUrl: string | null }[]];

    const recentResearch = recentResearchResult.rows.map((r) => ({
      id: r.id,
      title: r.title || 'Untitled',
      artist: r.artist || null,
      createdAt: r.created_at,
      imageUrl: r.image_url || null,
    }));

    return NextResponse.json({
      shopify: {
        active: activeCount,
        draft: draftCount,
        archived: archivedCount,
        total: activeCount + draftCount + archivedCount,
      },
      research: researchStats,
      recentProducts,
      recentResearch,
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json({ error: 'Failed to load dashboard stats' }, { status: 500 });
  }
}
