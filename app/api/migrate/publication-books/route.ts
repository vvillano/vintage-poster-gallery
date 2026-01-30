import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';

/**
 * POST /api/migrate/publication-books
 * Add publication confidence columns and create books table
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results: string[] = [];

    // Add publication columns to posters table
    const publicationColumns = [
      { name: 'publication', type: 'VARCHAR(255)' },
      { name: 'publication_confidence', type: 'VARCHAR(20)' },
      { name: 'publication_source', type: 'TEXT' },
    ];

    for (const col of publicationColumns) {
      try {
        await sql.query(`
          ALTER TABLE posters
          ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}
        `);
        results.push(`Added ${col.name} column to posters`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        if (!msg.includes('already exists')) {
          console.log(`Column ${col.name} note:`, msg);
        }
        results.push(`${col.name} column already exists or added`);
      }
    }

    // Create books table
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS books (
          id SERIAL PRIMARY KEY,
          title VARCHAR(500) NOT NULL,
          author VARCHAR(255),
          publication_year INT,
          publisher_id INT REFERENCES publishers(id) ON DELETE SET NULL,
          contributors TEXT,
          country VARCHAR(100),
          edition VARCHAR(100),
          volume_info VARCHAR(100),
          notes TEXT,
          wikipedia_url VARCHAR(500),
          bio TEXT,
          image_url VARCHAR(500),
          verified BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `;
      results.push('Created books table');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      if (!msg.includes('already exists')) {
        throw err;
      }
      results.push('books table already exists');
    }

    // Create indexes for books table
    try {
      await sql`CREATE INDEX IF NOT EXISTS idx_books_title ON books (title)`;
      results.push('Created idx_books_title index');
    } catch {
      results.push('idx_books_title index already exists or created');
    }

    try {
      await sql`CREATE INDEX IF NOT EXISTS idx_books_author ON books (author)`;
      results.push('Created idx_books_author index');
    } catch {
      results.push('idx_books_author index already exists or created');
    }

    // Add book_id column to posters table
    try {
      await sql.query(`
        ALTER TABLE posters
        ADD COLUMN IF NOT EXISTS book_id INTEGER REFERENCES books(id) ON DELETE SET NULL
      `);
      results.push('Added book_id column to posters');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      if (!msg.includes('already exists')) {
        console.log('book_id column note:', msg);
      }
      results.push('book_id column already exists or added');
    }

    // Create index for book_id
    try {
      await sql`CREATE INDEX IF NOT EXISTS idx_posters_book_id ON posters (book_id)`;
      results.push('Created idx_posters_book_id index');
    } catch {
      results.push('idx_posters_book_id index already exists or created');
    }

    return NextResponse.json({
      success: true,
      message: 'Publication confidence and books migration completed',
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
    message: 'POST to this endpoint to run publication and books migration',
    changes: [
      'Add publication, publication_confidence, publication_source columns to posters',
      'Create books table with title, author, publication_year, publisher_id, contributors, etc.',
      'Add book_id column to posters',
    ],
  });
}
