'use client';

import { useState, useEffect } from 'react';
import type { Poster, ShopifyData } from '@/types/poster';

const DESCRIPTION_TONES = ['standard', 'scholarly', 'enthusiastic', 'immersive'] as const;
type DescriptionTone = typeof DESCRIPTION_TONES[number];

interface ProductDescriptionEditorProps {
  poster: Poster;
  onUpdate: () => void;
}

export default function ProductDescriptionEditor({ poster, onUpdate }: ProductDescriptionEditorProps) {
  const [selectedTone, setSelectedTone] = useState<DescriptionTone>('standard');
  const [editedContent, setEditedContent] = useState<Record<string, string>>({});
  const [editedConcise, setEditedConcise] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingConcise, setIsEditingConcise] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [pushingConcise, setPushingConcise] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Get Shopify data for current description
  const shopifyData = poster.shopifyData as ShopifyData | null;
  const shopifyDescription = shopifyData?.bodyHtml || null;

  // Get AI descriptions from raw response
  const aiDescriptions = poster.rawAiResponse?.productDescriptions || {};
  const conciseDescription = aiDescriptions.concise || '';

  // Initialize edited content from AI descriptions
  useEffect(() => {
    if (aiDescriptions) {
      const initial: Record<string, string> = {};
      DESCRIPTION_TONES.forEach(tone => {
        initial[tone] = aiDescriptions[tone] || '';
      });
      setEditedContent(initial);
    }
  }, [poster.id]); // Reset when poster changes

  // Initialize concise content
  useEffect(() => {
    setEditedConcise(conciseDescription);
  }, [conciseDescription]);

  // Get the current description (edited if changed, otherwise AI)
  function getCurrentDescription(): string {
    if (editedContent[selectedTone]) {
      return editedContent[selectedTone];
    }
    return aiDescriptions[selectedTone] || poster.productDescription || '';
  }

  // Check if content has been edited
  function isContentEdited(): boolean {
    const original = aiDescriptions[selectedTone] || '';
    const current = editedContent[selectedTone] || '';
    return current !== original && current.trim() !== '';
  }

  // Check if concise has been edited
  function isConciseEdited(): boolean {
    return editedConcise !== conciseDescription && editedConcise.trim() !== '';
  }

  // Push description to Shopify (with optional custom content)
  async function handlePushDescription() {
    try {
      setPushing(true);
      setError('');
      setSuccess('');

      const content = getCurrentDescription();
      if (!content) {
        setError('No description content to push');
        return;
      }

      // Convert to HTML paragraphs
      const htmlDescription = content
        .split('\n\n')
        .map((p: string) => `<p>${p.trim()}</p>`)
        .join('\n');

      const res = await fetch('/api/shopify/push-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          posterId: poster.id,
          description: htmlDescription,
          tone: selectedTone,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to push description');
      }

      setSuccess(`${selectedTone} description pushed to Shopify!`);
      setIsEditing(false);
      onUpdate();

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to push');
    } finally {
      setPushing(false);
    }
  }

  // Push concise description to jadepuma.concise_description metafield
  async function handlePushConcise() {
    try {
      setPushingConcise(true);
      setError('');
      setSuccess('');

      if (!editedConcise.trim()) {
        setError('No concise description to push');
        return;
      }

      const res = await fetch('/api/shopify/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          posterId: poster.id,
          fields: ['research_metafields'],
          customConciseDescription: editedConcise,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to push concise description');
      }

      setSuccess('Concise description pushed to Shopify metafield!');
      setIsEditingConcise(false);
      onUpdate();

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to push');
    } finally {
      setPushingConcise(false);
    }
  }

  // Refresh descriptions from AI (re-generate)
  async function handleRefreshDescriptions() {
    try {
      setRefreshing(true);
      setError('');
      setSuccess('');

      const res = await fetch('/api/refresh-descriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ posterId: poster.id }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to refresh descriptions');
      }

      setSuccess('Descriptions refreshed from AI!');
      onUpdate();

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh');
    } finally {
      setRefreshing(false);
    }
  }

  // Copy current description to clipboard
  function handleCopy() {
    const text = getCurrentDescription()
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\[PARA\]/gi, '\n\n')
      .trim();
    navigator.clipboard.writeText(text);
    setSuccess('Copied to clipboard!');
    setTimeout(() => setSuccess(''), 2000);
  }

  // Check if Shopify is linked
  const isLinked = !!poster.shopifyProductId;

  // Strip HTML tags for display
  function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/\n\s*\n/g, '\n\n').trim();
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-lg font-bold text-slate-900">Product Description</h4>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefreshDescriptions}
            disabled={refreshing}
            className="text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1 rounded transition disabled:opacity-50 flex items-center gap-1"
            title="Generate new description variations from AI"
          >
            {refreshing ? (
              <>
                <span className="animate-spin">↻</span>
                <span>Refreshing...</span>
              </>
            ) : (
              '↻ Refresh AI'
            )}
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-3 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
          <button onClick={() => setError('')} className="float-right text-red-500 hover:text-red-700">×</button>
          {error}
        </div>
      )}
      {success && (
        <div className="mb-3 bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded text-sm">
          {success}
        </div>
      )}

      {/* Current Shopify Description (Source of Truth) */}
      {shopifyDescription && (
        <div className="mb-4 bg-white border border-blue-100 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide flex items-center gap-1">
              <span>🛒</span> Current Shopify Description
            </span>
            <span className="text-xs text-slate-500">Source of Truth</span>
          </div>
          <div className="text-xs text-slate-600 leading-relaxed max-h-24 overflow-y-auto">
            {stripHtml(shopifyDescription).split('\n\n').map((p, idx) => (
              <p key={idx} className={idx > 0 ? 'mt-2' : ''}>{p}</p>
            ))}
          </div>
        </div>
      )}

      {/* AI-Generated Options */}
      <div className="border-t border-blue-200/50 pt-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">AI-Generated Options</span>
          {isContentEdited() && (
            <span className="text-xs text-amber-600 flex items-center gap-1">
              <span>✏️</span> Edited
            </span>
          )}
        </div>

        {/* Tone Selector Tabs */}
        <div className="flex flex-wrap gap-1 mb-3">
          {DESCRIPTION_TONES.map((tone) => (
            <button
              key={tone}
              onClick={() => setSelectedTone(tone)}
              className={`text-xs px-3 py-1.5 rounded-full transition capitalize ${
                selectedTone === tone
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {tone}
            </button>
          ))}
        </div>

        {/* Description Content */}
        {isEditing ? (
          <textarea
            value={editedContent[selectedTone] || ''}
            onChange={(e) => setEditedContent(prev => ({ ...prev, [selectedTone]: e.target.value }))}
            className="w-full h-48 p-3 text-sm text-slate-700 bg-white border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
            placeholder="Edit the description..."
          />
        ) : (
          <div
            className="text-sm text-slate-700 leading-relaxed space-y-3 bg-white rounded-lg p-3 min-h-[100px] cursor-pointer hover:bg-slate-50 transition"
            onClick={() => setIsEditing(true)}
            title="Click to edit"
          >
            {getCurrentDescription() ? (
              getCurrentDescription().split(/\n\n+|\[PARA\]/g).filter((p: string) => p.trim()).map((paragraph: string, idx: number) => (
                <p key={idx}>{paragraph.trim()}</p>
              ))
            ) : (
              <p className="text-slate-400 italic">No {selectedTone} description available. Click to write one.</p>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <button
                  onClick={() => setIsEditing(false)}
                  className="text-xs px-3 py-1.5 bg-slate-100 text-slate-600 rounded hover:bg-slate-200 transition"
                >
                  Done Editing
                </button>
                <button
                  onClick={() => {
                    setEditedContent(prev => ({ ...prev, [selectedTone]: aiDescriptions[selectedTone] || '' }));
                  }}
                  className="text-xs px-3 py-1.5 text-slate-500 hover:text-slate-700 transition"
                >
                  Reset to AI
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="text-xs px-3 py-1.5 bg-slate-100 text-slate-600 rounded hover:bg-slate-200 transition flex items-center gap-1"
              >
                <span>✏️</span> Edit
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="text-xs px-3 py-1.5 bg-slate-100 text-slate-700 rounded hover:bg-slate-200 transition"
            >
              Copy
            </button>
            {isLinked && (
              <button
                onClick={handlePushDescription}
                disabled={pushing || !getCurrentDescription()}
                className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition flex items-center gap-1"
              >
                {pushing ? (
                  <>
                    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Pushing...
                  </>
                ) : (
                  <>Push to Shopify</>
                )}
              </button>
            )}
          </div>
        </div>

        <p className="text-xs text-slate-500 mt-2">
          {isEditing ? 'Edit the text above, then push to Shopify when ready.' : 'Click the description to edit before pushing.'}
        </p>
      </div>

      {/* Concise Description Section - Separate */}
      <div className="border-t border-blue-200/50 mt-4 pt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide flex items-center gap-1">
            <span>📝</span> Concise Description
            <span className="text-xs font-normal text-slate-400 ml-1">(jadepuma.concise_description)</span>
          </span>
          {isConciseEdited() && (
            <span className="text-xs text-amber-600 flex items-center gap-1">
              <span>✏️</span> Edited
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 mb-2">Short description for auction listings and quick reference.</p>

        {/* Concise Content */}
        {isEditingConcise ? (
          <textarea
            value={editedConcise}
            onChange={(e) => setEditedConcise(e.target.value)}
            className="w-full h-24 p-3 text-sm text-slate-700 bg-white border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
            placeholder="Brief factual description..."
          />
        ) : (
          <div
            className="bg-white rounded-lg p-3 cursor-pointer hover:bg-slate-50 transition"
            onClick={() => setIsEditingConcise(true)}
            title="Click to edit"
          >
            {editedConcise ? (
              <ul className="space-y-1">
                {(() => {
                  const text = editedConcise.replace(/[—–]/g, '-');
                  const hasBulletChars = text.includes('•');
                  const items = hasBulletChars
                    ? text.split(/\s*•\s*/).filter((s: string) => s.trim())
                    : text.split(/(?<=\w{2,}\.)\s+/).filter((s: string) => s.trim());
                  return items.map((sentence: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-slate-700">
                      <span className="text-blue-600 mt-0.5">•</span>
                      <span>{sentence.trim()}</span>
                    </li>
                  ));
                })()}
              </ul>
            ) : (
              <p className="text-sm text-slate-400 italic">No concise description available. Click to write one.</p>
            )}
          </div>
        )}

        {/* Concise Action Buttons */}
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2">
            {isEditingConcise ? (
              <>
                <button
                  onClick={() => setIsEditingConcise(false)}
                  className="text-xs px-3 py-1.5 bg-slate-100 text-slate-600 rounded hover:bg-slate-200 transition"
                >
                  Done
                </button>
                <button
                  onClick={() => setEditedConcise(conciseDescription)}
                  className="text-xs px-3 py-1.5 text-slate-500 hover:text-slate-700 transition"
                >
                  Reset
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditingConcise(true)}
                className="text-xs px-3 py-1.5 bg-slate-100 text-slate-600 rounded hover:bg-slate-200 transition flex items-center gap-1"
              >
                <span>✏️</span> Edit
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                navigator.clipboard.writeText(editedConcise);
                setSuccess('Concise description copied!');
                setTimeout(() => setSuccess(''), 2000);
              }}
              className="text-xs px-3 py-1.5 bg-slate-100 text-slate-700 rounded hover:bg-slate-200 transition"
            >
              Copy
            </button>
            {isLinked && (
              <button
                onClick={handlePushConcise}
                disabled={pushingConcise || !editedConcise.trim()}
                className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 transition flex items-center gap-1"
              >
                {pushingConcise ? (
                  <>
                    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Pushing...
                  </>
                ) : (
                  <>Push Concise</>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
