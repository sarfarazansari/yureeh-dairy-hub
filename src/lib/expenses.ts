export type ExpenseGroup =
  | 'FEED'
  | 'ANIMAL'
  | 'FARM_OPERATIONS'
  | 'TRANSPORT'
  | 'UTILITIES'
  | 'LABOUR'
  | 'EQUIPMENT'
  | 'ADMIN'
  | 'OTHER';
export const EXPENSE_GROUPS: ExpenseGroup[] = [
  'FEED',
  'ANIMAL',
  'FARM_OPERATIONS',
  'TRANSPORT',
  'UTILITIES',
  'LABOUR',
  'EQUIPMENT',
  'ADMIN',
  'OTHER',
];
export const UNITS = [
  'KG',
  'GRAM',
  'LITRE',
  'ML',
  'PIECE',
  'TRIP',
  'DAY',
  'MONTH',
  'BAG',
  'TON',
  'OTHER',
];
export function calculateExpenseTotal(quantity: string | number, rate: string | number): number {
  const q = Number(quantity),
    r = Number(rate);
  if (!Number.isFinite(q) || !Number.isFinite(r) || q < 0 || r < 0)
    throw new Error('Quantity and rate must be non-negative numbers.');
  return Math.round((q * r + Number.EPSILON) * 100) / 100;
}
export function calculatePending(total: number, paid: number): number {
  if (!Number.isFinite(total) || !Number.isFinite(paid) || total < 0 || paid < 0 || paid > total)
    throw new Error('Paid amount must be between zero and the total amount.');
  return Math.round((total - paid + Number.EPSILON) * 100) / 100;
}
export function expensePaymentStatus(total: number, paid: number): 'PAID' | 'PARTIAL' | 'CREDIT' {
  const pending = calculatePending(total, paid);
  return pending === 0 ? 'PAID' : paid > 0 ? 'PARTIAL' : 'CREDIT';
}
export function dueLabel(
  dueDate: string | null,
  today = new Date().toISOString().slice(0, 10),
): 'Overdue' | 'Due today' | 'Upcoming' | null {
  if (!dueDate) return null;
  if (dueDate < today) return 'Overdue';
  if (dueDate === today) return 'Due today';
  return 'Upcoming';
}
