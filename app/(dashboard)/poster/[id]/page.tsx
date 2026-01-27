'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Poster } from '@/types/poster';
import { formatDate } from '@/lib/utils';
import Link from 'next/link';

// Map printing techniques to their Wikipedia article URLs
function getPrintingWikiUrl(technique: string): string {
  const lowerTechnique = technique.toLowerCase();

  // Map common terms to Wikipedia articles
  // Ordered by specificity - more specific terms first to ensure correct matching
  const wikiMap: [string, string][] = [
    // Specific lithography types (check before generic 'lithograph')
    ['offset lithograph', 'Offset_printing'],
    ['offset litho', 'Offset_printing'],
    ['offset printing', 'Offset_printing'],
    ['offset', 'Offset_printing'],
    ['stone lithograph', 'Lithography'],
    ['chromolithograph', 'Chromolithography'],
    ['chromolithography', 'Chromolithography'],
    ['photolithograph', 'Photolithography'],
    ['photolithography', 'Photolithography'],
    // Generic lithograph (last among litho types)
    ['lithograph', 'Lithography'],
    ['lithography', 'Lithography'],
    // Specific engraving types (check before generic 'engraving')
    ['steel engraving', 'Steel_engraving'],
    ['wood engraving', 'Wood_engraving'],
    ['copper engraving', 'Engraving'],
    ['line engraving', 'Engraving'],
    ['engraving', 'Engraving'],
    // Intaglio methods
    ['intaglio', 'Intaglio_(printmaking)'],
    ['etching', 'Etching'],
    ['mezzotint', 'Mezzotint'],
    ['aquatint', 'Aquatint'],
    ['drypoint', 'Drypoint'],
    ['photogravure', 'Photogravure'],
    // Relief printing
    ['woodcut', 'Woodcut'],
    ['woodblock', 'Woodblock_printing'],
    ['linocut', 'Linocut'],
    ['relief print', 'Relief_print'],
    ['relief', 'Relief_print'],
    // Screen printing
    ['screenprint', 'Screen_printing'],
    ['screen print', 'Screen_printing'],
    ['silkscreen', 'Screen_printing'],
    ['silk screen', 'Screen_printing'],
    ['serigraphy', 'Screen_printing'],
    ['serigraph', 'Screen_printing'],
    // Other techniques
    ['letterpress', 'Letterpress_printing'],
    ['giclée', 'Giclée'],
    ['giclee', 'Giclée'],
    ['collotype', 'Collotype'],
    ['pochoir', 'Pochoir'],
    ['heliogravure', 'Photogravure'],
  ];

  // Check for matches (more specific terms checked first due to array order)
  for (const [key, wiki] of wikiMap) {
    if (lowerTechnique.includes(key)) {
      return `https://en.wikipedia.org/wiki/${wiki}`;
    }
  }

  // Fallback to search
  return `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(technique)} printmaking`;
}

