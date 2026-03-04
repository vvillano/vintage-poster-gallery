'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import type { ProductDetail, ProductUpdatePayload, MetafieldWrite } from '@/types/shopify-product-detail';
import ProductDetailSection from '@/components/products/detail/ProductDetailSection';
import BasicInfoSection from '@/components/products/detail/BasicInfoSection';
import SpecificationsSection from '@/components/products/detail/SpecificationsSection';
import DescriptionSection from '@/components/products/detail/DescriptionSection';
import ImagesSection from '@/components/products/detail/ImagesSection';
import PricingSection from '@/components/products/detail/PricingSection';
import SubjectTaggingSection from '@/components/products/detail/SubjectTaggingSection';
import MetafieldsSection from '@/components/products/detail/MetafieldsSection';
import SeoSection from '@/components/products/detail/SeoSection';
import AcquisitionSection from '@/components/products/detail/AcquisitionSection';
import ResearchDataSection from '@/components/products/detail/ResearchDataSection';
import DeleteProductModal from '@/components/products/detail/DeleteProductModal';
import TalkingPointsCard from '@/components/products/detail/TalkingPointsCard';

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
  internalTags: string[];
  colors: string[];
  medium: string[];
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
    internalTags: [],
    colors: [],
    medium: [],
  });

  const loadProduct = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/shopify/products/${id}`);
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
        internalTags: parsedInternalTags,
        colors: parsedColors,
        medium: parsedMedium,
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
  }, [loadProduct]);

  function handleFieldChange(field: string, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setSaveMessage(null);
  }

  function handleTagsChange(tags: string[]) {
    setFormData((prev) => ({ ...prev, tags }));
    setSaveMessage(null);
  }

  function handleInternalTagsChange(internalTags: string[]) {
    setFormData((prev) => ({ ...prev, internalTags }));
    setSaveMessage(null);
  }

  function handleColorsChange(colors: string[]) {
    setFormData((prev) => ({ ...prev, colors }));
    setSaveMessage(null);
  }

  function handleMediumChange(medium: string[]) {
    setFormData((prev) => ({ ...prev, medium }));
    setSaveMessage(null);
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
    // Compare internal tags (order-independent)
    let origTags: string[] = [];
    if (product.metafields.internalTags) {
      try {
        const parsed = JSON.parse(product.metafields.internalTags);
        if (Array.isArray(parsed)) origTags = parsed;
      } catch {
        origTags = product.metafields.internalTags.split(',').map((t: string) => t.trim()).filter(Boolean);
      }
    }
    if (JSON.stringify([...formData.internalTags].sort()) !== JSON.stringify([...origTags].sort())) return true;
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
  const talkingPoints = useMemo(() => {
    if (product?.linkedPoster?.talkingPoints?.length) {
      return product.linkedPoster.talkingPoints;
    }
    if (product?.metafields.talkingPoints) {
      try {
        const parsed = JSON.parse(product.metafields.talkingPoints);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }, [product?.linkedPoster, product?.metafields.talkingPoints]);

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

      // Check if internal tags changed
      let originalInternalTags: string[] = [];
      if (product.metafields.internalTags) {
        try {
          const parsed = JSON.parse(product.metafields.internalTags);
          if (Array.isArray(parsed)) originalInternalTags = parsed;
        } catch {
          originalInternalTags = product.metafields.internalTags.split(',').map((t: string) => t.trim()).filter(Boolean);
        }
      }
      if (JSON.stringify(formData.internalTags.sort()) !== JSON.stringify(originalInternalTags.sort())) {
        const metafields: MetafieldWrite[] = payload.metafields || [];
        metafields.push({
          namespace: 'jadepuma',
          key: 'internal_tags',
          value: JSON.stringify(formData.internalTags),
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
      setProduct(updated);

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
        internalTags: updatedInternalTags,
        colors: updatedColors,
        medium: updatedMedium,
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

      {/* 1. Images (always visible, not collapsible) */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5 mb-3">
        <h2 className="font-semibold text-slate-900 mb-3">Images</h2>
        <ImagesSection images={product.images} />
      </div>

      {/* 2. Talking Points (prominent card, between images and listing) */}
      {talkingPoints.length > 0 && (
        <div className="mb-3">
          <TalkingPointsCard points={talkingPoints} />
        </div>
      )}

      {/* Sections - matching PM App order */}
      <div className="space-y-3">
        {/* 2. Listing Header (was "Basic Info") */}
        <ProductDetailSection title="Listing Header" defaultOpen>
          <BasicInfoSection
            title={formData.title}
            productType={formData.productType}
            status={formData.status}
            handle={product.handle}
            sku={formData.sku}
            location={product.metafields.location}
            internalNotes={product.metafields.internalNotes}
            selectedInternalTags={formData.internalTags}
            unmatchedInternalTags={unmatchedInternalTags}
            internalTagOptions={internalTagOptions}
            onChange={handleFieldChange}
            onInternalTagsChange={handleInternalTagsChange}
          />
        </ProductDetailSection>

        {/* 3. Basic Information (specs: artist, year, dimensions, condition, colors, medium) */}
        <ProductDetailSection title="Basic Information" badge="Read-Only" defaultOpen>
          <SpecificationsSection metafields={product.metafields} />
        </ProductDetailSection>

        {/* 4. Subject Tagging (tags, colors, medium) */}
        <ProductDetailSection title="Subject Tagging" defaultOpen>
          <SubjectTaggingSection
            tags={formData.tags}
            colors={formData.colors}
            medium={formData.medium}
            tagOptions={tagOptions}
            colorOptions={colorOptions}
            mediumOptions={mediumOptions}
            suggestedTags={product.linkedPoster?.suggestedTags}
            suggestedColors={product.linkedPoster?.suggestedColors}
            onTagsChange={handleTagsChange}
            onColorsChange={handleColorsChange}
            onMediumChange={handleMediumChange}
          />
        </ProductDetailSection>

        {/* 6. Description */}
        <ProductDetailSection title="Description" defaultOpen>
          <DescriptionSection
            bodyHtml={formData.bodyHtml}
            onChange={(v) => handleFieldChange('bodyHtml', v)}
          />
        </ProductDetailSection>

        {/* 7. Pricing & Inventory */}
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

        {/* 8. Acquisition (Costs & Source) */}
        <ProductDetailSection title="Acquisition" badge="Read-Only">
          <AcquisitionSection metafields={product.metafields} />
        </ProductDetailSection>

        {/* 9. SEO & Marketing */}
        <ProductDetailSection title="SEO & Marketing" badge="Read-Only">
          <SeoSection
            seoTitle={product.seoTitle}
            seoDescription={product.seoDescription}
            handle={product.handle}
          />
        </ProductDetailSection>

        {/* 10. Research Data */}
        <ProductDetailSection title="Research Data" badge="Read-Only">
          <ResearchDataSection metafields={product.metafields} />
        </ProductDetailSection>

        {/* All Metafields (raw view for debugging) */}
        <ProductDetailSection title="All Metafields" badge="Debug">
          <MetafieldsSection metafields={product.metafields} />
        </ProductDetailSection>
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
