'use client';

import Image from 'next/image';
import type { BrowseProduct } from '@/types/browse-product';

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  draft: 'bg-yellow-100 text-yellow-700',
  archived: 'bg-slate-100 text-slate-500',
};

export default function ProductTable({
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

  function getHref(product: BrowseProduct) {
    if (product.isImported && product.localPosterId) {
      return `/poster/${product.localPosterId}`;
    }
    return shopDomain ? `https://${shopDomain}/admin/products/${product.id}` : '#';
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 font-medium text-slate-600 w-12"></th>
              <th className="px-4 py-3 font-medium text-slate-600">Title</th>
              <th className="px-4 py-3 font-medium text-slate-600">SKU</th>
              <th className="px-4 py-3 font-medium text-slate-600">Status</th>
              <th className="px-4 py-3 font-medium text-slate-600 hidden md:table-cell">Type</th>
              <th className="px-4 py-3 font-medium text-slate-600">Price</th>
              <th className="px-4 py-3 font-medium text-slate-600 hidden md:table-cell">Qty</th>
              <th className="px-4 py-3 font-medium text-slate-600 w-16"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {products.map((product) => {
              const href = getHref(product);
              const isExternal = !product.isImported;

              return (
                <tr key={product.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-2">
                    <a href={href} target={isExternal ? '_blank' : undefined} rel={isExternal ? 'noopener noreferrer' : undefined}>
                      <div className="w-10 h-10 rounded bg-slate-100 overflow-hidden flex-shrink-0">
                        {product.thumbnailUrl ? (
                          <Image
                            src={product.thumbnailUrl}
                            alt=""
                            width={40}
                            height={40}
                            className="object-cover w-full h-full"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-300 text-xs">
                            N/A
                          </div>
                        )}
                      </div>
                    </a>
                  </td>
                  <td className="px-4 py-2">
                    <a
                      href={href}
                      target={isExternal ? '_blank' : undefined}
                      rel={isExternal ? 'noopener noreferrer' : undefined}
                      className="font-medium text-slate-900 hover:text-blue-600 line-clamp-1"
                    >
                      {product.title}
                    </a>
                  </td>
                  <td className="px-4 py-2 text-slate-500 font-mono text-xs">
                    {product.sku || '-'}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${STATUS_COLORS[product.status] || ''}`}>
                      {product.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-500 hidden md:table-cell">
                    {product.productType || '-'}
                  </td>
                  <td className="px-4 py-2 text-slate-700">
                    {product.price ? `$${product.price}` : '-'}
                  </td>
                  <td className="px-4 py-2 text-slate-500 hidden md:table-cell">
                    {product.inventoryQuantity ?? '-'}
                  </td>
                  <td className="px-4 py-2 text-center">
                    {product.isImported && (
                      <span className="inline-block bg-blue-100 text-blue-700 text-[10px] font-bold px-1.5 py-0.5 rounded">
                        Imported
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
