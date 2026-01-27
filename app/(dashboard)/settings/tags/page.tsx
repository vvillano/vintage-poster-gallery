'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { Tag } from '@/types/poster';

export default function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [newTagName, setNewTagName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deleting, setDeleting] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchTags();
  }, []);

  async function fetchTags() {
    try {
      setError('');
      const res = await fetch('/api/tags');
      if (!res.ok) throw new Error('Failed to fetch tags');
      const data = await res.json();
      setTags(data.tags);
    } catch (err) {
      setError('Failed to load tags');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddTag(e: React.FormEvent) {
    e.preventDefault();
    if (!newTagName.trim()) return;

    try {
      setAdding(true);
      setError('');
      setSuccess('');

      const res = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTagName.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add tag');
      }

      setNewTagName('');
      setSuccess(`Tag "${newTagName.trim()}" added successfully`);
      fetchTags();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add tag');
    } finally {
      setAdding(false);
    }
  }

  async function handleDeleteTag(tag: Tag) {
    if (!confirm(`Are you sure you want to delete the tag "${tag.name}"?`)) {
      return;
    }

    try {
      setDeleting(tag.id);
      setError('');
      setSuccess('');

      const res = await fetch(`/api/tags/${tag.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete tag');
      }

      setSuccess(`Tag "${tag.name}" deleted`);
      fetchTags();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete tag');
    } finally {
      setDeleting(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Manage Tags</h1>
          <p className="text-sm text-slate-500 mt-1">
            Add or remove tags used for categorizing items. These tags are suggested by AI during analysis.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="text-sm text-slate-600 hover:text-slate-900"
        >
          Back to Dashboard
        </Link>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
          {success}
        </div>
      )}

      {/* Add Tag Form */}
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <h2 className="text-lg font-semibold text-slate-900 mb-3">Add New Tag</h2>
        <form onSubmit={handleAddTag} className="flex gap-3">
          <input
            type="text"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            placeholder="Enter tag name..."
            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            disabled={adding}
          />
          <button
            type="submit"
            disabled={adding || !newTagName.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition"
          >
            {adding ? 'Adding...' : 'Add Tag'}
          </button>
        </form>
      </div>

      {/* Tag List */}
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">All Tags</h2>
          <span className="text-sm text-slate-500">{tags.length} tags</span>
        </div>

        {tags.length === 0 ? (
          <p className="text-slate-500 text-center py-8">
            No tags yet. Add your first tag above.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <div
                key={tag.id}
                className="group inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-full text-sm hover:bg-slate-200 transition"
              >
                <span>{tag.name}</span>
                <button
                  onClick={() => handleDeleteTag(tag)}
                  disabled={deleting === tag.id}
                  className="ml-1 w-4 h-4 flex items-center justify-center rounded-full text-slate-400 hover:text-red-600 hover:bg-red-100 transition opacity-0 group-hover:opacity-100 disabled:opacity-50"
                  title={`Delete "${tag.name}"`}
                >
                  {deleting === tag.id ? (
                    <span className="animate-spin">...</span>
                  ) : (
                    <span className="text-xs font-bold">x</span>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Usage Info */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <h3 className="font-semibold text-amber-800 mb-2">How Tags Work</h3>
        <ul className="text-sm text-amber-700 space-y-1">
          <li>- When you analyze a poster, AI will suggest relevant tags from this list</li>
          <li>- You can select or deselect suggested tags on each poster's detail page</li>
          <li>- You can also manually add any tag from this list to any poster</li>
          <li>- Tags help categorize items for your Shopify integration</li>
        </ul>
      </div>
    </div>
  );
}
