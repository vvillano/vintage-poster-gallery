import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getResearchSiteById, updateResearchSite, deleteResearchSite, researchSiteExists } from '@/lib/research-sites';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const siteId = parseInt(id);

    if (isNaN(siteId)) {
      return NextResponse.json({ error: 'Invalid site ID' }, { status: 400 });
    }

    const site = await getResearchSiteById(siteId);
    if (!site) {
      return NextResponse.json({ error: 'Research site not found' }, { status: 404 });
    }

    return NextResponse.json({ site });
  } catch (error) {
    console.error('Get research site error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve research site' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const siteId = parseInt(id);

    if (isNaN(siteId)) {
      return NextResponse.json({ error: 'Invalid site ID' }, { status: 400 });
    }

    // Check if site exists
    const existingSite = await getResearchSiteById(siteId);
    if (!existingSite) {
      return NextResponse.json({ error: 'Research site not found' }, { status: 404 });
    }

    const body = await request.json();
    const { name, urlTemplate, requiresSubscription, username, password, displayOrder } = body;

    // If name is changing, check for duplicates
    if (name && name !== existingSite.name) {
      if (await researchSiteExists(name)) {
        return NextResponse.json({ error: 'A site with this name already exists' }, { status: 409 });
      }
    }

    const site = await updateResearchSite(siteId, {
      name,
      urlTemplate,
      requiresSubscription,
      username,
      password,
      displayOrder,
    });

    return NextResponse.json({ site });
  } catch (error) {
    console.error('Update research site error:', error);
    return NextResponse.json(
      { error: 'Failed to update research site' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const siteId = parseInt(id);

    if (isNaN(siteId)) {
      return NextResponse.json({ error: 'Invalid site ID' }, { status: 400 });
    }

    // Check if site exists
    const site = await getResearchSiteById(siteId);
    if (!site) {
      return NextResponse.json({ error: 'Research site not found' }, { status: 404 });
    }

    await deleteResearchSite(siteId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete research site error:', error);
    return NextResponse.json(
      { error: 'Failed to delete research site' },
      { status: 500 }
    );
  }
}
