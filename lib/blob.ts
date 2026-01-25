import { put, del, list } from '@vercel/blob';

/**
 * Upload an image file to Vercel Blob storage
 * @param file - The file to upload
 * @param fileName - Name for the file in storage
 * @returns Object containing the blob URL and pathname
 */
export async function uploadImage(
  file: File,
  fileName: string
): Promise<{ url: string; pathname: string }> {
  try {
    const blob = await put(fileName, file, {
      access: 'public',
      addRandomSuffix: true,
    });

    return {
      url: blob.url,
      pathname: blob.pathname,
    };
  } catch (error) {
    console.error('Error uploading to Vercel Blob:', error);
    throw new Error('Failed to upload image to storage');
  }
}

/**
 * Delete an image from Vercel Blob storage
 * @param url - The blob URL to delete
 */
export async function deleteImage(url: string): Promise<void> {
  try {
    await del(url);
  } catch (error) {
    console.error('Error deleting from Vercel Blob:', error);
    throw new Error('Failed to delete image from storage');
  }
}

/**
 * List all images in Vercel Blob storage
 * @param limit - Maximum number of results to return
 */
export async function listImages(limit = 100) {
  try {
    const { blobs } = await list({ limit });
    return blobs;
  } catch (error) {
    console.error('Error listing Vercel Blob contents:', error);
    throw new Error('Failed to list images from storage');
  }
}

/**
 * Validate image file
 * @param file - File to validate
 * @returns Validation result with error message if invalid
 */
export function validateImageFile(file: File): {
  valid: boolean;
  error?: string;
} {
  // Check file type
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
  if (!validTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Invalid file type. Only JPG and PNG images are allowed.',
    };
  }

  // Check file size (10MB limit)
  const maxSize = 10 * 1024 * 1024; // 10MB in bytes
  if (file.size > maxSize) {
    return {
      valid: false,
      error: 'File size exceeds 10MB limit.',
    };
  }

  return { valid: true };
}

/**
 * Generate a safe filename from the original filename
 * @param originalName - Original filename
 * @returns Sanitized filename
 */
export function sanitizeFileName(originalName: string): string {
  // Remove special characters and spaces
  return originalName
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
