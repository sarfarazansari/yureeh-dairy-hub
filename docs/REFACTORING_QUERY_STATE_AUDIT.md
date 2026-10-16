# TanStack Query and State Ownership Audit

Audit task: `REF-003`  
Branch: `feature/refactor-engineering-standards`  
Base: `master` at `6e5c6ae9916a42d61266c80db1c0bcf10a447ba9`  
Date: 2026-10-16  
Method: static source inspection through GitHub file reads; no local checkout/runtime.

## Executive summary

TanStack Query is present and useful in buffalo, buffalo production, customer, and milk features, but the query/cache boundary is not yet canonical across the application. The most actionable issues are cross-feature invalidation gaps, duplicate query-key ownership for the same production history, a component-owned acquisition-cost query/mutation, and server-backed data still loaded into local state in dashboard/analytics/expenses/feed/report screens.

No Zustand store or dependency was found in the inventory. Do not add one to solve server-state duplication; TanStack Query is the intended server cache.

## Findings and priorities

### P0 — Correctness: milk writes do not invalidate customer summaries

**Evidence**
- `src/features/milk/milk.queries.ts`: `useCreateMilkEntryMutation`, `useUpdateMilkEntryMutation`, and `useDeleteMilkEntryMutation` invalidate only `milkQueryKeys.all`.
- `src/features/customers/customer.queries.ts`: `customerQueryKeys.directory()` and `customerQueryKeys.detail(customerId)` hold customer directory/detail results.
- `src/features/customers/services/customer.service.ts`: `getCustomerDirectory` calculates totals from `get_customer_directory_summaries`; `getCustomerDetails` includes milk entries and `get_customer_financial_summary`.

**Risk**
After a milk entry is created, edited, or deleted, customer detail and directory totals can remain stale if their cached queries are still mounted/reused. This is a confirmed missing cache dependency in the query layer.

**Follow-up**
When mutation hooks are standardized, invalidate affected customer directory and detail queries after successful milk-entry writes. Prefer a documented cross-feature invalidation helper or explicit query-key dependency; avoid circular imports between feature query modules.

### P0 — Correctness: production history has two query-key owners

**Evidence**
- `src/features/buffaloes/hooks/use-buffaloes.ts`: `buffaloKeys.production(buffaloId)` is under `['buffaloes', 'production', buffaloId]`; `useBuffaloProductionHistory` uses it.
- `src/features/buffalo-production/buffalo-production.queries.ts`: `buffaloProductionQueryKeys.history(buffaloId)` is under `['buffalo-production', 'history', buffaloId]`.
- `useSaveProductionSheetMutation` invalidates `buffaloProductionQueryKeys.all` and `milkQueryKeys.all`, but not `buffaloKeys.production`.

**Risk**
The buffalo detail production-history query can remain stale after a production-sheet save. The same domain resource is represented by two unrelated query-key trees, so invalidation is easy to miss.

**Follow-up**
Make buffalo production the canonical owner of production-history query keys and hooks, or define one shared key contract. Migrate consumers in a small step and invalidate legacy keys during transition; do not merely add a second broad invalidation and leave duplicate ownership indefinitely.

### P1 — Cross-domain invalidation is incomplete or not explicit

**Evidence**
- `src/features/buffaloes/hooks/use-buffaloes.ts`: the shared `useBuffaloMutation` invalidates only `buffaloKeys.all`, including purchase/payment, status, sale/payment and disposal mutations.
- `src/features/buffalo-production/buffalo-production.queries.ts`: production save invalidates production and milk roots only.
- `src/features/customers/customer.queries.ts`: customer payment invalidates detail and directory; pricing/activation invalidate customer root and milk root.
- `src/features/dashboard.tsx`, `src/features/analytics/SalesAnalyticsPage.tsx`, `src/features/buffalo-production/BuffaloAnalyticsPage.tsx`, and `src/app/(protected)/financial-reports/page.tsx` load remote data using effects/local state rather than query-backed cache keys.

**Risk**
Current query invalidation cannot refresh effect-owned data through TanStack Query. As those screens migrate, dependencies from buffalo lifecycle/purchase/sale, customer payments, production and milk transactions to financial/dashboard/analytics summaries must be captured explicitly. Today this is an architectural consistency gap; whether a given screen looks stale depends on its mount/refetch lifecycle.

**Follow-up**
Create a domain dependency matrix in REF-006/REF-007 before centralizing invalidation. Include at minimum:
- Milk entry create/update/delete → milk lists/pool where applicable + customer detail/directory totals + sales/dashboard analytics.
- Production save → production sheet/range/history + buffalo detail history + milk-pool context/reconciliation/fat where affected + production analytics/dashboard.
- Customer payment → customer detail/directory financial totals + any finance summary consuming customer receipts.
- Buffalo purchase/payment/status/sale/disposal → buffalo detail/directory/payment/lifecycle/sales caches and any reports that include those transactions.
- Feed purchase/consumption/payment/plan run → purchase/expense, stock/movement, consumption/cost, dashboard/report caches, preserving transactional RPCs.

### P1 — Acquisition-cost component owns data access and query keys

**Evidence**
- `src/features/buffaloes/components/BuffaloAcquisitionCostPanel.tsx` defines `useQuery` for acquisition costs and eligible expenses, direct Supabase reads, a direct RPC mutation, and inline keys `['buffalo-acquisition-costs', buffaloId]` / `['buffalo-acquisition-cost-expenses', buffaloId]`.

**Risk**
This bypasses the feature service/query ownership pattern and makes invalidation/testing conventions inconsistent. The RPC itself should remain atomic; this finding is about the client boundary, not a recommendation to replace the RPC.

