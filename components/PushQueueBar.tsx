'use client';

import { useState } from 'react';
import { usePushQueue, FIELD_LABELS, type PushQueueEntry, type UserPushSettings } from '@/components/PushQueueContext';
import { PUSH_FIELD_KEYS, ALL_FIELD_KEYS } from '@/lib/push-constants';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// Fields that require more confidence/judgment
const JUDGMENT_FIELDS: Set<string> = new Set([
  PUSH_FIELD_KEYS.title,
  PUSH_FIELD_KEYS.description,
  PUSH_FIELD_KEYS.customArtist,
  PUSH_FIELD_KEYS.customDate,
  PUSH_FIELD_KEYS.conciseDescription,
  PUSH_FIELD_KEYS.customTalkingPoints,
]);

// Default auto-push settings: safe fields ON, judgment fields OFF
const DEFAULT_AUTO_PUSH: Record<string, boolean> = {};
for (const key of ALL_FIELD_KEYS) {
  DEFAULT_AUTO_PUSH[key] = !JUDGMENT_FIELDS.has(key);
}

export default function PushQueueBar() {
  const {
    queuedFields,
    queueCount,
    removeFromQueue,
    pushFields,
    pushAll,
    isPushing,
    pushingField,
    error,
    success,
    clearMessages,
    userSettings,
    updateSettings,
    pushHistory,
  } = usePushQueue();

  const [expanded, setExpanded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());

  // Don't render if queue is empty and no messages
  if (queueCount === 0 && !error && !success) return null;

  const queueEntries = Array.from(queuedFields.entries());

  const toggleField = (fieldKey: string) => {
    const next = new Set(selectedFields);
    if (next.has(fieldKey)) {
      next.delete(fieldKey);
    } else {
      next.add(fieldKey);
    }
    setSelectedFields(next);
  };

  const selectAll = () => {
    setSelectedFields(new Set(queuedFields.keys()));
  };

  const deselectAll = () => {
    setSelectedFields(new Set());
  };

  const handlePushSelected = async () => {
    if (selectedFields.size === 0) return;
    await pushFields(Array.from(selectedFields));
    setSelectedFields(new Set());
  };

  const handleRemoveField = async (fieldKey: string) => {
    await removeFromQueue([fieldKey]);
    const next = new Set(selectedFields);
    next.delete(fieldKey);
    setSelectedFields(next);
  };

  // Settings helpers
  const autoPush = { ...DEFAULT_AUTO_PUSH, ...userSettings.autoPush };
  const thresholds = userSettings.confidenceThresholds || {};

  const toggleAutoPush = async (fieldKey: string) => {
    const updated: UserPushSettings = {
      ...userSettings,
      autoPush: { ...autoPush, [fieldKey]: !autoPush[fieldKey] },
    };
    await updateSettings(updated);
  };

  const setThreshold = async (fieldKey: string, value: number) => {
    const updated: UserPushSettings = {
      ...userSettings,
      confidenceThresholds: { ...thresholds, [fieldKey]: value },
    };
    await updateSettings(updated);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      {/* Messages banner */}
      {(error || success) && (
        <div
          className={`px-4 py-2 text-sm text-center cursor-pointer ${
            error ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
          }`}
          onClick={clearMessages}
        >
          {error || success}
        </div>
      )}

      {/* Settings panel */}
      {showSettings && (
        <div className="bg-white border-t border-slate-200 shadow-lg max-h-80 overflow-y-auto">
          <div className="max-w-4xl mx-auto p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-700">Auto-Push Settings</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="text-xs text-slate-500 hover:text-slate-700"
              >
                Close
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              When enabled, saving a field locally will immediately push it to Shopify.
              Judgment fields (title, description, artist, date) are off by default.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {ALL_FIELD_KEYS.map((fk) => {
                const label = FIELD_LABELS[fk] || fk;
                const isJudgment = JUDGMENT_FIELDS.has(fk);
                const enabled = autoPush[fk] ?? !isJudgment;
                const hasThreshold = ['metafield:custom.artist', 'metafield:custom.date', 'metafield:jadepuma.printer', 'metafield:jadepuma.publisher', 'metafield:jadepuma.book_title_source'].includes(fk);

                return (
                  <div key={fk} className="flex items-center gap-2 p-2 rounded bg-slate-50">
                    <label className="flex items-center gap-2 flex-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={() => toggleAutoPush(fk)}
                        className="rounded border-slate-300"
                      />
                      <span className="text-xs text-slate-700">{label}</span>
                      {isJudgment && (
                        <span className="text-xs text-amber-500" title="Requires human judgment">⚠</span>
                      )}
                    </label>
                    {hasThreshold && (
                      <select
                        value={thresholds[fk] || 80}
                        onChange={(e) => setThreshold(fk, Number(e.target.value))}
                        className="text-xs border border-slate-200 rounded px-1 py-0.5"
                        title="Minimum AI confidence to auto-push"
                      >
                        <option value={60}>60%+</option>
                        <option value={70}>70%+</option>
                        <option value={80}>80%+</option>
                        <option value={85}>85%+</option>
                        <option value={90}>90%+</option>
                        <option value={95}>95%+</option>
                      </select>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Expanded panel */}
      {expanded && queueCount > 0 && !showSettings && (
        <div className="bg-white border-t border-slate-200 shadow-lg max-h-80 overflow-y-auto">
          <div className="max-w-4xl mx-auto p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-semibold text-slate-700">Push Queue</h3>
                <button onClick={selectAll} className="text-xs text-blue-600 hover:underline">Select all</button>
                <button onClick={deselectAll} className="text-xs text-slate-500 hover:underline">Clear selection</button>
              </div>
              <button
                onClick={() => setExpanded(false)}
                className="text-xs text-slate-500 hover:text-slate-700"
              >
                Collapse
              </button>
            </div>

            <div className="space-y-1">
              {queueEntries.map(([fieldKey, entry]) => {
                const label = FIELD_LABELS[fieldKey] || fieldKey;
                const selected = selectedFields.has(fieldKey);
                const pushing = isPushing && pushingField === fieldKey;

                return (
                  <div
                    key={fieldKey}
                    className={`flex items-center gap-3 p-2 rounded text-sm ${
                      selected ? 'bg-blue-50 border border-blue-200' : 'bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleField(fieldKey)}
                      className="rounded border-slate-300"
                    />
                    <span className="flex-1 text-slate-700">
                      {label}
                      {pushing && (
                        <svg className="inline w-3 h-3 ml-1 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      )}
                    </span>
                    <span className="text-xs text-slate-400">
                      {timeAgo(entry.queuedAt)}
                    </span>
                    <button
                      onClick={() => handleRemoveField(fieldKey)}
                      className="text-xs text-slate-400 hover:text-red-500 transition"
                      title="Remove from queue"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={handlePushSelected}
                disabled={isPushing || selectedFields.size === 0}
                className="text-xs px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 transition"
              >
                Push Selected ({selectedFields.size})
              </button>
              <button
                onClick={() => setExpanded(false)}
                className="text-xs px-3 py-1.5 bg-white border border-slate-300 text-slate-600 rounded hover:bg-slate-50 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Collapsed bar */}
      {queueCount > 0 && (
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-4 py-2 shadow-lg">
          <div className="max-w-4xl mx-auto flex items-center gap-3">
            {/* Queue count */}
            <button
              onClick={() => { setExpanded(!expanded); setShowSettings(false); }}
              className="text-sm font-medium hover:underline flex items-center gap-1"
            >
              <span className="bg-white/20 rounded-full px-2 py-0.5 text-xs font-bold">
                {queueCount}
              </span>
              {queueCount === 1 ? 'change queued' : 'changes queued'}
              <span className="text-xs opacity-75">{expanded ? '▼' : '▲'}</span>
            </button>

            {/* Field chips */}
            <div className="flex-1 flex items-center gap-1 overflow-x-auto">
              {queueEntries.slice(0, 8).map(([fieldKey]) => {
                const label = FIELD_LABELS[fieldKey] || fieldKey;
                const pushing = isPushing && pushingField === fieldKey;
                return (
                  <span
                    key={fieldKey}
                    className="inline-flex items-center gap-1 text-xs bg-white/20 rounded-full px-2 py-0.5 whitespace-nowrap"
                  >
                    {pushing && (
                      <svg className="w-2.5 h-2.5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    )}
                    {label}
                    <button
                      onClick={(e) => { e.stopPropagation(); removeFromQueue([fieldKey]); }}
                      className="hover:text-red-200 transition"
                      title="Remove from queue"
                    >
                      ✕
                    </button>
                  </span>
                );
              })}
              {queueCount > 8 && (
                <span className="text-xs opacity-75">+{queueCount - 8} more</span>
              )}
            </div>

            {/* Settings gear */}
            <button
              onClick={() => { setShowSettings(!showSettings); setExpanded(false); }}
              className="text-white/80 hover:text-white transition"
              title="Auto-push settings"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>

            {/* Push All button */}
            <button
              onClick={pushAll}
              disabled={isPushing}
              className="text-sm px-4 py-1.5 bg-white text-green-700 rounded font-medium hover:bg-green-50 disabled:opacity-50 transition flex items-center gap-1"
            >
              {isPushing ? (
                <>
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Pushing...
                </>
              ) : (
                <>Push All →</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
