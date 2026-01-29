'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * Deep link handler for Shopify products
 * URL: /open?id=123456 (numeric ID) or /open?id=gid://shopify/Product/123456
 *
 * Flow:
 * 1. Check if poster exists with this Shopify product ID
 * 2. If yes → redirect to poster detail page
 * 3. If no → import from Shopify, then redirect
 */
function OpenPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'importing' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function handleDeepLink() {
      const idParam = searchParams.get('id') || searchParams.get('product_id');

      if (!idParam) {
        setStatus('error');
        setError('Missing product ID parameter. Use ?id=123456');
        return;
      }

      // Normalize to gid format if just a number
      const shopifyProductId = idParam.startsWith('gid://')
        ? idParam
        : `gid://shopify/Product/${idParam}`;

      try {
        // First, check if we already have this product
        const checkRes = await fetch(`/api/shopify/lookup?shopifyProductId=${encodeURIComponent(shopifyProductId)}`);
        const checkData = await checkRes.json();

        if (checkData.posterId) {
          // Already exists - redirect to poster page
          router.replace(`/poster/${checkData.posterId}`);
          return;
        }

        // Not found - import it
        setStatus('importing');

        const importRes = await fetch('/api/shopify/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shopifyProductIds: [shopifyProductId] }),
        });

        const importData = await importRes.json();

        if (!importRes.ok) {
          throw new Error(importData.error || 'Import failed');
        }

        // Find the result for our product
        const result = importData.results?.find(
          (r: { shopifyProductId: string }) => r.shopifyProductId === shopifyProductId
        );

        if (result?.posterId) {
          // Success - redirect to the new poster
          router.replace(`/poster/${result.posterId}`);
        } else if (result?.error) {
          throw new Error(result.error);
        } else {
          throw new Error('Import did not return a poster ID');
        }
      } catch (err) {
        console.error('Deep link error:', err);
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    }

    handleDeepLink();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
        {status === 'loading' && (
          <>
            <div className="animate-spin w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-slate-800 mb-2">
              Looking up product...
            </h1>
            <p className="text-slate-500">Checking if this item exists in the gallery</p>
          </>
        )}

        {status === 'importing' && (
          <>
            <div className="animate-spin w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-slate-800 mb-2">
              Importing from Shopify...
            </h1>
            <p className="text-slate-500">Creating a new record with product data</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-slate-800 mb-2">
              Unable to open product
            </h1>
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
            >
              Go to Dashboard
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
        <div className="animate-spin w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full mx-auto mb-4" />
        <h1 className="text-xl font-semibold text-slate-800 mb-2">
          Loading...
        </h1>
      </div>
    </div>
  );
}

export default function OpenPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <OpenPageContent />
    </Suspense>
  );
}
