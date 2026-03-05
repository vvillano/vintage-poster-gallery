'use client';

export type ProductTab = 'listing' | 'research' | 'valuation';

interface ProductTabsProps {
  activeTab: ProductTab;
  onTabChange: (tab: ProductTab) => void;
}

const tabs: { id: ProductTab; label: string; activeClass: string }[] = [
  { id: 'listing', label: 'Listing', activeClass: 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' },
  { id: 'research', label: 'Research & Descriptions', activeClass: 'bg-violet-50 text-violet-700 border-b-2 border-violet-600' },
  { id: 'valuation', label: 'Valuation', activeClass: 'bg-green-50 text-green-700 border-b-2 border-green-600' },
];

export default function ProductTabs({ activeTab, onTabChange }: ProductTabsProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-t-lg overflow-hidden">
      <div className="flex">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex-1 px-6 py-3 text-sm font-medium transition flex items-center justify-center gap-2 ${
              activeTab === tab.id
                ? tab.activeClass
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50 border-b-2 border-transparent'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
