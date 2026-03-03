'use client';

import type { ProductMetafields } from '@/types/shopify-product-detail';

function parseCurrency(jsonValue: string | undefined): number {
  if (!jsonValue) return 0;
  try {
    const obj = JSON.parse(jsonValue);
    if (obj.amount) return parseFloat(obj.amount) || 0;
  } catch { /* not JSON */ }
  return parseFloat(jsonValue) || 0;
}

export default function PricingSection({
  price,
  compareAtPrice,
  inventoryQuantity,
  unitCost,
  metafields,
  onChange,
}: {
  price: string;
  compareAtPrice: string;
  inventoryQuantity: string;
  unitCost: string | null;
  metafields: ProductMetafields;
  onChange: (field: string, value: string) => void;
}) {
  const purchasePrice = parseCurrency(metafields.purchasePrice);
  const shipping = parseCurrency(metafields.shipping);
  const restoration = parseCurrency(metafields.restoration);
  const totalCOGS = purchasePrice + shipping + restoration;
  const retailPrice = parseFloat(price) || 0;
  const margin = retailPrice > 0 ? ((retailPrice - totalCOGS) / retailPrice) * 100 : NaN;
  const marginDisplay = isNaN(margin) || !isFinite(margin) ? 'N/A' : `${margin.toFixed(1)}%`;

  return (
    <div className="grid gap-4 pt-4">
      {/* Reference COGS */}
      <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
        <span className="text-sm font-medium text-amber-700">Reference COGS:</span>
        <span className="text-sm text-amber-900 font-semibold">${totalCOGS.toFixed(2)}</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
          <input
            type="number"
            value={inventoryQuantity}
            onChange={(e) => onChange('inventoryQuantity', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Retail Price ($)</label>
          <input
            type="text"
            value={price}
            onChange={(e) => onChange('price', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Compare At ($)</label>
          <input
            type="text"
            value={compareAtPrice}
            onChange={(e) => onChange('compareAtPrice', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-500 mb-1">Margin</label>
          <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">
            {marginDisplay}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-500 mb-1">Unit Cost</label>
          <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">
            {unitCost ? `$${unitCost}` : '-'}
          </div>
        </div>
      </div>
    </div>
  );
}
