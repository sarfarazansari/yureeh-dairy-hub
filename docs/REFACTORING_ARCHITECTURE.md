# Refactoring Architecture and Engineering Standards

Status: Approved baseline for implementation
Scope: Refactoring existing code; no new business features are implied.
Last reviewed: 2026-10-16

## 1. Product and engineering principles

1. Treat this as a production dairy operations and finance system, not a generic CRUD application.
2. Correctness of milk reconciliation, animal lifecycle, expenses, payments, feed stock and cost ledgers takes priority over cosmetic refactors.
3. Prefer small, reviewable, reversible changes. Do not combine unrelated modules into one refactor.
4. Do not rewrite a working module merely to match a folder diagram. Move boundaries when it materially improves ownership, testability, reuse or correctness.
5. Preserve business behavior unless a verified defect is being fixed and the change is documented.
6. Read the project rules, this document, the task tracker, relevant migrations, and the module's current implementation before work.
7. The user owns PR creation and merging. Never create a PR or merge unless explicitly asked.

## 2. State and data ownership

### Server state: TanStack Query

Use TanStack Query for data fetched from Supabase or another remote source:
- list/detail queries, pagination, filtering and search;
- reference data used by forms;
- mutation lifecycle, retries where safe, cache invalidation and optimistic updates only when safe;
- loading, error, empty and stale states.

Requirements:
- Every query must have a stable, centralized query key.
- Query keys include every input that changes the result: entity ID, date range, shift, page, page size, search and filters.
- Query functions call a typed service. UI components do not query Supabase directly.
- Mutations call typed service functions and update/invalidate all affected keys, including related dashboards or summaries when relevant.
- Never copy server responses into Zustand just to make them available to components.
- Do not automatically retry non-idempotent financial or inventory mutations.
- Use pagination/filtering at the database/service boundary for growing lists.
- Avoid broad invalidation when targeted invalidation is practical; correctness comes before premature optimization.

### Client state: Zustand only when justified

Use local React state for local UI state. Add Zustand only when multiple distant components/routes need the same client-owned state or when a genuine cross-component workflow requires it.
Do not use Zustand for fetched records, server cache, form values already owned by React Hook Form, or derived values that can be computed.
Before introducing a store, document the state owner, consumers, lifecycle, persistence requirement and why props/context/local state are insufficient.

## 3. Data access boundary

Canonical flow:

UI / Route -> Feature component -> query or mutation hook -> feature service -> Supabase client / RPC.

- Keep Supabase reads/writes and RPC invocation in feature services (or a clearly named shared infrastructure service when genuinely cross-domain).
- Route pages orchestrate layout and feature entry points; they must not contain business queries or transaction logic.
- Service methods have explicit input/output types and translate database errors into actionable domain errors at a consistent boundary.
- Keep transaction-critical behavior in PostgreSQL RPCs/constraints where atomicity, concurrency, ledger consistency or RLS enforcement requires it.
- Do not replace an atomic RPC with multiple client-side writes.
- Never bypass RLS or duplicate authorization logic as a substitute for database policies.
- Avoid a generic service/repository abstraction that only wraps Supabase without adding meaningful domain value.

## 4. Canonical feature structure

Use this structure when it fits the module; do not create empty folders or split trivial code without benefit.

```text
src/features/<module>/
├── components/       # Feature UI; split large/reusable components
├── hooks/            # Non-query feature hooks only
├── queries/          # Query keys, query options and TanStack Query hooks
├── services/         # Typed Supabase/RPC data access
├── schemas/          # Zod input/form validation
├── types/            # Canonical module/domain types
├── utils/             # Pure module-specific helpers and calculations
├── constants/         # Stable domain constants
├── store/             # Optional; only justified Zustand stores
├── effects/           # Optional external synchronization/subscriptions
├── __tests__/         # Focused tests
├── <Module>Page.tsx   # Page-level orchestration when useful
└── index.ts           # Optional deliberate public API
```

Ownership rules:
- Use `src/app` for routing, layouts, route guards and thin route entry points.
- Use `src/components/ui` for shared design-system primitives, and existing shared component areas for truly cross-feature components.
- Use `src/lib` for shared infrastructure (Supabase client, query provider, shared utilities) rather than domain-specific business rules.
- Module-specific types, schemas, formulas and helpers belong to their owning feature.
- Shared code belongs in a shared location only when at least two consumers genuinely share the same meaning and behavior.
- Prefer a canonical type/schema over parallel service, form and page definitions. Convert shapes at explicit boundaries when necessary.
- Keep exports intentional; avoid barrel files that create circular imports or obscure dependencies.

Existing route-based feature modules may be migrated gradually. Do not move every file just to conform to a tree; define and document the target boundary, then migrate safely.

## 5. Queries, mutations and effects

### Queries
- Centralize query keys in a query-key factory per feature.
- Query functions must be deterministic for their key and accept cancellation signals where supported and useful.
- Use `enabled` for dependent queries instead of effects that manually trigger fetches.
- Model loading, error, empty and success states explicitly.
- Use `select` or pure utilities for presentation transforms when that avoids repeated calculations without hiding domain rules.
- Avoid refetch loops and unnecessary `refetch()` calls; invalidate or update cache after a successful mutation.
- Never put secrets or sensitive personal data in query keys.

