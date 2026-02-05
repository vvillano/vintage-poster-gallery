import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  getAllDealers,
  getDealerById,
  createDealer,
  updateDealer,
  deleteDealer,
  getDealerCount,
  findExistingDealer,
} from '@/lib/dealers';
import type { DealerType, DealerRegion, DealerSpecialization } from '@/types/dealer';

/**
 * GET /api/dealers
 * Get all dealers with optional filters
 *
 * Query params:
 * - id: Get single dealer by ID
 * - type: Filter by dealer type
 * - region: Filter by region
 * - specialization: Filter by specialization
 * - search: Search by name or notes
 * - canResearch: Filter by research capability
 * - canPrice: Filter by pricing capability
 * - canProcure: Filter by procurement capability
 * - canBeSource: Filter by acquisition source capability
 * - isActive: Filter by active status
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

    // If fetching single dealer by ID
    if (id) {
      const dealer = await getDealerById(parseInt(id));
      if (!dealer) {
        return NextResponse.json({ error: 'Dealer not found' }, { status: 404 });
      }
      return NextResponse.json({ item: dealer });
    }

    // Build filter options
    const options: Parameters<typeof getAllDealers>[0] = {};

    const type = searchParams.get('type');
    if (type) options.type = type as DealerType;

    const region = searchParams.get('region');
    if (region) options.region = region as DealerRegion;

    const specialization = searchParams.get('specialization');
    if (specialization) options.specialization = specialization as DealerSpecialization;

    const search = searchParams.get('search');
    if (search) options.search = search;

    const canResearch = searchParams.get('canResearch');
    if (canResearch !== null) options.canResearch = canResearch === 'true';

    const canPrice = searchParams.get('canPrice');
    if (canPrice !== null) options.canPrice = canPrice === 'true';

    const canProcure = searchParams.get('canProcure');
    if (canProcure !== null) options.canProcure = canProcure === 'true';

    const canBeSource = searchParams.get('canBeSource');
    if (canBeSource !== null) options.canBeSource = canBeSource === 'true';

    const isActive = searchParams.get('isActive');
    if (isActive !== null) options.isActive = isActive === 'true';

    const limit = searchParams.get('limit');
    if (limit) options.limit = parseInt(limit);

    const offset = searchParams.get('offset');
    if (offset) options.offset = parseInt(offset);

    const dealers = await getAllDealers(options);
    const total = await getDealerCount(options.isActive);

    return NextResponse.json({
      items: dealers,
      total,
      limit: options.limit || 100,
      offset: options.offset || 0,
    });
  } catch (error) {
    console.error('Dealers GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dealers', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/dealers
 * Create a new dealer
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

    // Check for existing dealer with same name or website
    const existing = await findExistingDealer(body.name, body.website);
    if (existing) {
      const message = existing.matchedBy === 'name'
        ? `A dealer named "${existing.name}" already exists`
        : `A dealer with this website already exists: "${existing.name}"`;
      return NextResponse.json(
        { error: 'Dealer already exists', message, existingId: existing.id, existingName: existing.name },
        { status: 409 }
      );
    }

    const dealer = await createDealer({
      name: body.name,
      type: body.type,
      website: body.website,
      country: body.country,
      city: body.city,
      region: body.region,
      email: body.email,
      phone: body.phone,
      reliabilityTier: body.reliabilityTier,
      attributionWeight: body.attributionWeight,
      pricingWeight: body.pricingWeight,
      canResearch: body.canResearch,
      canPrice: body.canPrice,
      canProcure: body.canProcure,
      canBeSource: body.canBeSource,
      searchUrlTemplate: body.searchUrlTemplate,
      searchSoldUrlTemplate: body.searchSoldUrlTemplate,
      specializations: body.specializations,
      linkedSellerId: body.linkedSellerId,
      notes: body.notes,
      isActive: body.isActive,
    });

    return NextResponse.json({ item: dealer }, { status: 201 });
  } catch (error) {
    console.error('Dealers POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create dealer', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/dealers?id=123
 * Update a dealer
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

    const dealer = await updateDealer({
      id: idNum,
      name: body.name,
      type: body.type,
      website: body.website,
      country: body.country,
      city: body.city,
      region: body.region,
      email: body.email,
      phone: body.phone,
      reliabilityTier: body.reliabilityTier,
      attributionWeight: body.attributionWeight,
      pricingWeight: body.pricingWeight,
      canResearch: body.canResearch,
      canPrice: body.canPrice,
      canProcure: body.canProcure,
      canBeSource: body.canBeSource,
      searchUrlTemplate: body.searchUrlTemplate,
      searchSoldUrlTemplate: body.searchSoldUrlTemplate,
      specializations: body.specializations,
      linkedSellerId: body.linkedSellerId,
      notes: body.notes,
      isActive: body.isActive,
    });

    return NextResponse.json({ item: dealer });
  } catch (error) {
    console.error('Dealers PUT error:', error);
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json({ error: 'Dealer not found' }, { status: 404 });
    }
    return NextResponse.json(
      { error: 'Failed to update dealer', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/dealers?id=123
 * Delete a dealer
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
    const deleted = await deleteDealer(idNum);

    if (!deleted) {
      return NextResponse.json({ error: 'Dealer not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, deletedId: idNum });
  } catch (error) {
    console.error('Dealers DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete dealer', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
