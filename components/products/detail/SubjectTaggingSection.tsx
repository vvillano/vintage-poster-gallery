'use client';

import { useState, useMemo } from 'react';

interface SubjectTaggingSectionProps {
  tags: string[];
  colors: string[];
  medium: string[];
  tagOptions: { name: string }[];
  colorOptions: { name: string; hexCode: string | null }[];
  mediumOptions: { name: string }[];
  suggestedTags?: string[];
  suggestedColors?: string[];
  suggestingColors?: boolean;
  onTagsChange: (tags: string[]) => void;
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

export default function SubjectTaggingSection({
  tags,
  colors,
  medium,
  tagOptions,
  colorOptions,
  mediumOptions,
  suggestedTags = [],
  suggestedColors = [],
  suggestingColors = false,
  onTagsChange,
  onColorsChange,
  onMediumChange,
}: SubjectTaggingSectionProps) {
  const [tagSearch, setTagSearch] = useState('');

  // Tags: compute managed vs Shopify-only
  const managedTagNames = useMemo(
    () => new Set(tagOptions.map((t) => t.name.toLowerCase())),
    [tagOptions]
  );
  const selectedTagSet = useMemo(
    () => new Set(tags.map((t) => t.toLowerCase())),
    [tags]
  );
  const suggestedTagSet = useMemo(
    () => new Set(suggestedTags.map((t) => t.toLowerCase())),
    [suggestedTags]
  );
  const unmatchedTags = useMemo(
    () => tags.filter((t) => !managedTagNames.has(t.toLowerCase())),
    [tags, managedTagNames]
  );
  const filteredTagOptions = useMemo(() => {
    if (!tagSearch.trim()) return tagOptions;
    const q = tagSearch.toLowerCase();
    return tagOptions.filter((t) => t.name.toLowerCase().includes(q));
  }, [tagOptions, tagSearch]);

  // Colors: compute managed vs unmatched
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

  // Medium: compute managed vs unmatched
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

  function toggleTag(tagName: string) {
    const isSelected = selectedTagSet.has(tagName.toLowerCase());
    if (isSelected) {
      onTagsChange(tags.filter((t) => t.toLowerCase() !== tagName.toLowerCase()));
    } else {
      onTagsChange([...tags, tagName]);
    }
  }

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
    <div className="pt-4 space-y-0">
      {/* Tags */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <label className="text-sm font-medium text-slate-700">Tags</label>
          {tags.length > 0 && (
            <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
              {tags.length}
            </span>
          )}
        </div>

        {/* Search filter */}
        <input
          type="text"
          value={tagSearch}
          onChange={(e) => setTagSearch(e.target.value)}
          placeholder="Filter tags..."
          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm mb-2 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />

        <div className="flex flex-wrap gap-1.5">
          {/* Shopify-only locked tags */}
          {unmatchedTags.map((tag) => (
            <span
              key={`locked-${tag}`}
              className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium text-white bg-slate-400"
              title="Shopify tag (not in managed list)"
            >
              {tag}
            </span>
          ))}

          {/* Managed list tags */}
          {filteredTagOptions.map((opt) => {
            const isSelected = selectedTagSet.has(opt.name.toLowerCase());
            const isSuggested = suggestedTagSet.has(opt.name.toLowerCase());
            return (
              <button
                key={opt.name}
                type="button"
                onClick={() => toggleTag(opt.name)}
                className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-blue-600 text-white'
                    : isSuggested
                      ? 'bg-amber-50 border border-amber-300 text-amber-800 hover:bg-amber-100'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {opt.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-t border-slate-100 my-4" />

      {/* Colors */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <label className="text-sm font-medium text-slate-700">Colors</label>
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
          {/* Unmatched colors */}
          {unmatchedColors.map((c) => (
            <span
              key={`locked-${c}`}
              className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium text-white bg-slate-400"
              title="Shopify color (not in managed list)"
            >
              {c}
            </span>
          ))}

          {/* Managed list colors */}
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

      <div className="border-t border-slate-100 my-4" />

      {/* Medium / Technique */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <label className="text-sm font-medium text-slate-700">Medium / Technique</label>
          {medium.length > 0 && (
            <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
              {medium.length}
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {/* Unmatched medium */}
          {unmatchedMedium.map((m) => (
            <span
              key={`locked-${m}`}
              className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium text-white bg-slate-400"
              title="Shopify medium (not in managed list)"
            >
              {m}
            </span>
          ))}

          {/* Managed list medium */}
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
