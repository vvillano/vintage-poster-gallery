'use client';

import { useState } from 'react';

export default function TagsSection({
  tags,
  onChange,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
}) {
  const [input, setInput] = useState('');

  function handleAdd() {
    const tag = input.trim();
    if (tag && !tags.includes(tag)) {
      onChange([...tags, tag]);
    }
    setInput('');
  }

  function handleRemove(tag: string) {
    onChange(tags.filter((t) => t !== tag));
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  }

  return (
    <div className="pt-4">
      <div className="flex flex-wrap gap-2 mb-3">
        {tags.length === 0 && (
          <span className="text-sm text-slate-400">No tags</span>
        )}
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs font-medium px-2.5 py-1 rounded-full"
          >
            {tag}
            <button
              onClick={() => handleRemove(tag)}
              className="text-blue-400 hover:text-blue-700 ml-0.5"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a tag..."
          className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
        />
        <button
          onClick={handleAdd}
          disabled={!input.trim()}
          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-800 disabled:bg-slate-300 text-white text-sm rounded-lg transition"
        >
          Add
        </button>
      </div>
    </div>
  );
}
