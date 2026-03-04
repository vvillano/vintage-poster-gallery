'use client';

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
  onChange,
  onInternalTagsChange,
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
  onChange: (field: string, value: string) => void;
  onInternalTagsChange: (tags: string[]) => void;
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
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Sales Channels
          {salesChannels.length > 0 && (
            <span className="ml-2 text-xs font-normal text-slate-500">
              ({salesChannels.filter(c => c.published).length} of {salesChannels.length} active)
            </span>
          )}
        </label>
        <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm">
          {salesChannels.length === 0 ? (
            <span className="text-slate-400">No sales channels</span>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {salesChannels.map((ch) => (
                <span
                  key={ch.id}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium ${
                    ch.published
                      ? 'bg-green-100 text-green-700'
                      : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${ch.published ? 'bg-green-500' : 'bg-slate-400'}`} />
                  {ch.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

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

      {/* Internal Tags */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Internal Tags</label>
        <div className="px-3 py-2 border border-slate-200 rounded-lg min-h-[38px] flex items-center flex-wrap gap-1.5">
          {internalTagOptions.map((tag) => {
            const isSelected = selectedSet.has(tag.name.toLowerCase());
            return (
              <button
                key={tag.name}
                type="button"
                onClick={() => {
                  const next = isSelected
                    ? selectedInternalTags.filter((t) => t.toLowerCase() !== tag.name.toLowerCase())
                    : [...selectedInternalTags, tag.name];
                  onInternalTagsChange(next);
                }}
                className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {tag.name}
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
