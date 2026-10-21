# Role-Based Access Control (RBAC) — Implementation Plan

Status: Implementation in progress; database and app scaffolding added; full audit and runtime verification remain open
Working branch: `feature/rbac-viewer-access`
Base: `master` at `81763e3e872b4ca1216237729d4437e397dd58a7`
Scope: Complete farm-level Super Admin + read-only Viewer access on this single feature branch. Do not create a second feature branch for later phases.

## Product requirement

One farm is managed by a single Super Admin. The owner must be able to invite/share access with another authenticated person who can inspect permitted farm data but cannot change anything.

Initial roles only:
- `super_admin`: full authorized farm administration and all existing business operations.
- `viewer`: read-only access to approved farm data and reports.

Role is a farm membership property, not a user-controlled profile field. Do not trust role values supplied by the client, query parameters, local storage, or user-editable metadata.

## Current-state findings

- Next.js App Router with a shared protected layout and client-side `AuthGate`.
- Supabase email/password authentication is already present.
- `AuthGate` currently offers self-service signup; public signup must not automatically create farm membership or grant any role.
- Sidebar navigation is centralized in `src/components/layout/Sidebar.tsx`.
- Data access uses Supabase/PostgreSQL, RLS, and RPC functions.
- Existing migrations commonly scope records to `user_id = auth.uid()`. A second login will not automatically see the farm owner's rows; shared farm membership and consistent tenant/farm scoping are required.
- Some business-critical operations use RPCs and potentially `SECURITY DEFINER`; these need explicit authorization checks, not only UI changes.
- Current findings are a targeted static inspection, not yet a complete route/table/RPC/policy inventory.

## Security and data-model requirements

1. Audit every route, feature service, table/view, RLS policy, RPC/function, trigger, and scheduled operation that reads or mutates farm data.
2. Establish the canonical farm/tenant ownership model. Preserve all existing records and user access. Do not perform a broad ownership rewrite until all tables and dependent functions/reports are mapped.
3. Add a normalized farm membership/role model (exact schema to be chosen after inventory). Enforce one authorized Super Admin for this initial product requirement, with safe ownership transfer/repair considerations documented.
4. Resolve roles from trusted database membership data. Prevent users from self-promoting, changing their own role, joining a farm without authorization, or creating an admin account through public signup.
5. Apply least-privilege RLS: viewers may SELECT only data for the farm(s) they are authorized to view; viewers must not INSERT, UPDATE, DELETE, or mutate through alternate policies.
6. Audit every RPC, including `SECURITY DEFINER` functions, for explicit authorization and safe `search_path`. Revoke overly broad execution grants where appropriate. Ensure scheduled jobs cannot be invoked or reconfigured by viewers.
7. Do not expose Supabase service-role credentials to the browser. Do not rely on hidden buttons or route guards as the security boundary.
8. Keep audit/ledger and financial integrity rules intact: milk pool, payments, expenses, buffalo lifecycle, feed purchases, inventory movements/consumption, diet plan scheduling, and reconciliation must not regress.
9. Treat private data visibility separately from write permission. Confirm the intended viewer scope for customer contact details, pricing, balances, vendor details, expenses, purchase costs, and profitability before granting read access.
10. Role revocation should take effect promptly; test stale sessions/caches and account switching.

## Viewer UI contract

- Viewer can open only approved read pages and detail/report routes.
- Hide creation/edit/deletion controls, payment and adjustment actions, purchase/consumption mutations, schedule changes, configuration, and user/role management.
- Direct navigation to a write route must be denied or redirected safely.
- UI restrictions improve clarity but do not replace RLS/RPC enforcement.
- Printing/exporting may be available only for data the viewer is authorized to read.
- Do not show viewer a misleading disabled action when it should simply be absent; maintain consistent page layouts and clear read-only treatment.

## Single-branch phase plan

All phases must be completed on `feature/rbac-viewer-access`; do not create a new feature branch between phases.

### Phase 1 — Inventory and security design
- Trace routes, forms/actions, services, queries/mutations, database tables/views, policies, functions/RPCs, triggers, and scheduled operations.
- Build a complete matrix of data objects × SELECT/INSERT/UPDATE/DELETE/EXECUTE permissions.
- Map current `user_id` ownership and foreign-key relationships, including dependent analytics and financial aggregates.
- Identify signup/invitation flow and safe initial Super Admin bootstrap.
- Decide viewer-visible sensitive data scope, recording unresolved decisions as explicit blockers.
- Deliver audit and migration strategy before broad schema edits.

### Phase 2 — Database membership and migration
- Add versioned migration(s); never edit migrations that may already have been applied.
- Implement farm membership and trusted role lookup.
- Preserve existing owner access through safe backfill/bootstrap.
- Keep migrations idempotent where practical and validate constraints, grants, and RLS interactions.

### Phase 3 — RLS and RPC hardening
- Update policies for authorized farm membership across every in-scope table/view.
- Ensure Viewer cannot mutate via direct REST/PostgREST calls, SQL RPCs, nested writes, or SECURITY DEFINER functions.
- Verify role-management operations are Super Admin-only and prevent privilege escalation.
- Preserve transaction atomicity and business integrity.

