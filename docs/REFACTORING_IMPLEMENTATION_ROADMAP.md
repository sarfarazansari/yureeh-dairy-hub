# Refactoring Implementation Roadmap — Final Dependency-Aware Plan

Task: `REF-008`  
Branch: `feature/refactor-engineering-standards`  
Date: 2026-10-16  
Inputs: REF-002 API inventory, REF-003 query/state audit, REF-004 module/type boundaries, REF-005 effects audit, REF-006 mutation UX audit, REF-007 transaction integrity audit.

## Goal and guardrails

Move remote reads/writes toward typed feature services and TanStack Query, reduce route-owned data access, and standardize query-key/invalidation/state conventions without changing business behavior. This plan does not introduce new business modules.

Non-negotiable invariants:
- Keep transaction-critical operations in existing PostgreSQL RPCs; never decompose an atomic RPC into browser-side writes.
- Preserve farm-scoped RLS and authorization checks.
- Preserve milk production, pooled fat, pool movements and customer delivery as distinct but reconcilable records.
- Preserve feed purchase → linked expense → stock-in atomicity and idempotency; preserve feed consumption → movement → applied-cost behavior.
- Preserve dated payment ledgers, legacy undated payment treatment, posted-entry correction guards and explicit diet scheduler retry.
- No automatic retry for non-idempotent payments, purchases, consumption or scheduler mutations.
- Server-side pagination; query keys include every result-changing filter/input.
- User handles PR and merge. No production database actions unless explicitly instructed.

## Ordered implementation phases

### Phase 0 — Shared query contract and safe mutation invalidation
**Task:** REF-009  
**Dependencies:** REF-001–REF-008 completed  
**Risk:** Medium; first code change should be small and focused.

**Scope**
- Define stable, feature-owned query-key factories and a documented cross-domain invalidation dependency contract.
- Resolve the duplicate buffalo production-history key ownership between `src/features/buffaloes/hooks/use-buffaloes.ts` and `src/features/buffalo-production/buffalo-production.queries.ts`.
- Fix the confirmed milk mutation invalidation gap: milk create/update/delete must refresh customer directory/detail totals; for edits/deletes capture the affected prior customer and invalidate old/new customer IDs where needed.
- Add focused tests or testable pure contracts for query-key identity and invalidation dependencies where the current test setup permits.
- Avoid circular imports and blanket `invalidateQueries()` of the entire cache.

**Acceptance**
- Every mutation's success path invalidates all mapped dependent entity/list/report query families and never invalidates as if a failed mutation committed.
- Query keys remain deterministic and include all IDs, dates, filters, sort and pagination inputs.
- Account/session cache lifecycle is explicitly verified or documented as a separate security validation task.

**Validation**
- Typecheck/lint/build; targeted query-key/invalidation tests; static search for duplicate key definitions and direct invalidation literals; manually test milk create/edit/delete and production-save history refresh.

### Phase 1 — Canonical domain types and pure shared helpers
**Task:** REF-010A (add a child task before implementation if tracker granularity requires it)  
**Dependencies:** REF-009  
**Risk:** Low–medium.

**Scope**
- Consolidate duplicate `MilkPoolShiftFatRecord` after confirming all imports/shapes.
- Move canonical shift/pricing aliases away from list-query utility modules when that removes a real domain dependency; retain `MilkEntry`, `MilkEntryListRow` and `CustomerEntry` where projections genuinely differ.
- Evaluate `CustomerOption` vs `DashboardCustomer`; merge only if semantics and nullability match.
- Keep buffalo and customer payment method types separate until DB enums/check constraints and domain semantics prove they are identical.
- Audit date helper duplicates against Asia/Kolkata business-date behavior before consolidation.
- Split mixed `src/lib/milk-entry-list.ts` only at meaningful boundaries (domain types, pure filter/date/URL helpers, data reads).

**Acceptance**
- One canonical definition for genuinely identical domain values, no broken route/service imports, no semantic type merging based solely on similar literal values.
- Date-only/timezone behavior unchanged.

**Validation**
- Typecheck/build/lint, import search, unit tests for pure date/filter/URL helpers if test infrastructure can be established without expanding scope.

### Phase 2 — Read-only dashboard, analytics and financial-report query boundaries
**Task:** REF-010B  
**Dependencies:** REF-009; Phase 1 only where a shared type is required  
**Risk:** Medium; avoid transaction writes in this phase.

**Scope**
- Extract typed services and query hooks for dashboard, sales analytics, production analytics and financial reports.
- Replace effect-driven remote reads with query-backed loading/error/refetch state.
- Preserve selected date ranges, Asia/Kolkata business-date rules, existing server-side aggregation RPCs, report labels and separation of sales vs collections, operating expenses vs dated payments, asset acquisitions/sales and legacy undated amounts.
- Do not label current financial reconciliation as net profit; feed-consumption cost remains excluded unless a separate requirement is approved.

