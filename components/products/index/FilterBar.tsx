'use client';

import { useState } from 'react';
import type { FilterState, FilterOptions } from '@/types/product-index';

interface FilterBarProps {
  filters: FilterState;
  filterOptions: FilterOptions;
  onChange: (filters: FilterState) => void;
}

const EXPANDABLE_FILTERS = ['country', 'tags'] as const;

export default function FilterBar({ filters, filterOptions, onChange }: FilterBarProps) {
  const [showMore, setShowMore] = useState(false);

  function updateFilter(key: keyof FilterState, value: string) {
    onChange({ ...filters, [key]: value });
  }

  function clearFilter(key: keyof FilterState) {
    onChange({ ...filters, [key]: '' });
  }

  // Active filter pills (non-empty, non-status filters)
  const activeFilters = Object.entries(filters).filter(
    ([key, value]) => value && key !== 'status'
  );

  const hasExpandableActive = EXPANDABLE_FILTERS.some((k) => filters[k]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Status filter */}
        <select
          value={filters.status}
          onChange={(e) => updateFilter('status', e.target.value)}
          className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>

        {/* Product Type */}
        <select
          value={filters.productType}
          onChange={(e) => updateFilter('productType', e.target.value)}
          className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
        >
          <option value="">All Types</option>
          {filterOptions.productTypes.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        {/* Artist */}
        <select
          value={filters.artist}
          onChange={(e) => updateFilter('artist', e.target.value)}
          className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none max-w-[180px]"
        >
          <option value="">All Artists</option>
          {filterOptions.artists.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>

        {/* Platform */}
        <select
          value={filters.platform}
          onChange={(e) => updateFilter('platform', e.target.value)}
          className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
        >
          <option value="">All Platforms</option>
          {filterOptions.platforms.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        {/* Image filter */}
        <select
          value={filters.hasImage}
          onChange={(e) => updateFilter('hasImage', e.target.value)}
          className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
        >
          <option value="">All Images</option>
          <option value="yes">With Image</option>
          <option value="no">Without Image</option>
        </select>

        {/* Tag Include (has tag) */}
        {filterOptions.internalTags.length > 0 && (
          <select
            value={filters.tagInclude}
            onChange={(e) => updateFilter('tagInclude', e.target.value)}
            className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          >
            <option value="">Has Tag...</option>
            {filterOptions.internalTags.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        )}

        {/* Tag Exclude (missing tag) */}
        {filterOptions.internalTags.length > 0 && (
          <select
            value={filters.tagExclude}
            onChange={(e) => updateFilter('tagExclude', e.target.value)}
            className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          >
            <option value="">Missing Tag...</option>
            {filterOptions.internalTags.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        )}

        {/* Expandable filters */}
        {(showMore || hasExpandableActive) && (
          <>
            {/* Country */}
            <select
              value={filters.country}
              onChange={(e) => updateFilter('country', e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            >
              <option value="">All Countries</option>
              {filterOptions.countries.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            {/* Tags */}
            <select
              value={filters.tags}
              onChange={(e) => updateFilter('tags', e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none max-w-[180px]"
            >
              <option value="">All Tags</option>
              {filterOptions.tags.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </>
        )}

        {!showMore && !hasExpandableActive && (
          <button
            onClick={() => setShowMore(true)}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            Add filter +
          </button>
        )}
      </div>

      {/* Active filter pills */}
      {activeFilters.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {activeFilters.map(([key, value]) => (
            <span
              key={key}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[11px] font-medium"
            >
              {key === 'productType' ? 'Type' : key === 'hasImage' ? 'Image' : key === 'tagInclude' ? 'Has Tag' : key === 'tagExclude' ? 'Missing Tag' : key}: {key === 'hasImage' ? (value === 'yes' ? 'With Image' : 'Without Image') : value}
              <button
                onClick={() => clearFilter(key as keyof FilterState)}
                className="hover:text-blue-900"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
          <button
            onClick={() => onChange({ status: filters.status, productType: '', artist: '', country: '', platform: '', tags: '', hasImage: '', tagInclude: '', tagExclude: '' })}
            className="text-[11px] text-slate-500 hover:text-slate-700"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
