'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef, type MutableRefObject } from 'react';
import type { Poster, ShopifyData, ShopifyMetafieldData } from '@/types/poster';
import { PUSH_FIELD_KEYS, FIELD_LABELS, ALL_FIELD_KEYS } from '@/lib/push-constants';

// Re-export for convenience
export { PUSH_FIELD_KEYS, FIELD_LABELS };

export interface PushQueueEntry {
  fieldKey: string;
  queuedAt: string;
  autoEligible: boolean;
}

export interface PushHistoryEntry {
  id: number;
  posterId: number;
  fieldKey: string;
  previousValue: string | null;
  newValue: string | null;
  pushedAt: string;
  pushedBy: string | null;
}

export interface UserPushSettings {
  autoPush: Record<string, boolean>;
  confidenceThresholds?: Record<string, number>;
}

export interface PushQueueContextType {
  // Queue state
  queuedFields: Map<string, PushQueueEntry>;
  queueCount: number;
  isFieldQueued: (fieldKey: string) => boolean;
  addToQueue: (fieldKeys: string[], autoEligible?: boolean) => Promise<void>;
  removeFromQueue: (fieldKeys: string[]) => Promise<void>;

  // Push operations
  pushField: (fieldKey: string) => Promise<void>;
  pushFields: (fieldKeys: string[]) => Promise<void>;
  pushAll: () => Promise<void>;
  isPushing: boolean;
  pushingField: string | null;

  // History
  pushHistory: PushHistoryEntry[];
  lastPushTime: (fieldKey: string) => string | null;
  undoField: (fieldKey: string) => Promise<void>;

  // Sync status
  getSyncStatus: (fieldKey: string) => 'synced' | 'different' | 'missing';
  getShopifyValue: (fieldKey: string) => string | null;
  getLocalValue: (fieldKey: string) => string | null;

  // Settings
  userSettings: UserPushSettings;
  updateSettings: (settings: UserPushSettings) => Promise<void>;

  // Feedback
  error: string;
  success: string;
  clearMessages: () => void;

  // Refresh
  refreshQueue: () => Promise<void>;
}

const PushQueueContext = createContext<PushQueueContextType | null>(null);

export function usePushQueue(): PushQueueContextType {
  const context = useContext(PushQueueContext);
  if (!context) {
    throw new Error('usePushQueue must be used within a PushQueueProvider');
  }
  return context;
}

export interface PushQueueActions {
  addToQueue: (fieldKeys: string[], autoEligible?: boolean) => Promise<void>;
  removeFromQueue: (fieldKeys: string[]) => Promise<void>;
  pushField: (fieldKey: string) => Promise<void>;
  refreshQueue: () => Promise<void>;
}

interface PushQueueProviderProps {
  poster: Poster;
  onUpdate: () => void;
  actionsRef?: MutableRefObject<PushQueueActions | null>;
  children: React.ReactNode;
}

