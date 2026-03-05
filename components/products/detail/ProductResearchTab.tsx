'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import type { ProductDetail, LinkedArtistRecord } from '@/types/shopify-product-detail';
import ProductDetailSection from './ProductDetailSection';
import TalkingPointsCard from './TalkingPointsCard';
import ResearchDataSection from './ResearchDataSection';

const RichTextEditor = dynamic(() => import('./RichTextEditor'), {
  ssr: false,
  loading: () => <div className="border border-slate-300 rounded-lg min-h-[200px] bg-slate-50 animate-pulse" />,
});

const DESCRIPTION_TONES = [
  { id: 'standard', label: 'Standard' },
  { id: 'scholarly', label: 'Scholarly' },
  { id: 'concise', label: 'Concise' },
  { id: 'enthusiastic', label: 'Enthusiastic' },
  { id: 'immersive', label: 'Immersive' },
] as const;

interface MetafieldApply {
  namespace: string;
  key: string;
  value: string;
  type: string;
  displayLabel: string;
}

interface ProductResearchTabProps {
  product: ProductDetail;
  formData: {
    title: string;
    productType: string;
    artist: string;
    year: string;
    countryOfOrigin: string[];
    medium: string[];
    height: string;
    width: string;
    itemNotes: string;
  };
  isDirty: boolean;
  mediumOptions: { name: string }[];
  onFieldChange: (field: string, value: string) => void;
  onArrayFieldChange: (field: string, values: string[]) => void;
  onApplyMetafield: (mf: MetafieldApply) => Promise<void>;
  onApplyBodyHtml: (html: string) => Promise<void>;
  onApplyArtist: (artist: LinkedArtistRecord) => Promise<void>;
  onAnalysisComplete: () => void;
}

