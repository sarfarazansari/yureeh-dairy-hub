'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';
import {
  LogOut, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { useFarmRole } from '@/lib/farm-access';
import { navigationGroups } from '@/config/navigation';

function isActivePath(pathname: string, href: string) {
  return pathname === href || (href !== '/' && pathname.startsWith(`${href}/`));
}

function SidebarAccount({ mobileOpen }: { mobileOpen: boolean }) {
  const role = useFarmRole();
  const [signingOut, setSigningOut] = useState(false);
  const signingOutRef = useRef(false);

  async function signOut() {
    if (signingOutRef.current) return;
    signingOutRef.current = true;
    setSigningOut(true);
    try {
      const { error } = await supabase!.auth.signOut();
      if (error) throw error;
    } catch (error) {
      signingOutRef.current = false;
      setSigningOut(false);
      toast.error(error instanceof Error ? error.message : 'Unable to sign out. Please try again.');
    }
  }

  return (
    <div className="sidebar-account">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" className="account-trigger" aria-label="Open farm account menu">
            <span className="account-avatar" aria-hidden="true">Y</span>
            <span className="account-label"><b>Farm workspace</b><small>{role === 'viewer' ? 'Viewer · Read-only' : role === 'super_admin' ? 'Super Admin' : 'Account · Active'}</small></span>
            <span className="account-chevron" aria-hidden="true">⋮</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side={mobileOpen ? 'top' : 'right'} className="w-52">
          <DropdownMenuLabel>Farm account</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={signingOut} onSelect={(event) => {
            event.preventDefault();
            void signOut();
          }}>
            <LogOut className="mr-2 size-4" />
            {signingOut ? 'Signing out…' : 'Sign out'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const role = useFarmRole();
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerButtonRef = useRef<HTMLButtonElement>(null);
  const mobileOpenRef = useRef(false);
  const menuId = 'primary-navigation-drawer';

  const closeMobileMenu = () => {
    mobileOpenRef.current = false;
    setMobileOpen(false);
    triggerButtonRef.current?.focus();
  };

  useEffect(() => {
    mobileOpenRef.current = mobileOpen;
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        mobileOpenRef.current = false;
        setMobileOpen(false);
        triggerButtonRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [mobileOpen]);

  useEffect(() => {
    mobileOpenRef.current = false;
    setMobileOpen(false);
  }, [pathname]);

  return (
    <>
      <Button type="button" variant="ghost" size="icon" ref={triggerButtonRef} className="mobile-menu-trigger"
        aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
        aria-expanded={mobileOpen} aria-controls={menuId}
        onClick={() => {
          const nextOpen = !mobileOpenRef.current;
          mobileOpenRef.current = nextOpen;
          setMobileOpen(nextOpen);
        }}>
        <span className="mobile-menu-icon" aria-hidden="true"><span /><span /><span /></span>
      </Button>
      <div className={`mobile-nav-backdrop${mobileOpen ? ' is-open' : ''}`} aria-hidden="true" onClick={closeMobileMenu} />
      <aside id={menuId} className={`sidebar${mobileOpen ? ' mobile-open' : ''}`} aria-label="Application navigation">
        <div className="brand">
          <div className="brand-icon brand-logo"><Image src="/favicon.svg" alt="" width={38} height={38} priority /></div>
          <div>Yureeh<span style={{ fontWeight: 400, color: '#829087' }}> Dairy Hub</span></div>
          <Button type="button" variant="ghost" size="icon" ref={closeButtonRef} className="mobile-menu-close" aria-label="Close navigation menu" onClick={closeMobileMenu}><X size={20} /></Button>
        </div>
        <nav className="nav" aria-label="Primary">
          {navigationGroups.map((group) => {
            const visibleItems = group.items.filter(({ permission }) => role !== null && permission.includes(role));
            if (visibleItems.length === 0) return null;
            return (
              <div key={group.label}>
                <div className="nav-label">{group.label}</div>
                {visibleItems.map(({ label, href, icon: Icon }) => {
                  const active = isActivePath(pathname, href);
                  return (
                    <Link key={href} href={href} className={active ? 'active' : ''}
                      aria-current={active ? 'page' : undefined} onClick={() => setMobileOpen(false)}>
                      <span className="icon" aria-hidden="true"><Icon size={18} /></span>{label}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>
        <SidebarAccount mobileOpen={mobileOpen} />
      </aside>
    </>
  );
}
