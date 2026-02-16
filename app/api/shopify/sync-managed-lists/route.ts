import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getShopifyConfig, shopifyAdminFetch } from '@/lib/shopify';
import { sql } from '@vercel/postgres';

/**
 * POST /api/shopify/sync-managed-lists
 *
 * Bidirectional sync for platforms and sellers with Shopify metaobjects.
 *
 * Body: {
 *   type: 'platforms' | 'sellers',
 *   direction: 'push' | 'pull' | 'both'
 * }
 *
 * Push: Send local records to Shopify metaobjects
 * Pull: Fetch Shopify metaobjects and create local records
 * Both: Push first, then pull (handles bidirectional sync)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const config = await getShopifyConfig();
    if (!config) {
      return NextResponse.json(
        { error: 'Shopify not configured' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { type, direction = 'both' } = body;

    if (!type || !['platforms', 'sellers'].includes(type)) {
      return NextResponse.json(
        { error: 'type required (platforms or sellers)' },
        { status: 400 }
      );
    }

    if (!['push', 'pull', 'both'].includes(direction)) {
      return NextResponse.json(
        { error: 'direction must be push, pull, or both' },
        { status: 400 }
      );
    }

    const results: {
      pushed: number;
      pulled: number;
      updated: number;
      skipped: number;
      errors: string[];
    } = {
      pushed: 0,
      pulled: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };

    // =====================================================
    // PUSH: Send local records to Shopify
    // =====================================================
    if (direction === 'push' || direction === 'both') {
      if (type === 'platforms') {
        // Get platforms that need to be synced to Shopify
        const localPlatforms = await sql`
          SELECT id, name, platform_type, shopify_metaobject_id
          FROM platforms
          WHERE is_acquisition_platform = true
          ORDER BY display_order ASC
        `;

        for (const platform of localPlatforms.rows) {
          try {
            if (platform.shopify_metaobject_id) {
              // Already synced, skip (could update if needed)
              results.skipped++;
              continue;
            }

            // Create metaobject in Shopify
            const metaobjectInput = {
              type: 'jadepuma_source_platform',
              fields: [
                { key: 'name', value: platform.name },
                { key: 'platform_type', value: platform.platform_type || 'other' },
              ],
            };

            const response = await shopifyAdminFetch(config, {
              query: CREATE_METAOBJECT_MUTATION,
              variables: { metaobject: metaobjectInput },
            });

            if (response.data?.metaobjectCreate?.metaobject?.id) {
              const shopifyId = response.data.metaobjectCreate.metaobject.id;
              // Save the Shopify ID back to local record
              await sql`
                UPDATE platforms
                SET shopify_metaobject_id = ${shopifyId}
                WHERE id = ${platform.id}
              `;
              results.pushed++;
            } else if (response.data?.metaobjectCreate?.userErrors?.length > 0) {
              results.errors.push(
                `Platform "${platform.name}": ${response.data.metaobjectCreate.userErrors[0].message}`
              );
            }
          } catch (err) {
            results.errors.push(
              `Platform "${platform.name}": ${err instanceof Error ? err.message : 'Unknown error'}`
            );
          }
        }
      }

      if (type === 'sellers') {
        // Get sellers that need to be synced to Shopify
        const localSellers = await sql`
          SELECT id, name, type, shopify_metaobject_id
          FROM sellers
          WHERE is_active = true
          ORDER BY reliability_tier ASC, name ASC
        `;

        for (const seller of localSellers.rows) {
          try {
            if (seller.shopify_metaobject_id) {
              // Already synced, skip
              results.skipped++;
              continue;
            }

            // Create metaobject in Shopify
            const metaobjectInput = {
              type: 'jadepuma_seller',
              fields: [
                { key: 'name', value: seller.name },
                { key: 'seller_type', value: seller.type || 'other' },
              ],
            };

            const response = await shopifyAdminFetch(config, {
              query: CREATE_METAOBJECT_MUTATION,
              variables: { metaobject: metaobjectInput },
            });

            if (response.data?.metaobjectCreate?.metaobject?.id) {
              const shopifyId = response.data.metaobjectCreate.metaobject.id;
              // Save the Shopify ID back to local record
              await sql`
                UPDATE sellers
                SET shopify_metaobject_id = ${shopifyId}
                WHERE id = ${seller.id}
              `;
              results.pushed++;
            } else if (response.data?.metaobjectCreate?.userErrors?.length > 0) {
              results.errors.push(
                `Seller "${seller.name}": ${response.data.metaobjectCreate.userErrors[0].message}`
              );
            }
          } catch (err) {
            results.errors.push(
              `Seller "${seller.name}": ${err instanceof Error ? err.message : 'Unknown error'}`
            );
          }
        }
      }
    }

    // =====================================================
    // PULL: Fetch from Shopify and create/update local records
    // =====================================================
    if (direction === 'pull' || direction === 'both') {
      if (type === 'platforms') {
        try {
          // Fetch all source platform metaobjects from Shopify
          const response = await shopifyAdminFetch(config, {
            query: GET_METAOBJECTS_QUERY,
            variables: { type: 'jadepuma_source_platform', first: 250 },
          });

          const metaobjects = response.data?.metaobjects?.edges || [];

          for (const edge of metaobjects) {
            const metaobject = edge.node;
            const shopifyId = metaobject.id;
            const nameField = metaobject.fields?.find((f: any) => f.key === 'name');
            const name = nameField?.value;

            if (!name) continue;

            // Check if we already have this by shopify_metaobject_id
            const existingById = await sql`
              SELECT id FROM platforms WHERE shopify_metaobject_id = ${shopifyId}
            `;

            if (existingById.rows.length > 0) {
              results.skipped++;
              continue;
            }

            // Check if we have this by name
            const existingByName = await sql`
              SELECT id FROM platforms WHERE LOWER(name) = LOWER(${name})
            `;

            if (existingByName.rows.length > 0) {
              // Link existing record to Shopify
              await sql`
                UPDATE platforms
                SET shopify_metaobject_id = ${shopifyId}
                WHERE id = ${existingByName.rows[0].id}
              `;
              results.updated++;
              continue;
            }

            // Create new local record with defaults
            await sql`
              INSERT INTO platforms (
                name, platform_type, is_acquisition_platform, can_research_prices,
                display_order, shopify_metaobject_id
              )
              VALUES (
                ${name}, 'marketplace', true, false, 999, ${shopifyId}
              )
            `;
            results.pulled++;
          }
        } catch (err) {
          results.errors.push(
            `Pull platforms: ${err instanceof Error ? err.message : 'Unknown error'}`
          );
        }
      }

      if (type === 'sellers') {
        try {
          // Fetch all seller metaobjects from Shopify
          const response = await shopifyAdminFetch(config, {
            query: GET_METAOBJECTS_QUERY,
            variables: { type: 'jadepuma_seller', first: 250 },
          });

          const metaobjects = response.data?.metaobjects?.edges || [];

          for (const edge of metaobjects) {
            const metaobject = edge.node;
            const shopifyId = metaobject.id;
            const nameField = metaobject.fields?.find((f: any) => f.key === 'name');
            const name = nameField?.value;

            if (!name) continue;

            // Check if we already have this by shopify_metaobject_id
            const existingById = await sql`
              SELECT id FROM sellers WHERE shopify_metaobject_id = ${shopifyId}
            `;

            if (existingById.rows.length > 0) {
              results.skipped++;
              continue;
            }

            // Check if we have this by name (slug)
            const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
            const existingBySlug = await sql`
              SELECT id FROM sellers WHERE slug = ${slug}
            `;

            if (existingBySlug.rows.length > 0) {
              // Link existing record to Shopify
              await sql`
                UPDATE sellers
                SET shopify_metaobject_id = ${shopifyId}
                WHERE id = ${existingBySlug.rows[0].id}
              `;
              results.updated++;
              continue;
            }

            // Create new local record with defaults (as per plan)
            await sql`
              INSERT INTO sellers (
                name, slug, type, reliability_tier, attribution_weight, pricing_weight,
                is_active, shopify_metaobject_id
              )
              VALUES (
                ${name}, ${slug}, 'dealer', 3, 0.70, 0.70, true, ${shopifyId}
              )
            `;
            results.pulled++;
          }
        } catch (err) {
          results.errors.push(
            `Pull sellers: ${err instanceof Error ? err.message : 'Unknown error'}`
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      type,
      direction,
      results,
      message: `Sync completed: ${results.pushed} pushed, ${results.pulled} pulled, ${results.updated} updated, ${results.skipped} skipped`,
    });
  } catch (error) {
    console.error('Sync managed lists error:', error);
    return NextResponse.json(
      {
        error: 'Failed to sync managed lists',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/shopify/sync-managed-lists?type=platforms|sellers
 *
 * Get sync status - how many records are synced vs unsynced
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const type = request.nextUrl.searchParams.get('type');

    if (!type || !['platforms', 'sellers'].includes(type)) {
      return NextResponse.json(
        { error: 'type required (platforms or sellers)' },
        { status: 400 }
      );
    }

    if (type === 'platforms') {
      const total = await sql`
        SELECT COUNT(*) as count FROM platforms WHERE is_acquisition_platform = true
      `;
      const synced = await sql`
        SELECT COUNT(*) as count FROM platforms
        WHERE is_acquisition_platform = true AND shopify_metaobject_id IS NOT NULL
      `;

      return NextResponse.json({
        type: 'platforms',
        total: parseInt(total.rows[0].count),
        synced: parseInt(synced.rows[0].count),
        unsynced: parseInt(total.rows[0].count) - parseInt(synced.rows[0].count),
      });
    }

    if (type === 'sellers') {
      const total = await sql`
        SELECT COUNT(*) as count FROM sellers WHERE is_active = true
      `;
      const synced = await sql`
        SELECT COUNT(*) as count FROM sellers
        WHERE is_active = true AND shopify_metaobject_id IS NOT NULL
      `;

      return NextResponse.json({
        type: 'sellers',
        total: parseInt(total.rows[0].count),
        synced: parseInt(synced.rows[0].count),
        unsynced: parseInt(total.rows[0].count) - parseInt(synced.rows[0].count),
      });
    }

    return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
  } catch (error) {
    console.error('Sync status error:', error);
    return NextResponse.json(
      {
        error: 'Failed to get sync status',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// GraphQL mutations for Shopify metaobjects
const CREATE_METAOBJECT_MUTATION = `
  mutation CreateMetaobject($metaobject: MetaobjectCreateInput!) {
    metaobjectCreate(metaobject: $metaobject) {
      metaobject {
        id
        handle
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const GET_METAOBJECTS_QUERY = `
  query GetMetaobjects($type: String!, $first: Int!) {
    metaobjects(type: $type, first: $first) {
      edges {
        node {
          id
          handle
          fields {
            key
            value
          }
        }
      }
    }
  }
`;
