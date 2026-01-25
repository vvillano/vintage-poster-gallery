import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { uploadImage, validateImageFile, sanitizeFileName } from '@/lib/blob';
import { createPoster } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const initialInformation = formData.get('initialInformation') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file
    const validation = validateImageFile(file);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // Sanitize filename
    const safeFileName = sanitizeFileName(file.name);

    // Upload to Vercel Blob
    const { url, pathname } = await uploadImage(file, safeFileName);

    // Create database record
    const poster = await createPoster({
      imageUrl: url,
      imageBlobId: pathname,
      fileName: file.name,
      fileSize: file.size,
      uploadedBy: session.user.name || 'unknown',
      initialInformation: initialInformation || undefined,
    });

    return NextResponse.json({
      success: true,
      posterId: poster.id,
      imageUrl: url,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      {
        error: 'Failed to upload image',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
