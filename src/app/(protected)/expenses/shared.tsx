'use client';

// Temporary compatibility exports while expense routes migrate to feature-owned imports.
export { ExpenseShell, ExpenseDateFilters } from '@/features/expenses/components/ExpenseNavigationShell';
export { ensureExpenseCategories } from '@/features/expenses/services/expense-setup.service';
export { money, todayLocal } from '@/features/expenses/utils/expense-format';