// Map publications to their Wikipedia article URLs
function getPublicationWikiUrl(publication: string): string {
  const lowerPub = publication.toLowerCase();

  // Map common publications to Wikipedia articles
  const wikiMap: [string, string][] = [
    // American magazines
    ['the new yorker', 'The_New_Yorker'],
    ['new yorker', 'The_New_Yorker'],
    ['fortune', 'Fortune_(magazine)'],
    ['vogue', 'Vogue_(magazine)'],
    ['vanity fair', 'Vanity_Fair_(magazine)'],
    ['harper\'s bazaar', 'Harper%27s_Bazaar'],
    ['harpers bazaar', 'Harper%27s_Bazaar'],
    ['saturday evening post', 'The_Saturday_Evening_Post'],
    ['collier\'s', 'Collier%27s'],
    ['colliers', 'Collier%27s'],
    ['life', 'Life_(magazine)'],
    ['time', 'Time_(magazine)'],
    ['esquire', 'Esquire_(magazine)'],
    ['playboy', 'Playboy'],
    ['cosmopolitan', 'Cosmopolitan_(magazine)'],
    ['the atlantic', 'The_Atlantic'],
    ['atlantic monthly', 'The_Atlantic'],
    ['holiday', 'Holiday_(magazine)'],
    ['mccall\'s', 'McCall%27s'],
    ['mccalls', 'McCall%27s'],
    ['good housekeeping', 'Good_Housekeeping'],
    ['ladies\' home journal', 'Ladies%27_Home_Journal'],
    ['redbook', 'Redbook'],
    ['popular mechanics', 'Popular_Mechanics'],
    ['popular science', 'Popular_Science'],
    ['scientific american', 'Scientific_American'],
    ['national geographic', 'National_Geographic'],
    ['readers digest', 'Reader%27s_Digest'],
    ['reader\'s digest', 'Reader%27s_Digest'],
    // French magazines
    ['la vie parisienne', 'La_Vie_Parisienne'],
    ['vie parisienne', 'La_Vie_Parisienne'],
    ['l\'illustration', 'L%27Illustration'],
    ['le rire', 'Le_Rire'],
    ['le journal', 'Le_Journal'],
    ['le petit journal', 'Le_Petit_Journal'],
    ['l\'assiette au beurre', 'L%27Assiette_au_Beurre'],
    ['le sourire', 'Le_Sourire'],
    ['fantasio', 'Fantasio_(magazine)'],
    ['le figaro', 'Le_Figaro'],
    ['la revue blanche', 'La_Revue_blanche'],
    ['paris match', 'Paris_Match'],
    // British magazines
    ['punch', 'Punch_(magazine)'],
    ['the studio', 'The_Studio_(magazine)'],
    ['the sphere', 'The_Sphere'],
    ['the illustrated london news', 'The_Illustrated_London_News'],
    ['illustrated london news', 'The_Illustrated_London_News'],
    ['the tatler', 'Tatler'],
    ['tatler', 'Tatler'],
    ['the strand', 'The_Strand_Magazine'],
    ['strand magazine', 'The_Strand_Magazine'],
    // German magazines
    ['simplicissimus', 'Simplicissimus'],
    ['jugend', 'Jugend_(magazine)'],
    ['berliner illustrirte', 'Berliner_Illustrirte_Zeitung'],
    // Italian magazines
    ['la domenica del corriere', 'La_Domenica_del_Corriere'],
  ];

  // Check for matches (more specific terms checked first due to array order)
  for (const [key, wiki] of wikiMap) {
    if (lowerPub.includes(key)) {
      return `https://en.wikipedia.org/wiki/${wiki}`;
    }
  }

  // Fallback to search
  return `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(publication + ' magazine')}`;
}

// Build marketplace search query with all relevant context
function buildMarketplaceQuery(poster: Poster): string {
  const parts: string[] = [];

  // Product type
  parts.push(poster.productType || 'vintage');

  // Publication or advertiser (from rawAiResponse if available)
  const publication = poster.rawAiResponse?.historicalContext?.publication;
  const advertiser = poster.rawAiResponse?.historicalContext?.advertiser;
  if (publication) {
    parts.push(publication);
  } else if (advertiser) {
    parts.push(advertiser);
  }

  // Title (always include)
  if (poster.title) {
    parts.push(poster.title);
  }

  // Artist (only if confirmed)
  if (poster.artist && poster.artist !== 'Unknown' && poster.artistConfidence === 'confirmed') {
    parts.push(poster.artist);
  }

  return parts.join(' ');
}

