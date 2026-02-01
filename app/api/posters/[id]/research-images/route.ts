import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { uploadImage, validateImageFile, sanitizeFileName, deleteImage } from '@/lib/blob';
import { getPosterById, addResearchImage, removeResearchImage } from '@/lib/db';
import type { ResearchImage, ResearchImageType } from '@/types/poster';

const VALID_IMAGE_TYPES: ResearchImageType[] = ['signature', 'title_page', 'printer_mark', 'detail', 'other'];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const posterId = parseInt(id);
    if (isNaN(posterId)) {
      return NextResponse.json({ error: 'Invalid poster ID' }, { status: 400 });
    }

    // Verify poster exists
    const poster = await getPosterById(posterId);
    if (!poster) {
      return NextResponse.json({ error: 'Poster not found' }, { status: 404 });
    }

    // Check limit (max 5 research images)
    const currentImages = poster.researchImages || [];
    if (currentImages.length >= 5) {
      return NextResponse.json(
        { error: 'Maximum of 5 research images allowed' },
        { status: 400 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const description = formData.get('description') as string;
    const imageType = formData.get('imageType') as ResearchImageType;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!imageType || !VALID_IMAGE_TYPES.includes(imageType)) {
      return NextResponse.json(
        { error: 'Invalid image type. Must be one of: ' + VALID_IMAGE_TYPES.join(', ') },
        { status: 400 }
      );
    }

    // Validate file
    const validation = validateImageFile(file);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // Sanitize filename with poster ID and type prefix for organization
    const safeFileName = `poster-${posterId}-research-${imageType}-${sanitizeFileName(file.name)}`;

    // Upload to Vercel Blob
    const { url, pathname } = await uploadImage(file, safeFileName);

    // Create research image object
    const researchImage: ResearchImage = {
      url,
      blobId: pathname,
      fileName: file.name,
      imageType,
      description: description || undefined,
      uploadDate: new Date(),
    };

    // Add to poster
    const updatedPoster = await addResearchImage(posterId, researchImage);

    return NextResponse.json({
      success: true,
      image: researchImage,
      totalImages: updatedPoster.researchImages?.length || 1,
    });
  } catch (error) {
    console.error('Research image upload error:', error);
    return NextResponse.json(
      {
        error: 'Failed to upload research image',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const posterId = parseInt(id);
    if (isNaN(posterId)) {
      return NextResponse.json({ error: 'Invalid poster ID' }, { status: 400 });
    }

    // Get the image URL to delete from query params
    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get('imageUrl');

    if (!imageUrl) {
      return NextResponse.json({ error: 'Image URL is required' }, { status: 400 });
    }

    // Verify poster exists
    const poster = await getPosterById(posterId);
    if (!poster) {
      return NextResponse.json({ error: 'Poster not found' }, { status: 404 });
    }

    // Find the image to get its blobId for deletion
    const imageToDelete = poster.researchImages?.find(img => img.url === imageUrl);
    if (imageToDelete?.blobId) {
      try {
        await deleteImage(imageToDelete.blobId);
      } catch (err) {
        console.error('Failed to delete blob:', err);
        // Continue anyway - we still want to remove from DB
      }
    }

    // Remove from poster
    const updatedPoster = await removeResearchImage(posterId, imageUrl);

    return NextResponse.json({
      success: true,
      totalImages: updatedPoster.researchImages?.length || 0,
    });
  } catch (error) {
    console.error('Research image delete error:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete research image',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
