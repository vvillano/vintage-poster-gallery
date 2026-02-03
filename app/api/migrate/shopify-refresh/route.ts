import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';

/**
 * POST /api/migrate/shopify-refresh
 * Add columns for Shopify refresh feature:
 * - shopify_reference_images: Reference images from Shopify metafields
 * - item_notes: Research-relevant notes (separate from internal userNotes)
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results: string[] = [];

    // Add shopify_reference_images column
    await sql`
      ALTER TABLE posters
      ADD COLUMN IF NOT EXISTS shopify_reference_images JSONB DEFAULT NULL
    `;
    results.push('Added shopify_reference_images column');

    // Add item_notes column
    await sql`
      ALTER TABLE posters
      ADD COLUMN IF NOT EXISTS item_notes TEXT DEFAULT NULL
    `;
    results.push('Added item_notes column');

    return NextResponse.json({
      success: true,
      message: 'Shopify refresh migration completed successfully',
      results,
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      {
        error: 'Migration failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
