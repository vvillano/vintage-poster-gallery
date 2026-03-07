'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import type { ProductDetail, ProductUpdatePayload, MetafieldWrite, LinkedArtistRecord } from '@/types/shopify-product-detail';
import ProductDetailSection from '@/components/products/detail/ProductDetailSection';
import BasicInfoSection from '@/components/products/detail/BasicInfoSection';
import SpecificationsSection from '@/components/products/detail/SpecificationsSection';
import ImagesSection from '@/components/products/detail/ImagesSection';
import PricingSection from '@/components/products/detail/PricingSection';
// SubjectTaggingSection moved to Research tab
import MetafieldsSection from '@/components/products/detail/MetafieldsSection';
import SeoSection from '@/components/products/detail/SeoSection';
import AcquisitionSection from '@/components/products/detail/AcquisitionSection';
import DeleteProductModal from '@/components/products/detail/DeleteProductModal';
import ProductTabs, { type ProductTab } from '@/components/products/detail/ProductTabs';
import ProductResearchTab from '@/components/products/detail/ProductResearchTab';
import { computeAutoTags, parseYear } from '@/lib/auto-tags';
import type { SizeTagRule, DateTagRule } from '@/lib/auto-tags';

interface FormData {
  title: string;
  bodyHtml: string;
  productType: string;
  status: string;
  tags: string[];
  price: string;
  compareAtPrice: string;
  sku: string;
  inventoryQuantity: string;
  location: string;
  internalNotes: string;
  internalTags: string[];
  artist: string;
  year: string;
  countryOfOrigin: string[];
  height: string;
  width: string;
  condition: string;
  conditionDetails: string;
  colors: string[];
  medium: string[];
  itemNotes: string;
}