### Mutations
- Validate input before submission; validate business invariants again at the database boundary.
- Disable duplicate submission while pending and use database idempotency/uniqueness for high-risk operations where applicable.
- Provide clear success and error feedback.
- Invalidate every affected entity/list/report key. For finance and inventory, ensure dependent totals and ledgers remain consistent.
- Optimistic updates are permitted only when rollback and concurrency semantics are understood.

### React effects
- Effects are for synchronizing with external systems: subscriptions, browser APIs, imperative widgets, or lifecycle-bound side effects.
- Do not use effects as the default way to fetch server data.
- Do not use effects to calculate values that can be derived during render or with a pure helper.
- Include correct dependencies and cleanup; do not suppress lint rules to hide stale closures.
- Put reusable external synchronization in `effects/` only when there is a meaningful reusable abstraction. A one-off effect does not require a folder.

## 6. Forms and validation

- Use React Hook Form + Zod for non-trivial forms and whenever consistent with existing project dependencies/patterns.
- Reuse canonical schemas for shared domain constraints; form-only refinements can extend a domain schema explicitly.
- Keep labels, validation messages and server errors actionable.
- Do not rely on client validation alone. Important rules must also be enforced by database constraints/RPCs.
- Normalize numeric, date, enum and optional values at an explicit boundary.
- Preserve entered values on recoverable errors where safe.
- Hide or disable irrelevant fields based on domain state without losing data silently.

## 7. Domain and financial integrity

Before modifying a module, trace upstream and downstream effects, including migrations, RPCs, RLS, query invalidation and reports.

Special care:
- Milk production, mixed farm milk pool, customer deliveries and milk sold are distinct concepts. Preserve reconciliation rules.
- Buffalo purchase/acquisition, profile, payment ledger and lifecycle history are distinct concerns.
- Feed purchases, expenses/payments, stock movements, consumption and applied feed cost must not create duplicate financial transactions.
- Posted ledger entries should be changed through safe correction/reversal workflows, not silent destructive edits.
- Preserve audit history and idempotency where transactions or retries can duplicate data.
- Use exact database IDs for durable links, not mutable display codes.
- Migrations must be ordered, safe to apply, compatible with constraints and RLS, and must not assume production data is empty.
- Never apply or claim to apply migrations to the user's remote database unless that operation was explicitly requested and actually performed.

## 8. Types, naming and comments

- Strict TypeScript; avoid `any`, unsafe casts and duplicated domain representations.
- Use descriptive names and consistent casing: components/types PascalCase; hooks `useX`; service methods and utilities camelCase; constants uppercase only for true constants.
- Comments explain why a non-obvious decision exists, or document a critical business invariant. Do not narrate obvious code.
- Public service/RPC boundaries and complex calculations should have useful types and brief documentation.
- Keep functions focused. Extract a function when it improves naming, reuse, testability or cognitive load—not just to reduce line count.
- Remove obsolete paths and duplicate implementations after safe migration.

## 9. Testing and verification

For each task, select checks proportionate to risk:
- type checking/build and lint/format checks where available;
- unit tests for pure calculations, validation and transformations;
- query-key/invalidation checks for mutations;
- regression checks for route imports, props, forms, loading/error states and related modules;
- migration/RPC/RLS consistency review for database-facing work;
- explicit manual test checklist when the environment cannot execute the app or database.

Do not claim a check passed unless it ran successfully. Distinguish:
- Executed and passed
- Executed and failed
- Static review only
- Not run / requires user environment

## 10. Module refactoring workflow

1. Read project rules, this architecture, workflow handoff and task tracker.
2. Fetch latest `origin/master` and create a fresh task-specific branch from it.
3. Select the highest-priority unblocked task from the tracker; do not ask the user to repeat the prompt.
4. Inspect all files, routes, types, services, query hooks, migrations, RPCs, RLS and downstream consumers in scope.
5. Record current behavior and risks before changing code.
6. Implement the smallest coherent change; keep the scope focused.
7. Run checks and review the diff for regressions, unused code and duplicate abstractions.
8. Update task status, files changed, validation results, blockers and next task.
9. Update handoff notes so a new thread can resume from the documents.
10. Report a concise summary. Do not create a PR or merge.

## 11. Automation command

When the user says `1 refactor karo` (or an unambiguous equivalent):
- Read `YUREEH_PROJECT_RULES.md`, `docs/WORKFLOW_AND_HANDOFF.md`, `docs/REFACTORING_ARCHITECTURE.md`, and `docs/REFACTORING_TASKS.md` first.
- Inspect current remote `master` and task branch state; create a fresh feature branch from latest `origin/master`.
- Choose the next pending, unblocked task according to priority/dependencies.
- Complete one coherent task and its regression checks; do not start unrelated modules in the same run.
- Update the tracker and handoff before responding.
- If the next task depends on unavailable local execution or a real business decision, mark it Blocked with the precise reason and continue only with a safe, independent next task if appropriate.
- Never ask the user to restate established project rules or the task scope.
- Do not create a PR, merge, or modify production data.
