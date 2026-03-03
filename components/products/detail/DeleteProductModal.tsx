'use client';

export default function DeleteProductModal({
  isOpen,
  productTitle,
  deleting,
  onConfirm,
  onCancel,
}: {
  isOpen: boolean;
  productTitle: string;
  deleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Delete Product</h3>
        <p className="text-sm text-slate-600 mb-4">
          Are you sure you want to delete <strong>{productTitle}</strong>? This will permanently remove the product from Shopify. This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:bg-red-400 rounded-lg transition"
          >
            {deleting ? 'Deleting...' : 'Delete Product'}
          </button>
        </div>
      </div>
    </div>
  );
}
