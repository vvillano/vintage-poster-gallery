'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Poster } from '@/types/poster';
import { formatDate } from '@/lib/utils';
import Link from 'next/link';

export default function PosterDetailPage() {
  const params = useParams();
  const router = useRouter();
  const posterId = params.id as string;

  const [poster, setPoster] = useState<Poster | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPoster();
  }, [posterId]);

  async function fetchPoster() {
    try {
      setLoading(true);
      const res = await fetch(`/api/posters/${posterId}`);
      if (!res.ok) {
        throw new Error('Failed to fetch poster');
      }
      const data = await res.json();
      setPoster(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  async function triggerAnalysis() {
    try {
      setAnalyzing(true);
      setError('');

      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ posterId: parseInt(posterId) }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Analysis failed');
      }

      // Refresh poster data
      await fetchPoster();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleExportJSON() {
    if (!poster) return;

    const jsonData = JSON.stringify(poster, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `poster-${poster.id}-${poster.title || 'untitled'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-slate-600">Loading poster...</p>
        </div>
      </div>
    );
  }

  if (error || !poster) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg">
          <h3 className="font-semibold mb-2">Error</h3>
          <p>{error || 'Poster not found'}</p>
          <Link
            href="/dashboard"
            className="inline-block mt-4 text-blue-600 hover:underline"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex justify-between items-center">
        <Link
          href="/dashboard"
          className="text-slate-600 hover:text-slate-900 flex items-center"
        >
          ← Back to Dashboard
        </Link>
        <div className="flex gap-2">
          <button
            onClick={handleExportJSON}
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition"
          >
            Export JSON
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Image */}
        <div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="aspect-[3/4] bg-slate-100 rounded-lg overflow-hidden">
              <img
                src={poster.imageUrl}
                alt={poster.title || poster.fileName}
                className="w-full h-full object-contain"
              />
            </div>
            <div className="mt-4 text-sm text-slate-600">
              <p>
                <strong>Uploaded:</strong> {formatDate(poster.uploadDate)}
              </p>
              <p>
                <strong>File:</strong> {poster.fileName}
              </p>
              <p>
                <strong>By:</strong> {poster.uploadedBy}
              </p>
            </div>
          </div>
        </div>

        {/* Analysis */}
        <div>
          {!poster.analysisCompleted ? (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-bold text-slate-900 mb-4">
                Analysis Pending
              </h2>
              <p className="text-slate-600 mb-6">
                This poster hasn't been analyzed yet. Click the button below to start AI
                analysis.
              </p>
              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}
              <button
                onClick={triggerAnalysis}
                disabled={analyzing}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {analyzing ? 'Analyzing...' : 'Analyze with Claude AI'}
              </button>
              {analyzing && (
                <div className="mt-4 text-center">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mb-2"></div>
                  <p className="text-sm text-slate-600">
                    Analysis in progress... This may take 30-60 seconds.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Initial Information (if provided) */}
              {poster.initialInformation && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <h3 className="font-semibold text-amber-900 mb-2">
                    📝 Initial Information Provided
                  </h3>
                  <p className="text-sm text-amber-800 whitespace-pre-wrap">
                    {poster.initialInformation}
                  </p>
                </div>
              )}

              {/* Validation Notes */}
              {poster.validationNotes && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-900 mb-2">
                    ✓ Validation Results
                  </h3>
                  <p className="text-sm text-blue-800 whitespace-pre-wrap">
                    {poster.validationNotes}
                  </p>
                </div>
              )}

              {/* Identification */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-xl font-bold text-slate-900 mb-4">
                  Identification
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-slate-700">Artist</label>
                    <p className="text-slate-900">{poster.artist || 'Unknown'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">Title</label>
                    <p className="text-slate-900">{poster.title || 'Untitled'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">Date</label>
                    <p className="text-slate-900">
                      {poster.estimatedDate || 'Unknown'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">
                      Dimensions
                    </label>
                    <p className="text-slate-900">
                      {poster.dimensionsEstimate || 'Unknown'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Historical Context */}
              {poster.historicalContext && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-xl font-bold text-slate-900 mb-4">
                    Historical Context
                  </h3>
                  <p className="text-slate-700 whitespace-pre-wrap">
                    {poster.historicalContext}
                  </p>
                </div>
              )}

              {/* Printing Technique */}
              {poster.printingTechnique && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-xl font-bold text-slate-900 mb-4">
                    Printing Technique
                  </h3>
                  <p className="text-slate-700 whitespace-pre-wrap">
                    {poster.printingTechnique}
                  </p>
                </div>
              )}

              {/* Rarity Analysis */}
              {poster.rarityAnalysis && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-xl font-bold text-slate-900 mb-4">
                    Rarity & Comparables
                  </h3>
                  <p className="text-slate-700 whitespace-pre-wrap">
                    {poster.rarityAnalysis}
                  </p>
                </div>
              )}

              {/* Value Insights */}
              {poster.valueInsights && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-xl font-bold text-slate-900 mb-4">
                    Value & Market Insights
                  </h3>
                  <p className="text-slate-700 whitespace-pre-wrap">
                    {poster.valueInsights}
                  </p>
                </div>
              )}

              {/* User Notes */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-xl font-bold text-slate-900 mb-4">Notes</h3>
                <p className="text-sm text-slate-600 mb-3">
                  Add your own notes about this poster
                </p>
                <textarea
                  value={poster.userNotes || ''}
                  onChange={async (e) => {
                    const notes = e.target.value;
                    setPoster({ ...poster, userNotes: notes });
                    // Auto-save
                    try {
                      await fetch(`/api/posters/${posterId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userNotes: notes }),
                      });
                    } catch (err) {
                      console.error('Failed to save notes:', err);
                    }
                  }}
                  placeholder="Enter your notes here..."
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                  rows={4}
                />
                <p className="text-xs text-slate-500 mt-2">
                  Notes are automatically saved
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
