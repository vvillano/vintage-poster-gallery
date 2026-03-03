'use client';

export default function BasicInfoSection({
  title,
  productType,
  status,
  handle,
  sku,
  location,
  internalNotes,
  onChange,
}: {
  title: string;
  productType: string;
  status: string;
  handle: string;
  sku: string;
  location: string | undefined;
  internalNotes: string | undefined;
  onChange: (field: string, value: string) => void;
}) {
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
        <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-400 italic">
          Internal tag management coming soon
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
