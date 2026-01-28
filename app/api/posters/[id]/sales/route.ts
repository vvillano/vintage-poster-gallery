import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getPosterById, addComparableSale, getComparableSales } from '@/lib/db';

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

    const sales = await getComparableSales(posterId);
    return NextResponse.json({ sales });
  } catch (error) {
    console.error('Get sales error:', error);
    return NextResponse.json(
      { error: 'Failed to get comparable sales' },
      { status: 500 }
    );
  }
}

export async function POST(
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

    const body = await request.json();

    // Validate required fields
    if (!body.date || !body.price || !body.source) {
      return NextResponse.json(
        { error: 'Date, price, and source are required' },
        { status: 400 }
      );
    }

    const saleData = {
      date: body.date,
      price: parseFloat(body.price),
      currency: body.currency || 'USD',
      source: body.source,
      condition: body.condition || undefined,
      notes: body.notes || undefined,
      url: body.url || undefined,
    };

    const updatedPoster = await addComparableSale(posterId, saleData);

    return NextResponse.json({
      success: true,
      sales: updatedPoster.comparableSales,
    });
  } catch (error) {
    console.error('Add sale error:', error);
    return NextResponse.json(
      { error: 'Failed to add comparable sale' },
      { status: 500 }
    );
  }
}
