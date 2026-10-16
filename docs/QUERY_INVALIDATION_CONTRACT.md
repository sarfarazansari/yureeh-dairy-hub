# Query-Key Ownership and Mutation Invalidation Contract

Task: `REF-009`  
Branch: `feature/refactor-engineering-standards`  
Status: Partially implemented; local validation and full mutation coverage pending  
Date: 2026-10-16

## Ownership

- Customer keys are owned by `src/features/customers/customer.query-keys.ts`. Both customer query hooks and cross-feature invalidators import this key-only module; they should not import another feature's query-hook module just to reference a key.
- Buffalo production keys are owned by `src/features/buffalo-production/buffalo-production.query-keys.ts`. Production query hooks and buffalo detail production-history query use the same `buffaloProductionQueryKeys.history(buffaloId)` key.
- Milk keys remain owned by `src/features/milk/milk.queries.ts`. Existing keys continue to include filters, pagination, customer ID, business date, shift and date ranges where those inputs change results.

## Implemented invalidation rules

| Successful mutation | Invalidated keys | Reason |
|---|---|---|
| Milk entry create | `milkQueryKeys.all`, `customerQueryKeys.directory()`, `customerQueryKeys.details()` | Refresh entry/pool-derived data and customer totals. |
| Milk entry update | Same as create | Customer can change, so invalidate all cached customer detail/payment descendants rather than only the new customer ID; this also refreshes the previous customer's summary. |
| Milk entry delete | Same as create | Refresh customer directory and all cached customer details after a delivery is removed. |
| Manual milk-pool movement | `milkQueryKeys.all` only | Refresh pool/reconciliation/context without invalidating unrelated customer summaries. |
| Buffalo production save | `buffaloProductionQueryKeys.all`, `milkQueryKeys.all`, `['dashboard']`, `['sales-analytics']`, `['financial-reports']` | Refresh production views/history, milk pool-dependent views and report/dashboard aggregates. The buffalo detail history now uses the same canonical production history key. |
| Customer payment/pricing/activation | Customer directory/detail/payment prefixes, `['milk']`, `['dashboard']`, `['financial-reports']` as applicable | Refresh customer balance, pricing lookup and report/dashboard projections. |
| Buffalo acquisition/status/sale/payment/disposal | Buffalo query root, production query root, `['dashboard']`, `['financial-reports']` | Refresh lifecycle/payment views, production eligibility/history and balance/report projections. |
| Feed-item create/update/activation | Feed-item, inventory, purchase, consumption, diet-plan, feed-cost, dashboard and financial-report roots | Refresh item selectors and views derived from item labels, unit conversions or active status. |
| Feed purchase create/edit/delete | Purchase archive/detail, feed inventory, expense, vendor, dashboard and financial-report roots | Refresh stock, linked expense/payment status, supplier summaries and reports only after successful RPC completion. |
| Feed consumption create/edit/delete | Consumption archive/detail, feed inventory, diet-plan, feed-cost, dashboard and financial-report roots | Refresh stock and applied-cost consumers after successful RPC completion; no automatic retry. |
| Diet plan save | Diet-plan and feed-item query roots | Refresh plan lists/details and selectors; this does not imply that a scheduler run posted stock. |
| Expense payment | Expense detail/list/dashboard, vendor/category, linked feed-purchase, dashboard and financial-report roots | Refresh dated payment ledger and balances after the payment RPC succeeds. |

Invalidation occurs only in mutation `onSuccess`, after the service/RPC resolves successfully. No optimistic ledger updates or automatic mutation retries were added.

## Follow-up rules for later refactor phases

- Extend this table as each feature is migrated; include list, detail, payment, inventory movement, report and dashboard dependents where they consume changed data.
- Prefer invalidating a feature's explicit root or known prefixes over clearing the entire query cache.
- For customer detail/payment descendants, use `customerQueryKeys.details()` when the prior customer ID is not available (such as milk-entry deletion or reassignment). It is a deliberate bounded prefix, not a global cache invalidation.
- Keep every result-changing input in the query key, including filters, date ranges, shift, ID, sort and pagination.
- Do not add automatic retries to payment, purchase, inventory, consumption or scheduler writes. A mutation failure must not trigger invalidation as if the transaction committed.
- Preserve PostgreSQL RPC transaction boundaries and database constraints; cache invalidation does not replace transactional integrity.
- On auth/account changes, separately verify query-cache lifecycle and user/farm isolation before claiming that stale cache cannot cross identities.

## Coverage and validation boundary

The rules above describe implemented invalidation hooks for the migrated paths, not proof that every mutation in the repository is covered. Expense history/new/category/vendor reads and writes now have query/mutation boundaries; scheduler run/retry paths are migrated but still need live/disposable database verification. Some of the dependent query roots are placeholders for the corresponding future query-backed modules; invalidating a root does not replace migrating an effect-driven consumer to TanStack Query.

Remote GitHub read-back confirms the intended source edits and shared key usage. No local checkout was available, so TypeScript, lint, format check, build, automated tests, browser regression, account-switch cache isolation, live/disposable Supabase RPC/RLS/concurrency checks were not run. REF-009 remains In Progress until those checks pass.
