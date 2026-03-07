'use client';

interface SpecificationsSectionProps {
  height: string;
  width: string;
  condition: string;
  conditionDetails: string;
  conditionOptions: string[];
  onChange: (field: string, value: string) => void;
}

export default function SpecificationsSection({
  height,
  width,
  condition,
  conditionDetails,
  conditionOptions,
  onChange,
}: SpecificationsSectionProps) {
  const inputClass = 'w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm';
  const selectClass = 'w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm bg-white';

  return (
    <div className="grid gap-4 pt-4">
      {/* Height / Width */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Height (in)</label>
          <input
            type="text"
            value={height}
            onChange={(e) => onChange('height', e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Width (in)</label>
          <input
            type="text"
            value={width}
            onChange={(e) => onChange('width', e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      {/* Condition / Condition Details */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Condition</label>
          <select
            value={condition}
            onChange={(e) => onChange('condition', e.target.value)}
            className={selectClass}
          >
            <option value="">-- Select --</option>
            {conditionOptions.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
            {condition && !conditionOptions.includes(condition) && (
              <option value={condition}>{condition}</option>
            )}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Condition Details</label>
          <textarea
            value={conditionDetails}
            onChange={(e) => onChange('conditionDetails', e.target.value)}
            placeholder="Describe condition details..."
            rows={3}
            className={`${inputClass} resize-y`}
          />
        </div>
      </div>
    </div>
  );
}
