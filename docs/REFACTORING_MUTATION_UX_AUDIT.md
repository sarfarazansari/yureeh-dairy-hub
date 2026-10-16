# Mutation Invalidation, Submission Safety, UI States and Pagination Audit

Task: `REF-006`  
Branch: `feature/refactor-engineering-standards`  
Date: 2026-10-16  
Method: static GitHub file inspection plus REF-002/003/005 inventories. No local checkout/runtime was available.

## Executive summary

The application has several good safeguards already: milk and customer writes use TanStack Query mutations; expense history has explicit lock checks and URL-backed pagination; feed purchase creation passes an idempotency key to an RPC; consumption/purchase service operations use RPCs; and the diet scheduler makes failed-run retry explicit rather than automatically reposting a run.

The main gaps are cross-feature cache invalidation and inconsistent mutation/state ownership. Several expense/feed/report pages still manage loading/errors and writes inside route components. Some feed pages expose separate retry controls for independent stock/movement/list requests, which should be preserved when query hooks are introduced. Static review cannot prove all controls are disabled during pending requests or that every error path is surfaced; the module checklist below records what must be verified during implementation.

This is an audit/design task. No source implementation files, migrations, or database records were changed.

## 1. Confirmed query invalidation gaps

### REF-006-A — Milk entry mutations do not invalidate customer summaries

**Evidence**
- `src/features/milk/milk.queries.ts`: create, update and delete mutations invalidate `milkQueryKeys.all` only.
- `src/features/customers/customer.queries.ts`: customer directory and detail are cached under `customerQueryKeys.directory()` and `customerQueryKeys.detail(customerId)`.
- `src/features/customers/services/customer.service.ts`: directory/detail data includes sales totals, milk entries and financial summaries.

**Finding:** a milk entry mutation can leave an already-cached customer directory or detail summary stale. This was also identified in REF-003.

**Action:** add a cross-feature invalidation contract in the shared query conventions phase. After successful create/update/delete, invalidate the customer directory and the affected customer detail; for updates/deletes, capture the old customer ID when necessary, and invalidate both old and new customer details if customer association can change. Avoid circular imports between query modules; use a small shared key contract or dependency-aware invalidation helper.

### REF-006-B — Production save does not invalidate buffalo detail production history

**Evidence**
- `src/features/buffalo-production/buffalo-production.queries.ts`: save mutation invalidates production and milk roots.
- `src/features/buffaloes/hooks/use-buffaloes.ts`: buffalo detail history uses the separate `buffaloKeys.production(buffaloId)` tree while production feature has `buffaloProductionQueryKeys.history(buffaloId)`.

**Finding:** the buffalo detail's production history may remain stale after saving a sheet. The same resource has two key owners.

**Action:** select a canonical owner for production-history keys and migrate consumers in a bounded change. Invalidate the relevant history after save; do not leave duplicate keys indefinitely. Check buffalo IDs included in the saved sheet and whether affected detail pages are mounted.

### REF-006-C — Cross-domain invalidation is incomplete by design, needs a dependency matrix

**Evidence**
- Customer pricing/activation invalidates customer and milk roots.
- Buffalo mutation helper broadly invalidates buffalo root.
- Production save invalidates production and milk roots.
- Acquisition-cost UI owns its own query/mutation and literal query keys, as recorded in REF-003.

**Finding:** broad module-root invalidation is simple but does not document all dependent report/finance/inventory views. Some paths use literal keys rather than a shared factory. It is not yet established that every downstream consumer is stale in practice; treat this as an audit gap, not proof of a visible defect.

**Action:** before implementing invalidation changes, map writes to all affected query families and use the REF-007 transaction audit to establish dependencies. Prefer the narrowest complete set of invalidations; do not solve this with indiscriminate cache clearing.

## 2. Mutation safety and feedback by module

