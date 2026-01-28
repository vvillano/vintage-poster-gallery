import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAllResearchSites, createResearchSite, researchSiteExists } from '@/lib/research-sites';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sites = await getAllResearchSites();
    return NextResponse.json({ sites });
  } catch (error) {
    console.error('Get research sites error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve research sites' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, urlTemplate, requiresSubscription, username, password, displayOrder } = body;

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Site name is required' }, { status: 400 });
    }

    if (!urlTemplate || typeof urlTemplate !== 'string' || urlTemplate.trim().length === 0) {
      return NextResponse.json({ error: 'URL template is required' }, { status: 400 });
    }

    // Check for duplicates
    if (await researchSiteExists(name)) {
      return NextResponse.json({ error: 'A site with this name already exists' }, { status: 409 });
    }

    const site = await createResearchSite({
      name,
      urlTemplate,
      requiresSubscription: requiresSubscription || false,
      username: username || null,
      password: password || null,
      displayOrder: displayOrder || 0,
    });

    return NextResponse.json({ site });
  } catch (error) {
    console.error('Create research site error:', error);
    return NextResponse.json(
      { error: 'Failed to create research site' },
      { status: 500 }
    );
  }
}
