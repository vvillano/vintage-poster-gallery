import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';

/**
 * POST /api/migrate/printer-publisher
 * Create printers and publishers tables, add linking columns to posters
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results: string[] = [];

    // Create printers table
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS printers (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          aliases TEXT[],
          location VARCHAR(100),
          country VARCHAR(100),
          founded_year INT,
          closed_year INT,
          notes TEXT,
          wikipedia_url VARCHAR(500),
          bio TEXT,
          image_url VARCHAR(500),
          verified BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `;
      results.push('Created printers table');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      if (!msg.includes('already exists')) {
        throw err;
      }
      results.push('printers table already exists');
    }

    // Create publishers table
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS publishers (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          aliases TEXT[],
          publication_type VARCHAR(50),
          country VARCHAR(100),
          founded_year INT,
          ceased_year INT,
          notes TEXT,
          wikipedia_url VARCHAR(500),
          bio TEXT,
          image_url VARCHAR(500),
          verified BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `;
      results.push('Created publishers table');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      if (!msg.includes('already exists')) {
        throw err;
      }
      results.push('publishers table already exists');
    }

    // Add printer columns to posters table
    const printerColumns = [
      { name: 'printer_id', type: 'INTEGER' },
      { name: 'printer_confidence', type: 'VARCHAR(20)' },
      { name: 'printer_source', type: 'TEXT' },
      { name: 'printer_verification', type: 'JSONB' },
    ];

    for (const col of printerColumns) {
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

    // Add publisher columns to posters table
    const publisherColumns = [
      { name: 'publisher_id', type: 'INTEGER' },
      { name: 'publisher_confidence', type: 'VARCHAR(20)' },
      { name: 'publisher_source', type: 'TEXT' },
    ];

    for (const col of publisherColumns) {
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

    // Add foreign key constraint for printer_id
    try {
      await sql`
        ALTER TABLE posters
        ADD CONSTRAINT fk_posters_printer
        FOREIGN KEY (printer_id)
        REFERENCES printers(id)
        ON DELETE SET NULL
      `;
      results.push('Added foreign key constraint for printer_id');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      if (!msg.includes('already exists')) {
        console.log('Printer FK constraint note:', msg);
      }
      results.push('Printer foreign key constraint already exists or added');
    }

    // Add foreign key constraint for publisher_id
    try {
      await sql`
        ALTER TABLE posters
        ADD CONSTRAINT fk_posters_publisher
        FOREIGN KEY (publisher_id)
        REFERENCES publishers(id)
        ON DELETE SET NULL
      `;
      results.push('Added foreign key constraint for publisher_id');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      if (!msg.includes('already exists')) {
        console.log('Publisher FK constraint note:', msg);
      }
      results.push('Publisher foreign key constraint already exists or added');
    }

    // Create indexes
    try {
      await sql`
        CREATE INDEX IF NOT EXISTS idx_posters_printer_id ON posters (printer_id)
      `;
      results.push('Created index on posters.printer_id');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      if (!msg.includes('already exists')) {
        console.log('Printer index note:', msg);
      }
      results.push('Index on printer_id already exists or created');
    }

    try {
      await sql`
        CREATE INDEX IF NOT EXISTS idx_posters_publisher_id ON posters (publisher_id)
      `;
      results.push('Created index on posters.publisher_id');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      if (!msg.includes('already exists')) {
        console.log('Publisher index note:', msg);
      }
      results.push('Index on publisher_id already exists or created');
    }

    return NextResponse.json({
      success: true,
      message: 'Printer and Publisher migration completed',
      results,
    });
  } catch (error) {
    console.error('Printer/Publisher migration error:', error);
    return NextResponse.json(
      {
        error: 'Migration failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
