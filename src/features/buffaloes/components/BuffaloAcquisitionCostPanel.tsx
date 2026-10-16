'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Toast } from '@/components/ui/Toast';
import { money } from '@/lib/farm-format';
import { todayDateKey } from '@/lib/date-input';
import {
  useBuffaloAcquisitionCostsQuery,
  useBuffaloAcquisitionCostExpensesQuery,
  useRecordBuffaloAcquisitionCostMutation,
} from '../hooks/use-buffaloes';

export function BuffaloAcquisitionCostPanel({ buffaloId, canAdd, purchasePrice }: { buffaloId: string; canAdd: boolean; purchasePrice: number | null }) {
  const [expenseId, setExpenseId] = useState('');
  const [costDate, setCostDate] = useState(localDate());
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [toastState, setToastState] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const costsQuery = useBuffaloAcquisitionCostsQuery(buffaloId);
  const expensesQuery = useBuffaloAcquisitionCostExpensesQuery(buffaloId);

  const usedExpenseIds = useMemo(() => new Set((costsQuery.data ?? []).map((cost) => cost.expense_id)), [costsQuery.data]);
  const availableExpenses = (expensesQuery.data ?? []).filter((expense) => !usedExpenseIds.has(expense.id));
  const totalCapitalized = (costsQuery.data ?? []).reduce((sum, cost) => sum + Number(cost.amount), 0);
  const carryingValue = purchasePrice == null ? null : purchasePrice + totalCapitalized;

  const saveMutation = useRecordBuffaloAcquisitionCostMutation();

  const submitAcquisitionCost = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!expenseId || !costDate || !description.trim()) {
      setToastState({ message: 'Choose a linked expense, date, and description.', type: 'error' });
      return;
    }
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setToastState({ message: 'Enter an acquisition cost greater than zero.', type: 'error' });
      return;
    }
    if (costDate > todayDateKey()) {
      setToastState({ message: 'Cost date cannot be in the future.', type: 'error' });
      return;
    }

    saveMutation.mutate({
      buffaloId,
      expenseId,
      costDate,
      description: description.trim(),
      amount: parsedAmount,
      notes: notes.trim() || null,
    }, {
      onSuccess: () => {
        setToastState({ message: 'Acquisition cost capitalized.', type: 'success' });
        setExpenseId('');
        setDescription('');
        setAmount('');
        setNotes('');
      },
      onError: (error) => setToastState({
        message: error instanceof Error ? error.message : 'Could not record acquisition cost.',
        type: 'error',
      }),
    });
  };

  return (
    <section className="card space-y-4">
      <Toast message={toastState?.message ?? ''} type={toastState?.type} onDismiss={() => setToastState(null)} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><h2 className="section-title">Capitalized acquisition costs</h2><p className="sub">Link an eligible expense such as transport to this buffalo. Capitalized costs are excluded from operating expense totals to avoid double-counting.</p></div>
        <div className="shrink-0"><div className="kpi-label">CURRENT CARRYING VALUE</div><b>{carryingValue == null ? '—' : money(carryingValue)}</b><p className="sub">Purchase price + capitalized costs; no depreciation applied</p><div className="kpi-label">CAPITALIZED COSTS</div><b>{money(totalCapitalized)}</b></div>
      </div>

      {costsQuery.isPending ? <div className="empty">Loading acquisition costs…</div> :
        costsQuery.isError ? <p role="alert" className="auth-message">{costsQuery.error.message}</p> :
        (costsQuery.data ?? []).length ? <div className="table-wrap"><Table className="min-w-[600px]"><TableHeader><TableRow><TableHead>DATE</TableHead><TableHead>DESCRIPTION</TableHead><TableHead>AMOUNT</TableHead><TableHead>NOTES</TableHead></TableRow></TableHeader>
          <TableBody>{costsQuery.data!.map((cost) => <TableRow key={cost.id}><TableCell>{cost.cost_date}</TableCell><TableCell>{cost.description}</TableCell><TableCell>{money(Number(cost.amount))}</TableCell><TableCell>{cost.notes || '—'}</TableCell></TableRow>)}</TableBody></Table></div> :
        <div className="empty">No acquisition costs capitalized yet.</div>}

      {canAdd && <form className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" onSubmit={submitAcquisitionCost} noValidate>
        <Field label="Linked buffalo expense"><Select value={expenseId || undefined} onValueChange={setExpenseId}><SelectTrigger><SelectValue placeholder="Choose an expense" /></SelectTrigger><SelectContent>{availableExpenses.map((expense) => <SelectItem key={expense.id} value={expense.id}>{expense.business_date} · {expense.description || 'Expense'} · {money(Number(expense.total_amount))}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Cost date"><DatePicker value={costDate} max={todayDateKey()} onChange={setCostDate} ariaLabel="Cost date" /></Field>
        <Field label="Capitalized amount (₹)"><Input type="number" inputMode="decimal" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required /></Field>
        <Field label="Description"><Input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={200} required /></Field>
        <Field label="Notes (optional)"><Textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} rows={2} /></Field>
        <div className="lg:col-span-3"><Button type="submit" disabled={saveMutation.isPending || !availableExpenses.length}>{saveMutation.isPending ? 'Saving…' : 'Add acquisition cost'}</Button></div>
      </form>}
      {canAdd && !expensesQuery.isPending && !expensesQuery.isError && availableExpenses.length === 0 && <p className="sub">No unlinked active expenses are assigned to this buffalo. Create or update an expense and assign it to this buffalo first.</p>}
      {expensesQuery.isError && <p role="alert" className="auth-message">{expensesQuery.error.message}</p>}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="field"><Label>{label}</Label>{children}</div>;
}