**Follow-up**
Extract typed service functions and feature-owned query-key factory/hooks. Keep form inputs/toast state local. Preserve the existing RPC and expense exclusion/double-counting invariant.

### P1 — Query-key conventions are inconsistent

**Evidence**
- Buffalo: `src/features/buffaloes/hooks/use-buffaloes.ts` defines a private `buffaloKeys` object inside a hook file.
- Production: `src/features/buffalo-production/buffalo-production.queries.ts` exports `buffaloProductionQueryKeys`.
- Customers: `src/features/customers/customer.queries.ts` exports `customerQueryKeys`.
- Milk: `src/features/milk/milk.queries.ts` exports `milkQueryKeys`.
- Acquisition costs use literal arrays inside a UI component.

**Assessment**
The existing filter/pagination keys generally include the inputs that affect the result: milk keys include filters and pagination; sales archive includes page, page size and filters; production includes date/shift; pool reports include date range; customer/buffalo detail includes IDs. Object-valued filter keys are acceptable with TanStack Query's deterministic key hashing, provided values remain serializable and normalized.

**Follow-up**
Adopt a consistent feature-owned `queries/` or established `*.queries.ts` convention without moving files solely for aesthetics. Export key factories and query options from the owning feature; avoid direct literal keys in components. Normalize optional filters and include every result-affecting input.

### P1 — Auth/session lifecycle is not represented in query defaults

**Evidence**
- `src/components/providers/QueryProvider.tsx` creates one QueryClient for the browser session, sets a 30-second query stale time and `refetchOnWindowFocus: true`, but has no explicit query-cache cleanup policy.
- The inventory found many query keys scoped by entity or feature, not by authenticated user/farm.
- `src/app/auth-gate.tsx` owns auth session/subscription lifecycle.

**Risk / confidence**
This is a risk to validate, not proof of cross-user data exposure. If the same browser QueryClient survives sign-out/sign-in and an equivalent key is reused, cached data could remain visible until a refetch or cache removal. RLS still protects database requests but does not itself clear client cache.

**Follow-up**
Inspect provider/auth-gate placement and sign-out transitions. On auth identity changes, clear/remove user-scoped cached queries or use a session-aware query-client lifecycle. Do not put secrets or sensitive values in keys. Add a regression checklist for switching accounts in the same tab.

### P2 — Provider policy is implicit

**Evidence**
- `src/components/providers/QueryProvider.tsx`: query stale time is 30 seconds and focus refetch is enabled; no explicit `retry`, `gcTime`, or shared error policy is set.

**Assessment**
TanStack Query defaults currently govern query retry and mutation retry behavior. The default mutation retry behavior is conservative, but the intended policy should be explicit and documented before global changes. Avoid blanket retries for non-idempotent financial/inventory mutations; keep read-query retries distinct from mutation policy.

**Follow-up**
Document query defaults after module migrations expose real freshness needs. Do not change global retry/freshness settings as a cosmetic refactor; use per-query stale times for genuinely different freshness requirements.

### P2 — Server state is stored in component state outside query hooks

**Evidence**
- `src/features/dashboard.tsx` uses effects/local loading and data state around `getDashboardData`.
- `src/features/analytics/SalesAnalyticsPage.tsx` uses effects/local state around `getSalesAnalyticsData`.
- `src/features/buffalo-production/BuffaloAnalyticsPage.tsx` loads production analytics via effects/local state.
- Expenses and feed list/form/scheduler pages identified in `docs/REFACTORING_API_INVENTORY.md` similarly use effects/local state for remote reads.

**Risk**
Duplicate loading/error/cache behavior and repeated requests; mutations cannot invalidate these results consistently through TanStack Query. This does not mean every effect is wrong: auth subscriptions, timers, imperative UI synchronization and local pagination clamping remain valid effect use cases.

**Follow-up**
Migrate one module at a time after REF-004/REF-005; keep UI-owned form, dialog, date picker and debounced search state local. Use query state for remote records/loading/error and query keys that include filters/date range/page.

## Existing strengths to preserve

- Query hooks generally call typed feature service functions.
- Milk query keys include filters and pagination; production keys include date/shift; sales archive keys include pagination and filters.
- Mutations are defined in query-hook modules for the main buffalo/customer/milk/production features.
- Production save and milk entry writes continue to use service functions backed by RPCs; do not replace transaction-critical RPCs with multiple client writes.
- No Zustand store was found. No new client store is recommended for server data.
- Loading/error/empty states exist in several query consumers; retain them as pages migrate.

## Recommended dependency-aware sequence

1. **REF-004:** map feature/module boundaries and canonical types/services; include query ownership in the map.
2. **REF-005:** define the server-read/effect migration pattern and explicitly classify valid UI/auth effects.
3. **REF-006:** produce the mutation invalidation matrix, duplicate-submission/error/loading/pagination audit.
4. **REF-007:** trace transaction integrity across milk, feed/expense/inventory and buffalo finance before implementing cross-domain cache changes.
5. **REF-008:** finalize ordered implementation phases and acceptance criteria.
6. Only then implement shared query conventions and the first feature migration; test the two concrete stale-cache cases above.

## Validation boundary

- Executed: remote branch comparison confirmed `feature/refactor-engineering-standards` is 4 commits ahead of `master` and 0 behind; latest master remains `6e5c6ae9916a42d61266c80db1c0bcf10a447ba9`.
- Executed: read back QueryProvider, buffalo/customer/milk/production query modules, acquisition-cost component, buffalo-sales consumer, relevant services, package scripts, and the inventory/tracker.
- Static review only: query-key and invalidation analysis.
- Not run: local build, lint, typecheck, unit tests, browser/runtime checks, account-switching checks, Supabase migrations or database operations. A local checkout was unavailable in this session.
