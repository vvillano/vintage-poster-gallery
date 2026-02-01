'use client';

import Link from 'next/link';

export default function SettingsPage() {
  const settingsCards = [
    {
      title: 'Managed Lists',
      description: 'Configure Available Tags, Media types, Artists, Internal tags, Sources, Locations, and Countries.',
      href: '/settings/lists',
      icon: '📋',
      color: 'bg-blue-50 border-blue-200 hover:bg-blue-100',
    },
    {
      title: 'Research Sites',
      description: 'Manage price research sites for comparable sales. Configure search URLs and store login credentials.',
      href: '/settings/research-sites',
      icon: '🔍',
      color: 'bg-violet-50 border-violet-200 hover:bg-violet-100',
    },
    {
      title: 'Platform Credentials',
      description: 'Store credentials and URLs for acquisition platforms (eBay, Invaluable, etc.). Links to Shopify sources.',
      href: '/settings/platforms',
      icon: '🔐',
      color: 'bg-orange-50 border-orange-200 hover:bg-orange-100',
    },
    {
      title: 'Seller Directory',
      description: 'Manage private sellers and link platform usernames to real identities. Track contact info and credentials.',
      href: '/settings/sellers',
      icon: '👥',
      color: 'bg-cyan-50 border-cyan-200 hover:bg-cyan-100',
    },
    {
      title: 'Shopify Integration',
      description: 'Connect to Shopify to import products, sync descriptions, tags, and metadata between systems.',
      href: '/settings/shopify',
      icon: '🛒',
      color: 'bg-green-50 border-green-200 hover:bg-green-100',
    },
    {
      title: 'Database Migrations',
      description: 'Run database schema updates. Required after deploying new features that add tables or columns.',
      href: '/settings/migrate',
      icon: '🔧',
      color: 'bg-amber-50 border-amber-200 hover:bg-amber-100',
    },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">
          Configure tags, research sites, and other application settings.
        </p>
      </div>

      {/* Settings Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {settingsCards.map((card) => (
          <Link
            key={card.title}
            href={card.href}
            className={`block p-6 rounded-lg border transition ${card.color}`}
          >
            <div className="flex items-start gap-4">
              <span className="text-3xl">{card.icon}</span>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{card.title}</h2>
                <p className="text-sm text-slate-600 mt-1">{card.description}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

    </div>
  );
}
