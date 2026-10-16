# Yureeh Dairy Hub — Engineering Rules and Handoff

Last updated: 2026-10-06

## Project context

Repository: https://github.com/sarfarazansari/yureeh-dairy-hub  
Default branch: `master`  
Current work branch at handoff: `feature/buffalo-domain-audit`

Yureeh Dairy Hub is a practical dairy-farm operations app built with Next.js App Router, TypeScript, React, Supabase/PostgreSQL, RLS, React Hook Form, Zod, and TanStack Query.

## Non-negotiable workflow rules

1. **Always start new feature work from the latest `master`.** First inspect/fetch the latest master, then create a dedicated feature branch from master. Never base the next module's branch on an older feature branch.
2. The user owns raising and merging PRs. Do not raise, finalize, or merge a PR unless explicitly asked.
3. The user tests the working branch locally before PR. When they report issues, fix them on that same feature branch and ask them to retest. Do not merge on their behalf.
4. Before implementing a module, inspect the existing code and all relevant Supabase migrations. Treat migrations and database constraints as the source of truth for persistence behavior.
5. For audit-only requests, document findings first and do not change code until asked.
6. Make complete, production-safe data-flow changes, not UI-only patches. Use migrations for schema changes.
7. Prefer pragmatic, understandable designs over overengineering. Reuse established project patterns; keep components and files focused, concise, and readable.
8. Use appropriate schema validation, database constraints, transactional RPCs where atomicity matters, RLS/ownership checks, and TanStack Query invalidation.
9. Before handing work to the user, statically validate the full integration: route files, imports, component props, service and RPC signatures, migration ordering, foreign-key uniqueness requirements, RLS paths, enum/check compatibility, backfill safety, query keys/invalidation, and cross-module references.
10. Be explicit about verification boundaries. Do not claim tests were run unless they were actually run. GitHub inspection/static review is not equivalent to running the local app or applying migrations to the user's Supabase database.
11. Keep URLs based on immutable database IDs, not mutable business/display codes.
12. Do not invent domain facts. Ask only when an unknown decision materially affects correctness; otherwise use sensible, clearly stated assumptions.

## Domain modeling principles

Classify each real-world event correctly before deciding fields or screens:
- Master/reference data
- Transaction/acquisition
- Payment or payment ledger
- Inventory movement/consumption/adjustment
- Operational event or lifecycle history
- Derived report/analytics

Avoid treating every module as generic CRUD. Model the real workflow and preserve audit history where financial or lifecycle integrity matters.

## Current architecture and module notes

### Existing modules
- Dashboard and analytics: derived/reporting views.
- Buffalo management and acquisition/purchase.
- Buffalo milk production by buffalo + business date + shift.
- Milk sales/collection entries linked to customers, with historical applied pricing.
- Customers and customer rate history.
- Expenses, categories, and vendors.
- Authentication and user/farm isolation via RLS.

### Important data boundaries
- Buffalo purchase/acquisition is a transaction; the buffalo profile is master data.
- Purchase price and later acquisition-related costs such as freight are distinct concepts.
- Buffalo production is not the same thing as milk sold to customers.
- Expense payment totals/statuses must reconcile with recorded amounts.
- Inventory must be modeled through stock movements, consumption, and adjustments rather than merely adding stock fields to expenses.
- Legacy `buffalo_daily_performance` exists alongside normalized `buffalo_milk_production`; preserve and understand historical data before changing or removing it.

## Buffalo management work completed on `feature/buffalo-domain-audit`

Implemented work includes:
- Buffalo profile editing.
- Purchase transaction editing with safeguards against setting purchase price below amounts already paid.
- Vendor editing (vendor is a shared master; edits affect other records using that vendor).
- Buffalo purchase payment ledger and `record_buffalo_purchase_payment` RPC.
- Buffalo status/lifecycle history and `change_buffalo_status` RPC.
- Historical payment backfill without inventing installment splits; legacy initial payment method is recorded as `OTHER` when the original method was not captured.
- TanStack Query provider and buffalo hooks.
- Buffalo detail view for profile, purchase/vendor, payment history, status history, and production summary.
- Immutable-ID detail routing: `/buffaloes/[id]`, so changing a buffalo code does not break its URL.
- A fix to the Herd Overview Edit link so it uses `buffalo.id`, not `buffalo.buffalo_code`.

Relevant route:
`src/app/(protected)/buffaloes/[id]/page.tsx`

The detail route uses `useParams<{ id: string }>()` and passes the UUID to `BuffaloDetailPage`. The old `[code]` route was removed. The Herd Overview name and Edit links should both use `/buffaloes/${buffalo.id}`.

Latest known fix commit:
`72be8a5ce4c651b4996d67ae823e6b748a67dc01` — `fix(buffaloes): use immutable ID for edit link`.

The user reported the route works after checking local files, pulling the branch, and restarting the dev server. User will raise the PR and merge into master themselves. Do not create or merge a PR on their behalf.

