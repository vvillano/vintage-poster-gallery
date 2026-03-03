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
  try {
    const res = await fetch(
      `https://${shopDomain}/admin/api/${apiVersion}/products/count.json?status=${status}`,
      { headers: { 'X-Shopify-Access-Token': accessToken } }
    );
    if (!res.ok) return 0;
    const data = await res.json();
    return data.count ?? 0;
  } catch {
    return 0;
  }
}

async function getRecentShopifyProducts(
  shopDomain: string,
  accessToken: string,
  apiVersion: string
): Promise<{ id: string; title: string; status: string; updatedAt: string; imageUrl: string | null }[]> {
  try {
    const res = await fetch(
      `https://${shopDomain}/admin/api/${apiVersion}/products.json?limit=5&order=updated_at%20desc&fields=id,title,status,updated_at,image`,
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
  } catch {
    return [];
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch research stats (always available)
    let researchStats = { total: 0, analyzed: 0, pending: 0 };
    try {
      researchStats = await getPosterStats();
    } catch (err) {
      console.error('Failed to get poster stats:', err);
    }

    // Fetch recent research items
    let recentResearch: { id: number; title: string; artist: string | null; createdAt: string; imageUrl: string | null }[] = [];
    try {
      const result = await sql`
        SELECT id, title, artist, created_at, image_url
        FROM posters
        ORDER BY created_at DESC
        LIMIT 5
      `;
      recentResearch = result.rows.map((r) => ({
        id: r.id,
        title: r.title || 'Untitled',
        artist: r.artist || null,
        createdAt: r.created_at,
        imageUrl: r.image_url || null,
      }));
    } catch (err) {
      console.error('Failed to get recent research:', err);
    }

    // Fetch Shopify stats (only if configured)
    let shopifyStats = { active: 0, draft: 0, archived: 0, total: 0 };
    let recentProducts: { id: string; title: string; status: string; updatedAt: string; imageUrl: string | null }[] = [];

    try {
      const config = await getShopifyConfig();
      if (config) {
        const [active, draft, archived, recent] = await Promise.all([
          getShopifyProductCount(config.shopDomain, config.accessToken, config.apiVersion, 'active'),
          getShopifyProductCount(config.shopDomain, config.accessToken, config.apiVersion, 'draft'),
          getShopifyProductCount(config.shopDomain, config.accessToken, config.apiVersion, 'archived'),
          getRecentShopifyProducts(config.shopDomain, config.accessToken, config.apiVersion),
        ]);
        shopifyStats = { active, draft, archived, total: active + draft + archived };
        recentProducts = recent;
      }
    } catch (err) {
      console.error('Failed to get Shopify stats:', err);
    }

    return NextResponse.json({
      shopify: shopifyStats,
      research: researchStats,
      recentProducts,
      recentResearch,
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json(
      { error: 'Failed to load dashboard stats', details: String(error) },
      { status: 500 }
    );
  }
}
