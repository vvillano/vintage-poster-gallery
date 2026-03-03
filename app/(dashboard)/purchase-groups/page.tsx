'use client';

export default function PurchaseGroupsPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Purchase Groups</h1>
        <p className="text-sm text-slate-500 mt-1">
          Organize products by acquisition batch, lot, or purchase event.
        </p>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
        <div className="text-5xl mb-4">📦</div>
        <h2 className="text-lg font-semibold text-slate-700 mb-2">Coming Soon</h2>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          Purchase Groups will let you group products by acquisition event, track lot-level costs,
          and manage bulk purchases. This feature is under development.
        </p>
      </div>
    </div>
  );
}