export default function PosterDetailPage() {
  const params = useParams();
  const router = useRouter();
  const posterId = params.id as string;

  const [poster, setPoster] = useState<Poster | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [additionalContext, setAdditionalContext] = useState('');
  const [showReanalyze, setShowReanalyze] = useState(false);

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

  async function triggerAnalysis(forceReanalyze = false, context?: string) {
    try {
      setAnalyzing(true);
      setError('');

      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          posterId: parseInt(posterId),
          forceReanalyze,
          additionalContext: context,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        console.error('Analysis failed:', errorData);
        const errorMsg = errorData.details
          ? `${errorData.error}: ${errorData.details}`
          : errorData.error || 'Analysis failed';
        throw new Error(errorMsg);
      }

      // Refresh poster data
      await fetchPoster();
      setShowReanalyze(false);
      setAdditionalContext('');
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
          {/* Reverse Image Search - uses actual image + title only (not artist/date which may be wrong) */}
          {poster?.imageUrl && (
            <a
              href={`https://lens.google.com/uploadbyurl?url=${encodeURIComponent(poster.imageUrl)}${poster.title ? `&q=${encodeURIComponent(`${poster.title} Original ${poster.productType || 'Poster'}`)}` : ''}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition flex items-center gap-2"
              title="Search Google using the actual image + title"
            >
              🖼️ Reverse Image Search
            </a>
          )}
          {/* Text-based search - only shows after analysis, uses verified info */}
          {poster?.artist && poster?.title && poster?.artistConfidence === 'confirmed' && (
            <a
              href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(
                `${poster.productType || 'vintage poster'} ${poster.artist} ${poster.title} original`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition flex items-center gap-2"
              title="Search Google by confirmed artist and title"
            >
              🔍 Text Search
            </a>
          )}
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
              {poster.productType && (
                <div className="mb-3">
                  <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                    {poster.productType}
                  </span>
                </div>
              )}
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

            {/* Technical Info */}
            {poster.analysisCompleted && (
              <div className="mt-4 pt-4 border-t border-slate-200">
                <h4 className="text-sm font-semibold text-slate-700 mb-2">Technical Info</h4>
                <div className="text-xs text-slate-500 space-y-1">
                  <p>
                    <strong>File Size:</strong> {(poster.fileSize / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <p>
                    <strong>Analysis Model:</strong> claude-opus-4-5-20251101
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Product Description */}
          {poster.analysisCompleted && poster.productDescription && (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 mt-4">
              <div className="flex items-center gap-2 mb-3">
                <h4 className="text-lg font-bold text-slate-900">
                  Product Description
                </h4>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(poster.productDescription || '');
                    alert('Description copied to clipboard!');
                  }}
                  className="ml-auto text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded transition"
                >
                  Copy
                </button>
              </div>
              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                {poster.productDescription}
              </p>
              <p className="text-xs text-slate-600 mt-3">
                Ready to use in your Shopify product listing
              </p>
            </div>
          )}
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
                  <p className="font-semibold mb-1">Error</p>
                  <p className="whitespace-pre-wrap">{error}</p>
                  <p className="text-xs mt-2 text-red-600">Check browser console for more details</p>
                </div>
              )}
              <button
                onClick={() => triggerAnalysis()}
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

              {/* Re-analyze */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900">
                    Re-analyze
                  </h3>
                  <button
                    onClick={() => setShowReanalyze(!showReanalyze)}
                    className="text-sm bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded transition"
                  >
                    {showReanalyze ? 'Hide' : 'Re-analyze'}
                  </button>
                </div>
                {showReanalyze && (
                  <div className="mt-4">
                    <p className="text-sm text-slate-600 mb-3">
                      Run a fresh analysis with the upgraded model. Optionally provide additional context
                      to guide the analysis (e.g., known artist, correct date, or anything the AI missed).
                    </p>
                    <textarea
                      value={additionalContext}
                      onChange={(e) => setAdditionalContext(e.target.value)}
                      placeholder="Optional: The artist is Henri Monnier, clearly signed on the bottom right. This is a stone lithograph, not chromolithography."
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none mb-4"
                      rows={3}
                    />
                    {error && (
                      <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                        {error}
                      </div>
                    )}
                    <div className="flex gap-3">
                      <button
                        onClick={() => triggerAnalysis(true, additionalContext)}
                        disabled={analyzing}
                        className="flex-1 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {analyzing ? 'Re-analyzing...' : additionalContext.trim() ? 'Re-analyze with Context' : 'Re-analyze'}
                      </button>
                      <button
                        onClick={() => {
                          setShowReanalyze(false);
                          setAdditionalContext('');
                        }}
                        disabled={analyzing}
                        className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 transition disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                    {analyzing && (
                      <div className="mt-4 text-center">
                        <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-amber-600 mb-2"></div>
                        <p className="text-sm text-slate-600">
                          Re-analyzing with your additional context...
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Identification */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-xl font-bold text-slate-900 mb-4">
                  Identification
                </h3>
                <div className="space-y-4">
                  {/* Artist with confidence */}
                  <div className="border-b border-slate-100 pb-3">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-sm font-medium text-slate-700">Artist</label>
                      {poster.artistConfidence && (
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          poster.artistConfidence === 'confirmed' ? 'bg-green-100 text-green-800' :
                          poster.artistConfidence === 'likely' ? 'bg-blue-100 text-blue-800' :
                          poster.artistConfidence === 'uncertain' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {poster.artistConfidence}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-900 font-medium">{poster.artist || 'Unknown'}</p>
                    {poster.artistSource && (
                      <p className="text-xs text-slate-500 mt-1">Source: {poster.artistSource}</p>
                    )}
                  </div>

                  {/* Title */}
                  <div className="border-b border-slate-100 pb-3">
                    <label className="text-sm font-medium text-slate-700">Title</label>
                    <p className="text-slate-900">{poster.title || 'Untitled'}</p>
                  </div>

                  {/* Date with confidence */}
                  <div className="border-b border-slate-100 pb-3">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-sm font-medium text-slate-700">Date</label>
                      {poster.dateConfidence && (
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          poster.dateConfidence === 'confirmed' ? 'bg-green-100 text-green-800' :
                          poster.dateConfidence === 'likely' ? 'bg-blue-100 text-blue-800' :
                          poster.dateConfidence === 'uncertain' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {poster.dateConfidence}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-900">{poster.estimatedDate || 'Unknown'}</p>
                    {poster.dateSource && (
                      <p className="text-xs text-slate-500 mt-1">Source: {poster.dateSource}</p>
                    )}
                  </div>

                  {/* Dimensions */}
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
              {(poster.printingTechnique || poster.printer) && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-xl font-bold text-slate-900 mb-4">
                    Printing Information
                  </h3>
                  {poster.printingTechnique && (
                    <div className="mb-3">
                      <label className="text-sm font-medium text-slate-700">Technique</label>
                      <div className="flex items-center gap-2">
                        <p className="text-slate-700">
                          {poster.printingTechnique}
                        </p>
                        <a
                          href={getPrintingWikiUrl(poster.printingTechnique)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:text-blue-700 hover:underline"
                        >
                          Learn more →
                        </a>
                      </div>
                    </div>
                  )}
                  {poster.printer && (
                    <div>
                      <label className="text-sm font-medium text-slate-700">Printer/Publisher</label>
                      <p className="text-slate-700">
                        {poster.printer}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Design Profile */}
              {poster.rawAiResponse && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-xl font-bold text-slate-900 mb-4">Design Profile</h3>
                  <div className="space-y-5">
                    {/* Period & Style */}
                    {poster.rawAiResponse.historicalContext?.periodMovement && (
                      <div>
                        <label className="text-sm font-medium text-slate-700">Period & Style</label>
                        <p className="text-slate-700 mt-1">
                          {poster.rawAiResponse.historicalContext.periodMovement}
                        </p>
                      </div>
                    )}

                    {/* Publication & Advertiser */}
                    {(poster.rawAiResponse.historicalContext?.publication || poster.rawAiResponse.historicalContext?.advertiser) && (
                      <div className="flex flex-wrap gap-4">
                        {poster.rawAiResponse.historicalContext.publication && (
                          <div>
                            <label className="text-sm font-medium text-slate-700">Publication</label>
                            <div className="flex items-center gap-2 mt-1">
                              <p className="text-slate-700">
                                {poster.rawAiResponse.historicalContext.publication}
                              </p>
                              <a
                                href={getPublicationWikiUrl(poster.rawAiResponse.historicalContext.publication)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:text-blue-700 hover:underline"
                              >
                                Learn more →
                              </a>
                            </div>
                          </div>
                        )}
                        {poster.rawAiResponse.historicalContext.advertiser && (
                          <div>
                            <label className="text-sm font-medium text-slate-700">Advertiser/Client</label>
                            <p className="text-slate-700 mt-1">
                              {poster.rawAiResponse.historicalContext.advertiser}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Era Context */}
                    {poster.rawAiResponse.historicalContext?.eraContext && (
                      <div>
                        <label className="text-sm font-medium text-slate-700">Era Context</label>
                        <p className="text-slate-700 mt-1 text-sm">
                          {poster.rawAiResponse.historicalContext.eraContext}
                        </p>
                      </div>
                    )}

                    {/* Design Observations */}
                    {poster.rawAiResponse.technicalAnalysis && (
                      <div className="space-y-3">
                        <label className="text-sm font-medium text-slate-700">Design Observations</label>
                        {poster.rawAiResponse.technicalAnalysis.composition && (
                          <div className="pl-3 border-l-2 border-slate-200">
                            <p className="text-xs font-medium text-slate-500 uppercase">Composition</p>
                            <p className="text-slate-700 text-sm">
                              {poster.rawAiResponse.technicalAnalysis.composition}
                            </p>
                          </div>
                        )}
                        {poster.rawAiResponse.technicalAnalysis.colorPalette && (
                          <div className="pl-3 border-l-2 border-slate-200">
                            <p className="text-xs font-medium text-slate-500 uppercase">Color Palette</p>
                            <p className="text-slate-700 text-sm">
                              {poster.rawAiResponse.technicalAnalysis.colorPalette}
                            </p>
                          </div>
                        )}
                        {poster.rawAiResponse.technicalAnalysis.typography && (
                          <div className="pl-3 border-l-2 border-slate-200">
                            <p className="text-xs font-medium text-slate-500 uppercase">Typography</p>
                            <p className="text-slate-700 text-sm">
                              {poster.rawAiResponse.technicalAnalysis.typography}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Artist Section */}
                    {poster.artist && poster.artist !== 'Unknown' && (
                      <div className="pt-4 border-t border-slate-200">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <label className="text-sm font-medium text-slate-700">Artist</label>
                            <p className="text-lg font-semibold text-slate-900">{poster.artist}</p>
                          </div>
                          {poster.artistConfidence && (
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              poster.artistConfidence === 'confirmed' ? 'bg-green-100 text-green-800' :
                              poster.artistConfidence === 'likely' ? 'bg-blue-100 text-blue-800' :
                              poster.artistConfidence === 'uncertain' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {poster.artistConfidence}
                            </span>
                          )}
                        </div>
                        {poster.artistSource && (
                          <p className="text-sm text-slate-600 mb-3">
                            <strong>Attribution:</strong> {poster.artistSource}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <a
                            href={`https://www.google.com/search?q=${encodeURIComponent(poster.artist + ' artist biography')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded transition"
                          >
                            Google
                          </a>
                          <a
                            href={`https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(poster.artist)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded transition"
                          >
                            Wikipedia
                          </a>
                          <a
                            href={`https://www.wikiart.org/en/search/${encodeURIComponent(poster.artist)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded transition"
                          >
                            WikiArt
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
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

              {/* Source Citations */}
              {poster.sourceCitations && Array.isArray(poster.sourceCitations) && poster.sourceCitations.length > 0 && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-xl font-bold text-slate-900 mb-4">
                    Source Citations
                  </h3>
                  <p className="text-sm text-slate-500 mb-4">
                    Claims identified by AI analysis - verify independently
                  </p>
                  <div className="space-y-3">
                    {poster.sourceCitations.map((citation: any, idx: number) => (
                      <div key={idx} className="border-l-4 border-blue-500 pl-4 py-2">
                        <p className="font-medium text-slate-900 mb-1">{citation.claim}</p>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <span>{citation.source}</span>
                            <span className={`px-2 py-0.5 rounded text-xs ${
                              citation.reliability === 'high' ? 'bg-green-100 text-green-800' :
                              citation.reliability === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {citation.reliability}
                            </span>
                          </div>
                          <a
                            href={`https://www.google.com/search?q=${encodeURIComponent(
                              `${citation.claim} ${citation.source}`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded transition"
                          >
                            Verify →
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Find This Item */}
              {poster.title && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-xl font-bold text-slate-900 mb-4">
                    Find This Item
                  </h3>
                  <p className="text-sm text-slate-600 mb-4">
                    Search marketplaces for current listings of this exact piece
                  </p>

                  {/* Image Search */}
                  <div className="mb-4">
                    <p className="text-xs font-medium text-slate-500 uppercase mb-2">Image Search (Most Accurate)</p>
                    <div className="flex flex-wrap gap-2">
                      <a
                        href={`https://lens.google.com/uploadbyurl?url=${encodeURIComponent(poster.imageUrl)}&q=${encodeURIComponent(
                          `${poster.title} Original ${poster.productType || 'Poster'}`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded transition"
                      >
                        Google Lens
                      </a>
                      <a
                        href={`https://www.bing.com/images/search?view=detailv2&iss=sbi&form=SBIVSP&sbisrc=UrlPaste&q=imgurl:${encodeURIComponent(poster.imageUrl)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded transition"
                      >
                        Bing Visual
                      </a>
                      <a
                        href={`https://tineye.com/search?url=${encodeURIComponent(poster.imageUrl)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm bg-slate-600 hover:bg-slate-700 text-white px-3 py-1.5 rounded transition"
                      >
                        TinEye
                      </a>
                    </div>
                  </div>

                  {/* Marketplace Search */}
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase mb-2">Marketplace Search</p>
                    <div className="flex flex-wrap gap-2">
                      <a
                        href={`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(buildMarketplaceQuery(poster))}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm bg-yellow-500 hover:bg-yellow-600 text-slate-900 px-3 py-1.5 rounded transition"
                      >
                        eBay
                      </a>
                      <a
                        href={`https://www.google.com/search?tbm=shop&q=${encodeURIComponent(buildMarketplaceQuery(poster))}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded transition"
                      >
                        Google Shopping
                      </a>
                      <a
                        href={`https://www.liveauctioneers.com/search/?q=${encodeURIComponent(buildMarketplaceQuery(poster))}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded transition"
                      >
                        LiveAuctioneers
                      </a>
                    </div>
                  </div>
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
