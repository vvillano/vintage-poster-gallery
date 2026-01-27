import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAllTags, createTag, tagExists } from '@/lib/tags';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tags = await getAllTags();
    return NextResponse.json({ tags });
  } catch (error) {
    console.error('Get tags error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve tags' },
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

    const { name } = await request.json();

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Tag name is required' }, { status: 400 });
    }

    if (await tagExists(name)) {
      return NextResponse.json({ error: 'Tag already exists' }, { status: 409 });
    }

    const tag = await createTag(name);
    return NextResponse.json({ tag });
  } catch (error) {
    console.error('Create tag error:', error);
    return NextResponse.json(
      { error: 'Failed to create tag' },
      { status: 500 }
    );
  }
}
