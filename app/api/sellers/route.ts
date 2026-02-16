import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  getAllSellers,
  getSellerById,
  getSellerByIdWithPlatform,
  getSellersWithPlatforms,
  createSeller,
  updateSeller,
  deleteSeller,
  getSellerCount,
  findExistingSeller,
} from '@/lib/sellers';
import type { SellerType, SellerRegion, SellerSpecialization } from '@/types/seller';

/**
 * GET /api/sellers
 * Get all sellers with optional filters
 *
 * Query params:
 * - id: Get single seller by ID
 * - type: Filter by seller type (auction_house, dealer, gallery, bookstore, individual, other)
 * - region: Filter by region
 * - specialization: Filter by specialization
 * - search: Search by name or notes
 * - canResearchAt: Filter by research capability (has searchable archives)
 * - isActive: Filter by active status
 * - platformId: Filter by platform ID (for individual sellers on a specific platform)
 * - includePlatform: Include joined platform data (true/false)
 * - limit: Pagination limit (default 100)
 * - offset: Pagination offset (default 0)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    const includePlatform = searchParams.get('includePlatform') === 'true';

    // If fetching single seller by ID
    if (id) {
      const seller = includePlatform
        ? await getSellerByIdWithPlatform(parseInt(id))
        : await getSellerById(parseInt(id));
      if (!seller) {
        return NextResponse.json({ error: 'Seller not found' }, { status: 404 });
      }
      return NextResponse.json({ item: seller });
    }

    // Build filter options
    const type = searchParams.get('type') as SellerType | null;
    const region = searchParams.get('region') as SellerRegion | null;
    const specialization = searchParams.get('specialization') as SellerSpecialization | null;
    const search = searchParams.get('search');
    const canResearchAt = searchParams.get('canResearchAt');
    const isActive = searchParams.get('isActive');
    const platformId = searchParams.get('platformId');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    // Use the joined query if we need platform data or filtering by platformId
    if (includePlatform || platformId) {
      const options: Parameters<typeof getSellersWithPlatforms>[0] = {};

      if (type) options.type = type;
      if (search) options.search = search;
      if (isActive !== null) options.isActive = isActive === 'true';
      if (platformId) options.platformId = parseInt(platformId);
      if (limit) options.limit = parseInt(limit);
      if (offset) options.offset = parseInt(offset);

      const sellers = await getSellersWithPlatforms(options);
      const total = await getSellerCount(options.isActive);

      // Apply specialization filter client-side (complex array contains)
      let filteredSellers = sellers;
      if (specialization) {
        filteredSellers = sellers.filter(s => s.specializations.includes(specialization));
      }
      if (canResearchAt !== null) {
        filteredSellers = filteredSellers.filter(s => s.canResearchAt === (canResearchAt === 'true'));
      }

      return NextResponse.json({
        items: filteredSellers,
        total,
        limit: options.limit || 100,
        offset: options.offset || 0,
      });
    }

    // Standard query without platform joins
    const options: Parameters<typeof getAllSellers>[0] = {};

    if (type) options.type = type;
    if (region) options.region = region;
    if (specialization) options.specialization = specialization;
    if (search) options.search = search;
    if (canResearchAt !== null) options.canResearchAt = canResearchAt === 'true';
    if (isActive !== null) options.isActive = isActive === 'true';
    if (limit) options.limit = parseInt(limit);
    if (offset) options.offset = parseInt(offset);

    const sellers = await getAllSellers(options);
    const total = await getSellerCount(options.isActive);

    return NextResponse.json({
      items: sellers,
      total,
      limit: options.limit || 100,
      offset: options.offset || 0,
    });
  } catch (error) {
    console.error('Sellers GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sellers', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sellers
 * Create a new seller
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    if (!body.name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    if (!body.type) {
      return NextResponse.json({ error: 'type is required' }, { status: 400 });
    }

    // Check for existing seller with same name or website
    const existing = await findExistingSeller(body.name, body.website);
    if (existing) {
      const message = existing.matchedBy === 'name'
        ? `A seller named "${existing.name}" already exists`
        : `A seller with this website already exists: "${existing.name}"`;
      return NextResponse.json(
        { error: 'Seller already exists', message, existingId: existing.id, existingName: existing.name },
        { status: 409 }
      );
    }

    const seller = await createSeller({
      name: body.name,
      type: body.type,
      website: body.website,
      platformId: body.platformId,
      linkedSellerId: body.linkedSellerId,
      country: body.country,
      city: body.city,
      region: body.region,
      email: body.email,
      phone: body.phone,
      reliabilityTier: body.reliabilityTier,
      attributionWeight: body.attributionWeight,
      pricingWeight: body.pricingWeight,
      canResearchAt: body.canResearchAt,
      searchUrlTemplate: body.searchUrlTemplate,
      searchSoldUrlTemplate: body.searchSoldUrlTemplate,
      specializations: body.specializations,
      username: body.username,
      password: body.password,
      notes: body.notes,
      isActive: body.isActive,
      shopifyMetaobjectId: body.shopifyMetaobjectId,
    });

    return NextResponse.json({ item: seller }, { status: 201 });
  } catch (error) {
    console.error('Sellers POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create seller', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/sellers?id=123
 * Update a seller
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id parameter required' }, { status: 400 });
    }

    const body = await request.json();
    const idNum = parseInt(id);

    const seller = await updateSeller({
      id: idNum,
      name: body.name,
      type: body.type,
      website: body.website,
      platformId: body.platformId,
      linkedSellerId: body.linkedSellerId,
      country: body.country,
      city: body.city,
      region: body.region,
      email: body.email,
      phone: body.phone,
      reliabilityTier: body.reliabilityTier,
      attributionWeight: body.attributionWeight,
      pricingWeight: body.pricingWeight,
      canResearchAt: body.canResearchAt,
      searchUrlTemplate: body.searchUrlTemplate,
      searchSoldUrlTemplate: body.searchSoldUrlTemplate,
      specializations: body.specializations,
      username: body.username,
      password: body.password,
      notes: body.notes,
      isActive: body.isActive,
      shopifyMetaobjectId: body.shopifyMetaobjectId,
    });

    return NextResponse.json({ item: seller });
  } catch (error) {
    console.error('Sellers PUT error:', error);
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json({ error: 'Seller not found' }, { status: 404 });
    }
    return NextResponse.json(
      { error: 'Failed to update seller', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/sellers?id=123
 * Delete a seller
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id parameter required' }, { status: 400 });
    }

    const idNum = parseInt(id);
    const deleted = await deleteSeller(idNum);

    if (!deleted) {
      return NextResponse.json({ error: 'Seller not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, deletedId: idNum });
  } catch (error) {
    console.error('Sellers DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete seller', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
