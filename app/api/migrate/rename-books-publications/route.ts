import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';

/**
 * POST /api/migrate/rename-books-publications
 * Rename books table to publications, update FK column, add country_of_origin
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results: string[] = [];

    // Step 1: Rename books table to publications
    try {
      await sql`ALTER TABLE books RENAME TO publications`;
      results.push('Renamed books table to publications');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      if (msg.includes('does not exist') && msg.includes('"books"')) {
        results.push('books table does not exist (may already be renamed)');
      } else if (msg.includes('already exists')) {
        results.push('publications table already exists');
      } else {
        throw err;
      }
    }

    // Step 2: Rename book_id column to publication_id on posters table
    try {
      await sql`ALTER TABLE posters RENAME COLUMN book_id TO publication_id`;
      results.push('Renamed book_id to publication_id on posters');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      if (msg.includes('does not exist') || msg.includes('already exists')) {
        results.push('book_id column already renamed or does not exist');
      } else {
        throw err;
      }
    }

    // Step 3: Create backward-compat view so old queries still work
    try {
      await sql`CREATE OR REPLACE VIEW books AS SELECT * FROM publications`;
      results.push('Created backward-compat books view');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      results.push(`Books view note: ${msg}`);
    }

    // Step 4: Rename indexes
    try {
      await sql.query(`ALTER INDEX IF EXISTS idx_books_title RENAME TO idx_publications_title`);
      results.push('Renamed idx_books_title to idx_publications_title');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      if (msg.includes('does not exist')) {
        results.push('idx_books_title index does not exist (already renamed or not created)');
      } else {
        results.push(`Index rename note: ${msg}`);
      }
    }

    try {
      await sql.query(`ALTER INDEX IF EXISTS idx_books_author RENAME TO idx_publications_author`);
      results.push('Renamed idx_books_author to idx_publications_author');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      if (msg.includes('does not exist')) {
        results.push('idx_books_author index does not exist');
      } else {
        results.push(`Index rename note: ${msg}`);
      }
    }

    try {
      await sql.query(`ALTER INDEX IF EXISTS idx_posters_book_id RENAME TO idx_posters_publication_id`);
      results.push('Renamed idx_posters_book_id to idx_posters_publication_id');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      if (msg.includes('does not exist')) {
        results.push('idx_posters_book_id index does not exist');
      } else {
        results.push(`Index rename note: ${msg}`);
      }
    }

    // Step 5: Add country_of_origin column to posters
    try {
      await sql.query(`
        ALTER TABLE posters
        ADD COLUMN IF NOT EXISTS country_of_origin VARCHAR(100)
      `);
      results.push('Added country_of_origin column to posters');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      if (msg.includes('already exists')) {
        results.push('country_of_origin column already exists');
      } else {
        results.push(`country_of_origin note: ${msg}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Books → Publications rename migration completed',
      results,
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { error: 'Migration failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'POST to this endpoint to run books → publications rename migration',
    changes: [
      'Rename books table to publications',
      'Rename book_id column to publication_id on posters',
      'Create backward-compat books view',
      'Rename indexes',
      'Add country_of_origin column to posters',
    ],
  });
}
