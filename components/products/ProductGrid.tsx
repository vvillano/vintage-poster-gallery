'use client';

import type { BrowseProduct } from '@/types/browse-product';
import ProductCard from './ProductCard';

export default function ProductGrid({
  products,
  shopDomain,
}: {
  products: BrowseProduct[];
  shopDomain: string | null;
}) {
  if (products.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg shadow">
        <p className="text-slate-600 text-lg">No products found</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} shopDomain={shopDomain} />
      ))}
    </div>
  );
}
