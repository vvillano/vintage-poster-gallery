import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getShopifyConfig } from '@/lib/shopify';
import { sql } from '@vercel/postgres';

/**
 * POST /api/shopify/metafields/update-color-choices
 * Updates the jadepuma.color metafield definition to accept all colors
 * from the managed colors list. Uses Shopify GraphQL Admin API.
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const config = await getShopifyConfig();
  if (!config) {
    return NextResponse.json({ error: 'Shopify not configured' }, { status: 500 });
  }

  const gqlUrl = `https://${config.shopDomain.trim()}/admin/api/${config.apiVersion}/graphql.json`;
  const headers = {
    'Content-Type': 'application/json',
    'X-Shopify-Access-Token': config.accessToken,
  };

  try {
    // Step 1: Get all colors from managed list
    const colorsResult = await sql`SELECT name FROM colors ORDER BY display_order, name`;
    const managedColors = colorsResult.rows.map(r => r.name);

    if (managedColors.length === 0) {
      return NextResponse.json({ error: 'No colors in managed list' }, { status: 400 });
    }

    // Step 2: Find the jadepuma.color metafield definition
    const findQuery = `
      query {
        metafieldDefinitions(
          first: 10,
          ownerType: PRODUCT,
          namespace: "jadepuma",
          key: "color"
        ) {
          edges {
            node {
              id
              name
              namespace
              key
              type {
                name
              }
              validations {
                name
                value
              }
            }
          }
        }
      }
    `;

    const findRes = await fetch(gqlUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query: findQuery }),
    });
    const findData = await findRes.json();

    if (findData.errors) {
      return NextResponse.json({ error: 'GraphQL error finding definition', details: findData.errors }, { status: 500 });
    }

    const definitions = findData.data?.metafieldDefinitions?.edges || [];
    if (definitions.length === 0) {
      return NextResponse.json({ error: 'jadepuma.color metafield definition not found' }, { status: 404 });
    }

    const definition = definitions[0].node;
    const currentChoices = definition.validations
      ?.find((v: { name: string; value: string }) => v.name === 'choices')
      ?.value;
    const currentChoicesList = currentChoices ? JSON.parse(currentChoices) : [];

    // Step 3: Update the definition with managed colors list
    const updateQuery = `
      mutation metafieldDefinitionUpdate($definition: MetafieldDefinitionUpdateInput!) {
        metafieldDefinitionUpdate(definition: $definition) {
          updatedDefinition {
            id
            name
            validations {
              name
              value
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const updateRes = await fetch(gqlUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query: updateQuery,
        variables: {
          definition: {
            key: "color",
            namespace: "jadepuma",
            ownerType: "PRODUCT",
            validations: [
              {
                name: "choices",
                value: JSON.stringify(managedColors),
              },
            ],
          },
        },
      }),
    });
    const updateData = await updateRes.json();

    if (updateData.errors) {
      return NextResponse.json({ error: 'GraphQL error updating definition', details: updateData.errors }, { status: 500 });
    }

    const userErrors = updateData.data?.metafieldDefinitionUpdate?.userErrors || [];
    if (userErrors.length > 0) {
      return NextResponse.json({ error: 'Validation errors', details: userErrors }, { status: 422 });
    }

    const updatedDef = updateData.data?.metafieldDefinitionUpdate?.updatedDefinition;
    const newChoices = updatedDef?.validations
      ?.find((v: { name: string; value: string }) => v.name === 'choices')
      ?.value;

    return NextResponse.json({
      success: true,
      previous: currentChoicesList,
      updated: newChoices ? JSON.parse(newChoices) : managedColors,
      managedColors,
    });
  } catch (error) {
    console.error('Update color choices error:', error);
    return NextResponse.json(
      { error: 'Failed to update color choices', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