function ConfidenceBadge({ level, score }: { level: string | null; score: number | null }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    confirmed: { bg: 'bg-green-100', text: 'text-green-700', label: 'Confirmed' },
    likely: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Likely' },
    uncertain: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Uncertain' },
    unknown: { bg: 'bg-slate-100', text: 'text-slate-500', label: 'Unknown' },
  };
  const c = config[level || 'unknown'] || config.unknown;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${c.bg} ${c.text}`}>
      {c.label}
      {score != null && <span className="opacity-70">({score}%)</span>}
    </span>
  );
}

function AttributionBadge({ basis }: { basis: string | null }) {
  const labels: Record<string, { icon: string; label: string }> = {
    visible_signature: { icon: '\u270D\uFE0F', label: 'Visible Signature' },
    printed_credit: { icon: '\uD83D\uDCDD', label: 'Printed Credit' },
    external_knowledge: { icon: '\uD83D\uDCDA', label: 'External Knowledge' },
    stylistic_analysis: { icon: '\uD83C\uDFA8', label: 'Stylistic Analysis' },
    none: { icon: '\u2014', label: 'None' },
  };
  const b = labels[basis || 'none'] || labels.none;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
      {b.icon} {b.label}
    </span>
  );
}

function ContextField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <span className="text-xs text-slate-400">{label}</span>
      <div className={`text-sm ${value ? 'text-slate-700' : 'text-slate-300 italic'}`}>
        {value || 'Not set'}
      </div>
    </div>
  );
}

function convertToHtmlParagraphs(text: string): string {
  return text
    .split(/\n\n+/)
    .filter((p) => p.trim())
    .map((p) => `<p>${p.trim()}</p>`)
    .join('\n');
}

// Inline Apply button shown next to each AI result field
function ApplyButton({
  onClick,
  applied,
  applying,
  label,
}: {
  onClick: () => void;
  applied: boolean;
  applying: boolean;
  label?: string;
}) {
  if (applied) {
    return <span className="text-xs text-green-600 font-medium">Applied</span>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={applying}
      className="text-xs px-2.5 py-1 rounded font-medium bg-violet-600 text-white hover:bg-violet-700 transition-colors cursor-pointer disabled:opacity-50"
    >
      {applying ? 'Applying...' : label || 'Apply'}
    </button>
  );
}

export default function ProductResearchTab({
  product,
  formData,
  isDirty,
  mediumOptions,
  onFieldChange,
  onArrayFieldChange,
  onApplyMetafield,
  onApplyBodyHtml,
  onApplyArtist,
  onAnalysisComplete,
}: ProductResearchTabProps) {
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [skepticalMode, setSkepticalMode] = useState(false);
  const [applyingField, setApplyingField] = useState<string | null>(null);
  const [descriptionTone, setDescriptionTone] = useState('standard');
  const [descriptionHtml, setDescriptionHtml] = useState('');
  const [artistMatch, setArtistMatch] = useState<LinkedArtistRecord | null>(null);
  const [artistSearching, setArtistSearching] = useState(false);
  const [artistNotFound, setArtistNotFound] = useState(false);
  const [addingArtist, setAddingArtist] = useState(false);

  const lp = product.linkedPoster;
  const hasImages = product.images && product.images.length > 0;
  const hasResults = lp?.analysisCompleted;
  const extractedYear = lp?.estimatedDate?.match(/\b(1[5-9]\d\d|20[0-2]\d)\b/)?.[1] || null;

  // Derive "applied" state by comparing current Shopify values with AI suggestions
  // This persists across navigation since it's based on actual product data
  function isFieldApplied(fieldId: string): boolean {
    if (!lp) return false;
    const mf = product.metafields;
    switch (fieldId) {
      case 'artist': {
        const canonicalName = lp.linkedArtist?.name || artistMatch?.name || lp.artist;
        return !!canonicalName && mf.artist === canonicalName;
      }
      case 'year': return !!extractedYear && mf.year === extractedYear;
      case 'printer': return !!lp.printer && mf.printer === lp.printer;
      case 'publisher': return !!lp.publisher && mf.publisher === lp.publisher;
      case 'history': return !!lp.historicalContext && mf.history === lp.historicalContext;
      case 'concise': return !!lp.productDescriptions?.concise && mf.conciseDescription === lp.productDescriptions.concise;
      case 'description': return !!descriptionHtml && product.bodyHtml === descriptionHtml;
      default: return false;
    }
  }

  // Initialize/reset description editor when descriptions change (new analysis or page load)
  const standardDesc = lp?.productDescriptions?.standard || '';
  useEffect(() => {
    if (standardDesc) {
      setDescriptionTone('standard');
      setDescriptionHtml(convertToHtmlParagraphs(standardDesc));
    }
  }, [standardDesc]);

  // Search managed artist list when AI identified an artist but no DB link exists
  const aiArtistName = lp?.artist || null;
  const linkedArtist = lp?.linkedArtist || null;
  useEffect(() => {
    if (!aiArtistName || linkedArtist) {
      // No AI artist, or already linked from analysis -- no search needed
      setArtistMatch(null);
      setArtistNotFound(false);
      return;
    }
    let cancelled = false;
    async function searchArtist() {
      setArtistSearching(true);
      setArtistNotFound(false);
      try {
        const res = await fetch(`/api/managed-lists/artists?search=${encodeURIComponent(aiArtistName!)}`);
        if (!res.ok) throw new Error('Search failed');
        const data = await res.json();
        if (cancelled) return;
        if (data.items && data.items.length > 0) {
          const best = data.items[0];
          setArtistMatch({
            id: best.id,
            name: best.name,
            aliases: best.aliases || [],
            nationality: best.nationality || null,
            birthYear: best.birthYear || null,
            deathYear: best.deathYear || null,
            wikipediaUrl: best.wikipediaUrl || null,
            bio: best.bio || null,
            imageUrl: best.imageUrl || null,
            verified: !!best.verified,
          });
          setArtistNotFound(false);
        } else {
          setArtistMatch(null);
          setArtistNotFound(true);
        }
      } catch {
        if (!cancelled) setArtistNotFound(true);
      } finally {
        if (!cancelled) setArtistSearching(false);
      }
    }
    searchArtist();
    return () => { cancelled = true; };
  }, [aiArtistName, linkedArtist]);

  // The resolved artist record: from DB link, search match, or null
  const resolvedArtist = linkedArtist || artistMatch;

  async function handleAddArtist() {
    if (!lp?.artist || !lp.posterId) return;
    setAddingArtist(true);
    try {
      const res = await fetch(`/api/posters/${lp.posterId}/artist-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artistName: lp.artist,
          confidence: lp.artistConfidence || 'confirmed',
        }),
      });
      if (!res.ok) throw new Error('Failed to add artist');
      const data = await res.json();
      if (data.artist) {
        setArtistMatch(data.artist);
        setArtistNotFound(false);
      }
    } catch {
      // Keep artistNotFound state
    } finally {
      setAddingArtist(false);
    }
  }

  async function applyMetafield(fieldId: string, mf: MetafieldApply) {
    setApplyingField(fieldId);
    try {
      await onApplyMetafield(mf);
    } catch {
      // Error handled by parent
    } finally {
      setApplyingField(null);
    }
  }

  async function handleRunAnalysis() {
    setAnalyzing(true);
    setAnalysisError(null);
    try {
      const res = await fetch(`/api/shopify/products/${product.id}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skepticalMode,
          forceReanalyze: !!hasResults,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.details || data.error || 'Analysis failed');
      }
      // Auto-write talking points to Shopify
      if (data.analysis?.talkingPoints?.length) {
        onApplyMetafield({
          namespace: 'custom',
          key: 'talking_points',
          value: JSON.stringify(data.analysis.talkingPoints),
          type: 'json',
          displayLabel: 'Talking Points',
        }).catch(() => {}); // Non-critical
      }
      onAnalysisComplete();
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* ── Context Summary ── */}
      <ProductDetailSection title="Context Summary" badge="What AI Receives" defaultOpen>
        <div className="pt-4">
          {isDirty && (
            <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
              You have unsaved changes. Save first so the AI receives your latest edits.
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <ContextField label="Title" value={formData.title} />
            <ContextField label="Product Type" value={formData.productType} />
            <ContextField label="Artist" value={formData.artist} />
            <ContextField label="Year" value={formData.year} />
            <ContextField label="Country" value={formData.countryOfOrigin.join(', ') || null} />
            <ContextField label="Medium" value={formData.medium.join(', ') || null} />
            <ContextField label="Dimensions" value={
              formData.height || formData.width
                ? `${formData.height || '?'}" x ${formData.width || '?'}"`
                : null
            } />
            <ContextField label="Item Notes" value={
              formData.itemNotes
                ? (formData.itemNotes.length > 80 ? formData.itemNotes.slice(0, 80) + '...' : formData.itemNotes)
                : null
            } />
          </div>
        </div>
      </ProductDetailSection>

      {/* ── Item Notes (synced with Listing tab) ── */}
      <ProductDetailSection title="Item Notes" defaultOpen={!!formData.itemNotes}>
        <div className="pt-4">
          <textarea
            value={formData.itemNotes}
            onChange={(e) => onFieldChange('itemNotes', e.target.value)}
            placeholder="Auction listing text, provenance notes, attribution hints..."
            rows={4}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none text-sm resize-y"
          />
          <p className="text-xs text-slate-400 mt-1">Research-relevant notes. Also editable on the Listing tab.</p>
        </div>
      </ProductDetailSection>

      {/* ── Analysis Controls ── */}
      <ProductDetailSection title="AI Analysis" defaultOpen>
        <div className="pt-4 space-y-4">
          {/* Skeptical Mode */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={skepticalMode}
              onChange={(e) => setSkepticalMode(e.target.checked)}
              className="mt-0.5 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
            />
            <div>
              <span className="text-sm font-medium text-slate-700">Skeptical Mode</span>
              <p className="text-xs text-slate-400">Ignore all existing data. Analyze the image with fresh eyes.</p>
            </div>
          </label>

          {/* Run Analysis Button */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleRunAnalysis}
              disabled={!hasImages || analyzing}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                !hasImages || analyzing
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-violet-600 text-white hover:bg-violet-700 cursor-pointer'
              }`}
            >
              {analyzing ? (
                <span className="inline-flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Analyzing...
                </span>
              ) : hasResults ? 'Re-analyze' : 'Run Analysis'}
            </button>
            <span className="text-xs text-slate-400">Uses Claude Opus (~$0.15-0.60)</span>
          </div>

          {!hasImages && (
            <p className="text-xs text-amber-600">Upload at least one product image before running analysis.</p>
          )}

          {analysisError && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {analysisError}
            </div>
          )}
        </div>
      </ProductDetailSection>

      {/* ── Results ── */}
      {hasResults && lp && (
        <>
          {/* Identification */}
          <ProductDetailSection title="Identification" defaultOpen>
            <div className="pt-4 space-y-4">
              {/* Artist */}
              <div>
                <label className="block text-sm font-medium text-slate-500 mb-1">Artist</label>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-slate-800">{lp.artist || 'Unknown'}</span>
                  <ConfidenceBadge level={lp.artistConfidence} score={lp.artistConfidenceScore} />
                  <AttributionBadge basis={lp.attributionBasis} />
                </div>
                {lp.artistSource && (
                  <p className="text-xs text-slate-400 mt-1">Source: {lp.artistSource}</p>
                )}

                {/* Managed list match card */}
                {lp.artist && (
                  <div className="mt-2">
                    {artistSearching && (
                      <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-400">
                        Searching artist database...
                      </div>
                    )}
                    {resolvedArtist && (
                      <div className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-medium text-slate-800">{resolvedArtist.name}</span>
                              {resolvedArtist.verified && (
                                <span className="text-green-600 text-xs" title="Verified profile">&#x2713;</span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {[
                                resolvedArtist.nationality,
                                resolvedArtist.birthYear && resolvedArtist.deathYear
                                  ? `${resolvedArtist.birthYear}\u2013${resolvedArtist.deathYear}`
                                  : resolvedArtist.birthYear
                                    ? `b. ${resolvedArtist.birthYear}`
                                    : null,
                              ].filter(Boolean).join(', ') || 'No profile data'}
                            </p>
                            {resolvedArtist.name.toLowerCase() !== lp.artist!.toLowerCase() && (
                              <p className="text-xs text-amber-600 mt-0.5">
                                AI identified as: &ldquo;{lp.artist}&rdquo; (alias match)
                              </p>
                            )}
                          </div>
                          <ApplyButton
                            onClick={async () => {
                              setApplyingField('artist');
                              try {
                                await onApplyArtist(resolvedArtist);
                              } catch { /* handled by parent */ } finally {
                                setApplyingField(null);
                              }
                            }}
                            applied={isFieldApplied('artist')}
                            applying={applyingField === 'artist'}
                          />
                        </div>
                      </div>
                    )}
                    {artistNotFound && !artistSearching && (
                      <div className="px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-sm text-amber-800">Not in artist database</p>
                            <p className="text-xs text-amber-600 mt-0.5">Will search Wikipedia for profile data</p>
                          </div>
                          <button
                            type="button"
                            onClick={handleAddArtist}
                            disabled={addingArtist}
                            className="text-xs px-2.5 py-1 rounded font-medium bg-amber-600 text-white hover:bg-amber-700 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {addingArtist ? 'Adding...' : 'Add Artist'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Verification Checklist */}
              {lp.artistVerification && (
                <VerificationChecklist v={lp.artistVerification} />
              )}

              {/* Date */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-500 mb-1">Date / Period</label>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-slate-800">{lp.estimatedDate || '-'}</span>
                    {lp.dateConfidence && (
                      <ConfidenceBadge level={lp.dateConfidence} score={null} />
                    )}
                    {extractedYear && (
                      <ApplyButton
                        onClick={() => applyMetafield('year', {
                          namespace: 'specs',
                          key: 'year',
                          value: extractedYear,
                          type: 'single_line_text_field',
                          displayLabel: 'Year',
                        })}
                        applied={isFieldApplied('year')}
                        applying={applyingField === 'year'}
                        label={`Apply ${extractedYear}`}
                      />
                    )}
                  </div>
                  {lp.dateSource && (
                    <p className="text-xs text-slate-400 mt-1">Source: {lp.dateSource}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-500 mb-1">Printing Technique</label>
                  <span className="text-sm text-slate-800">{lp.printingTechnique || '-'}</span>
                  {mediumOptions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {mediumOptions.map((opt) => {
                        const selected = formData.medium.some((m) => m.toLowerCase() === opt.name.toLowerCase());
                        const isMatch = lp.printingTechnique
                          ? opt.name.toLowerCase().includes(lp.printingTechnique.toLowerCase())
                            || lp.printingTechnique.toLowerCase().includes(opt.name.toLowerCase())
                          : false;
                        return (
                          <button
                            key={opt.name}
                            type="button"
                            onClick={() => {
                              if (selected) {
                                onArrayFieldChange('medium', formData.medium.filter((m) => m.toLowerCase() !== opt.name.toLowerCase()));
                              } else {
                                onArrayFieldChange('medium', [...formData.medium, opt.name]);
                              }
                            }}
                            className={`px-2 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer ${
                              selected
                                ? 'bg-violet-600 text-white'
                                : isMatch
                                  ? 'bg-violet-100 text-violet-700 ring-1 ring-violet-300'
                                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                            }`}
                          >
                            {opt.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Printer / Publisher */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-500 mb-1">Printer</label>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-slate-800">{lp.printer || '-'}</span>
                    {lp.printerConfidence && (
                      <ConfidenceBadge level={lp.printerConfidence} score={null} />
                    )}
                    {lp.printer && (
                      <ApplyButton
                        onClick={() => applyMetafield('printer', {
                          namespace: 'jadepuma',
                          key: 'printer',
                          value: lp.printer!,
                          type: 'single_line_text_field',
                          displayLabel: 'Printer',
                        })}
                        applied={isFieldApplied('printer')}
                        applying={applyingField === 'printer'}
                      />
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-500 mb-1">Publisher</label>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-slate-800">{lp.publisher || '-'}</span>
                    {lp.publisherConfidence && (
                      <ConfidenceBadge level={lp.publisherConfidence} score={null} />
                    )}
                    {lp.publisher && (
                      <ApplyButton
                        onClick={() => applyMetafield('publisher', {
                          namespace: 'jadepuma',
                          key: 'publisher',
                          value: lp.publisher!,
                          type: 'single_line_text_field',
                          displayLabel: 'Publisher',
                        })}
                        applied={isFieldApplied('publisher')}
                        applying={applyingField === 'publisher'}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </ProductDetailSection>

          {/* Talking Points */}
          {lp.talkingPoints.length > 0 && (
            <TalkingPointsCard points={lp.talkingPoints} />
          )}

          {/* Product Descriptions */}
          {lp.productDescriptions && (
            <ProductDetailSection title="Product Descriptions" defaultOpen>
              <div className="pt-4">
                {/* Tone pills */}
                <div className="flex gap-1 mb-3">
                  {DESCRIPTION_TONES.map((tone) => {
                    const text = lp.productDescriptions![tone.id as keyof typeof lp.productDescriptions];
                    return (
                      <button
                        key={tone.id}
                        type="button"
                        disabled={!text}
                        onClick={() => {
                          setDescriptionTone(tone.id);
                          setDescriptionHtml(text ? convertToHtmlParagraphs(text) : '');
                        }}
                        className={`px-3 py-1.5 rounded text-xs font-medium transition-colors cursor-pointer ${
                          descriptionTone === tone.id
                            ? 'bg-violet-100 text-violet-700'
                            : !text
                              ? 'bg-slate-50 text-slate-300 cursor-not-allowed'
                              : 'text-slate-500 hover:bg-slate-100'
                        }`}
                      >
                        {tone.label}
                      </button>
                    );
                  })}
                </div>

                {/* Editor */}
                <RichTextEditor
                  value={descriptionHtml}
                  onChange={setDescriptionHtml}
                  placeholder="Select a tone above or type a description..."
                />
                {descriptionHtml && (
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <ApplyButton
                      onClick={async () => {
                        setApplyingField('description');
                        try {
                          await onApplyBodyHtml(descriptionHtml);
                        } catch { /* handled by parent */ } finally {
                          setApplyingField(null);
                        }
                      }}
                      applied={isFieldApplied('description')}
                      applying={applyingField === 'description'}
                      label="Apply as Description"
                    />
                    <span className="text-xs text-slate-400">Saves to Shopify</span>
                  </div>
                )}

                {/* Concise Description metafield */}
                {lp.productDescriptions.concise && (
                  <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                    <ApplyButton
                      onClick={() => applyMetafield('concise', {
                        namespace: 'jadepuma',
                        key: 'concise_description',
                        value: lp.productDescriptions!.concise,
                        type: 'multi_line_text_field',
                        displayLabel: 'Concise Description',
                      })}
                      applied={isFieldApplied('concise')}
                      applying={applyingField === 'concise'}
                      label="Apply Concise Description"
                    />
                    <span className="text-xs text-slate-400">Writes to Shopify metafield</span>
                  </div>
                )}
              </div>
            </ProductDetailSection>
          )}

          {/* Historical Context */}
          {(lp.historicalContext || lp.timeAndPlace.world || lp.designProfile.periodMovement) && (
            <ProductDetailSection title="Historical Context" defaultOpen>
              <div className="pt-4 space-y-4">
                {lp.designProfile.periodMovement && (
                  <div>
                    <label className="block text-sm font-medium text-slate-500 mb-1">Period / Movement</label>
                    <p className="text-sm text-slate-700">{lp.designProfile.periodMovement}</p>
                  </div>
                )}
                {lp.culturalSignificance && (
                  <div>
                    <label className="block text-sm font-medium text-slate-500 mb-1">Cultural Significance</label>
                    <p className="text-sm text-slate-700">{lp.culturalSignificance}</p>
                  </div>
                )}
                {lp.historicalContext && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-slate-500">Historical Context</label>
                      <ApplyButton
                        onClick={() => applyMetafield('history', {
                          namespace: 'custom',
                          key: 'history',
                          value: lp.historicalContext!,
                          type: 'multi_line_text_field',
                          displayLabel: 'Historical Context',
                        })}
                        applied={isFieldApplied('history')}
                        applying={applyingField === 'history'}
                      />
                    </div>
                    <p className="text-sm text-slate-700">{lp.historicalContext}</p>
                  </div>
                )}
                {(lp.timeAndPlace.world || lp.timeAndPlace.regional || lp.timeAndPlace.local) && (
                  <div>
                    <label className="block text-sm font-medium text-slate-500 mb-2">Time & Place</label>
                    <div className="space-y-2">
                      {lp.timeAndPlace.world && (
                        <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg">
                          <span className="text-xs font-medium text-slate-400 uppercase">World</span>
                          <p className="text-sm text-slate-700 mt-0.5">{lp.timeAndPlace.world}</p>
                        </div>
                      )}
                      {lp.timeAndPlace.regional && (
                        <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg">
                          <span className="text-xs font-medium text-slate-400 uppercase">Regional</span>
                          <p className="text-sm text-slate-700 mt-0.5">{lp.timeAndPlace.regional}</p>
                        </div>
                      )}
                      {lp.timeAndPlace.local && (
                        <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg">
                          <span className="text-xs font-medium text-slate-400 uppercase">Local</span>
                          <p className="text-sm text-slate-700 mt-0.5">{lp.timeAndPlace.local}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </ProductDetailSection>
          )}

          {/* Source Citations */}
          {lp.sourceCitations.length > 0 && (
            <ProductDetailSection title="Source Citations" defaultOpen>
              <div className="pt-4 space-y-2">
                {lp.sourceCitations.map((cite, i) => (
                  <div key={i} className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm text-slate-700">{cite.claim}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {cite.source}
                          {cite.url && cite.url !== '#' && (
                            <> &middot; <a href={cite.url} target="_blank" rel="noopener noreferrer" className="text-violet-500 hover:underline">Link</a></>
                          )}
                        </p>
                      </div>
                      <ReliabilityBadge level={cite.reliability} />
                    </div>
                  </div>
                ))}
              </div>
            </ProductDetailSection>
          )}

          {/* Validation Notes */}
          {lp.validationNotes && (
            <ProductDetailSection title="Validation Notes" defaultOpen={!!lp.validationNotes}>
              <div className="pt-4">
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{lp.validationNotes}</p>
              </div>
            </ProductDetailSection>
          )}

          {/* Research Data (metafields) */}
          <ProductDetailSection title="Research Data" badge="Read-Only" defaultOpen={false}>
            <ResearchDataSection metafields={product.metafields} />
          </ProductDetailSection>
        </>
      )}

      {/* No results yet placeholder */}
      {!hasResults && !analyzing && (
        <div className="bg-violet-50 border border-violet-200 rounded-lg p-6 text-center">
          <div className="text-violet-400 mb-2">
            <svg className="w-10 h-10 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <h3 className="text-sm font-medium text-violet-700 mb-1">No Analysis Yet</h3>
          <p className="text-xs text-violet-500">
            Run AI analysis above to get artist identification, date analysis,
            product descriptions, historical context, and source citations.
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Sub-components ── */

function VerificationChecklist({ v }: { v: NonNullable<ProductResearchTabProps['product']['linkedPoster']>['artistVerification'] }) {
  if (!v) return null;
  const checks = [
    { label: 'Signature readable', ok: v.signatureReadable },
    { label: 'Profession verified', ok: v.professionVerified },
    { label: 'Era matches', ok: v.eraMatches },
    { label: 'Style matches', ok: v.styleMatches },
  ];
  return (
    <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg">
      <div className="flex items-center gap-4 flex-wrap text-xs">
        {checks.map((c) => (
          <span key={c.label} className={`inline-flex items-center gap-1 ${c.ok ? 'text-green-600' : 'text-slate-400'}`}>
            {c.ok ? '\u2713' : '\u2717'} {c.label}
          </span>
        ))}
      </div>
      {v.signatureText && (
        <p className="text-xs text-slate-500 mt-1">Signature: &ldquo;{v.signatureText}&rdquo;</p>
      )}
      {v.verificationNotes && (
        <p className="text-xs text-slate-400 mt-1">{v.verificationNotes}</p>
      )}
    </div>
  );
}

function ReliabilityBadge({ level }: { level: string }) {
  const config: Record<string, { bg: string; text: string }> = {
    high: { bg: 'bg-green-100', text: 'text-green-700' },
    medium: { bg: 'bg-amber-100', text: 'text-amber-700' },
    low: { bg: 'bg-red-100', text: 'text-red-700' },
  };
  const c = config[level] || config.medium;
  return (
    <span className={`flex-shrink-0 px-2 py-0.5 rounded text-xs font-medium ${c.bg} ${c.text}`}>
      {level}
    </span>
  );
}
