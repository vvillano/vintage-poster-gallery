'use client';

import type { IndexPagination } from '@/types/product-index';

interface ProductIndexPaginationProps {
  pagination: IndexPagination;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export default function ProductIndexPagination({ pagination, onPageChange, onPageSizeChange }: ProductIndexPaginationProps) {
  const { page, pageSize, totalResults, totalPages } = pagination;

  const start = totalResults === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalResults);

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="text-xs text-slate-500">
          {totalResults > 0 ? `${start}-${end} of ${totalResults.toLocaleString()}` : 'No results'}
        </span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(parseInt(e.target.value))}
          className="px-2 py-1 border border-slate-300 rounded text-xs bg-white text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
        >
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="px-2.5 py-1 border border-slate-300 rounded text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          Prev
        </button>

        {/* Page numbers */}
        {totalPages <= 7 ? (
          // Show all pages if 7 or fewer
          Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`px-2.5 py-1 border rounded text-xs font-medium transition ${
                p === page
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {p}
            </button>
          ))
        ) : (
          // Show abbreviated page numbers
          <>
            {page > 2 && (
              <button
                onClick={() => onPageChange(1)}
                className="px-2.5 py-1 border border-slate-300 rounded text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                1
              </button>
            )}
            {page > 3 && <span className="text-xs text-slate-400 px-1">...</span>}
            {page > 1 && (
              <button
                onClick={() => onPageChange(page - 1)}
                className="px-2.5 py-1 border border-slate-300 rounded text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                {page - 1}
              </button>
            )}
            <button className="px-2.5 py-1 border border-blue-500 bg-blue-50 rounded text-xs font-medium text-blue-700">
              {page}
            </button>
            {page < totalPages && (
              <button
                onClick={() => onPageChange(page + 1)}
                className="px-2.5 py-1 border border-slate-300 rounded text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                {page + 1}
              </button>
            )}
            {page < totalPages - 2 && <span className="text-xs text-slate-400 px-1">...</span>}
            {page < totalPages - 1 && (
              <button
                onClick={() => onPageChange(totalPages)}
                className="px-2.5 py-1 border border-slate-300 rounded text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                {totalPages}
              </button>
            )}
          </>
        )}

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="px-2.5 py-1 border border-slate-300 rounded text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          Next
        </button>
      </div>
    </div>
  );
}