**Acceptance**
- Pages are thin orchestrators; no direct Supabase read/RPC calls in migrated route/UI components.
- Loading/error/empty states are distinct and retries are safe because these are reads.
- Query keys include selected date range and any other inputs.

**Validation**
- Typecheck/lint/build; compare current and refactored output for known date ranges and empty periods; verify report values against the same RPCs and ensure no aggregation moves to client-side row fetching.

### Phase 3 — Feed inventory reads and feed master boundaries
**Task:** REF-010C  
**Dependencies:** Phase 0  
**Risk:** Medium–high due to operational stock visibility.

**Scope**
- Move feed inventory stock and movement reads, plus feed-item master reads, into typed services and query hooks.
- Keep stock derived from `feed_inventory_movements`; preserve independent stock/movement loading, errors and retry controls.
- Preserve server-side movement pagination and filter reset/clamp behavior.
- Invalidate item selectors, inventory labels, purchases, consumption, diet plans and feed-cost analytics after feed-item updates where applicable.

**Acceptance**
- No route-owned Supabase reads for migrated screens; stock is never independently mutated in UI.
- Pagination/filter/page-size are part of keys; filter changes reset/clamp pages; empty results are not treated as errors.

**Validation**
- Typecheck/lint/build; manual checks for stock, movement pagination, filters, insufficient stock errors, item activation and empty/error recovery.

### Phase 4 — Expense read/write boundaries and payment refresh
**Task:** REF-010D  
**Dependencies:** Phase 0  
**Risk:** High; payment/expense liability ledger.

**Scope**
- Extract expense list/history/detail/category/vendor reads and writes into typed feature services/query/mutation hooks.
- Move `record_expense_payment` invocation out of `src/app/(protected)/expenses/history/[id]/page.tsx` without changing RPC arguments or atomic balance checks.
- Preserve feed-purchase linked-expense edit/delete guards, dated payment ledger behavior, URL-backed server pagination, expense lock states, vendor/category summaries and legacy undated paid amounts.
- Invalidate expense list/detail, payment history, vendor/category summaries, feed purchase linkage where relevant, financial report and dashboard families.
- Treat uncertain payment outcomes as reconciliation/reload, not blind repeat. Evaluate request idempotency consistently before changing payment contracts.

**Acceptance**
- No direct DB access in migrated expense routes; no way to bypass ledger/linked-purchase guards; success feedback only after RPC success.
- Paid and pending balances reconcile to payment history, with legacy paid totals separately preserved.

**Validation**
- Typecheck/lint/build; test paid/partial/credit, full settlement, overpayment, payment failure, linked feed purchase locks, delete restrictions, pagination and report refresh.

### Phase 5 — Feed purchase read boundaries, then transaction-preserving mutation hooks
**Task:** REF-010E  
**Dependencies:** Phases 0 and 3; Phase 4 for linked-expense invalidation contract  
**Risk:** Very high.

**Scope**
- Move purchase list/detail/reference-data reads into query hooks; route pages become orchestration only.
- Keep create/edit/delete RPC calls and transaction semantics unchanged.
- Preserve request-key lifecycle: same intent/retry uses same idempotency key; new purchase gets a new key.
- Preserve purchase + expense + stock-in atomicity, uniqueness constraints, linked expense lock, paid-history correction lock, and “cannot correct if later stock has been consumed/adjusted” behavior.
- Invalidate purchase/detail, expense, stock/movements, vendor and financial/feed-cost views only after committed success.

**Acceptance**
- A retry cannot create a second purchase/expense/stock-in; posted purchase changes still go through guarded RPCs; no UI path directly writes ledger tables.

**Validation**
- Typecheck/lint/build; test same-key replay, new-key create, RPC failure, paid purchase lock, later consumption lock, successful correction, stock/expense reconciliation and report refresh.

### Phase 6 — Feed consumption read boundaries and mutation hooks
**Task:** REF-010F  
**Dependencies:** Phases 0 and 3; Phase 5 transaction contract  
**Risk:** Very high.

**Scope**
- Move consumption history/form reference reads into query hooks; route components must not directly query movement tables.
- Preserve RPC create/edit/delete, stock and date guards, weighted-average applied-cost snapshots, append-only reversal movements and later-activity locks.
- Map linked diet-plan runs and consumption-cost analytics; never trigger a scheduled run from cache refresh.
- Invalidate stock, movements, consumption history, cost summaries and linked run state only after successful writes.

**Acceptance**
- Quantity/value ledger reconciliation holds after create/edit/delete; no negative stock; no blind automatic retries; UI never presents a failed RPC as committed.

**Validation**
- Typecheck/lint/build; test insufficient stock, same-day edit, blocked backdated edit, later movement lock, reversal cost, delete/reload and concurrent consumption on disposable DB.

### Phase 7 — Diet plans and scheduler last
**Task:** REF-010G  
**Dependencies:** Phases 0, 3, 5 and 6  
**Risk:** Highest due to scheduled stock posting.

