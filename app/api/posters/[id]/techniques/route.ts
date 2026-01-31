import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { updatePosterPrintingTechniques, getPosterById } from '@/lib/db';

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
    const posterId = parseInt(id);

    if (isNaN(posterId)) {
      return NextResponse.json({ error: 'Invalid poster ID' }, { status: 400 });
    }

    // Verify poster exists
    const poster = await getPosterById(posterId);
    if (!poster) {
      return NextResponse.json({ error: 'Poster not found' }, { status: 404 });
    }

    const { techniqueIds } = await request.json();

    if (!Array.isArray(techniqueIds)) {
      return NextResponse.json({ error: 'techniqueIds must be an array' }, { status: 400 });
    }

    // Validate all IDs are numbers
    if (!techniqueIds.every(id => typeof id === 'number')) {
      return NextResponse.json({ error: 'All technique IDs must be numbers' }, { status: 400 });
    }

    const updatedPoster = await updatePosterPrintingTechniques(posterId, techniqueIds);
    return NextResponse.json({ success: true, poster: updatedPoster });
  } catch (error) {
    console.error('Update poster techniques error:', error);
    return NextResponse.json(
      { error: 'Failed to update printing techniques' },
      { status: 500 }
    );
  }
}
