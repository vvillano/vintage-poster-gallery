'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface ListItem {
  id: number;
  name: string;
  displayOrder?: number;
  color?: string;
  code?: string;
  description?: string;
  urlTemplate?: string;
  aliases?: string[];
  nationality?: string;
  birthYear?: number;
  deathYear?: number;
  notes?: string;
  // Artist profile fields
  wikipediaUrl?: string;
  bio?: string;
  imageUrl?: string;
  verified?: boolean;
  // Printer fields
  location?: string;
  country?: string;
  foundedYear?: number;
  closedYear?: number;
  // Publisher fields
  publicationType?: string;
  ceasedYear?: number;
}

interface ListConfig {
  key: string;
  label: string;
  description: string;
  fields: {
    key: string;
    label: string;
    type: 'text' | 'number' | 'color' | 'textarea' | 'aliases' | 'url' | 'checkbox';
    required?: boolean;
    placeholder?: string;
  }[];
}

const LIST_CONFIGS: ListConfig[] = [
  {
    key: 'media-types',
    label: 'Media Types',
    description: 'Printing techniques and media (lithograph, screen print, etc.)',
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'displayOrder', label: 'Display Order', type: 'number' },
    ],
  },
  {
    key: 'artists',
    label: 'Artists',
    description: 'Artist names with aliases for matching',
    fields: [
      { key: 'name', label: 'Canonical Name', type: 'text', required: true },
      { key: 'aliases', label: 'Aliases', type: 'aliases' },
      { key: 'nationality', label: 'Nationality', type: 'text' },
      { key: 'birthYear', label: 'Birth Year', type: 'number' },
      { key: 'deathYear', label: 'Death Year', type: 'number' },
      { key: 'wikipediaUrl', label: 'Wikipedia URL', type: 'url', placeholder: 'https://en.wikipedia.org/wiki/...' },
      { key: 'bio', label: 'Biography', type: 'textarea' },
      { key: 'imageUrl', label: 'Image URL', type: 'url', placeholder: 'https://...' },
      { key: 'verified', label: 'Verified Profile', type: 'checkbox' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  {
    key: 'printers',
    label: 'Printers',
    description: 'Physical printing companies (DAN, Imprimerie Chaix, etc.)',
    fields: [
      { key: 'name', label: 'Canonical Name', type: 'text', required: true },
      { key: 'aliases', label: 'Aliases', type: 'aliases' },
      { key: 'location', label: 'Location', type: 'text', placeholder: 'Rome, Italy' },
      { key: 'country', label: 'Country', type: 'text' },
      { key: 'foundedYear', label: 'Founded Year', type: 'number' },
      { key: 'closedYear', label: 'Closed Year', type: 'number' },
      { key: 'wikipediaUrl', label: 'Wikipedia URL', type: 'url', placeholder: 'https://en.wikipedia.org/wiki/...' },
      { key: 'bio', label: 'Description', type: 'textarea' },
      { key: 'imageUrl', label: 'Image URL', type: 'url', placeholder: 'https://...' },
      { key: 'verified', label: 'Verified Profile', type: 'checkbox' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  {
    key: 'publishers',
    label: 'Publishers',
    description: 'Magazines, newspapers, publishing houses (The New Yorker, Fortune, etc.)',
    fields: [
      { key: 'name', label: 'Canonical Name', type: 'text', required: true },
      { key: 'aliases', label: 'Aliases', type: 'aliases' },
      { key: 'publicationType', label: 'Publication Type', type: 'text', placeholder: 'Magazine, Newspaper, etc.' },
      { key: 'country', label: 'Country', type: 'text' },
      { key: 'foundedYear', label: 'Founded Year', type: 'number' },
      { key: 'ceasedYear', label: 'Ceased Year', type: 'number' },
      { key: 'wikipediaUrl', label: 'Wikipedia URL', type: 'url', placeholder: 'https://en.wikipedia.org/wiki/...' },
      { key: 'bio', label: 'Description', type: 'textarea' },
      { key: 'imageUrl', label: 'Image URL', type: 'url', placeholder: 'https://...' },
      { key: 'verified', label: 'Verified Profile', type: 'checkbox' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  {
    key: 'internal-tags',
    label: 'Internal Tags',
    description: 'Tags for internal organization (INV 2024, Needs Research, etc.)',
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'color', label: 'Color', type: 'color' },
      { key: 'displayOrder', label: 'Display Order', type: 'number' },
    ],
  },
  {
    key: 'source-platforms',
    label: 'Source Platforms',
    description: 'Where items are acquired (eBay, Heritage Auctions, etc.)',
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'urlTemplate', label: 'URL Template', type: 'text' },
      { key: 'displayOrder', label: 'Display Order', type: 'number' },
    ],
  },
  {
    key: 'locations',
    label: 'Locations',
    description: 'Physical storage locations',
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'displayOrder', label: 'Display Order', type: 'number' },
    ],
  },
  {
    key: 'countries',
    label: 'Countries',
    description: 'Countries of origin',
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'code', label: 'ISO Code', type: 'text' },
      { key: 'displayOrder', label: 'Display Order', type: 'number' },
    ],
  },
];

function ManagedListsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeList, setActiveList] = useState<string>('media-types');
  const [items, setItems] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingItem, setEditingItem] = useState<ListItem | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [fetchingWikipedia, setFetchingWikipedia] = useState(false);
  const [pendingEditId, setPendingEditId] = useState<number | null>(null);

  const activeConfig = LIST_CONFIGS.find(c => c.key === activeList)!;

  // Types that support Wikipedia fetching
  const wikipediaEnabledTypes = ['printers', 'publishers', 'artists'];

  // Handle URL params for deep linking (e.g., /settings/lists?type=artists&edit=123)
  useEffect(() => {
    const typeParam = searchParams.get('type');
    const editParam = searchParams.get('edit');

    if (typeParam && LIST_CONFIGS.some(c => c.key === typeParam)) {
      if (typeParam !== activeList) {
        setActiveList(typeParam);
      }
      if (editParam) {
        setPendingEditId(parseInt(editParam));
      }
    }
  }, [searchParams, activeList]);

  // When items load and we have a pending edit ID, start editing that item
  useEffect(() => {
    if (pendingEditId !== null && items.length > 0 && !loading) {
      const itemToEdit = items.find(item => item.id === pendingEditId);
      if (itemToEdit) {
        startEdit(itemToEdit);
        // Clear the URL params after editing starts
        router.replace('/settings/lists', { scroll: false });
        setPendingEditId(null);
      }
      // Don't clear pendingEditId if item not found - might still be loading
    }
  }, [items, pendingEditId, loading, router]);

  useEffect(() => {
    fetchItems();
  }, [activeList]);

  async function fetchItems() {
    try {
      setLoading(true);
      setError('');
      const res = await fetch(`/api/managed-lists/${activeList}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch');
      }

      setItems(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load items');
    } finally {
      setLoading(false);
    }
  }

  function startAdd() {
    setIsAdding(true);
    setEditingItem(null);
    setFormData({ displayOrder: items.length + 1 });
  }

  function startEdit(item: ListItem) {
    setEditingItem(item);
    setIsAdding(false);
    setFormData({ ...item });
  }

  function cancelEdit() {
    setEditingItem(null);
    setIsAdding(false);
    setFormData({});
  }

  async function saveItem() {
    try {
      setSaving(true);
      setError('');

      const url = editingItem
        ? `/api/managed-lists/${activeList}?id=${editingItem.id}`
        : `/api/managed-lists/${activeList}`;

      const res = await fetch(url, {
        method: editingItem ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save');
      }

      await fetchItems();
      cancelEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem(id: number) {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
      setError('');
      const res = await fetch(`/api/managed-lists/${activeList}?id=${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete');
      }

      await fetchItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  }

  function updateFormField(key: string, value: unknown) {
    setFormData(prev => ({ ...prev, [key]: value }));
  }

  async function fetchWikipediaData() {
    const wikiUrl = formData.wikipediaUrl as string;
    if (!wikiUrl || !wikiUrl.includes('wikipedia.org')) {
      setError('Please enter a valid Wikipedia URL first');
      return;
    }

    try {
      setFetchingWikipedia(true);
      setError('');

      const res = await fetch('/api/wikipedia/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: wikiUrl,
          type: activeList === 'printers' ? 'printer' : activeList === 'publishers' ? 'publisher' : 'artist',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch Wikipedia data');
      }

      // Update form fields with extracted data
      const extracted = data.data;
      const updates: Record<string, unknown> = {};

      // Common fields
      if (extracted.description && !formData.bio) {
        updates.bio = extracted.description;
      }

      // Printer-specific fields
      if (activeList === 'printers') {
        if (extracted.location && !formData.location) updates.location = extracted.location;
        if (extracted.country && !formData.country) updates.country = extracted.country;
        if (extracted.foundedYear && !formData.foundedYear) updates.foundedYear = extracted.foundedYear;
        if (extracted.closedYear && !formData.closedYear) updates.closedYear = extracted.closedYear;
      }

      // Publisher-specific fields
      if (activeList === 'publishers') {
        if (extracted.publicationType && !formData.publicationType) updates.publicationType = extracted.publicationType;
        if (extracted.country && !formData.country) updates.country = extracted.country;
        if (extracted.foundedYear && !formData.foundedYear) updates.foundedYear = extracted.foundedYear;
        if (extracted.ceasedYear && !formData.ceasedYear) updates.ceasedYear = extracted.ceasedYear;
      }

      // Artist-specific fields
      if (activeList === 'artists') {
        if (extracted.nationality && !formData.nationality) updates.nationality = extracted.nationality;
        if (extracted.birthYear && !formData.birthYear) updates.birthYear = extracted.birthYear;
        if (extracted.deathYear && !formData.deathYear) updates.deathYear = extracted.deathYear;
      }

      // Apply updates if any
      if (Object.keys(updates).length > 0) {
        setFormData(prev => ({ ...prev, ...updates }));
      } else {
        setError('No new data found to populate. Fields may already be filled.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch Wikipedia data');
    } finally {
      setFetchingWikipedia(false);
    }
  }

  function renderField(field: ListConfig['fields'][0]) {
    const value = formData[field.key];

    switch (field.type) {
      case 'text':
        return (
          <input
            type="text"
            value={(value as string) || ''}
            onChange={e => updateFormField(field.key, e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            required={field.required}
          />
        );
      case 'number':
        return (
          <input
            type="number"
            value={(value as number) || ''}
            onChange={e => updateFormField(field.key, e.target.value ? parseInt(e.target.value) : null)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
          />
        );
      case 'color':
        return (
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={(value as string) || '#6B7280'}
              onChange={e => updateFormField(field.key, e.target.value)}
              className="w-12 h-10 border border-slate-300 rounded cursor-pointer"
            />
            <input
              type="text"
              value={(value as string) || '#6B7280'}
              onChange={e => updateFormField(field.key, e.target.value)}
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              placeholder="#6B7280"
            />
          </div>
        );
      case 'textarea':
        return (
          <textarea
            value={(value as string) || ''}
            onChange={e => updateFormField(field.key, e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            rows={3}
          />
        );
      case 'aliases':
        return (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {((value as string[]) || []).map((alias, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 rounded text-sm"
                >
                  {alias}
                  <button
                    type="button"
                    onClick={() => {
                      const newAliases = [...((value as string[]) || [])];
                      newAliases.splice(idx, 1);
                      updateFormField(field.key, newAliases);
                    }}
                    className="text-slate-400 hover:text-red-500"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <input
              type="text"
              placeholder="Type alias and press Enter"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const input = e.target as HTMLInputElement;
                  if (input.value.trim()) {
                    const newAliases = [...((value as string[]) || []), input.value.trim()];
                    updateFormField(field.key, newAliases);
                    input.value = '';
                  }
                }
              }}
            />
          </div>
        );
      case 'url':
        // Add fetch button for Wikipedia URL field on supported types
        const showFetchButton = field.key === 'wikipediaUrl' && wikipediaEnabledTypes.includes(activeList);
        return (
          <div className={showFetchButton ? 'flex gap-2' : ''}>
            <input
              type="url"
              value={(value as string) || ''}
              onChange={e => updateFormField(field.key, e.target.value)}
              placeholder={field.placeholder}
              className={`${showFetchButton ? 'flex-1' : 'w-full'} px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500`}
            />
            {showFetchButton && (
              <button
                type="button"
                onClick={fetchWikipediaData}
                disabled={fetchingWikipedia || !formData.wikipediaUrl}
                className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                title="Fetch data from Wikipedia to auto-populate fields"
              >
                {fetchingWikipedia ? (
                  <span className="flex items-center gap-1">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Fetching...
                  </span>
                ) : (
                  'Fetch from Wikipedia'
                )}
              </button>
            )}
          </div>
        );
      case 'checkbox':
        return (
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={(value as boolean) || false}
              onChange={e => updateFormField(field.key, e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
            />
            <span className="text-sm text-slate-600">
              {value ? 'Yes' : 'No'}
            </span>
          </label>
        );
      default:
        return null;
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Managed Lists</h1>
            <p className="text-slate-500">Configure dropdown options and sync lists</p>
          </div>
          <Link
            href="/settings"
            className="px-4 py-2 text-slate-600 hover:text-slate-800"
          >
            ← Back to Settings
          </Link>
        </div>

        <div className="flex gap-6">
          {/* Sidebar - List Types */}
          <div className="w-64 flex-shrink-0">
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                List Types
              </h2>
              <nav className="space-y-1">
                {LIST_CONFIGS.map(config => (
                  <button
                    key={config.key}
                    onClick={() => {
                      setActiveList(config.key);
                      cancelEdit();
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg transition ${
                      activeList === config.key
                        ? 'bg-amber-100 text-amber-800 font-medium'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {config.label}
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            <div className="bg-white rounded-lg shadow">
              {/* List Header */}
              <div className="p-4 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      {activeConfig.label}
                    </h2>
                    <p className="text-sm text-slate-500">{activeConfig.description}</p>
                  </div>
                  {!isAdding && !editingItem && (
                    <button
                      onClick={startAdd}
                      className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
                    >
                      + Add New
                    </button>
                  )}
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              {/* Add Form (only shown when adding new) */}
              {isAdding && (
                <div className="p-4 bg-slate-50 border-b border-slate-200">
                  <h3 className="text-sm font-semibold text-slate-700 mb-4">
                    Add New Item
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    {activeConfig.fields.map(field => (
                      <div key={field.key} className={field.type === 'textarea' || field.type === 'aliases' ? 'col-span-2' : ''}>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          {field.label}
                          {field.required && <span className="text-red-500">*</span>}
                        </label>
                        {renderField(field)}
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end gap-2 mt-4">
                    <button
                      onClick={cancelEdit}
                      className="px-4 py-2 text-slate-600 hover:text-slate-800"
                      disabled={saving}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveItem}
                      disabled={saving || !formData.name}
                      className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              )}

              {/* Items List */}
              <div className="p-4">
                {loading ? (
                  <div className="text-center py-8 text-slate-500">Loading...</div>
                ) : items.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    No items yet. Click "Add New" to create one.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {items.map(item => (
                      <div key={item.id}>
                        {editingItem?.id === item.id ? (
                          /* Inline Edit Form */
                          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                            <div className="grid grid-cols-2 gap-4">
                              {activeConfig.fields.map(field => (
                                <div key={field.key} className={field.type === 'textarea' || field.type === 'aliases' ? 'col-span-2' : ''}>
                                  <label className="block text-sm font-medium text-slate-700 mb-1">
                                    {field.label}
                                    {field.required && <span className="text-red-500">*</span>}
                                  </label>
                                  {renderField(field)}
                                </div>
                              ))}
                            </div>
                            <div className="flex justify-end gap-2 mt-4">
                              <button
                                onClick={cancelEdit}
                                className="px-4 py-2 text-slate-600 hover:text-slate-800"
                                disabled={saving}
                              >
                                Cancel
                              </button>
                              <button
                                onClick={saveItem}
                                disabled={saving || !formData.name}
                                className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
                              >
                                {saving ? 'Saving...' : 'Save'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* Normal Item Display */
                          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100">
                            <div className="flex items-center gap-3">
                              {item.color && (
                                <div
                                  className="w-4 h-4 rounded-full"
                                  style={{ backgroundColor: item.color }}
                                />
                              )}
                              <div>
                                <div className="font-medium text-slate-900 flex items-center gap-2">
                                  {item.name}
                                  {item.verified && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                      </svg>
                                      Verified
                                    </span>
                                  )}
                                </div>
                                {item.aliases && item.aliases.length > 0 && (
                                  <div className="text-xs text-slate-500">
                                    Also: {item.aliases.join(', ')}
                                  </div>
                                )}
                                {item.code && (
                                  <div className="text-xs text-slate-500">Code: {item.code}</div>
                                )}
                                {item.nationality && (
                                  <div className="text-xs text-slate-500">
                                    {item.nationality}
                                    {item.birthYear && ` (${item.birthYear}${item.deathYear ? `-${item.deathYear}` : ''})`}
                                  </div>
                                )}
                                {item.wikipediaUrl && (
                                  <a
                                    href={item.wikipediaUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-600 hover:text-blue-800"
                                    onClick={e => e.stopPropagation()}
                                  >
                                    Wikipedia →
                                  </a>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => startEdit(item)}
                                className="px-3 py-1 text-sm text-slate-600 hover:text-amber-600"
                                disabled={!!editingItem || isAdding}
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => deleteItem(item.id)}
                                className="px-3 py-1 text-sm text-slate-600 hover:text-red-600"
                                disabled={!!editingItem || isAdding}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ManagedListsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="text-slate-500">Loading...</div></div>}>
      <ManagedListsContent />
    </Suspense>
  );
}
