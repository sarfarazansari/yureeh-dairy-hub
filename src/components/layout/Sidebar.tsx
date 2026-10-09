'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Activity,
  Beef,
  ChevronDown,
  ChevronUp,
  IndianRupee,
  LayoutDashboard,
  ListOrdered,
  LogOut,
  Milk,
  PlusCircle,
  Settings,
  TrendingUp,
  Users,
  Wheat,
  X,
} from 'lucide-react';

const navigationGroups = [
  {
    label: 'MILK SALES',
    items: [
      { label: 'Dashboard', href: '/', icon: LayoutDashboard },
      { label: 'New Milk Entry', href: '/new-entry', icon: PlusCircle },
      { label: 'Milk Entries', href: '/entries', icon: ListOrdered },
      { label: 'Farm Milk Pool', href: '/milk-pool', icon: Milk },
      { label: 'Customers', href: '/customers', icon: Users },
      { label: 'Analytics', href: '/analytics', icon: TrendingUp },
    ],
  },
  {
    label: 'FARM COSTS',
    items: [
      { label: 'Expenses', href: '/expenses', icon: IndianRupee },
      { label: 'Financial Reports', href: '/financial-reports', icon: TrendingUp },
      { label: 'Feed Items', href: '/feeds/items', icon: Wheat },
      { label: 'Feed Inventory', href: '/feeds/inventory', icon: Wheat },
      { label: 'Feed Purchases', href: '/feeds/purchases', icon: Wheat },
      { label: 'Feed Consumption', href: '/feeds/consumption', icon: Wheat },
      { label: 'Diet Plans', href: '/feeds/diet-plans', icon: Wheat },
    ],
  },
  {
    label: 'PRODUCTION',
    items: [
      { label: 'Buffaloes', href: '/buffaloes', icon: Beef },
      { label: 'Buffalo Sales', href: '/buffalo-sales', icon: IndianRupee },
      { label: 'Daily Performance', href: '/daily-performance', icon: Activity },
      { label: 'Buffalo Analytics', href: '/buffalo-analytics', icon: TrendingUp },
    ],
  },
];

function isActivePath(pathname: string, href: string) {
  return pathname === href || (href !== '/' && pathname.startsWith(`${href}/`));
}

function SidebarAccount() {
  const [open, setOpen] = useState(false);

  return (
    <div className="sidebar-account">
      <button
        className="account-trigger"
        aria-expanded={open}
        aria-controls="sidebar-account-menu"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="account-avatar">Y</span>
        <span className="account-label">
          <b>Farm workspace</b>
          <small>Account · Active</small>
        </span>
        <span className="account-chevron">
          {open ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </span>
      </button>
      {open && (
        <div className="account-menu" id="sidebar-account-menu">
          <div className="account-menu-title">Farm account</div>
          <button onClick={() => void supabase?.auth.signOut()}>
            <LogOut size={14} style={{ marginRight: 8, verticalAlign: 'middle' }} />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerButtonRef = useRef<HTMLButtonElement>(null);
  const menuId = 'primary-navigation-drawer';

  const closeMobileMenu = () => {
    setMobileOpen(false);
    triggerButtonRef.current?.focus();
  };

  useEffect(() => {
    if (!mobileOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileOpen(false);
        triggerButtonRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    closeButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [mobileOpen]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <>
      <button
        type="button"
        ref={triggerButtonRef}
        className="mobile-menu-trigger"
        aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
        aria-expanded={mobileOpen}
        aria-controls={menuId}
        onClick={() => setMobileOpen((open) => !open)}
      >
        <span className="mobile-menu-icon" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </button>

      <div
        className={`mobile-nav-backdrop${mobileOpen ? ' is-open' : ''}`}
        aria-hidden="true"
        onClick={closeMobileMenu}
      />

      <aside
        id={menuId}
        className={`sidebar${mobileOpen ? ' mobile-open' : ''}`}
        aria-label="Application navigation"
      >
        <div className="brand">
          <div className="brand-icon">
            <Users size={22} />
          </div>
          <div>
            Yureeh<span style={{ fontWeight: 400, color: '#829087' }}> Dairy Hub</span>
          </div>
          <button
            type="button"
            ref={closeButtonRef}
            className="mobile-menu-close"
            aria-label="Close navigation menu"
            onClick={closeMobileMenu}
          >
            <X size={20} />
          </button>
        </div>
        <nav className="nav" aria-label="Primary">
          {navigationGroups.map((group) => (
            <div key={group.label}>
              <div className="nav-label">{group.label}</div>
              {group.items.map(({ label, href, icon: Icon }) => {
                const active = isActivePath(pathname, href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={active ? 'active' : ''}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setMobileOpen(false)}
                  >
                    <span className="icon" aria-hidden="true">
                      <Icon size={18} />
                    </span>
                    {label}
                  </Link>
                );
              })}
            </div>
          ))}
          <div className="nav-label">PREFERENCES</div>
          <Link
            href="/settings"
            className={isActivePath(pathname, '/settings') ? 'active' : ''}
            aria-current={isActivePath(pathname, '/settings') ? 'page' : undefined}
            onClick={closeMobileMenu}
          >
            <span className="icon" aria-hidden="true">
              <Settings size={18} />
            </span>
            Settings
          </Link>
        </nav>
        <SidebarAccount />
      </aside>
    </>
  );
}
