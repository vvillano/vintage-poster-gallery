'use client';

import { useState, useEffect, useRef } from 'react';
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
    colors: string[];
    tags: string[];
    height: string;
    width: string;
    itemNotes: string;
  };
  isDirty: boolean;
  mediumOptions: { name: string }[];
  countryOptions: string[];
  colorOptions: { name: string; hexCode: string | null }[];
  tagOptions: { name: string }[];
  suggestedColors: string[];
  suggestingColors: boolean;
  suggestedTags: string[];
  autoTags: string[];
  onFieldChange: (field: string, value: string) => void;
  onArrayFieldChange: (field: string, values: string[]) => void;
  onApplyMetafield: (mf: MetafieldApply) => Promise<void>;
  onApplyBodyHtml: (html: string, appendMetadata?: boolean) => Promise<void>;
  onApplyArtist: (artist: LinkedArtistRecord) => Promise<void>;
  onApplyTags: (tags: string[]) => Promise<void>;
  onColorsAutoApply: (colors: string[]) => void;
  onCountryAutoApply: (countries: string[]) => void;
  onMediumAutoApply: (medium: string[]) => void;
  onAnalysisComplete: () => void;
}

function ConfidenceBadge({ level, score, onClick, isOpen }: {
  level: string | null;
  score: number | null;
  onClick?: () => void;
  isOpen?: boolean;
}) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    confirmed: { bg: 'bg-green-100', text: 'text-green-700', label: 'Confirmed' },
    likely: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Likely' },
    uncertain: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Uncertain' },
    unknown: { bg: 'bg-slate-100', text: 'text-slate-500', label: 'Unknown' },
  };
  const c = config[level || 'unknown'] || config.unknown;
  const content = (
    <>
      {c.label}
      {score != null && <span className="opacity-70">({score}%)</span>}
      {onClick && (
        <svg
          className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-90' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      )}
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium cursor-pointer ${c.bg} ${c.text}`}
      >
        {content}
      </button>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${c.bg} ${c.text}`}>
      {content}
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

/**
 * Extract a numeric year from an AI date string using business rules:
 * - Exact year for high-confidence dates: "1967" -> 1967
 * - Decade-start for narrowed ranges: "early 1960s" -> 1960
 * - Late decade: "late 1950s" -> 1958
 * - Mid-range for broad decades: "1950s" -> 1955
 * - Spanning decades: "1940s-1950s" -> 1945
 * Returns the numeric year string or null.
 */
function extractYearFromDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const s = dateStr.toLowerCase().trim();

  // Exact year with high confidence: "1967", "circa 1967", "c. 1942"
  const exactMatch = s.match(/\b(1[5-9]\d\d|20[0-2]\d)\b/);

  // Check for decade patterns first (they also contain 4-digit years)
  // "early 1960s", "early 60s"
  const earlyDecade = s.match(/early\s+(?:(\d{4})s|(\d{2})s)/);
  if (earlyDecade) {
    const decade = earlyDecade[1]
      ? parseInt(earlyDecade[1])
      : 1900 + parseInt(earlyDecade[2]);
    return String(decade);
  }

  // "late 1950s", "late 50s"
  const lateDecade = s.match(/late\s+(?:(\d{4})s|(\d{2})s)/);
  if (lateDecade) {
    const decade = lateDecade[1]
      ? parseInt(lateDecade[1])
      : 1900 + parseInt(lateDecade[2]);
    return String(decade + 8);
  }

  // "mid-1950s", "mid 1950s"
  const midDecade = s.match(/mid[-\s]+(?:(\d{4})s|(\d{2})s)/);
  if (midDecade) {
    const decade = midDecade[1]
      ? parseInt(midDecade[1])
      : 1900 + parseInt(midDecade[2]);
    return String(decade + 5);
  }

  // Spanning decades: "1940s-1950s", "1940s to 1950s"
  const spanMatch = s.match(/(\d{4})s\s*[-\u2013to]+\s*(\d{4})s/);
  if (spanMatch) {
    const start = parseInt(spanMatch[1]);
    const end = parseInt(spanMatch[2]);
    return String(Math.round((start + end) / 2));
  }

  // Plain decade: "1950s", "the 1960s"
  const plainDecade = s.match(/\b(\d{4})s\b/);
  if (plainDecade) {
    return String(parseInt(plainDecade[1]) + 5);
  }

  // Short decade: "the 50s", "60s"
  const shortDecade = s.match(/\b(\d{2})s\b/);
  if (shortDecade) {
    const num = parseInt(shortDecade[1]);
    const decade = num >= 50 ? 1800 + num : 1900 + num;
    return String(decade + 5);
  }

  // Fallback: exact year match
  if (exactMatch) {
    return exactMatch[1];
  }

  return null;
}

function convertToHtmlParagraphs(text: string): string {
  // Split on double newlines first; if that only produces one block, fall back to single newlines
  let parts = text.split(/\n\n+/).filter((p) => p.trim());
  if (parts.length <= 1) {
    parts = text.split(/\n/).filter((p) => p.trim());
  }
  return parts.map((p) => `<p>${p.trim()}</p>`).join('\n');
}

function getContrastTextColor(hexColor: string | null): string {
  if (!hexColor) return 'text-slate-700';
  const hex = hexColor.replace('#', '');
  if (hex.length !== 6) return 'text-slate-700';
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? 'text-slate-900' : 'text-white';
}

// Inline Apply button shown next to each AI result field
function ShopifyIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M15.337 23.979l7.216-1.561s-2.604-17.613-2.625-17.73c-.018-.116-.114-.192-.211-.192s-1.929-.136-1.929-.136-1.275-1.274-1.439-1.411c-.045-.037-.075-.057-.121-.074l-.914 21.104h.023zM11.71 11.305s-.81-.424-1.774-.424c-1.447 0-1.504.906-1.504 1.141 0 1.232 3.24 1.715 3.24 4.629 0 2.295-1.44 3.76-3.406 3.76-2.354 0-3.54-1.465-3.54-1.465l.646-2.086s1.245 1.066 2.28 1.066c.675 0 .975-.545.975-.932 0-1.619-2.654-1.694-2.654-4.359-.034-2.237 1.571-4.416 4.827-4.416 1.257 0 1.875.361 1.875.361l-.945 2.715-.02.01zM11.17.83c.136 0 .271.038.405.135-.984.465-2.064 1.639-2.508 3.992-.656.213-1.293.405-1.889.578C7.697 3.75 8.951.84 11.17.84V.83zm1.235 2.949v.135c-.754.232-1.583.484-2.394.736.466-1.777 1.333-2.645 2.085-2.971.193.501.309 1.176.309 2.1zm.539-2.234c.694.074 1.141.867 1.429 1.755-.349.114-.735.231-1.158.366v-.252c0-.752-.096-1.371-.271-1.871v.002zm2.992 1.289c-.02 0-.06.021-.078.021s-.289.075-.714.21c-.423-1.233-1.176-2.37-2.508-2.37h-.115C12.135.209 11.669 0 11.265 0 8.159 0 6.675 3.877 6.21 5.846c-1.194.365-2.063.636-2.16.674-.675.213-.694.232-.772.87-.075.462-1.83 14.063-1.83 14.063L15.009 24l.927-21.166z" />
    </svg>
  );
}

