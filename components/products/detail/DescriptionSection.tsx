'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';

// Dynamic import to avoid SSR issues with TipTap
const RichTextEditor = dynamic(() => import('./RichTextEditor'), {
  ssr: false,
  loading: () => <div className="border border-slate-300 rounded-lg min-h-[200px] bg-slate-50 animate-pulse" />,
});

export default function DescriptionSection({
  bodyHtml,
  onChange,
}: {
  bodyHtml: string;
  onChange: (value: string) => void;
}) {
  const [showHtml, setShowHtml] = useState(false);

  return (
    <div className="pt-4 space-y-2">
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
