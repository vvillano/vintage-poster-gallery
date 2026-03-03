'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import type { ProductDetail, ProductUpdatePayload } from '@/types/shopify-product-detail';
import ProductDetailSection from '@/components/products/detail/ProductDetailSection';
import BasicInfoSection from '@/components/products/detail/BasicInfoSection';
import DescriptionSection from '@/components/products/detail/DescriptionSection';
import ImagesSection from '@/components/products/detail/ImagesSection';
import PricingSection from '@/components/products/detail/PricingSection';
import TagsSection from '@/components/products/detail/TagsSection';
import MetafieldsSection from '@/components/products/detail/MetafieldsSection';
import SeoSection from '@/components/products/detail/SeoSection';
import AcquisitionSection from '@/components/products/detail/AcquisitionSection';
import DeleteProductModal from '@/components/products/detail/DeleteProductModal';

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
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load product');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadProduct();
  }, [loadProduct]);

  function handleFieldChange(field: string, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setSaveMessage(null);
  }

  function handleTagsChange(tags: string[]) {
    setFormData((prev) => ({ ...prev, tags }));
    setSaveMessage(null);
  }

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
            <span className="text-sm text-green-600">{saveMessage}</span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg transition"
          >
            {saving ? 'Saving...' : 'Save'}
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

      {/* Sections */}
      <div className="space-y-3">
        <ProductDetailSection title="Basic Info" defaultOpen>
          <BasicInfoSection
            title={formData.title}
            productType={formData.productType}
            status={formData.status}
            handle={product.handle}
            onChange={handleFieldChange}
          />
        </ProductDetailSection>

        <ProductDetailSection title="Description" defaultOpen>
          <DescriptionSection
            bodyHtml={formData.bodyHtml}
            onChange={(v) => handleFieldChange('bodyHtml', v)}
          />
        </ProductDetailSection>

        <ProductDetailSection title="Images" badge="Read-Only">
          <ImagesSection images={product.images} />
        </ProductDetailSection>

        <ProductDetailSection title="Pricing & Inventory" defaultOpen>
          <PricingSection
            price={formData.price}
            compareAtPrice={formData.compareAtPrice}
            sku={formData.sku}
            inventoryQuantity={formData.inventoryQuantity}
            unitCost={product.unitCost}
            onChange={handleFieldChange}
          />
        </ProductDetailSection>

        <ProductDetailSection title="Tags">
          <TagsSection tags={formData.tags} onChange={handleTagsChange} />
        </ProductDetailSection>

        <ProductDetailSection title="Metafields" badge="Read-Only">
          <MetafieldsSection metafields={product.metafields} />
        </ProductDetailSection>

        <ProductDetailSection title="SEO" badge="Read-Only">
          <SeoSection seoTitle={product.seoTitle} seoDescription={product.seoDescription} />
        </ProductDetailSection>

        <ProductDetailSection title="Acquisition" badge="Read-Only">
          <AcquisitionSection metafields={product.metafields} />
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
