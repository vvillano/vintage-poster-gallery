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
  internalTagsMetafield,
  internalTagOptions,
  onChange,
}: {
  title: string;
  productType: string;
  status: string;
  handle: string;
  sku: string;
  location: string | undefined;
  internalNotes: string | undefined;
  internalTagsMetafield: string | undefined;
  internalTagOptions: InternalTagOption[];
  onChange: (field: string, value: string) => void;
}) {
  // Parse internal tags from Shopify metafield (JSON array format: '["INV 2026","Ready to List"]')
  let productInternalTags: string[] = [];
  if (internalTagsMetafield) {
    try {
      const parsed = JSON.parse(internalTagsMetafield);
      if (Array.isArray(parsed)) productInternalTags = parsed;
    } catch {
      productInternalTags = internalTagsMetafield.split(',').map((t) => t.trim()).filter(Boolean);
    }
  }
  // Build a map of internal tag names to colors for quick lookup
  const tagColorMap = new Map(internalTagOptions.map((t) => [t.name.toLowerCase(), t.color]));
  // Match product's internal tags against the managed list for display colors
  const matchedInternalTags = productInternalTags.filter((t) => tagColorMap.has(t.toLowerCase()));
  // Also show any internal tags not in the managed list (with default gray)
  const unmatchedInternalTags = productInternalTags.filter((t) => !tagColorMap.has(t.toLowerCase()));
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
          <label className="block text-sm font-medium text-slate-500 mb-1">Location</label>
          <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">
            {location || '-'}
          </div>
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
          <input
            type="text"
            value={productType}
            onChange={(e) => onChange('productType', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
          />
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
        <label className="block text-sm font-medium text-slate-500 mb-1">Sales Channels</label>
        <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-400 italic">
          Sales channel management coming soon
        </div>
      </div>

      {/* Internal Notes */}
      <div>
        <label className="block text-sm font-medium text-slate-500 mb-1">Internal Notes</label>
        <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 min-h-[60px] whitespace-pre-wrap">
          {internalNotes || '-'}
        </div>
      </div>

      {/* Internal Tags */}
      <div>
        <label className="block text-sm font-medium text-slate-500 mb-1">Internal Tags</label>
        <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg min-h-[38px] flex items-center flex-wrap gap-1.5">
          {productInternalTags.length > 0 ? (
            <>
              {matchedInternalTags.map((tag) => {
                const color = tagColorMap.get(tag.toLowerCase()) || '#6B7280';
                return (
                  <span
                    key={tag}
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white"
                    style={{ backgroundColor: color }}
                  >
                    {tag}
                  </span>
                );
              })}
              {unmatchedInternalTags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white bg-slate-500"
                >
                  {tag}
                </span>
              ))}
            </>
          ) : (
            <span className="text-sm text-slate-400">No internal tags</span>
          )}
        </div>
      </div>

      {/* Shopify Category */}
      <div>
        <label className="block text-sm font-medium text-slate-500 mb-1">Shopify Category</label>
        <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-400 italic">
          Category management coming soon
        </div>
      </div>
    </div>
  );
}
