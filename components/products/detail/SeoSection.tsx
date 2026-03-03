'use client';

export default function SeoSection({
  seoTitle,
  seoDescription,
}: {
  seoTitle: string | null;
  seoDescription: string | null;
}) {
  return (
    <div className="grid gap-3 pt-4">
      <div>
        <label className="block text-sm font-medium text-slate-500 mb-1">SEO Title</label>
        <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">
          {seoTitle || '-'}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-500 mb-1">SEO Description</label>
        <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 min-h-[60px]">
          {seoDescription || '-'}
        </div>
      </div>
    </div>
  );
}