function ApplyButton({
  onClick,
  applied,
  applying,
  label,
  appliedLabel,
}: {
  onClick: () => void;
  applied: boolean;
  applying: boolean;
  label?: string;
  appliedLabel?: string;
}) {
  if (applied) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
        <ShopifyIcon />
        {appliedLabel || 'Applied'}
      </span>
    );
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
  countryOptions,
  colorOptions,
  tagOptions,
  suggestedColors,
  suggestingColors,
  suggestedTags,
  autoTags,
  onFieldChange,
  onArrayFieldChange,
  onApplyMetafield,
  onApplyBodyHtml,
  onApplyArtist,
  onApplyTags,
  onColorsAutoApply,
  onCountryAutoApply,
  onMediumAutoApply,
  onAnalysisComplete,
}: ProductResearchTabProps) {
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [skepticalMode, setSkepticalMode] = useState(false);
  const [applyingField, setApplyingField] = useState<string | null>(null);
  const [showLiveConcise, setShowLiveConcise] = useState(false);
  const [showAllColors, setShowAllColors] = useState(false);
  const [tagSearch, setTagSearch] = useState('');
  const [descriptionTone, setDescriptionTone] = useState('standard');
  const [descriptionHtml, setDescriptionHtml] = useState('');
  const [descriptionDirty, setDescriptionDirty] = useState(false);
  // Track user edits per tone so they persist when toggling between tabs
  const descriptionEditsRef = useRef<Record<string, string>>({});
  const [artistMatch, setArtistMatch] = useState<LinkedArtistRecord | null>(null);
  const [artistSearching, setArtistSearching] = useState(false);
  const [artistNotFound, setArtistNotFound] = useState(false);
  const [addingArtist, setAddingArtist] = useState(false);
  const [artistDetailOpen, setArtistDetailOpen] = useState(false);
  const [artistVerificationOpen, setArtistVerificationOpen] = useState(false);
  const [printerConfidenceOpen, setPrinterConfidenceOpen] = useState(false);

  const lp = product.linkedPoster;
  const hasImages = product.images && product.images.length > 0;
  const hasResults = lp?.analysisCompleted;
  const extractedYear = extractYearFromDate(lp?.estimatedDate);

  // Normalize HTML for comparison (TipTap may strip whitespace between tags)
  function normalizeHtml(html: string): string {
    return html.replace(/>\s+</g, '><').trim();
  }

  // Determine which description tone is currently live in Shopify
  // Checks both saved edits and original AI text for each tone
  function getAppliedDescriptionTone(): string | null {
    if (!product.bodyHtml || !lp?.productDescriptions) return null;
    const shopifyNorm = normalizeHtml(product.bodyHtml);
    for (const tone of DESCRIPTION_TONES) {
      // Check saved edit first (user may have modified this tone)
      const savedEdit = descriptionEditsRef.current[tone.id];
      if (savedEdit && shopifyNorm === normalizeHtml(savedEdit)) {
        return tone.id;
      }
      // Then check original AI text
      const text = lp.productDescriptions[tone.id as keyof typeof lp.productDescriptions];
      if (text && shopifyNorm === normalizeHtml(convertToHtmlParagraphs(text))) {
        return tone.id;
      }
    }
    return null;
  }
  const appliedDescTone = getAppliedDescriptionTone();
  const appliedDescToneLabel = appliedDescTone
    ? DESCRIPTION_TONES.find((t) => t.id === appliedDescTone)?.label || null
    : null;

  // Derive "applied" state by comparing current Shopify values with AI suggestions
  // This persists across navigation since it's based on actual product data
  function isFieldApplied(fieldId: string): boolean {
    const mf = product.metafields;
    switch (fieldId) {
      case 'artist': {
        if (!lp) return false;
        const canonicalName = lp.linkedArtist?.name || artistMatch?.name || lp.artist;
        return !!canonicalName && mf.artist === canonicalName;
      }
      case 'year': return !!lp && !!extractedYear && mf.year === extractedYear;
      case 'printer': return !!lp?.printer && mf.printer === lp.printer;
      case 'publisher': return !!lp?.publisher && mf.publisher === lp.publisher;
      case 'history': return !!lp?.historicalContext && mf.history === lp.historicalContext;
      case 'artistBio': return !!lp?.linkedArtist?.bio && mf.artistBio === lp.linkedArtist.bio;
      case 'concise': return !!lp?.productDescriptions?.concise && mf.conciseDescription === lp.productDescriptions.concise;
      case 'medium': {
        if (!formData.medium.length) return false;
        try {
          const current = mf.medium ? JSON.parse(mf.medium) : [];
          return JSON.stringify([...formData.medium].sort()) === JSON.stringify([...current].sort());
        } catch { return false; }
      }
      case 'country': {
        if (!formData.countryOfOrigin.length) return false;
        try {
          const current = mf.countryOfOrigin ? JSON.parse(mf.countryOfOrigin) : [];
          return JSON.stringify([...formData.countryOfOrigin].sort()) === JSON.stringify([...current].sort());
        } catch { return false; }
      }
      case 'colors': {
        if (!formData.colors.length) return false;
        try {
          const current = mf.color ? JSON.parse(mf.color) : [];
          return JSON.stringify([...formData.colors].sort()) === JSON.stringify([...current].sort());
        } catch { return false; }
      }
      case 'tags': {
        return JSON.stringify([...formData.tags].sort()) === JSON.stringify([...product.tags].sort());
      }
      case 'artist-manual': {
        return !!formData.artist && mf.artist === formData.artist;
      }
      case 'year-manual': {
        return !!formData.year && mf.year === formData.year;
      }
      case 'description': {
        if (!descriptionHtml || !product.bodyHtml) return false;
        return normalizeHtml(descriptionHtml) === normalizeHtml(product.bodyHtml);
      }
      default: return false;
    }
  }

  // Initialize/reset description editor when descriptions change (new analysis or page load)
  // If a tone is already applied to Shopify, start on that tone; if edited, show "live" tab
  const descriptionsJson = lp?.productDescriptions ? JSON.stringify(lp.productDescriptions) : '';
  useEffect(() => {
    if (!lp?.productDescriptions) {
      // No AI descriptions -- show live Shopify description if it exists
      if (product.bodyHtml && !descriptionHtml) {
        setDescriptionTone('live');
        setDescriptionHtml(product.bodyHtml);
      }
      return;
    }
    const descs = lp.productDescriptions;

    // Check if any AI tone matches what's live in Shopify
    if (product.bodyHtml) {
      const shopifyNorm = product.bodyHtml.replace(/>\s+</g, '><').trim();
      for (const tone of DESCRIPTION_TONES) {
        const text = descs[tone.id as keyof typeof descs];
        if (text) {
          const toneHtml = convertToHtmlParagraphs(text);
          if (shopifyNorm === toneHtml.replace(/>\s+</g, '><').trim()) {
            setDescriptionTone(tone.id);
            setDescriptionHtml(toneHtml);
            return;
          }
        }
      }

      // No AI tone matched but there IS a live description -- show "live" tab
      setDescriptionTone('live');
      setDescriptionHtml(product.bodyHtml);
      return;
    }

    // No live description -- default to standard
    if (descs.standard) {
      setDescriptionTone('standard');
      setDescriptionHtml(convertToHtmlParagraphs(descs.standard));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [descriptionsJson]);

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
      // When applying artist manually, also update the "Artist: X" tag
      if (fieldId === 'artist-manual' && mf.value) {
        const canonicalTag = `Artist: ${mf.value}`;
        const updatedTags = formData.tags.filter(t => !t.toLowerCase().startsWith('artist:'));
        updatedTags.push(canonicalTag);
        onApplyTags(updatedTags);
      }
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
      <ProductDetailSection
        title="Context Summary"
        badge="What AI Receives"
        secondaryBadge={lp?.analysisDate ? `Analyzed ${new Date(lp.analysisDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} ${new Date(lp.analysisDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : undefined}
      >
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
            <ContextField label="Colors" value={formData.colors.join(', ') || null} />
            <ContextField label="Tags" value={
              formData.tags.length > 0
                ? (formData.tags.length > 5
                    ? `${formData.tags.slice(0, 5).join(', ')} +${formData.tags.length - 5} more`
                    : formData.tags.join(', '))
                : null
            } />
            <ContextField label="Item Notes" value={
              formData.itemNotes
                ? (formData.itemNotes.length > 80 ? formData.itemNotes.slice(0, 80) + '...' : formData.itemNotes)
                : null
            } />
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">How Analysis Works</h3>
            <ol className="text-xs text-slate-500 space-y-1 list-decimal list-inside">
              <li><span className="font-medium text-slate-600">Visual inspection</span> &ndash; Claude Opus examines the image for signatures, style, printing technique, and era markers</li>
              <li><span className="font-medium text-slate-600">Web verification</span> &ndash; Google Lens + dealer site cross-referencing builds artist/date consensus from multiple sources</li>
              <li><span className="font-medium text-slate-600">Conflict resolution</span> &ndash; Claude Sonnet adjudicates when web evidence disagrees with visual analysis</li>
              <li><span className="font-medium text-slate-600">Entity linking</span> &ndash; Auto-matches identifications to known artists, printers, and publishers in our database</li>
              <li><span className="font-medium text-slate-600">Confidence scoring</span> &ndash; Each identification gets a confidence level based on evidence strength and source agreement</li>
            </ol>
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

      {/* ── Identification (always visible) ── */}
      <ProductDetailSection title="Identification" defaultOpen>
            <div className="pt-4 space-y-4">
              {/* Artist */}
              {lp?.artist ? (
              <div>
                <label className="block text-sm font-medium text-slate-500 mb-1">Artist</label>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-slate-800">{lp.artist || 'Unknown'}</span>
                  <ConfidenceBadge
                    level={lp.artistConfidence}
                    score={lp.artistConfidenceScore}
                    onClick={lp.artistVerification ? () => setArtistVerificationOpen(!artistVerificationOpen) : undefined}
                    isOpen={artistVerificationOpen}
                  />
                  <AttributionBadge basis={lp.attributionBasis} />
                  {lp.webVerification?.performed && (
                    lp.webVerification.fieldsChanged.includes('artist')
                      ? <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-200" title={lp.webVerification.verificationNotes}>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                          Web Verified
                        </span>
                      : <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-50 text-slate-500 border border-slate-200" title={lp.webVerification.verificationNotes}>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                          Web Consistent
                        </span>
                  )}
                </div>
                {/* Verification detail -- expands from confidence badge click */}
                {artistVerificationOpen && lp.artistVerification && (
                  <div className="mt-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
                    <div className="flex items-center gap-4 flex-wrap text-xs">
                      {[
                        { label: 'Signature readable', ok: lp.artistVerification.signatureReadable },
                        { label: 'Profession verified', ok: lp.artistVerification.professionVerified },
                        { label: 'Era matches', ok: lp.artistVerification.eraMatches },
                        { label: 'Style matches', ok: lp.artistVerification.styleMatches },
                      ].map((c) => (
                        <span key={c.label} className={`inline-flex items-center gap-1 ${c.ok ? 'text-green-600' : 'text-slate-400'}`}>
                          {c.ok ? '\u2713' : '\u2717'} {c.label}
                        </span>
                      ))}
                    </div>
                    {lp.artistVerification.signatureText && (
                      <p className="text-xs text-slate-500">Signature: &ldquo;{lp.artistVerification.signatureText}&rdquo;</p>
                    )}
                    {lp.artistVerification.verificationNotes && (
                      <p className="text-xs text-slate-400">{lp.artistVerification.verificationNotes}</p>
                    )}
                    {lp.artistSource && (
                      <p className="text-xs text-slate-400">Source: {lp.artistSource}</p>
                    )}
                  </div>
                )}
                {!artistVerificationOpen && lp.artistSource && (
                  <p className="text-xs text-slate-400 mt-1">Source: {lp.artistSource}</p>
                )}

                {/* Managed list match */}
                {lp.artist && (
                  <div className="mt-2">
                    {artistSearching && (
                      <p className="text-xs text-slate-400">Searching artist database...</p>
                    )}

                    {/* Resolved artist: compact row with expandable detail */}
                    {resolvedArtist && (
                      <div className="border border-slate-200 rounded-lg overflow-hidden">
                        {/* Compact row */}
                        <div className="flex items-center gap-2 px-3 py-2 bg-slate-50">
                          <button
                            type="button"
                            onClick={() => setArtistDetailOpen(!artistDetailOpen)}
                            className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer text-left"
                          >
                            <svg
                              className={`w-3.5 h-3.5 text-slate-400 flex-shrink-0 transition-transform ${artistDetailOpen ? 'rotate-90' : ''}`}
                              fill="none" stroke="currentColor" viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            <span className="text-sm font-medium text-slate-800 truncate">{resolvedArtist.name}</span>
                            {resolvedArtist.verified && (
                              <span className="text-green-600 text-xs flex-shrink-0" title="Verified profile">&#x2713;</span>
                            )}
                            <span className="text-xs text-slate-400 truncate">
                              {[
                                resolvedArtist.nationality,
                                resolvedArtist.birthYear && resolvedArtist.deathYear
                                  ? `${resolvedArtist.birthYear}\u2013${resolvedArtist.deathYear}`
                                  : resolvedArtist.birthYear
                                    ? `b. ${resolvedArtist.birthYear}`
                                    : null,
                              ].filter(Boolean).join(', ')}
                            </span>
                          </button>
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

                        {/* Expanded detail */}
                        {artistDetailOpen && (
                          <div className="px-3 py-2.5 border-t border-slate-200 space-y-2">
                            {resolvedArtist.bio && (
                              <div>
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-xs text-slate-600 leading-relaxed">{resolvedArtist.bio}</p>
                                  <ApplyButton
                                    onClick={() => applyMetafield('artistBio', {
                                      namespace: 'jadepuma',
                                      key: 'artist_bio',
                                      value: resolvedArtist.bio!,
                                      type: 'multi_line_text_field',
                                      displayLabel: 'Artist Bio',
                                    })}
                                    applied={isFieldApplied('artistBio')}
                                    applying={applyingField === 'artistBio'}
                                    label="Apply Bio"
                                  />
                                </div>
                              </div>
                            )}
                            {resolvedArtist.name.toLowerCase() !== lp.artist!.toLowerCase() && (
                              <p className="text-xs text-amber-600">
                                AI identified as: &ldquo;{lp.artist}&rdquo; (alias match)
                              </p>
                            )}
                            {resolvedArtist.aliases.length > 0 && (
                              <p className="text-xs text-slate-400">
                                Also known as: {resolvedArtist.aliases.join(', ')}
                              </p>
                            )}
                            {resolvedArtist.wikipediaUrl && (
                              <a
                                href={resolvedArtist.wikipediaUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-violet-500 hover:underline"
                              >
                                Wikipedia
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Not found */}
                    {artistNotFound && !artistSearching && (
                      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
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
                    )}
                  </div>
                )}
              </div>
              ) : (
              <div>
                <label className="block text-sm font-medium text-slate-500 mb-1">Artist</label>
                {product.metafields.artist ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-green-600"><ShopifyIcon /></span>
                    <span className="text-sm text-slate-700">{product.metafields.artist}</span>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 italic">Not set in Shopify</p>
                )}
              </div>
              )}

              {/* Manual Artist input */}
              <div className="border-t border-slate-100 pt-3 mt-1">
                <label className="block text-xs font-medium text-slate-400 mb-1">{lp?.artist ? 'Artist Override' : 'Set Artist'}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={formData.artist}
                    onChange={(e) => onFieldChange('artist', e.target.value)}
                    className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none text-sm"
                    placeholder="Enter artist name..."
                  />
                  {formData.artist && (
                    <ApplyButton
                      onClick={() => applyMetafield('artist-manual', {
                        namespace: 'jadepuma',
                        key: 'artist',
                        value: formData.artist,
                        type: 'single_line_text_field',
                        displayLabel: 'Artist',
                      })}
                      applied={isFieldApplied('artist-manual')}
                      applying={applyingField === 'artist-manual'}
                      label="Apply"
                    />
                  )}
                </div>
                {product.metafields.artist && product.metafields.artist !== formData.artist && (
                  <div className="mt-1 flex items-center gap-1 text-xs text-green-600">
                    <ShopifyIcon /> Live: {product.metafields.artist}
                  </div>
                )}
              </div>

              {/* Date */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-500 mb-1">Date / Period</label>
                  {lp ? (
                    <>
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
                    </>
                  ) : product.metafields.year ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-green-600"><ShopifyIcon /></span>
                      <span className="text-sm text-slate-700">Year: {product.metafields.year}</span>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400 italic">Not set in Shopify</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-500 mb-1">Medium / Technique</label>
                  {lp?.printingTechnique ? (
                    <span className="text-sm text-slate-800">{lp.printingTechnique}</span>
                  ) : product.metafields.medium ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-green-600"><ShopifyIcon /></span>
                      <span className="text-sm text-slate-700">
                        {(() => { try { return JSON.parse(product.metafields.medium).join(', '); } catch { return product.metafields.medium; } })()}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm text-slate-400 italic">Not set</span>
                  )}
                  {mediumOptions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {mediumOptions.map((opt) => {
                        const selected = formData.medium.some((m) => m.toLowerCase() === opt.name.toLowerCase());
                        const isMatch = lp?.printingTechnique
                          ? opt.name.toLowerCase().includes(lp.printingTechnique.toLowerCase())
                            || lp.printingTechnique.toLowerCase().includes(opt.name.toLowerCase())
                          : false;
                        return (
                          <button
                            key={opt.name}
                            type="button"
                            onClick={() => {
                              const next = selected
                                ? formData.medium.filter((m) => m.toLowerCase() !== opt.name.toLowerCase())
                                : [...formData.medium, opt.name];
                              onMediumAutoApply(next);
                            }}
                            className={`px-2 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer ${
                              selected
                                ? 'bg-green-600 text-white'
                                : isMatch
                                  ? 'bg-amber-50 border border-amber-300 text-amber-800 hover:bg-amber-100'
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

              {/* Manual Year override */}
              <div className="border-t border-slate-100 pt-3 mt-1">
                <label className="block text-xs font-medium text-slate-400 mb-1">{lp ? 'Year Override' : 'Set Year'}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={formData.year}
                    onChange={(e) => onFieldChange('year', e.target.value)}
                    className="w-32 px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none text-sm"
                    placeholder="e.g. 1965"
                  />
                  {formData.year && (
                    <ApplyButton
                      onClick={() => applyMetafield('year-manual', {
                        namespace: 'specs',
                        key: 'year',
                        value: formData.year,
                        type: 'single_line_text_field',
                        displayLabel: 'Year',
                      })}
                      applied={isFieldApplied('year-manual')}
                      applying={applyingField === 'year-manual'}
                      label="Apply"
                    />
                  )}
                </div>
                {product.metafields.year && product.metafields.year !== formData.year && (
                  <div className="mt-1 flex items-center gap-1 text-xs text-green-600">
                    <ShopifyIcon /> Live: {product.metafields.year}
                  </div>
                )}
              </div>

              {/* Printer / Publisher */}
              {lp && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-500 mb-1">Printer</label>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-slate-800">{lp.printer || '-'}</span>
                    {lp.printerConfidence && (
                      <ConfidenceBadge
                        level={lp.printerConfidence}
                        score={null}
                        onClick={lp.printerVerification ? () => setPrinterConfidenceOpen(!printerConfidenceOpen) : undefined}
                        isOpen={printerConfidenceOpen}
                      />
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
                  {printerConfidenceOpen && lp.printerVerification && (
                    <div className="mt-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
                      <div className="flex items-center gap-4 flex-wrap text-xs">
                        {[
                          { label: 'Marks readable', ok: lp.printerVerification.marksReadable },
                          { label: 'History verified', ok: lp.printerVerification.historyVerified },
                          { label: 'Location matches', ok: lp.printerVerification.locationMatches },
                          { label: 'Style matches', ok: lp.printerVerification.styleMatches },
                        ].map((c) => (
                          <span key={c.label} className={`inline-flex items-center gap-1 ${c.ok ? 'text-green-600' : 'text-slate-400'}`}>
                            {c.ok ? '\u2713' : '\u2717'} {c.label}
                          </span>
                        ))}
                      </div>
                      {lp.printerVerification.marksText && (
                        <p className="text-xs text-slate-500">Marks: &ldquo;{lp.printerVerification.marksText}&rdquo;</p>
                      )}
                      {lp.printerVerification.verificationNotes && (
                        <p className="text-xs text-slate-400">{lp.printerVerification.verificationNotes}</p>
                      )}
                      {lp.printerSource && (
                        <p className="text-xs text-slate-400">Source: {lp.printerSource}</p>
                      )}
                    </div>
                  )}
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
              )}
              {!lp && (product.metafields.printer || product.metafields.publisher) && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-500 mb-1">Printer</label>
                  {product.metafields.printer ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-green-600"><ShopifyIcon /></span>
                      <span className="text-sm text-slate-700">{product.metafields.printer}</span>
                    </div>
                  ) : (
                    <span className="text-sm text-slate-400">-</span>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-500 mb-1">Publisher</label>
                  {product.metafields.publisher ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-green-600"><ShopifyIcon /></span>
                      <span className="text-sm text-slate-700">{product.metafields.publisher}</span>
                    </div>
                  ) : (
                    <span className="text-sm text-slate-400">-</span>
                  )}
                </div>
              </div>
              )}
            </div>
          </ProductDetailSection>

          {/* ── Product Descriptions (visible when Shopify has description OR AI analysis exists) ── */}
          {(product.bodyHtml || lp?.productDescriptions) && (
            <ProductDetailSection title="Product Descriptions" defaultOpen>
              <div className="pt-4">
                {/* Tone pills */}
                <div className="flex gap-1 mb-3">
                  {/* Live (Shopify) tab */}
                  {product.bodyHtml && (
                    <button
                      type="button"
                      onClick={() => {
                        descriptionEditsRef.current[descriptionTone] = descriptionHtml;
                        setDescriptionTone('live');
                        setDescriptionDirty(false);
                        const savedEdit = descriptionEditsRef.current['live'];
                        setDescriptionHtml(savedEdit !== undefined ? savedEdit : product.bodyHtml!);
                      }}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-colors cursor-pointer ${
                        descriptionTone === 'live'
                          ? 'bg-green-100 text-green-700'
                          : 'text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      <ShopifyIcon />
                      Live
                    </button>
                  )}
                  {product.bodyHtml && lp?.productDescriptions && (
                    <div className="w-px bg-slate-200 mx-0.5" />
                  )}
                  {/* AI tone tabs (only when analysis exists) */}
                  {lp?.productDescriptions && DESCRIPTION_TONES.map((tone) => {
                    const text = lp.productDescriptions![tone.id as keyof typeof lp.productDescriptions];
                    return (
                      <button
                        key={tone.id}
                        type="button"
                        disabled={!text}
                        onClick={() => {
                          // Save current edits before switching
                          descriptionEditsRef.current[descriptionTone] = descriptionHtml;
                          setDescriptionTone(tone.id);
                          setDescriptionDirty(false);
                          // Restore saved edits if any, otherwise use original AI text
                          const savedEdit = descriptionEditsRef.current[tone.id];
                          setDescriptionHtml(savedEdit !== undefined ? savedEdit : (text ? convertToHtmlParagraphs(text) : ''));
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
                  onChange={(html) => { setDescriptionHtml(html); setDescriptionDirty(true); }}
                  placeholder="Select a tone above or type a description..."
                />
                {descriptionHtml && (
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    {(() => {
                      const currentToneLabel = descriptionTone === 'live' ? 'Live' : (DESCRIPTION_TONES.find((t) => t.id === descriptionTone)?.label || 'Custom');
                      const isApplied = isFieldApplied('description');
                      const isLiveTab = descriptionTone === 'live';
                      // Hide apply controls on Live tab unless user has edited
                      if (isLiveTab && !descriptionDirty) return null;
                      return isLiveTab && isApplied ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-green-600 font-medium">
                          <ShopifyIcon />
                          {appliedDescToneLabel ? `${appliedDescToneLabel} Description Applied` : 'Description Applied'}
                        </span>
                      ) : (
                        <ApplyButton
                          onClick={async () => {
                            setApplyingField('description');
                            try {
                              await onApplyBodyHtml(descriptionHtml, descriptionTone !== 'live');
                            } catch { /* handled by parent */ } finally {
                              setApplyingField(null);
                            }
                          }}
                          applied={isApplied}
                          applying={applyingField === 'description'}
                          label={isLiveTab ? 'Apply to Shopify' : `Apply ${currentToneLabel} as Description`}
                          appliedLabel={`${appliedDescToneLabel || currentToneLabel} Description`}
                        />
                      );
                    })()}
                  </div>
                )}

                {/* Concise Description metafield */}
                {lp?.productDescriptions?.concise && (
                  <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
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
                        appliedLabel="Concise Description"
                      />
                    </div>
                    {product.metafields.conciseDescription && (
                      <div className="bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                        <button
                          type="button"
                          onClick={() => setShowLiveConcise(v => !v)}
                          className="flex items-center gap-1.5 text-xs text-green-600 font-medium hover:text-green-700 transition-colors"
                        >
                          <ShopifyIcon />
                          Live Concise Description
                          <svg className={`w-3 h-3 transition-transform ${showLiveConcise ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {showLiveConcise && (
                          <p className="text-xs text-slate-600 mt-1">{product.metafields.conciseDescription}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </ProductDetailSection>
          )}

          {/* ── Analysis Results (requires AI analysis) ── */}
          {hasResults && lp && (
            <>
              {/* Talking Points */}
          {lp.talkingPoints.length > 0 && (
            <TalkingPointsCard points={lp.talkingPoints} />
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

      {/* ── Research Fields (always visible) ── */}
      <ProductDetailSection title="Research Fields" defaultOpen>
        <div className="pt-4 space-y-5">

          {/* Country of Origin (auto-apply) */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <label className="block text-sm font-medium text-slate-700">Country of Origin</label>
              {formData.countryOfOrigin.length > 0 && (
                <>
                  <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
                    {formData.countryOfOrigin.length}
                  </span>
                  <span className="text-green-600"><ShopifyIcon /></span>
                </>
              )}
            </div>
            <div className="px-3 py-2 border border-slate-200 rounded-lg min-h-[38px] flex items-center flex-wrap gap-1.5">
              {countryOptions.map((country) => {
                const isSelected = formData.countryOfOrigin.some(c => c.toLowerCase() === country.toLowerCase());
                return (
                  <button
                    key={country}
                    type="button"
                    onClick={() => {
                      const next = isSelected
                        ? formData.countryOfOrigin.filter(c => c.toLowerCase() !== country.toLowerCase())
                        : [...formData.countryOfOrigin, country];
                      onCountryAutoApply(next);
                    }}
                    className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-green-600 text-white'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {country}
                  </button>
                );
              })}
              {formData.countryOfOrigin
                .filter(c => !countryOptions.some(o => o.toLowerCase() === c.toLowerCase()))
                .map(country => (
                  <span key={country} className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium text-white bg-slate-400" title="Not in managed list">
                    {country}
                  </span>
                ))}
            </div>
          </div>

          {/* Colors (auto-apply) */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <label className="block text-sm font-medium text-slate-700">Colors</label>
              {formData.colors.length > 0 && (
                <span className="text-green-600"><ShopifyIcon /></span>
              )}
              {suggestingColors && (
                <div className="inline-block animate-spin rounded-full h-3 w-3 border-b-2 border-amber-600"></div>
              )}
            </div>

            {/* Compact selected color dots */}
            {formData.colors.length > 0 && !showAllColors && (
              <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                {formData.colors.map((colorName) => {
                  const opt = colorOptions.find((c) => c.name.toLowerCase() === colorName.toLowerCase());
                  return (
                    <button
                      key={colorName}
                      type="button"
                      onClick={() => {
                        const next = formData.colors.filter(c => c.toLowerCase() !== colorName.toLowerCase());
                        onColorsAutoApply(next);
                      }}
                      title={`${colorName} (click to remove)`}
                      className="w-6 h-6 rounded-full border-2 border-violet-400 ring-2 ring-violet-200 transition-all hover:ring-red-300 hover:border-red-400 cursor-pointer"
                      style={{ backgroundColor: opt?.hexCode || '#94a3b8' }}
                    />
                  );
                })}
              </div>
            )}

            {/* Full color palette (expandable) */}
            {showAllColors && (
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                {formData.colors
                  .filter(c => !colorOptions.some(o => o.name.toLowerCase() === c.toLowerCase()))
                  .map((c) => (
                    <span
                      key={`locked-${c}`}
                      className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium text-white bg-slate-400"
                      title="Shopify color (not in managed list)"
                    >
                      {c}
                    </span>
                  ))}
                {colorOptions.map((opt) => {
                  const isSelected = formData.colors.some(c => c.toLowerCase() === opt.name.toLowerCase());
                  const isSuggested = suggestedColors.some(s => s.toLowerCase() === opt.name.toLowerCase());
                  const textColor = opt.hexCode ? getContrastTextColor(opt.hexCode) : 'text-slate-700';
                  return (
                    <button
                      key={opt.name}
                      type="button"
                      onClick={() => {
                        const next = isSelected
                          ? formData.colors.filter(c => c.toLowerCase() !== opt.name.toLowerCase())
                          : [...formData.colors, opt.name];
                        onColorsAutoApply(next);
                      }}
                      className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-medium transition-all cursor-pointer border-2 ${
                        isSelected
                          ? 'ring-2 ring-violet-400 border-violet-500'
                          : isSuggested
                            ? 'border-amber-400'
                            : 'border-transparent'
                      } ${textColor}`}
                      style={{ backgroundColor: opt.hexCode || '#f1f5f9' }}
                    >
                      {opt.name}
                    </button>
                  );
                })}
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowAllColors(!showAllColors)}
              className="text-xs text-violet-500 hover:text-violet-700 transition"
            >
              {showAllColors ? 'Hide palette' : 'Show all colors'}
            </button>
          </div>

          {/* Subject Tags */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <label className="block text-sm font-medium text-slate-700">Subject Tags</label>
              {formData.tags.length > 0 && (
                <>
                  <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
                    {formData.tags.length}
                  </span>
                  <span className="text-green-600"><ShopifyIcon /></span>
                </>
              )}
            </div>

            {/* Auto Tags */}
            {autoTags.length > 0 && (
              <div className="mb-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <label className="text-xs font-medium text-emerald-700 uppercase tracking-wide">Auto Tags</label>
                  <span className="text-xs text-emerald-600 font-normal">(applied from dimensions & date)</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {autoTags.map((tag) => {
                    const isSelected = formData.tags.some(t => t.toLowerCase() === tag.toLowerCase());
                    return (
                      <span
                        key={`auto-${tag}`}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium ${
                          isSelected
                            ? 'bg-emerald-600 text-white'
                            : 'bg-emerald-50 border border-emerald-300 text-emerald-700'
                        }`}
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        {tag}
                        {isSelected && <span>&#10003;</span>}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            <input
              type="text"
              value={tagSearch}
              onChange={(e) => setTagSearch(e.target.value)}
              placeholder="Filter tags..."
              className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm mb-2 outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />

            <div className="flex flex-wrap gap-1.5">
              {/* Unmatched tags (from Shopify, not in managed list) */}
              {formData.tags
                .filter(t => !tagOptions.some(o => o.name.toLowerCase() === t.toLowerCase()) && !autoTags.some(a => a.toLowerCase() === t.toLowerCase()))
                .map((tag) => (
                  <span
                    key={`locked-${tag}`}
                    className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium text-white bg-green-700"
                    title="Shopify tag (not in managed list)"
                  >
                    {tag}
                  </span>
                ))}

              {(tagSearch.trim()
                ? tagOptions.filter(t => t.name.toLowerCase().includes(tagSearch.toLowerCase()))
                : tagOptions
              ).map((opt) => {
                const isSelected = formData.tags.some(t => t.toLowerCase() === opt.name.toLowerCase());
                const isSuggested = suggestedTags.some(t => t.toLowerCase() === opt.name.toLowerCase());
                return (
                  <button
                    key={opt.name}
                    type="button"
                    onClick={() => {
                      const next = isSelected
                        ? formData.tags.filter(t => t.toLowerCase() !== opt.name.toLowerCase())
                        : [...formData.tags, opt.name];
                      onApplyTags(next);
                    }}
                    className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-green-600 text-white'
                        : isSuggested
                          ? 'bg-amber-50 border border-amber-300 text-amber-800 hover:bg-amber-100'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {opt.name}
                  </button>
                );
              })}
            </div>
          </div>

        </div>
      </ProductDetailSection>

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
            Run AI analysis above to get detailed identification, product descriptions,
            historical context, and source citations.
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Sub-components ── */

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
