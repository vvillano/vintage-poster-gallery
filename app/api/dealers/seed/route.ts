import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { seedDealers, getDealerCount } from '@/lib/dealers';
import { DEFAULT_DEALERS } from '@/lib/default-dealers';

/**
 * POST /api/dealers/seed
 * Seed the database with default dealers
 *
 * Body (optional):
 * - force: boolean - If true, seed even if dealers already exist (won't duplicate, but will add missing ones)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check current dealer count
    const currentCount = await getDealerCount();

    // Parse body for options
    let force = false;
    try {
      const body = await request.json();
      force = body.force === true;
    } catch {
      // No body or invalid JSON, use defaults
    }

    // If we have dealers and force isn't set, warn but don't block
    if (currentCount > 0 && !force) {
      return NextResponse.json({
        warning: `Database already has ${currentCount} dealers. Use force: true to add missing defaults.`,
        currentCount,
        defaultCount: DEFAULT_DEALERS.length,
      }, { status: 200 });
    }

    // Seed the dealers
    const result = await seedDealers(DEFAULT_DEALERS);

    return NextResponse.json({
      success: true,
      created: result.created,
      skipped: result.skipped,
      total: DEFAULT_DEALERS.length,
      message: `Seeded ${result.created} dealers (${result.skipped} already existed)`,
    }, { status: 201 });
  } catch (error) {
    console.error('Dealers seed error:', error);
    return NextResponse.json(
      { error: 'Failed to seed dealers', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/dealers/seed
 * Get information about the default dealers without seeding
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentCount = await getDealerCount();

    // Count by tier
    const tierCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    for (const dealer of DEFAULT_DEALERS) {
      const tier = dealer.reliabilityTier ?? 3;
      tierCounts[tier] = (tierCounts[tier] || 0) + 1;
    }

    // Count by type
    const typeCounts: Record<string, number> = {};
    for (const dealer of DEFAULT_DEALERS) {
      typeCounts[dealer.type] = (typeCounts[dealer.type] || 0) + 1;
    }

    return NextResponse.json({
      currentDealerCount: currentCount,
      defaultDealerCount: DEFAULT_DEALERS.length,
      dealersByTier: tierCounts,
      dealersByType: typeCounts,
      needsSeeding: currentCount === 0,
    });
  } catch (error) {
    console.error('Dealers seed GET error:', error);
    return NextResponse.json(
      { error: 'Failed to get seed info', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
