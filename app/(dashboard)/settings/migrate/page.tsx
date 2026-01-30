'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function MigratePage() {
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [results, setResults] = useState<string[]>([]);
  const [error, setError] = useState('');

  async function runMigration() {
    try {
      setStatus('running');
      setError('');
      setResults([]);

      const res = await fetch('/api/migrate/managed-lists', {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.details || 'Migration failed');
      }

      setResults(data.results || []);
      setStatus('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Migration failed');
      setStatus('error');
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-6">
        <Link href="/settings" className="text-amber-600 hover:text-amber-700">
          ← Back to Settings
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Database Migration</h1>
        <p className="text-slate-600 mb-6">
          Run this migration to create the managed lists tables (Media Types, Artists, Internal Tags, etc.)
        </p>

        {status === 'idle' && (
          <button
            onClick={runMigration}
            className="px-6 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium"
          >
            Run Migration
          </button>
        )}

        {status === 'running' && (
          <div className="flex items-center gap-3 text-amber-600">
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Running migration...
          </div>
        )}

        {status === 'success' && (
          <div>
            <div className="flex items-center gap-2 text-green-600 mb-4">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="font-medium">Migration completed successfully!</span>
            </div>
            <div className="bg-slate-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-slate-700 mb-2">Results:</h3>
              <ul className="text-sm text-slate-600 space-y-1">
                {results.map((result, idx) => (
                  <li key={idx} className="flex items-center gap-2">
                    <span className="text-green-500">✓</span> {result}
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-4">
              <Link
                href="/settings/lists"
                className="text-amber-600 hover:text-amber-700 font-medium"
              >
                Go to Managed Lists →
              </Link>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div>
            <div className="flex items-center gap-2 text-red-600 mb-4">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span className="font-medium">Migration failed</span>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm mb-4">
              {error}
            </div>
            <button
              onClick={runMigration}
              className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
