'use client';

import { useState, useRef, useEffect } from 'react';
import { COLUMNS, type ColumnKey } from '@/types/product-index';

interface ColumnPickerProps {
  enabledColumns: Set<ColumnKey>;
  onChange: (columns: Set<ColumnKey>) => void;
}

export default function ColumnPicker({ enabledColumns, onChange }: ColumnPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleableColumns = COLUMNS.filter((c) => !c.alwaysVisible);

  function toggleColumn(key: ColumnKey) {
    const next = new Set(enabledColumns);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    onChange(next);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
        </svg>
        Enabled Fields
        <svg className={`w-3 h-3 transition ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-52 bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-1 max-h-80 overflow-y-auto">
          {toggleableColumns.map((col) => (
            <label
              key={col.key}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer text-xs text-slate-700"
            >
              <input
                type="checkbox"
                checked={enabledColumns.has(col.key)}
                onChange={() => toggleColumn(col.key)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              {col.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
