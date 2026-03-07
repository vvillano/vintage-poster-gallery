import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';

/**
 * GET /api/colors/distribution
 * Returns color frequency across all products from two sources:
 * 1. Posters table: colors stored locally from AI analysis
 * 2. Shopify metafields: colors actually pushed to Shopify (jadepuma.color)
 *
 * Also returns AI-suggested colors (from raw_ai_response) to show what
 * the AI detects vs what users actually apply.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Colors applied to posters (local DB)
    const posterColors = await sql`
      SELECT unnest(colors) AS color, COUNT(*) AS count
      FROM posters
      WHERE colors IS NOT NULL AND array_length(colors, 1) > 0
      GROUP BY color
      ORDER BY count DESC
    `;

    // 2. Colors in Shopify metafields (from product cache)
    // The jadepuma.color metafield is stored as JSON array string like '["Red","Gold"]'
    // We need to check how products store this

    // 3. AI-suggested colors from raw_ai_response
    const aiSuggestions = await sql`
      SELECT raw_ai_response FROM posters
      WHERE raw_ai_response IS NOT NULL
        AND raw_ai_response::text LIKE '%suggestedColors%'
    `;

    const aiColorCounts: Record<string, number> = {};
    for (const row of aiSuggestions.rows) {
      try {
        const raw = typeof row.raw_ai_response === 'string'
          ? JSON.parse(row.raw_ai_response)
          : row.raw_ai_response;
        const suggested = raw?.suggestedColors || [];
        for (const c of suggested) {
          aiColorCounts[c] = (aiColorCounts[c] || 0) + 1;
        }
      } catch { /* skip malformed */ }
    }

    // 4. Count totals
    const totalPosters = await sql`SELECT COUNT(*) AS count FROM posters`;
    const postersWithColors = await sql`
      SELECT COUNT(*) AS count FROM posters
      WHERE colors IS NOT NULL AND array_length(colors, 1) > 0
    `;
    const postersWithAiColors = aiSuggestions.rows.length;

    // 5. Get managed color list for reference
    const managedColors = await sql`
      SELECT name, hex_code FROM colors ORDER BY display_order, name
    `;

    // 6. Colors applied but NOT in managed list (orphaned)
    const managedSet = new Set(managedColors.rows.map(r => r.name.toLowerCase()));
    const appliedColors: Record<string, number> = {};
    for (const row of posterColors.rows) {
      appliedColors[row.color] = parseInt(row.count, 10);
    }
    const orphanedColors = Object.entries(appliedColors)
      .filter(([name]) => !managedSet.has(name.toLowerCase()))
      .map(([name, count]) => ({ name, count }));

    // 7. Managed colors never used
    const appliedSet = new Set(Object.keys(appliedColors).map(c => c.toLowerCase()));
    const aiSet = new Set(Object.keys(aiColorCounts).map(c => c.toLowerCase()));
    const neverUsed = managedColors.rows
      .filter(r => !appliedSet.has(r.name.toLowerCase()) && !aiSet.has(r.name.toLowerCase()))
      .map(r => r.name);

    // 8. Build AI vs Applied comparison (where AI suggested but user changed)
    const aiVsApplied: Array<{ color: string; aiSuggested: number; applied: number; delta: number }> = [];
    const allColorNames = new Set([
      ...Object.keys(aiColorCounts),
      ...Object.keys(appliedColors),
    ]);
    for (const name of allColorNames) {
      const ai = aiColorCounts[name] || 0;
      const applied = appliedColors[name] || 0;
      if (ai !== applied) {
        aiVsApplied.push({ color: name, aiSuggested: ai, applied, delta: applied - ai });
      }
    }
    aiVsApplied.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

    return NextResponse.json({
      summary: {
        totalPosters: parseInt(totalPosters.rows[0].count, 10),
        postersWithColors: parseInt(postersWithColors.rows[0].count, 10),
        postersWithAiSuggestions: postersWithAiColors,
        managedColorCount: managedColors.rows.length,
      },
      // Colors applied to posters, sorted by frequency
      appliedFrequency: posterColors.rows.map(r => ({
        color: r.color,
        count: parseInt(r.count, 10),
      })),
      // AI-suggested colors, sorted by frequency
      aiSuggestedFrequency: Object.entries(aiColorCounts)
        .sort(([, a], [, b]) => b - a)
        .map(([color, count]) => ({ color, count })),
      // Divergences between AI suggestion and user application
      aiVsApplied,
      // Managed colors that have never been used or suggested
      neverUsed,
      // Colors applied but not in managed list
      orphanedColors,
      // Full managed list for reference
      managedColors: managedColors.rows.map(r => ({
        name: r.name,
        hexCode: r.hex_code,
      })),
    });
  } catch (error) {
    console.error('Color distribution error:', error);
    return NextResponse.json(
      { error: 'Failed to get color distribution', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
