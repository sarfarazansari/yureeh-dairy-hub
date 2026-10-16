# Transaction Integrity Audit — Finance, Milk Pool and Feed Ledgers

Task: `REF-007`  
Branch: `feature/refactor-engineering-standards`  
Date: 2026-10-16  
Method: static inspection of feature services, RPC callers and selected migration SQL. No local checkout or live database session was available.

## Executive summary

The core design intentionally keeps important multi-row operations inside PostgreSQL RPCs and uses append-only movement/payment ledgers for milk-pool and feed inventory. Confirmed protections include: database-enforced active milk-entry uniqueness; milk delivery plus pool movement in one RPC; production receipt synchronization through RPC; serialized feed stock checks; feed purchase idempotency keys; linked feed purchase/expense integrity guards; append-only inventory corrections; explicit scheduler retry; and dated customer/expense/buffalo payment ledgers.

The most important remaining risks for the refactor are not a proven missing transaction boundary in these inspected paths. They are (a) mutation/cache dependencies across operational and financial read models, (b) a few legacy/transaction models whose behavior must be verified against the complete migration chain and live data, and (c) areas where static source inspection cannot prove RLS/runtime/concurrency behavior. This is an audit, not a claim that production database integrity has been tested.

## 1. Transaction map

| Operation | Entry point / service | Database boundary and writes | Integrity / retry / correction behavior | Downstream consumers |
|---|---|---|---|---|
| Save buffalo production + mixed-pool fat | Production page → `saveProductionSheet` in `src/features/buffalo-production/services/buffalo-production.service.ts` | RPC `save_buffalo_production_with_fat` (which delegates into the production save/sync path); `buffalo_milk_production`, `milk_pool_shift_fat`, `milk_pool_movements` production receipts/reversals | RPC-based multi-record save; migration chain includes production/pool sync, write-boundary hardening, historical-status rules and later reconciliation fixes. Do not replace with independent browser writes. Verify the final function body and trigger order during implementation because several later migrations replace related functions. | Herd sheet/history, pooled fat history, milk-pool shift context/reconciliation, dashboard and production analytics |
| Create customer milk delivery | `createMilkEntry` in `src/features/milk/services/milk-entry.service.ts` | RPC `create_milk_entry_with_pool`; inserts `milk_entries` and linked `milk_pool_movements` delivery-out row in one transaction | DB unique partial index on active customer/date/shift; authoritative amount recalculated server-side; positive quantity/rate, scale and fat rules validated; RPC restricted to authenticated role and hardened security-definer path. UI duplicate check is only a convenience, not the concurrency guard. | Customer directory/detail totals, milk entry list, milk pool balance/reconciliation, sales analytics, financial reports |
| Edit/delete customer milk delivery | Same service; `update_milk_entry_with_pool` / `delete_milk_entry_with_pool` | Entry update/soft delete plus reversal and replacement movements in the pool ledger | Row locks and active-delivery lookup; reversal rows preserve history; a unique reversal index prevents duplicate reversal of one movement. Update/delete must not be reimplemented as direct table writes. Review pool-balance guard behavior for historical edits that move deliveries across date/shift. | Same consumers as create; old and new customer/date/shift caches may all be affected |
| Record manual pool use/wastage/adjustment | `recordMilkPoolMovement` in `src/features/milk/services/milk-pool.service.ts` | RPC `record_milk_pool_movement`; inserts an append-only movement | Only allowed manual movement types accepted; quantity precision checked; only adjustments can be IN/OUT; write policies removed from client table access and writes routed through controlled RPCs. The later shift-balance guard and reversal migrations must remain part of the contract. | Shift context, reconciliation and milk-pool UI |
| Customer payment | `recordCustomerPayment` in `src/features/customers/services/customer.service.ts` | RPC `record_customer_payment`; inserts `customer_payments` after locking the customer row | Positive amount/date/method and farm ownership checked; later migration explicitly hardens overpayment behavior. The table has owner-scoped RLS. No idempotency key was observed in the caller signature, so don't blindly auto-retry on an ambiguous network outcome; confirm latest overpayment RPC body and live constraints before changing it. | Customer payment history/financial summary, customer receivables/credits, financial report |
| Create feed purchase | `src/app/(protected)/feeds/purchases/services.ts` | `create_feed_purchase_idempotent` wraps `create_feed_purchase`; creates `expenses`, `feed_purchases`, initial stock-in movement | Stable per-intent idempotency key is stored under farm owner; advisory transaction lock serializes the same key. Unique purchase↔expense and original stock-in indexes protect duplication. Core RPC validates feed/vendor/category, quantities, amount and paid/status coherence. Do not generate a new key for retrying the same request. | Purchase list/detail, expense history, supplier balances, stock/movements, feed cost and financial reports |
| Edit/delete feed purchase | Same purchase service | RPCs lock purchase/feed item; mark old purchase DELETED, soft-delete linked expense and append compensating stock-out; edit creates replacement transaction in the same database transaction | Corrections preserve ledger history and reject if later consumption/stock adjustment depends on the purchase. Later integrity migration prevents independent edit/delete of active linked expenses and locks paid/ledger-paid purchases because payment reversal is not supported by this replacement workflow. Do not loosen this guard casually. | Purchase history, expense views, stock/movement history and financial reports |
| Record expense payment | Expense detail route currently calls `record_expense_payment` directly | RPC inserts `expense_payments` and updates expense paid/status fields atomically | Expense row locked; amount must be positive and not exceed pending balance; actual payment method required; guard prevents legacy editor overwriting ledger-derived paid amount; RLS allows reads while ledger writes are RPC-controlled. No idempotency key was observed; ambiguous failures need reconciliation, not blind repeat. | Expense detail/history, vendor/category summaries, supplier balance and financial reports |
| Create/edit/delete feed consumption | `src/app/(protected)/feeds/consumption/services.ts` | RPCs append `CONSUMPTION` or compensating `ADJUSTMENT_IN` movements | Feed-item row locks serialize stock/cost operations; insufficient stock and backdated activity are rejected; weighted-average cost is snapshotted at consumption; edit/delete are blocked when later inventory activity exists; correction is append-only. No generic automatic retry. | Stock view, movement history, consumption list, applied feed cost, diet run status/cost analytics |
| Scheduled diet-plan run | Scheduler UI/settings + DB `process_diet_plan_scheduler` | Scheduled runs and snapshot items/buffaloes; each run posts inventory movements as a subtransaction and records status/failure | Unique run occurrence by owner/plan/date/shift; `FOR UPDATE SKIP LOCKED`; snapshot freezes plan quantities and eligible buffaloes; missed runs become FAILED instead of late auto-posting; failed run retry is explicit. Preserve snapshot, status transition and per-run atomic posting. Static review did not verify deployed cron configuration or live concurrent execution. | Run history, consumption ledger, stock/movements, applied feed cost and feeding reports |
| Buffalo acquisition/payment | Buffalo create/payment service + `create_buffalo_purchase` / payment RPCs | Buffalo profile, purchase record and initial payment ledger entry; later payments insert ledger rows and update outstanding balance | Purchase creation validates code, price, advance and due-date rules; payment RPCs use row locks and reject overpayment; historical paid balances were backfilled as one legacy event without inventing installments. Acquisition cost and purchase balance are distinct from operating expense. | Buffalo detail/payment history, acquisition cost, balance snapshot and financial reports |
| Buffalo sale/payment/disposal | Buffalo service; sale/payment/disposal RPCs | Sale, sale-payment ledger, disposal/status-history rows | Row locks and terminal-state checks prevent duplicate sale/disposal; payment amount bounded by pending balance; disposal checks date, production history and prior terminal transaction. Treat sale proceeds/acquisition as asset transactions, not operating expenses. | Buffalo lifecycle/detail, sale report, carrying-value and balance reports |
| Financial reporting | `src/app/(protected)/financial-reports/page.tsx` | `get_farm_financial_summary`, `get_buffalo_sale_financial_summary`, balance snapshot RPCs | Aggregates run in PostgreSQL to avoid client row-limit errors. Sales, collections, operating expenses, dated payments, buffalo asset purchase/sale and legacy undated amounts are deliberately separated. Report is not a formal profit statement and does not yet include feed-consumption costing. | Financial reconciliation screen, dashboard/analytics as applicable |

