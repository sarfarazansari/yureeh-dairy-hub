'use client';

import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { useFarmRole } from '@/lib/farm-access';

export function AppShell({
  children,
  title,
  subtitle,
  actions,
}: {
  children: ReactNode;
  title: string;
  subtitle: string;
  actions?: ReactNode;
}) {
  const role = useFarmRole();

  return (
    <div className="app">
      <Sidebar />
      <main className="main">
        {role === 'viewer' && (
          <div className="card" role="status" aria-live="polite">
            <strong>Read-only access</strong>
            <p className="sub">You can view farm records and reports. Changes, payments, adjustments and settings are restricted.</p>
          </div>
        )}
        <header className="topbar">
          <div className="page-heading">
            <div className="eyebrow">YUREEH FARM · MANAGEMENT</div>
            <h1 className="title">{title}</h1>
            <div className="sub">{subtitle}</div>
          </div>
          {actions ? <div className="topbar-actions">{actions}</div> : null}
        </header>
        {children}
      </main>
    </div>
  );
}
