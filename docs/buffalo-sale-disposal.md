# Buffalo Sale and Disposal

## Business rules

- A sale is an acquisition/disposition transaction, not just a status update.
- Sales support full payment, partial payment, and credit with a required due date while a balance remains.
- Initial and subsequent receipts are stored in `buffalo_sale_payments`; the sale's received and pending amounts are maintained transactionally.
- Recording a sale marks the buffalo `SOLD` and writes lifecycle history in the same transaction.
- Non-sale removals are recorded in `buffalo_disposals`: `DEATH`, `TRANSFER_OUT`, or `OTHER`. Death sets `DECEASED`; transfer/other sets `OTHER`.
- Sale and disposal are mutually exclusive for each buffalo. Only active or dry buffaloes can be sold/disposed.
- Sale/disposal dates cannot precede the purchase date or any already-recorded production date.
- Terminal statuses cannot be set or changed through the generic status editor. Use the transaction workflows.
- Sale receipts and current sale receivables appear separately in Financial Reconciliation; sale proceeds are not mixed into operating expenses.

## Migration

Apply `supabase/migrations/20261009150000_buffalo_sale_disposal.sql` followed by `supabase/migrations/20261009151000_buffalo_sale_reporting.sql`.

## Manual verification

1. Record a fully paid sale and confirm the buffalo becomes SOLD and one payment appears.
2. Record a sale with a partial initial payment and due date; add a later payment and verify the balance/status updates.
3. Verify overpayment, zero/negative payment, missing due date, and duplicate sale are rejected.
4. Confirm a sold buffalo cannot receive new production after its effective sale date, while historical production before that date remains accessible.
5. Record DEATH, TRANSFER_OUT, and OTHER disposal cases on separate active/dry buffaloes; confirm the corresponding status and history.
6. Verify generic status editing cannot mark a buffalo SOLD/DECEASED/OTHER or reactivate a terminal record.
7. Confirm sale proceeds, collections by payment date, and current outstanding sale balances in Financial Reconciliation.
8. Verify one farm cannot read or mutate another farm's sale, payment, or disposal records.
9. Run `npm run build` and the repository lint command; apply migrations in development before testing.