## 2. Confirmed integrity contracts to preserve

1. **Milk pool is a ledger, not a mutable balance field.** Production receipts and customer delivery movements are linked to source records; corrections are represented by reversal/adjustment rows. Client table writes are revoked in the write-boundary migration.
2. **Milk sales and production are distinct records.** Production records are per buffalo/date/shift; mixed pool fat is per farm/date/shift; customer delivery records store applied pricing and their own sale fat when relevant.
3. **Feed inventory is movement-derived.** `feed_inventory_stock` derives quantity/value from movement rows. A trigger locks the feed item and rejects negative stock; consumption records unit-cost snapshots.
4. **Feed purchase is one atomic business operation.** Purchase, expense, and stock-in are created by one RPC chain. Idempotency is explicit; unique indexes protect purchase-to-expense and original stock-in relationships.
5. **Posted feed inventory is corrected, not overwritten.** Consumption/purchase correction paths add compensating movements and have guards where downstream activity or recorded payment history would make replacement unsafe.
6. **Payments are separate from sales/expense/acquisition facts.** Customer collections, supplier expense payments, buffalo purchase payments and buffalo sale payments have their own dated ledgers. Legacy undated paid balances are intentionally separated in historical reports.
7. **Diet scheduler is not a generic retry loop.** Run occurrence uniqueness, snapshots, explicit failed-run retry and per-run transactional posting are business invariants.
8. **Farm ownership is enforced at DB boundaries.** The inspected migrations use owner-scoped RLS and/or authenticated RPC checks; security-definer functions use an empty search path in the hardened paths inspected.

