import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { updatePosterTags, getPosterById } from '@/lib/db';

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

    const { tags } = await request.json();

    if (!Array.isArray(tags)) {
      return NextResponse.json({ error: 'Tags must be an array' }, { status: 400 });
    }

    // Validate all tags are strings
    if (!tags.every(tag => typeof tag === 'string')) {
      return NextResponse.json({ error: 'All tags must be strings' }, { status: 400 });
    }

    const updatedPoster = await updatePosterTags(posterId, tags);
    return NextResponse.json({ success: true, poster: updatedPoster });
  } catch (error) {
    console.error('Update poster tags error:', error);
    return NextResponse.json(
      { error: 'Failed to update tags' },
      { status: 500 }
    );
  }
}
