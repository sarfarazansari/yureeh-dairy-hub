'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  LayoutDashboard,
  PlusCircle,
  ListOrdered,
  Milk,
  Users,
  TrendingUp,
  IndianRupee,
  Wheat,
  Beef,
  Activity,
  Settings,
  LogOut,
  ChevronUp,
  ChevronDown,
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
        <span className="account-chevron">
          {open ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </span>
      </button>
      {open && (
        <div className="account-menu">
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

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-icon">
          <Users size={22} />
        </div>
        <div>
          Yureeh<span style={{ fontWeight: 400, color: '#829087' }}> Dairy Hub</span>
        </div>
      </div>
      <nav className="nav">
        {navigationGroups.map((group) => (
          <div key={group.label}>
            <div className="nav-label">{group.label}</div>
            {group.items.map(({ label, href, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={
                  pathname === href || (href !== '/' && pathname.startsWith(`${href}/`))
                    ? 'active'
                    : ''
                }
              >
                <span className="icon">
                  <Icon size={18} />
                </span>
                {label}
              </Link>
            ))}
          </div>
        ))}
        <div className="nav-label">PREFERENCES</div>
        <Link href="/settings" className={pathname === '/settings' ? 'active' : ''}>
          <span className="icon">
            <Settings size={18} />
          </span>
          Settings
        </Link>
      </nav>
      <SidebarAccount />
    </aside>
  );
}
