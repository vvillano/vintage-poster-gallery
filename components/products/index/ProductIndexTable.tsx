'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { COLUMNS, type ColumnKey, type IndexProduct, type SortState } from '@/types/product-index';

interface ProductIndexTableProps {
  products: IndexProduct[];
  enabledColumns: Set<ColumnKey>;
  sort: SortState;
  onSort: (sort: SortState) => void;
}

const STATUS_COLORS: Record<string, string> = {
  active: 'text-green-700 bg-green-100',
  draft: 'text-yellow-700 bg-yellow-100',
  archived: 'text-slate-500 bg-slate-100',
};

function formatCurrency(value: number | null): string {
  if (value == null) return '';
  return `$${value.toFixed(2)}`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString();
}

function getCellValue(product: IndexProduct, key: ColumnKey): React.ReactNode {
  switch (key) {
    case 'thumbnail':
      return (
        <div className="w-10 h-10 rounded bg-slate-100 overflow-hidden flex-shrink-0">
          {product.thumbnailUrl ? (
            <Image src={product.thumbnailUrl} alt="" width={40} height={40} className="object-cover w-full h-full" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-300 text-[9px]">N/A</div>
          )}
        </div>
      );
    case 'title':
      return (
        <span className="text-sm font-medium text-slate-900 line-clamp-1">{product.title}</span>
      );
    case 'status':
      return (
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${STATUS_COLORS[product.status] || ''}`}>
          {product.status}
        </span>
      );
    case 'sku':
      return <span className="text-xs font-mono text-slate-600">{product.sku || ''}</span>;
    case 'productType':
      return <span className="text-xs text-slate-600">{product.productType || ''}</span>;
    case 'year':
      return <span className="text-xs text-slate-600">{product.year || ''}</span>;
    case 'artist':
      return <span className="text-xs text-slate-600 line-clamp-1">{product.artist || ''}</span>;
    case 'country':
      return <span className="text-xs text-slate-600">{product.countryOfOrigin || ''}</span>;
    case 'platform':
      return <span className="text-xs text-slate-600">{product.sourcePlatform || ''}</span>;
    case 'purchasePrice':
      return <span className="text-xs text-slate-600">{formatCurrency(product.purchasePrice)}</span>;
    case 'totalCogs':
      return <span className="text-xs text-slate-600">{formatCurrency(product.totalCogs)}</span>;
    case 'price':
      return <span className="text-xs text-slate-600">{formatCurrency(product.price)}</span>;
    case 'compareAtPrice':
      return <span className="text-xs text-slate-600">{formatCurrency(product.compareAtPrice)}</span>;
    case 'inventory':
      return <span className="text-xs text-slate-600">{product.inventoryQuantity ?? ''}</span>;
    case 'createdAt':
      return <span className="text-xs text-slate-500">{formatDate(product.shopifyCreatedAt)}</span>;
    case 'updatedAt':
      return <span className="text-xs text-slate-500">{formatDate(product.shopifyUpdatedAt)}</span>;
    default:
      return null;
  }
}

export default function ProductIndexTable({ products, enabledColumns, sort, onSort }: ProductIndexTableProps) {
  const router = useRouter();
  const visibleColumns = COLUMNS.filter(
    (col) => col.alwaysVisible || enabledColumns.has(col.key)
  );

  function handleHeaderClick(col: typeof COLUMNS[number]) {
    if (!col.sortKey) return;
    if (sort.column === col.sortKey) {
      onSort({ column: col.sortKey, order: sort.order === 'asc' ? 'desc' : 'asc' });
    } else {
      onSort({ column: col.sortKey, order: 'asc' });
    }
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-slate-400">
        No products found matching your filters.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            {visibleColumns.map((col) => (
              <th
                key={col.key}
                onClick={() => handleHeaderClick(col)}
                className={`text-left text-[11px] font-medium text-slate-500 uppercase tracking-wide px-3 py-2.5 whitespace-nowrap ${
                  col.sortKey ? 'cursor-pointer hover:text-slate-700 select-none' : ''
                } ${col.align === 'right' ? 'text-right' : ''}`}
              >
                <span className="inline-flex items-center gap-1">
                  {col.label}
                  {col.sortKey && sort.column === col.sortKey && (
                    <svg className={`w-3 h-3 ${sort.order === 'desc' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {products.map((product) => (
              <tr
                key={product.shopifyProductId}
                onClick={() => router.push(`/products/${product.shopifyProductId}`)}
                className="hover:bg-slate-50 transition cursor-pointer"
              >
                {visibleColumns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-3 py-2 ${col.align === 'right' ? 'text-right' : ''}`}
                  >
                    {getCellValue(product, col.key)}
                  </td>
                ))}
              </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