export default function ProductDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [internalTagOptions, setInternalTagOptions] = useState<{ name: string; color: string }[]>([]);
  const [tagOptions, setTagOptions] = useState<{ name: string }[]>([]);
  const [colorOptions, setColorOptions] = useState<{ name: string; hexCode: string | null }[]>([]);
  const [mediumOptions, setMediumOptions] = useState<{ name: string }[]>([]);
  const [suggestedColors, setSuggestedColors] = useState<string[]>([]);
  const [suggestingColors, setSuggestingColors] = useState(false);
  const [sizeTagRules, setSizeTagRules] = useState<SizeTagRule[]>([]);
  const [dateTagRules, setDateTagRules] = useState<DateTagRule[]>([]);
  const [locationOptions, setLocationOptions] = useState<string[]>([]);
  const [productTypeOptions, setProductTypeOptions] = useState<{ name: string; defaultConditionText: string | null }[]>([]);
  const [conditionOptions, setConditionOptions] = useState<string[]>([]);
  const [countryOptions, setCountryOptions] = useState<string[]>([]);
  const [allPublications, setAllPublications] = useState<{ id: string; name: string }[]>([]);
  const [shopDomain, setShopDomain] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ProductTab>('listing');

  const [formData, setFormData] = useState<FormData>({
    title: '',
    bodyHtml: '',
    productType: '',
    status: 'draft',
    tags: [],
    price: '0.00',
    compareAtPrice: '',
    sku: '',
    inventoryQuantity: '0',
    location: '',
    internalNotes: '',
    internalTags: [],
    artist: '',
    year: '',
    countryOfOrigin: [],
    height: '',
    width: '',
    condition: '',
    conditionDetails: '',
    colors: [],
    medium: [],
    itemNotes: '',
  });

  const loadProduct = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/shopify/products/${id}`, { cache: 'no-store' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.details || data.error || 'Failed to load product');
      }
      const data: ProductDetail = await res.json();
      setProduct(data);
      // Parse internal tags from metafield JSON array
      let parsedInternalTags: string[] = [];
      if (data.metafields.internalTags) {
        try {
          const parsed = JSON.parse(data.metafields.internalTags);
          if (Array.isArray(parsed)) parsedInternalTags = parsed;
        } catch {
          parsedInternalTags = data.metafields.internalTags.split(',').map((t: string) => t.trim()).filter(Boolean);
        }
      }

      // Parse colors from metafield JSON array
      let parsedColors: string[] = [];
      if (data.metafields.color) {
        try {
          const parsed = JSON.parse(data.metafields.color);
          if (Array.isArray(parsed)) parsedColors = parsed;
        } catch {
          parsedColors = [data.metafields.color];
        }
      }

      // Parse medium from metafield JSON array
      let parsedMedium: string[] = [];
      if (data.metafields.medium) {
        try {
          const parsed = JSON.parse(data.metafields.medium);
          if (Array.isArray(parsed)) parsedMedium = parsed;
        } catch {
          parsedMedium = [data.metafields.medium];
        }
      }

      // Parse country of origin from metafield JSON array
      let parsedCountries: string[] = [];
      if (data.metafields.countryOfOrigin) {
        try {
          const parsed = JSON.parse(data.metafields.countryOfOrigin);
          if (Array.isArray(parsed)) parsedCountries = parsed;
        } catch {
          parsedCountries = [data.metafields.countryOfOrigin];
        }
      }

      setFormData({
        title: data.title,
        bodyHtml: data.bodyHtml || '',
        productType: data.productType || '',
        status: data.status,
        tags: [...data.tags],
        price: data.price,
        compareAtPrice: data.compareAtPrice || '',
        sku: data.sku || '',
        inventoryQuantity: String(data.inventoryQuantity ?? 0),
        location: data.metafields.location || '',
        internalNotes: data.metafields.internalNotes || '',
        internalTags: parsedInternalTags,
        artist: data.metafields.artist || '',
        year: data.metafields.year || '',
        countryOfOrigin: parsedCountries,
        height: data.metafields.height || '',
        width: data.metafields.width || '',
        condition: data.metafields.condition || '',
        conditionDetails: data.metafields.conditionDetails || '',
        colors: parsedColors,
        medium: parsedMedium,
        itemNotes: data.metafields.itemNotes || '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load product');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadProduct();
    fetch('/api/managed-lists/internal-tags')
      .then((res) => res.ok ? res.json() : { items: [] })
      .then((data) => setInternalTagOptions(data.items.map((i: { name: string; color: string }) => ({ name: i.name, color: i.color }))))
      .catch(() => {});
    fetch('/api/managed-lists/available-tags')
      .then((res) => res.ok ? res.json() : { items: [] })
      .then((data) => setTagOptions(data.items.map((i: { name: string }) => ({ name: i.name }))))
      .catch(() => {});
    fetch('/api/managed-lists/colors')
      .then((res) => res.ok ? res.json() : { items: [] })
      .then((data) => setColorOptions(data.items.map((i: { name: string; hexCode: string | null }) => ({ name: i.name, hexCode: i.hexCode ?? null }))))
      .catch(() => {});
    fetch('/api/managed-lists/media-types')
      .then((res) => res.ok ? res.json() : { items: [] })
      .then((data) => setMediumOptions(data.items.map((i: { name: string }) => ({ name: i.name }))))
      .catch(() => {});
    fetch('/api/managed-lists/size-tags')
      .then((res) => res.ok ? res.json() : { items: [] })
      .then((data) => setSizeTagRules(data.items.map((i: SizeTagRule) => ({
        id: i.id, name: i.name, tagType: i.tagType,
        minValue: i.minValue != null ? Number(i.minValue) : null,
        maxValue: i.maxValue != null ? Number(i.maxValue) : null,
      }))))
      .catch(() => {});
    fetch('/api/managed-lists/date-tags')
      .then((res) => res.ok ? res.json() : { items: [] })
      .then((data) => setDateTagRules(data.items.map((i: DateTagRule) => ({
        id: i.id, name: i.name,
        startYear: i.startYear != null ? Number(i.startYear) : null,
        endYear: i.endYear != null ? Number(i.endYear) : null,
      }))))
      .catch(() => {});
    fetch('/api/managed-lists/locations')
      .then((res) => res.ok ? res.json() : { items: [] })
      .then((data) => setLocationOptions(data.items.map((i: { name: string }) => i.name)))
      .catch(() => {});
    fetch('/api/managed-lists/product-types')
      .then((res) => res.ok ? res.json() : { items: [] })
      .then((data) => setProductTypeOptions(data.items.filter((i: { active?: boolean }) => i.active !== false).map((i: { name: string; defaultConditionText?: string }) => ({ name: i.name, defaultConditionText: i.defaultConditionText || null }))))
      .catch(() => {});
    fetch('/api/managed-lists/conditions')
      .then((res) => res.ok ? res.json() : { items: [] })
      .then((data) => setConditionOptions(data.items.map((i: { name: string }) => i.name)))
      .catch(() => {});
    fetch('/api/managed-lists/countries')
      .then((res) => res.ok ? res.json() : { items: [] })
      .then((data) => setCountryOptions(data.items.map((i: { name: string }) => i.name)))
      .catch(() => {});
    fetch('/api/shopify/publications')
      .then((res) => res.ok ? res.json() : { publications: [] })
      .then((data) => setAllPublications(data.publications))
      .catch(() => {});
    fetch('/api/shopify/config')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => { if (data?.shopDomain) setShopDomain(data.shopDomain); })
      .catch(() => {});
  }, [loadProduct]);

  // 1. Pick up suggestedColors from linked poster (re-runs when product reloads after analysis)
  const lpSuggestedKey = product?.linkedPoster?.suggestedColors
    ? JSON.stringify(product.linkedPoster.suggestedColors) : '';
  useEffect(() => {
    if (product?.linkedPoster?.suggestedColors?.length) {
      setSuggestedColors(product.linkedPoster.suggestedColors);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lpSuggestedKey]);

  // 2. Auto-detect colors via API when no suggestions exist yet
  useEffect(() => {
    if (!product) return;
    if (product.images.length === 0) return;
    if (suggestedColors.length > 0) return;
    if (product.linkedPoster?.suggestedColors?.length) return; // handled by effect 1

    setSuggestingColors(true);
    fetch(`/api/shopify/products/${id}/suggest-colors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl: product.images[0].url }),
    })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.suggestedColors?.length) {
          setSuggestedColors(data.suggestedColors);
        }
      })
      .catch(() => {})
      .finally(() => setSuggestingColors(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);

  // 3. Auto-apply suggested colors to Shopify when they arrive and no colors exist
  const colorsAutoAppliedRef = useRef(false);
  useEffect(() => {
    if (suggestedColors.length === 0) return;
    if (!product) return;
    if (colorsAutoAppliedRef.current) return;

    // Check if Shopify already has colors
    const currentColor = product.metafields.color;
    if (currentColor) {
      try {
        const parsed = JSON.parse(currentColor);
        if (Array.isArray(parsed) && parsed.length > 0) {
          colorsAutoAppliedRef.current = true;
          return;
        }
      } catch {
        colorsAutoAppliedRef.current = true;
        return;
      }
    }

    colorsAutoAppliedRef.current = true;
    setFormData((prev) => ({ ...prev, colors: suggestedColors }));
    fetch(`/api/shopify/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        metafields: [{
          namespace: 'jadepuma',
          key: 'color',
          value: JSON.stringify(suggestedColors),
          type: 'list.single_line_text_field',
        }],
      }),
    })
      .then((res) => res.ok ? res.json() : null)
      .then((updated) => {
        if (updated) {
          setProduct((prev) => prev ? { ...prev, metafields: { ...prev.metafields, color: updated.metafields.color } } : prev);
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestedColors, product?.id]);

  // Merge all shop publications with the product's current published state
  const mergedSalesChannels = useMemo(() => {
    if (!product) return [];
    const publishedIds = new Set(product.salesChannels.map((ch) => ch.id));
    if (allPublications.length === 0) {
      // Fallback: show only the product's current channels until all pubs load
      return product.salesChannels;
    }
    return allPublications.map((pub) => ({
      id: pub.id,
      name: pub.name,
      published: publishedIds.has(pub.id),
    }));
  }, [product?.salesChannels, allPublications]);

  // Auto-apply size and date tags when product data and rules are available
  const autoTagResult = useMemo(() => {
    if (!product || (sizeTagRules.length === 0 && dateTagRules.length === 0)) {
      return { allAutoTags: [], newAutoTags: [] };
    }
    const height = product.metafields.height ? parseFloat(product.metafields.height) : null;
    const width = product.metafields.width ? parseFloat(product.metafields.width) : null;
    const year = parseYear(product.metafields.year);
    return computeAutoTags(height, width, year, sizeTagRules, dateTagRules, formData.tags);
  }, [product?.metafields.height, product?.metafields.width, product?.metafields.year, sizeTagRules, dateTagRules, formData.tags]);

  // Auto-add new auto-tags to formData.tags (runs once when rules load)
  const [autoTagsApplied, setAutoTagsApplied] = useState(false);
  useEffect(() => {
    if (autoTagsApplied) return;
    if (!product) return;
    if (sizeTagRules.length === 0 && dateTagRules.length === 0) return;

    const height = product.metafields.height ? parseFloat(product.metafields.height) : null;
    const width = product.metafields.width ? parseFloat(product.metafields.width) : null;
    const year = parseYear(product.metafields.year);
    const { newAutoTags } = computeAutoTags(height, width, year, sizeTagRules, dateTagRules, formData.tags);

    if (newAutoTags.length > 0) {
      setFormData(prev => ({ ...prev, tags: [...prev.tags, ...newAutoTags] }));
      // Also update product baseline so isDirty doesn't trigger from auto-tags
      setProduct(prev => prev ? { ...prev, tags: [...prev.tags, ...newAutoTags] } : prev);
    }
    setAutoTagsApplied(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id, sizeTagRules, dateTagRules]);

  // Reconcile artist tag on load: check "Artist: X" tag against artist DB
  const [artistReconciled, setArtistReconciled] = useState(false);
  useEffect(() => {
    if (artistReconciled) return;
    if (!product) return;

    async function reconcileArtist() {
      let canonicalName: string | null = null;
      let canonicalBio: string | null = null;
      let isVerified = false;

      // Path A: linkedArtist exists — canonical name already known
      if (product!.linkedPoster?.linkedArtist) {
        const la = product!.linkedPoster.linkedArtist;
        canonicalName = la.name;
        canonicalBio = la.bio;
        isVerified = la.verified;
      } else {
        // Path B: extract artist name from tag or metafield, search DB
        const artistTag = product!.tags.find(t => t.toLowerCase().startsWith('artist:'));
        const tagArtistName = artistTag ? artistTag.replace(/^artist:\s*/i, '').trim() : null;
        const metafieldArtist = product!.metafields.artist || null;
        const searchName = tagArtistName || metafieldArtist;

        if (!searchName) return; // No artist info — nothing to reconcile

        try {
          const res = await fetch(`/api/managed-lists/artists?search=${encodeURIComponent(searchName)}`);
          if (!res.ok) return;
          const data = await res.json();
          if (data.items?.length > 0) {
            const match = data.items[0];
            const searchLower = searchName.toLowerCase();
            const nameMatch = match.name.toLowerCase() === searchLower;
            const aliasMatch = match.aliases?.some((a: string) => a.toLowerCase() === searchLower);
            if (nameMatch || aliasMatch) {
              canonicalName = match.name;
              canonicalBio = match.bio || null;
              isVerified = !!match.verified;
            }
          }
        } catch { return; }
      }

      if (!canonicalName) return;

      // Determine what needs updating
      const currentTags = [...formData.tags];
      const expectedTag = `Artist: ${canonicalName}`;
      const hasCorrectTag = currentTags.some(t => t === expectedTag);
      const currentMetafield = product!.metafields.artist || '';
      const metafieldNeedsUpdate = currentMetafield && currentMetafield !== canonicalName;
      const tagNeedsUpdate = !hasCorrectTag && (currentMetafield || currentTags.some(t => t.toLowerCase().startsWith('artist:')));

      // Auto-apply bio for verified artists when bio is missing or different
      const currentBio = product!.metafields.artistBio || '';
      const bioNeedsUpdate = isVerified && canonicalBio && currentBio !== canonicalBio;

      if (!tagNeedsUpdate && !metafieldNeedsUpdate && !bioNeedsUpdate) return; // Already correct

      // Build updated tags
      const updatedTags = currentTags.filter(t => !t.toLowerCase().startsWith('artist:'));
      updatedTags.push(expectedTag);

      // Build PUT payload (single call handles tags + metafields)
      const metafields: Array<{ namespace: string; key: string; value: string; type: string }> = [];
      if (metafieldNeedsUpdate) {
        metafields.push({
          namespace: 'jadepuma',
          key: 'artist',
          value: canonicalName,
          type: 'single_line_text_field',
        });
      }
      if (bioNeedsUpdate) {
        metafields.push({
          namespace: 'jadepuma',
          key: 'artist_bio',
          value: canonicalBio!,
          type: 'multi_line_text_field',
        });
      }

      const payload: Record<string, unknown> = { tags: updatedTags };
      if (metafields.length > 0) {
        payload.metafields = metafields;
      }

      try {
        const res = await fetch(`/api/shopify/products/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) return;
        const updated: ProductDetail = await res.json();

        // Update BOTH formData and product baseline (isDirty stays false)
        setFormData(prev => ({
          ...prev,
          tags: [...updated.tags],
          artist: updated.metafields.artist || prev.artist,
        }));
        setProduct(prev => prev ? {
          ...prev,
          tags: updated.tags,
          metafields: {
            ...prev.metafields,
            artist: updated.metafields.artist,
            artistBio: updated.metafields.artistBio,
          },
        } : prev);
      } catch { /* silent */ }
    }

    reconcileArtist();
    setArtistReconciled(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);

  function handleFieldChange(field: string, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setSaveMessage(null);

    // Auto-populate condition details when product type changes
    if (field === 'productType') {
      const pt = productTypeOptions.find((p) => p.name === value);
      if (pt?.defaultConditionText) {
        setFormData((prev) => {
          if (!prev.conditionDetails) {
            // Empty: auto-fill without asking
            return { ...prev, conditionDetails: pt.defaultConditionText! };
          }
          if (prev.conditionDetails !== pt.defaultConditionText) {
            // Has existing text: confirm before overwriting
            const replace = window.confirm(
              'Replace current condition details with the default text for this product type?'
            );
            if (replace) {
              return { ...prev, conditionDetails: pt.defaultConditionText! };
            }
          }
          return prev;
        });
      }
    }
  }

  // Immediate-apply: Internal Tags save directly to Shopify on change
  const [savingInternalTag, setSavingInternalTag] = useState<string | null>(null);
  async function handleInternalTagsChange(internalTags: string[], toggledTag?: string) {
    setFormData((prev) => ({ ...prev, internalTags }));
    setSaveMessage(null);

    if (!product) return;
    setSavingInternalTag(toggledTag || null);
    try {
      const res = await fetch(`/api/shopify/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metafields: [{
            namespace: 'jadepuma',
            key: 'internal_tags',
            value: JSON.stringify(internalTags),
            type: 'list.single_line_text_field',
          }],
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.details || data.error || 'Failed to save internal tags');
      }
      const updated: ProductDetail = await res.json();
      // Sync the product baseline so isDirty doesn't flag internal tags
      setProduct((prev) => prev ? { ...prev, metafields: { ...prev.metafields, internalTags: updated.metafields.internalTags } } : prev);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save internal tags');
    } finally {
      setSavingInternalTag(null);
    }
  }

  function handleArrayFieldChange(field: string, values: string[]) {
    setFormData((prev) => ({ ...prev, [field]: values }));
    setSaveMessage(null);
  }

  // Auto-apply colors: update formData AND immediately write to Shopify
  async function handleColorsAutoApply(colors: string[]) {
    setFormData((prev) => ({ ...prev, colors }));
    setSaveMessage(null);
    if (!product) return;
    try {
      const res = await fetch(`/api/shopify/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metafields: [{
            namespace: 'jadepuma',
            key: 'color',
            value: JSON.stringify(colors),
            type: 'list.single_line_text_field',
          }],
        }),
      });
      if (!res.ok) return; // Silent fail for auto-apply
      const updated: ProductDetail = await res.json();
      setProduct((prev) => prev ? { ...prev, metafields: { ...prev.metafields, color: updated.metafields.color } } : prev);
    } catch { /* silent */ }
  }

  async function handleCountryAutoApply(countries: string[]) {
    setFormData((prev) => ({ ...prev, countryOfOrigin: countries }));
    setSaveMessage(null);
    if (!product) return;
    try {
      const res = await fetch(`/api/shopify/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metafields: [{
            namespace: 'jadepuma',
            key: 'country_of_origin',
            value: JSON.stringify(countries),
            type: 'list.single_line_text_field',
          }],
        }),
      });
      if (!res.ok) return;
      const updated: ProductDetail = await res.json();
      let updatedCountries: string[] = [];
      if (updated.metafields.countryOfOrigin) {
        try {
          const parsed = JSON.parse(updated.metafields.countryOfOrigin);
          if (Array.isArray(parsed)) updatedCountries = parsed;
        } catch { updatedCountries = [updated.metafields.countryOfOrigin]; }
      }
      setProduct((prev) => prev ? { ...prev, metafields: { ...prev.metafields, countryOfOrigin: updated.metafields.countryOfOrigin } } : prev);
    } catch { /* silent */ }
  }

  async function handleMediumAutoApply(medium: string[]) {
    setFormData((prev) => ({ ...prev, medium }));
    setSaveMessage(null);
    if (!product) return;
    try {
      const res = await fetch(`/api/shopify/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metafields: [{
            namespace: 'jadepuma',
            key: 'medium',
            value: JSON.stringify(medium),
            type: 'list.single_line_text_field',
          }],
        }),
      });
      if (!res.ok) return;
      const updated: ProductDetail = await res.json();
      setProduct((prev) => prev ? { ...prev, metafields: { ...prev.metafields, medium: updated.metafields.medium } } : prev);
    } catch { /* silent */ }
  }

  // Direct-write a single metafield to Shopify (follows internal tags pattern)
  const [applyingMetafield, setApplyingMetafield] = useState<string | null>(null);
  // Map metafield keys to formData fields for auto-sync after instant write
  const metafieldFormSync: Record<string, string> = {
    'jadepuma.artist': 'artist',
    'specs.year': 'year',
    'jadepuma.country_of_origin': 'countryOfOrigin',
    'jadepuma.color': 'colors',
    'jadepuma.medium': 'medium',
  };
  const arrayFormFields = new Set(['countryOfOrigin', 'colors', 'medium']);
  async function handleApplyMetafield(mf: {
    namespace: string;
    key: string;
    value: string;
    type: string;
    displayLabel: string;
  }): Promise<void> {
    if (!product) return;
    setApplyingMetafield(mf.displayLabel);
    try {
      const res = await fetch(`/api/shopify/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metafields: [{
            namespace: mf.namespace,
            key: mf.key,
            value: mf.value,
            type: mf.type,
          }],
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.details || data.error || `Failed to apply ${mf.displayLabel}`);
      }
      const updated: ProductDetail = await res.json();
      // Update product metafields locally WITHOUT resetting formData
      setProduct((prev) => prev ? { ...prev, metafields: updated.metafields } : prev);
      // Sync formData for fields that map to metafields (keeps isDirty accurate)
      const formField = metafieldFormSync[`${mf.namespace}.${mf.key}`];
      if (formField) {
        if (arrayFormFields.has(formField)) {
          try {
            const parsed = JSON.parse(mf.value);
            if (Array.isArray(parsed)) {
              setFormData((prev) => ({ ...prev, [formField]: parsed }));
            }
          } catch { /* ignore */ }
        } else {
          setFormData((prev) => ({ ...prev, [formField]: mf.value }));
        }
      }
      setSaveMessage(`${mf.displayLabel} applied to Shopify`);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to apply ${mf.displayLabel}`);
      throw err; // Re-throw so caller can track errors
    } finally {
      setApplyingMetafield(null);
    }
  }

  // Direct-write bodyHtml to Shopify
  async function handleApplyBodyHtml(html: string, appendMetadata?: boolean): Promise<void> {
    if (!product) return;
    setApplyingMetafield('Description');

    // Append Size, Artist, Condition (in order) when applying AI-generated descriptions
    // Only includes fields that have values; each on its own line with a blank line after the description
    let finalHtml = html;
    if (appendMetadata) {
      const appendParts: string[] = [];
      // 1. Size
      const height = product.metafields.height;
      const width = product.metafields.width;
      if (height && width) {
        appendParts.push(`<p><strong>Size:</strong> ${height}" x ${width}"</p>`);
      } else if (height) {
        appendParts.push(`<p><strong>Size:</strong> ${height}" H</p>`);
      } else if (width) {
        appendParts.push(`<p><strong>Size:</strong> ${width}" W</p>`);
      }
      // 2. Artist
      if (product.metafields.artist) {
        appendParts.push(`<p><strong>Artist:</strong> ${product.metafields.artist}</p>`);
      }
      // 3. Condition
      const condition = product.metafields.condition;
      const conditionDetails = product.metafields.conditionDetails;
      if (condition && conditionDetails) {
        appendParts.push(`<p><strong>Condition:</strong> ${condition}, ${conditionDetails}</p>`);
      } else if (condition) {
        appendParts.push(`<p><strong>Condition:</strong> ${condition}</p>`);
      }
      if (appendParts.length > 0) {
        finalHtml += appendParts.join('');
      }
    }

    try {
      const res = await fetch(`/api/shopify/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bodyHtml: finalHtml }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.details || data.error || 'Failed to apply description');
      }
      const updated: ProductDetail = await res.json();
      setProduct((prev) => prev ? { ...prev, bodyHtml: updated.bodyHtml, metafields: updated.metafields } : prev);
      setFormData((prev) => ({ ...prev, bodyHtml: html }));
      setSaveMessage('Description applied to Shopify');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply description');
      throw err;
    } finally {
      setApplyingMetafield(null);
    }
  }

  // Direct-write tags to Shopify (tags are a product field, not a metafield)
  async function handleApplyTags(tags: string[]): Promise<void> {
    setFormData((prev) => ({ ...prev, tags }));
    setSaveMessage(null);
    if (!product) return;
    try {
      const res = await fetch(`/api/shopify/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags }),
      });
      if (!res.ok) return;
      const updated: ProductDetail = await res.json();
      setProduct((prev) => prev ? { ...prev, tags: updated.tags } : prev);
    } catch { /* silent */ }
  }

  // Apply artist: write canonical name to Shopify metafield AND link poster.artist_id
  async function handleApplyArtist(artist: LinkedArtistRecord): Promise<void> {
    if (!product) return;
    // 1. Write canonical name to Shopify metafield
    await handleApplyMetafield({
      namespace: 'jadepuma',
      key: 'artist',
      value: artist.name,
      type: 'single_line_text_field',
      displayLabel: 'Artist',
    });
    // 2. Auto-apply bio for verified artists
    if (artist.verified && artist.bio && product.metafields.artistBio !== artist.bio) {
      await handleApplyMetafield({
        namespace: 'jadepuma',
        key: 'artist_bio',
        value: artist.bio,
        type: 'multi_line_text_field',
        displayLabel: 'Artist Bio',
      });
    }
    // 3. Link poster to artist record (if poster exists)
    if (product.linkedPoster?.posterId) {
      try {
        await fetch(`/api/posters/${product.linkedPoster.posterId}/artist-link`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ artistId: artist.id }),
        });
        // Update product state with linked artist
        setProduct((prev) => prev?.linkedPoster ? {
          ...prev,
          linkedPoster: { ...prev.linkedPoster, linkedArtist: artist },
        } : prev);
      } catch {
        // Non-critical: metafield was already written
      }
    }
    // 4. Update "Artist: X" tag with canonical name
    const canonicalTag = `Artist: ${artist.name}`;
    const updatedTags = formData.tags.filter(t => !t.toLowerCase().startsWith('artist:'));
    updatedTags.push(canonicalTag);
    handleApplyTags(updatedTags);
  }

  async function handleSalesChannelToggle(publicationId: string, publish: boolean) {
    if (!product) return;
    try {
      const res = await fetch(`/api/shopify/products/${id}/publications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicationId, publish }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details || data.error || 'Failed to update');
      if (data.warning) {
        const dbg = data.debug;
        const details = dbg
          ? ` [publishable=${dbg.publishableReturned}, status=${dbg.productStatus}, channels=${dbg.totalChannelsOnProduct}]`
          : '';
        setError(data.warning + details);
      }
      // Update local product state with new sales channels
      setProduct((prev) => prev ? { ...prev, salesChannels: data.salesChannels } : prev);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update sales channel');
    }
  }

  // Compute dirty state by comparing formData against the loaded product
  const isDirty = useMemo(() => {
    if (!product) return false;
    if (formData.title !== product.title) return true;
    if (formData.bodyHtml !== (product.bodyHtml || '')) return true;
    if (formData.productType !== (product.productType || '')) return true;
    if (formData.status !== product.status) return true;
    if (JSON.stringify(formData.tags) !== JSON.stringify(product.tags)) return true;
    if (formData.price !== product.price) return true;
    if (formData.compareAtPrice !== (product.compareAtPrice || '')) return true;
    if (formData.sku !== (product.sku || '')) return true;
    if (formData.inventoryQuantity !== String(product.inventoryQuantity ?? 0)) return true;
    if (formData.location !== (product.metafields.location || '')) return true;
    if (formData.internalNotes !== (product.metafields.internalNotes || '')) return true;
    // Internal tags are immediate-apply (not part of Save button dirty check)
    // Basic Information fields
    if (formData.artist !== (product.metafields.artist || '')) return true;
    if (formData.year !== (product.metafields.year || '')) return true;
    if (formData.height !== (product.metafields.height || '')) return true;
    if (formData.width !== (product.metafields.width || '')) return true;
    if (formData.condition !== (product.metafields.condition || '')) return true;
    if (formData.conditionDetails !== (product.metafields.conditionDetails || '')) return true;
    if (formData.itemNotes !== (product.metafields.itemNotes || '')) return true;
    // Compare country of origin (order-independent)
    let origCountries: string[] = [];
    if (product.metafields.countryOfOrigin) {
      try {
        const parsed = JSON.parse(product.metafields.countryOfOrigin);
        if (Array.isArray(parsed)) origCountries = parsed;
      } catch { origCountries = [product.metafields.countryOfOrigin]; }
    }
    if (JSON.stringify([...formData.countryOfOrigin].sort()) !== JSON.stringify([...origCountries].sort())) return true;
    // Compare colors (order-independent)
    let origColors: string[] = [];
    if (product.metafields.color) {
      try {
        const parsed = JSON.parse(product.metafields.color);
        if (Array.isArray(parsed)) origColors = parsed;
      } catch { origColors = [product.metafields.color]; }
    }
    if (JSON.stringify([...formData.colors].sort()) !== JSON.stringify([...origColors].sort())) return true;
    // Compare medium (order-independent)
    let origMedium: string[] = [];
    if (product.metafields.medium) {
      try {
        const parsed = JSON.parse(product.metafields.medium);
        if (Array.isArray(parsed)) origMedium = parsed;
      } catch { origMedium = [product.metafields.medium]; }
    }
    if (JSON.stringify([...formData.medium].sort()) !== JSON.stringify([...origMedium].sort())) return true;
    return false;
  }, [formData, product]);

  // Warn on any navigation when there are unsaved changes
  useEffect(() => {
    if (!isDirty) return;

    // Browser close/refresh
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Client-side navigation (Next.js Links, sidebar, router.push)
    const origPushState = window.history.pushState;
    window.history.pushState = function (...args: Parameters<typeof origPushState>) {
      if (window.confirm('You have unsaved changes. Leave without saving?')) {
        return origPushState.apply(window.history, args);
      }
    } as typeof window.history.pushState;

    // Browser back/forward buttons
    const handlePopState = () => {
      if (!window.confirm('You have unsaved changes. Leave without saving?')) {
        window.history.pushState(null, '', window.location.href);
      }
    };
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.history.pushState = origPushState;
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isDirty]);

  // Talking points: prefer linked poster data, fall back to metafield
  async function handleSave() {
    if (!product) return;

    try {
      setSaving(true);
      setError(null);
      setSaveMessage(null);

      // Build update payload with only changed fields
      const payload: ProductUpdatePayload = {};
      if (formData.title !== product.title) payload.title = formData.title;
      if (formData.bodyHtml !== (product.bodyHtml || '')) payload.bodyHtml = formData.bodyHtml;
      if (formData.productType !== (product.productType || '')) payload.productType = formData.productType;
      if (formData.status !== product.status) payload.status = formData.status;
      if (JSON.stringify(formData.tags) !== JSON.stringify(product.tags)) payload.tags = formData.tags;
      if (formData.price !== product.price) payload.price = formData.price;
      if (formData.compareAtPrice !== (product.compareAtPrice || '')) {
        payload.compareAtPrice = formData.compareAtPrice || null;
      }
      if (formData.sku !== (product.sku || '')) payload.sku = formData.sku;
      if (formData.inventoryQuantity !== String(product.inventoryQuantity ?? 0)) {
        payload.inventoryQuantity = parseInt(formData.inventoryQuantity) || 0;
      }

      // Check if location changed
      if (formData.location !== (product.metafields.location || '')) {
        const metafields: MetafieldWrite[] = payload.metafields || [];
        metafields.push({
          namespace: 'jadepuma',
          key: 'location',
          value: formData.location,
          type: 'single_line_text_field',
        });
        payload.metafields = metafields;
      }

      // Check if internal notes changed
      if (formData.internalNotes !== (product.metafields.internalNotes || '')) {
        const metafields: MetafieldWrite[] = payload.metafields || [];
        metafields.push({
          namespace: 'jadepuma',
          key: 'internal_notes',
          value: formData.internalNotes,
          type: 'multi_line_text_field',
        });
        payload.metafields = metafields;
      }

      // Internal tags are immediate-apply (saved on toggle, not here)

      // Check Basic Information metafield changes
      const metafieldChecks: { formValue: string; origValue: string | undefined; namespace: string; key: string; type: MetafieldWrite['type'] }[] = [
        { formValue: formData.artist, origValue: product.metafields.artist, namespace: 'jadepuma', key: 'artist', type: 'single_line_text_field' },
        { formValue: formData.year, origValue: product.metafields.year, namespace: 'specs', key: 'year', type: 'single_line_text_field' },
        { formValue: formData.height, origValue: product.metafields.height, namespace: 'specs', key: 'height', type: 'number_decimal' },
        { formValue: formData.width, origValue: product.metafields.width, namespace: 'specs', key: 'width', type: 'number_decimal' },
        { formValue: formData.condition, origValue: product.metafields.condition, namespace: 'jadepuma', key: 'condition', type: 'single_line_text_field' },
        { formValue: formData.conditionDetails, origValue: product.metafields.conditionDetails, namespace: 'jadepuma', key: 'condition_details', type: 'multi_line_text_field' },
        { formValue: formData.itemNotes, origValue: product.metafields.itemNotes, namespace: 'jadepuma', key: 'item_notes', type: 'multi_line_text_field' },
      ];
      for (const check of metafieldChecks) {
        if (check.formValue !== (check.origValue || '')) {
          const metafields: MetafieldWrite[] = payload.metafields || [];
          metafields.push({ namespace: check.namespace, key: check.key, value: check.formValue, type: check.type });
          payload.metafields = metafields;
        }
      }

      // Check if country of origin changed
      let originalCountries: string[] = [];
      if (product.metafields.countryOfOrigin) {
        try {
          const parsed = JSON.parse(product.metafields.countryOfOrigin);
          if (Array.isArray(parsed)) originalCountries = parsed;
        } catch { originalCountries = [product.metafields.countryOfOrigin]; }
      }
      if (JSON.stringify([...formData.countryOfOrigin].sort()) !== JSON.stringify([...originalCountries].sort())) {
        const metafields: MetafieldWrite[] = payload.metafields || [];
        metafields.push({
          namespace: 'jadepuma',
          key: 'country_of_origin',
          value: JSON.stringify(formData.countryOfOrigin),
          type: 'list.single_line_text_field',
        });
        payload.metafields = metafields;
      }

      // Check if colors changed
      let originalColors: string[] = [];
      if (product.metafields.color) {
        try {
          const parsed = JSON.parse(product.metafields.color);
          if (Array.isArray(parsed)) originalColors = parsed;
        } catch { originalColors = [product.metafields.color]; }
      }
      if (JSON.stringify([...formData.colors].sort()) !== JSON.stringify([...originalColors].sort())) {
        const metafields: MetafieldWrite[] = payload.metafields || [];
        metafields.push({
          namespace: 'jadepuma',
          key: 'color',
          value: JSON.stringify(formData.colors),
          type: 'list.single_line_text_field',
        });
        payload.metafields = metafields;
      }

      // Check if medium changed
      let originalMedium: string[] = [];
      if (product.metafields.medium) {
        try {
          const parsed = JSON.parse(product.metafields.medium);
          if (Array.isArray(parsed)) originalMedium = parsed;
        } catch { originalMedium = [product.metafields.medium]; }
      }
      if (JSON.stringify([...formData.medium].sort()) !== JSON.stringify([...originalMedium].sort())) {
        const metafields: MetafieldWrite[] = payload.metafields || [];
        metafields.push({
          namespace: 'jadepuma',
          key: 'medium',
          value: JSON.stringify(formData.medium),
          type: 'list.single_line_text_field',
        });
        payload.metafields = metafields;
      }

      if (Object.keys(payload).length === 0) {
        setSaveMessage('No changes to save');
        return;
      }

      const res = await fetch(`/api/shopify/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.details || data.error || 'Failed to save');
      }

      const updated: ProductDetail = await res.json();
      // Preserve linkedPoster (PUT response doesn't include poster enrichment)
      setProduct((prev) => ({ ...updated, linkedPoster: prev?.linkedPoster || updated.linkedPoster }));

      // Parse updated internal tags
      let updatedInternalTags: string[] = [];
      if (updated.metafields.internalTags) {
        try {
          const parsed = JSON.parse(updated.metafields.internalTags);
          if (Array.isArray(parsed)) updatedInternalTags = parsed;
        } catch {
          updatedInternalTags = updated.metafields.internalTags.split(',').map((t: string) => t.trim()).filter(Boolean);
        }
      }

      // Parse updated colors
      let updatedColors: string[] = [];
      if (updated.metafields.color) {
        try {
          const parsed = JSON.parse(updated.metafields.color);
          if (Array.isArray(parsed)) updatedColors = parsed;
        } catch { updatedColors = [updated.metafields.color]; }
      }

      // Parse updated medium
      let updatedMedium: string[] = [];
      if (updated.metafields.medium) {
        try {
          const parsed = JSON.parse(updated.metafields.medium);
          if (Array.isArray(parsed)) updatedMedium = parsed;
        } catch { updatedMedium = [updated.metafields.medium]; }
      }

      // Parse updated country of origin
      let updatedCountries: string[] = [];
      if (updated.metafields.countryOfOrigin) {
        try {
          const parsed = JSON.parse(updated.metafields.countryOfOrigin);
          if (Array.isArray(parsed)) updatedCountries = parsed;
        } catch { updatedCountries = [updated.metafields.countryOfOrigin]; }
      }

      setFormData({
        title: updated.title,
        bodyHtml: updated.bodyHtml || '',
        productType: updated.productType || '',
        status: updated.status,
        tags: [...updated.tags],
        price: updated.price,
        compareAtPrice: updated.compareAtPrice || '',
        sku: updated.sku || '',
        inventoryQuantity: String(updated.inventoryQuantity ?? 0),
        location: updated.metafields.location || '',
        internalNotes: updated.metafields.internalNotes || '',
        internalTags: updatedInternalTags,
        artist: updated.metafields.artist || '',
        year: updated.metafields.year || '',
        countryOfOrigin: updatedCountries,
        height: updated.metafields.height || '',
        width: updated.metafields.width || '',
        condition: updated.metafields.condition || '',
        conditionDetails: updated.metafields.conditionDetails || '',
        colors: updatedColors,
        medium: updatedMedium,
        itemNotes: updated.metafields.itemNotes || '',
      });
      setSaveMessage('Saved successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    try {
      setDeleting(true);
      const res = await fetch(`/api/shopify/products/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.details || data.error || 'Failed to delete');
      }
      router.push('/products');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
      setDeleting(false);
      setShowDeleteModal(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-slate-600">Loading product...</p>
        </div>
      </div>
    );
  }

  if (error && !product) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <p className="text-red-700">{error}</p>
          <Link href="/products" className="inline-block mt-4 text-sm text-blue-600 hover:text-blue-800">
            Back to Products
          </Link>
        </div>
      </div>
    );
  }

  if (!product) return null;

  // Internal tags on the product that aren't in the managed list
  const managedTagNames = new Set(internalTagOptions.map((t) => t.name.toLowerCase()));
  const unmatchedInternalTags = formData.internalTags.filter((t) => !managedTagNames.has(t.toLowerCase()));


  const STATUS_COLORS: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    draft: 'bg-yellow-100 text-yellow-700',
    archived: 'bg-slate-100 text-slate-500',
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link
            href="/products"
            className="text-slate-400 hover:text-slate-600 transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{product.title}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-xs font-medium px-2 py-0.5 rounded ${STATUS_COLORS[product.status] || ''}`}>
                {product.status}
              </span>
              {product.sku && (
                <span className="text-xs text-slate-400 font-mono">{product.sku}</span>
              )}
              {(product.inventoryQuantity ?? 0) < 1 && (
                <span className="text-xs font-medium px-2 py-0.5 rounded bg-red-100 text-red-700">Out of Stock</span>
              )}
              {shopDomain && (
                <a
                  href={`https://${shopDomain}/admin/products/${product.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 transition"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Shopify
                </a>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saveMessage && (
            <span className={`text-sm ${saveMessage === 'Saved successfully' ? 'text-green-600' : 'text-slate-500'}`}>{saveMessage}</span>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !isDirty}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
              isDirty
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {saving ? 'Saving...' : isDirty ? 'Save Changes' : 'Saved'}
          </button>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="px-3 py-2 text-red-600 hover:bg-red-50 text-sm font-medium rounded-lg transition"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {/* Images (always visible above tabs) */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5 mb-3">
        <h2 className="font-semibold text-slate-900 mb-3">Images</h2>
        <ImagesSection images={product.images} />
        {formData.colors.length > 0 && (
          <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-slate-100">
            <span className="text-xs text-slate-400 mr-1">Colors:</span>
            {formData.colors.map((colorName) => {
              const opt = colorOptions.find((c) => c.name.toLowerCase() === colorName.toLowerCase());
              return (
                <span
                  key={colorName}
                  title={colorName}
                  className="w-5 h-5 rounded-full border border-slate-300 inline-block"
                  style={{ backgroundColor: opt?.hexCode || '#94a3b8' }}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <ProductTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Tab Content */}
      <div className="border border-t-0 border-slate-200 rounded-b-lg bg-white p-4">
        {/* ============ LISTING TAB ============ */}
        {activeTab === 'listing' && (
          <div className="space-y-3">
            <ProductDetailSection title="Listing Header" defaultOpen>
              <BasicInfoSection
                title={formData.title}
                productType={formData.productType}
                status={formData.status}
                handle={product.handle}
                sku={formData.sku}
                location={formData.location}
                internalNotes={formData.internalNotes}
                categoryName={product.categoryName}
                salesChannels={mergedSalesChannels}
                locationOptions={locationOptions}
                productTypeOptions={productTypeOptions.map((pt) => pt.name)}
                selectedInternalTags={formData.internalTags}
                unmatchedInternalTags={unmatchedInternalTags}
                internalTagOptions={internalTagOptions}
                savingInternalTag={savingInternalTag}
                onChange={handleFieldChange}
                onInternalTagsChange={handleInternalTagsChange}
                onSalesChannelToggle={handleSalesChannelToggle}
              />
            </ProductDetailSection>

            <ProductDetailSection title="Notes" defaultOpen={!!(formData.itemNotes || formData.internalNotes)}>
              <div className="pt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Item Notes</label>
                  <textarea
                    value={formData.itemNotes}
                    onChange={(e) => handleFieldChange('itemNotes', e.target.value)}
                    placeholder="Auction listing text, provenance notes, attribution hints..."
                    rows={4}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm resize-y"
                  />
                  <p className="text-xs text-slate-400 mt-1">Research-relevant notes. Sent to AI analysis.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Internal Notes</label>
                  <textarea
                    value={formData.internalNotes}
                    onChange={(e) => handleFieldChange('internalNotes', e.target.value)}
                    placeholder="Private business notes, cost reminders, to-dos..."
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm resize-y"
                  />
                  <p className="text-xs text-slate-400 mt-1">Private. Not sent to AI or customers.</p>
                </div>
              </div>
            </ProductDetailSection>

            <ProductDetailSection title="Physical Attributes" defaultOpen>
              <SpecificationsSection
                height={formData.height}
                width={formData.width}
                condition={formData.condition}
                conditionDetails={formData.conditionDetails}
                conditionOptions={conditionOptions}
                onChange={handleFieldChange}
              />
            </ProductDetailSection>

            <ProductDetailSection title="Pricing & Inventory" defaultOpen>
              <PricingSection
                price={formData.price}
                compareAtPrice={formData.compareAtPrice}
                inventoryQuantity={formData.inventoryQuantity}
                unitCost={product.unitCost}
                metafields={product.metafields}
                onChange={handleFieldChange}
              />
            </ProductDetailSection>

            <ProductDetailSection title="Acquisition" badge="Read-Only">
              <AcquisitionSection metafields={product.metafields} />
            </ProductDetailSection>

            <ProductDetailSection title="SEO & Marketing" badge="Read-Only">
              <SeoSection
                seoTitle={product.seoTitle}
                seoDescription={product.seoDescription}
                handle={product.handle}
              />
            </ProductDetailSection>

            {/* All Metafields (debug, listing tab only) */}
            <ProductDetailSection title="All Metafields" badge="Debug">
              <MetafieldsSection metafields={product.metafields} />
            </ProductDetailSection>
          </div>
        )}

        {/* ============ RESEARCH TAB ============ */}
        {activeTab === 'research' && (
          <ProductResearchTab
            product={product}
            formData={formData}
            isDirty={isDirty}
            mediumOptions={mediumOptions}
            countryOptions={countryOptions}
            colorOptions={colorOptions}
            tagOptions={tagOptions}
            suggestedColors={suggestedColors}
            suggestingColors={suggestingColors}
            suggestedTags={product.linkedPoster?.suggestedTags || []}
            autoTags={autoTagResult.allAutoTags}
            onFieldChange={handleFieldChange}
            onArrayFieldChange={handleArrayFieldChange}
            onApplyMetafield={handleApplyMetafield}
            onApplyBodyHtml={handleApplyBodyHtml}
            onApplyArtist={handleApplyArtist}
            onApplyTags={handleApplyTags}
            onColorsAutoApply={handleColorsAutoApply}
            onCountryAutoApply={handleCountryAutoApply}
            onMediumAutoApply={handleMediumAutoApply}
            onAnalysisComplete={loadProduct}
          />
        )}

        {/* ============ VALUATION TAB ============ */}
        {activeTab === 'valuation' && (
          <div className="space-y-3">
            {product.linkedPoster && (product.linkedPoster.rarityValue.rarityAssessment || product.linkedPoster.comparableSales.length > 0) ? (
              <ProductDetailSection title="Market Intelligence" defaultOpen>
                <div className="grid gap-4 pt-4">
                  {product.linkedPoster.rarityValue.rarityAssessment && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Rarity Assessment</label>
                      <p className="text-sm text-slate-600 whitespace-pre-wrap">{product.linkedPoster.rarityValue.rarityAssessment}</p>
                    </div>
                  )}
                  {product.linkedPoster.rarityValue.valueInsights && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Value Insights</label>
                      <p className="text-sm text-slate-600 whitespace-pre-wrap">{product.linkedPoster.rarityValue.valueInsights}</p>
                    </div>
                  )}
                  {product.linkedPoster.rarityValue.collectorInterest && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Collector Interest</label>
                      <p className="text-sm text-slate-600 whitespace-pre-wrap">{product.linkedPoster.rarityValue.collectorInterest}</p>
                    </div>
                  )}
                  {product.linkedPoster.comparableSales.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Comparable Sales</label>
                      <div className="space-y-2">
                        {product.linkedPoster.comparableSales.map((sale) => (
                          <div key={sale.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 text-sm">
                            <div>
                              <span className="font-medium text-slate-700">{sale.source}</span>
                              {sale.condition && <span className="text-slate-400 ml-2">({sale.condition})</span>}
                              {sale.notes && <span className="text-slate-400 ml-2">- {sale.notes}</span>}
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-slate-500">{new Date(sale.date).toLocaleDateString()}</span>
                              <span className="font-medium text-green-700">
                                {sale.currency === 'USD' ? '$' : sale.currency}{sale.price.toLocaleString()}
                              </span>
                              {sale.url && (
                                <a href={sale.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </ProductDetailSection>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                <div className="text-green-400 mb-2">
                  <svg className="w-10 h-10 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-sm font-medium text-green-700 mb-1">Market Intelligence</h3>
                <p className="text-xs text-green-500">
                  Rarity assessments, comparable sales, and value insights will appear here
                  once research data is available for this product.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Timestamps */}
      <div className="mt-6 text-xs text-slate-400 flex gap-4">
        <span>Created: {new Date(product.createdAt).toLocaleDateString()}</span>
        <span>Updated: {new Date(product.updatedAt).toLocaleDateString()}</span>
      </div>

      {/* Delete modal */}
      <DeleteProductModal
        isOpen={showDeleteModal}
        productTitle={product.title}
        deleting={deleting}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
      />
    </div>
  );
}