export function PushQueueProvider({ poster, onUpdate, actionsRef, children }: PushQueueProviderProps) {
  const [queuedFields, setQueuedFields] = useState<Map<string, PushQueueEntry>>(new Map());
  const [pushHistory, setPushHistory] = useState<PushHistoryEntry[]>([]);
  const [userSettings, setUserSettings] = useState<UserPushSettings>({ autoPush: {} });
  const [isPushing, setIsPushing] = useState(false);
  const [pushingField, setPushingField] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const posterRef = useRef(poster);
  posterRef.current = poster;

  const isLinked = !!poster.shopifyProductId;
  const shopifyData = poster.shopifyData as ShopifyData | null;

  // Fetch queue on mount and when poster changes
  const fetchQueue = useCallback(async () => {
    if (!poster.id) return;
    try {
      const res = await fetch(`/api/push-queue?posterId=${poster.id}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const map = new Map<string, PushQueueEntry>();
        for (const row of data.queue) {
          map.set(row.field_key, {
            fieldKey: row.field_key,
            queuedAt: row.queued_at,
            autoEligible: row.auto_eligible,
          });
        }
        setQueuedFields(map);
      } else {
        const data = await res.json().catch(() => ({}));
        console.error('Push queue fetch failed:', res.status, data);
      }
    } catch (err) {
      console.error('Failed to fetch push queue:', err);
    }
  }, [poster.id]);

  // Fetch history on mount
  const fetchHistory = useCallback(async () => {
    if (!poster.id) return;
    try {
      const res = await fetch(`/api/push-history?posterId=${poster.id}`);
      if (res.ok) {
        const data = await res.json();
        setPushHistory(data.history.map((h: any) => ({
          id: h.id,
          posterId: h.poster_id,
          fieldKey: h.field_key,
          previousValue: h.previous_value,
          newValue: h.new_value,
          pushedAt: h.pushed_at,
          pushedBy: h.pushed_by,
        })));
      }
    } catch (err) {
      console.error('Failed to fetch push history:', err);
    }
  }, [poster.id]);

  // Fetch user settings on mount
  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/user-settings');
      if (res.ok) {
        const data = await res.json();
        setUserSettings(data.settings);
      }
    } catch (err) {
      console.error('Failed to fetch user settings:', err);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
    fetchHistory();
    fetchSettings();
  }, [fetchQueue, fetchHistory, fetchSettings]);

  // Re-fetch queue when poster data changes (e.g., after a push)
  useEffect(() => {
    fetchQueue();
  }, [poster.shopifyData, fetchQueue]);

  // Helper: get metafield value from shopifyData
  function getMetafieldValue(namespace: string, key: string): string | null {
    if (!shopifyData?.metafields) return null;
    const mf = shopifyData.metafields.find(
      (m: ShopifyMetafieldData) => m.namespace === namespace && m.key === key
    );
    return mf?.value || null;
  }

  // Get Shopify value for a field key
  function getShopifyValue(fieldKey: string): string | null {
    if (!shopifyData) return null;

    switch (fieldKey) {
      case PUSH_FIELD_KEYS.title:
        return shopifyData.title || null;
      case PUSH_FIELD_KEYS.description:
        return shopifyData.bodyHtml || null;
      case PUSH_FIELD_KEYS.tags:
        return shopifyData.shopifyTags?.join(', ') || null;
      default: {
        const match = fieldKey.match(/^metafield:(\w+)\.(.+)$/);
        if (match) {
          const raw = getMetafieldValue(match[1], match[2]);
          // Parse JSON arrays (e.g., list.single_line_text_field) for display
          if (raw && raw.startsWith('[')) {
            try {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed)) return parsed.join(', ');
            } catch { /* use raw */ }
          }
          return raw;
        }
        return null;
      }
    }
  }

  // Get local value for a field key (client-side, from poster object)
  function getLocalValue(fieldKey: string): string | null {
    switch (fieldKey) {
      case PUSH_FIELD_KEYS.title:
        return poster.title || null;
      case PUSH_FIELD_KEYS.description:
        return poster.rawAiResponse?.productDescriptions?.standard
          || poster.productDescription || null;
      case PUSH_FIELD_KEYS.tags:
        return poster.itemTags?.join(', ') || null;
      case PUSH_FIELD_KEYS.customArtist:
        return poster.artist || null;
      case PUSH_FIELD_KEYS.customDate:
        return poster.estimatedDate || null;
      case PUSH_FIELD_KEYS.customTechnique:
      case PUSH_FIELD_KEYS.medium:
        return poster.printingTechnique || null;
      case PUSH_FIELD_KEYS.customHistory:
        return poster.historicalContext || null;
      case PUSH_FIELD_KEYS.customTalkingPoints:
        return poster.rawAiResponse?.talkingPoints
          ? JSON.stringify(poster.rawAiResponse.talkingPoints) : null;
      case PUSH_FIELD_KEYS.conciseDescription:
        return poster.rawAiResponse?.productDescriptions?.concise || null;
      case PUSH_FIELD_KEYS.color:
        return poster.colors?.join(', ') || null;
      case PUSH_FIELD_KEYS.countryOfOrigin:
        return poster.countryOfOrigin || null;
      case PUSH_FIELD_KEYS.bookTitleSource:
        return poster.publicationId ? '(linked record)' : null;
      case PUSH_FIELD_KEYS.publisher:
        return poster.publisherId ? '(linked record)' : null;
      case PUSH_FIELD_KEYS.printer:
        return poster.printerId ? '(linked record)' : (poster.printer || null);
      case PUSH_FIELD_KEYS.artistBio:
        return poster.artistId ? '(from artist record)' : null;
      default:
        return null;
    }
  }

  // Get sync status for a field
  function getSyncStatus(fieldKey: string): 'synced' | 'different' | 'missing' {
    if (!isLinked || !shopifyData) return 'missing';

    const shopifyVal = getShopifyValue(fieldKey);
    const localVal = getLocalValue(fieldKey);

    if (!shopifyVal && !localVal) return 'synced'; // both empty
    if (!shopifyVal) return 'missing';
    if (!localVal) return 'synced'; // no local value to push

    // For tags, check if all local tags exist in Shopify (additive merge — Shopify may have extras)
    if (fieldKey === PUSH_FIELD_KEYS.tags) {
      const shopifyTags = new Set((shopifyData.shopifyTags || []).map((t: string) => t.toLowerCase()));
      const localTags = poster.itemTags || [];
      const allPresent = localTags.every((t: string) => shopifyTags.has(t.toLowerCase()));
      return allPresent ? 'synced' : 'different';
    }

    // For linked records, we can't compare exactly on client side
    if (localVal === '(linked record)' || localVal === '(from artist record)') {
      return shopifyVal ? 'synced' : 'missing'; // Approximate — can't compare
    }

    // Simple string comparison (case-sensitive)
    return shopifyVal === localVal ? 'synced' : 'different';
  }

  // Queue operations
  async function addToQueue(fieldKeys: string[], autoEligible = false) {
    if (!poster.id || !isLinked) return;

    // Check which fields should auto-push vs queue
    const autoPushSettings = userSettings.autoPush || {};
    const toAutoPush: string[] = [];
    const toQueue: string[] = [];

    for (const fk of fieldKeys) {
      if (autoPushSettings[fk]) {
        toAutoPush.push(fk);
      } else {
        toQueue.push(fk);
      }
    }

    // Auto-push eligible fields immediately
    if (toAutoPush.length > 0) {
      // Don't await — push in background so UI stays responsive
      pushFields(toAutoPush).catch(err => {
        console.error('Auto-push failed:', err);
        // On failure, add to queue instead so nothing is lost
        addToQueueDirect(toAutoPush, true);
      });
    }

    // Queue the rest
    if (toQueue.length > 0) {
      await addToQueueDirect(toQueue, autoEligible);
    }
  }

  // Internal: add to queue without auto-push check (avoids infinite recursion)
  async function addToQueueDirect(fieldKeys: string[], autoEligible: boolean) {
    if (!poster.id || !isLinked) return;

    // Optimistic update
    const newMap = new Map(queuedFields);
    for (const fk of fieldKeys) {
      newMap.set(fk, { fieldKey: fk, queuedAt: new Date().toISOString(), autoEligible });
    }
    setQueuedFields(newMap);

    try {
      const res = await fetch('/api/push-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ posterId: poster.id, fieldKeys, autoEligible }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error('Push queue POST failed:', res.status, data);
        setError(`Failed to queue: ${data.details || data.error || res.statusText}`);
        fetchQueue(); // Revert to DB truth
      }
    } catch (err) {
      console.error('Failed to add to queue:', err);
      setError('Failed to queue: network error');
      fetchQueue();
    }
  }

  async function removeFromQueue(fieldKeys: string[]) {
    if (!poster.id) return;

    // Optimistic update
    const newMap = new Map(queuedFields);
    for (const fk of fieldKeys) {
      newMap.delete(fk);
    }
    setQueuedFields(newMap);

    try {
      const res = await fetch('/api/push-queue', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ posterId: poster.id, fieldKeys }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error('Push queue DELETE failed:', res.status, data);
        fetchQueue();
      }
    } catch (err) {
      console.error('Failed to remove from queue:', err);
      fetchQueue();
    }
  }

  // Push operations
  async function pushField(fieldKey: string) {
    if (!poster.id || !isLinked) return;

    setIsPushing(true);
    setPushingField(fieldKey);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/shopify/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ posterId: poster.id, fields: [fieldKey] }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to push to Shopify');
      }

      if (data.errors && data.errors.length > 0) {
        setError(data.errors.join(', '));
      } else {
        const label = FIELD_LABELS[fieldKey] || fieldKey;
        setSuccess(`Pushed ${label} to Shopify`);
        // Remove from local queue
        const newMap = new Map(queuedFields);
        newMap.delete(fieldKey);
        setQueuedFields(newMap);
        onUpdate();
        fetchHistory();
      }

      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to push');
    } finally {
      setIsPushing(false);
      setPushingField(null);
    }
  }

  async function pushFields(fieldKeys: string[]) {
    if (!poster.id || !isLinked || fieldKeys.length === 0) return;

    setIsPushing(true);
    setPushingField(fieldKeys[0]);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/shopify/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ posterId: poster.id, fields: fieldKeys }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to push to Shopify');
      }

      if (data.errors && data.errors.length > 0) {
        setError(data.errors.join(', '));
      } else {
        setSuccess(`Pushed ${data.updated.join(', ')} to Shopify`);
        // Remove pushed fields from local queue
        const newMap = new Map(queuedFields);
        for (const fk of fieldKeys) {
          newMap.delete(fk);
        }
        setQueuedFields(newMap);
        onUpdate();
        fetchHistory();
      }

      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to push');
    } finally {
      setIsPushing(false);
      setPushingField(null);
    }
  }

  async function pushAll() {
    const allQueued = Array.from(queuedFields.keys());
    if (allQueued.length === 0) return;
    await pushFields(allQueued);
  }

  // History operations
  function lastPushTime(fieldKey: string): string | null {
    const entry = pushHistory.find(h => h.fieldKey === fieldKey);
    return entry?.pushedAt || null;
  }

  async function undoField(fieldKey: string) {
    if (!poster.id) return;

    setIsPushing(true);
    setPushingField(fieldKey);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/push-history/undo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ posterId: poster.id, fieldKey }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to undo');
      }

      const label = FIELD_LABELS[fieldKey] || fieldKey;
      setSuccess(`Undid ${label} push`);
      onUpdate();
      fetchHistory();

      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to undo');
    } finally {
      setIsPushing(false);
      setPushingField(null);
    }
  }

  // Settings
  async function updateSettings(settings: UserPushSettings) {
    setUserSettings(settings);
    try {
      await fetch('/api/user-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });
    } catch (err) {
      console.error('Failed to save user settings:', err);
    }
  }

  function clearMessages() {
    setError('');
    setSuccess('');
  }

  // Expose actions via ref for parent components that can't use the hook
  if (actionsRef) {
    actionsRef.current = { addToQueue, removeFromQueue, pushField, refreshQueue: fetchQueue };
  }

  const value: PushQueueContextType = {
    queuedFields,
    queueCount: queuedFields.size,
    isFieldQueued: (fieldKey: string) => queuedFields.has(fieldKey),
    addToQueue,
    removeFromQueue,
    pushField,
    pushFields,
    pushAll,
    isPushing,
    pushingField,
    pushHistory,
    lastPushTime,
    undoField,
    getSyncStatus,
    getShopifyValue,
    getLocalValue,
    userSettings,
    updateSettings,
    error,
    success,
    clearMessages,
    refreshQueue: fetchQueue,
  };

  return (
    <PushQueueContext.Provider value={value}>
      {children}
    </PushQueueContext.Provider>
  );
}
