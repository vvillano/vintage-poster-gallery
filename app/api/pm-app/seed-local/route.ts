import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';
import {
  fetchPMAppManagedLists,
  isPMAppConfigured,
  normalizeForComparison,
} from '@/lib/pm-app';

interface SeedResult {
  listType: string;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

/**
 * POST /api/pm-app/seed-local
 *
 * One-time seed endpoint: pulls Product Types, Conditions, and related
 * custom lists (SKU Abbreviations, Default Conditions Text, SEO Titles)
 * from PM App and populates local tables.
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isPMAppConfigured()) {
      return NextResponse.json(
        { error: 'PM App API key not configured' },
        { status: 400 }
      );
    }

    const pmAppData = await fetchPMAppManagedLists();
    const results: SeedResult[] = [];

    // 1. Seed Product Types from managedLists.productTypes
    const ptResult = await seedProductTypes(pmAppData.managedLists.productTypes);
    results.push(ptResult);

    // 2. Seed Conditions from managedLists.conditions
    const condResult = await seedConditions(pmAppData.managedLists.conditions);
    results.push(condResult);

    // 3. Process custom managed lists for product type enrichment
    const customLists = pmAppData.managedLists.customManagedLists || [];

    for (const customList of customLists) {
      const title = customList.title.toLowerCase();

      if (title.includes('sku abbreviation')) {
        const skuResult = await enrichProductTypes(
          customList.values,
          'sku_abbreviation',
          'SKU Abbreviations'
        );
        results.push(skuResult);
      } else if (title.includes('default condition')) {
        const condTextResult = await enrichProductTypes(
          customList.values,
          'default_condition_text',
          'Default Conditions Text'
        );
        results.push(condTextResult);
      } else if (title.includes('seo title') || title.includes('seo & marketing')) {
        const seoResult = await enrichProductTypes(
          customList.values,
          'seo_title_prefix',
          'SEO Titles'
        );
        results.push(seoResult);
      }
    }

    const totalCreated = results.reduce((sum, r) => sum + r.created, 0);
    const totalUpdated = results.reduce((sum, r) => sum + r.updated, 0);
    const totalSkipped = results.reduce((sum, r) => sum + r.skipped, 0);

    return NextResponse.json({
      ok: true,
      results,
      summary: { totalCreated, totalUpdated, totalSkipped },
    });
  } catch (error) {
    console.error('PM App seed-local error:', error);
    return NextResponse.json(
      {
        error: 'Failed to seed from PM App',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Seed product_types table from PM App productTypes list
 */
async function seedProductTypes(items: string[]): Promise<SeedResult> {
  const result: SeedResult = {
    listType: 'productTypes',
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  const existing = await sql`SELECT name FROM product_types`;
  const existingNames = new Set(
    existing.rows.map((r) => normalizeForComparison(r.name))
  );

  let order = existing.rows.length;

  for (const name of items) {
    const normalized = normalizeForComparison(name);
    if (existingNames.has(normalized)) {
      result.skipped++;
      continue;
    }

    try {
      order++;
      await sql`
        INSERT INTO product_types (name, active, display_order, created_at)
        VALUES (${name}, true, ${order}, NOW())
        ON CONFLICT (name) DO NOTHING
      `;
      result.created++;
      existingNames.add(normalized);
    } catch (err) {
      result.errors.push(`Failed to create product type "${name}": ${err}`);
    }
  }

  return result;
}

/**
 * Seed conditions table from PM App conditions list
 */
async function seedConditions(items: string[]): Promise<SeedResult> {
  const result: SeedResult = {
    listType: 'conditions',
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  const existing = await sql`SELECT name FROM conditions`;
  const existingNames = new Set(
    existing.rows.map((r) => normalizeForComparison(r.name))
  );

  let order = existing.rows.length;

  for (const name of items) {
    const normalized = normalizeForComparison(name);
    if (existingNames.has(normalized)) {
      result.skipped++;
      continue;
    }

    try {
      order++;
      await sql`
        INSERT INTO conditions (name, display_order, created_at)
        VALUES (${name}, ${order}, NOW())
        ON CONFLICT (name) DO NOTHING
      `;
      result.created++;
      existingNames.add(normalized);
    } catch (err) {
      result.errors.push(`Failed to create condition "${name}": ${err}`);
    }
  }

  return result;
}

/**
 * Enrich product_types rows with data from PM App custom lists.
 *
 * Custom list values are formatted as "ProductType: Value" pairs.
 * For example: "Poster: P" (SKU), "Poster: Original Vintage Poster:" (SEO)
 */
async function enrichProductTypes(
  values: string[],
  column: 'sku_abbreviation' | 'default_condition_text' | 'seo_title_prefix',
  listName: string
): Promise<SeedResult> {
  const result: SeedResult = {
    listType: listName,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  // Get all product types for matching
  const existing = await sql`SELECT id, name FROM product_types`;
  const productTypeMap = new Map<string, number>();
  for (const row of existing.rows) {
    productTypeMap.set(normalizeForComparison(row.name), row.id);
  }

  for (const value of values) {
    // Parse "ProductType: Value" format
    const colonIndex = value.indexOf(':');
    if (colonIndex === -1) {
      result.skipped++;
      continue;
    }

    const productTypeName = value.substring(0, colonIndex).trim();
    const fieldValue = value.substring(colonIndex + 1).trim();

    if (!productTypeName || !fieldValue) {
      result.skipped++;
      continue;
    }

    const productTypeId = productTypeMap.get(normalizeForComparison(productTypeName));
    if (!productTypeId) {
      result.skipped++;
      result.errors.push(`No matching product type for "${productTypeName}" in "${value}"`);
      continue;
    }

    try {
      if (column === 'sku_abbreviation') {
        await sql`
          UPDATE product_types SET sku_abbreviation = ${fieldValue} WHERE id = ${productTypeId}
        `;
      } else if (column === 'default_condition_text') {
        await sql`
          UPDATE product_types SET default_condition_text = ${fieldValue} WHERE id = ${productTypeId}
        `;
      } else if (column === 'seo_title_prefix') {
        await sql`
          UPDATE product_types SET seo_title_prefix = ${fieldValue} WHERE id = ${productTypeId}
        `;
      }
      result.updated++;
    } catch (err) {
      result.errors.push(`Failed to update ${column} for "${productTypeName}": ${err}`);
    }
  }

  return result;
}
