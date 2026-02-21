'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Poster, SupplementalImage, ComparableSale, ResearchSite, LinkedArtist, LinkedPrinter, LinkedPublisher, LinkedPublication, ResearchImage, ResearchImageType, ShopifyData, RECORD_SOURCE_LABELS, RecordSource } from '@/types/poster';
import { SELLER_TYPE_LABELS, SellerType } from '@/types/seller';
import { formatDate } from '@/lib/utils';
import Link from 'next/link';
import ImagePreview from '@/components/ImagePreview';
import ShopifyPanel from '@/components/ShopifyPanel';
import IdentificationResearchPanel from '@/components/IdentificationResearchPanel';
import ValuationPanel from '@/components/ValuationPanel';
import ProductDescriptionEditor from '@/components/ProductDescriptionEditor';
import Twemoji from '@/components/Twemoji';
import PosterResearchTab from '@/components/PosterResearchTab';
import PosterValuationTab from '@/components/PosterValuationTab';

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

// Format currency value - handles both simple values and Shopify money JSON objects
function formatCurrency(value: string | null | undefined): string | null {
  if (!value) return null;

  // Check if it's a JSON object (Shopify money format: {"amount":"188.63","currency_code":"USD"})
  if (value.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(value);
      if (parsed.amount) {
        const num = parseFloat(parsed.amount);
        const currency = parsed.currency_code || 'USD';
        if (!isNaN(num)) {
          return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(num);
        }
      }
    } catch {
      // Not valid JSON, fall through to simple parsing
    }
  }

  // Simple numeric value
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
}

// Get metafield value from shopifyData
function getMetafield(shopifyData: ShopifyData | null | undefined, namespaceKey: string): string | null {
  if (!shopifyData?.metafields) return null;
  const [namespace, key] = namespaceKey.split('.');
  const mf = shopifyData.metafields.find(m => m.namespace === namespace && m.key === key);
  return mf?.value || null;
}