### Phase 4 — Authentication and invitation/access lifecycle
- Keep sign-in flow; remove or safely gate open signup.
- Add a Super Admin-controlled way to provision/invite a Viewer using a supported secure Supabase flow.
- Never allow a client to assign its own role. Handle pending invitations, existing accounts, duplicate membership, revocation, and errors.

### Phase 5 — Role-aware routes and UI
- Centralize role resolution and authorization helpers.
- Apply protection at route/page and action boundaries.
- Update sidebar, forms, detail pages, settings, dialogs, menus, and every mutation entry point.
- Keep allowed read views usable on mobile and desktop.

### Phase 6 — Regression and security verification
- Test Super Admin's existing flows across every module.
- Test Viewer SELECT access, forbidden writes through UI and direct API/RPC, route bypasses, cross-farm reads, privilege escalation, invite/revoke, and account switching.
- Run typecheck, lint, build, tests, migration validation, and module-level regression scenarios where available.
- Explicitly report any checks that could not be run locally or against a test Supabase project. Never claim an unexecuted check passed.

### Phase 7 — Documentation and handoff
- Update this plan with completed status/evidence, and update `YUREEH_PROJECT_RULES.md` plus `docs/WORKFLOW_AND_HANDOFF.md`.
- Keep all implementation commits on this single branch.
- Do not create a PR or merge; the user owns those actions.
- Do not apply destructive changes or modify production data without explicit authorization.

## Acceptance criteria

- Exactly one authorized Super Admin retains all existing capabilities.
- A Viewer can sign in and view only the permitted farm data.
- A Viewer cannot mutate any table or business workflow through the UI, direct API, RPC, or alternate entry point.
- A Viewer cannot elevate privileges, alter membership, or access another farm's data.
- Public signup cannot grant farm access automatically.
- Existing milk, customer payment, expense, buffalo, feed, inventory, diet-plan, and financial reporting behavior remains correct for Super Admin.
- Migration and backfill preserve existing records and audit history.
- Validation results and any remaining limitations are recorded honestly.

## Work log

- 2026-10-20: Branch created from latest observed `master` commit `81763e3e872b4ca1216237729d4437e397dd58a7`.
- 2026-10-20: Initial static inspection confirmed Supabase AuthGate, public signup toggle, centralized sidebar, owner-scoped RLS patterns, and multiple reporting/mutation RPCs.
- 2026-10-20: Added `20261020150000_rbac_viewer_access.sql`: membership model, data-owner backfill, trusted role helpers, email-confirmed invitation claim, farm-aware SELECT policies, and a database trigger that rejects Viewer writes on public base tables.
- 2026-10-20: Added `20261020160000_rbac_read_rpc_owner_scope.sql` for eight read-only pricing/reporting/milk-pool RPCs whose bodies explicitly filtered on `auth.uid()`.
- 2026-10-20: Added role context, membership-aware auth gate, Super Admin Viewer invitation/revocation UI, initial write-route guard, role-aware sidebar, and read-only banner.
- 2026-10-20: Static review only. No local checkout is available in this session; neither migrations nor app changes have been typechecked, built, linted, browser-tested, or applied to Supabase.

## Current status by phase

- Phase 1: **Partial.** Core routes and representative table/RPC patterns identified. Exhaustive inventory of every table/view/function/grant/trigger/scheduler and deployed-only RPC remains open.
- Phase 2: **Implemented in source, not validated.** Membership schema/backfill migration added. Must validate backfill against actual database contents before applying.
- Phase 3: **Partial.** Farm-aware SELECT policies and write-guard trigger added; six read-only RPCs updated. Need inspect every policy/view/RPC, and verify all privilege paths. The former `get_buffalo_production_sheet` client dependency was replaced by direct RLS-scoped queries because no corresponding migration definition was found.
- Phase 4: **Initial implementation.** Invitation create/revoke and email-confirmed claim flow added. Must test existing users, confirmed/unconfirmed email, duplicate invites, revocation/re-invitation, and account switching.
- Phase 5: **Partial, targeted follow-up fixes added 2026-10-21.** Central role context, route guard, sidebar filtering, and read-only banner are present. Viewer mutation controls were hidden on customer detail, buffalo detail, expense detail/history, and feed inventory. Remaining mixed pages (including customer directory, buffalo list, feed pages, and any unreviewed dialogs/actions) still need a page-by-page mutation-control pass.
- Phase 6: **Not run.** Typecheck, lint, build, tests, migration parse/apply, direct API/RPC write denial, cross-farm isolation, and Super Admin regression all require execution.
- Phase 7: **Partial.** This plan, route/data inventory, project rules, and handoff have been updated; final verified handoff remains pending.

Phase 1 inventory: see `docs/RBAC_ROUTE_AND_DATA_INVENTORY.md`. This branch is not ready for production or merge until the open verification items above are resolved.

- 2026-10-21: Post-migration RBAC UI audit found mutation controls still visible on mixed read/write screens. Added Viewer-aware hiding for customer creation and row actions (edit/rate/activate), customer payment entry on customer details, buffalo purchase creation, buffalo profile/purchase/vendor edits plus acquisition/disposition/payment/status forms on buffalo details, supplier payment entry on expense detail, expense edit/delete dialogs and setup writes on expense history, and feed inventory purchase/consume/threshold shortcuts. Each changed file was fetched back from GitHub and content-verified. These are targeted fixes, not a complete page-by-page audit.
