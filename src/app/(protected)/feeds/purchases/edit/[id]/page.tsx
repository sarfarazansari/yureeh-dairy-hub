'use client';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { TimedNotice } from '@/components/ui/TimedNotice';
import { supabase } from '@/lib/supabase';

export default function EditFeedPurchasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [message, setMessage] = useState('Loading purchase…');

  useEffect(() => {
    if (!supabase) {
      setMessage('Supabase is not configured.');
      return;
    }
    void supabase
      .from('feed_purchases')
      .select('id')
      .eq('id', id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) setMessage(error.message);
        else if (!data) setMessage('Feed purchase not found.');
        else setMessage('Posted purchases are ledger entries. Direct in-place editing is disabled; corrections will use reversal semantics.');
      });
  }, [id]);

  return (
    <AppShell title="Edit feed purchase" subtitle="Purchase corrections are handled through inventory-safe reversal semantics">
      <div className="management-stack">
        <div className="card">
          <TimedNotice message={message} onDismiss={() => undefined} />
          <div className="row" style={{ marginTop: 16 }}>
            <Link className="date-chip" href="/feeds/purchases">Back to purchases</Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