## 3. Confirmed gaps / implementation risks

### A. Cross-feature query invalidation is incomplete (confirmed)
- Milk entry mutations invalidate the milk query root but do not invalidate customer directory/detail financial summaries.
- Production save does not invalidate the separate buffalo-detail production-history key family.
- Expense/payment, feed purchase/consumption and buffalo lifecycle writes need a documented query-family dependency contract covering finance, dashboard, stock and movement consumers. The full missing-edge list must be implemented against the relevant query-key definitions rather than solved with global cache clearing.

### B. Customer payment concurrency/idempotency needs explicit treatment (contract needs verification)
The RPC locks the customer row and the migration chain includes an overpayment hardening migration. The frontend mutation signature has no idempotency key. Row locking can serialize same-customer writes, but retrying a request after a response is lost can still create a second payment if the first committed. This is a confirmed absence of a request key in the inspected service signature, not proof that duplicate payments have occurred. Before implementation, decide whether a durable request key is required for customer and other payment RPCs, and ensure it can be added without changing historical ledger semantics.

### C. Expense detail remains a route-owned data/write boundary (confirmed)
`src/app/(protected)/expenses/history/[id]/page.tsx` directly loads expense/payment records and calls `record_expense_payment`. Move this to typed service/query/mutation hooks in the expense refactor, while retaining DB balance checks and the post-success reload/invalidation behavior.

### D. Feed purchase paid-history correction is deliberately locked (confirmed)
`20261010150000_feed_purchase_expense_integrity.sql` prevents correction/deletion where a paid amount or dated expense payment exists. That means the current replacement-based edit/delete workflow does not support payment reversal. Preserve the lock and present a clear recovery path; don't bypass it in the UI or service layer.

### E. Milk-pool historical correction and concurrency need regression tests (verification required)
The SQL uses row locks and reversal rows, and later migrations add shift-balance guards and production reconciliation fixes. However, a static read cannot prove every final function replacement/trigger combination works against current production data, particularly when editing a delivery to another date/shift or correcting production after deliveries exist. Add targeted SQL/integration tests and validate the final function definitions on a disposable Supabase database before modifying these paths.

