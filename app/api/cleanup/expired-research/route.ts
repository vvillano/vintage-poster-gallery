import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import { del } from '@vercel/blob';

/**
 * POST /api/cleanup/expired-research
 * Delete research records older than 30 days that aren't linked to Shopify
 *
 * Criteria for deletion:
 * - record_source IN ('direct_upload', 'price_research')
 * - shopify_product_id IS NULL (not linked to Shopify)
 * - created_at OR upload_date < NOW() - 30 days
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse optional dryRun parameter
    const body = await request.json().catch(() => ({}));
    const dryRun = body.dryRun === true;

    // Find records to delete
    const expiredRecords = await sql`
      SELECT id, image_blob_id, file_name, record_source, upload_date
      FROM posters
      WHERE (record_source IN ('direct_upload', 'price_research') OR record_source IS NULL)
      AND shopify_product_id IS NULL
      AND upload_date < NOW() - INTERVAL '30 days'
    `;

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        message: `Would delete ${expiredRecords.rows.length} expired research records`,
        records: expiredRecords.rows.map(r => ({
          id: r.id,
          fileName: r.file_name,
          recordSource: r.record_source,
          uploadDate: r.upload_date,
        })),
      });
    }

    // Delete records and their blobs
    let deletedCount = 0;
    const errors: string[] = [];

    for (const record of expiredRecords.rows) {
      try {
        // Delete the blob if it exists
        if (record.image_blob_id) {
          try {
            await del(record.image_blob_id);
          } catch (blobErr) {
            // Blob might already be deleted, continue
            console.warn(`Could not delete blob for poster ${record.id}:`, blobErr);
          }
        }

        // Delete the database record
        await sql`DELETE FROM posters WHERE id = ${record.id}`;
        deletedCount++;
      } catch (err) {
        errors.push(`Failed to delete poster ${record.id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Deleted ${deletedCount} expired research records`,
      deletedCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Cleanup expired research error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to cleanup expired research records',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cleanup/expired-research
 * Preview what would be deleted (equivalent to POST with dryRun: true)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find records that would be deleted
    const expiredRecords = await sql`
      SELECT id, image_blob_id, file_name, record_source, upload_date
      FROM posters
      WHERE (record_source IN ('direct_upload', 'price_research') OR record_source IS NULL)
      AND shopify_product_id IS NULL
      AND upload_date < NOW() - INTERVAL '30 days'
    `;

    return NextResponse.json({
      success: true,
      count: expiredRecords.rows.length,
      message: `Found ${expiredRecords.rows.length} expired research records`,
      records: expiredRecords.rows.map(r => ({
        id: r.id,
        fileName: r.file_name,
        recordSource: r.record_source,
        uploadDate: r.upload_date,
      })),
    });
  } catch (error) {
    console.error('Cleanup preview error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to preview expired research records',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