| Module / paths | Observed existing safeguards | Gaps / required verification |
|---|---|---|
| Milk entries — `src/features/milk/milk.queries.ts`, `src/features/milk/new-entry.tsx`, `src/features/milk/EntriesPage.tsx` | Create/update/delete are RPC-backed service mutations; query invalidation exists; duplicate checks and delivery context have query hooks. | Confirm create/update submit buttons are disabled while pending, errors remain visible, duplicate check cannot be bypassed by rapid double submit, and customer summary/detail invalidation is complete. A client-side duplicate query alone is not a concurrency guarantee; retain database/RPC constraints. |
| Customer master/payments/pricing — `src/features/customers/customer.queries.ts`, `src/features/customers/CustomerDetailPage.tsx` | Mutations exist for create/update/payment/pricing/activation; payment mutation invalidates detail and directory. | Verify pending-submit guards and error/success feedback for every form. Pricing/activation must refresh milk-entry customer/pricing options; payment changes must refresh outstanding totals. Do not infer every UI control is defective without a runtime pass. |
| Buffalo lifecycle, purchase, payment, sale and disposal — `src/features/buffaloes/hooks/use-buffaloes.ts`, `src/features/buffaloes/services/buffalo.service.ts` | Shared mutation helper invalidates buffalo root; transactional RPC/service operations are in place for lifecycle and payments. | Root invalidation may miss cross-domain finance/report queries. Build the dependency matrix before broadening invalidations. Confirm duplicate payment/sale submission guards and keep payment/transaction RPCs atomic. |
| Buffalo production — `src/features/buffalo-production/buffalo-production.queries.ts` | Save is a mutation and invalidates production and milk roots. | Missing buffalo detail history invalidation is identified above. Verify pending state, error feedback, and that save failures do not appear successful or trigger unrelated invalidation. |
| Expenses overview/history — `src/app/(protected)/expenses/page.tsx`, `src/app/(protected)/expenses/history/page.tsx` | History page has validation, busy state on edit/delete, ledger/feed-purchase lock checks, explicit load error with retry, URL-backed page/pageSize, and filter changes reset page. | Remote reads and writes are still route-owned. Check every save/delete path for duplicate-submit prevention and toast/inline error consistency; preserve locked ledger semantics. Check page count and result-count labels after concurrent deletion/filter changes. |
| Expense detail/payment — `src/app/(protected)/expenses/history/[id]/page.tsx` | Payment write uses `record_expense_payment` RPC; submit button uses a saving guard. | Read and write remain in route. Verify payment amount bounds, server-side duplicate protection/idempotency, error feedback and invalidation of expense detail, history, vendor/category summaries, financial reports and linked feed purchase where relevant. |
| Feed purchases — `src/app/(protected)/feeds/purchases/services.ts`, `src/app/(protected)/feeds/purchases/page.tsx`, new/edit routes | Create calls `create_feed_purchase_idempotent` with an idempotency key; edit/delete use RPCs; list exposes retry and toast feedback. | Preserve request-key lifecycle across retries: a retry of the same intent must reuse the key, while a genuinely new purchase must get a new key. Audit whether create/edit/delete refresh expense/payment/stock/movement/report consumers. Do not make posted ledger entries freely editable. |
| Feed consumption — `src/app/(protected)/feeds/consumption/services.ts`, list/new/edit routes | Create/edit/delete use RPCs; list has loading/error/retry state and success/error toast for delete. | Verify rapid double-click protection for create/edit/delete and refresh stock, movements, consumption history, applied costs, diet-plan run status and feed-cost analytics. Never add automatic retry for non-idempotent operations without explicit RPC idempotency guarantees. |
| Feed inventory — `src/app/(protected)/feeds/inventory/services.ts`, `src/app/(protected)/feeds/inventory/page.tsx` | Stock and movement requests have independent loading/errors and retry controls; filter changes reset movement page. | Preserve independent stock vs movement errors/retries. Stock is derived from the ledger; never optimistically change stock unless the underlying movement is committed and reconciled. Confirm pagination boundaries when filters change. |
| Diet plans — `src/app/(protected)/feeds/diet-plans/services.ts`, plan pages | Plan reads/saves are service/RPC-backed; schemas exist. | Audit pending guards, duplicate plan saves and dependent plan/feed/buffalo queries. Changes can affect scheduled consumption; invalidation must include relevant plans/runs/stock/cost views without causing a run to execute twice. |
| Diet scheduler — `src/app/(protected)/feeds/diet-plans/schedule/page.tsx` | Saving has a pending flag; retry is explicitly initiated, guarded by `retryingId`, and only presented for FAILED runs. UI states failed runs are not automatically posted. | Preserve explicit retry semantics. Verify repeated clicks, response loss, status refresh after retry and server-side run idempotency. Never add automatic mutation retry or treat a retry request as a successful stock posting. |
| Feed master — `src/app/(protected)/feeds/items/page.tsx` | CRUD and activation paths exist. | Query/invalidation boundary remains route-owned. Changes should refresh item selectors, purchase/consumption/diet-plan forms and inventory labels; verify deactivate/delete behavior with references. |
| Dashboard/analytics/financial reports | Read-only aggregates and RPCs are listed in REF-002/005. | Reports must refresh after the source transactions that change them. Determine dependencies in REF-007; preserve date range and empty/error/loading behavior. |

