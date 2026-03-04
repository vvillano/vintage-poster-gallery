'use client';

import { useState, useMemo } from 'react';

interface SubjectTaggingSectionProps {
  tags: string[];
  tagOptions: { name: string }[];
  suggestedTags?: string[];
  autoTags?: string[];
  onTagsChange: (tags: string[]) => void;
}

export default function SubjectTaggingSection({
  tags,
  tagOptions,
  suggestedTags = [],
  autoTags = [],
  onTagsChange,
}: SubjectTaggingSectionProps) {
  const [tagSearch, setTagSearch] = useState('');

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
  const autoTagSet = useMemo(
    () => new Set(autoTags.map((t) => t.toLowerCase())),
    [autoTags]
  );
  const unmatchedTags = useMemo(
    () => tags.filter((t) => !managedTagNames.has(t.toLowerCase()) && !autoTagSet.has(t.toLowerCase())),
    [tags, managedTagNames, autoTagSet]
  );
  const filteredTagOptions = useMemo(() => {
    if (!tagSearch.trim()) return tagOptions;
    const q = tagSearch.toLowerCase();
    return tagOptions.filter((t) => t.name.toLowerCase().includes(q));
  }, [tagOptions, tagSearch]);

  function toggleTag(tagName: string) {
    const isSelected = selectedTagSet.has(tagName.toLowerCase());
    if (isSelected) {
      onTagsChange(tags.filter((t) => t.toLowerCase() !== tagName.toLowerCase()));
    } else {
      onTagsChange([...tags, tagName]);
    }
  }

  return (
    <div className="pt-4 space-y-4">
      {/* Auto Tags (size + date) */}
      {autoTags.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <label className="text-xs font-medium text-emerald-700 uppercase tracking-wide">Auto Tags</label>
            <span className="text-xs text-emerald-600 font-normal">(applied from dimensions & date)</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {autoTags.map((tag) => {
              const isSelected = selectedTagSet.has(tag.toLowerCase());
              return (
                <span
                  key={`auto-${tag}`}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium ${
                    isSelected
                      ? 'bg-emerald-600 text-white'
                      : 'bg-emerald-50 border border-emerald-300 text-emerald-700'
                  }`}
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  {tag}
                  {isSelected && <span>&#10003;</span>}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Subject Tags */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <label className="text-sm font-medium text-slate-700">Tags</label>
          {tags.length > 0 && (
            <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
              {tags.length}
            </span>
          )}
        </div>

        <input
          type="text"
          value={tagSearch}
          onChange={(e) => setTagSearch(e.target.value)}
          placeholder="Filter tags..."
          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm mb-2 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />

        <div className="flex flex-wrap gap-1.5">
          {unmatchedTags.map((tag) => (
            <span
              key={`locked-${tag}`}
              className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium text-white bg-slate-400"
              title="Shopify tag (not in managed list)"
            >
              {tag}
            </span>
          ))}

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
    </div>
  );
}
