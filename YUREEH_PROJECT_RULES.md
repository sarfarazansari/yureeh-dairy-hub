# YUREEH DAIRY HUB — PROJECT RULES

This is a real dairy farm management application.

The application must model real farm operations,
not generic CRUD screens.

Before implementing any feature:

1. Understand the real-world workflow.
2. Inspect existing database schema.
3. Inspect existing UI patterns.
4. Inspect existing related modules.
5. Reuse established patterns.
6. Identify missing business rules.
7. Consider future reporting requirements.
8. Only then modify the code.

Never implement a feature merely because a field appears
to exist somewhere else.

--------------------------------------------------

ARCHITECTURE

Next.js App Router.

Every major module must have its own route.

CRUD route convention for transaction/master modules:
- Archive/list route: `/module`
- New creation route: `/module/new`
- Edit route: `/module/edit/[id]`
- Every `/new` and `/edit/[id]` page must provide a clear back action to its module archive route.
- Do not leave users stranded on a creation/edit page without navigation back to the archive.

Do not build the application around a single app-view.tsx.

Authentication/route protection must be centralized.

Database access must not be embedded inside large page components.

Business logic must be separated from UI.

Forms must use schema validation.

Prefer React Hook Form + Zod where appropriate.

--------------------------------------------------

CODE QUALITY

Code must be:

- readable
- properly formatted
- properly indented
- logically separated
- typed
- maintainable

Avoid giant components.

Avoid giant files.

Avoid unnecessary abstractions.

Comments should explain WHY, not WHAT.

TYPE / INTERFACE / HELPER MANAGEMENT

Before creating a new type, interface, enum, schema, formula, or helper:

1. Search the existing module and shared application code first.
2. Reuse an existing definition when the domain meaning is the same.
3. Do not create duplicate types that describe the same entity or value.
4. Each feature/module must own its module-specific types and interfaces in a dedicated types file (or clearly separated type files when justified).
5. Module-specific helper functions belong inside that module.
6. Helpers used by multiple modules belong in the central shared lib/helpers area.
7. Generic business formulas and calculations must have one canonical implementation and be reused by all consumers.
8. Do not define domain types ad hoc inside page components, hooks, or services when a canonical module/shared type exists.
9. Keep database, service, form, and UI representations aligned; transform at an explicit boundary when their shapes genuinely differ.
10. A new abstraction is justified only when it represents a real domain distinction or removes meaningful duplication. Do not abstract merely for abstraction's sake.
11. After refactoring, remove obsolete duplicate definitions rather than leaving competing canonical sources.

These rules apply to every module, including modules that were already implemented. New modules must follow them from the first implementation.


--------------------------------------------------

DOMAIN RULES

BUFFALO

A buffalo is an individual animal.

Each buffalo has:

- unique code
- optional name
- breed
- purchase date
- purchase price
- advance/amount paid
- outstanding purchase balance
- vendor

A buffalo purchase is an acquisition transaction.

Additional acquisition costs such as transportation/freight
must be represented separately from the animal's purchase price,
while still being linkable to that buffalo when applicable.

--------------------------------------------------

MILK PRODUCTION

Milk production is recorded per buffalo and per milking shift.

Current operation supports:

- Morning
- Evening

For each buffalo + date + shift:

record milk quantity.

Do NOT measure fat for every individual buffalo.

Record the mixed farm milk pool's fat separately once per business date and shift
(Morning / Evening). This is a pool-level measurement, not a buffalo attribute.
Customer sale/collection fat remains a separate value where it is measured for pricing.

Do not add fields merely because they exist in another module.

--------------------------------------------------

MILK SALES

Milk sales/collection records may contain:

- customer
- date
- shift
- quantity
- fat
- pricing model
- rate
- calculated amount

This is different from buffalo production.

--------------------------------------------------

EXPENSES

Expenses represent actual farm cash/business expenses.

Expense categories must use controlled categories/master data.

Do not use arbitrary free-text categories.

--------------------------------------------------

IMPORTANT

When a requirement is ambiguous:

DO NOT immediately code.

First inspect existing implementation and determine
the most consistent business interpretation.

If multiple interpretations materially affect the database
or business workflow, stop and ask for clarification.

Do not silently invent a major data model.

--------------------------------------------------

DATABASE

Prefer normalized data.

Avoid duplicating information unnecessarily.

Every important relationship should be explicit.

Migrations are required for schema changes.

Never modify production schema manually without a migration.

--------------------------------------------------

UI

