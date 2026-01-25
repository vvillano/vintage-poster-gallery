import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAllPosters, getPosterStats, searchPosters } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const onlyAnalyzed = searchParams.get('analyzed') === 'true';
    const stats = searchParams.get('stats') === 'true';

    // Return statistics if requested
    if (stats) {
      const statistics = await getPosterStats();
      return NextResponse.json(statistics);
    }

    // Search if query provided
    if (query) {
      const results = await searchPosters(query);
      return NextResponse.json({
        posters: results,
        count: results.length,
      });
    }

    // Get all posters with pagination
    const posters = await getAllPosters({ limit, offset, onlyAnalyzed });

    return NextResponse.json({
      posters,
      count: posters.length,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Get posters error:', error);
    return NextResponse.json(
      {
        error: 'Failed to retrieve posters',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
