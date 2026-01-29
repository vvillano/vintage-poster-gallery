import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  saveShopifyOAuthCredentials,
  getShopifyOAuthUrl,
} from '@/lib/shopify';
import { randomBytes } from 'crypto';

/**
 * POST /api/shopify/oauth
 * Save OAuth credentials and return authorization URL
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { shopDomain, clientId, clientSecret } = body;

    if (!shopDomain || typeof shopDomain !== 'string') {
      return NextResponse.json(
        { error: 'Shop domain is required' },
        { status: 400 }
      );
    }

    if (!clientId || typeof clientId !== 'string') {
      return NextResponse.json(
        { error: 'Client ID is required' },
        { status: 400 }
      );
    }

    if (!clientSecret || typeof clientSecret !== 'string') {
      return NextResponse.json(
        { error: 'Client Secret is required' },
        { status: 400 }
      );
    }

    // Normalize shop domain
    const normalizedDomain = shopDomain
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '')
      .toLowerCase();

    // Save OAuth credentials (access token will be added after callback)
    await saveShopifyOAuthCredentials({
      shopDomain: normalizedDomain,
      clientId: clientId.trim(),
      clientSecret: clientSecret.trim(),
    });

    // Generate state for CSRF protection
    const state = randomBytes(16).toString('hex');

    // Get the base URL for the redirect URI
    const baseUrl = request.headers.get('origin') || process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const redirectUri = `${baseUrl}/api/shopify/oauth/callback`;

    // Generate authorization URL
    const authUrl = getShopifyOAuthUrl(
      normalizedDomain,
      clientId.trim(),
      redirectUri,
      state
    );

    return NextResponse.json({
      success: true,
      authUrl,
      state,
    });
  } catch (error) {
    console.error('OAuth initiation error:', error);
    return NextResponse.json(
      {
        error: 'Failed to initiate OAuth',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
