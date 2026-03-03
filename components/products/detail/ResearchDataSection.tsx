'use client';

import type { ProductMetafields } from '@/types/shopify-product-detail';

function formatMultiLine(value: string | undefined): string {
  return value || '-';
}

export default function ResearchDataSection({ metafields }: { metafields: ProductMetafields }) {
  return (
    <div className="grid gap-4 pt-4">
      {/* Concise Description */}
      <div>
        <label className="block text-sm font-medium text-slate-500 mb-1">Concise Description</label>
        <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 min-h-[60px] whitespace-pre-wrap">
          {formatMultiLine(metafields.conciseDescription)}
        </div>
      </div>

      {/* Printer / Publisher */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-500 mb-1">Printer</label>
          <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">
            {metafields.printer || '-'}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-500 mb-1">Publisher</label>
          <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">
            {metafields.publisher || '-'}
          </div>
        </div>
      </div>

      {/* Book Title Source / Book Source */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-500 mb-1">Book Title Source</label>
          <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">
            {metafields.bookTitleSource || '-'}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-500 mb-1">Book Source</label>
          <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">
            {metafields.bookSource || '-'}
          </div>
        </div>
      </div>

      {/* Item Notes */}
      <div>
        <label className="block text-sm font-medium text-slate-500 mb-1">Item Notes</label>
        <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 min-h-[60px] whitespace-pre-wrap">
          {formatMultiLine(metafields.itemNotes)}
        </div>
      </div>

      {/* Artist Bio */}
      <div>
        <label className="block text-sm font-medium text-slate-500 mb-1">Artist Bio</label>
        <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 min-h-[60px] whitespace-pre-wrap">
          {formatMultiLine(metafields.artistBio)}
        </div>
      </div>

      {/* Reference Images */}
      <div>
        <label className="block text-sm font-medium text-slate-500 mb-1">Reference Images</label>
        <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">
          {metafields.referenceImages || '-'}
        </div>
      </div>
    </div>
  );
}
