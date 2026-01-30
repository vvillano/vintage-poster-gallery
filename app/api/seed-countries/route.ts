import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

// Countries with their ISO codes
const COUNTRIES = [
  { name: 'Argentina', code: 'AR' },
  { name: 'Australia', code: 'AU' },
  { name: 'Austria', code: 'AT' },
  { name: 'Azerbaijan', code: 'AZ' },
  { name: 'Belgium', code: 'BE' },
  { name: 'Canada', code: 'CA' },
  { name: 'Chile', code: 'CL' },
  { name: 'China', code: 'CN' },
  { name: 'Cuba', code: 'CU' },
  { name: 'Czech Republic', code: 'CZ' },
  { name: 'Denmark', code: 'DK' },
  { name: 'Egypt', code: 'EG' },
  { name: 'Finland', code: 'FI' },
  { name: 'France', code: 'FR' },
  { name: 'Germany', code: 'DE' },
  { name: 'Hungary', code: 'HU' },
  { name: 'Italy', code: 'IT' },
  { name: 'Japan', code: 'JP' },
  { name: 'Mexico', code: 'MX' },
  { name: 'Netherlands', code: 'NL', aliases: ['Holland'] },
  { name: 'Norway', code: 'NO' },
  { name: 'Peru', code: 'PE' },
  { name: 'Poland', code: 'PL' },
  { name: 'Russia', code: 'RU' },
  { name: 'Spain', code: 'ES' },
  { name: 'Sweden', code: 'SE' },
  { name: 'Switzerland', code: 'CH' },
  { name: 'Turkey', code: 'TR' },
  { name: 'Ukraine', code: 'UA' },
  { name: 'United Kingdom', code: 'GB', aliases: ['UK', 'Britain', 'Great Britain', 'Scotland', 'England', 'Wales'] },
  { name: 'United States', code: 'US', aliases: ['USA', 'America', 'U.S.', 'U.S.A.'] },
  { name: 'Vietnam', code: 'VN' },
  { name: 'Yugoslavia', code: 'YU', aliases: ['Former Yugoslavia'] },
];

export async function POST() {
  try {
    let added = 0;
    let skipped = 0;

    for (const country of COUNTRIES) {
      // Check if country already exists
      const existing = await sql`
        SELECT id FROM countries WHERE LOWER(name) = LOWER(${country.name}) OR code = ${country.code}
      `;

      if (existing.rows.length > 0) {
        skipped++;
        continue;
      }

      // Insert new country
      await sql`
        INSERT INTO countries (name, code, display_order)
        VALUES (${country.name}, ${country.code}, ${added + 1})
      `;
      added++;
    }

    return NextResponse.json({
      success: true,
      message: `Added ${added} countries, skipped ${skipped} existing`,
      added,
      skipped,
    });
  } catch (error) {
    console.error('Error seeding countries:', error);
    return NextResponse.json(
      { error: 'Failed to seed countries' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'POST to this endpoint to seed countries',
    countries: COUNTRIES.map(c => `${c.name} (${c.code})`),
  });
}