## 3. Pagination and filtering review

### Existing positive patterns
- `src/app/(protected)/expenses/history/page.tsx` parses `page` and `pageSize` from URL params, clamps accepted page sizes to 10/20/50/100, uses server-side range pagination, resets page through URL state and disables Previous/Next at boundaries.
- Feed purchase/consumption/inventory pages reset the local page to zero when filters change.
- Purchase and consumption services calculate database ranges from page and page size; inventory movements use a server-side range.
- REF-005 identified table effects that clamp a local page when result count shrinks. Those are valid local-state synchronization effects, not remote fetch effects.

### Risks / acceptance requirements
1. All query keys for paginated data must include filters, sort, page and page size. Do not reuse one cached page for another filter combination.
2. Search/filter changes must reset page consistently; date range and date-only values must retain current timezone semantics.
3. After delete or a filter change, clamp/reset a now-invalid page and show correct total/result counts.
4. Keep server-side pagination; do not fetch the whole feed/expense ledger to paginate in the browser.
5. Loading a new page must not silently show a previous filter's records as if they matched current filters. If keeping prior data during transitions, label/disable controls as appropriate.
6. Keep separate loading/error/retry state for independent inventory stock and movement reads.
7. Validate empty results separately from failures; an empty list is not an error.
8. For server queries, prefer query-managed data/loading/error state rather than mirroring fetched records into local state.

### Expense history count note
The page derives visible results and total count through several related reads. During refactor, inspect exact count semantics and whether counts include soft-deleted/filtered rows before changing labels. Do not “fix” displayed counts without reconciling server query predicates.

## 4. Cross-domain invalidation matrix to finalize with REF-007

This is an investigation checklist, not a claim every edge is currently missing.

| Successful operation | Minimum cache families to inspect |
|---|---|
| Milk entry create/update/delete | Milk entries, duplicate check for old/new customer+date+shift, customer directory/detail, pool reconciliation/delivery context if the RPC affects them, sales analytics/dashboard/financial reports as applicable |
| Production sheet save | Production sheet/range/history, buffalo detail production history, milk pool/fat/delivery context, dashboard and production analytics |
| Customer pricing or activation | Customer directory/detail, milk customer options, historical-date pricing lookups as applicable |
| Customer payment | Customer detail/payment history/directory financial totals, financial reports |
| Buffalo purchase/payment/status/profile change | Buffalo directory/detail/payment/status history, acquisition cost, expense/finance summaries, eligible production lists where status changes affect eligibility |
| Buffalo sale/disposal/payment | Buffalo directory/detail/sale/payment/disposal, finance summaries/reports, dashboard |
| Expense create/update/delete/payment | Expense list/detail/category/vendor summaries, payment ledger, feed purchase linkage, finance reports/dashboard |
| Feed purchase create/edit/delete/payment | Purchase list/detail/payment, expense link/list, stock totals/movements, vendor summaries, feed cost and financial reports |
| Feed consumption create/edit/delete | Consumption list/detail, stock/movements, applied cost, diet-plan run state when linked, feed cost/production analytics |
| Feed item activation/details | Feed item selectors, purchase/consumption forms, plans, inventory labels |
| Diet plan save/schedule/retry | Plan list/detail, scheduled runs, consumption/stock/cost only after actual posting, dashboard/analytics as relevant |

