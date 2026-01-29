import { NextRequest, NextResponse } from 'next/server';
import {
  getShopifyConfig,
  exchangeCodeForToken,
  updateShopifyAccessToken,
  testShopifyConnection,
  deleteShopifyConfig,
} from '@/lib/shopify';

/**
 * GET /api/shopify/oauth/callback
 * Handle OAuth callback from Shopify
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const shop = searchParams.get('shop');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Handle error from Shopify
    if (error) {
      console.error('Shopify OAuth error:', error, errorDescription);
      return NextResponse.redirect(
        new URL(`/settings/shopify?error=${encodeURIComponent(errorDescription || error)}`, request.url)
      );
    }

    // Validate required parameters
    if (!code) {
      return NextResponse.redirect(
        new URL('/settings/shopify?error=Missing authorization code', request.url)
      );
    }

    if (!shop) {
      return NextResponse.redirect(
        new URL('/settings/shopify?error=Missing shop parameter', request.url)
      );
    }

    // Get saved OAuth credentials
    const config = await getShopifyConfig();

    if (!config || !config.clientId || !config.clientSecret) {
      return NextResponse.redirect(
        new URL('/settings/shopify?error=OAuth credentials not found. Please try again.', request.url)
      );
    }

    // Verify the shop matches (security check)
    const normalizedShop = shop.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();
    if (normalizedShop !== config.shopDomain) {
      console.error('Shop mismatch:', normalizedShop, '!==', config.shopDomain);
      return NextResponse.redirect(
        new URL('/settings/shopify?error=Shop domain mismatch', request.url)
      );
    }

    // Exchange code for access token
    const tokenResult = await exchangeCodeForToken(
      config.shopDomain,
      config.clientId,
      config.clientSecret,
      code
    );

    // Save the access token
    await updateShopifyAccessToken(tokenResult.accessToken);

    // Test the connection
    const testResult = await testShopifyConnection();

    if (!testResult.success) {
      // Delete invalid config
      await deleteShopifyConfig();
      return NextResponse.redirect(
        new URL(`/settings/shopify?error=${encodeURIComponent(testResult.error || 'Connection test failed')}`, request.url)
      );
    }

    // Success! Redirect to settings page
    return NextResponse.redirect(
      new URL(`/settings/shopify?success=Connected to ${testResult.shopName}`, request.url)
    );
  } catch (error) {
    console.error('OAuth callback error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.redirect(
      new URL(`/settings/shopify?error=${encodeURIComponent(errorMessage)}`, request.url)
    );
  }
}
