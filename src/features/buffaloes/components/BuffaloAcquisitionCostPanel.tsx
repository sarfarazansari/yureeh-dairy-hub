'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Toast } from '@/components/ui/Toast';

import { money } from '@/lib/farm-format';
import type { BuffaloAcquisitionCost, BuffaloAcquisitionExpenseOption } from '../types';
import { supabase } from '@/lib/supabase';

function localDate() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function BuffaloAcquisitionCostPanel({ buffaloId, canAdd, purchasePrice }: { buffaloId: string; canAdd: boolean; purchasePrice: number | null }) {
  const queryClient = useQueryClient();
  const [expenseId, setExpenseId] = useState('');
  const [costDate, setCostDate] = useState(localDate());
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [toastState, setToastState] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const costsQuery = useQuery({
    queryKey: ['buffalo-acquisition-costs', buffaloId],
    enabled: Boolean(supabase && buffaloId),
    queryFn: async () => {
      if (!supabase) throw new Error('Supabase is not configured.');
      const { data, error } = await supabase
        .from('buffalo_acquisition_costs')
        .select('id,expense_id,cost_date,description,amount,notes')
        .eq('buffalo_id', buffaloId)
        .order('cost_date', { ascending: false });
      if (error) throw new Error('Could not load acquisition costs.');
      return (data ?? []) as BuffaloAcquisitionCost[];
    },
  });

  const expensesQuery = useQuery({
    queryKey: ['buffalo-acquisition-cost-expenses', buffaloId],
    enabled: Boolean(supabase && buffaloId),
    queryFn: async () => {
      if (!supabase) throw new Error('Supabase is not configured.');
      const { data, error } = await supabase
        .from('expenses')
        .select('id,business_date,description,total_amount')
        .eq('buffalo_id', buffaloId)
        .is('deleted_at', null)
        .order('business_date', { ascending: false });
      if (error) throw new Error('Could not load expenses linked to this buffalo.');
      return (data ?? []) as BuffaloAcquisitionExpenseOption[];
    },
  });

  const usedExpenseIds = useMemo(
    () => new Set((costsQuery.data ?? []).map((cost) => cost.expense_id)),
    [costsQuery.data],
  );
  const availableExpenses = (expensesQuery.data ?? []).filter(
    (expense) => !usedExpenseIds.has(expense.id),
  );
  const totalCapitalized = (costsQuery.data ?? []).reduce(
    (sum, cost) => sum + Number(cost.amount),
    0,
  );
  const carryingValue = purchasePrice == null ? null : purchasePrice + totalCapitalized;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!supabase) throw new Error('Supabase is not configured.');
      if (!expenseId || !costDate || !description.trim()) {
        throw new Error('Choose a linked expense, date, and description.');
      }
      const parsedAmount = Number(amount);
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        throw new Error('Enter an acquisition cost greater than zero.');
      }
      const { error } = await supabase.rpc('record_buffalo_acquisition_cost', {
        p_buffalo_id: buffaloId,
        p_expense_id: expenseId,
        p_cost_date: costDate,
        p_description: description.trim(),
        p_amount: parsedAmount,
        p_notes: notes.trim() || null,
      });
      if (error) throw new Error(error.message || 'Could not record acquisition cost.');
    },
    onSuccess: async () => {
      setToastState({ message: 'Acquisition cost capitalized.', type: 'success' });
      setExpenseId('');
      setDescription('');
      setAmount('');
      setNotes('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['buffalo-acquisition-costs', buffaloId] }),
        queryClient.invalidateQueries({ queryKey: ['buffalo-acquisition-cost-expenses', buffaloId] }),
      ]);
    },
    onError: (error) => {
      setToastState({
        message: error instanceof Error ? error.message : 'Could not record acquisition cost.',
        type: 'error',
      });
    },
  });

  return (
    <section className="card">
      <Toast
        message={toastState?.message ?? ''}
        type={toastState?.type}
        onDismiss={() => setToastState(null)}
      />
      <div className="row">
        <div>
          <h2 className="section-title">Capitalized acquisition costs</h2>
          <p className="sub">Link eligible costs such as transport to an existing expense assigned to this buffalo. The cost is not counted twice as an operating expense.</p>
        </div>
        <div>
          <div className="kpi-label">CURRENT CARRYING VALUE</div>
          <b>{carryingValue == null ? '—' : money(carryingValue)}</b>
          <p className="sub">Purchase price + capitalized costs; no depreciation applied</p>
          <div className="kpi-label">CAPITALIZED COSTS</div>
          <b>{money(totalCapitalized)}</b>
        </div>
      </div>

      {costsQuery.isPending ? (
        <div className="empty">Loading acquisition costs…</div>
      ) : costsQuery.isError ? (
        <p className="auth-message">{costsQuery.error.message}</p>
      ) : (costsQuery.data ?? []).length ? (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>DATE</th><th>DESCRIPTION</th><th>AMOUNT</th><th>NOTES</th></tr></thead>
            <tbody>
              {costsQuery.data!.map((cost) => (
                <tr key={cost.id}>
                  <td>{cost.cost_date}</td>
                  <td>{cost.description}</td>
                  <td>{money(Number(cost.amount))}</td>
                  <td>{cost.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <div className="empty">No acquisition costs capitalized yet.</div>}

      {canAdd && <form
        className="form-grid"
        onSubmit={(event) => {
          event.preventDefault();
          saveMutation.mutate();
        }}
      >
        <label className="field">
          <span>Linked buffalo expense</span>
          <select value={expenseId} onChange={(event) => setExpenseId(event.target.value)} required>
            <option value="">Choose an expense</option>
            {availableExpenses.map((expense) => (
              <option key={expense.id} value={expense.id}>
                {expense.business_date} · {expense.description || 'Expense'} · {money(Number(expense.total_amount))}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Cost date</span>
          <input type="date" value={costDate} onChange={(event) => setCostDate(event.target.value)} required />
        </label>
        <label className="field">
          <span>Capitalized amount (₹)</span>
          <input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required />
        </label>
        <label className="field">
          <span>Description</span>
          <input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={200} required />
        </label>
        <label className="field">
          <span>Notes (optional)</span>
          <input value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} />
        </label>
        <div className="field">
          <span>&nbsp;</span>
          <button className="btn primary" type="submit" disabled={saveMutation.isPending || !availableExpenses.length}>
            {saveMutation.isPending ? 'Saving…' : 'Add acquisition cost'}
          </button>
        </div>
      </form>}
      {canAdd && !expensesQuery.isPending && !expensesQuery.isError && availableExpenses.length === 0 && (
        <p className="sub">No unlinked active expenses are assigned to this buffalo. Create or update an expense and assign it to this buffalo first.</p>
      )}
      {expensesQuery.isError && <p className="auth-message">{expensesQuery.error.message}</p>}
    </section>
  );
}