Use consistent UI patterns across the application.

Tables should support:

- sensible filtering
- pagination
- loading states
- empty states
- error states

Forms must have:

- validation
- meaningful labels
- sensible defaults
- clear errors
- duplicate prevention where applicable
- success/error feedback



DATE FORMATTING AND READABILITY (MANDATORY FOR EVERY TASK)

- For user-facing date labels in tables, summaries, dialogs and reports, prefer the fully readable `D MMMM YYYY` format (for example, `30 September 2026`) where space allows. Do not use compact numeric/ISO strings as the primary visible date. Existing shared `formatDate` defaults may remain where a screen has an established compact format, but if a user reports readability issues, use the full month name consistently on that screen and its exports.

- Before completing any task, inspect every date/date-range value displayed or affected in the UI, including tables, KPI cards, charts/tooltips, filters, detail pages, exports and insight text.
- Do not expose raw ISO date keys such as `YYYY-MM-DD` to users. Format display values consistently in a human-readable form such as `18 Oct 2026` (or the established project-wide date format if one is already canonical).
- Keep ISO/date-only values for database queries, comparisons, URLs and machine interfaces where appropriate; format only at the presentation boundary. Avoid timezone-induced date shifts.
- For ranges, format both endpoints clearly and label comparison periods (for example, Current period and Previous period). Ensure the user can tell which dates each metric compares.
- For paired date/shift data, group shifts under the same business date when that improves readability, and label each shift column explicitly.
- Every task picker/implementer must run a date-readability regression scan across the touched UI and any closely related screen before marking a task complete, even when date formatting is not the task's primary objective. Add any pre-existing violations discovered to the task tracker instead of silently ignoring them.

--------------------------------------------------

BEFORE EVERY FEATURE

Ask internally:

1. What real-world operation does this represent?
2. What entity owns the data?
3. Is this a master record or transaction?
4. Is this a one-time event or recurring event?
5. What existing module has a similar pattern?
6. What database relationship is required?
7. What reports will eventually depend on this?
8. Can duplicate records be created?
9. What validation is required?
10. What happens when the user edits or deletes it?

Only then implement.

--------------------------------------------------

REFACTORING AND STATE MANAGEMENT STANDARDS

For all refactoring work, also read `docs/REFACTORING_ARCHITECTURE.md` and `docs/REFACTORING_TASKS.md`.

Server state:
- Use TanStack Query for Supabase/API-backed data, query lifecycle, cache, pagination, and invalidation.
- Centralize stable query-key factories. Keys must include every filter and input that changes a result.
- Query hooks call typed feature services. Components and route pages must not scatter Supabase reads/writes.
- Mutations must invalidate or update all affected entity, list, inventory, finance, dashboard, and analytics queries.
- Never copy remote/server state into Zustand as a second cache.
- Do not automatically retry non-idempotent financial, payment, purchase, stock or consumption mutations.

Client state:
- Use local React state for local UI state.
- Use Zustand only for justified shared client-owned state that genuinely spans distant components/routes. Document ownership, consumers, lifecycle and why local state/props/context are insufficient.
- Do not use a store for server records, form values already managed by React Hook Form, or derived values.

Module structure:
- Prefer feature-owned components, hooks, queries, services, schemas, types, utils and constants.
- Add store/effects/tests folders only when justified; do not create empty folders.
- Route files should be thin. Keep data access in typed services and query/mutation hooks.
- Search for existing canonical types, schemas, helpers and formulas before adding new ones. Remove obsolete duplicates after migration.
- Use React Hook Form + Zod for non-trivial forms where appropriate.
- Effects synchronize with external systems; they are not the default data-fetching mechanism.
- Comments explain business invariants and non-obvious WHY decisions, not obvious WHAT statements.

Refactoring execution:
1. Read project rules, workflow handoff, architecture standards and task tracker before coding.
2. Fetch latest origin/master and create a fresh feature branch from it. Never branch from an older feature branch.
3. Select the next highest-priority Pending task whose dependencies are Completed.
4. Trace relevant modules, migrations, RPCs, RLS policies, downstream consumers and reporting before changing code.
5. Refactor one coherent task at a time and preserve verified behavior unless correcting a documented defect.
6. Run relevant type, lint, build, test and regression checks; report what was and was not actually executed.
7. Update `docs/REFACTORING_TASKS.md` and this handoff with status, changed files, validation, blockers and the next task.
8. Do not create PRs, merge branches or modify production data unless explicitly instructed.

