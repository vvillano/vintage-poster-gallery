'use client';

export default function DescriptionSection({
  bodyHtml,
  onChange,
}: {
  bodyHtml: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="pt-4">
      <label className="block text-sm font-medium text-slate-700 mb-1">Description (HTML)</label>
      <textarea
        value={bodyHtml}
        onChange={(e) => onChange(e.target.value)}
        rows={10}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm font-mono"
        placeholder="Enter product description HTML..."
      />
    </div>
  );
}
