'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AppShell } from '@/components/layout/AppShell';
import { ViewerAccessManager } from '@/features/access/ViewerAccessManager';
import { useFarmRole } from '@/lib/farm-access';

export default function SettingsPage() {
  const role = useFarmRole();

  return (
    <AppShell title="Settings" subtitle="Farm workspace">
      {role === 'super_admin' ? (
        <>
          <ViewerAccessManager />
          <div className="card">
            <h2 className="section-title">Account and data</h2>
            <p className="sub">
              Farm records are protected by Supabase authentication, row-level security and
              database-side read-only enforcement for Viewer accounts.
            </p>
            <p className="sub">Database migrations are managed from the Supabase CLI in this project.</p>
            <Button variant="secondary" asChild>
              <Link href="/">Return to dashboard</Link>
            </Button>
          </div>
        </>
      ) : (
        <div className="card">
          <h2 className="section-title">Settings are restricted</h2>
          <p className="sub">Only the farm Super Admin can manage farm access and settings.</p>
          <Button variant="secondary" asChild>
            <Link href="/">Return to dashboard</Link>
          </Button>
        </div>
      )}
    </AppShell>
  );
}
