import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  getPosterById,
  updatePosterFields,
  deletePoster,
} from '@/lib/db';
import { deleteImage } from '@/lib/blob';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication
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

    return NextResponse.json(poster);
  } catch (error) {
    console.error('Get poster error:', error);
    return NextResponse.json(
      {
        error: 'Failed to retrieve poster',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const posterId = parseInt(id);
    if (isNaN(posterId)) {
      return NextResponse.json({ error: 'Invalid poster ID' }, { status: 400 });
    }

    const updates = await request.json();

    const updatedPoster = await updatePosterFields(posterId, updates);

    return NextResponse.json({
      success: true,
      poster: updatedPoster,
    });
  } catch (error) {
    console.error('Update poster error:', error);
    return NextResponse.json(
      {
        error: 'Failed to update poster',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const posterId = parseInt(id);
    if (isNaN(posterId)) {
      return NextResponse.json({ error: 'Invalid poster ID' }, { status: 400 });
    }

    // Get poster to retrieve blob URL
    const poster = await getPosterById(posterId);
    if (!poster) {
      return NextResponse.json({ error: 'Poster not found' }, { status: 404 });
    }

    // Delete from blob storage
    try {
      await deleteImage(poster.imageUrl);
    } catch (err) {
      console.error('Failed to delete image from blob storage:', err);
      // Continue with database deletion even if blob deletion fails
    }

    // Delete from database
    await deletePoster(posterId);

    return NextResponse.json({
      success: true,
      message: 'Poster deleted successfully',
    });
  } catch (error) {
    console.error('Delete poster error:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete poster',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
