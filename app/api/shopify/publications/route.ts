import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAllPublications } from '@/lib/shopify';

/**
 * GET /api/shopify/publications
 *
 * Returns all available sales channels (publications) for the shop.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const publications = await getAllPublications();
    return NextResponse.json({ publications });
  } catch (error) {
    console.error('Fetch publications error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch publications', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
