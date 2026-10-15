'use client';

import { formatDate } from '@/lib/date-format';
import { Sidebar } from './Sidebar';
import { Clock } from 'lucide-react';

export function AppShell({
  children,
  title,
  subtitle,
  actions,
}: {
  children: React.ReactNode;
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="app">
      <Sidebar />
      <main className="main">
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