Automation command:
When the user says `1 refactor karo` or an unambiguous equivalent, read all four documents above, inspect the latest remote master and current task state, create a fresh branch from latest master, then execute the next unblocked task from the tracker without asking the user to repeat the prompt. Update the tracker and handoff before reporting a concise summary. Ask only for a genuine blocker or a decision that materially affects business correctness.


Shared UI consistency rules:
- A repeated data table used on multiple routes must use one feature-owned shared component; do not maintain near-identical JSX implementations per page.
- Shared tables must own their column labels, row styling, empty-state conventions where applicable, and user-facing date formatting.
- Never display raw ISO business-date keys (YYYY-MM-DD) in user-facing tables. Use the canonical `formatDate` helper and the established full-month format `D MMMM YYYY` where space allows.
- When fixing a repeated UI issue, search all affected routes and migrate them to the same shared component in the same task; do not patch only one screen.


--------------------------------------------------

ROLE-BASED ACCESS CONTROL (RBAC) — MANDATORY

See `docs/RBAC_IMPLEMENTATION_PLAN.md` for the authoritative phase plan and acceptance criteria.

Initial roles:
- `super_admin`: full control over the farm and all existing modules.
- `viewer`: read-only access to explicitly permitted farm data.

Security rules:
- Authorization is enforced in PostgreSQL RLS and every callable RPC/function, not merely by hiding UI controls.
- Resolve role from trusted farm-membership records. Never trust client-provided role values or user-editable metadata.
- Existing owner-scoped `user_id = auth.uid()` policies do not automatically support a second farm member. Map ownership and dependent relationships before changing policies or schema.
- Open signup must never automatically grant membership or administrator access. Viewer provisioning must be initiated through a secure Super Admin-controlled flow.
- Audit `SECURITY DEFINER` functions, execution grants, scheduled operations, views, triggers, and alternate mutation paths.
- Protect against self-promotion, cross-farm data access, stale authorization/cache state, and role changes by unauthorized users.
- Keep milk, customer payment, expense, buffalo lifecycle, feed purchase/inventory/consumption, diet-plan, and financial reconciliation invariants intact.
- Read access to sensitive customer and financial information is a separate decision from write access; follow the explicit viewer data scope documented in the RBAC plan.

RBAC workflow:
1. Read `docs/RBAC_IMPLEMENTATION_PLAN.md` and inspect all affected routes, services, schema, RLS, RPCs and scheduled functions.
2. Complete the route/table/action/RPC permission inventory before broad schema changes.
3. Use additive versioned migrations; never rewrite migrations that may already have been applied.
4. Test both allowed reads and forbidden mutations through UI and direct Supabase API/RPC calls.
5. Keep all RBAC phases on the same explicitly selected feature branch when requested; do not create a branch per phase.
6. Do not create a PR or merge unless the user explicitly asks. Never claim a test or database operation was run unless it was actually executed.


--------------------------------------------------

EXPENSE CATEGORIES VS FEED ITEMS — MANDATORY DATA BOUNDARY

Before modifying generic expenses, expense categories, Feed Master, or feed purchases, read `docs/EXPENSE_CATEGORIES_AND_FEED_ITEMS.md`.

- `expense_categories` are accounting/reporting classifications. `expenses.category_id` must reference an `expense_categories.id`.
- `feed_items` are physical inventory master records. `feed_purchases.feed_item_id` references a `feed_items.id`.
- Never treat `feed_items.id` as an expense category ID. Similar names do not make the records interchangeable.
- The generic `/expenses/new` form and dedicated `/feeds/purchases/new` workflow are not equivalent. Generic expense creation does not stock inventory; feed purchases must go through the transactional purchase workflow when stock-in is intended.
- Shared system expense categories (`owner_id IS NULL`) must not be cloned into farm-owned rows as a form initialization side effect. Read shared plus farm-owned categories and resolve case-insensitive duplicate names by preferring farm-owned records. Resolve overrides before filtering active categories.
- Feed item names must not require one-to-one expense categories. Feed-purchase accounting uses an exact/known mapping when available and the shared active `Other Feed` fallback otherwise, preserving the physical item name in the expense description.
- A missing item in the New Expense dropdown must first be diagnosed at the form/query/RLS data source. An RPC/category fallback migration alone cannot make Feed Master items appear in that dropdown.
- Never claim the fix is verified until the affected query, RLS, save behavior, and relevant dedicated purchase/inventory behavior have been checked. Clearly distinguish GitHub static review from local build/browser tests and live database verification.
