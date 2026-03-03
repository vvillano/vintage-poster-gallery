'use client';

import Image from 'next/image';
import type { ProductDetailImage } from '@/types/shopify-product-detail';

export default function ImagesSection({ images }: { images: ProductDetailImage[] }) {
  if (images.length === 0) {
    return (
      <div className="pt-4 text-sm text-slate-500">
        No images uploaded for this product.
      </div>
    );
  }

  return (
    <div className="pt-4">
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
        {images.map((img) => (
          <div key={img.id} className="aspect-square relative bg-slate-100 rounded-lg overflow-hidden">
            <Image
              src={img.url}
              alt={img.altText || ''}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, 20vw"
              loading="lazy"
            />
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-400 mt-2">
        Image management coming in Phase 3
      </p>
    </div>
  );
}