Implementation should use module-owned key factories or a small shared invalidation contract. Avoid importing query modules cyclically; avoid invalidating every query globally; do not invalidate on failed mutations.

## 5. Duplicate submission and retry policy

- Disable the relevant submit/action while a mutation is pending, but treat this as a UX guard only.
- Database uniqueness, RPC locks, idempotency keys and transactional semantics are the actual protection against concurrency and network retries.
- Preserve the existing idempotency key for the same feed-purchase request retry. Do not generate a fresh key on each retry of the same intent.
- Do not add automatic retry for milk writes, customer/buffalo payments, expense payments, feed purchase/consumption writes or scheduler retries unless the RPC contract explicitly guarantees idempotency and the retry behavior is documented.
- On uncertain network outcome, provide a way to reload/reconcile the persisted record instead of blindly repeating a financial mutation.
- Keep explicit retry for failed diet-feeding runs as a user action, with server-side status validation and idempotent posting.
- Ensure errors remain visible and success feedback appears only after server success. Invalidation failure should not misrepresent a committed transaction as rolled back; log/handle refresh errors separately where appropriate.

## 6. Recommended implementation order after REF-008

1. Standardize cross-feature key ownership and invalidation helpers based on the completed transaction map; address the two confirmed gaps above.
2. Extract the simplest read-only analytics/dashboard service/query boundaries and verify date/filter semantics.
3. Introduce query/mutation boundaries in feed inventory reads, then expenses read paths, while preserving independent loading/error/retry behavior.
4. Refactor feed purchase and consumption reads separately from their transactional write RPCs.
5. Refactor diet plan/scheduler reads and writes last; explicitly preserve request-key, retry, run-snapshot and posted-status semantics.
6. Address per-module pending/error/empty state inconsistencies as each module migrates, with manual regression cases.
7. Run search-based final audit of mutation handlers, disabled/pending states, query keys, invalidations, pagination resets and error feedback.

Do not implement these source changes until REF-007 transaction integrity and REF-008 final phase ordering are complete.

## 7. Regression checklist for implementation tasks

- [ ] Double-click submit/delete/payment does not create duplicate transactions.
- [ ] RPC failure produces visible error and does not show success.
- [ ] Network timeout/response loss does not encourage blind repeat of a non-idempotent write.
- [ ] Successful mutation refreshes all related list/detail/summary/report views.
- [ ] Failed mutation does not invalidate as if committed.
- [ ] Milk entry changes refresh customer detail/directory totals and duplicate context.
- [ ] Production saves refresh buffalo detail history and pool/analytics consumers.
- [ ] Feed purchase changes reconcile purchase, expense/payment and stock movement once.
- [ ] Feed consumption changes reconcile movement, stock and applied cost once.
- [ ] Scheduler retry remains explicit and a run is never posted twice.
- [ ] Empty list, loading, recoverable error/retry and successful list are distinct.
- [ ] Pagination remains server-side and query keys include all filters/sort/page/page size.
- [ ] Filter changes reset/clamp page and result counts are correct.
- [ ] Expense ledger/feed-purchase lock rules remain intact.
- [ ] No unsafe blanket automatic retry is added for non-idempotent mutations.

## Validation boundary

- Executed: read the required project/workflow/architecture/task documents and the prior API inventory, query/state audit and effects audit. Inspected current milk/customer/production query hooks, buffalo mutation hooks, feed purchase/consumption/inventory/diet-plan services and key expense/feed route files on `feature/refactor-engineering-standards`.
- Confirmed statically: milk writes only invalidate the milk query root; production save invalidates production and milk but not the separate buffalo-detail history key; expense history has URL-backed server pagination and lock/busy/error states; feed purchase creation uses an idempotent RPC key; scheduler retry is explicit and guarded in the UI.
- Not confirmed: complete downstream cache dependency graph, every route's pending guard, all runtime error paths, concurrent request behavior, RLS/DB idempotency, and all count semantics.
- Not run: local build, lint, typecheck, tests, browser/manual regression, migrations or database/RLS checks. No local checkout was available.
- No source code or database objects changed. No PR or merge was created.
