/**
 * Browser-side Image Compression Utility for Clinic Logo Uploads
 * 
 * Rules:
 * 1. Resizes to max 400px width and 150px height (preserves aspect ratio)
 * 2. Compresses to modern WebP format at 80% quality
 * 3. Reduces 5MB-10MB images down to ~15KB-30KB before uploading to Supabase
 */

export interface CompressionResult {
  blob: Blob;
  previewUrl: string;
  width: number;
  height: number;
  originalSizeBytes: number;
  compressedSizeBytes: number;
}

export async function compressClinicLogo(
  file: File,
  maxWidth = 400,
  maxHeight = 150,
  quality = 0.8
): Promise<CompressionResult> {
  return new Promise((resolve, reject) => {
    // Check if the file is an image
    if (!file.type.startsWith('image/')) {
      return reject(new Error('Please select an image file (PNG, JPG, JPEG, WEBP, or SVG).'));
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;

      // Calculate aspect ratio preserving downscaled dimensions
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      // Create offscreen canvas for rendering
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return reject(new Error('Unable to create canvas context for image compression.'));
      }

      // Smooth downsampling
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Draw downscaled image
      ctx.drawImage(img, 0, 0, width, height);

      // Try exporting as WebP; fallback to PNG if WebP is not supported
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            return reject(new Error('Failed to compress image blob.'));
          }

          const previewUrl = URL.createObjectURL(blob);
          resolve({
            blob,
            previewUrl,
            width,
            height,
            originalSizeBytes: file.size,
            compressedSizeBytes: blob.size,
          });
        },
        'image/webp',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image for compression. The file might be corrupted.'));
    };

    img.src = objectUrl;
  });
}
