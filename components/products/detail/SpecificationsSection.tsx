'use client';

import { useMemo } from 'react';
import type { ProductMetafields } from '@/types/shopify-product-detail';

interface SpecificationsSectionProps {
  metafields: ProductMetafields;
  colors: string[];
  medium: string[];
  colorOptions: { name: string; hexCode: string | null }[];
  mediumOptions: { name: string }[];
  suggestedColors?: string[];
  suggestingColors?: boolean;
  onColorsChange: (colors: string[]) => void;
  onMediumChange: (medium: string[]) => void;
}

function getContrastTextColor(hexColor: string | null): string {
  if (!hexColor) return 'text-slate-700';
  const hex = hexColor.replace('#', '');
  if (hex.length !== 6) return 'text-slate-700';
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? 'text-slate-900' : 'text-white';
}

export default function SpecificationsSection({
  metafields,
  colors,
  medium,
  colorOptions,
  mediumOptions,
  suggestedColors = [],
  suggestingColors = false,
  onColorsChange,
  onMediumChange,
}: SpecificationsSectionProps) {
  const managedColorNames = useMemo(
    () => new Set(colorOptions.map((c) => c.name.toLowerCase())),
    [colorOptions]
  );
  const selectedColorSet = useMemo(
    () => new Set(colors.map((c) => c.toLowerCase())),
    [colors]
  );
  const suggestedColorSet = useMemo(
    () => new Set(suggestedColors.map((c) => c.toLowerCase())),
    [suggestedColors]
  );
  const unmatchedColors = useMemo(
    () => colors.filter((c) => !managedColorNames.has(c.toLowerCase())),
    [colors, managedColorNames]
  );

  const managedMediumNames = useMemo(
    () => new Set(mediumOptions.map((m) => m.name.toLowerCase())),
    [mediumOptions]
  );
  const selectedMediumSet = useMemo(
    () => new Set(medium.map((m) => m.toLowerCase())),
    [medium]
  );
  const unmatchedMedium = useMemo(
    () => medium.filter((m) => !managedMediumNames.has(m.toLowerCase())),
    [medium, managedMediumNames]
  );

  function toggleColor(colorName: string) {
    const isSelected = selectedColorSet.has(colorName.toLowerCase());
    if (isSelected) {
      onColorsChange(colors.filter((c) => c.toLowerCase() !== colorName.toLowerCase()));
    } else {
      onColorsChange([...colors, colorName]);
    }
  }

  function toggleMedium(mediumName: string) {
    const isSelected = selectedMediumSet.has(mediumName.toLowerCase());
    if (isSelected) {
      onMediumChange(medium.filter((m) => m.toLowerCase() !== mediumName.toLowerCase()));
    } else {
      onMediumChange([...medium, mediumName]);
    }
  }

  return (
    <div className="grid gap-4 pt-4">
      {/* Artist */}
      <div>
        <label className="block text-sm font-medium text-slate-500 mb-1">Artist</label>
        <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">
          {metafields.artist || '-'}
        </div>
      </div>

      {/* Year / Country of Origin */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-500 mb-1">Year</label>
          <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">
            {metafields.year || '-'}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-500 mb-1">Country of Origin</label>
          <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">
            {metafields.countryOfOrigin || '-'}
          </div>
        </div>
      </div>

      {/* Height / Width */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-500 mb-1">Height (in)</label>
          <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">
            {metafields.height ? `${metafields.height} in` : '-'}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-500 mb-1">Width (in)</label>
          <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">
            {metafields.width ? `${metafields.width} in` : '-'}
          </div>
        </div>
      </div>

      {/* Condition / Condition Details */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-500 mb-1">Condition</label>
          <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">
            {metafields.condition || '-'}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-500 mb-1">Condition Details</label>
          <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 min-h-[60px] whitespace-pre-wrap">
            {metafields.conditionDetails || '-'}
          </div>
        </div>
      </div>

      {/* Colors (interactive) */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <label className="block text-sm font-medium text-slate-700">Colors</label>
          {colors.length > 0 && (
            <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
              {colors.length}
            </span>
          )}
        </div>

        {/* AI Suggested colors */}
        {suggestingColors && (
          <div className="flex items-center gap-2 mb-2 text-xs text-amber-700">
            <div className="inline-block animate-spin rounded-full h-3 w-3 border-b-2 border-amber-600"></div>
            Detecting colors from image...
          </div>
        )}
        {!suggestingColors && suggestedColors.length > 0 && (
          <div className="mb-2">
            <div className="text-xs text-amber-700 font-medium mb-1">AI Suggested</div>
            <div className="flex flex-wrap gap-1.5">
              {suggestedColors.map((colorName) => {
                const opt = colorOptions.find((c) => c.name.toLowerCase() === colorName.toLowerCase());
                const isSelected = selectedColorSet.has(colorName.toLowerCase());
                const textColor = opt?.hexCode ? getContrastTextColor(opt.hexCode) : 'text-slate-700';
                return (
                  <button
                    key={`suggested-${colorName}`}
                    type="button"
                    onClick={() => toggleColor(opt?.name || colorName)}
                    className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-medium transition-all cursor-pointer border-2 ${
                      isSelected
                        ? 'ring-2 ring-blue-400 border-blue-500'
                        : 'border-amber-400'
                    } ${textColor}`}
                    style={{ backgroundColor: opt?.hexCode || '#f1f5f9' }}
                  >
                    {colorName}
                    {isSelected && <span className="ml-1">&#10003;</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          {unmatchedColors.map((c) => (
            <span
              key={`locked-${c}`}
              className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium text-white bg-slate-400"
              title="Shopify color (not in managed list)"
            >
              {c}
            </span>
          ))}
          {colorOptions.map((opt) => {
            const isSelected = selectedColorSet.has(opt.name.toLowerCase());
            const isSuggested = suggestedColorSet.has(opt.name.toLowerCase());
            const textColor = opt.hexCode ? getContrastTextColor(opt.hexCode) : 'text-slate-700';
            return (
              <button
                key={opt.name}
                type="button"
                onClick={() => toggleColor(opt.name)}
                className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-medium transition-all cursor-pointer border-2 ${
                  isSelected
                    ? 'ring-2 ring-blue-400 border-blue-500'
                    : isSuggested
                      ? 'border-amber-400'
                      : 'border-transparent'
                } ${textColor}`}
                style={{ backgroundColor: opt.hexCode || '#f1f5f9' }}
              >
                {opt.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Medium / Technique (interactive) */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <label className="block text-sm font-medium text-slate-700">Medium / Technique</label>
          {medium.length > 0 && (
            <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
              {medium.length}
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {unmatchedMedium.map((m) => (
            <span
              key={`locked-${m}`}
              className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium text-white bg-slate-400"
              title="Shopify medium (not in managed list)"
            >
              {m}
            </span>
          ))}
          {mediumOptions.map((opt) => {
            const isSelected = selectedMediumSet.has(opt.name.toLowerCase());
            return (
              <button
                key={opt.name}
                type="button"
                onClick={() => toggleMedium(opt.name)}
                className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {opt.name}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
