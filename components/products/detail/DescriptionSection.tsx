'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import type { ProductDetail } from '@/types/shopify-product-detail';

// Dynamic import to avoid SSR issues with TipTap
const RichTextEditor = dynamic(() => import('./RichTextEditor'), {
  ssr: false,
  loading: () => <div className="border border-slate-300 rounded-lg min-h-[200px] bg-slate-50 animate-pulse" />,
});

const TONES = [
  { key: 'standard', label: 'Standard' },
  { key: 'scholarly', label: 'Scholarly' },
  { key: 'concise', label: 'Concise' },
  { key: 'enthusiastic', label: 'Enthusiastic' },
  { key: 'immersive', label: 'Immersive' },
] as const;

function convertToHtmlParagraphs(text: string): string {
  return text
    .split(/\n\n+/)
    .filter((p) => p.trim())
    .map((p) => `<p>${p.trim()}</p>`)
    .join('\n');
}

export default function DescriptionSection({
  bodyHtml,
  onChange,
  product,
}: {
  bodyHtml: string;
  onChange: (value: string) => void;
  product?: ProductDetail;
}) {
  const [showHtml, setShowHtml] = useState(false);
  const descriptions = product?.linkedPoster?.productDescriptions;

  function handleToneClick(toneKey: string) {
    if (!descriptions) return;
    const text = descriptions[toneKey as keyof typeof descriptions];
    if (!text) return;

    if (bodyHtml && bodyHtml.trim().length > 0) {
      if (!window.confirm(`Replace current description with the ${toneKey} version?`)) return;
    }

    onChange(convertToHtmlParagraphs(text));
  }

  return (
    <div className="pt-4 space-y-2">
      {/* AI Tone Selector */}
      {descriptions && (
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">Apply AI Description</label>
          <div className="flex flex-wrap gap-1.5">
            {TONES.map((tone) => {
              const hasContent = !!descriptions[tone.key as keyof typeof descriptions];
              return (
                <button
                  key={tone.key}
                  type="button"
                  onClick={() => handleToneClick(tone.key)}
                  disabled={!hasContent}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                    hasContent
                      ? 'bg-violet-100 text-violet-700 hover:bg-violet-200'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  {tone.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Editor / HTML Toggle */}
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-slate-700">Description</label>
        <button
          type="button"
          onClick={() => setShowHtml(!showHtml)}
          className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
        >
          {showHtml ? 'Rich Editor' : 'View HTML'}
        </button>
      </div>

      {showHtml ? (
        <textarea
          value={bodyHtml}
          onChange={(e) => onChange(e.target.value)}
          rows={10}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none text-sm font-mono"
          placeholder="Enter product description HTML..."
        />
      ) : (
        <RichTextEditor
          value={bodyHtml}
          onChange={onChange}
          placeholder="Enter product description..."
        />
      )}
    </div>
  );
}
