'use client';

import { useState } from 'react';

export default function ProductDetailSection({
  title,
  defaultOpen = false,
  badge,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  badge?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-slate-50 transition"
      >
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-slate-900">{title}</h2>
          {badge && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-500 uppercase tracking-wide">
              {badge}
            </span>
          )}
        </div>
        <svg
          className={`w-5 h-5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-5 pb-5 border-t border-slate-100">
          {children}
        </div>
      )}
    </div>
  );
}
