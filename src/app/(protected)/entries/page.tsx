import { Suspense } from 'react';
import MilkEntriesPage from '@/features/milk/EntriesPage';
import { AppShell } from '@/components/layout/AppShell';

export default function EntriesRoute() {
  return (
    <Suspense
      fallback={
        <AppShell title="Milk entries" subtitle="Browse, filter and manage recorded sales">
          <div className="empty">Loading milk entries…</div>
        </AppShell>
      }
    >
      <MilkEntriesPage />
    </Suspense>
  );
}
