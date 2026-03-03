import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { browseProductsIndex } from '@/lib/products-index';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;

    const result = await browseProductsIndex({
      q: searchParams.get('q') || undefined,
      status: searchParams.get('status') || undefined,
      productType: searchParams.get('product_type') || undefined,
      artist: searchParams.get('artist') || undefined,
      country: searchParams.get('country') || undefined,
      platform: searchParams.get('platform') || undefined,
      tags: searchParams.get('tags') || undefined,
      hasImage: searchParams.get('has_image') || undefined,
      sort: searchParams.get('sort') || undefined,
      order: searchParams.get('order') || undefined,
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : undefined,
      pageSize: searchParams.get('pageSize') ? parseInt(searchParams.get('pageSize')!) : undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Products index browse error:', error);
    return NextResponse.json(
      { error: 'Failed to browse products', details: String(error) },
      { status: 500 }
    );
  }
}
