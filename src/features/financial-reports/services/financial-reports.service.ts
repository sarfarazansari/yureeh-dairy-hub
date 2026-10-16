import type { SupabaseClient } from '@supabase/supabase-js';

export type BuffaloSaleSummary = {
  buffalo_sale_revenue: number | string;
  buffalo_sale_collections: number | string;
  buffalo_sale_outstanding: number | string;
  buffalo_sales_count: number | string;
  buffalo_sale_outstanding_as_of: number | string;
};

export type FinancialSummary = {
  milk_quantity_sold: number | string;
  milk_sales_revenue: number | string;
  customer_collections: number | string;
  operating_expenses: number | string;
  dated_expense_payments: number | string;
  customer_receivables: number | string;
  customer_credits: number | string;
  supplier_outstanding: number | string;
  buffalo_purchase_cost: number | string;
  buffalo_purchase_payments: number | string;
  buffalo_purchase_outstanding: number | string;
  legacy_undated_paid_amount: number | string;
  customer_receivables_as_of: number | string;
  customer_credits_as_of: number | string;
  supplier_outstanding_as_of_before_legacy: number | string;
  supplier_legacy_undated_paid_amount: number | string;
  buffalo_purchase_outstanding_as_of_before_legacy: number | string;
  buffalo_purchase_legacy_undated_paid_amount: number | string;
};

export async function getFinancialReport(
  client: SupabaseClient,
  from: string,
  to: string,
): Promise<{ summary: FinancialSummary | null; saleSummary: BuffaloSaleSummary | null }> {
  if (!from || !to || from > to) throw new Error('Choose a valid date range.');

  const [financialResult, saleResult] = await Promise.all([
    client.rpc('get_farm_financial_summary', { p_from: from, p_to: to }),
    client.rpc('get_buffalo_sale_financial_summary', { p_from: from, p_to: to }),
  ]);

  if (financialResult.error || saleResult.error) {
    throw new Error(
      financialResult.error?.message ??
        saleResult.error?.message ??
        'Could not load financial summary.',
    );
  }

  return {
    summary: (financialResult.data?.[0] ?? null) as FinancialSummary | null,
    saleSummary: (saleResult.data?.[0] ?? null) as BuffaloSaleSummary | null,
  };
}
