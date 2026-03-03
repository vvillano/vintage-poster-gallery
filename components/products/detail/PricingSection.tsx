'use client';

export default function PricingSection({
  price,
  compareAtPrice,
  sku,
  inventoryQuantity,
  unitCost,
  onChange,
}: {
  price: string;
  compareAtPrice: string;
  sku: string;
  inventoryQuantity: string;
  unitCost: string | null;
  onChange: (field: string, value: string) => void;
}) {
  return (
    <div className="grid gap-4 pt-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Price ($)</label>
          <input
            type="text"
            value={price}
            onChange={(e) => onChange('price', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Compare At ($)</label>
          <input
            type="text"
            value={compareAtPrice}
            onChange={(e) => onChange('compareAtPrice', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
          />
        </div>
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
          <label className="block text-sm font-medium text-slate-700 mb-1">Inventory</label>
          <input
            type="number"
            value={inventoryQuantity}
            onChange={(e) => onChange('inventoryQuantity', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-500 mb-1">Unit Cost (read-only)</label>
          <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">
            {unitCost ? `$${unitCost}` : '-'}
          </div>
        </div>
      </div>
    </div>
  );
}
