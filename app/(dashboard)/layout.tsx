'use client';

import { signOut, useSession } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const primaryNav = [
  { name: 'Dashboard', href: '/dashboard' },
  { name: 'Research', href: '/research' },
  { name: 'Products', href: '/products' },
  { name: 'Purchase Groups', href: '/purchase-groups' },
];

const researchSubNav = [
  { name: 'Browse', href: '/research' },
  { name: 'Upload', href: '/upload' },
  { name: 'Import', href: '/import' },
  { name: 'Settings', href: '/settings' },
];

function isResearchSection(pathname: string): boolean {
  return (
    pathname === '/research' ||
    pathname === '/upload' ||
    pathname === '/import' ||
    pathname.startsWith('/settings')
  );
}

function isPrimaryActive(href: string, pathname: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard';
  if (href === '/research') return isResearchSection(pathname);
  if (href === '/products') return pathname.startsWith('/products');
  if (href === '/purchase-groups') return pathname.startsWith('/purchase-groups');
  return false;
}

function isSubNavActive(href: string, pathname: string): boolean {
  if (href === '/research') return pathname === '/research';
  if (href === '/settings') return pathname.startsWith('/settings');
  return pathname === href;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const showResearchSubNav = isResearchSection(pathname);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Primary Navigation */}
      <nav className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <Link
                href="/dashboard"
                className="flex items-center px-2 text-xl font-bold text-slate-900"
              >
                AVP Manager
              </Link>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                {primaryNav.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      'inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium',
                      isPrimaryActive(item.href, pathname)
                        ? 'border-blue-500 text-slate-900'
                        : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
                    )}
                  >
                    {item.name}
                  </Link>
                ))}
              </div>
            </div>
            <div className="flex items-center">
              <div className="flex items-center space-x-4">
                <span className="text-sm text-slate-700">
                  {session?.user?.name}
                </span>
                <button
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="text-sm text-slate-600 hover:text-slate-900"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Research Sub-Navigation */}
      {showResearchSubNav && (
        <div className="bg-slate-50 border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex space-x-6 h-10">
              {researchSubNav.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'inline-flex items-center px-1 border-b-2 text-xs font-medium',
                    isSubNavActive(item.href, pathname)
                      ? 'border-blue-500 text-blue-700'
                      : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
                  )}
                >
                  {item.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
