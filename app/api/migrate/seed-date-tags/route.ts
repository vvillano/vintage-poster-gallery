import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';

const DATE_TAGS = [
  // Decade-level (10-year ranges)
  { name: '1900-1909', startYear: 1900, endYear: 1909, displayOrder: 10 },
  { name: '1910-1919', startYear: 1910, endYear: 1919, displayOrder: 11 },
  { name: '1920-1929', startYear: 1920, endYear: 1929, displayOrder: 12 },
  { name: '1930-1939', startYear: 1930, endYear: 1939, displayOrder: 13 },
  { name: '1940-1949', startYear: 1940, endYear: 1949, displayOrder: 14 },
  { name: '1950-1959', startYear: 1950, endYear: 1959, displayOrder: 15 },
  { name: '1960-1969', startYear: 1960, endYear: 1969, displayOrder: 16 },
  { name: '1970-1979', startYear: 1970, endYear: 1979, displayOrder: 17 },
  { name: '1980-1989', startYear: 1980, endYear: 1989, displayOrder: 18 },
  { name: '1990-1999', startYear: 1990, endYear: 1999, displayOrder: 19 },
  { name: '2000-2009', startYear: 2000, endYear: 2009, displayOrder: 20 },
  { name: '2010-2019', startYear: 2010, endYear: 2019, displayOrder: 21 },
  { name: '2020-2029', startYear: 2020, endYear: 2029, displayOrder: 22 },

  // Quarter-century ranges (25-year ranges)
  { name: '1900-1924', startYear: 1900, endYear: 1924, displayOrder: 30 },
  { name: '1925-1949', startYear: 1925, endYear: 1949, displayOrder: 31 },
  { name: '1950-1974', startYear: 1950, endYear: 1974, displayOrder: 32 },
  { name: '1975-1999', startYear: 1975, endYear: 1999, displayOrder: 33 },
  { name: '2000-2024', startYear: 2000, endYear: 2024, displayOrder: 34 },

  // Century-level ranges
  { name: 'Pre 1700', startYear: null, endYear: 1699, displayOrder: 1 },
  { name: '1700-1799', startYear: 1700, endYear: 1799, displayOrder: 2 },
  { name: '1800-1849', startYear: 1800, endYear: 1849, displayOrder: 3 },
  { name: '1850-1899', startYear: 1850, endYear: 1899, displayOrder: 4 },
  { name: '1800-1899', startYear: 1800, endYear: 1899, displayOrder: 5 },

  // Modern catch-all
  { name: '2000+', startYear: 2000, endYear: null, displayOrder: 40 },
];

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Clear existing date tags
    await sql`DELETE FROM date_tags`;

    // Insert all date tags
    let inserted = 0;
    for (const tag of DATE_TAGS) {
      await sql`
        INSERT INTO date_tags (name, start_year, end_year, display_order)
        VALUES (${tag.name}, ${tag.startYear}, ${tag.endYear}, ${tag.displayOrder})
      `;
      inserted++;
    }

    return NextResponse.json({
      success: true,
      message: `Seeded ${inserted} date tags`,
      tags: DATE_TAGS.map(t => t.name),
    });
  } catch (error) {
    console.error('Seed date tags error:', error);
    return NextResponse.json(
      { error: 'Failed to seed date tags', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
