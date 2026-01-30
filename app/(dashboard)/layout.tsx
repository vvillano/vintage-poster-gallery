'use client';

import { useState, useRef, useEffect } from 'react';
import { signOut, useSession } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setSettingsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: '📊' },
    { name: 'Upload', href: '/upload', icon: '📤' },
    { name: 'Import', href: '/import', icon: '📥' },
  ];

  const settingsLinks = [
    { name: 'Tags', href: '/settings/tags', icon: '🏷️' },
    { name: 'Managed Lists', href: '/settings/lists', icon: '📋' },
    { name: 'Research Sites', href: '/settings/research-sites', icon: '🔍' },
    { name: 'Shopify', href: '/settings/shopify', icon: '🛒' },
    { name: 'Migrations', href: '/settings/migrate', icon: '🔧' },
  ];

  const isSettingsActive = pathname.startsWith('/settings');

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navigation Bar */}
      <nav className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <Link
                href="/dashboard"
                className="flex items-center px-2 text-xl font-bold text-slate-900"
              >
                🖼️ Vintage Poster Gallery
              </Link>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      'inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium',
                      pathname === item.href
                        ? 'border-blue-500 text-slate-900'
                        : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
                    )}
                  >
                    <span className="mr-2">{item.icon}</span>
                    {item.name}
                  </Link>
                ))}

                {/* Settings Dropdown */}
                <div className="relative" ref={settingsRef}>
                  <button
                    onClick={() => setSettingsOpen(!settingsOpen)}
                    className={cn(
                      'inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium h-full',
                      isSettingsActive
                        ? 'border-blue-500 text-slate-900'
                        : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
                    )}
                  >
                    <span className="mr-2">⚙️</span>
                    Settings
                    <svg
                      className={cn('ml-1 h-4 w-4 transition-transform', settingsOpen && 'rotate-180')}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {settingsOpen && (
                    <div className="absolute left-0 mt-1 w-48 bg-white border border-slate-200 rounded-md shadow-lg z-50">
                      {settingsLinks.map((item) => (
                        <Link
                          key={item.name}
                          href={item.href}
                          onClick={() => setSettingsOpen(false)}
                          className={cn(
                            'block px-4 py-2 text-sm hover:bg-slate-50',
                            pathname === item.href
                              ? 'text-blue-600 bg-blue-50'
                              : 'text-slate-700'
                          )}
                        >
                          <span className="mr-2">{item.icon}</span>
                          {item.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
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

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
