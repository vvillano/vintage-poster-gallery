'use client';

import { useState } from 'react';

export type ViewMode = 'grid' | 'table';
export type StatusFilter = 'all' | 'active' | 'draft' | 'archived';

export default function ProductToolbar({
  viewMode,
  statusFilter,
  onSearch,
  onStatusChange,
  onViewModeChange,
  isLoading,
}: {
  viewMode: ViewMode;
  statusFilter: StatusFilter;
  onSearch: (query: string) => void;
  onStatusChange: (status: StatusFilter) => void;
  onViewModeChange: (mode: ViewMode) => void;
  isLoading: boolean;
}) {
  const [searchInput, setSearchInput] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSearch(searchInput.trim());
  }

  function handleClear() {
    setSearchInput('');
    onSearch('');
  }

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
      {/* Search */}
      <form onSubmit={handleSubmit} className="flex gap-2 flex-1 w-full sm:w-auto">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by title..."
          className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
        />
        <button
          type="submit"
          disabled={isLoading}
          className="bg-slate-700 hover:bg-slate-800 disabled:bg-slate-400 text-white px-4 py-2 rounded-lg transition text-sm"
        >
          Search
        </button>
        {searchInput && (
          <button
            type="button"
            onClick={handleClear}
            className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-2 rounded-lg transition text-sm"
          >
            Clear
          </button>
        )}
      </form>

      {/* Status filter */}
      <select
        value={statusFilter}
        onChange={(e) => onStatusChange(e.target.value as StatusFilter)}
        className="text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
      >
        <option value="all">All Statuses</option>
        <option value="active">Active</option>
        <option value="draft">Draft</option>
        <option value="archived">Archived</option>
      </select>

      {/* View toggle */}
      <div className="flex rounded-lg border border-slate-300 overflow-hidden">
        <button
          onClick={() => onViewModeChange('grid')}
          className={`px-3 py-2 text-sm transition ${
            viewMode === 'grid'
              ? 'bg-slate-700 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-50'
          }`}
          title="Grid view"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
        </button>
        <button
          onClick={() => onViewModeChange('table')}
          className={`px-3 py-2 text-sm transition ${
            viewMode === 'table'
              ? 'bg-slate-700 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-50'
          }`}
          title="Table view"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}
