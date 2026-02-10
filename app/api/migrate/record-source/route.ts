import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

/**
 * Run the record source tracking migration
 * Adds record_source and expires_at columns to the posters table
 * for tracking where records came from and auto-cleanup of research records
 */
async function runRecordSourceMigration(): Promise<string[]> {
  const results: string[] = [];

  // =====================================================
  // STEP 1: Add record_source column
  // =====================================================
  try {
    await sql`
      ALTER TABLE posters
      ADD COLUMN IF NOT EXISTS record_source VARCHAR(50) DEFAULT 'unknown'
    `;
    results.push('Added record_source column to posters');
  } catch (err) {
    results.push(`Note: ${err instanceof Error ? err.message : 'record_source may already exist'}`);
  }

  // =====================================================
  // STEP 2: Add expires_at column
  // =====================================================
  try {
    await sql`
      ALTER TABLE posters
      ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP NULL
    `;
    results.push('Added expires_at column to posters');
  } catch (err) {
    results.push(`Note: ${err instanceof Error ? err.message : 'expires_at may already exist'}`);
  }

  // =====================================================
  // STEP 3: Set record_source for existing Shopify-linked items
  // =====================================================
  try {
    const result = await sql`
      UPDATE posters
      SET record_source = 'shopify_import'
      WHERE shopify_product_id IS NOT NULL
      AND (record_source IS NULL OR record_source = 'unknown')
    `;
    results.push(`Set record_source='shopify_import' for ${result.rowCount} Shopify-linked items`);
  } catch (err) {
    results.push(`Note: ${err instanceof Error ? err.message : 'Error updating Shopify items'}`);
  }

  // =====================================================
  // STEP 4: Set record_source for non-Shopify items (direct uploads)
  // =====================================================
  try {
    const result = await sql`
      UPDATE posters
      SET record_source = 'direct_upload'
      WHERE shopify_product_id IS NULL
      AND (record_source IS NULL OR record_source = 'unknown')
    `;
    results.push(`Set record_source='direct_upload' for ${result.rowCount} non-Shopify items`);
  } catch (err) {
    results.push(`Note: ${err instanceof Error ? err.message : 'Error updating non-Shopify items'}`);
  }

  return results;
}

export async function POST(request: NextRequest) {
  try {
    const results = await runRecordSourceMigration();

    return NextResponse.json({
      success: true,
      message: 'Record source migration completed',
      results,
      resultCount: results.length,
    });
  } catch (error) {
    console.error('Record source migration error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Migration failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
