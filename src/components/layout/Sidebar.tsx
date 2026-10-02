'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

const navigationGroups = [
  {
    label: 'MILK SALES',
    items: [
      { label: 'Dashboard', href: '/', icon: '⌂' },
      { label: 'New Milk Entry', href: '/new-entry', icon: '＋' },
      { label: 'Milk Entries', href: '/entries', icon: '▤' },
      { label: 'Customers', href: '/customers', icon: '♧' },
      { label: 'Analytics', href: '/analytics', icon: '⌁' },
    ],
  },
  { label: 'FARM COSTS', items: [{ label: 'Expenses', href: '/expenses', icon: '₹' }] },
  {
    label: 'PRODUCTION',
    items: [
      { label: 'Buffaloes', href: '/buffaloes', icon: '♉' },
      { label: 'Daily Performance', href: '/daily-performance', icon: '▦' },
      { label: 'Buffalo Analytics', href: '/buffalo-analytics', icon: '⌁' },
    ],
  },
];

function SidebarAccount() {
  const [open, setOpen] = useState(false);

  return (
    <div className="sidebar-account">
      <button
        className="account-trigger"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="account-avatar">Y</span>
        <span className="account-label">
          <b>Farm workspace</b>
          <small>Account · Active</small>
        </span>
        <span className="account-chevron">⌃</span>
      </button>
      {open && (
        <div className="account-menu">
          <div className="account-menu-title">Farm account</div>
          <button onClick={() => void supabase?.auth.signOut()}>↪ &nbsp; Sign out</button>
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-icon">♧</div>
        <div>
          Yureeh<span style={{ fontWeight: 400, color: '#829087' }}> Dairy Hub</span>
        </div>
      </div>
      <nav className="nav">
        {navigationGroups.map((group) => (
          <div key={group.label}>
            <div className="nav-label">{group.label}</div>
            {group.items.map(({ label, href, icon }) => (
              <Link
                key={href}
                href={href}
                className={
                  pathname === href || (href !== '/' && pathname.startsWith(`${href}/`))
                    ? 'active'
                    : ''
                }
              >
                <span className="icon">{icon}</span>
                {label}
              </Link>
            ))}
          </div>
        ))}
        <div className="nav-label">PREFERENCES</div>
        <Link href="/settings" className={pathname === '/settings' ? 'active' : ''}>
          <span className="icon">⚙</span>Settings
        </Link>
      </nav>
      <SidebarAccount />
    </aside>
  );
}