**Scope**
- Move diet-plan list/detail and scheduler run/settings reads to query hooks; route components remain thin.
- Keep schedule-setting validation, Asia/Kolkata timezone, run uniqueness, plan/quantity/buffalo snapshots, status transitions, transaction-per-run posting and explicit FAILED-only retry.
- Refresh run status, stock, movements and applied cost after an actual post; never auto-retry a posting or infer success from a queued request.
- Verify scheduler/cron deployment separately in the user's environment.

**Acceptance**
- One occurrence per plan/date/shift; each run posts movements once; retry is explicit, guarded and server-validated; failure leaves no partial inventory posting.

**Validation**
- Typecheck/lint/build; test plan edits after snapshot, no eligible buffaloes, insufficient stock, missed slot, overlapping processor calls, explicit retry and repeated retry click in a disposable environment.

### Phase 8 — Buffalo lifecycle/acquisition/sale and customer payment boundaries
**Task:** REF-011A  
**Dependencies:** Phase 0; phases 1–2 for shared/report contracts  
**Risk:** High.

**Scope**
- Complete typed query/mutation boundaries for buffalo acquisition, payment, lifecycle, sale/disposal and customer payment modules.
- Preserve row locks, balance checks, lifecycle/status history, immutable IDs, acquisition cost distinction, sale payment ledger and historical payment backfill semantics.
- Decide whether request-key idempotency is needed for customer/buffalo/expense payment RPCs based on a common policy; do not add partial ad hoc idempotency in only one route.
- Invalidate buffalo detail/payment/status/production eligibility, customer detail/directory financial summaries, acquisition/sale reports and balance snapshots as applicable.

**Acceptance**
- Payments never exceed pending balances under concurrency; repeated uncertain requests have an explicit reconciliation path; terminal buffalo state cannot be bypassed.

**Validation**
- Typecheck/lint/build; lifecycle and payment regression tests; concurrency/idempotency tests on a disposable DB; reconcile asset acquisition/sale reports against source ledgers.

### Phase 9 — Final architecture and security regression
**Task:** REF-012  
**Dependencies:** All implementation phases completed.

**Scope**
- Repository-wide searches for Supabase access in route/UI components, duplicated query keys/types/helpers, effect-driven remote reads, unsafe automatic retries, missing invalidations, local pagination over full datasets and ledger writes outside approved RPC boundaries.
- Review migration sequence, RPC signatures, RLS/grants/triggers, and generated types where present.
- Record exceptions that are intentional and explain why.

**Acceptance**
- No unresolved high-severity integrity issues; remaining direct data-access/effect patterns have a documented exception or pending task.
- Complete regression evidence and a concise handoff for the user.

**Validation**
- Full lint, typecheck, build and tests; browser/manual workflows; disposable Supabase migration/RLS/RPC tests; data reconciliation queries. Clearly separate anything the environment could not run.

## Cross-domain invalidation contract (initial matrix)

| Successful mutation | Query families to invalidate |
|---|---|
| Milk entry create/update/delete | Milk entries; duplicate/customer/date/shift context; old/new customer directory/detail; pool shift context/reconciliation; sales/financial aggregates |
| Production save | Production sheet/range/history; canonical buffalo detail production history; pooled fat; milk pool context/reconciliation; dashboard/production analytics |
| Customer payment/pricing/activation | Customer directory/detail/payment/financial summary; milk customer options/pricing lookup; financial report/balance snapshot as applicable |
| Buffalo acquisition/payment/status/sale/disposal | Buffalo directory/detail/purchase/payment/status/sale/disposal; production eligibility/history when status/date affects it; acquisition/sale/balance reports |
| Expense create/update/delete/payment | Expense list/detail/payment, category/vendor summaries, feed purchase linkage, financial reports/dashboard |
| Feed purchase create/edit/delete | Purchase list/detail; linked expense; stock/movements; vendor summaries; feed-cost and financial reports |
| Feed consumption create/edit/delete | Consumption list/detail; stock/movements; applied cost; linked diet run only if the transaction is explicitly run-backed; analytics |
| Feed item update/activation | Item master/selectors; purchase/consumption forms; diet plan item choices; inventory labels |
| Diet plan/save/scheduler retry | Plan list/detail, run history/settings; stock/movements/cost only after confirmed posting; dashboard/analytics as applicable |

This matrix is a starting implementation contract; confirm exact existing key factories and data dependencies while implementing each phase. Never invalidate globally as a substitute for understanding the dependency.

## Task tracker dependency updates

- REF-001–REF-008 are complete as standards, static audits and planning artifacts; no application source refactor has yet been implemented.
- REF-009 is the first code task.
- REF-010 should be split into the module phases above as separate tasks or commits; do not attempt all modules in one implementation pass.
- REF-011 covers remaining modules one module at a time after shared conventions.
- REF-012 is the final repository-wide regression audit.

## Validation boundary

This is a dependency-aware plan derived from static GitHub inspection. It is not proof that existing app behavior passes runtime checks. Local build, lint, typecheck, tests, live database/RLS checks, concurrency tests and scheduler verification remain outstanding because no local checkout or live DB session was available.
