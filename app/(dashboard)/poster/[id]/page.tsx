'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Poster, DescriptionTone, DESCRIPTION_TONES, SupplementalImage, ComparableSale, RESEARCH_SOURCES } from '@/types/poster';
import { formatDate } from '@/lib/utils';
import Link from 'next/link';
import ImagePreview from '@/components/ImagePreview';

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
  const [selectedTone, setSelectedTone] = useState<DescriptionTone>('standard');
  const [refreshingDescriptions, setRefreshingDescriptions] = useState(false);
  const [uploadingSupplemental, setUploadingSupplemental] = useState(false);
  const [supplementalDescription, setSupplementalDescription] = useState('');
  const [deletingImage, setDeletingImage] = useState<string | null>(null);
  const [compressingSupplemental, setCompressingSupplemental] = useState(false);
  // Tag management state
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [savingTags, setSavingTags] = useState(false);
  const [tagSearch, setTagSearch] = useState('');
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [refreshingTags, setRefreshingTags] = useState(false);

  // Comparable sales state
  const [showAddSale, setShowAddSale] = useState(false);
  const [addingSale, setAddingSale] = useState(false);
  const [deletingSaleId, setDeletingSaleId] = useState<string | null>(null);
  const [researchQuery, setResearchQuery] = useState('');
  const [newSale, setNewSale] = useState({
    date: '',
    price: '',
    currency: 'USD',
    source: '',
    condition: '',
    notes: '',
    url: '',
  });

  useEffect(() => {
    fetchPoster();
  }, [posterId]);

  // Fetch available tags
  useEffect(() => {
    fetch('/api/tags')
      .then(res => res.json())
      .then(data => {
        if (data.tags) {
          setAvailableTags(data.tags.map((t: { name: string }) => t.name));
        }
      })
      .catch(err => console.error('Failed to fetch tags:', err));
  }, []);

  // Initialize selected tags when poster loads
  useEffect(() => {
    if (poster?.itemTags) {
      setSelectedTags(poster.itemTags);
    }
  }, [poster?.itemTags]);

  // Initialize research query when poster loads
  useEffect(() => {
    if (poster) {
      const parts: string[] = [];
      if (poster.title) parts.push(poster.title);
      if (poster.productType) parts.push(poster.productType);
      setResearchQuery(parts.join(' '));
    }
  }, [poster?.title, poster?.productType]);

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

  // Compress image if over 5MB
  async function compressImage(file: File, targetSizeMB: number = 4.95): Promise<File> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0);

          let quality = 0.95;
          const targetBytes = targetSizeMB * 1024 * 1024;
          const minQuality = 0.75;

          const tryCompress = () => {
            canvas.toBlob(
              (blob) => {
                if (!blob) {
                  reject(new Error('Compression failed'));
                  return;
                }
                if (blob.size > targetBytes && quality > minQuality) {
                  quality -= 0.02;
                  tryCompress();
                  return;
                }
                const compressedFile = new File([blob], file.name, {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              },
              'image/jpeg',
              quality
            );
          };
          tryCompress();
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  async function uploadSupplementalImage(file: File, description?: string) {
    if (!poster) return;

    // Validate file type
    if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
      setError('Please select a JPG or PNG image file.');
      return;
    }

    try {
      setUploadingSupplemental(true);
      setError('');

      let processedFile = file;

      // Compress if over 5MB
      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize) {
        setCompressingSupplemental(true);
        try {
          processedFile = await compressImage(file);
        } catch (err) {
          setError('Failed to compress image. Please try a smaller file.');
          setCompressingSupplemental(false);
          setUploadingSupplemental(false);
          return;
        }
        setCompressingSupplemental(false);
      }

      const formData = new FormData();
      formData.append('file', processedFile);
      if (description) {
        formData.append('description', description);
      }

      const res = await fetch(`/api/posters/${posterId}/supplemental-image`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to upload supplemental image');
      }

      // Refresh poster data
      await fetchPoster();
      setSupplementalDescription('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload supplemental image');
    } finally {
      setUploadingSupplemental(false);
      setCompressingSupplemental(false);
    }
  }

  async function deleteSupplementalImage(imageUrl: string) {
    if (!poster) return;

    try {
      setDeletingImage(imageUrl);
      setError('');

      const res = await fetch(
        `/api/posters/${posterId}/supplemental-image?imageUrl=${encodeURIComponent(imageUrl)}`,
        { method: 'DELETE' }
      );

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to delete supplemental image');
      }

      // Refresh poster data
      await fetchPoster();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete supplemental image');
    } finally {
      setDeletingImage(null);
    }
  }

  // Save tags to database
  async function saveTags(newTags: string[]) {
    if (!poster) return;

    try {
      setSavingTags(true);
      const res = await fetch(`/api/posters/${posterId}/tags`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: newTags }),
      });

      if (!res.ok) {
        throw new Error('Failed to save tags');
      }

      setSelectedTags(newTags);
    } catch (err) {
      console.error('Failed to save tags:', err);
      // Revert on error
      setSelectedTags(poster.itemTags || []);
    } finally {
      setSavingTags(false);
    }
  }

  // Toggle a tag selection
  function toggleTag(tag: string) {
    const newTags = selectedTags.includes(tag)
      ? selectedTags.filter(t => t !== tag)
      : [...selectedTags, tag];
    saveTags(newTags);
  }

  // Add a tag from the dropdown
  function addTag(tag: string) {
    if (!selectedTags.includes(tag)) {
      const newTags = [...selectedTags, tag];
      saveTags(newTags);
    }
    setTagSearch('');
    setShowTagDropdown(false);
  }

  // Refresh tag suggestions using Sonnet (cheaper than full re-analysis)
  async function refreshTagSuggestions() {
    if (!poster) return;

    try {
      setRefreshingTags(true);
      setError('');

      const res = await fetch(`/api/posters/${posterId}/refresh-tags`, {
        method: 'POST',
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to refresh tags');
      }

      // Refresh poster data to get new suggested tags
      await fetchPoster();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh tags');
    } finally {
      setRefreshingTags(false);
    }
  }

  async function refreshDescriptions() {
    if (!poster) return;

    try {
      setRefreshingDescriptions(true);
      setError('');

      const res = await fetch('/api/refresh-descriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ posterId: poster.id }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        const errorMsg = errorData.details
          ? `${errorData.error}: ${errorData.details}`
          : errorData.error || 'Failed to refresh descriptions';
        throw new Error(errorMsg);
      }

      // Refresh poster data
      await fetchPoster();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh descriptions');
    } finally {
      setRefreshingDescriptions(false);
    }
  }

  // Add a comparable sale
  async function addComparableSale(e: React.FormEvent) {
    e.preventDefault();
    if (!poster || !newSale.date || !newSale.price || !newSale.source) return;

    try {
      setAddingSale(true);
      setError('');

      const res = await fetch(`/api/posters/${posterId}/sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSale),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to add sale');
      }

      // Refresh poster data and reset form
      await fetchPoster();
      setNewSale({
        date: '',
        price: '',
        currency: 'USD',
        source: '',
        condition: '',
        notes: '',
        url: '',
      });
      setShowAddSale(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add sale');
    } finally {
      setAddingSale(false);
    }
  }

  // Delete a comparable sale
  async function deleteComparableSale(saleId: string) {
    if (!poster) return;

    try {
      setDeletingSaleId(saleId);
      setError('');

      const res = await fetch(`/api/posters/${posterId}/sales/${saleId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to delete sale');
      }

      await fetchPoster();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete sale');
    } finally {
      setDeletingSaleId(null);
    }
  }

  // Calculate price summary from sales
  function getPriceSummary(): { low: number; high: number; avg: number; count: number } | null {
    if (!poster?.comparableSales || poster.comparableSales.length === 0) return null;
    const prices = poster.comparableSales.map(s => s.price);
    return {
      low: Math.min(...prices),
      high: Math.max(...prices),
      avg: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
      count: prices.length,
    };
  }

  // Get the current description based on selected tone
  function getCurrentDescription(): string {
    if (!poster) return '';

    // Try to get from productDescriptions (new format)
    const descriptions = poster.rawAiResponse?.productDescriptions;
    if (descriptions && descriptions[selectedTone]) {
      return descriptions[selectedTone];
    }

    // Fallback to legacy productDescription field
    return poster.productDescription || '';
  }

  // Check if multiple tones are available
  function hasMultipleTones(): boolean {
    const descriptions = poster?.rawAiResponse?.productDescriptions;
    return descriptions && typeof descriptions === 'object' && Object.keys(descriptions).length > 1;
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

  if (!poster) {
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
            <ImagePreview
              src={poster.imageUrl}
              alt={poster.title || poster.fileName}
              className="w-full h-full object-contain aspect-[3/4] bg-slate-100 rounded-lg"
              previewSize={600}
            />
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

            {/* Supplemental Images Summary (read-only display) */}
            {poster.supplementalImages && poster.supplementalImages.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-200">
                <h4 className="text-sm font-semibold text-slate-700 mb-2">
                  Reference Images ({poster.supplementalImages.length})
                </h4>
                <div className="grid grid-cols-3 gap-2">
                  {poster.supplementalImages.map((img, idx) => (
                    <div key={img.url}>
                      <ImagePreview
                        src={img.url}
                        alt={img.description || `Reference ${idx + 1}`}
                        className="w-full h-16 object-cover rounded border border-slate-200 cursor-zoom-in"
                        previewSize={400}
                      />
                      {img.description && (
                        <p className="text-xs text-slate-500 mt-1 truncate" title={img.description}>
                          {img.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  Manage reference images in the Re-analyze section
                </p>
              </div>
            )}
          </div>

          {/* Product Description */}
          {poster.analysisCompleted && (poster.productDescription || poster.rawAiResponse?.productDescriptions) && (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 mt-4">
              <div className="flex items-center gap-2 mb-3">
                <h4 className="text-lg font-bold text-slate-900">
                  Product Description
                </h4>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={refreshDescriptions}
                    disabled={refreshingDescriptions}
                    className="text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1 rounded transition disabled:opacity-50"
                    title="Generate new description variations"
                  >
                    {refreshingDescriptions ? '...' : '↻'}
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(getCurrentDescription());
                      alert('Description copied to clipboard!');
                    }}
                    className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded transition"
                  >
                    Copy
                  </button>
                </div>
              </div>

              {/* Tone Selector - only show if multiple tones available */}
              {hasMultipleTones() && (
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
              )}

              {/* Inline error for refresh */}
              {error && (
                <div className="mb-3 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
                  <button
                    onClick={() => setError('')}
                    className="float-right text-red-500 hover:text-red-700"
                  >×</button>
                  {error}
                </div>
              )}

              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                {getCurrentDescription()}
              </p>
              <p className="text-xs text-slate-600 mt-3">
                {hasMultipleTones()
                  ? `Showing ${selectedTone} tone • Ready for your Shopify listing`
                  : 'Ready to use in your Shopify product listing'
                }
              </p>
            </div>
          )}

          {/* Talking Points */}
          {poster.analysisCompleted && poster.rawAiResponse?.talkingPoints && poster.rawAiResponse.talkingPoints.length > 0 && (
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-4 mt-4">
              <h4 className="text-lg font-bold text-slate-900 mb-3">
                Talking Points
              </h4>
              <p className="text-xs text-slate-500 mb-3">Quick reference for in-gallery conversations</p>
              <ul className="space-y-2">
                {poster.rawAiResponse.talkingPoints.map((point: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="text-amber-600 mt-0.5">•</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Item Tags */}
          {poster.analysisCompleted && (
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg p-4 mt-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <h4 className="text-lg font-bold text-slate-900">
                    Item Tags
                  </h4>
                  <button
                    onClick={refreshTagSuggestions}
                    disabled={refreshingTags}
                    className="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    title="Refresh AI tag suggestions (uses Sonnet - low cost)"
                  >
                    {refreshingTags ? 'Refreshing...' : 'Refresh Suggestions'}
                  </button>
                </div>
                {savingTags && (
                  <span className="text-xs text-slate-500">Saving...</span>
                )}
              </div>
              <p className="text-xs text-slate-500 mb-3">Tags for categorization and Shopify integration</p>

              {/* AI Suggested Tags */}
              {poster.rawAiResponse?.suggestedTags && poster.rawAiResponse.suggestedTags.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-slate-600 mb-2">AI Suggested</p>
                  <div className="flex flex-wrap gap-2">
                    {poster.rawAiResponse.suggestedTags.map((tag: string) => (
                      <button
                        key={tag}
                        onClick={() => toggleTag(tag)}
                        className={`px-3 py-1 rounded-full text-sm transition ${
                          selectedTags.includes(tag)
                            ? 'bg-emerald-600 text-white'
                            : 'bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200'
                        }`}
                      >
                        {tag}
                        {selectedTags.includes(tag) && <span className="ml-1">✓</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Selected Tags */}
              {selectedTags.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-slate-600 mb-2">Selected ({selectedTags.length})</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedTags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-600 text-white rounded-full text-sm"
                      >
                        {tag}
                        <button
                          onClick={() => toggleTag(tag)}
                          className="ml-1 hover:bg-emerald-700 rounded-full w-4 h-4 flex items-center justify-center"
                          title="Remove tag"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Add More Tags */}
              <div className="relative">
                <p className="text-xs font-medium text-slate-600 mb-2">Add Tag</p>
                <div className="relative">
                  <input
                    type="text"
                    value={tagSearch}
                    onChange={(e) => {
                      setTagSearch(e.target.value);
                      setShowTagDropdown(true);
                    }}
                    onFocus={() => setShowTagDropdown(true)}
                    placeholder="Search tags..."
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                  />
                  {showTagDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {availableTags
                        .filter(tag =>
                          !selectedTags.includes(tag) &&
                          tag.toLowerCase().includes(tagSearch.toLowerCase())
                        )
                        .slice(0, 10)
                        .map((tag) => (
                          <button
                            key={tag}
                            onClick={() => addTag(tag)}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-emerald-50 transition"
                          >
                            {tag}
                          </button>
                        ))}
                      {availableTags.filter(tag =>
                        !selectedTags.includes(tag) &&
                        tag.toLowerCase().includes(tagSearch.toLowerCase())
                      ).length === 0 && (
                        <div className="px-3 py-2 text-sm text-slate-500">
                          No matching tags found
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {showTagDropdown && (
                  <button
                    onClick={() => setShowTagDropdown(false)}
                    className="fixed inset-0 z-0"
                    aria-label="Close dropdown"
                  />
                )}
              </div>
            </div>
          )}

          {/* Notable Figures */}
          {poster.analysisCompleted && poster.rawAiResponse?.notableFigures && poster.rawAiResponse.notableFigures.length > 0 && (
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-4 mt-4">
              <h4 className="text-lg font-bold text-slate-900 mb-3">
                Notable Figures
              </h4>
              <p className="text-xs text-slate-500 mb-3">People mentioned or depicted in this piece</p>
              <div className="space-y-3">
                {poster.rawAiResponse.notableFigures.map((figure: { name: string; role: string; context: string; wikiSearch?: string }, idx: number) => (
                  <div key={idx} className="border-l-2 border-purple-300 pl-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-slate-900">{figure.name}</span>
                      <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded">
                        {figure.role}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600">{figure.context}</p>
                    <div className="flex gap-2 mt-2">
                      <a
                        href={`https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(figure.wikiSearch || figure.name)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded transition"
                      >
                        Wikipedia →
                      </a>
                      <a
                        href={`https://www.google.com/search?q=${encodeURIComponent(figure.name)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded transition"
                      >
                        Google →
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Historical Context - moved to left column */}
          {poster.analysisCompleted && poster.historicalContext && (
            <div className="bg-white rounded-lg shadow p-6 mt-4">
              <h3 className="text-xl font-bold text-slate-900 mb-4">
                Historical Context
              </h3>
              <p className="text-slate-700 whitespace-pre-wrap">
                {poster.historicalContext}
              </p>
            </div>
          )}

          {/* Design Profile - moved to left column */}
          {poster.analysisCompleted && poster.rawAiResponse && (
            <div className="bg-white rounded-lg shadow p-6 mt-4">
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
                    <p className="text-sm text-slate-600 mb-4">
                      Add reference images and/or text context, then click Re-analyze to run a fresh analysis.
                    </p>

                    {/* Reference Images Section */}
                    <div className="mb-4 p-3 bg-white rounded-lg border border-slate-200">
                      <h4 className="text-sm font-medium text-slate-700 mb-2">
                        Reference Images ({poster.supplementalImages?.length || 0}/5)
                      </h4>
                      <p className="text-xs text-slate-500 mb-3">
                        Add close-ups, back of item, signatures, original publication pages, etc.
                      </p>

                      {/* Existing images */}
                      {poster.supplementalImages && poster.supplementalImages.length > 0 && (
                        <div className="grid grid-cols-3 gap-2 mb-3">
                          {poster.supplementalImages.map((img, idx) => (
                            <div key={img.url} className="group">
                              <ImagePreview
                                src={img.url}
                                alt={img.description || `Reference ${idx + 1}`}
                                className="w-full h-20 object-cover rounded border border-slate-200"
                                previewSize={400}
                              >
                                <button
                                  onClick={() => deleteSupplementalImage(img.url)}
                                  disabled={deletingImage === img.url}
                                  className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full w-5 h-5 text-xs opacity-0 group-hover:opacity-100 transition disabled:opacity-50"
                                  title="Remove image"
                                >
                                  {deletingImage === img.url ? '...' : '×'}
                                </button>
                              </ImagePreview>
                              {img.description && (
                                <p className="text-xs text-slate-500 mt-1 truncate" title={img.description}>
                                  {img.description}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add new image */}
                      {(!poster.supplementalImages || poster.supplementalImages.length < 5) && (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={supplementalDescription}
                            onChange={(e) => setSupplementalDescription(e.target.value)}
                            placeholder="Describe this image (e.g., 'Close-up of signature')"
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                          />
                          <div className="flex gap-2">
                            <label className={`flex-1 px-3 py-2 text-sm text-center border-2 border-dashed rounded cursor-pointer transition ${
                              uploadingSupplemental || compressingSupplemental
                                ? 'border-slate-300 bg-slate-50 text-slate-400 cursor-not-allowed'
                                : 'border-slate-300 hover:border-amber-400 hover:bg-amber-50 text-slate-600'
                            }`}>
                              <input
                                type="file"
                                accept="image/jpeg,image/jpg,image/png"
                                disabled={uploadingSupplemental || compressingSupplemental}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    uploadSupplementalImage(file, supplementalDescription || undefined);
                                    e.target.value = '';
                                  }
                                }}
                                className="hidden"
                              />
                              {compressingSupplemental
                                ? 'Compressing...'
                                : uploadingSupplemental
                                ? 'Uploading...'
                                : 'Browse...'}
                            </label>
                            <button
                              type="button"
                              disabled={uploadingSupplemental || compressingSupplemental}
                              onClick={async () => {
                                try {
                                  const clipboardItems = await navigator.clipboard.read();
                                  for (const item of clipboardItems) {
                                    const imageType = item.types.find(t => t.startsWith('image/'));
                                    if (imageType) {
                                      const blob = await item.getType(imageType);
                                      const file = new File([blob], `pasted-${Date.now()}.png`, { type: imageType });
                                      uploadSupplementalImage(file, supplementalDescription || undefined);
                                      break;
                                    }
                                  }
                                } catch (err) {
                                  setError('Could not read clipboard. Try Ctrl+V in the description field.');
                                }
                              }}
                              className={`px-3 py-2 text-sm border-2 border-dashed rounded transition ${
                                uploadingSupplemental || compressingSupplemental
                                  ? 'border-slate-300 bg-slate-50 text-slate-400 cursor-not-allowed'
                                  : 'border-slate-300 hover:border-amber-400 hover:bg-amber-50 text-slate-600 cursor-pointer'
                              }`}
                            >
                              Paste
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Text Context */}
                    <div className="mb-4">
                      <label className="text-sm font-medium text-slate-700 mb-2 block">
                        Additional Context (optional)
                      </label>
                      <textarea
                        value={additionalContext}
                        onChange={(e) => setAdditionalContext(e.target.value)}
                        placeholder="E.g., The artist signature reads 'Yvan Petiteau'. This is from a 1946 issue of Formes et Couleurs magazine."
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none resize-none"
                        rows={3}
                      />
                    </div>

                    {error && (
                      <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                        <button onClick={() => setError('')} className="float-right text-red-400 hover:text-red-600">×</button>
                        {error}
                      </div>
                    )}

                    <div className="flex gap-3">
                      <button
                        onClick={() => triggerAnalysis(true, additionalContext)}
                        disabled={analyzing || uploadingSupplemental || compressingSupplemental}
                        className="flex-1 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {analyzing ? 'Re-analyzing...' : `Re-analyze${(poster.supplementalImages?.length || additionalContext.trim()) ? ' with New Context' : ''}`}
                      </button>
                      <button
                        onClick={() => {
                          setShowReanalyze(false);
                          setAdditionalContext('');
                          setSupplementalDescription('');
                          setError('');
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
                          Re-analyzing with {poster.supplementalImages?.length || 0} reference image(s)...
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
                  {/* Product Type */}
                  {poster.productType && (
                    <div className="border-b border-slate-100 pb-3">
                      <label className="text-sm font-medium text-slate-700">Product Type</label>
                      <p className="text-slate-900">{poster.productType}</p>
                    </div>
                  )}

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

              {/* Price Research & Sales */}
              <div className="bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-200 rounded-lg p-6">
                <h3 className="text-xl font-bold text-slate-900 mb-4">
                  Price Research & Sales
                </h3>

                {/* Research Links */}
                <div className="mb-6">
                  <p className="text-sm font-medium text-slate-700 mb-2">Research Links</p>

                  {/* Editable search term with copy button */}
                  <div className="flex items-center gap-2 mb-3 p-2 bg-white rounded border border-slate-200">
                    <input
                      type="text"
                      value={researchQuery}
                      onChange={(e) => setResearchQuery(e.target.value)}
                      className="text-sm text-slate-600 flex-1 bg-transparent outline-none focus:ring-0 border-none"
                      placeholder="Enter search terms..."
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(researchQuery);
                        alert('Search term copied!');
                      }}
                      className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded transition whitespace-nowrap"
                    >
                      Copy
                    </button>
                  </div>

                  <p className="text-xs text-slate-500 mb-2">Subscription sites:</p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    <a
                      href={`https://www.worthpoint.com/inventory/search?query=${encodeURIComponent(researchQuery)}&sort=SaleDate&img=true&saleDate=ALL_TIME`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm px-3 py-1.5 rounded transition bg-violet-600 hover:bg-violet-700 text-white"
                      title="Direct search - requires WorthPoint subscription"
                    >
                      Worthpoint
                    </a>
                    <a
                      href={`https://www.invaluable.com/search?keyword=${encodeURIComponent(researchQuery)}&upcoming=false`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm px-3 py-1.5 rounded transition bg-violet-600 hover:bg-violet-700 text-white"
                      title="Direct search - works for logged-in and logged-out users"
                    >
                      Invaluable
                    </a>
                    <a
                      href={`https://auctions.posterauctions.com/poster-price-guide?search=${encodeURIComponent(researchQuery)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm px-3 py-1.5 rounded transition bg-violet-600 hover:bg-violet-700 text-white"
                      title="Direct search - Rennert's Poster Price Guide"
                    >
                      Rennert's
                    </a>
                  </div>

                  <p className="text-xs text-slate-500 mb-2">Free sites (direct search):</p>
                  <div className="flex flex-wrap gap-2">
                    {RESEARCH_SOURCES.filter(s => !s.requiresSubscription).map((source) => (
                      <a
                        key={source.name}
                        href={source.urlTemplate.replace('{search}', encodeURIComponent(researchQuery))}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm px-3 py-1.5 rounded transition bg-slate-100 hover:bg-slate-200 text-slate-700"
                      >
                        {source.name}
                      </a>
                    ))}
                  </div>
                </div>

                {/* Price Summary */}
                {getPriceSummary() && (
                  <div className="mb-6 p-4 bg-white rounded-lg border border-violet-200">
                    <p className="text-sm font-medium text-slate-700 mb-2">Price Summary</p>
                    <div className="grid grid-cols-4 gap-4 text-center">
                      <div>
                        <p className="text-xs text-slate-500">Low</p>
                        <p className="text-lg font-bold text-red-600">${getPriceSummary()!.low.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">High</p>
                        <p className="text-lg font-bold text-green-600">${getPriceSummary()!.high.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Average</p>
                        <p className="text-lg font-bold text-violet-600">${getPriceSummary()!.avg.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Sales</p>
                        <p className="text-lg font-bold text-slate-700">{getPriceSummary()!.count}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Sales Log */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-slate-700">Sales Log</p>
                    <button
                      onClick={() => setShowAddSale(!showAddSale)}
                      className="text-sm bg-violet-600 hover:bg-violet-700 text-white px-3 py-1 rounded transition"
                    >
                      {showAddSale ? 'Cancel' : '+ Add Sale'}
                    </button>
                  </div>

                  {/* Add Sale Form */}
                  {showAddSale && (
                    <form onSubmit={addComparableSale} className="mb-4 p-4 bg-white rounded-lg border border-violet-200 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-medium text-slate-600">Date *</label>
                          <input
                            type="date"
                            value={newSale.date}
                            onChange={(e) => setNewSale({ ...newSale, date: e.target.value })}
                            required
                            className="w-full mt-1 px-3 py-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-600">Price *</label>
                          <div className="flex mt-1">
                            <select
                              value={newSale.currency}
                              onChange={(e) => setNewSale({ ...newSale, currency: e.target.value })}
                              className="px-2 py-2 text-sm border border-r-0 border-slate-300 rounded-l bg-slate-50"
                            >
                              <option value="USD">$</option>
                              <option value="EUR">€</option>
                              <option value="GBP">£</option>
                            </select>
                            <input
                              type="number"
                              step="0.01"
                              value={newSale.price}
                              onChange={(e) => setNewSale({ ...newSale, price: e.target.value })}
                              required
                              placeholder="0.00"
                              className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-r focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                            />
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600">Source *</label>
                        <select
                          value={newSale.source}
                          onChange={(e) => setNewSale({ ...newSale, source: e.target.value })}
                          required
                          className="w-full mt-1 px-3 py-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                        >
                          <option value="">Select source...</option>
                          <option value="Worthpoint">Worthpoint</option>
                          <option value="Invaluable">Invaluable</option>
                          <option value="Heritage Auctions">Heritage Auctions</option>
                          <option value="LiveAuctioneers">LiveAuctioneers</option>
                          <option value="eBay Sold">eBay Sold</option>
                          <option value="Christie's">Christie's</option>
                          <option value="Sotheby's">Sotheby's</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600">Condition</label>
                        <input
                          type="text"
                          value={newSale.condition}
                          onChange={(e) => setNewSale({ ...newSale, condition: e.target.value })}
                          placeholder="e.g., Excellent, Good, Fair"
                          className="w-full mt-1 px-3 py-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600">URL</label>
                        <input
                          type="url"
                          value={newSale.url}
                          onChange={(e) => setNewSale({ ...newSale, url: e.target.value })}
                          placeholder="Link to the sale listing"
                          className="w-full mt-1 px-3 py-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600">Notes</label>
                        <textarea
                          value={newSale.notes}
                          onChange={(e) => setNewSale({ ...newSale, notes: e.target.value })}
                          placeholder="Any additional details..."
                          rows={2}
                          className="w-full mt-1 px-3 py-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none resize-none"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={addingSale || !newSale.date || !newSale.price || !newSale.source}
                        className="w-full bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {addingSale ? 'Adding...' : 'Add Sale Record'}
                      </button>
                    </form>
                  )}

                  {/* Sales List */}
                  {poster.comparableSales && poster.comparableSales.length > 0 ? (
                    <div className="space-y-2">
                      {poster.comparableSales
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .map((sale) => (
                          <div
                            key={sale.id}
                            className="p-3 bg-white rounded-lg border border-slate-200 group"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-1">
                                  <span className="font-bold text-violet-700">
                                    {sale.currency === 'USD' ? '$' : sale.currency === 'EUR' ? '€' : '£'}
                                    {sale.price.toLocaleString()}
                                  </span>
                                  <span className="text-sm text-slate-600">{sale.source}</span>
                                  <span className="text-xs text-slate-400">
                                    {new Date(sale.date).toLocaleDateString()}
                                  </span>
                                </div>
                                {sale.condition && (
                                  <p className="text-xs text-slate-500">Condition: {sale.condition}</p>
                                )}
                                {sale.notes && (
                                  <p className="text-xs text-slate-500 mt-1">{sale.notes}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition">
                                {sale.url && (
                                  <a
                                    href={sale.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded"
                                  >
                                    View →
                                  </a>
                                )}
                                <button
                                  onClick={() => deleteComparableSale(sale.id)}
                                  disabled={deletingSaleId === sale.id}
                                  className="text-xs bg-red-100 hover:bg-red-200 text-red-600 px-2 py-1 rounded disabled:opacity-50"
                                >
                                  {deletingSaleId === sale.id ? '...' : 'Delete'}
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 text-center py-4 bg-white rounded-lg border border-dashed border-slate-300">
                      No sales recorded yet. Use the research links above to find comparable sales.
                    </p>
                  )}
                </div>
              </div>

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
