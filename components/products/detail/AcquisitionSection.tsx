'use client';

import type { ProductMetafields } from '@/types/shopify-product-detail';

function formatCurrency(jsonValue: string | undefined): string {
  if (!jsonValue) return '-';
  try {
    const obj = JSON.parse(jsonValue);
    if (obj.amount) return `$${obj.amount}`;
  } catch { /* not JSON */ }
  return jsonValue;
}

export default function AcquisitionSection({ metafields }: { metafields: ProductMetafields }) {
  const fields = [
    { label: 'Dealer/Seller', value: metafields.dealer || metafields.privateSellerName || '-' },
    { label: 'Source Platform', value: metafields.sourcePlatform || '-' },
    { label: 'Purchase Date', value: metafields.date || '-' },
    { label: 'Purchase Price', value: formatCurrency(metafields.purchasePrice) },
    { label: 'Shipping', value: formatCurrency(metafields.shipping) },
    { label: 'Restoration', value: formatCurrency(metafields.restoration) },
  ];

  return (
    <div className="pt-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
        {fields.map(({ label, value }) => (
          <div key={label} className="flex justify-between py-1.5 border-b border-slate-50">
            <span className="text-sm text-slate-500">{label}</span>
            <span className="text-sm text-slate-800">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