## Next planned module: Milk Production deep-dive

Start with domain discovery, not immediate coding. Trace the full workflow:

**Buffalo → Milk Production → Farm Milk Pool → Milk Sales / Customer Delivery**

Inspect at minimum:
- `supabase/migrations/20261001130000_buffalo_shift_production.sql`
- `src/features/buffalo-production/BuffaloAnalyticsPage.tsx`
- `src/features/buffalo-production/DailyPerformancePage.tsx`
- `src/features/buffalo-production/services/buffalo-production.service.ts`
- All references to `buffalo_milk_production`
- `save_buffalo_milk_production` RPC and related migrations
- Legacy `buffalo_daily_performance` and migration/backfill logic
- Milk sales/collection entries and their relationship (or lack of relationship) to production
- Dashboard and analytics dependencies

Determine how the real farm handles collected milk, household/customer deliveries, unsold milk, spoilage, and reconciliation before proposing a model. Decide whether the app needs individual-animal production only, a farm-level milk pool/inventory, or both as separate but reconcilable records. Do not assume that production automatically equals milk available for sale or milk sold.

First produce a module-level current-state map and gap analysis. Make changes only after the workflow and design are agreed or the user explicitly asks for implementation.

## Handoff prompt for a new conversation

Continue work on the Yureeh Dairy Hub repository: https://github.com/sarfarazansari/yureeh-dairy-hub.

Read `docs/WORKFLOW_AND_HANDOFF.md` and `YUREEH_PROJECT_RULES.md` first, then inspect the latest repository state. The user is handling the PR and merge for `feature/buffalo-domain-audit` themselves. Do not raise or merge a PR.

Before starting new work, use the latest `master` as the base and create a fresh feature branch from it; never branch the next module from the previous feature branch. The next task is a deep audit of Milk Production and its real-world flow into farm milk pool and milk sales/customer delivery. Inspect migrations and all relevant code first, map the current implementation, and identify domain gaps before editing. Follow the engineering and testing rules in this document. Be transparent about which checks are static versus actually executed.


## Refactoring workflow (permanent)

Read these documents at the start of every refactoring session, in this order:
1. `YUREEH_PROJECT_RULES.md`
2. `docs/WORKFLOW_AND_HANDOFF.md`
3. `docs/REFACTORING_ARCHITECTURE.md`
4. `docs/REFACTORING_TASKS.md`

### Single-command continuation

The user's short command `1 refactor karo` means:
- Inspect latest remote `master`; create a fresh feature branch from it, never from an old feature branch.
- Select the highest-priority Pending task whose dependencies are Completed.
- Inspect all relevant source, migrations, RPCs, RLS and downstream consumers before changing code.
- Complete one coherent task, run relevant checks, and update the task tracker with evidence.
- Record branch, changed files, checks, limitations, blockers and next task in the tracker/handoff.
- Do not ask the user to repeat established requirements.
- Do not create a PR or merge; the user owns those actions.
- Do not claim local tests/builds or remote database operations that were not actually run.

### Current refactoring state

- Planning/standards branch: `feature/refactor-engineering-standards`
- Architecture standard: `docs/REFACTORING_ARCHITECTURE.md`
- Task tracker: `docs/REFACTORING_TASKS.md`
- Completed static source inventory: `docs/REFACTORING_API_INVENTORY.md`
- `REF-001` (permanent standards/workflow) and `REF-002` (path-level API/query/effect inventory) are Completed.
- Next task: `REF-003` — audit TanStack Query infrastructure, server/client state ownership, query-key conventions and cache invalidation, with findings backed by source paths.
- Audit snapshot is based on latest master commit `6e5c6ae9916a42d61266c80db1c0bcf10a447ba9`; the named branch was rebased onto this latest master base before continuing.
- The inventory is a static source review; build, lint, typecheck, tests and runtime checks have not been executed in a local checkout.
- Do not begin module implementation refactors until the inventory, architecture gap analysis and dependency-aware phase plan are completed and recorded in the tracker.


### Latest session handoff — 2026-10-16

- Current branch: `feature/refactor-engineering-standards`
- Base: latest `master` commit `6e5c6ae9916a42d61266c80db1c0bcf10a447ba9`
- Completed: `REF-002`, path-level source inventory at `docs/REFACTORING_API_INVENTORY.md`.
- Source snapshot: 238 tracked files, 141 TS/JS source files, 60 Supabase migrations; tree was not truncated.
- Important findings: TanStack Query adoption is partial; no Zustand store/dependency was found; several expense/feed/report routes load server data via effects and access Supabase directly; acquisition-cost UI owns its own query/mutation; React Hook Form is not a declared dependency.
- Next command `1 refactor karo`: select `REF-003` after reading all four required documents. Do not start feature-module implementation until the architecture/gap/transaction audits and phase plan are complete.
- Verification boundary: GitHub source and tree inspection only; local build, lint, typecheck, tests and database execution not run.
