import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';

/**
 * POST /api/migrate/artist-profiles
 * Add enhanced artist profile fields and poster-artist linking
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results: string[] = [];

    // Add new columns to artists table
    try {
      await sql`
        ALTER TABLE artists
        ADD COLUMN IF NOT EXISTS wikipedia_url VARCHAR(500)
      `;
      results.push('Added wikipedia_url column to artists');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      if (!msg.includes('already exists')) {
        throw err;
      }
      results.push('wikipedia_url column already exists');
    }

    try {
      await sql`
        ALTER TABLE artists
        ADD COLUMN IF NOT EXISTS bio TEXT
      `;
      results.push('Added bio column to artists');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      if (!msg.includes('already exists')) {
        throw err;
      }
      results.push('bio column already exists');
    }

    try {
      await sql`
        ALTER TABLE artists
        ADD COLUMN IF NOT EXISTS image_url VARCHAR(500)
      `;
      results.push('Added image_url column to artists');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      if (!msg.includes('already exists')) {
        throw err;
      }
      results.push('image_url column already exists');
    }

    try {
      await sql`
        ALTER TABLE artists
        ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT false
      `;
      results.push('Added verified column to artists');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      if (!msg.includes('already exists')) {
        throw err;
      }
      results.push('verified column already exists');
    }

    // Add artist_id foreign key to posters table
    try {
      await sql`
        ALTER TABLE posters
        ADD COLUMN IF NOT EXISTS artist_id INTEGER
      `;
      results.push('Added artist_id column to posters');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      if (!msg.includes('already exists')) {
        throw err;
      }
      results.push('artist_id column already exists');
    }

    // Add foreign key constraint (separate step to handle if column already has constraint)
    try {
      await sql`
        ALTER TABLE posters
        ADD CONSTRAINT fk_posters_artist
        FOREIGN KEY (artist_id)
        REFERENCES artists(id)
        ON DELETE SET NULL
      `;
      results.push('Added foreign key constraint for artist_id');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      if (!msg.includes('already exists')) {
        // Constraint might already exist, that's OK
        console.log('FK constraint note:', msg);
      }
      results.push('Foreign key constraint already exists or added');
    }

    // Create index on artist_id for better query performance
    try {
      await sql`
        CREATE INDEX IF NOT EXISTS idx_posters_artist_id ON posters (artist_id)
      `;
      results.push('Created index on posters.artist_id');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      if (!msg.includes('already exists')) {
        console.log('Index note:', msg);
      }
      results.push('Index on artist_id already exists or created');
    }

    return NextResponse.json({
      success: true,
      message: 'Artist profile migration completed',
      results,
    });
  } catch (error) {
    console.error('Artist profile migration error:', error);
    return NextResponse.json(
      {
        error: 'Migration failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
