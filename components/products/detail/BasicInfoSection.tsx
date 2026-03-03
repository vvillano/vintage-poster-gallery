'use client';

export default function BasicInfoSection({
  title,
  productType,
  status,
  handle,
  onChange,
}: {
  title: string;
  productType: string;
  status: string;
  handle: string;
  onChange: (field: string, value: string) => void;
}) {
  return (
    <div className="grid gap-4 pt-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => onChange('title', e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Product Type</label>
          <input
            type="text"
            value={productType}
            onChange={(e) => onChange('productType', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
          />
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
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-500 mb-1">Handle (read-only)</label>
        <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">
          {handle || '-'}
        </div>
      </div>
    </div>
  );
}
