'use client';

import type { ProductMetafields } from '@/types/shopify-product-detail';

export default function SpecificationsSection({ metafields }: { metafields: ProductMetafields }) {
  return (
    <div className="grid gap-4 pt-4">
      {/* Artist */}
      <div>
        <label className="block text-sm font-medium text-slate-500 mb-1">Artist</label>
        <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">
          {metafields.artist || '-'}
        </div>
      </div>

      {/* Year / Country of Origin */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-500 mb-1">Year</label>
          <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">
            {metafields.year || '-'}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-500 mb-1">Country of Origin</label>
          <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">
            {metafields.countryOfOrigin || '-'}
          </div>
        </div>
      </div>

      {/* Height / Width */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-500 mb-1">Height (in)</label>
          <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">
            {metafields.height ? `${metafields.height} in` : '-'}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-500 mb-1">Width (in)</label>
          <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">
            {metafields.width ? `${metafields.width} in` : '-'}
          </div>
        </div>
      </div>

      {/* Condition / Condition Details */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-500 mb-1">Condition</label>
          <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">
            {metafields.condition || '-'}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-500 mb-1">Condition Details</label>
          <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 min-h-[60px] whitespace-pre-wrap">
            {metafields.conditionDetails || '-'}
          </div>
        </div>
      </div>
    </div>
  );
}
