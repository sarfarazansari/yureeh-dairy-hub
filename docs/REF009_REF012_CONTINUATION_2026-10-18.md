# REF-009–REF-012 Continuation Audit — 2026-10-18

Repository: https://github.com/sarfarazansari/yureeh-dairy-hub  
Execution branch: `feature/feature-folder-structure-foundation`  
Base branch: `master`  
Mode: GitHub source read-back and static inspection only

## Result

The previous static audit and its source edits are present on the execution branch. This continuation re-read the current query provider, query-key factories, and representative query/mutation modules for buffaloes, customers, milk, expenses, feed items, feed inventory, feed purchases, feed consumption, and diet plans.

This is **not a merge-ready or fully completed REF-012 result**. No local checkout could be obtained in this execution environment because GitHub hostname resolution failed for `git clone`. The repository has no recent GitHub Actions workflow runs for this branch, so no remote CI evidence is available.

## Source checks re-confirmed

- `QueryProvider` clears the in-memory QueryClient when the observed authenticated user ID changes. This is a source-level guard only; browser account-switch and farm-isolation behavior remains untested.
- Customer query keys are centrally owned by `src/features/customers/customer.query-keys.ts`; milk-entry create/update/delete invalidates customer directory/detail descendants as well as milk and reporting roots.
- Buffalo query keys are centrally owned by `src/features/buffaloes/buffalo.query-keys.ts`; the shared buffalo mutation helper invalidates buffalo, production, diet-plan, expense, dashboard and financial-report roots.
- Feed purchase mutations invalidate purchase, inventory, expense, vendor/category, feed-cost, dashboard and report roots only after successful mutation completion.
- Feed consumption mutations invalidate consumption, inventory, diet-plan, feed-cost, dashboard and report roots only after successful mutation completion.
- Diet-plan save invalidates plan and schedule/run-history query families. Explicit scheduler retry checks for `FAILED` status in the client and invalidates downstream consumption/inventory/cost/report/dashboard queries after RPC success. The database remains the authority for enforcing concurrency and retry invariants.
- Expense detail reads combine the expense and payment ledger; successful payment mutation invalidates expense descendants and dependent vendor/category/feed-purchase/report/dashboard roots.
- Legacy type/schema/list compatibility facades are intentionally retained. This remote inspection cannot prove their full consumer graph without repository-wide compiler-backed search and typecheck.

## Not verified — do not mark passed

1. TypeScript typecheck, ESLint, Prettier check, and Next.js production build.
2. Browser workflows for customer reassignment, buffalo lifecycle/payment, expense payment/edit/delete, purchase replay/idempotency, consumption reversal/cost stability, and scheduler retry.
3. Account sign-out/sign-in and farm/user isolation with a live browser session.
4. Supabase migration parity, deployed RLS/grants/function ownership, cross-farm access, and transaction/concurrency behavior.
5. Database reconciliation for milk pool/delivery, buffalo payments, feed purchase → expense → stock-in exactly once, consumption reversal/cost stability, and scheduler atomic posting.
6. Full import/consumer graph for compatibility facades and all duplicate helper/key candidates.

## Next execution required

Run from a local checkout of this branch:

```sh
npm ci
npm run typecheck
npm run lint
npm run format:check
npm run build
```

Then execute the targeted browser and disposable-Supabase scenarios documented in `docs/REFACTORING_TRANSACTION_INTEGRITY_AUDIT.md` and `docs/REFACTORING_IMPLEMENTATION_ROADMAP.md`. Fix any failures on this same branch, rerun the checks, and only then consider REF-012 complete.

## Branch policy

No PR or merge was created. No database migration or production data was changed by this continuation. The user retains PR and merge ownership.
