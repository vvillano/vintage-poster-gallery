import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { updatePosterColors, getPosterById } from '@/lib/db';

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

    const { colors } = await request.json();

    if (!Array.isArray(colors)) {
      return NextResponse.json({ error: 'Colors must be an array' }, { status: 400 });
    }

    // Validate all colors are strings
    if (!colors.every(color => typeof color === 'string')) {
      return NextResponse.json({ error: 'All colors must be strings' }, { status: 400 });
    }

    const updatedPoster = await updatePosterColors(posterId, colors);
    return NextResponse.json({ success: true, poster: updatedPoster });
  } catch (error) {
    console.error('Update poster colors error:', error);
    return NextResponse.json(
      { error: 'Failed to update colors' },
      { status: 500 }
    );
  }
}

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
    const posterId = parseInt(id);

    if (isNaN(posterId)) {
      return NextResponse.json({ error: 'Invalid poster ID' }, { status: 400 });
    }

    const poster = await getPosterById(posterId);
    if (!poster) {
      return NextResponse.json({ error: 'Poster not found' }, { status: 404 });
    }

    return NextResponse.json({ colors: poster.colors || [] });
  } catch (error) {
    console.error('Get poster colors error:', error);
    return NextResponse.json(
      { error: 'Failed to get colors' },
      { status: 500 }
    );
  }
}
