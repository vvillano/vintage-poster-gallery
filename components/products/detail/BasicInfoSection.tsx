'use client';

import { useState } from 'react';

interface InternalTagOption {
  name: string;
  color: string;
}

export default function BasicInfoSection({
  title,
  productType,
  status,
  handle,
  sku,
  location,
  internalNotes,
  categoryName,
  salesChannels,
  locationOptions,
  productTypeOptions,
  selectedInternalTags,
  unmatchedInternalTags,
  internalTagOptions,
  savingInternalTag,
  onChange,
  onInternalTagsChange,
  onSalesChannelToggle,
}: {
  title: string;
  productType: string;
  status: string;
  handle: string;
  sku: string;
  location: string;
  internalNotes: string;
  categoryName: string | null;
  salesChannels: { id: string; name: string; published: boolean }[];
  locationOptions: string[];
  productTypeOptions: string[];
  selectedInternalTags: string[];
  unmatchedInternalTags: string[];
  internalTagOptions: InternalTagOption[];
  savingInternalTag?: string | null;
  onChange: (field: string, value: string) => void;
  onInternalTagsChange: (tags: string[], toggledTag?: string) => void;
  onSalesChannelToggle: (publicationId: string, publish: boolean) => Promise<void>;
}) {
  const selectedSet = new Set(selectedInternalTags.map((t) => t.toLowerCase()));
  return (
    <div className="grid gap-4 pt-4">
      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => onChange('title', e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
        />
      </div>

      {/* Location / Status / Product Type */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
          <select
            value={location}
            onChange={(e) => onChange('location', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm bg-white"
          >
            <option value="">-- Select --</option>
            {locationOptions.map((loc) => (
              <option key={loc} value={loc}>{loc}</option>
            ))}
            {location && !locationOptions.includes(location) && (
              <option value={location}>{location}</option>
            )}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
          <select
            value={status}
            onChange={(e) => onChange('status', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm bg-white"
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Product Type</label>
          <select
            value={productType}
            onChange={(e) => onChange('productType', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm bg-white"
          >
            <option value="">-- Select --</option>
            {productTypeOptions.map((pt) => (
              <option key={pt} value={pt}>{pt}</option>
            ))}
            {productType && !productTypeOptions.includes(productType) && (
              <option value={productType}>{productType}</option>
            )}
          </select>
        </div>
      </div>

      {/* SKU / Handle */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">SKU</label>
          <input
            type="text"
            value={sku}
            onChange={(e) => onChange('sku', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm font-mono"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-500 mb-1">Handle</label>
          <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">
            {handle || '-'}
          </div>
        </div>
      </div>

      {/* Sales Channels */}
      <SalesChannelsField
        salesChannels={salesChannels}
        productStatus={status}
        onToggle={onSalesChannelToggle}
      />

      {/* Internal Notes */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Internal Notes</label>
        <textarea
          value={internalNotes}
          onChange={(e) => onChange('internalNotes', e.target.value)}
          placeholder="Add internal notes..."
          rows={3}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm resize-y"
        />
      </div>

      {/* Internal Tags (immediate-apply) */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Internal Tags</label>
        <div className="px-3 py-2 border border-slate-200 rounded-lg min-h-[38px] flex items-center flex-wrap gap-1.5">
          {internalTagOptions.map((tag) => {
            const isSelected = selectedSet.has(tag.name.toLowerCase());
            const isSaving = savingInternalTag === tag.name;
            return (
              <button
                key={tag.name}
                type="button"
                disabled={savingInternalTag !== null}
                onClick={() => {
                  const next = isSelected
                    ? selectedInternalTags.filter((t) => t.toLowerCase() !== tag.name.toLowerCase())
                    : [...selectedInternalTags, tag.name];
                  onInternalTagsChange(next, tag.name);
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                } ${isSaving ? 'opacity-50' : ''}`}
              >
                {tag.name}
                {isSaving && (
                  <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}
              </button>
            );
          })}
          {unmatchedInternalTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium text-white bg-slate-400"
              title="Not in managed list"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Shopify Category */}
      <div>
        <label className="block text-sm font-medium text-slate-500 mb-1">Shopify Category</label>
        <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">
          {categoryName || <span className="text-slate-400">Not categorized</span>}
        </div>
      </div>
    </div>
  );
}

function SalesChannelsField({
  salesChannels,
  onToggle,
}: {
  salesChannels: { id: string; name: string; published: boolean }[];
  productStatus: string;
  onToggle: (publicationId: string, publish: boolean) => Promise<void>;
}) {
  const [toggling, setToggling] = useState<string | null>(null);

  async function handleToggle(ch: { id: string; name: string; published: boolean }) {
    setToggling(ch.id);
    try {
      await onToggle(ch.id, !ch.published);
    } finally {
      setToggling(null);
    }
  }

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        Sales Channels
        {salesChannels.length > 0 && (
          <span className="ml-2 text-xs font-normal text-slate-500">
            ({salesChannels.filter(c => c.published).length} of {salesChannels.length} active)
          </span>
        )}
      </label>
      <div className="px-3 py-2 border border-slate-200 rounded-lg text-sm">
        {salesChannels.length === 0 ? (
          <span className="text-slate-400">No sales channels</span>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {salesChannels.map((ch) => (
              <button
                key={ch.id}
                type="button"
                disabled={toggling !== null}
                onClick={() => handleToggle(ch)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                  ch.published
                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                    : 'bg-slate-200 text-slate-500 hover:bg-slate-300'
                } ${toggling === ch.id ? 'opacity-50' : ''}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${ch.published ? 'bg-green-500' : 'bg-slate-400'}`} />
                {ch.name}
                {toggling === ch.id && (
                  <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
