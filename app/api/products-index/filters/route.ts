import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getFilterOptions } from '@/lib/products-index';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const options = await getFilterOptions();
    return NextResponse.json(options);
  } catch (error) {
    console.error('Products index filters error:', error);
    return NextResponse.json(
      { error: 'Failed to get filter options', details: String(error) },
      { status: 500 }
    );
  }
}
