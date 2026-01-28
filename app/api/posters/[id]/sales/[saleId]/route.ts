import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getPosterById, deleteComparableSale, updateComparableSale } from '@/lib/db';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; saleId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, saleId } = await params;
    const posterId = parseInt(id);
    if (isNaN(posterId)) {
      return NextResponse.json({ error: 'Invalid poster ID' }, { status: 400 });
    }

    const poster = await getPosterById(posterId);
    if (!poster) {
      return NextResponse.json({ error: 'Poster not found' }, { status: 404 });
    }

    const body = await request.json();
    const updates = {
      date: body.date,
      price: body.price ? parseFloat(body.price) : undefined,
      currency: body.currency,
      source: body.source,
      condition: body.condition,
      notes: body.notes,
      url: body.url,
    };

    // Remove undefined values
    Object.keys(updates).forEach(key => {
      if (updates[key as keyof typeof updates] === undefined) {
        delete updates[key as keyof typeof updates];
      }
    });

    const updatedPoster = await updateComparableSale(posterId, saleId, updates);

    return NextResponse.json({
      success: true,
      sales: updatedPoster.comparableSales,
    });
  } catch (error) {
    console.error('Update sale error:', error);
    return NextResponse.json(
      { error: 'Failed to update comparable sale' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; saleId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, saleId } = await params;
    const posterId = parseInt(id);
    if (isNaN(posterId)) {
      return NextResponse.json({ error: 'Invalid poster ID' }, { status: 400 });
    }

    const poster = await getPosterById(posterId);
    if (!poster) {
      return NextResponse.json({ error: 'Poster not found' }, { status: 404 });
    }

    const updatedPoster = await deleteComparableSale(posterId, saleId);

    return NextResponse.json({
      success: true,
      sales: updatedPoster.comparableSales,
    });
  } catch (error) {
    console.error('Delete sale error:', error);
    return NextResponse.json(
      { error: 'Failed to delete comparable sale' },
      { status: 500 }
    );
  }
}