### F. Scheduler deployment and repeated-request behavior are unverified
Migration SQL establishes unique run occurrences, snapshots, guarded processing and explicit retry semantics. Static review did not inspect live cron/job configuration or exercise overlapping invocations. Verify scheduler deployment, lock behavior, failed-run retry and no duplicate stock posting in integration tests.

### G. Expense/customer payment history is not uniformly idempotent (risk, not observed duplicate data)
Expense and customer payment RPC callers do not pass a request idempotency key. Database row locks and pending-balance checks prevent overpayment in the inspected RPCs, but do not inherently distinguish a repeated identical payment after a successful-but-unacknowledged response. Do not add blind automatic retries; first determine whether a request-key ledger is warranted and design it for all payment domains consistently.

## 4. Migration / security review boundary

Inspected the migration chain covering milk sales, buffalo purchase integrity/lifecycle, milk-pool ledger/integrity/revisions/production sync/write boundary, customer payment ledger, feed inventory/purchase/consumption, scheduler, financial reconciliation, buffalo sale/disposal, consumption cost hardening, purchase-expense integrity and later milk reconciliation fixes.

Static observations:
- The milk-pool write-boundary migration revokes direct client write access and moves writes through controlled RPCs.
- Customer payment tables have owner-scoped RLS; expense payment table is read-only to clients with writes through the balance-validating RPC.
- Feed inventory movements have select/insert policies in the foundation migration, while movement triggers enforce ownership/stock behavior; verify the final deployed grants and later migrations before treating this alone as the complete write boundary.
- Feed purchase idempotency table has RLS enabled and direct role access revoked; the authenticated caller is granted execute only on the wrapper.
- Financial report functions use authenticated owner checks and server-side aggregates.

Not proven by static review: deployed migration version equality, current RLS policy state, trigger enablement, actual function owners/grants, data anomalies/duplicates, concurrent execution outcomes, cron registration, or reconciliation against live rows. Do not run or claim any database changes as part of this task.

## 5. Acceptance tests required before transaction-boundary refactors

- [ ] Concurrent same-customer/date/shift milk-entry creates produce exactly one active row and one delivery movement.
- [ ] Milk entry update/delete adds exactly one reversal for the active delivery; a failed update leaves both entry and ledger unchanged.
- [ ] Production quantity edits produce a correct reversal + replacement receipt; pool balance cannot go negative after customer delivery.
- [ ] Moving a delivery between date/shift preserves both old and new shift balances and reports.
- [ ] Two simultaneous feed consumptions cannot overspend stock; applied unit cost is stable and stock/value never goes negative.
- [ ] Same feed-purchase idempotency key returns the same purchase and creates only one expense and one stock-in movement.
- [ ] Purchase edit/delete is blocked when later inventory movements exist or payment history would be detached; allowed correction posts compensating movement exactly once.
- [ ] Customer/expense/buffalo payment cannot exceed pending balance under concurrent submissions.
- [ ] Simulated response loss for payment requests does not encourage or create a second payment; if idempotency is added, same key returns the original result.
- [ ] Scheduler overlap creates one run per plan/date/shift and posts each run once; retry remains explicit and respects current stock.
- [ ] Financial period totals and end-date balances reconcile against source ledgers, including legacy undated paid amounts.
- [ ] RLS prevents reading or writing another farm's records through direct table access and RPC arguments.

## Validation boundary

- Executed: fetched and read the required project/workflow/architecture/tracker documents, prior API/query/module/effects/mutation audits, relevant service files, and selected migration SQL on the current feature branch.
- Confirmed statically: RPC-backed milk-entry and production/pool writes, append-only milk-pool and feed-inventory ledgers, feed-purchase idempotency/unique constraints, payment balance guards, explicit scheduler retry/snapshot semantics, and the specific cache gaps listed above.
- Not run: local build, lint, typecheck, unit/integration tests, browser/manual regression, SQL execution, RLS checks, live database introspection, concurrency tests, cron verification or production-data reconciliation. No local checkout was available.
- No application source, migration or database records were changed. No PR or merge was created.
