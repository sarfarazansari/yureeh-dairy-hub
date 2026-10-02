'use client';

import { formatDate } from '@/lib/date-format';
import { Sidebar } from './Sidebar';

export function AppShell({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="app">
      <Sidebar />
      <main className="main">
        <header className="topbar">
          <div>
            <div className="eyebrow">YUREEH FARM · MANAGEMENT</div>
            <h1 className="title">{title}</h1>
            <div className="sub">{subtitle}</div>
          </div>
          <span className="date-chip">◷ &nbsp; {formatDate(new Date())}</span>
        </header>
        {children}
      </main>
    </div>
  );
}
