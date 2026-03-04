'use client';

import { useState, useMemo } from 'react';

interface SubjectTaggingSectionProps {
  tags: string[];
  tagOptions: { name: string }[];
  suggestedTags?: string[];
  onTagsChange: (tags: string[]) => void;
}

export default function SubjectTaggingSection({
  tags,
  tagOptions,
  suggestedTags = [],
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
  const unmatchedTags = useMemo(
    () => tags.filter((t) => !managedTagNames.has(t.toLowerCase())),
    [tags, managedTagNames]
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
    <div className="pt-4">
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
  );
}
