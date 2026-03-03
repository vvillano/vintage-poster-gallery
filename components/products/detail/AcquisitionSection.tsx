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

function formatCurrency(jsonValue: string | undefined): string {
  if (!jsonValue) return '-';
  try {
    const obj = JSON.parse(jsonValue);
    if (obj.amount) return `$${parseFloat(obj.amount).toFixed(2)}`;
  } catch { /* not JSON */ }
  const num = parseFloat(jsonValue);
  if (!isNaN(num)) return `$${num.toFixed(2)}`;
  return jsonValue;
}

export default function AcquisitionSection({ metafields }: { metafields: ProductMetafields }) {
  const purchasePrice = parseCurrency(metafields.purchasePrice);
  const shipping = parseCurrency(metafields.shipping);
  const restoration = parseCurrency(metafields.restoration);
  const totalCOGS = purchasePrice + shipping + restoration;

  return (
    <div className="grid gap-4 pt-4">
      {/* Purchase Date / Platform/Venue */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-500 mb-1">Purchase Date</label>
          <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">
            {metafields.date || '-'}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-500 mb-1">Platform / Venue</label>
          <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">
            {metafields.sourcePlatform || '-'}
          </div>
        </div>
      </div>

      {/* Auction checkbox (placeholder) */}
      <div>
        <label className="flex items-center gap-2 text-sm text-slate-500">
          <input
            type="checkbox"
            disabled
            className="rounded border-slate-300"
          />
          <span>Auction</span>
          <span className="text-slate-400 italic text-xs">(read-only)</span>
        </label>
      </div>

      {/* Purchase Price / Other Costs / Restoration */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-500 mb-1">Purchase Price</label>
          <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">
            {formatCurrency(metafields.purchasePrice)}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-500 mb-1">Other Costs</label>
          <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">
            {formatCurrency(metafields.shipping)}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-500 mb-1">Restoration</label>
          <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">
            {formatCurrency(metafields.restoration)}
          </div>
        </div>
      </div>

      {/* Total COGS */}
      <div>
        <label className="block text-sm font-medium text-slate-500 mb-1">Total COGS</label>
        <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm font-semibold text-amber-900">
          ${totalCOGS.toFixed(2)}
        </div>
      </div>

      {/* Seller/Dealer / Platform Identity */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-500 mb-1">Seller / Dealer</label>
          <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">
            {metafields.dealer || metafields.privateSellerName || '-'}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-500 mb-1">Platform Identity</label>
          <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">
            {metafields.platformIdentity || '-'}
          </div>
        </div>
      </div>
    </div>
  );
}
