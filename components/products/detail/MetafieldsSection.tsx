'use client';

import type { ProductMetafields } from '@/types/shopify-product-detail';

const METAFIELD_LABELS: { key: keyof ProductMetafields; label: string; group: string }[] = [
  { key: 'artist', label: 'Artist', group: 'Research' },
  { key: 'year', label: 'Year', group: 'Research' },
  { key: 'condition', label: 'Condition', group: 'Research' },
  { key: 'conditionDetails', label: 'Condition Details', group: 'Research' },
  { key: 'color', label: 'Colors', group: 'Research' },
  { key: 'medium', label: 'Medium', group: 'Research' },
  { key: 'countryOfOrigin', label: 'Country of Origin', group: 'Research' },
  { key: 'height', label: 'Height', group: 'Dimensions' },
  { key: 'width', label: 'Width', group: 'Dimensions' },
  { key: 'conciseDescription', label: 'Concise Description', group: 'Content' },
  { key: 'printer', label: 'Printer', group: 'Content' },
  { key: 'publisher', label: 'Publisher', group: 'Content' },
  { key: 'bookTitleSource', label: 'Book/Source', group: 'Content' },
  { key: 'artistBio', label: 'Artist Bio', group: 'Content' },
  { key: 'location', label: 'Location', group: 'Tracking' },
  { key: 'internalNotes', label: 'Internal Notes', group: 'Tracking' },
  { key: 'itemNotes', label: 'Item Notes', group: 'Tracking' },
  { key: 'restorationCandidate', label: 'Restoration Candidate', group: 'Tracking' },
];

function formatValue(value: string | undefined): string {
  if (!value) return '-';
  // Try to format JSON arrays nicely
  if (value.startsWith('[')) {
    try {
      const arr = JSON.parse(value);
      if (Array.isArray(arr)) return arr.join(', ');
    } catch { /* not JSON */ }
  }
  // Try to format JSON objects
  if (value.startsWith('{')) {
    try {
      const obj = JSON.parse(value);
      if (obj.amount) return `$${obj.amount}`;
      return JSON.stringify(obj);
    } catch { /* not JSON */ }
  }
  return value;
}

export default function MetafieldsSection({ metafields }: { metafields: ProductMetafields }) {
  const groups = METAFIELD_LABELS.reduce((acc, item) => {
    if (!acc[item.group]) acc[item.group] = [];
    acc[item.group].push(item);
    return acc;
  }, {} as Record<string, typeof METAFIELD_LABELS>);

  return (
    <div className="pt-4 space-y-4">
      {Object.entries(groups).map(([groupName, fields]) => (
        <div key={groupName}>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">{groupName}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
            {fields.map(({ key, label }) => (
              <div key={key} className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-sm text-slate-500">{label}</span>
                <span className="text-sm text-slate-800 text-right max-w-[60%] truncate">
                  {formatValue(metafields[key])}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
