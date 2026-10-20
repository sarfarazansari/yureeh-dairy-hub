'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useFarmRole } from '@/lib/farm-access';

const viewerBlockedRoutes = [
  '/new-entry',
  '/buffalo-sales/new',
  '/expenses/new',
  '/expenses/categories',
  '/expenses/vendors',
  '/feeds/items',
  '/feeds/purchases/new',
  '/feeds/purchases/edit',
  '/feeds/consumption/new',
  '/feeds/consumption/edit',
  '/feeds/diet-plans/new',
  '/feeds/diet-plans/edit',
  '/feeds/diet-plans/schedule',
  '/settings',
];

function isBlockedViewerRoute(pathname: string) {
  return viewerBlockedRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export function FarmRoleRouteGuard({ children }: { children: React.ReactNode }) {
  const role = useFarmRole();
  const pathname = usePathname();
  const router = useRouter();
  const blocked = role === 'viewer' && isBlockedViewerRoute(pathname);

  useEffect(() => {
    if (blocked) router.replace('/');
  }, [blocked, router]);

  if (blocked) {
    return <div className="auth-screen">This page is available to the farm Super Admin only. Returning to the dashboard…</div>;
  }

  return <>{children}</>;
}
