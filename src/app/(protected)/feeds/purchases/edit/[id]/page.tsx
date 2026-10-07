'use client';

import Link from 'next/link';
import { use, useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Toast } from '@/components/ui/Toast';
import { supabase } from '@/lib/supabase';
import type { FeedItem } from '@/lib/feed-types';
import type { ExpenseVendor } from '@/lib/expense-types';
import { FeedPurchaseForm } from '../../components/FeedPurchaseForm';
import { correctFeedPurchase, fetchFeedPurchaseForEdit } from '../../services';
import type { FeedPurchaseFormValues } from '../../schema';

export default function EditFeedPurchasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [vendors, setVendors] = useState<Pick<ExpenseVendor, 'id' | 'name'>[]>([]);
  const [initialValues, setInitialValues] = useState<FeedPurchaseFormValues | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) return;
    try {
      const [feeds, vendorResult, existing] = await Promise.all([
        supabase.from('feed_items').select('*').eq('is_active', true).order('name'),
        supabase.from('expense_vendors').select('id,name').eq('is_active', true).order('name'),
        fetchFeedPurchaseForEdit(supabase, id),
      ]);
      if (feeds.error) throw feeds.error;
      if (vendorResult.error) throw vendorResult.error;
      if (existing.purchase.status !== 'ACTIVE') {
        throw new Error('This purchase has already been corrected and cannot be edited again.');
      }
      setFeedItems(feeds.data ?? []);
      setVendors(vendorResult.data ?? []);
      setInitialValues({
        feedItemId: existing.purchase.feed_item_id,
        vendorId: existing.purchase.vendor_id ?? '',
        businessDate: existing.purchase.business_date,
        purchaseQuantity: Number(existing.purchase.purchase_quantity),
        rate: Number(existing.purchase.rate_per_purchase_unit),
        paymentStatus: existing.paymentStatus,
        paidAmount: existing.paidAmount,
        paymentMethod: existing.paymentMethod,
        dueDate: existing.dueDate,
        notes: existing.purchase.notes ?? '',
      });
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : 'Could not load purchase.', type: 'error' });
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  async function save(values: FeedPurchaseFormValues) {
    if (!supabase) return 'Supabase is not configured.';
    setBusy(true);
    setToast(null);
    try {
      await correctFeedPurchase(supabase, id, values);
      setToast({ message: 'Purchase correction saved successfully.', type: 'success' });
      setCompleted(true);
      return null;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save purchase correction.';
      setToast({ message, type: 'error' });
      return message;
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="Edit feed purchase" subtitle="Correct a posted purchase without mutating the inventory ledger">
      <div className="management-stack">
        <div className="row">
          <Link className="date-chip" href="/feeds/purchases">← Back to purchases</Link>
        </div>
        <Toast message={toast?.message ?? ''} type={toast?.type} onDismiss={() => setToast(null)} />
        {completed ? (
          <div className="card">
            <h2 className="section-title">Correction saved</h2>
            <p>The original purchase has been preserved for audit and the corrected purchase is now active in the archive.</p>
          </div>
        ) : initialValues ? (
          <FeedPurchaseForm
            feedItems={feedItems}
            vendors={vendors}
            initialValues={initialValues}
            onSave={save}
            busy={busy}
            submitLabel="Save correction"
          />
        ) : (
          <div className="card"><p>Loading purchase…</p></div>
        )}
      </div>
    </AppShell>
  );
}