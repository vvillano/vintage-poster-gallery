'use client';

import Image from 'next/image';
import type { BrowseProduct } from '@/types/browse-product';

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  draft: 'bg-yellow-100 text-yellow-700',
  archived: 'bg-slate-100 text-slate-500',
};

export default function ProductCard({
  product,
  shopDomain,
}: {
  product: BrowseProduct;
  shopDomain: string | null;
}) {
  const href = product.isImported && product.localPosterId
    ? `/poster/${product.localPosterId}`
    : `/products/${product.id}`;

  return (
    <a
      href={href}
      className="bg-white rounded-lg shadow-sm hover:shadow-md hover:ring-2 hover:ring-blue-300 transition-all overflow-hidden block"
    >
      <div className="aspect-[3/4] relative bg-slate-100 overflow-hidden">
        {product.thumbnailUrl ? (
          <Image
            src={product.thumbnailUrl}
            alt={product.title}
            width={200}
            height={267}
            className="object-cover w-full h-full"
            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 20vw, 16vw"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl text-slate-300">
            No Image
          </div>
        )}
        {product.isImported && (
          <div className="absolute top-1.5 right-1.5 bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
            Imported
          </div>
        )}
      </div>
      <div className="p-2">
        <h3 className="font-semibold text-xs text-slate-900 line-clamp-1">
          {product.title}
        </h3>
        <div className="flex items-center gap-1.5 mt-1">
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${STATUS_COLORS[product.status] || ''}`}>
            {product.status}
          </span>
          {product.price && (
            <span className="text-[10px] text-slate-500">${product.price}</span>
          )}
        </div>
        {product.sku && (
          <p className="text-[10px] text-slate-400 mt-0.5 font-mono">{product.sku}</p>
        )}
      </div>
    </a>
  );
}
