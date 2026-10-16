'use client';

import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';

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
