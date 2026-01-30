'use client';

import { useState } from 'react';
import Link from 'next/link';

interface MigrationConfig {
  id: string;
  name: string;
  description: string;
  endpoint: string;
  successLink?: { href: string; label: string };
}

const MIGRATIONS: MigrationConfig[] = [
  {
    id: 'managed-lists',
    name: 'Managed Lists',
    description: 'Create tables for Media Types, Artists, Internal Tags, Source Platforms, Locations, and Countries.',
    endpoint: '/api/migrate/managed-lists',
    successLink: { href: '/settings/lists', label: 'Go to Managed Lists' },
  },
  {
    id: 'artist-verification',
    name: 'Artist Verification Fields',
    description: 'Add enhanced artist identification fields: confidence score (0-100%), signature text, and verification checklist.',
    endpoint: '/api/migrate/artist-verification',
  },
  {
    id: 'seed-artists',
    name: 'Seed Artists from Shopify',
    description: 'Import all artist names from Shopify catalog into the artists table. Safe to run multiple times (skips duplicates).',
    endpoint: '/api/migrate/seed-artists',
    successLink: { href: '/settings/lists', label: 'View Artists' },
  },
];

type MigrationStatus = 'idle' | 'running' | 'success' | 'error';

interface MigrationState {
  status: MigrationStatus;
  results: string[];
  error: string;
}

export default function MigratePage() {
  const [states, setStates] = useState<Record<string, MigrationState>>(() => {
    const initial: Record<string, MigrationState> = {};
    MIGRATIONS.forEach((m) => {
      initial[m.id] = { status: 'idle', results: [], error: '' };
    });
    return initial;
  });

  async function runMigration(migration: MigrationConfig) {
    setStates((prev) => ({
      ...prev,
      [migration.id]: { status: 'running', results: [], error: '' },
    }));

    try {
      const res = await fetch(migration.endpoint, {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.details || 'Migration failed');
      }

      setStates((prev) => ({
        ...prev,
        [migration.id]: {
          status: 'success',
          results: data.results || [],
          error: '',
        },
      }));
    } catch (err) {
      setStates((prev) => ({
        ...prev,
        [migration.id]: {
          status: 'error',
          results: [],
          error: err instanceof Error ? err.message : 'Migration failed',
        },
      }));
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-6">
        <Link href="/settings" className="text-amber-600 hover:text-amber-700">
          ← Back to Settings
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-slate-900 mb-6">Database Migrations</h1>

      <div className="space-y-6">
        {MIGRATIONS.map((migration) => {
          const state = states[migration.id];

          return (
            <div key={migration.id} className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-1">
                {migration.name}
              </h2>
              <p className="text-slate-600 text-sm mb-4">{migration.description}</p>

              {state.status === 'idle' && (
                <button
                  onClick={() => runMigration(migration)}
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium text-sm"
                >
                  Run Migration
                </button>
              )}

              {state.status === 'running' && (
                <div className="flex items-center gap-3 text-amber-600">
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Running migration...
                </div>
              )}

              {state.status === 'success' && (
                <div>
                  <div className="flex items-center gap-2 text-green-600 mb-3">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span className="font-medium text-sm">Completed successfully!</span>
                  </div>
                  {state.results.length > 0 && (
                    <div className="bg-slate-50 rounded-lg p-3 mb-3">
                      <ul className="text-xs text-slate-600 space-y-1">
                        {state.results.map((result, idx) => (
                          <li key={idx} className="flex items-center gap-2">
                            <span className="text-green-500">✓</span> {result}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {migration.successLink && (
                    <Link
                      href={migration.successLink.href}
                      className="text-amber-600 hover:text-amber-700 font-medium text-sm"
                    >
                      {migration.successLink.label} →
                    </Link>
                  )}
                </div>
              )}

              {state.status === 'error' && (
                <div>
                  <div className="flex items-center gap-2 text-red-600 mb-3">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                    <span className="font-medium text-sm">Migration failed</span>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-xs mb-3">
                    {state.error}
                  </div>
                  <button
                    onClick={() => runMigration(migration)}
                    className="px-3 py-1.5 bg-slate-600 text-white rounded-lg hover:bg-slate-700 text-sm"
                  >
                    Try Again
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