// Format date for display (mm/dd/yyyy)
function formatDisplayDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}/${d.getFullYear()}`;
  } catch {
    return dateStr;
  }
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
  const [skepticalMode, setSkepticalMode] = useState(false);
  const [showReanalyze, setShowReanalyze] = useState(false);
  const [uploadingSupplemental, setUploadingSupplemental] = useState(false);
  const [supplementalDescription, setSupplementalDescription] = useState('');
  const [deletingImage, setDeletingImage] = useState<string | null>(null);
  const [compressingSupplemental, setCompressingSupplemental] = useState(false);
  // Research images state
  const [showResearchImages, setShowResearchImages] = useState(false);
  const [uploadingResearchImage, setUploadingResearchImage] = useState(false);
  const [compressingResearchImage, setCompressingResearchImage] = useState(false);
  const [researchImageDescription, setResearchImageDescription] = useState('');
  const [researchImageType, setResearchImageType] = useState<ResearchImageType>('signature');
  const [deletingResearchImage, setDeletingResearchImage] = useState<string | null>(null);
  // Tag management state
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [savingTags, setSavingTags] = useState(false);
  const [tagSearch, setTagSearch] = useState('');
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [refreshingTags, setRefreshingTags] = useState(false);

  // Color management state
  const [availableColors, setAvailableColors] = useState<{name: string, hexCode: string | null}[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [savingColors, setSavingColors] = useState(false);

  // Helper to get hex code for a color name
  const getColorHex = (colorName: string): string | null => {
    const color = availableColors.find(c => c.name === colorName);
    return color?.hexCode || null;
  };

  // Helper to determine if text should be white or black based on background color
  const getContrastTextColor = (hexColor: string | null): string => {
    if (!hexColor) return 'text-slate-700';
    // Remove # if present
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    // Calculate luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? 'text-black' : 'text-white';
  };

  // Printing technique management state
  const [availableTechniques, setAvailableTechniques] = useState<{id: number, name: string}[]>([]);
  const [selectedTechniqueIds, setSelectedTechniqueIds] = useState<number[]>([]);
  const [savingTechniques, setSavingTechniques] = useState(false);
  const [techniqueSearch, setTechniqueSearch] = useState('');
  const [showTechniqueDropdown, setShowTechniqueDropdown] = useState(false);
  const [refreshingTechniques, setRefreshingTechniques] = useState(false);

  // Comparable sales state
  const [showAddSale, setShowAddSale] = useState(false);
  const [addingSale, setAddingSale] = useState(false);
  const [deletingSaleId, setDeletingSaleId] = useState<string | null>(null);
  const [researchQuery, setResearchQuery] = useState('');
  const [researchSites, setResearchSites] = useState<ResearchSite[]>([]);
  const [copiedCredential, setCopiedCredential] = useState<string | null>(null);

  // Shopify auto-refresh state
  const [syncingFromShopify, setSyncingFromShopify] = useState(false);

  // Artist linking state
  const [linkedArtist, setLinkedArtist] = useState<LinkedArtist | null>(null);
  const [showVerificationDetails, setShowVerificationDetails] = useState(false);
  const [unlinkingArtist, setUnlinkingArtist] = useState(false);

  // Printer linking state
  const [linkedPrinter, setLinkedPrinter] = useState<LinkedPrinter | null>(null);
  const [showPrinterVerificationDetails, setShowPrinterVerificationDetails] = useState(false);
  const [unlinkingPrinter, setUnlinkingPrinter] = useState(false);

  // Publisher linking state
  const [linkedPublisher, setLinkedPublisher] = useState<LinkedPublisher | null>(null);
  const [unlinkingPublisher, setUnlinkingPublisher] = useState(false);

  // Publication linking state
  const [linkedPublication, setLinkedPublication] = useState<LinkedPublication | null>(null);
  const [unlinkingPublication, setUnlinkingPublication] = useState(false);

  // Research/Valuation tabs state
  const [activeResearchTab, setActiveResearchTab] = useState<'research' | 'valuation'>('research');

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

  // Fetch available colors (with hex codes)
  useEffect(() => {
    fetch('/api/managed-lists/colors')
      .then(res => res.json())
      .then(data => {
        if (data.items) {
          setAvailableColors(data.items.map((c: { name: string, hexCode: string | null }) => ({
            name: c.name,
            hexCode: c.hexCode
          })));
        }
      })
      .catch(err => console.error('Failed to fetch colors:', err));
  }, []);

  // Fetch research sites (from unified platforms table)
  useEffect(() => {
    fetch('/api/platforms?research=true')
      .then(res => res.json())
      .then(data => {
        if (data.items) {
          // Map to ResearchSite interface for compatibility
          const sites = data.items.map((p: { id: number; name: string; searchUrlTemplate: string | null; requiresSubscription: boolean; username: string | null; password: string | null; displayOrder: number; createdAt: string }) => ({
            id: p.id,
            name: p.name,
            urlTemplate: p.searchUrlTemplate || '',
            requiresSubscription: p.requiresSubscription,
            username: p.username,
            password: p.password,
            displayOrder: p.displayOrder,
            createdAt: new Date(p.createdAt),
          }));
          setResearchSites(sites);
        }
      })
      .catch(err => console.error('Failed to fetch research sites:', err));
  }, []);

  // Fetch available printing techniques (media types)
  useEffect(() => {
    fetch('/api/managed-lists/media-types')
      .then(res => res.json())
      .then(data => {
        if (data.items) {
          setAvailableTechniques(data.items.map((t: { id: number, name: string }) => ({ id: t.id, name: t.name })));
        }
      })
      .catch(err => console.error('Failed to fetch media types:', err));
  }, []);

  // Initialize selected tags when poster loads
  useEffect(() => {
    if (poster?.itemTags) {
      setSelectedTags(poster.itemTags);
    }
  }, [poster?.itemTags]);

  // Initialize selected colors when poster loads
  useEffect(() => {
    if (poster?.colors) {
      setSelectedColors(poster.colors);
    }
  }, [poster?.colors]);

  // Initialize selected printing techniques when poster loads
  useEffect(() => {
    if (poster?.printingTechniqueIds) {
      setSelectedTechniqueIds(poster.printingTechniqueIds);
    }
  }, [poster?.printingTechniqueIds]);

  // Initialize research query when poster loads
  useEffect(() => {
    if (poster) {
      const parts: string[] = [];
      if (poster.title) parts.push(poster.title);
      if (poster.productType) parts.push(poster.productType);
      setResearchQuery(parts.join(' '));
    }
  }, [poster?.title, poster?.productType]);

  // Auto-refresh from Shopify when poster loads (if linked)
  useEffect(() => {
    async function autoRefreshFromShopify() {
      if (!poster?.shopifyProductId || syncingFromShopify) return;

      try {
        setSyncingFromShopify(true);
        const res = await fetch('/api/shopify/pull', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ posterId: poster.id }),
        });

        if (res.ok) {
          // Silently refetch poster data with updated Shopify info
          const posterRes = await fetch(`/api/posters/${posterId}`);
          if (posterRes.ok) {
            const data = await posterRes.json();
            setPoster(data);
          }
        }
      } catch (err) {
        // Silently fail - this is a background refresh
        console.warn('Auto-refresh from Shopify failed:', err);
      } finally {
        setSyncingFromShopify(false);
      }
    }

    autoRefreshFromShopify();
    // Only run once when poster first loads with a Shopify ID
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poster?.id, poster?.shopifyProductId]);

  // Fetch linked artist when poster loads
  useEffect(() => {
    async function fetchLinkedArtist() {
      if (!poster?.artistId) {
        setLinkedArtist(null);
        return;
      }

      try {
        const res = await fetch(`/api/posters/${poster.id}/artist-link`);
        if (res.ok) {
          const data = await res.json();
          if (data.linked && data.artist) {
            setLinkedArtist(data.artist);
          } else {
            setLinkedArtist(null);
          }
        }
      } catch (err) {
        console.warn('Failed to fetch linked artist:', err);
        setLinkedArtist(null);
      }
    }

    fetchLinkedArtist();
  }, [poster?.id, poster?.artistId]);

  // Fetch linked printer when poster loads
  useEffect(() => {
    async function fetchLinkedPrinter() {
      if (!poster?.printerId) {
        setLinkedPrinter(null);
        return;
      }

      try {
        const res = await fetch(`/api/posters/${poster.id}/printer-link`);
        if (res.ok) {
          const data = await res.json();
          if (data.linked && data.printer) {
            setLinkedPrinter(data.printer);
          } else {
            setLinkedPrinter(null);
          }
        }
      } catch (err) {
        console.warn('Failed to fetch linked printer:', err);
        setLinkedPrinter(null);
      }
    }

    fetchLinkedPrinter();
  }, [poster?.id, poster?.printerId]);

  // Fetch linked publisher when poster loads
  useEffect(() => {
    async function fetchLinkedPublisher() {
      if (!poster?.publisherId) {
        setLinkedPublisher(null);
        return;
      }

      try {
        const res = await fetch(`/api/posters/${poster.id}/publisher-link`);
        if (res.ok) {
          const data = await res.json();
          if (data.linked && data.publisher) {
            setLinkedPublisher(data.publisher);
          } else {
            setLinkedPublisher(null);
          }
        }
      } catch (err) {
        console.warn('Failed to fetch linked publisher:', err);
        setLinkedPublisher(null);
      }
    }

    fetchLinkedPublisher();
  }, [poster?.id, poster?.publisherId]);

  // Fetch linked publication when poster loads
  useEffect(() => {
    async function fetchLinkedPublication() {
      if (!poster?.publicationId) {
        setLinkedPublication(null);
        return;
      }

      try {
        const res = await fetch(`/api/posters/${poster.id}/publication-link`);
        if (res.ok) {
          const data = await res.json();
          if (data.linked && data.publication) {
            setLinkedPublication(data.publication);
          } else {
            setLinkedPublication(null);
          }
        }
      } catch (err) {
        console.warn('Failed to fetch linked publication:', err);
        setLinkedPublication(null);
      }
    }

    fetchLinkedPublication();
  }, [poster?.id, poster?.publicationId]);

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

  async function unlinkArtist() {
    if (!poster) return;

    try {
      setUnlinkingArtist(true);
      const res = await fetch(`/api/posters/${poster.id}/artist-link`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Failed to unlink artist');
      }

      // Update poster to clear artistId
      setPoster(prev => prev ? { ...prev, artistId: null } : null);
      setLinkedArtist(null);
    } catch (err) {
      console.error('Failed to unlink artist:', err);
      setError(err instanceof Error ? err.message : 'Failed to unlink artist');
    } finally {
      setUnlinkingArtist(false);
    }
  }

  async function unlinkPrinter() {
    if (!poster) return;

    try {
      setUnlinkingPrinter(true);
      const res = await fetch(`/api/posters/${poster.id}/printer-link`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Failed to unlink printer');
      }

      // Update poster to clear printerId
      setPoster(prev => prev ? { ...prev, printerId: null } : null);
      setLinkedPrinter(null);
    } catch (err) {
      console.error('Failed to unlink printer:', err);
      setError(err instanceof Error ? err.message : 'Failed to unlink printer');
    } finally {
      setUnlinkingPrinter(false);
    }
  }

  async function unlinkPublisher() {
    if (!poster) return;

    try {
      setUnlinkingPublisher(true);
      const res = await fetch(`/api/posters/${poster.id}/publisher-link`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Failed to unlink publisher');
      }

      // Update poster to clear publisherId
      setPoster(prev => prev ? { ...prev, publisherId: null } : null);
      setLinkedPublisher(null);
    } catch (err) {
      console.error('Failed to unlink publisher:', err);
      setError(err instanceof Error ? err.message : 'Failed to unlink publisher');
    } finally {
      setUnlinkingPublisher(false);
    }
  }

  async function unlinkPublication() {
    if (!poster) return;

    try {
      setUnlinkingPublication(true);
      const res = await fetch(`/api/posters/${poster.id}/publication-link`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Failed to unlink publication');
      }

      // Update poster to clear publicationId
      setPoster(prev => prev ? { ...prev, publicationId: null } : null);
      setLinkedPublication(null);
    } catch (err) {
      console.error('Failed to unlink publication:', err);
      setError(err instanceof Error ? err.message : 'Failed to unlink publication');
    } finally {
      setUnlinkingPublication(false);
    }
  }

  async function triggerAnalysis(forceReanalyze = false, context?: string, skepticalMode = false) {
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
          skepticalMode,
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

  // Research image functions
  async function uploadResearchImage(file: File, imageType: ResearchImageType, description?: string) {
    if (!poster) return;

    // Validate file type
    if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
      setError('Please select a JPG or PNG image file.');
      return;
    }

    try {
      setUploadingResearchImage(true);
      setError('');

      let processedFile = file;

      // Compress if over 5MB
      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize) {
        setCompressingResearchImage(true);
        try {
          processedFile = await compressImage(file);
        } catch (err) {
          setError('Failed to compress image. Please try a smaller file.');
          setCompressingResearchImage(false);
          setUploadingResearchImage(false);
          return;
        }
        setCompressingResearchImage(false);
      }

      const formData = new FormData();
      formData.append('file', processedFile);
      formData.append('imageType', imageType);
      if (description) {
        formData.append('description', description);
      }

      const res = await fetch(`/api/posters/${posterId}/research-images`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to upload research image');
      }

      // Refresh poster data
      await fetchPoster();
      setResearchImageDescription('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload research image');
    } finally {
      setUploadingResearchImage(false);
      setCompressingResearchImage(false);
    }
  }

  async function deleteResearchImage(imageUrl: string) {
    if (!poster) return;

    try {
      setDeletingResearchImage(imageUrl);
      setError('');

      const res = await fetch(
        `/api/posters/${posterId}/research-images?imageUrl=${encodeURIComponent(imageUrl)}`,
        { method: 'DELETE' }
      );

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to delete research image');
      }

      // Refresh poster data
      await fetchPoster();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete research image');
    } finally {
      setDeletingResearchImage(null);
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

  // Save colors to database
  async function saveColors(newColors: string[]) {
    if (!poster) return;

    try {
      setSavingColors(true);
      const res = await fetch(`/api/posters/${posterId}/colors`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ colors: newColors }),
      });

      if (!res.ok) {
        throw new Error('Failed to save colors');
      }

      setSelectedColors(newColors);
    } catch (err) {
      console.error('Failed to save colors:', err);
      // Revert on error
      setSelectedColors(poster.colors || []);
    } finally {
      setSavingColors(false);
    }
  }

  // Toggle a color selection
  function toggleColor(color: string) {
    const newColors = selectedColors.includes(color)
      ? selectedColors.filter(c => c !== color)
      : [...selectedColors, color];
    saveColors(newColors);
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

  // Save printing techniques to database
  async function saveTechniques(newIds: number[]) {
    if (!poster) return;

    try {
      setSavingTechniques(true);
      const res = await fetch(`/api/posters/${posterId}/techniques`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ techniqueIds: newIds }),
      });

      if (!res.ok) {
        throw new Error('Failed to save printing techniques');
      }

      setSelectedTechniqueIds(newIds);
    } catch (err) {
      console.error('Failed to save printing techniques:', err);
      // Revert on error
      setSelectedTechniqueIds(poster.printingTechniqueIds || []);
    } finally {
      setSavingTechniques(false);
    }
  }

  // Toggle a technique selection
  function toggleTechnique(id: number) {
    const newIds = selectedTechniqueIds.includes(id)
      ? selectedTechniqueIds.filter(t => t !== id)
      : [...selectedTechniqueIds, id];
    saveTechniques(newIds);
  }

  // Add a technique from the dropdown
  function addTechnique(id: number) {
    if (!selectedTechniqueIds.includes(id)) {
      const newIds = [...selectedTechniqueIds, id];
      saveTechniques(newIds);
    }
    setTechniqueSearch('');
    setShowTechniqueDropdown(false);
  }

  // Refresh technique suggestions using Sonnet
  async function refreshTechniqueSuggestions() {
    if (!poster) return;

    try {
      setRefreshingTechniques(true);
      setError('');

      const res = await fetch(`/api/posters/${posterId}/refresh-techniques`, {
        method: 'POST',
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to refresh techniques');
      }

      // Refresh poster data to get new suggested techniques
      await fetchPoster();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh techniques');
    } finally {
      setRefreshingTechniques(false);
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
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="text-slate-600 hover:text-slate-900 flex items-center"
          >
            ← Back to Dashboard
          </Link>
          {/* PM App link - only shows when linked to Shopify */}
          {poster.shopifyProductId && (() => {
            // Extract numeric ID from GID format: gid://shopify/Product/8168953938035 → 8168953938035
            const numericId = poster.shopifyProductId.split('/').pop();
            return (
              <a
                href={`https://admin.shopify.com/store/authentic-vintage-posters/apps/avp-product-management/products/${numericId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg transition flex items-center gap-1.5 text-sm font-medium"
                title="Open in PM App"
              >
                <span>🛒</span>
                <span>PM App</span>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            );
          })()}
        </div>
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

      {/* Main Tab Navigation */}
      <div className="bg-white border border-slate-200 rounded-t-lg overflow-hidden mb-0">
        <div className="flex">
          <button
            onClick={() => setActiveResearchTab('research')}
            className={`flex-1 px-6 py-4 text-sm font-medium transition flex items-center justify-center gap-2 ${
              activeResearchTab === 'research'
                ? 'bg-violet-50 text-violet-700 border-b-2 border-violet-600'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50 border-b-2 border-transparent'
            }`}
          >
            <span className="text-lg">🔍</span>
            <span>Research</span>
            <span className="text-xs text-slate-400 ml-1">(What is this?)</span>
          </button>
          <button
            onClick={() => setActiveResearchTab('valuation')}
            className={`flex-1 px-6 py-4 text-sm font-medium transition flex items-center justify-center gap-2 ${
              activeResearchTab === 'valuation'
                ? 'bg-green-50 text-green-700 border-b-2 border-green-600'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50 border-b-2 border-transparent'
            }`}
          >
            <span className="text-lg">💰</span>
            <span>Valuation</span>
            <span className="text-xs text-slate-400 ml-1">(What's it worth?)</span>
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeResearchTab === 'valuation' ? (
        <div className="bg-slate-50 border border-t-0 border-slate-200 rounded-b-lg p-6">
          <PosterValuationTab poster={poster} onUpdate={fetchPoster} />
        </div>
      ) : (
        <div className="bg-slate-50 border border-t-0 border-slate-200 rounded-b-lg p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Image */}
            <div>
              <div className="bg-white rounded-lg shadow p-4">
                <ImagePreview
                  src={poster.imageUrl}
                  alt={poster.title || poster.fileName}
                  className="w-full h-full object-contain aspect-[3/4] bg-slate-100 rounded-lg"
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
                        className="w-full h-16 object-cover rounded border border-slate-200"
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

            {/* Research Images Section */}
            <div className="mt-4 pt-4 border-t border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-slate-700">
                  Research Images ({poster.researchImages?.length || 0}/5)
                </h4>
                <button
                  onClick={() => setShowResearchImages(!showResearchImages)}
                  className="text-xs bg-teal-100 hover:bg-teal-200 text-teal-700 px-2 py-1 rounded transition"
                >
                  {showResearchImages ? 'Hide' : 'Manage'}
                </button>
              </div>
              <p className="text-xs text-slate-500 mb-2">
                Store signatures, title pages, printer marks - preserved separately from product images.
              </p>

              {/* Existing research images display */}
              {poster.researchImages && poster.researchImages.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {poster.researchImages.map((img, idx) => (
                    <div key={img.url} className="group relative">
                      <ImagePreview
                        src={img.url}
                        alt={img.description || `Research ${idx + 1}`}
                        className="w-full h-20 object-cover rounded border border-slate-200"
                      >
                        {showResearchImages && (
                          <button
                            onClick={() => deleteResearchImage(img.url)}
                            disabled={deletingResearchImage === img.url}
                            className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full w-5 h-5 text-xs opacity-0 group-hover:opacity-100 transition disabled:opacity-50"
                            title="Remove image"
                          >
                            {deletingResearchImage === img.url ? '...' : '×'}
                          </button>
                        )}
                      </ImagePreview>
                      <div className="text-xs mt-1">
                        <span className="px-1.5 py-0.5 bg-teal-100 text-teal-700 rounded text-[10px]">
                          {img.imageType.replace('_', ' ')}
                        </span>
                        {img.description && (
                          <p className="text-slate-500 mt-0.5 truncate" title={img.description}>
                            {img.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload form - shown when managing */}
              {showResearchImages && (!poster.researchImages || poster.researchImages.length < 5) && (
                <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-medium text-slate-600 mb-1 block">Type</label>
                      <select
                        value={researchImageType}
                        onChange={(e) => setResearchImageType(e.target.value as ResearchImageType)}
                        className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                      >
                        <option value="signature">Signature</option>
                        <option value="title_page">Title Page</option>
                        <option value="printer_mark">Printer Mark</option>
                        <option value="detail">Detail</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600 mb-1 block">Description</label>
                      <input
                        type="text"
                        value={researchImageDescription}
                        onChange={(e) => setResearchImageDescription(e.target.value)}
                        placeholder="Optional description"
                        className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <label className={`flex-1 px-3 py-2 text-sm text-center border-2 border-dashed rounded cursor-pointer transition ${
                      uploadingResearchImage || compressingResearchImage
                        ? 'border-slate-300 bg-slate-50 text-slate-400 cursor-not-allowed'
                        : 'border-teal-300 hover:border-teal-400 hover:bg-teal-100 text-teal-700'
                    }`}>
                      <input
                        type="file"
                        accept="image/jpeg,image/jpg,image/png"
                        disabled={uploadingResearchImage || compressingResearchImage}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            uploadResearchImage(file, researchImageType, researchImageDescription || undefined);
                            e.target.value = '';
                          }
                        }}
                        className="hidden"
                      />
                      {compressingResearchImage
                        ? 'Compressing...'
                        : uploadingResearchImage
                        ? 'Uploading...'
                        : 'Browse...'}
                    </label>
                    <button
                      type="button"
                      disabled={uploadingResearchImage || compressingResearchImage}
                      onClick={async () => {
                        try {
                          const clipboardItems = await navigator.clipboard.read();
                          for (const item of clipboardItems) {
                            const imageType = item.types.find(t => t.startsWith('image/'));
                            if (imageType) {
                              const blob = await item.getType(imageType);
                              const file = new File([blob], `pasted-${Date.now()}.png`, { type: imageType });
                              uploadResearchImage(file, researchImageType, researchImageDescription || undefined);
                              break;
                            }
                          }
                        } catch (err) {
                          setError('Could not read clipboard.');
                        }
                      }}
                      className={`px-3 py-2 text-sm border-2 border-dashed rounded transition ${
                        uploadingResearchImage || compressingResearchImage
                          ? 'border-slate-300 bg-slate-50 text-slate-400 cursor-not-allowed'
                          : 'border-teal-300 hover:border-teal-400 hover:bg-teal-100 text-teal-700 cursor-pointer'
                      }`}
                    >
                      Paste
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Product Description */}
          {poster.analysisCompleted && (poster.productDescription || poster.rawAiResponse?.productDescriptions) && (
            <div className="mt-4">
              <ProductDescriptionEditor poster={poster} onUpdate={fetchPoster} />
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

          {/* Colors */}
          {(poster.analysisCompleted || selectedColors.length > 0) && availableColors.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mt-4 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <h4 className="text-lg font-bold text-slate-900">
                  Colors
                </h4>
                {savingColors && (
                  <span className="text-xs text-slate-500">Saving...</span>
                )}
              </div>
              <p className="text-xs text-slate-500 mb-3">Dominant colors identified in the image</p>

              {/* AI Suggested Colors */}
              {poster.rawAiResponse?.suggestedColors && poster.rawAiResponse.suggestedColors.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-slate-600 mb-2">AI Suggested</p>
                  <div className="flex flex-wrap gap-2">
                    {poster.rawAiResponse.suggestedColors.map((color: string) => {
                      const hex = getColorHex(color);
                      const isSelected = selectedColors.includes(color);
                      return (
                        <button
                          key={color}
                          onClick={() => toggleColor(color)}
                          className={`px-3 py-1 rounded-full text-sm font-medium transition border-2 ${
                            isSelected ? 'border-blue-500 ring-2 ring-blue-300' : 'border-transparent hover:border-slate-400'
                          } ${getContrastTextColor(hex)}`}
                          style={{ backgroundColor: hex || '#f1f5f9' }}
                        >
                          {color}
                          {isSelected && <span className="ml-1">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Selected Colors */}
              {selectedColors.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-slate-600 mb-2">Selected ({selectedColors.length})</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedColors.map((color) => {
                      const hex = getColorHex(color);
                      return (
                        <span
                          key={color}
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border border-slate-300 ${getContrastTextColor(hex)}`}
                          style={{ backgroundColor: hex || '#f1f5f9' }}
                        >
                          {color}
                          <button
                            onClick={() => toggleColor(color)}
                            className="ml-1 hover:opacity-70"
                          >
                            ×
                          </button>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Add Color from Available List */}
              <div>
                <p className="text-xs font-medium text-slate-600 mb-2">Add Color</p>
                <div className="flex flex-wrap gap-1.5">
                  {availableColors
                    .filter(c => !selectedColors.includes(c.name))
                    .slice(0, 20)
                    .map((color) => (
                      <button
                        key={color.name}
                        onClick={() => toggleColor(color.name)}
                        title={color.name}
                        className="w-6 h-6 rounded-full transition border border-slate-300 hover:border-blue-400 hover:ring-2 hover:ring-blue-200 hover:scale-110"
                        style={{ backgroundColor: color.hexCode || '#f1f5f9' }}
                      />
                    ))}
                  {availableColors.filter(c => !selectedColors.includes(c.name)).length > 20 && (
                    <span className="text-xs text-slate-500 self-center ml-1">
                      +{availableColors.filter(c => !selectedColors.includes(c.name)).length - 20} more
                    </span>
                  )}
                </div>
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
                  <div className="space-y-3">
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

              </div>
            </div>
          )}

          {/* Time & Place Section */}
          {poster.rawAiResponse?.historicalContext?.timeAndPlace && (
            poster.rawAiResponse.historicalContext.timeAndPlace.world ||
            poster.rawAiResponse.historicalContext.timeAndPlace.regional ||
            poster.rawAiResponse.historicalContext.timeAndPlace.local
          ) && (
            <div className="bg-white rounded-lg shadow p-6 mt-6">
              <h3 className="text-xl font-bold text-slate-900 mb-4">Time & Place</h3>
              <div className="space-y-4">
                {/* World - US Perspective */}
                {poster.rawAiResponse.historicalContext.timeAndPlace.world && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Twemoji emoji="🇺🇸" />
                      <label className="text-sm font-medium text-slate-700">
                        America in {poster.estimatedDate || 'the Era'}
                      </label>
                    </div>
                    <p className="text-slate-700 text-sm pl-7">
                      {poster.rawAiResponse.historicalContext.timeAndPlace.world}
                    </p>
                  </div>
                )}

                {/* Regional - Country of Origin */}
                {poster.rawAiResponse.historicalContext.timeAndPlace.regional && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">🌍</span>
                      <label className="text-sm font-medium text-slate-700">Regional Context</label>
                    </div>
                    <p className="text-slate-700 text-sm pl-7">
                      {poster.rawAiResponse.historicalContext.timeAndPlace.regional}
                    </p>
                  </div>
                )}

                {/* Local - City/Industry */}
                {poster.rawAiResponse.historicalContext.timeAndPlace.local && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">📍</span>
                      <label className="text-sm font-medium text-slate-700">Local Context</label>
                    </div>
                    <p className="text-slate-700 text-sm pl-7">
                      {poster.rawAiResponse.historicalContext.timeAndPlace.local}
                    </p>
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
                    {/* How Re-analysis Works */}
                    <div className="text-sm text-slate-600 mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                      <p>
                        <strong>Normal mode:</strong> Uses current Shopify data (title, description, metafields) plus any
                        reference images or additional context you provide below.
                      </p>
                      <p>
                        <strong>Skeptical mode:</strong> Ignores ALL Shopify data and analyzes the image as if it were
                        completely unknown. Only uses the image itself plus any context you explicitly provide.
                      </p>
                    </div>

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
                        <div className="space-y-3">
                          {/* Step 1: Optional description */}
                          <div>
                            <label className="text-xs text-slate-500 mb-1 block">
                              Description for next image (optional):
                            </label>
                            <input
                              type="text"
                              value={supplementalDescription}
                              onChange={(e) => setSupplementalDescription(e.target.value)}
                              placeholder="e.g., 'Close-up of signature', 'Back of print'"
                              className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                            />
                          </div>
                          {/* Step 2: Load image */}
                          <div className="flex gap-2">
                            <label className={`flex-1 px-3 py-2.5 text-sm text-center border-2 border-dashed rounded cursor-pointer transition ${
                              uploadingSupplemental || compressingSupplemental
                                ? 'border-slate-300 bg-slate-50 text-slate-400 cursor-not-allowed'
                                : 'border-amber-400 bg-amber-50 hover:bg-amber-100 text-amber-700 font-medium'
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
                                    setSupplementalDescription(''); // Clear for next image
                                  }
                                }}
                                className="hidden"
                              />
                              {compressingSupplemental
                                ? 'Compressing...'
                                : uploadingSupplemental
                                ? 'Uploading...'
                                : 'Browse for Image'}
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
                                      setSupplementalDescription(''); // Clear for next image
                                      break;
                                    }
                                  }
                                } catch (err) {
                                  setError('Could not read clipboard. Try Ctrl+V in the description field.');
                                }
                              }}
                              className={`px-4 py-2.5 text-sm border-2 border-dashed rounded transition ${
                                uploadingSupplemental || compressingSupplemental
                                  ? 'border-slate-300 bg-slate-50 text-slate-400 cursor-not-allowed'
                                  : 'border-amber-400 bg-amber-50 hover:bg-amber-100 text-amber-700 font-medium cursor-pointer'
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
                      <label className="text-sm font-medium text-slate-700 mb-1 block">
                        Additional Context (optional)
                      </label>
                      <p className="text-xs text-slate-500 mb-2">
                        Provide facts, pose questions, or guide the analysis direction.
                      </p>
                      <textarea
                        value={additionalContext}
                        onChange={(e) => setAdditionalContext(e.target.value)}
                        placeholder="Examples: 'The signature reads Yvan Petiteau' or 'Could this pattern also represent a face?' or 'Please focus on identifying the printing technique'"
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

                    {/* Skeptical Mode Option */}
                    <div className={`mb-4 p-3 rounded-lg border ${skepticalMode ? 'bg-orange-50 border-orange-300' : 'bg-amber-50 border-amber-200'}`}>
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={skepticalMode}
                          onChange={(e) => setSkepticalMode(e.target.checked)}
                          className="mt-1 h-4 w-4 text-orange-600 border-slate-300 rounded focus:ring-orange-500"
                        />
                        <div>
                          <span className={`font-medium ${skepticalMode ? 'text-orange-800' : 'text-slate-800'}`}>
                            Skeptical Mode {skepticalMode && '(Active)'}
                          </span>
                          <p className="text-xs text-slate-600 mt-0.5">
                            Ignore ALL Shopify data (title, description, metafields). Analyze as if this were a brand new,
                            unknown image. Only uses the primary image plus any reference images/context you add above.
                          </p>
                        </div>
                      </label>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => triggerAnalysis(true, additionalContext, skepticalMode)}
                        disabled={analyzing || uploadingSupplemental || compressingSupplemental}
                        className={`flex-1 ${skepticalMode ? 'bg-orange-600 hover:bg-orange-700' : 'bg-amber-600 hover:bg-amber-700'} text-white px-4 py-2 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {analyzing ? 'Re-analyzing...' : skepticalMode ? 'Re-analyze (Skeptical)' : `Re-analyze${(poster.supplementalImages?.length || additionalContext.trim()) ? ' with New Context' : ''}`}
                      </button>
                      <button
                        onClick={() => {
                          setShowReanalyze(false);
                          setAdditionalContext('');
                          setSupplementalDescription('');
                          setSkepticalMode(false);
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
                {(() => {
                  // Extract Shopify identification values
                  const shopifyIdent = poster.shopifyData as ShopifyData | null;
                  const shopifyArtist = getMetafield(shopifyIdent, 'jadepuma.artist');
                  // Note: Shopify title is synced to poster.title, not stored separately
                  const shopifyYear = getMetafield(shopifyIdent, 'specs.year'); // Product year, not purchase date
                  const shopifyHeight = getMetafield(shopifyIdent, 'specs.height');
                  const shopifyWidth = getMetafield(shopifyIdent, 'specs.width');
                  const shopifyDimensions = shopifyHeight && shopifyWidth
                    ? `${shopifyHeight}" H x ${shopifyWidth}" W`
                    : null;

                  return (
                <div className="space-y-4">
                  {/* Product Type */}
                  {poster.productType && (
                    <div className="border-b border-slate-100 pb-3">
                      <label className="text-sm font-medium text-slate-700">Product Type</label>
                      <p className="text-slate-900">{poster.productType}</p>
                    </div>
                  )}

                  {/* Artist - Show both Shopify and AI sources */}
                  <div className="border-b border-slate-100 pb-3">
                    <label className="text-sm font-medium text-slate-700 mb-2 block">Artist</label>

                    {/* Shopify Artist (if linked) */}
                    {poster.shopifyProductId && (
                      <div className="flex items-start gap-2 mb-2">
                        <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded shrink-0 mt-0.5">Shopify</span>
                        <p className="text-slate-900">{shopifyArtist || <span className="text-slate-400 italic">Not set</span>}</p>
                      </div>
                    )}

                    {/* AI Sourced Artist */}
                    <div className="flex items-start gap-2">
                      <span className="text-xs px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded shrink-0 mt-0.5">AI</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-slate-900 font-medium">{poster.artist || 'Unknown'}</p>
                          {poster.artistConfidence && (
                            <button
                              onClick={() => setShowVerificationDetails(!showVerificationDetails)}
                              className={`text-xs px-2 py-0.5 rounded cursor-pointer hover:opacity-80 transition flex items-center gap-1 ${
                                poster.artistConfidence === 'confirmed' ? 'bg-green-100 text-green-800' :
                                poster.artistConfidence === 'likely' ? 'bg-blue-100 text-blue-800' :
                                poster.artistConfidence === 'uncertain' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {poster.artistConfidence}
                              {poster.artistConfidenceScore && (
                                <span className="opacity-70">({poster.artistConfidenceScore}%)</span>
                              )}
                              <svg
                                className={`w-3 h-3 transition-transform ${showVerificationDetails ? 'rotate-180' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                          )}
                        </div>
                        {poster.artistSource && (
                          <p className="text-xs text-slate-500 mt-1">Source: {poster.artistSource}</p>
                        )}
                      </div>
                    </div>

                    {/* Expandable Verification Details */}
                    {showVerificationDetails && poster.artistVerification && (
                      <div className="mt-3 p-3 bg-slate-50 rounded-lg text-sm">
                        <h4 className="font-medium text-slate-700 mb-2">Verification Details</h4>

                        {/* Attribution Basis - how was this artist identified? */}
                        {poster.attributionBasis && (
                          <div className="mb-3 p-2 rounded border bg-white">
                            <span className="text-xs font-medium text-slate-500">Attribution Basis: </span>
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              poster.attributionBasis === 'visible_signature' ? 'bg-green-100 text-green-800' :
                              poster.attributionBasis === 'printed_credit' ? 'bg-green-100 text-green-800' :
                              poster.attributionBasis === 'external_knowledge' ? 'bg-blue-100 text-blue-800' :
                              poster.attributionBasis === 'stylistic_analysis' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {poster.attributionBasis === 'visible_signature' ? '✍️ Visible Signature' :
                               poster.attributionBasis === 'printed_credit' ? '📝 Printed Credit' :
                               poster.attributionBasis === 'external_knowledge' ? '📚 External Knowledge' :
                               poster.attributionBasis === 'stylistic_analysis' ? '🎨 Stylistic Analysis' :
                               poster.attributionBasis === 'none' ? '❓ Unknown' :
                               poster.attributionBasis}
                            </span>
                          </div>
                        )}

                        {poster.artistSignatureText && (
                          <p className="text-slate-600 mb-2">
                            <span className="font-medium">Signature:</span> "{poster.artistSignatureText}"
                          </p>
                        )}
                        <ul className="space-y-1 text-slate-600">
                          <li className="flex items-center gap-2">
                            {poster.artistVerification.signatureReadable ? (
                              <span className="text-green-600">✓</span>
                            ) : (
                              <span className="text-red-500">✗</span>
                            )}
                            Signature Readable
                          </li>
                          <li className="flex items-center gap-2">
                            {poster.artistVerification.professionVerified ? (
                              <span className="text-green-600">✓</span>
                            ) : (
                              <span className="text-red-500">✗</span>
                            )}
                            Profession Verified (illustrator/poster artist)
                          </li>
                          <li className="flex items-center gap-2">
                            {poster.artistVerification.eraMatches ? (
                              <span className="text-green-600">✓</span>
                            ) : (
                              <span className="text-red-500">✗</span>
                            )}
                            Era Matches
                          </li>
                          <li className="flex items-center gap-2">
                            {poster.artistVerification.styleMatches ? (
                              <span className="text-green-600">✓</span>
                            ) : (
                              <span className="text-red-500">✗</span>
                            )}
                            Style Matches Known Works
                          </li>
                          <li className="flex items-center gap-2">
                            {poster.artistVerification.multipleArtistsWithName ? (
                              <span className="text-yellow-600">⚠</span>
                            ) : (
                              <span className="text-green-600">✓</span>
                            )}
                            {poster.artistVerification.multipleArtistsWithName
                              ? 'Multiple Artists With Similar Name'
                              : 'Unique Name'}
                          </li>
                        </ul>
                        {poster.artistVerification.verificationNotes && (
                          <p className="mt-2 text-xs text-slate-500 italic">
                            {poster.artistVerification.verificationNotes}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Linked Artist Card */}
                    {linkedArtist && (
                      <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              {linkedArtist.wikipediaUrl ? (
                                <a
                                  href={linkedArtist.wikipediaUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-medium text-amber-900 hover:text-blue-600 hover:underline"
                                >
                                  {linkedArtist.name}
                                </a>
                              ) : (
                                <h4 className="font-medium text-amber-900">{linkedArtist.name}</h4>
                              )}
                              {linkedArtist.verified && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                  Verified
                                </span>
                              )}
                            </div>
                            {(linkedArtist.nationality || linkedArtist.birthYear) && (
                              <p className="text-sm text-amber-800">
                                {linkedArtist.nationality}
                                {linkedArtist.nationality && linkedArtist.birthYear && ' · '}
                                {linkedArtist.birthYear && (
                                  <span>
                                    {linkedArtist.birthYear}
                                    {linkedArtist.deathYear ? `–${linkedArtist.deathYear}` : '–present'}
                                  </span>
                                )}
                              </p>
                            )}
                            {linkedArtist.bio && (
                              <p className="text-xs text-amber-700 mt-1 line-clamp-2">
                                {linkedArtist.bio}
                              </p>
                            )}
                            <div className="flex items-center gap-3 mt-2">
                              {linkedArtist.wikipediaUrl && (
                                <a
                                  href={linkedArtist.wikipediaUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                                >
                                  Wikipedia →
                                </a>
                              )}
                              <Link
                                href={`/settings/lists?type=artists&edit=${linkedArtist.id}`}
                                className="text-xs text-amber-600 hover:text-amber-800 hover:underline"
                              >
                                View Profile →
                              </Link>
                            </div>
                          </div>
                          <button
                            onClick={unlinkArtist}
                            disabled={unlinkingArtist}
                            className="text-xs text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50 disabled:opacity-50"
                            title="Remove artist link"
                          >
                            {unlinkingArtist ? 'Unlinking...' : 'Unlink'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Title - Show Shopify and AI suggested */}
                  <div className="border-b border-slate-100 pb-3">
                    <label className="text-sm font-medium text-slate-700 mb-2 block">Title</label>

                    {/* Shopify Title (if linked) */}
                    {poster.shopifyProductId && (
                      <div className="flex items-start gap-2 mb-2">
                        <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded shrink-0 mt-0.5">Shopify</span>
                        <p className="text-slate-900">{poster.title || <span className="text-slate-400 italic">Not set</span>}</p>
                      </div>
                    )}

                    {/* AI Suggested Title - show if analysis completed */}
                    {poster.analysisCompleted && (poster.rawAiResponse as any)?.identification?.title && (
                      <div className="flex items-start gap-2">
                        <span className="text-xs px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded shrink-0 mt-0.5">AI</span>
                        <p className="text-slate-900">{(poster.rawAiResponse as any).identification.title}</p>
                      </div>
                    )}

                    {/* If not linked to Shopify and no AI, show title directly */}
                    {!poster.shopifyProductId && !poster.analysisCompleted && (
                      <p className="text-slate-900">{poster.title || 'Untitled'}</p>
                    )}
                  </div>

                  {/* Date - Show both Shopify year and AI estimated */}
                  <div className="border-b border-slate-100 pb-3">
                    <label className="text-sm font-medium text-slate-700 mb-2 block">Date</label>

                    {/* Shopify Year (if linked) - from specs.year metafield */}
                    {poster.shopifyProductId && (
                      <div className="flex items-start gap-2 mb-2">
                        <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded shrink-0 mt-0.5">Shopify</span>
                        <p className="text-slate-900">{shopifyYear || <span className="text-slate-400 italic">Not set</span>}</p>
                      </div>
                    )}

                    {/* AI Estimated Date */}
                    <div className="flex items-start gap-2">
                      <span className="text-xs px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded shrink-0 mt-0.5">AI</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-slate-900">{poster.estimatedDate || 'Unknown'}</p>
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
                        {poster.dateSource && (
                          <p className="text-xs text-slate-500 mt-1">Source: {poster.dateSource}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Dimensions - Always from Shopify */}
                  <div className="border-b border-slate-100 pb-3">
                    <label className="text-sm font-medium text-slate-700 mb-2 block">Dimensions</label>
                    {poster.shopifyProductId && (
                      <div className="flex items-start gap-2">
                        <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded shrink-0 mt-0.5">Shopify</span>
                        <p className="text-slate-900">
                          {shopifyDimensions || poster.dimensionsEstimate || <span className="text-slate-400 italic">Not set</span>}
                        </p>
                      </div>
                    )}
                    {!poster.shopifyProductId && (
                      <p className="text-slate-900">{poster.dimensionsEstimate || 'Unknown'}</p>
                    )}
                  </div>

                  {/* Publication with Confidence */}
                  {(poster.publication || linkedPublisher) && (
                    <div className="border-b border-slate-100 pb-3">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-sm font-medium text-slate-700">Publication</label>
                        {poster.publicationConfidence && (
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            poster.publicationConfidence === 'confirmed' ? 'bg-green-100 text-green-800' :
                            poster.publicationConfidence === 'likely' ? 'bg-blue-100 text-blue-800' :
                            poster.publicationConfidence === 'uncertain' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {poster.publicationConfidence}
                          </span>
                        )}
                      </div>
                      <p className="text-slate-900 font-medium">{poster.publication || linkedPublisher?.name}</p>
                      {poster.publicationSource && (
                        <p className="text-xs text-slate-500 mt-1">Source: {poster.publicationSource}</p>
                      )}

                      {/* Linked Publisher Card */}
                      {linkedPublisher && (
                        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                {linkedPublisher.wikipediaUrl ? (
                                  <a
                                    href={linkedPublisher.wikipediaUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-medium text-amber-900 hover:text-blue-600 hover:underline"
                                  >
                                    {linkedPublisher.name}
                                  </a>
                                ) : (
                                  <h4 className="font-medium text-amber-900">{linkedPublisher.name}</h4>
                                )}
                                {linkedPublisher.verified && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                    Verified
                                  </span>
                                )}
                              </div>
                              {(linkedPublisher.publicationType || linkedPublisher.country || linkedPublisher.foundedYear) && (
                                <p className="text-sm text-amber-800">
                                  {linkedPublisher.publicationType}
                                  {linkedPublisher.publicationType && linkedPublisher.country && ' · '}
                                  {linkedPublisher.country}
                                  {(linkedPublisher.publicationType || linkedPublisher.country) && linkedPublisher.foundedYear && ' · '}
                                  {linkedPublisher.foundedYear && (
                                    <span>Founded {linkedPublisher.foundedYear}{linkedPublisher.ceasedYear ? `–${linkedPublisher.ceasedYear}` : ''}</span>
                                  )}
                                </p>
                              )}
                              {linkedPublisher.bio && (
                                <p className="text-xs text-amber-700 mt-1 line-clamp-2">
                                  {linkedPublisher.bio}
                                </p>
                              )}
                              <div className="flex items-center gap-3 mt-2">
                                {linkedPublisher.wikipediaUrl && (
                                  <a
                                    href={linkedPublisher.wikipediaUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                                  >
                                    Wikipedia →
                                  </a>
                                )}
                                <Link
                                  href={`/settings/lists?type=publishers&edit=${linkedPublisher.id}`}
                                  className="text-xs text-amber-600 hover:text-amber-800 hover:underline"
                                >
                                  View Profile →
                                </Link>
                              </div>
                            </div>
                            <button
                              onClick={unlinkPublisher}
                              disabled={unlinkingPublisher}
                              className="text-xs text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50 disabled:opacity-50"
                              title="Remove publisher link"
                            >
                              {unlinkingPublisher ? 'Unlinking...' : 'Unlink'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Publication Source (for antique prints/plates and periodicals) */}
                  {linkedPublication && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-sm font-medium text-slate-700">Publication</label>
                        {linkedPublication.verified && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            Verified
                          </span>
                        )}
                      </div>
                      <p className="text-slate-900 font-medium">{linkedPublication.title}</p>
                      {(linkedPublication.author || linkedPublication.publicationYear) && (
                        <p className="text-sm text-slate-600">
                          {linkedPublication.author && `by ${linkedPublication.author}`}
                          {linkedPublication.author && linkedPublication.publicationYear && ' · '}
                          {linkedPublication.publicationYear && `${linkedPublication.publicationYear}`}
                        </p>
                      )}

                      {/* Linked Publication Card */}
                      <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              {linkedPublication.wikipediaUrl ? (
                                <a
                                  href={linkedPublication.wikipediaUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-medium text-amber-900 hover:text-blue-600 hover:underline"
                                >
                                  {linkedPublication.title}
                                </a>
                              ) : (
                                <h4 className="font-medium text-amber-900">{linkedPublication.title}</h4>
                              )}
                            </div>
                            {(linkedPublication.author || linkedPublication.publicationYear || linkedPublication.country) && (
                              <p className="text-sm text-amber-800">
                                {linkedPublication.author}
                                {linkedPublication.author && linkedPublication.publicationYear && ' · '}
                                {linkedPublication.publicationYear}
                                {(linkedPublication.author || linkedPublication.publicationYear) && linkedPublication.country && ' · '}
                                {linkedPublication.country}
                              </p>
                            )}
                            {linkedPublication.contributors && (
                              <p className="text-xs text-amber-700 mt-1 italic">
                                {linkedPublication.contributors}
                              </p>
                            )}
                            {linkedPublication.bio && (
                              <p className="text-xs text-amber-700 mt-1 line-clamp-2">
                                {linkedPublication.bio}
                              </p>
                            )}
                            <div className="flex items-center gap-3 mt-2">
                              {linkedPublication.wikipediaUrl && (
                                <a
                                  href={linkedPublication.wikipediaUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                                >
                                  Wikipedia →
                                </a>
                              )}
                              <Link
                                href={`/settings/lists?type=publications&edit=${linkedPublication.id}`}
                                className="text-xs text-amber-600 hover:text-amber-800 hover:underline"
                              >
                                View Profile →
                              </Link>
                            </div>
                          </div>
                          <button
                            onClick={unlinkPublication}
                            disabled={unlinkingPublication}
                            className="text-xs text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50 disabled:opacity-50"
                            title="Remove publication link"
                          >
                            {unlinkingPublication ? 'Unlinking...' : 'Unlink'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                  );
                })()}
              </div>

              {/* Source Citations - moved up for visibility */}
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

              {/* Printing Information */}
              {(poster.analysisCompleted || poster.printingTechnique || poster.printer) && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-xl font-bold text-slate-900 mb-4">
                    Printing Information
                  </h3>

                  {/* Printing Technique/Medium Tags */}
                  {poster.analysisCompleted && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-slate-700">
                          Printing Technique/Medium
                        </label>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={refreshTechniqueSuggestions}
                            disabled={refreshingTechniques}
                            className="text-xs px-2 py-1 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 disabled:opacity-50 transition"
                            title="Refresh AI technique suggestions"
                          >
                            {refreshingTechniques ? 'Refreshing...' : 'Refresh'}
                          </button>
                          {savingTechniques && (
                            <span className="text-xs text-slate-500">Saving...</span>
                          )}
                        </div>
                      </div>

                      {/* AI Original Analysis (display only) */}
                      {poster.printingTechnique && (
                        <div className="flex items-center gap-2 mb-3 p-2 bg-slate-50 rounded border border-slate-200">
                          <span className="text-xs text-slate-500">AI detected:</span>
                          <span className="text-sm text-slate-700">{poster.printingTechnique}</span>
                          <a
                            href={getPrintingWikiUrl(poster.printingTechnique)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:text-blue-700 hover:underline"
                          >
                            Learn more
                          </a>
                        </div>
                      )}

                      {/* AI Suggested Techniques */}
                      {poster.rawAiResponse?.suggestedPrintingTechniques?.length > 0 && (
                        <div className="mb-3">
                          <p className="text-xs font-medium text-slate-600 mb-2">AI Suggested</p>
                          <div className="flex flex-wrap gap-2">
                            {poster.rawAiResponse.suggestedPrintingTechniques.map((name: string) => {
                              const technique = availableTechniques.find(t => t.name === name);
                              if (!technique) return null;
                              const isSelected = selectedTechniqueIds.includes(technique.id);
                              return (
                                <button
                                  key={technique.id}
                                  onClick={() => toggleTechnique(technique.id)}
                                  className={`px-3 py-1 rounded-full text-sm transition ${
                                    isSelected
                                      ? 'bg-indigo-600 text-white'
                                      : 'bg-blue-100 text-blue-800 border border-blue-300 hover:bg-blue-200'
                                  }`}
                                >
                                  {name}
                                  {isSelected && <span className="ml-1">✓</span>}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Selected Techniques */}
                      {selectedTechniqueIds.length > 0 && (
                        <div className="mb-3">
                          <p className="text-xs font-medium text-slate-600 mb-2">
                            Selected ({selectedTechniqueIds.length})
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {selectedTechniqueIds.map((id) => {
                              const technique = availableTechniques.find(t => t.id === id);
                              if (!technique) return null;
                              return (
                                <span
                                  key={id}
                                  className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-600 text-white rounded-full text-sm"
                                >
                                  {technique.name}
                                  <button
                                    onClick={() => toggleTechnique(id)}
                                    className="ml-1 hover:bg-indigo-700 rounded-full w-4 h-4 flex items-center justify-center text-xs"
                                    title="Remove technique"
                                  >
                                    ×
                                  </button>
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Add Technique Dropdown */}
                      <div className="relative">
                        <p className="text-xs font-medium text-slate-600 mb-2">Add Technique</p>
                        <input
                          type="text"
                          value={techniqueSearch}
                          onChange={(e) => {
                            setTechniqueSearch(e.target.value);
                            setShowTechniqueDropdown(true);
                          }}
                          onFocus={() => setShowTechniqueDropdown(true)}
                          onBlur={() => setTimeout(() => setShowTechniqueDropdown(false), 200)}
                          placeholder="Search techniques..."
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                        />
                        {showTechniqueDropdown && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                            {availableTechniques
                              .filter(t =>
                                !selectedTechniqueIds.includes(t.id) &&
                                t.name.toLowerCase().includes(techniqueSearch.toLowerCase())
                              )
                              .slice(0, 10)
                              .map((technique) => (
                                <button
                                  key={technique.id}
                                  onMouseDown={() => addTechnique(technique.id)}
                                  className="w-full px-3 py-2 text-left text-sm hover:bg-indigo-50 transition"
                                >
                                  {technique.name}
                                </button>
                              ))}
                            {availableTechniques.filter(t =>
                              !selectedTechniqueIds.includes(t.id) &&
                              t.name.toLowerCase().includes(techniqueSearch.toLowerCase())
                            ).length === 0 && (
                              <p className="px-3 py-2 text-sm text-slate-500">No matching techniques</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Printer with Verification */}
                  {poster.printer && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-sm font-medium text-slate-700">Printer</label>
                        {poster.printerConfidence && (
                          <button
                            onClick={() => setShowPrinterVerificationDetails(!showPrinterVerificationDetails)}
                            className={`px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 ${
                              poster.printerConfidence === 'confirmed'
                                ? 'bg-green-100 text-green-700'
                                : poster.printerConfidence === 'likely'
                                ? 'bg-blue-100 text-blue-700'
                                : poster.printerConfidence === 'uncertain'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {poster.printerConfidence}
                            <svg
                              className={`w-3 h-3 transition-transform ${showPrinterVerificationDetails ? 'rotate-180' : ''}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        )}
                      </div>
                      <p className="text-slate-900 font-medium">{poster.printer}</p>
                      {poster.printerSource && (
                        <p className="text-xs text-slate-500 mt-1">Source: {poster.printerSource}</p>
                      )}

                      {/* Expandable Printer Verification Details */}
                      {showPrinterVerificationDetails && poster.printerVerification && (
                        <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200 text-sm">
                          {poster.printerVerification.marksText && (
                            <p className="text-slate-700 mb-2">
                              <span className="font-medium">Marks text:</span> &quot;{poster.printerVerification.marksText}&quot;
                            </p>
                          )}
                          <ul className="space-y-1">
                            <li className="flex items-center gap-2">
                              <span className={poster.printerVerification.marksReadable ? 'text-green-600' : 'text-red-500'}>
                                {poster.printerVerification.marksReadable ? '✓' : '✗'}
                              </span>
                              <span>Printer Marks Readable</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <span className={poster.printerVerification.historyVerified ? 'text-green-600' : 'text-red-500'}>
                                {poster.printerVerification.historyVerified ? '✓' : '✗'}
                              </span>
                              <span>History Verified</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <span className={poster.printerVerification.locationMatches ? 'text-green-600' : 'text-red-500'}>
                                {poster.printerVerification.locationMatches ? '✓' : '✗'}
                              </span>
                              <span>Location Matches</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <span className={poster.printerVerification.styleMatches ? 'text-green-600' : 'text-red-500'}>
                                {poster.printerVerification.styleMatches ? '✓' : '✗'}
                              </span>
                              <span>Style Consistent</span>
                            </li>
                          </ul>
                          {poster.printerVerification.verificationNotes && (
                            <p className="mt-2 text-slate-600 border-t border-slate-200 pt-2">
                              {poster.printerVerification.verificationNotes}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Linked Printer Card */}
                      {linkedPrinter && (
                        <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-medium text-amber-900">{linkedPrinter.name}</h4>
                              {linkedPrinter.verified && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium mt-1">
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                  Verified
                                </span>
                              )}
                            </div>
                          </div>
                          {(linkedPrinter.location || linkedPrinter.foundedYear) && (
                            <p className="text-xs text-amber-700 mt-1">
                              {linkedPrinter.location}
                              {linkedPrinter.location && linkedPrinter.foundedYear && ' · '}
                              {linkedPrinter.foundedYear && (
                                <>Founded {linkedPrinter.foundedYear}{linkedPrinter.closedYear ? `–${linkedPrinter.closedYear}` : ''}</>
                              )}
                            </p>
                          )}
                          {linkedPrinter.bio && (
                            <p className="text-xs text-amber-800 mt-2 line-clamp-3">{linkedPrinter.bio}</p>
                          )}
                          <div className="flex items-center gap-3 mt-2">
                            {linkedPrinter.wikipediaUrl && (
                              <a
                                href={linkedPrinter.wikipediaUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                              >
                                Wikipedia →
                              </a>
                            )}
                            <button
                              onClick={unlinkPrinter}
                              disabled={unlinkingPrinter}
                              className="text-xs text-red-600 hover:text-red-800 hover:underline disabled:opacity-50"
                            >
                              {unlinkingPrinter ? 'Unlinking...' : 'Unlink'}
                            </button>
                          </div>
                        </div>
                      )}
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

              {/* Acquisition - consolidated purchase/source data */}
              {poster.shopifyProductId && (
                (() => {
                  const shopifyData = poster.shopifyData as ShopifyData | null;
                  const metafields = {
                    sourcePlatform: getMetafield(shopifyData, 'jadepuma.source_platform'),
                    dealerName: getMetafield(shopifyData, 'jadepuma.dealer'),
                    privateSellerName: getMetafield(shopifyData, 'jadepuma.private_seller_name'),
                    privateSellerEmail: getMetafield(shopifyData, 'jadepuma.private_seller_email'),
                    purchaseDate: getMetafield(shopifyData, 'jadepuma.date'),
                    purchasePrice: getMetafield(shopifyData, 'jadepuma.purchase_price'),
                    shippingCost: getMetafield(shopifyData, 'jadepuma.avp_shipping'),
                    restorationCost: getMetafield(shopifyData, 'jadepuma.avp_restoration'),
                  };

                  // Check if we have any acquisition data to display
                  const hasAcquisitionData = metafields.sourcePlatform || metafields.dealerName ||
                    metafields.privateSellerName || metafields.purchaseDate || metafields.purchasePrice ||
                    metafields.shippingCost || metafields.restorationCost ||
                    shopifyData?.cost || shopifyData?.price || poster.platformIdentity;

                  if (!hasAcquisitionData) return null;

                  return (
                    <div className="bg-white rounded-lg shadow p-6">
                      <h3 className="text-xl font-bold text-slate-900 mb-4">Acquisition</h3>

                      {/* Source Row: Platform + Seller + Identity */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div>
                          <p className="text-sm text-slate-500 font-medium mb-1">Platform</p>
                          <p className="text-slate-900 font-medium">{metafields.sourcePlatform || '—'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-500 font-medium mb-1">Seller</p>
                          <p className="text-slate-900 font-medium">{metafields.dealerName || '—'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-500 font-medium mb-1">Username</p>
                          <p className="text-slate-900 font-mono">{poster.platformIdentity || '—'}</p>
                        </div>
                      </div>

                      {/* Private Seller (if applicable) */}
                      {(metafields.privateSellerName || metafields.privateSellerEmail) && (
                        <div className="mb-6 p-3 bg-slate-50 rounded">
                          <p className="text-sm text-slate-500 font-medium mb-1">Private Seller</p>
                          <p className="text-slate-900">{metafields.privateSellerName}</p>
                          {metafields.privateSellerEmail && (
                            <p className="text-sm text-slate-600">{metafields.privateSellerEmail}</p>
                          )}
                        </div>
                      )}

                      {/* Cost Breakdown */}
                      <div className="border-t border-slate-200 pt-4">
                        <h4 className="text-sm font-semibold text-slate-700 mb-3">Cost Breakdown</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <p className="text-xs text-slate-500">Purchase Date</p>
                            <p className="text-slate-900 font-medium">{formatDisplayDate(metafields.purchaseDate) || '—'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Purchase Price</p>
                            <p className="text-slate-900 font-medium">{formatCurrency(metafields.purchasePrice) || '—'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Shipping</p>
                            <p className="text-slate-900 font-medium">{formatCurrency(metafields.shippingCost) || '—'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Restoration</p>
                            <p className="text-slate-900 font-medium">{formatCurrency(metafields.restorationCost) || '—'}</p>
                          </div>
                        </div>

                        {/* COGS Summary */}
                        <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center">
                          <span className="text-sm font-medium text-slate-700">Total COGS</span>
                          <span className="text-lg font-bold text-slate-900">{formatCurrency(shopifyData?.cost) || '—'}</span>
                        </div>
                      </div>

                      {/* Pricing */}
                      <div className="border-t border-slate-200 pt-4 mt-4">
                        <h4 className="text-sm font-semibold text-slate-700 mb-3">Pricing</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-slate-500">List Price</p>
                            <p className="text-xl font-bold text-green-700">{formatCurrency(shopifyData?.price) || '—'}</p>
                          </div>
                          {shopifyData?.compareAtPrice && (
                            <div>
                              <p className="text-xs text-slate-500">Compare At</p>
                              <p className="text-lg text-slate-500 line-through">{formatCurrency(shopifyData.compareAtPrice)}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Record source badge */}
                      {poster.recordSource && poster.recordSource !== 'unknown' && (
                        <div className="mt-4 pt-4 border-t border-slate-200">
                          <span className="text-xs text-slate-500">
                            Source: {RECORD_SOURCE_LABELS[poster.recordSource as RecordSource]}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()
              )}

              {/* Shopify Integration */}
              <ShopifyPanel poster={poster} onUpdate={fetchPoster} syncing={syncingFromShopify} />

              {/* Dealer Research for Attribution */}
              <IdentificationResearchPanel poster={poster} onUpdate={fetchPoster} />

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
      )}
    </div>
  );
}
