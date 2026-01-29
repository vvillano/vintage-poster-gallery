import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  getShopifyConfig,
  saveShopifyConfig,
  deleteShopifyConfig,
  testShopifyConnection,
} from '@/lib/shopify';

/**
 * GET /api/shopify/config
 * Get current Shopify configuration (token masked)
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const config = await getShopifyConfig();

    if (!config) {
      return NextResponse.json({ configured: false });
    }

    // Mask the access token
    const maskedToken =
      config.accessToken.substring(0, 8) +
      '...' +
      config.accessToken.substring(config.accessToken.length - 4);

    return NextResponse.json({
      configured: true,
      shopDomain: config.shopDomain,
      accessToken: maskedToken,
      apiVersion: config.apiVersion,
      updatedAt: config.updatedAt,
    });
  } catch (error) {
    console.error('Get Shopify config error:', error);
    return NextResponse.json(
      { error: 'Failed to get Shopify configuration' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/shopify/config
 * Save Shopify configuration and test connection
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { shopDomain, accessToken, apiVersion } = body;

    if (!shopDomain || typeof shopDomain !== 'string') {
      return NextResponse.json(
        { error: 'Shop domain is required' },
        { status: 400 }
      );
    }

    if (!accessToken || typeof accessToken !== 'string') {
      return NextResponse.json(
        { error: 'Access token is required' },
        { status: 400 }
      );
    }

    // Normalize shop domain (remove https://, trailing slashes)
    const normalizedDomain = shopDomain
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '')
      .toLowerCase();

    // Save configuration
    await saveShopifyConfig({
      shopDomain: normalizedDomain,
      accessToken: accessToken.trim(),
      apiVersion: apiVersion || '2024-01',
    });

    // Test connection
    const testResult = await testShopifyConnection();

    if (!testResult.success) {
      // Delete invalid config
      await deleteShopifyConfig();
      return NextResponse.json(
        {
          error: 'Connection failed',
          details: testResult.error,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      shopName: testResult.shopName,
      message: `Connected to ${testResult.shopName}`,
    });
  } catch (error) {
    console.error('Save Shopify config error:', error);
    return NextResponse.json(
      {
        error: 'Failed to save Shopify configuration',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/shopify/config
 * Remove Shopify configuration
 */
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await deleteShopifyConfig();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete Shopify config error:', error);
    return NextResponse.json(
      { error: 'Failed to delete Shopify configuration' },
      { status: 500 }
    );
  }
}
