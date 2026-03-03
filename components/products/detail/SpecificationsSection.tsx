'use client';

import type { ProductMetafields } from '@/types/shopify-product-detail';

function formatArray(value: string | undefined): string[] {
  if (!value) return [];
  if (value.startsWith('[')) {
    try {
      const arr = JSON.parse(value);
      if (Array.isArray(arr)) return arr;
    } catch { /* not JSON */ }
  }
  return [value];
}

export default function SpecificationsSection({ metafields }: { metafields: ProductMetafields }) {
  const colors = formatArray(metafields.color);
  const mediums = formatArray(metafields.medium);

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

      {/* Colors */}
      <div>
        <label className="block text-sm font-medium text-slate-500 mb-1">Colors</label>
        {colors.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {colors.map((color) => (
              <span
                key={color}
                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700"
              >
                {color}
              </span>
            ))}
          </div>
        ) : (
          <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">-</div>
        )}
      </div>

      {/* Medium */}
      <div>
        <label className="block text-sm font-medium text-slate-500 mb-1">Medium</label>
        {mediums.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {mediums.map((m) => (
              <span
                key={m}
                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700"
              >
                {m}
              </span>
            ))}
          </div>
        ) : (
          <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">-</div>
        )}
      </div>
    </div>
  );
}
